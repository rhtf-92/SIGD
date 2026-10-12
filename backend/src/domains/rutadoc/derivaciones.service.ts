import type { PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import { getRequestContext } from '../../shared/request-context/request-context.js';
import { insertarEvento } from '../../audit/evento-outbox.repository.js';
import { UnauthorizedError, NotFoundError, ValidationError, ForbiddenError } from '../../shared/domain/errors/index.js';
import { bloquearExpedienteRutaDoc } from './rutadoc.lock.js';
import { obtenerSiguienteEstado, type EventoRutaDoc } from './rutadoc.fsm.js';
import { esIdExpediente } from './rutadoc.cursor.js';
import type { DerivarExpedienteDTO } from './dto/derivarExpediente.dto.js';
import type { ArchivarExpedienteDTO } from './dto/archivarExpediente.dto.js';
import type { AtenderExpedienteDTO } from './dto/atenderExpediente.dto.js';

/** Historial y proyección del contrato 06; la base asigna la secuencia.
 * El controlador entrega la conexión de su transacción. */
export async function registrarActuacion(cliente: PoolClient, expedienteId: string,
  evento: EventoRutaDoc, datos: Record<string, unknown>, tipoEvento: string,
  exigirArea = false): Promise<void> {
  const contexto = getRequestContext();
  if (!contexto?.usuario_id || !esIdExpediente(contexto.usuario_id)) throw new UnauthorizedError();
  if (!esIdExpediente(expedienteId)) throw new ValidationError({
    invalidParams: [{ name: 'id', reason: 'El expediente debe ser un UUID.' }],
  });
  await bloquearExpedienteRutaDoc(cliente, expedienteId);
  const actual = await cliente.query<{ estado: string; area_id: string | null }>(`
    SELECT COALESCE(p.estado_nuevo, 'REGISTRADO') AS estado,
           COALESCE(p.area_actual_id, e.area_destino_id::text) AS area_id
      FROM sigd_tra.expediente e
      LEFT JOIN sigd_rut.estado_actual_expediente p ON p.expediente_id = e.expediente_id
     WHERE e.expediente_id = $1::uuid`, [expedienteId]);
  if (!actual.rows[0]) throw new NotFoundError({ detail: 'El expediente no existe.' });
  const { estado, area_id } = actual.rows[0];
  if (exigirArea && (!area_id || contexto.unidad_organica_id !== area_id)) {
    throw new ForbiddenError({ detail: 'El usuario no pertenece al área del expediente.' });
  }
  const siguiente = obtenerSiguienteEstado(estado, evento);
  const movimiento = await cliente.query<{ id_movimiento: string }>(`
    INSERT INTO sigd_rut.movimiento_tramite
      (expediente_id, estado_anterior, evento, estado_nuevo,
       usuario_operador_id, correlation_id, clave_idempotencia, datos)
    VALUES ($1::uuid, $2, $3, $4, $5::uuid, $6::uuid, $7, $8::jsonb)
    RETURNING id_movimiento`, [expedienteId, estado, evento, siguiente,
    contexto.usuario_id, contexto.correlation_id, randomUUID(),
    JSON.stringify({ areaId: area_id, ...datos })]);
  await insertarEvento(cliente, { agregado: 'Expediente', tipo_evento: tipoEvento,
    payload: { identidad: { expediente_id: expedienteId, movimiento_id: movimiento.rows[0].id_movimiento },
      contexto: { usuario_actor_id: contexto.usuario_id, area_origen_id: area_id },
      datos_especificos: datos } });
}

export async function derivarExpediente(cliente: PoolClient, expedienteId: string,
  datos: DerivarExpedienteDTO): Promise<void> {
  const principales = datos.destinos.filter(d => !d.es_copia);
  if (principales.length !== 1) throw new ValidationError({
    invalidParams: [{ name: 'destinos', reason: 'Debe existir exactamente un destino principal; los demás son copias.' }],
  });
  for (const destino of datos.destinos) {
    const area = await cliente.query('SELECT 1 FROM sigd_org.area WHERE area_id = $1::uuid', [destino.area_destino_id]);
    if (!area.rowCount) throw new NotFoundError({ detail: 'El área de destino no existe.' });
  }
  // Una actuación contiene todos los destinos; las copias no cambian la tenencia.
  await registrarActuacion(cliente, expedienteId, 'DERIVACION',
    { areaId: principales[0].area_destino_id, destinos: datos.destinos, motivo: datos.proveido }, 'ExpedienteDerivado');
}

export async function atenderExpediente(cliente: PoolClient, expedienteId: string,
  datos: AtenderExpedienteDTO): Promise<void> {
  await registrarActuacion(cliente, expedienteId, 'FIRMA', datos, 'ExpedienteAtendido', true);
}

export async function archivarExpediente(cliente: PoolClient, expedienteId: string,
  datos: ArchivarExpedienteDTO): Promise<void> {
  await registrarActuacion(cliente, expedienteId, 'CIERRE', datos, 'ExpedienteArchivado');
}
