import type { PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import { getRequestContext } from '../../shared/request-context/request-context.js';
import { insertarEvento } from '../../audit/evento-outbox.repository.js';
import { UnauthorizedError, NotFoundError, DomainError, ForbiddenError } from '../../shared/domain/errors/index.js';
import type { DerivarExpedienteDTO } from './dto/derivarExpediente.dto.js';
import type { ArchivarExpedienteDTO } from './dto/archivarExpediente.dto.js';
import type { AtenderExpedienteDTO } from './dto/atenderExpediente.dto.js';

/** Identidad de sistema sembrada en 02_sigd_auth.sql (sigd_auth.cuenta_usuario). */
const ID_USUARIO_SISTEMA = '00000000-0000-0000-0000-000000000001';

interface FilaEstadoActual {
  existe: boolean;
  estado_nuevo: string | null;
  area_actual_id: string | null;
}

async function obtenerEstadoActual(cliente: PoolClient, expedienteId: string): Promise<{ estado: string; areaActualId: string | null }> {
  const res = await cliente.query<FilaEstadoActual>(
    `SELECT EXISTS(SELECT 1 FROM sigd_tra.expediente WHERE expediente_id = $1::uuid) AS existe,
            p.estado_nuevo, p.area_actual_id
       FROM (SELECT 1) base
       LEFT JOIN sigd_rut.estado_actual_expediente p ON p.expediente_id = $1::uuid`,
    [expedienteId],
  );
  const fila = res.rows[0];
  if (!fila?.existe) {
    throw new NotFoundError({ detail: 'El expediente no existe.' });
  }
  return { estado: fila.estado_nuevo ?? 'REGISTRADO', areaActualId: fila.area_actual_id };
}

/** La arista permite la acción sólo si (estadoAnterior, evento, estadoNuevo) está en la FSM. */
async function estadoResultante(cliente: PoolClient, estadoAnterior: string, evento: string): Promise<string> {
  const res = await cliente.query<{ estado_nuevo: string }>(
    `SELECT estado_nuevo FROM sigd_rut.transicion_estado_tramite
      WHERE estado_anterior = $1 AND evento = $2`,
    [estadoAnterior, evento],
  );
  if (res.rowCount === 0) {
    throw new DomainError({
      code: 'ESTADO_INVALIDO',
      message: 'El estado actual del expediente no permite realizar esta acción.',
    });
  }
  return res.rows[0].estado_nuevo;
}

interface InsertarMovimientoEntrada {
  expedienteId: string;
  estadoAnterior: string;
  evento: string;
  estadoNuevo: string;
  areaId: string | null;
  datos: Record<string, unknown>;
}

/** secuencia y fecha_hora las asigna la base (trigger registrar_movimiento_identidad). */
async function insertarMovimiento(cliente: PoolClient, entrada: InsertarMovimientoEntrada): Promise<string> {
  const contexto = getRequestContext();
  const datos = { areaId: entrada.areaId, ...entrada.datos };
  const res = await cliente.query<{ id_movimiento: string }>(
    `INSERT INTO sigd_rut.movimiento_tramite
       (expediente_id, estado_anterior, evento, estado_nuevo,
        usuario_operador_id, correlation_id, clave_idempotencia, datos)
     VALUES ($1::uuid, $2, $3, $4, $5::uuid, $6, $7, $8::jsonb)
     RETURNING id_movimiento::text`,
    [entrada.expedienteId, entrada.estadoAnterior, entrada.evento, entrada.estadoNuevo,
      contexto?.usuario_id ?? ID_USUARIO_SISTEMA,
      contexto?.correlation_id ?? null, randomUUID(), JSON.stringify(datos)],
  );
  return res.rows[0].id_movimiento;
}

/**
 * Servicio exclusivo de la tarea T-BE-RD-06 (Derivaciones y Pases Internos).
 * La FSM canónica sólo admite DERIVACION desde EN_CALIFICACION o EN_REVISION;
 * cada destino genera un movimiento DERIVADO con datos.areaId al área receptora.
 */
export async function derivarExpediente(
  cliente: PoolClient,
  expedienteId: string,
  datos: DerivarExpedienteDTO
): Promise<void> {
  const contexto = getRequestContext();
  const usuarioActorId = contexto?.usuario_id;

  if (!usuarioActorId) {
    throw new UnauthorizedError({ detail: 'No se encontró usuario en el contexto para registrar el movimiento.' });
  }

  const { estado: estadoActual, areaActualId } = await obtenerEstadoActual(cliente, expedienteId);
  const estadoNuevo = await estadoResultante(cliente, estadoActual, 'DERIVACION');

  for (const destino of datos.destinos) {
    const movimientoId = await insertarMovimiento(cliente, {
      expedienteId,
      estadoAnterior: estadoActual,
      evento: 'DERIVACION',
      estadoNuevo,
      areaId: destino.area_destino_id,
      datos: {
        areaOrigenId: areaActualId,
        remitente: areaActualId,
        destinatario: destino.area_destino_id,
        proveido: datos.proveido,
        esCopia: destino.es_copia,
        usuarioAsignadoId: destino.usuario_asignado_id ?? null,
      },
    });

    await insertarEvento(cliente, {
      agregado: 'Expediente',
      tipo_evento: 'ExpedienteDerivado',
      payload: {
        identidad: { expediente_id: expedienteId, movimiento_id: movimientoId },
        contexto: {
          usuario_actor_id: usuarioActorId,
          area_origen_id: areaActualId,
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

/**
 * Servicio de Atención Resolutiva (T-BE-RD-07).
 * Mapea la acción a la arista canónica EN_FIRMA --FIRMA--> RESUELTO.
 */
export async function atenderExpediente(
  cliente: PoolClient,
  expedienteId: string,
  datos: AtenderExpedienteDTO
): Promise<void> {
  const contexto = getRequestContext();
  const usuarioActorId = contexto?.usuario_id;

  if (!usuarioActorId) {
    throw new UnauthorizedError({ detail: 'No se encontró usuario en el contexto.' });
  }

  const { estado: estadoActual, areaActualId } = await obtenerEstadoActual(cliente, expedienteId);

  if (contexto?.unidad_organica_id !== null && contexto?.unidad_organica_id !== undefined &&
      contexto.unidad_organica_id !== areaActualId) {
    throw new ForbiddenError({ detail: 'El usuario no pertenece al área donde se encuentra el expediente.' });
  }

  const estadoNuevo = await estadoResultante(cliente, estadoActual, 'FIRMA');
  const movimientoId = await insertarMovimiento(cliente, {
    expedienteId,
    estadoAnterior: estadoActual,
    evento: 'FIRMA',
    estadoNuevo,
    areaId: areaActualId,
    datos: { resultado: datos.resultado_resumen },
  });

  await insertarEvento(cliente, {
    agregado: 'Expediente',
    tipo_evento: 'ExpedienteAtendido',
    payload: {
      identidad: { expediente_id: expedienteId, movimiento_id: movimientoId },
      contexto: { usuario_actor_id: usuarioActorId, area_contexto_id: areaActualId },
      datos_especificos: { resultado_resumen: datos.resultado_resumen },
    },
  });
}

/**
 * Servicio de Archivado Formal (T-BE-RD-08).
 * Requiere expediente RESUELTO (arista RESUELTO --CIERRE--> ARCHIVADO).
 */
export async function archivarExpediente(
  cliente: PoolClient,
  expedienteId: string,
  datos: ArchivarExpedienteDTO
): Promise<void> {
  const contexto = getRequestContext();
  const usuarioActorId = contexto?.usuario_id;

  if (!usuarioActorId) {
    throw new UnauthorizedError({ detail: 'No se encontró usuario en el contexto.' });
  }

  const { estado: estadoActual, areaActualId } = await obtenerEstadoActual(cliente, expedienteId);
  const estadoNuevo = await estadoResultante(cliente, estadoActual, 'CIERRE');
  const movimientoId = await insertarMovimiento(cliente, {
    expedienteId,
    estadoAnterior: estadoActual,
    evento: 'CIERRE',
    estadoNuevo,
    areaId: areaActualId,
    datos: {
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
      identidad: { expediente_id: expedienteId, movimiento_id: movimientoId },
      contexto: { usuario_actor_id: usuarioActorId, area_contexto_id: areaActualId },
      datos_especificos: {
        estante: datos.estante,
        balda: datos.balda,
        caja: datos.caja,
        observaciones: datos.observaciones,
      },
    },
  });
}