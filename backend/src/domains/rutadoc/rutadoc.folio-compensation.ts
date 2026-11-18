import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { insertarEvento } from '../../audit/evento-outbox.repository.js';
import type { CompensacionFolios, FolioCompensationPort, MovimientoObjetivo,
  SolicitudCompensacionFolios } from './rutadoc.reversion.types.js';

export function prepararCompensacionPendiente(objetivo: MovimientoObjetivo): CompensacionFolios {
  return { estado: 'PENDIENTE', movimientoRelacionadoId: objetivo.idMovimiento,
    rangoAfectado: null, referencia: randomUUID() };
}

/** Persiste la solicitud local y, si CoreLink está instalado, encola el evento canónico.
 * No marca la compensación como procesada ni toca tablas DocuCore.
 */
export class FolioCompensationPostgres implements FolioCompensationPort {
  async solicitar(cliente: PoolClient, solicitud: SolicitudCompensacionFolios): Promise<void> {
    const { expedienteId, movimientoOriginal, movimientoCompensatorioId, rangoAfectado,
      motivo, actor, correlationId, claveIdempotencia, referencia } = solicitud;
    await cliente.query(`INSERT INTO sigd_rut.solicitud_compensacion_folios
      (id_solicitud, expediente_id, movimiento_original_id, movimiento_compensatorio_id,
       rango_afectado, motivo, actor_id, correlation_id, clave_idempotencia, estado)
      VALUES ($1::uuid, $2::bigint, $3::uuid, $4::uuid, $5::jsonb, $6,
              $7::bigint, $8, $9::uuid, 'PENDIENTE')`,
    [referencia, expedienteId, movimientoOriginal.idMovimiento, movimientoCompensatorioId,
      rangoAfectado ? JSON.stringify(rangoAfectado) : null, motivo, actor.id,
      correlationId, claveIdempotencia]);

    const outbox = await cliente.query<{ existe: string | null }>(
      "SELECT to_regclass('sigd_audit.evento_outbox')::text AS existe");
    if (outbox.rows[0].existe) {
      const idEvento = await insertarEvento(cliente, {
        agregado: 'RutaDoc', tipo_evento: 'CompensacionFoliosSolicitada',
        payload: { idSolicitud: referencia, expedienteId,
          movimientoOriginalId: movimientoOriginal.idMovimiento,
          movimientoCompensatorioId, rangoAfectado, motivo,
          actorId: actor.id, correlationId, claveIdempotencia },
      });
      await cliente.query(`UPDATE sigd_rut.solicitud_compensacion_folios
        SET id_evento_outbox = $2::uuid WHERE id_solicitud = $1::uuid`,
      [referencia, idEvento]);
    }
  }

  /** Puerto de confirmación para el futuro consumidor; no lo llama la API de reversión. */
  async registrarEstado(cliente: PoolClient, referencia: string,
    estado: Exclude<CompensacionFolios['estado'], 'PENDIENTE'>): Promise<void> {
    const resultado = await cliente.query(`UPDATE sigd_rut.solicitud_compensacion_folios
      SET estado = $2, actualizado_en = CURRENT_TIMESTAMP(3)
      WHERE id_solicitud = $1::uuid AND (
        (estado = 'PENDIENTE' AND $2 = 'PROCESANDO') OR
        (estado = 'PROCESANDO' AND $2 IN ('COMPLETADO', 'FALLIDO')) OR
        (estado = 'FALLIDO' AND $2 = 'PROCESANDO'))`, [referencia, estado]);
    if (resultado.rowCount !== 1) throw new Error('Transición de compensación de folios inválida.');
  }
}
