import type { PoolClient, Pool } from 'pg';
import { NotFoundError, ValidationError, ForbiddenError } from '../../shared/domain/errors/index.js';
import { insertarEvento } from '../../audit/evento-outbox.repository.js';

export interface DtoExpedienteAsignacion {
  idAsignacion: string;
  expedienteId: string;
  idPersona: string;
  idUsuario: string;
  idArea: string;
  asignadoPor: string;
  motivo: string;
  activo: boolean;
  asignadoEn: string;
  desasignadoEn: string | null;
  desasignadoPor: string | null;
  motivoDesasignacion: string | null;
  personaNombre?: string;
  areaNombre?: string;
  usuario?: string;
  nombreCompleto?: string;
}

export interface AsignarExpedienteInput {
  expedienteId: string;
  idPersona: string;
  idUsuario: string;
  motivo: string;
  asignadoPorUsuarioId: string;
}

export interface CandidatoAsignacionDTO {
  idUsuario: string;
  idPersona: string;
  usuario: string;
  nombreCompleto: string;
  rolCodigo: string;
  perfilCodigo: string | null;
  alcance: any;
  esPrioritario: boolean;
}

export class ExpedienteAsignacionService {
  constructor(private readonly pool: Pool) {}

  /**
   * Asigna operativamente un expediente a un funcionario individual dentro del área de custodia.
   * Valida en tiempo real (FAIL-CLOSED):
   * - Persona existe.
   * - Cuenta de usuario existe y está activa.
   * - Vínculo institucional vigente.
   * - Asignación laboral o perfil operativo activo compatible con el área del expediente.
   */
  async asignarExpediente(
    input: AsignarExpedienteInput,
    clienteParam?: PoolClient,
  ): Promise<DtoExpedienteAsignacion> {
    const db = clienteParam ?? this.pool;

    // 1. Validar que el expediente existe y obtener su área actual de custodia
    const resExp = await db.query<{ area_actual_id: string | null; area_destino_id: string | null }>(
      `SELECT COALESCE(u.area_actual_id, e.area_destino_id::text) AS area_actual_id
         FROM sigd_tra.expediente e
         LEFT JOIN sigd_rut.estado_actual_expediente u ON u.expediente_id = e.expediente_id
        WHERE e.expediente_id = $1::uuid`,
      [input.expedienteId],
    );

    if (resExp.rows.length === 0) {
      throw new NotFoundError({ message: `El expediente ${input.expedienteId} no existe.` });
    }

    const areaActualId = resExp.rows[0].area_actual_id;
    if (!areaActualId) {
      throw new ValidationError({
        message: 'El expediente no tiene área de custodia asignada. No se puede realizar asignación individual.',
      });
    }

    // 2. Validar que la persona existe
    const resPersona = await db.query<{ id_persona: string }>(
      `SELECT id_persona FROM sigd_auth.persona WHERE id_persona = $1::uuid`,
      [input.idPersona],
    );
    if (resPersona.rows.length === 0) {
      throw new NotFoundError({ message: 'La persona indicada para asignación no existe.' });
    }

    // 3. Validar que la cuenta de usuario existe y está habilitada
    const resCuenta = await db.query<{ id_usuario: string; activo: boolean; id_persona: string }>(
      `SELECT id_usuario, activo, id_persona FROM sigd_auth.cuenta_usuario WHERE id_usuario = $1::uuid`,
      [input.idUsuario],
    );
    if (resCuenta.rows.length === 0) {
      throw new NotFoundError({ message: 'La cuenta de usuario indicada no existe.' });
    }
    if (!resCuenta.rows[0].activo) {
      throw new ForbiddenError({
        message: 'La cuenta del funcionario se encuentra deshabilitada (FAIL-CLOSED).',
        detail: 'La cuenta del funcionario se encuentra deshabilitada (FAIL-CLOSED).',
      });
    }
    if (resCuenta.rows[0].id_persona !== input.idPersona) {
      throw new ValidationError({ message: 'La cuenta de usuario no corresponde a la persona indicada.' });
    }

    // 4. Validar vínculo institucional vigente
    const resVinculo = await db.query<{ id_vinculo: string }>(
      `SELECT id_vinculo
         FROM sigd_auth.vinculo_institucional
        WHERE id_persona = $1::uuid
          AND estado = 'ACTIVO'
          AND vigente_desde <= now()
          AND (vigente_hasta IS NULL OR vigente_hasta > now())
        LIMIT 1`,
      [input.idPersona],
    );
    if (resVinculo.rows.length === 0) {
      throw new ForbiddenError({
        message: 'El funcionario no cuenta con un vínculo institucional vigente.',
        detail: 'El funcionario no cuenta con un vínculo institucional vigente.',
      });
    }

    // 5. Validar que el funcionario pertenezca o tenga perfil/responsabilidad en el área actual del expediente (o área jerárquica padre/hija)
    const resPertenenciaArea = await db.query<{ valida: boolean }>(
      `SELECT (
        EXISTS (
          SELECT 1 FROM sigd_org.asignacion_personal ap
           WHERE ap.id_persona = $1::uuid
             AND (
               ap.area_id = $2::uuid
               OR ap.area_id IN (SELECT area_id FROM sigd_org.area WHERE area_padre_id = $2::uuid)
               OR ap.area_id IN (SELECT area_padre_id FROM sigd_org.area WHERE area_id = $2::uuid AND area_padre_id IS NOT NULL)
             )
             AND ap.estado = 'ACTIVO'
             AND ap.vigente_desde <= now()
             AND (ap.vigente_hasta IS NULL OR ap.vigente_hasta > now())
        ) OR EXISTS (
          SELECT 1 FROM sigd_org.asignacion_perfil_operativo apo
           WHERE apo.id_usuario = $3::uuid
             AND (
               apo.area_id = $2::uuid
               OR apo.area_id IN (SELECT area_id FROM sigd_org.area WHERE area_padre_id = $2::uuid)
               OR apo.area_id IN (SELECT area_padre_id FROM sigd_org.area WHERE area_id = $2::uuid AND area_padre_id IS NOT NULL)
               OR apo.scope = 'INSTITUCIONAL'
             )
             AND apo.estado = 'ACTIVO'
             AND apo.vigente_desde <= now()
             AND (apo.vigente_hasta IS NULL OR apo.vigente_hasta > now())
        ) OR EXISTS (
          SELECT 1 FROM sigd_org.responsabilidad_temporal rt
           WHERE (rt.id_persona = $1::uuid OR rt.id_usuario = $3::uuid)
             AND (
               rt.area_id = $2::uuid
               OR rt.area_id IN (SELECT area_id FROM sigd_org.area WHERE area_padre_id = $2::uuid)
               OR rt.area_id IN (SELECT area_padre_id FROM sigd_org.area WHERE area_id = $2::uuid AND area_padre_id IS NOT NULL)
             )
             AND rt.estado = 'ACTIVO'
             AND rt.vigente_desde <= now()
             AND (rt.vigente_hasta IS NULL OR rt.vigente_hasta > now())
        ) OR EXISTS (
          SELECT 1 FROM sigd_org.usuario_rol ur
           WHERE ur.id_usuario = $3::uuid
             AND (
               ur.area_id = $2::uuid
               OR ur.area_id IN (SELECT area_id FROM sigd_org.area WHERE area_padre_id = $2::uuid)
               OR ur.area_id IN (SELECT area_padre_id FROM sigd_org.area WHERE area_id = $2::uuid AND area_padre_id IS NOT NULL)
             )
             AND ur.vigente_desde <= now()
             AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
        )
      ) AS valida`,
      [input.idPersona, areaActualId, input.idUsuario],
    );

    if (!resPertenenciaArea.rows[0]?.valida) {
      throw new ForbiddenError({
        message: `ASIGNACION_NO_VIGENTE: El funcionario no cuenta con asignación laboral, perfil operativo ni responsabilidad activa en el área ${areaActualId}.`,
        detail: `ASIGNACION_NO_VIGENTE: El funcionario no cuenta con asignación laboral, perfil operativo ni responsabilidad activa en el área ${areaActualId}.`,
      });
    }

    // 6. Desactivar asignación previa si existiese (reasignación trazable)
    await db.query(
      `UPDATE sigd_rut.expediente_asignacion
          SET activo = false,
              desasignado_en = now(),
              desasignado_por = $2::uuid,
              motivo_desasignacion = 'REASIGNACION'
        WHERE expediente_id = $1::uuid
          AND activo = true`,
      [input.expedienteId, input.asignadoPorUsuarioId],
    );

    // 7. Insertar nueva asignación activa
    const { rows: asigRows } = await db.query<{
      id_asignacion: string;
      expediente_id: string;
      id_persona: string;
      id_usuario: string;
      id_area: string;
      asignado_por: string;
      motivo: string;
      activo: boolean;
      asignado_en: Date;
    }>(
      `INSERT INTO sigd_rut.expediente_asignacion (
        expediente_id, id_persona, id_usuario, id_area, asignado_por, motivo, activo
      ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6, true)
      RETURNING id_asignacion, expediente_id, id_persona, id_usuario, id_area, asignado_por, motivo, activo, asignado_en`,
      [
        input.expedienteId,
        input.idPersona,
        input.idUsuario,
        areaActualId,
        input.asignadoPorUsuarioId,
        input.motivo,
      ],
    );

    // 8. Actualizar proyección de estado_actual_expediente
    await db.query(
      `UPDATE sigd_rut.estado_actual_expediente
          SET persona_asignada_id = $2::uuid,
              usuario_asignado_id = $3::uuid
        WHERE expediente_id = $1::uuid`,
      [input.expedienteId, input.idPersona, input.idUsuario],
    );

    const r = asigRows[0];

    // 9. Registrar evento en Outbox
    if (clienteParam) {
      await insertarEvento(clienteParam, {
        agregado: 'Expediente',
        tipo_evento: 'ExpedienteAsignado',
        payload: {
          identidad: { expediente_id: input.expedienteId, asignacion_id: r.id_asignacion },
          contexto: {
            asignado_por: input.asignadoPorUsuarioId,
            area_id: areaActualId,
            persona_asignada_id: input.idPersona,
            usuario_asignado_id: input.idUsuario,
          },
          datos_especificos: { motivo: input.motivo },
        },
      });
    }

    return {
      idAsignacion: r.id_asignacion,
      expedienteId: r.expediente_id,
      idPersona: r.id_persona,
      idUsuario: r.id_usuario,
      idArea: r.id_area,
      asignadoPor: r.asignado_por,
      motivo: r.motivo,
      activo: r.activo,
      asignadoEn: r.asignado_en.toISOString(),
      desasignadoEn: null,
      desasignadoPor: null,
      motivoDesasignacion: null,
    };
  }

  /**
   * Desasigna a un funcionario sin mover el expediente de su área de custodia.
   */
  async desasignarExpediente(
    expedienteId: string,
    desasignadoPorUsuarioId: string,
    motivo: string,
    clienteParam?: PoolClient,
  ): Promise<void> {
    const db = clienteParam ?? this.pool;

    await db.query(
      `UPDATE sigd_rut.expediente_asignacion
          SET activo = false,
              desasignado_en = now(),
              desasignado_por = $2::uuid,
              motivo_desasignacion = $3
        WHERE expediente_id = $1::uuid
          AND activo = true`,
      [expedienteId, desasignadoPorUsuarioId, motivo],
    );

    // Limpiar funcionario asignado en la proyección de estado actual (mantiene custodia de área)
    await db.query(
      `UPDATE sigd_rut.estado_actual_expediente
          SET persona_asignada_id = NULL,
              usuario_asignado_id = NULL
        WHERE expediente_id = $1::uuid`,
      [expedienteId],
    );

    if (clienteParam) {
      await insertarEvento(clienteParam, {
        agregado: 'Expediente',
        tipo_evento: 'ExpedienteDesasignado',
        payload: {
          identidad: { expediente_id: expedienteId },
          contexto: { desasignado_por: desasignadoPorUsuarioId },
          datos_especificos: { motivo },
        },
      });
    }
  }

  async obtenerAsignacionActiva(
    expedienteId: string,
    clienteParam?: PoolClient | Pool,
  ): Promise<DtoExpedienteAsignacion | null> {
    const db = clienteParam ?? this.pool;
    const { rows } = await db.query<{
      id_asignacion: string;
      expediente_id: string;
      id_persona: string;
      id_usuario: string;
      id_area: string;
      asignado_por: string;
      motivo: string;
      activo: boolean;
      asignado_en: Date;
      desasignado_en: Date | null;
      desasignado_por: string | null;
      motivo_desasignacion: string | null;
      area_nombre: string;
      usuario: string;
      nombre_completo: string;
    }>(
      `SELECT a.*,
              ar.nombre AS area_nombre,
              cu.usuario,
              pn.nombre_completo
         FROM sigd_rut.expediente_asignacion a
         JOIN sigd_org.area ar ON ar.area_id = a.id_area
         LEFT JOIN sigd_auth.cuenta_usuario cu ON cu.id_usuario = a.id_usuario
         LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = a.id_persona
        WHERE a.expediente_id = $1::uuid
          AND a.activo = true
        LIMIT 1`,
      [expedienteId],
    );

    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      idAsignacion: r.id_asignacion,
      expedienteId: r.expediente_id,
      idPersona: r.id_persona,
      idUsuario: r.id_usuario,
      idArea: r.id_area,
      asignadoPor: r.asignado_por,
      motivo: r.motivo,
      activo: r.activo,
      asignadoEn: r.asignado_en.toISOString(),
      desasignadoEn: r.desasignado_en ? r.desasignado_en.toISOString() : null,
      desasignadoPor: r.desasignado_por,
      motivoDesasignacion: r.motivo_desasignacion,
      areaNombre: r.area_nombre,
      usuario: r.usuario,
      nombreCompleto: r.nombre_completo,
    };
  }

  async listarHistorialAsignaciones(
    expedienteId: string,
    clienteParam?: PoolClient | Pool,
  ): Promise<DtoExpedienteAsignacion[]> {
    const db = clienteParam ?? this.pool;
    const { rows } = await db.query<{
      id_asignacion: string;
      expediente_id: string;
      id_persona: string;
      id_usuario: string;
      id_area: string;
      asignado_por: string;
      motivo: string;
      activo: boolean;
      asignado_en: Date;
      desasignado_en: Date | null;
      desasignado_por: string | null;
      motivo_desasignacion: string | null;
      area_nombre: string;
      usuario: string;
      nombre_completo: string;
    }>(
      `SELECT a.*,
              ar.nombre AS area_nombre,
              cu.usuario,
              pn.nombre_completo
         FROM sigd_rut.expediente_asignacion a
         JOIN sigd_org.area ar ON ar.area_id = a.id_area
         LEFT JOIN sigd_auth.cuenta_usuario cu ON cu.id_usuario = a.id_usuario
         LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = a.id_persona
        WHERE a.expediente_id = $1::uuid
        ORDER BY a.asignado_en ASC`,
      [expedienteId],
    );

    return rows.map((r) => ({
      idAsignacion: r.id_asignacion,
      expedienteId: r.expediente_id,
      idPersona: r.id_persona,
      idUsuario: r.id_usuario,
      idArea: r.id_area,
      asignadoPor: r.asignado_por,
      motivo: r.motivo,
      activo: r.activo,
      asignadoEn: r.asignado_en.toISOString(),
      desasignadoEn: r.desasignado_en ? r.desasignado_en.toISOString() : null,
      desasignadoPor: r.desasignado_por,
      motivoDesasignacion: r.motivo_desasignacion,
      areaNombre: r.area_nombre,
      usuario: r.usuario,
      nombreCompleto: r.nombre_completo,
    }));
  }

  /**
   * Lista funcionarios activos del área actual del expediente elegibles para asignación,
   * ordenando y priorizando según el perfil operativo requerido por el procedimiento TUPA.
   */
  async listarCandidatosAsignacion(
    expedienteId: string,
    clienteParam?: PoolClient | Pool,
  ): Promise<CandidatoAsignacionDTO[]> {
    const db = clienteParam ?? this.pool;

    const resExp = await db.query<{
      area_actual_id: string | null;
      perfil_requerido_codigo: string | null;
    }>(
      `SELECT
         COALESCE(u.area_actual_id, e.area_destino_id::text) AS area_actual_id,
         po.codigo AS perfil_requerido_codigo
       FROM sigd_tra.expediente e
       LEFT JOIN sigd_rut.estado_actual_expediente u ON u.expediente_id = e.expediente_id
       LEFT JOIN sigd_doc.expediente_tupa_vinculo v ON v.expediente_id = e.expediente_id AND v.reemplaza_vinculo_id IS NULL
       LEFT JOIN sigd_doc.tupa_procedimiento tp ON tp.registro_version_id = v.registro_version_id
       LEFT JOIN sigd_org.perfil_operativo po ON po.perfil_id = tp.perfil_responsable_id
       WHERE e.expediente_id = $1::uuid
       ORDER BY v.vinculado_en DESC NULLS LAST
       LIMIT 1`,
      [expedienteId],
    );

    if (resExp.rows.length === 0 || !resExp.rows[0].area_actual_id) {
      return [];
    }

    const { area_actual_id: areaId, perfil_requerido_codigo: perfilRequeridoCodigo } = resExp.rows[0];

    const { rows } = await db.query<{
      id_usuario: string;
      id_persona: string;
      usuario: string;
      nombre_completo: string;
      rol_codigo: string;
      perfil_codigo: string | null;
      alcance: any;
    }>(
      `SELECT DISTINCT
         cu.id_usuario,
         cu.id_persona,
         cu.usuario,
         pn.nombre_completo,
         rs.codigo AS rol_codigo,
         po.codigo AS perfil_codigo,
         apo.alcance
       FROM sigd_auth.cuenta_usuario cu
       JOIN sigd_auth.persona p ON p.id_persona = cu.id_persona
       JOIN sigd_auth.persona_natural pn ON pn.id_persona = p.id_persona
       JOIN sigd_auth.vinculo_institucional vi ON vi.id_persona = p.id_persona AND vi.estado = 'ACTIVO'
       LEFT JOIN sigd_org.usuario_rol ur ON ur.id_usuario = cu.id_usuario AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
       LEFT JOIN sigd_org.rol_sistema rs ON rs.rol_id = ur.rol_id
       LEFT JOIN sigd_org.asignacion_perfil_operativo apo ON apo.id_usuario = cu.id_usuario AND apo.estado = 'ACTIVO'
       LEFT JOIN sigd_org.perfil_operativo po ON po.perfil_id = apo.perfil_id
       WHERE cu.activo = true
         AND (
           ur.area_id = $1::uuid
           OR apo.area_id = $1::uuid
           OR ur.area_id IN (SELECT area_id FROM sigd_org.area WHERE area_padre_id = $1::uuid)
           OR ur.area_id IN (SELECT area_padre_id FROM sigd_org.area WHERE area_id = $1::uuid AND area_padre_id IS NOT NULL)
           OR apo.area_id IN (SELECT area_id FROM sigd_org.area WHERE area_padre_id = $1::uuid)
           OR apo.area_id IN (SELECT area_padre_id FROM sigd_org.area WHERE area_id = $1::uuid AND area_padre_id IS NOT NULL)
           OR EXISTS (
             SELECT 1 FROM sigd_org.asignacion_personal ap
              WHERE ap.id_persona = cu.id_persona
                AND (
                  ap.area_id = $1::uuid
                  OR ap.area_id IN (SELECT area_id FROM sigd_org.area WHERE area_padre_id = $1::uuid)
                  OR ap.area_id IN (SELECT area_padre_id FROM sigd_org.area WHERE area_id = $1::uuid AND area_padre_id IS NOT NULL)
                )
                AND ap.estado = 'ACTIVO'
                AND ap.vigente_desde <= now()
                AND (ap.vigente_hasta IS NULL OR ap.vigente_hasta > now())
           )
         )
         AND rs.codigo IN ('ESPECIALISTA', 'SECRETARIO')
       ORDER BY cu.usuario ASC`,
      [areaId],
    );

    return rows.map((r) => {
      const coincidePerfil = Boolean(perfilRequeridoCodigo && r.perfil_codigo === perfilRequeridoCodigo);
      return {
        idUsuario: r.id_usuario,
        idPersona: r.id_persona,
        usuario: r.usuario,
        nombreCompleto: r.nombre_completo,
        rolCodigo: r.rol_codigo,
        perfilCodigo: r.perfil_codigo,
        alcance: r.alcance,
        esPrioritario: coincidePerfil,
      };
    }).sort((a, b) => {
      if (a.esPrioritario && !b.esPrioritario) return -1;
      if (!a.esPrioritario && b.esPrioritario) return 1;
      if (a.rolCodigo === 'ESPECIALISTA' && b.rolCodigo !== 'ESPECIALISTA') return -1;
      if (a.rolCodigo !== 'ESPECIALISTA' && b.rolCodigo === 'ESPECIALISTA') return 1;
      return a.nombreCompleto.localeCompare(b.nombreCompleto);
    });
  }
}
