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
    SELECT actual.estado_nuevo,
           COALESCE(actual.area_actual_id, expediente.area_destino_id) AS area_actual_id
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

function exigirAreaActual(
  expediente: EstadoExpediente,
  contexto = getRequestContext(),
): void {
  const areaActor = contexto?.unidad_organica_id;
  if (!areaActor || areaActor !== expediente.areaActualId) {
    throw new ForbiddenError({ detail: 'El usuario no pertenece al área donde se encuentra el expediente.' });
  }
}

function obtenerActorId(contexto = getRequestContext()): string {
  const actorId = contexto?.usuario_id;
  if (typeof actorId !== 'string' || !esIdMovimiento(actorId)) {
    throw new UnauthorizedError({ detail: 'El operador no tiene un identificador UUID válido.' });
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
    VALUES ($1::uuid, $2, $3, $4, $5::uuid, $6::jsonb)
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
  const contexto = getRequestContext();
  const actorId = obtenerActorId(contexto);
  const expediente = await obtenerEstado(cliente, expedienteId);
  exigirAreaActual(expediente, contexto);
  const areaIds = [...new Set(datos.destinos.map((destino) => destino.area_destino_id))];
  const areas = await cliente.query<{ area_id: string }>(`
    SELECT area_id::text
      FROM sigd_org.area
     WHERE area_id = ANY($1::uuid[]) AND vigente
  `, [areaIds]);
  if (areas.rowCount !== areaIds.length) {
    throw new NotFoundError({ detail: 'Una o más áreas de destino no existen o no están vigentes.' });
  }

  for (const destino of datos.destinos) {
    const movimiento = await registrarMovimiento({
      cliente,
      expedienteId,
      estado: expediente.estado,
      evento: 'DERIVACION',
      actorId,
      datos: {
        areaId: destino.area_destino_id,
        areaOrigenId: expediente.areaActualId,
        proveido: datos.proveido,
        esCopia: destino.es_copia,
        usuarioAsignadoId: destino.usuario_asignado_id ?? null,
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
          area_destino_id: destino.area_destino_id,
        },
        datos_especificos: {
          motivo: datos.proveido,
          es_copia: destino.es_copia,
          usuario_asignado_id: destino.usuario_asignado_id,
        },
      },
    });
  }
}

export async function recepcionarExpediente(
  cliente: PoolClient,
  expedienteId: string,
): Promise<{ estado: EstadoRutaDoc }> {
  const contexto = getRequestContext();
  const actorId = obtenerActorId(contexto);
  const expediente = await obtenerEstado(cliente, expedienteId);
  exigirAreaActual(expediente, contexto);
  const movimiento = await registrarMovimiento({
    cliente,
    expedienteId,
    estado: expediente.estado,
    evento: 'RECEPCION',
    actorId,
    datos: { areaId: expediente.areaActualId },
  });
  await insertarEvento(cliente, {
    agregado: 'Expediente',
    tipo_evento: 'ExpedienteRecepcionado',
    payload: {
      identidad: { expediente_id: expedienteId, movimiento_id: movimiento.idMovimiento },
      contexto: { usuario_actor_id: actorId, area_contexto_id: expediente.areaActualId },
    },
  });
  return { estado: movimiento.estadoNuevo };
}

export async function atenderExpediente(
  cliente: PoolClient,
  expedienteId: string,
  datos: AtenderExpedienteDTO,
): Promise<{ estado: EstadoRutaDoc; notificadoCasilla: boolean }> {
  const contexto = getRequestContext();
  const actorId = obtenerActorId(contexto);
  const expediente = await obtenerEstado(cliente, expedienteId);
  exigirAreaActual(expediente, contexto);

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

  const destinatario = await cliente.query<{
    usuario_id: string | null;
    correo: string | null;
    cut: string;
    asunto: string;
  }>(`
    SELECT cuenta.id_usuario::text AS usuario_id, cuenta.correo,
           expediente.codigo_expediente AS cut, tramite.asunto
      FROM sigd_tra.expediente expediente
      JOIN sigd_tra.tramite tramite ON tramite.expediente_id = expediente.expediente_id
      LEFT JOIN sigd_auth.cuenta_usuario cuenta
        ON cuenta.id_persona = expediente.solicitante_id AND cuenta.activo = TRUE
     WHERE expediente.expediente_id = $1::uuid
     LIMIT 1`, [expedienteId]);
  const cuenta = destinatario.rows[0];
  if (cuenta?.usuario_id) {
    await insertarEvento(cliente, {
      agregado: 'Expediente',
      tipo_evento: 'casilla_notificacion',
      payload: {
        usuario_id: cuenta.usuario_id,
        correo_destinatario: cuenta.correo,
        cut: cuenta.cut,
        asunto: `Respuesta a ${cuenta.cut}`,
        tipo_acto: 'Respuesta de trámite',
        referencia: movimiento.idMovimiento,
        expediente_id: expedienteId,
        cuerpo: {
          asunto: cuenta.asunto,
          resultado: datos.resultado_resumen,
          cut: cuenta.cut,
        },
      },
    });
  }
  return { estado: movimiento.estadoNuevo, notificadoCasilla: Boolean(cuenta?.usuario_id) };
}

export async function archivarExpediente(
  cliente: PoolClient,
  expedienteId: string,
  datos: ArchivarExpedienteDTO,
): Promise<void> {
  const contexto = getRequestContext();
  const actorId = obtenerActorId(contexto);
  const expediente = await obtenerEstado(cliente, expedienteId);
  exigirAreaActual(expediente, contexto);
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
  const contexto = getRequestContext();
  const actorId = obtenerActorId(contexto);
  const expediente = await obtenerEstado(cliente, expedienteId);
  exigirAreaActual(expediente, contexto);
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
  const contexto = getRequestContext();
  const actorId = obtenerActorId(contexto);
  const expediente = await obtenerEstado(cliente, expedienteId);
  exigirAreaActual(expediente, contexto);
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
