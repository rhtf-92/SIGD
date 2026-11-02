import type { Pool, PoolClient } from 'pg';
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
  ConflictError,
} from '../../shared/domain/errors/index.js';

export interface SolicitudVinculacionDTO {
  idSolicitud: string;
  expedienteId: string;
  cut: string;
  asunto: string;
  estado: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA' | 'ANULADA';
  motivoSolicitud?: string | null;
  motivoRechazo?: string | null;
  solicitadoEn: string;
  resueltoEn?: string | null;
}

export interface SolicitudPendienteMesaDTO {
  idSolicitud: string;
  expedienteId: string;
  cut: string;
  fechaRadicacion: string;
  asunto: string;
  numeroDocumento: string;
  tipoPersona: string;
  nombreSolicitante: string;
  usernameSolicitante: string;
  correoCuenta: string;
  estado: string;
  motivoSolicitud?: string | null;
  solicitadoEn: string;
}

export class VinculacionHistoricaService {
  constructor(private readonly pool: Pool) {}

  /**
   * Un ciudadano autenticado solicita vincular a su cuenta un expediente histórico
   * que fue radicado previamente a su nombre (por ventanilla presencial o mesa digital).
   */
  async solicitarVinculacion(params: {
    idUsuario: string;
    idPersona: string;
    cut: string;
    motivo?: string;
  }): Promise<SolicitudVinculacionDTO> {
    const cutNormalizado = params.cut.trim().toUpperCase();

    const cliente = await this.pool.connect();
    let transaccionAbierta = false;
    try {
      await cliente.query('BEGIN');
      transaccionAbierta = true;

      // 1. Verificar existencia del expediente
      const expRes = await cliente.query<{
        expediente_id: string;
        codigo_expediente: string;
        solicitante_id: string;
        id_usuario_creador: string | null;
        estado: string;
        asunto: string;
      }>(
        `SELECT e.expediente_id, e.codigo_expediente, e.solicitante_id,
                e.id_usuario_creador, e.estado,
                COALESCE(tr.asunto, '') AS asunto
           FROM sigd_tra.expediente e
           LEFT JOIN sigd_tra.tramite tr ON tr.expediente_id = e.expediente_id
          WHERE e.codigo_expediente = $1
            AND e.estado <> 'ANULADO'
          LIMIT 1`,
        [cutNormalizado],
      );

      const expediente = expRes.rows[0];
      if (!expediente) {
        throw new NotFoundError({
          message: 'No existe un expediente activo con el CUT consultado.',
          detail: 'Verifique que el código CUT esté bien escrito y corresponda a un trámite vigente.',
        });
      }

      // 2. Control BOLA: El expediente DEBE corresponder a la misma persona (mismo documento)
      if (expediente.solicitante_id !== params.idPersona) {
        throw new ForbiddenError({
          message: 'El expediente consultado no corresponde a su identidad como administrado.',
          detail: 'Solo puede solicitar la vinculación de expedientes registrados con su propio documento de identidad.',
        });
      }

      // 3. Verificar si ya está vinculado a esta cuenta
      if (expediente.id_usuario_creador === params.idUsuario) {
        throw new ConflictError({
          code: 'EXPEDIENTE_YA_VINCULADO',
          message: 'El expediente ya se encuentra vinculado a su cuenta de usuario.',
        });
      }

      const vinculoAprobado = await cliente.query<{ id_solicitud: string }>(
        `SELECT id_solicitud
           FROM sigd_tra.solicitud_vinculacion_expediente
          WHERE expediente_id = $1::uuid
            AND id_usuario = $2::uuid
            AND estado = 'APROBADA'
          LIMIT 1`,
        [expediente.expediente_id, params.idUsuario],
      );
      if (vinculoAprobado.rows[0]) {
        throw new ConflictError({
          code: 'EXPEDIENTE_YA_VINCULADO',
          message: 'El expediente ya se encuentra vinculado y aprobado para su cuenta.',
        });
      }

      // 4. Verificar si ya existe una solicitud PENDIENTE
      const solicitudPendiente = await cliente.query<{ id_solicitud: string }>(
        `SELECT id_solicitud
           FROM sigd_tra.solicitud_vinculacion_expediente
          WHERE expediente_id = $1::uuid
            AND id_usuario = $2::uuid
            AND estado = 'PENDIENTE'
          LIMIT 1`,
        [expediente.expediente_id, params.idUsuario],
      );
      if (solicitudPendiente.rows[0]) {
        throw new ConflictError({
          code: 'SOLICITUD_YA_PENDIENTE',
          message: 'Ya existe una solicitud de vinculación en trámite para este expediente.',
        });
      }

      // 5. Insertar solicitud de vinculación
      const insertRes = await cliente.query<{
        id_solicitud: string;
        solicitado_en: Date;
      }>(
        `INSERT INTO sigd_tra.solicitud_vinculacion_expediente (
           expediente_id, persona_id, id_usuario, estado, motivo_solicitud
         ) VALUES (
           $1::uuid, $2::uuid, $3::uuid, 'PENDIENTE', $4
         ) RETURNING id_solicitud, solicitado_en`,
        [
          expediente.expediente_id,
          params.idPersona,
          params.idUsuario,
          params.motivo || null,
        ],
      );

      await cliente.query('COMMIT');
      transaccionAbierta = false;

      const creada = insertRes.rows[0];
      return {
        idSolicitud: creada.id_solicitud,
        expedienteId: expediente.expediente_id,
        cut: expediente.codigo_expediente,
        asunto: expediente.asunto,
        estado: 'PENDIENTE',
        motivoSolicitud: params.motivo || null,
        solicitadoEn: creada.solicitado_en.toISOString(),
      };
    } catch (error) {
      if (transaccionAbierta) await cliente.query('ROLLBACK');
      throw error;
    } finally {
      cliente.release();
    }
  }

  /**
   * Lista las solicitudes de vinculación realizadas por el ciudadano autenticado.
   */
  async listarMisSolicitudes(idUsuario: string): Promise<SolicitudVinculacionDTO[]> {
    const res = await this.pool.query<{
      id_solicitud: string;
      expediente_id: string;
      cut: string;
      asunto: string;
      estado: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA' | 'ANULADA';
      motivo_solicitud: string | null;
      motivo_rechazo: string | null;
      solicitado_en: Date;
      resuelto_en: Date | null;
    }>(
      `SELECT sv.id_solicitud, sv.expediente_id, e.codigo_expediente AS cut,
              COALESCE(tr.asunto, '') AS asunto,
              sv.estado, sv.motivo_solicitud, sv.motivo_rechazo,
              sv.solicitado_en, sv.resuelto_en
         FROM sigd_tra.solicitud_vinculacion_expediente sv
         JOIN sigd_tra.expediente e ON e.expediente_id = sv.expediente_id
         LEFT JOIN sigd_tra.tramite tr ON tr.expediente_id = e.expediente_id
        WHERE sv.id_usuario = $1::uuid
        ORDER BY sv.solicitado_en DESC`,
      [idUsuario],
    );

    return res.rows.map((r) => ({
      idSolicitud: r.id_solicitud,
      expedienteId: r.expediente_id,
      cut: r.cut,
      asunto: r.asunto,
      estado: r.estado,
      motivoSolicitud: r.motivo_solicitud,
      motivoRechazo: r.motivo_rechazo,
      solicitadoEn: r.solicitado_en.toISOString(),
      resueltoEn: r.resuelto_en ? r.resuelto_en.toISOString() : null,
    }));
  }

  /**
   * Vista operativa para Mesa de Partes y Administrador: solicitudes de vinculación pendientes.
   */
  async listarPendientesMesa(): Promise<SolicitudPendienteMesaDTO[]> {
    const res = await this.pool.query<{
      id_solicitud: string;
      expediente_id: string;
      cut: string;
      fecha_radicacion: Date;
      asunto: string;
      numero_documento: string;
      tipo_persona: string;
      nombre_solicitante: string;
      username_solicitante: string;
      correo_cuenta: string;
      estado: string;
      motivo_solicitud: string | null;
      solicitado_en: Date;
    }>(
      `SELECT sv.id_solicitud, sv.expediente_id, e.codigo_expediente AS cut,
              e.fecha_radicacion,
              COALESCE(tr.asunto, '') AS asunto,
              p.id_documento AS numero_documento,
              p.tipo AS tipo_persona,
              COALESCE(pn.nombre_completo, pj.razon_social, p.id_documento) AS nombre_solicitante,
              cu.usuario AS username_solicitante,
              cu.correo AS correo_cuenta,
              sv.estado, sv.motivo_solicitud,
              sv.solicitado_en
         FROM sigd_tra.solicitud_vinculacion_expediente sv
         JOIN sigd_tra.expediente e ON e.expediente_id = sv.expediente_id
         JOIN sigd_auth.persona p ON p.id_persona = sv.persona_id
         LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = p.id_persona
         LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = p.id_persona
         JOIN sigd_auth.cuenta_usuario cu ON cu.id_usuario = sv.id_usuario
         LEFT JOIN sigd_tra.tramite tr ON tr.expediente_id = e.expediente_id
        WHERE sv.estado = 'PENDIENTE'
        ORDER BY sv.solicitado_en ASC`,
    );

    return res.rows.map((r) => ({
      idSolicitud: r.id_solicitud,
      expedienteId: r.expediente_id,
      cut: r.cut,
      fechaRadicacion: r.fecha_radicacion.toISOString(),
      asunto: r.asunto,
      numeroDocumento: r.numero_documento,
      tipoPersona: r.tipo_persona,
      nombreSolicitante: r.nombre_solicitante,
      usernameSolicitante: r.username_solicitante,
      correoCuenta: r.correo_cuenta,
      estado: r.estado,
      motivoSolicitud: r.motivo_solicitud,
      solicitadoEn: r.solicitado_en.toISOString(),
    }));
  }

  /**
   * Mesa de Partes o Administrador resuelve (APRUEBA o RECHAZA) una solicitud de vinculación.
   */
  async resolverSolicitud(
    idSolicitud: string,
    operadorId: string,
    input: { decision: 'APROBADA' | 'RECHAZADA'; motivoRechazo?: string },
  ): Promise<{ idSolicitud: string; estado: string; resueltoEn: string }> {
    const cliente = await this.pool.connect();
    let transaccionAbierta = false;
    try {
      await cliente.query('BEGIN');
      transaccionAbierta = true;

      const solRes = await cliente.query<{
        id_solicitud: string;
        expediente_id: string;
        id_usuario: string;
        estado: string;
      }>(
        `SELECT id_solicitud, expediente_id, id_usuario, estado
           FROM sigd_tra.solicitud_vinculacion_expediente
          WHERE id_solicitud = $1::uuid
            FOR UPDATE`,
        [idSolicitud],
      );

      const solicitud = solRes.rows[0];
      if (!solicitud) {
        throw new NotFoundError({
          message: 'No existe la solicitud de vinculación especificada.',
        });
      }

      if (solicitud.estado !== 'PENDIENTE') {
        throw new ConflictError({
          code: 'SOLICITUD_YA_RESUELTA',
          message: `La solicitud ya fue resuelta previamente con estado ${solicitud.estado}.`,
        });
      }

      const ahora = new Date();

      if (input.decision === 'APROBADA') {
        await cliente.query(
          `UPDATE sigd_tra.solicitud_vinculacion_expediente
              SET estado = 'APROBADA',
                  resuelto_en = $2,
                  resuelto_por = $3::uuid
            WHERE id_solicitud = $1::uuid`,
          [idSolicitud, ahora, operadorId],
        );

        // Asociar creador en el expediente si aún no tenía cuenta creadora asociada
        await cliente.query(
          `UPDATE sigd_tra.expediente
              SET id_usuario_creador = $2::uuid
            WHERE expediente_id = $1::uuid
              AND id_usuario_creador IS NULL`,
          [solicitud.expediente_id, solicitud.id_usuario],
        );
      } else {
        if (!input.motivoRechazo || input.motivoRechazo.trim().length === 0) {
          throw new ValidationError({
            message: 'Debe especificar el motivo del rechazo de la vinculación.',
            invalidParams: [{ name: 'motivoRechazo', reason: 'Motivo de rechazo requerido' }],
          });
        }

        await cliente.query(
          `UPDATE sigd_tra.solicitud_vinculacion_expediente
              SET estado = 'RECHAZADA',
                  motivo_rechazo = $2,
                  resuelto_en = $3,
                  resuelto_por = $4::uuid
            WHERE id_solicitud = $1::uuid`,
          [idSolicitud, input.motivoRechazo.trim(), ahora, operadorId],
        );
      }

      await cliente.query('COMMIT');
      transaccionAbierta = false;

      return {
        idSolicitud,
        estado: input.decision,
        resueltoEn: ahora.toISOString(),
      };
    } catch (error) {
      if (transaccionAbierta) await cliente.query('ROLLBACK');
      throw error;
    } finally {
      cliente.release();
    }
  }
}
