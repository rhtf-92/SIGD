import type { PoolClient } from 'pg';
import { getRequestContext } from '../../shared/request-context/request-context.js';
import { insertarEvento } from '../../audit/evento-outbox.repository.js';
import { ForbiddenError, NotFoundError, UnauthorizedError } from '../../shared/domain/errors/index.js';
import { obtenerSiguienteEstado, type EventoRutaDoc, type EstadoRutaDoc } from './rutadoc.fsm.js';
import { bloquearExpedienteRutaDoc } from './rutadoc.lock.js';
import { esIdMovimiento } from './rutadoc.cursor.js';
import type { DerivarExpedienteDTO } from './dto/derivarExpediente.dto.js';
import type { ArchivarExpedienteDTO } from './dto/archivarExpediente.dto.js';
import type { AtenderExpedienteDTO } from './dto/atenderExpediente.dto.js';

interface EstadoExpediente {
  estado: EstadoRutaDoc;
  areaActualId: string | null;
}

interface RegistroMovimiento {
  cliente: PoolClient;
  expedienteId: string;
  estado: EstadoRutaDoc;
  evento: EventoRutaDoc;
  actorId: string;
  datos: Record<string, unknown>;
}

async function obtenerEstado(
  cliente: PoolClient,
  expedienteId: string,
): Promise<EstadoExpediente> {
  await bloquearExpedienteRutaDoc(cliente, expedienteId);
  const resultado = await cliente.query<{
    estado_nuevo: EstadoRutaDoc | null;
    area_actual_id: string | null;
  }>(`
    SELECT actual.estado_nuevo, actual.area_actual_id
      FROM sigd_tra.expediente expediente
      LEFT JOIN sigd_rut.estado_actual_expediente actual
        ON actual.expediente_id = expediente.expediente_id
     WHERE expediente.expediente_id = $1::uuid
     FOR UPDATE OF expediente
  `, [expedienteId]);
  const fila = resultado.rows[0];
  if (!fila) throw new NotFoundError({ detail: 'El expediente no existe.' });
  return {
    estado: fila.estado_nuevo ?? 'REGISTRADO',
    areaActualId: fila.area_actual_id,
  };
}

function obtenerActorId(): string {
  const actorId = getRequestContext()?.usuario_id;
  if (typeof actorId !== 'string' || !esIdMovimiento(actorId)) {
    throw new UnauthorizedError({ detail: 'El operador no tiene un identificador BIGINT válido.' });
  }
  return actorId;
}

async function registrarMovimiento(entrada: RegistroMovimiento): Promise<{
  idMovimiento: string;
  estadoNuevo: EstadoRutaDoc;
}> {
  const estadoNuevo = obtenerSiguienteEstado(entrada.estado, entrada.evento);
  const resultado = await entrada.cliente.query<{ id_movimiento: string }>(`
    INSERT INTO sigd_rut.movimiento_tramite
      (expediente_id, estado_anterior, evento, estado_nuevo,
       usuario_operador_id, datos)
    VALUES ($1::uuid, $2, $3, $4, $5::bigint, $6::jsonb)
    RETURNING id_movimiento::text
  `, [
    entrada.expedienteId,
    entrada.estado,
    entrada.evento,
    estadoNuevo,
    entrada.actorId,
    JSON.stringify(entrada.datos),
  ]);
  return { idMovimiento: resultado.rows[0].id_movimiento, estadoNuevo };
}

export async function derivarExpediente(
  cliente: PoolClient,
  expedienteId: string,
  datos: DerivarExpedienteDTO,
): Promise<void> {
  const actorId = obtenerActorId();
  const expediente = await obtenerEstado(cliente, expedienteId);
  const areaIds = [...new Set(datos.destinos.map((destino) => destino.area_destino_id))];
  const areas = await cliente.query<{ area_id: string }>(`
    SELECT area_id::text
      FROM sigd_org.area
     WHERE area_id = ANY($1::uuid[]) AND vigente
  `, [areaIds]);
  if (areas.rowCount !== areaIds.length) {
    throw new NotFoundError({ detail: 'Una o más áreas de destino no existen o no están vigentes.' });
  }

  const destinoPrincipal = datos.destinos[0].area_destino_id;
  const movimiento = await registrarMovimiento({
    cliente,
    expedienteId,
    estado: expediente.estado,
    evento: 'DERIVACION',
    actorId,
    datos: {
      areaId: destinoPrincipal,
      proveido: datos.proveido,
      destinos: datos.destinos,
    },
  });
  await insertarEvento(cliente, {
    agregado: 'Expediente',
    tipo_evento: 'ExpedienteDerivado',
    payload: {
      identidad: { expediente_id: expedienteId, movimiento_id: movimiento.idMovimiento },
      contexto: {
        usuario_actor_id: actorId,
        area_origen_id: expediente.areaActualId,
        area_destino_id: destinoPrincipal,
      },
      datos_especificos: { motivo: datos.proveido, destinos: datos.destinos },
    },
  });
}

export async function atenderExpediente(
  cliente: PoolClient,
  expedienteId: string,
  datos: AtenderExpedienteDTO,
): Promise<void> {
  const contexto = getRequestContext();
  const actorId = obtenerActorId();
  const expediente = await obtenerEstado(cliente, expedienteId);
  if (contexto?.unidad_organica_id !== expediente.areaActualId) {
    throw new ForbiddenError({ detail: 'El usuario no pertenece al área donde se encuentra el expediente.' });
  }

  const movimiento = await registrarMovimiento({
    cliente,
    expedienteId,
    estado: expediente.estado,
    evento: 'FIRMA',
    actorId,
    datos: { areaId: expediente.areaActualId, resultadoResumen: datos.resultado_resumen },
  });
  await insertarEvento(cliente, {
    agregado: 'Expediente',
    tipo_evento: 'ExpedienteAtendido',
    payload: {
      identidad: { expediente_id: expedienteId, movimiento_id: movimiento.idMovimiento },
      contexto: { usuario_actor_id: actorId, area_contexto_id: expediente.areaActualId },
      datos_especificos: { resultado_resumen: datos.resultado_resumen },
    },
  });
}

export async function archivarExpediente(
  cliente: PoolClient,
  expedienteId: string,
  datos: ArchivarExpedienteDTO,
): Promise<void> {
  const actorId = obtenerActorId();
  const expediente = await obtenerEstado(cliente, expedienteId);
  const movimiento = await registrarMovimiento({
    cliente,
    expedienteId,
    estado: expediente.estado,
    evento: 'CIERRE',
    actorId,
    datos: {
      areaId: expediente.areaActualId,
      estante: datos.estante,
      balda: datos.balda,
      caja: datos.caja,
      observaciones: datos.observaciones ?? null,
    },
  });
  await insertarEvento(cliente, {
    agregado: 'Expediente',
    tipo_evento: 'ExpedienteArchivado',
    payload: {
      identidad: { expediente_id: expedienteId, movimiento_id: movimiento.idMovimiento },
      contexto: { usuario_actor_id: actorId, area_contexto_id: expediente.areaActualId },
      datos_especificos: {
        estante: datos.estante,
        balda: datos.balda,
        caja: datos.caja,
        observaciones: datos.observaciones,
      },
    },
  });
}

export async function observarExpediente(
  cliente: PoolClient,
  expedienteId: string,
  motivo: string,
): Promise<void> {
  const actorId = obtenerActorId();
  const expediente = await obtenerEstado(cliente, expedienteId);
  const movimiento = await registrarMovimiento({
    cliente,
    expedienteId,
    estado: expediente.estado,
    evento: 'OBSERVACION',
    actorId,
    datos: { areaId: expediente.areaActualId, motivo },
  });
  await insertarEvento(cliente, {
    agregado: 'Expediente',
    tipo_evento: 'ExpedienteObservado',
    payload: { expediente_id: expedienteId, movimiento_id: movimiento.idMovimiento, motivo },
  });
}

export async function subsanarExpediente(
  cliente: PoolClient,
  expedienteId: string,
  motivo: string,
): Promise<void> {
  const actorId = obtenerActorId();
  const expediente = await obtenerEstado(cliente, expedienteId);
  const movimiento = await registrarMovimiento({
    cliente,
    expedienteId,
    estado: expediente.estado,
    evento: 'CORRECCION',
    actorId,
    datos: { areaId: expediente.areaActualId, motivo },
  });
  await insertarEvento(cliente, {
    agregado: 'Expediente',
    tipo_evento: 'ExpedienteSubsanado',
    payload: { expediente_id: expedienteId, movimiento_id: movimiento.idMovimiento, motivo },
  });
}
