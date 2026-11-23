import type { Pool } from 'pg';
import type { ActorRutaDoc } from './rutadoc.types.js';
import type { CalificarRequisitoDTO, ObservarRequisitoDTO } from './dto/calificacion.dto.js';
import { ServicioTrazabilidadRutaDoc } from './trazabilidad.service.js';
import { ServicioObservacionesRutaDoc } from './observaciones.service.js';
import { registrarMutacion } from '../../audit/bitacora-auditoria.repository.js';
import { insertarEvento } from '../../audit/evento-outbox.repository.js';
import { NotFoundError, ConflictError } from '../../shared/domain/errors/index.js';

export class CalificacionAdministrativaService {
  constructor(
    private pool: Pool,
    private trazabilidad: ServicioTrazabilidadRutaDoc,
    private observaciones: ServicioObservacionesRutaDoc
  ) {}

  async listarRequisitos(expedienteId: string): Promise<any[]> {
    const client = await this.pool.connect();
    try {
        const res = await client.query(`
          SELECT r.requisito_id, r.codigo, r.denominacion, r.obligatorio,
                 er.cumplido, er.verificado_en, er.documento_adjunto_id
          FROM sigd_doc.requisito r
          JOIN sigd_doc.expediente e ON e.tipo_tramite_id = r.tipo_tramite_id
          LEFT JOIN sigd_doc.expediente_requisito er ON er.expediente_id = e.expediente_id AND er.requisito_id = r.requisito_id
          WHERE e.expediente_id = $1::uuid
          ORDER BY r.orden ASC`, [expedienteId]);

        let pagoTesoreria: { verificado: boolean; estado: string; ordenCodigo: string | null; numeroRecibo: string | null; importe: string | null } | null = null;
        if (res.rows.some((r) => r.codigo === 'COMPROBANTE_PAGO')) {
          try {
            const pRes = await client.query<{
              orden_codigo: string | null;
              importe: string | null;
              pago_estado: string | null;
              numero_recibo: string | null;
              devolucion_activa: boolean;
            }>(`
              SELECT o.codigo AS orden_codigo,
                     o.importe::text,
                     p.estado AS pago_estado,
                     p.numero_recibo::text AS numero_recibo,
                     EXISTS (SELECT 1 FROM sigd_tes.devolucion d WHERE d.pago_id = p.id AND d.estado <> 'RECHAZADA') AS devolucion_activa
                FROM sigd_tes.aplicacion_pago a
                JOIN sigd_tes.orden_pago o ON o.id = a.orden_id
                LEFT JOIN sigd_tes.pago p ON p.orden_id = o.id
               WHERE a.expediente_id = $1::uuid
               ORDER BY (p.estado = 'VERIFICADO') DESC NULLS LAST, p.verificado_en DESC NULLS LAST, o.creado_en DESC
               LIMIT 1`, [expedienteId]);
            const fila = pRes.rows[0];
            pagoTesoreria = fila
              ? {
                  verificado: fila.pago_estado === 'VERIFICADO' && !fila.devolucion_activa,
                  estado: fila.pago_estado === 'VERIFICADO' && !fila.devolucion_activa ? 'VERIFICADO' : 'PENDIENTE_PAGO',
                  ordenCodigo: fila.orden_codigo,
                  numeroRecibo: fila.numero_recibo,
                  importe: fila.importe,
                }
              : { verificado: false, estado: 'SIN_ORDEN', ordenCodigo: null, numeroRecibo: null, importe: null };
          } catch {
            pagoTesoreria = null;
          }
        }

        return res.rows.map((row) =>
          row.codigo === 'COMPROBANTE_PAGO' && pagoTesoreria
            ? { ...row, pagoTesoreria }
            : row,
        );
    } finally { client.release(); }
  }

  async calificarRequisito(expedienteId: string, requisitoId: string, datos: CalificarRequisitoDTO, actor: ActorRutaDoc): Promise<void> {
    const client = await this.pool.connect();
    try {
        await client.query('BEGIN');

        if (datos.cumplido === true) {
          const reqInfo = await client.query<{ codigo: string; tipo_tramite_id: string }>(
            `SELECT r.codigo, r.tipo_tramite_id::text
               FROM sigd_doc.requisito r
              WHERE r.requisito_id = $1::uuid`,
            [requisitoId],
          );
          if (reqInfo.rows[0]?.codigo === 'COMPROBANTE_PAGO') {
            const tieneTarifa = await client.query<{ existe: boolean }>(
              `SELECT EXISTS (
                 SELECT 1 FROM sigd_tes.tarifa f
                  WHERE f.tipo_tramite_id = $1::uuid
                    AND f.estado = 'VALIDADA'
                    AND f.importe > 0
                    AND f.vigente_desde <= (now() AT TIME ZONE 'America/Lima')::date
                    AND (f.vigente_hasta IS NULL OR f.vigente_hasta >= (now() AT TIME ZONE 'America/Lima')::date)
               ) AS existe`,
              [reqInfo.rows[0].tipo_tramite_id],
            );
            if (tieneTarifa.rows[0]?.existe) {
              const pagoVerif = await client.query<{ verificado: boolean }>(
                `SELECT EXISTS (
                   SELECT 1
                     FROM sigd_tes.aplicacion_pago a
                     JOIN sigd_tes.pago p ON p.orden_id = a.orden_id
                    WHERE a.expediente_id = $1::uuid
                      AND p.estado = 'VERIFICADO'
                      AND NOT EXISTS (SELECT 1 FROM sigd_tes.devolucion d WHERE d.pago_id = p.id AND d.estado <> 'RECHAZADA')
                 ) AS verificado`,
                [expedienteId],
              );
              if (!pagoVerif.rows[0]?.verificado) {
                const { ConflictError } = await import('../../shared/domain/errors/index.js');
                throw new ConflictError({
                  code: 'PAGO_TESORERIA_NO_VERIFICADO',
                  message: 'No se puede aprobar el requisito de pago mientras Tesorería no haya verificado el abono correspondiente.',
                });
              }
            }
          }
        }
        
        const oldRes = await client.query(
            `SELECT cumplido FROM sigd_doc.expediente_requisito WHERE expediente_id = $1::uuid AND requisito_id = $2::uuid`,
            [expedienteId, requisitoId]
        );
        const valorAnterior = oldRes.rows[0]?.cumplido ?? null;

        await client.query(`
          INSERT INTO sigd_doc.expediente_requisito (expediente_id, requisito_id, cumplido, documento_adjunto_id, verificado_en)
          VALUES ($1::uuid, $2::uuid, $3, $4::uuid, now())
          ON CONFLICT (expediente_id, requisito_id) DO UPDATE SET
            cumplido = EXCLUDED.cumplido,
            documento_adjunto_id = EXCLUDED.documento_adjunto_id,
            verificado_en = now()`,
          [expedienteId, requisitoId, datos.cumplido, datos.documentoAdjuntoId || null]
        );

        await registrarMutacion(client, {
            esquema: 'sigd_doc',
            tabla: 'expediente_requisito',
            operacion: valorAnterior === null ? 'INSERT' : 'UPDATE',
            datos_antes: valorAnterior === null ? null : { expedienteId, requisitoId, cumplido: valorAnterior },
            datos_despues: {
                expedienteId,
                requisitoId,
                valorAnterior,
                valorNuevo: datos.cumplido,
                documentoAdjuntoId: datos.documentoAdjuntoId || null,
                accion: 'ACTUALIZAR_CHECKLIST',
                motivo: 'Verificación administrativa',
            },
            usuario_id: actor.id,
        });

        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
  }

  async registrarObservacionAdministrativa(expedienteId: string, datos: ObservarRequisitoDTO, actor: ActorRutaDoc): Promise<any> {
    const client = await this.pool.connect();
    try {
        await client.query('BEGIN');
        const res = await this.observaciones.crearObservacion(client, expedienteId, actor, {
            motivo: datos.motivo,
            plazoDias: datos.plazoDias,
            tipoObservacion: 'ADMINISTRATIVA',
            requisitos: [
                {
                    requisitoId: datos.requisitoId,
                    descripcionIncumplimiento: datos.motivo,
                },
            ],
        });
        await client.query('COMMIT');
        return res;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
  }

  async declararConformidad(expedienteId: string, actor: ActorRutaDoc): Promise<{ ok: boolean; mensaje: string; nuevoEstado: string }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const reqs = await client.query<{
        codigo: string;
        denominacion: string;
        obligatorio: boolean;
        cumplido: boolean | null;
      }>(`
        SELECT r.codigo, r.denominacion, r.obligatorio, er.cumplido
        FROM sigd_doc.requisito r
        JOIN sigd_doc.expediente e ON e.tipo_tramite_id = r.tipo_tramite_id
        LEFT JOIN sigd_doc.expediente_requisito er ON er.expediente_id = e.expediente_id AND er.requisito_id = r.requisito_id
        WHERE e.expediente_id = $1::uuid
      `, [expedienteId]);

      if (reqs.rowCount === 0) {
        throw new NotFoundError({ detail: `El expediente '${expedienteId}' no tiene catálogo de requisitos asociado.` });
      }

      const noCumplidos = reqs.rows.filter((r) => r.obligatorio && r.cumplido !== true);
      if (noCumplidos.length > 0) {
        throw new ConflictError({
          code: 'REQUISITOS_INCOMPLETOS',
          message: `No se puede declarar conformidad documental. Requisitos obligatorios no cumplidos: ${noCumplidos.map((r) => r.denominacion).join(', ')}.`,
        });
      }

      const resExp = await client.query<{
        codigo_expediente: string;
        estado_actual: string;
        area_actual_id: string | null;
      }>(`
        SELECT
          e.codigo_expediente,
          COALESCE(ultimo.estado_nuevo, e.estado, 'REGISTRADO') AS estado_actual,
          ultimo.area_actual_id
        FROM sigd_tra.expediente e
        LEFT JOIN sigd_rut.estado_actual_expediente ultimo ON ultimo.expediente_id = e.expediente_id
        WHERE e.expediente_id = $1::uuid
        FOR UPDATE OF e
      `, [expedienteId]);

      const estadoActual = resExp.rows[0]?.estado_actual || 'REGISTRADO';
      const cut = resExp.rows[0]?.codigo_expediente;
      const areaActual = resExp.rows[0]?.area_actual_id;

      let nuevoEstado = estadoActual;
      if (estadoActual === 'RECEPCIONADO') {
        nuevoEstado = 'EN_CALIFICACION';
        await client.query(`
          INSERT INTO sigd_rut.movimiento_tramite (
            expediente_id, estado_anterior, evento, estado_nuevo,
            usuario_operador_id, correlation_id, clave_idempotencia, datos
          ) VALUES (
            $1::uuid, 'RECEPCIONADO', 'INICIAR_CALIFICACION', 'EN_CALIFICACION',
            $2, gen_random_uuid(), $3, $4::jsonb
          )
        `, [
          expedienteId,
          actor.id,
          `CONF-${expedienteId}-${Date.now()}`,
          JSON.stringify({
            calificacion: 'CONFORME',
            actor: actor.id,
            areaId: areaActual,
            fechaHora: new Date().toISOString(),
            detalle: 'Calificación documental aprobada. Requisitos TUPA conformes.',
          }),
        ]);

        await insertarEvento(client, {
          agregado: 'Expediente',
          tipo_evento: 'conformidad_documental',
          payload: {
            expediente_id: expedienteId,
            cut,
            asunto: `Conformidad de requisitos TUPA otorgada — CUT: ${cut}`,
          },
        });
      } else {
        await registrarMutacion(client, {
          esquema: 'sigd_doc',
          tabla: 'expediente_requisito',
          operacion: 'UPDATE',
          datos_antes: null,
          datos_despues: {
            expedienteId,
            accion: 'CONFORMIDAD_DOCUMENTAL',
            actor: actor.id,
            fechaHora: new Date().toISOString(),
          },
          usuario_id: actor.id,
        });
      }

      await client.query('COMMIT');
      return {
        ok: true,
        mensaje: 'Conformidad documental declarada exitosamente. El expediente está habilitado para derivación.',
        nuevoEstado,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
