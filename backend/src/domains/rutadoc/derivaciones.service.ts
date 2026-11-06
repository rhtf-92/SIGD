import type { PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import { getRequestContext } from '../../shared/request-context/request-context.js';
import { insertarEvento } from '../../audit/evento-outbox.repository.js';
import { UnauthorizedError, NotFoundError, DomainError, ForbiddenError } from '../../shared/domain/errors/index.js';
import type { DerivarExpedienteDTO } from './dto/derivarExpediente.dto.js';
import type { ArchivarExpedienteDTO } from './dto/archivarExpediente.dto.js';
import type { AtenderExpedienteDTO } from './dto/atenderExpediente.dto.js';

/**
 * Servicio exclusivo de la tarea T-BE-RD-06 (Derivaciones y Pases Internos).
 * No contiene modificacin de historial ni orquestacin compleja (WORM).
 * Utiliza nicamente SELECT e INSERT.
 */
export async function derivarExpediente(
  cliente: PoolClient,
  expedienteId: string,
  datos: DerivarExpedienteDTO
): Promise<void> {
  // 1. Validacin de contexto y tenencia de usuario
  const contexto = getRequestContext();
  const usuarioActorId = contexto?.usuario_id;

  if (!usuarioActorId) {
    throw new UnauthorizedError({ detail: 'No se encontr usuario en el contexto para registrar el movimiento.' });
  }

  // 2. Obtener estado y área actual del expediente (último movimiento)
  const resEstadoActual = await cliente.query<{ estado_actual_id: string; area_contexto_id: string }>(
    `
    SELECT
      e.estado_nuevo AS estado_actual_id,
      e.area_actual_id AS area_contexto_id
    FROM sigd_rut.estado_actual_expediente e
    WHERE e.expediente_id::text = $1::text
  `,
    [expedienteId],
  );

  if (resEstadoActual.rowCount === 0) {
    throw new NotFoundError({ detail: 'El expediente no existe o no tiene estado actual.' });
  }

  const estadoAnteriorId = resEstadoActual.rows[0].estado_actual_id;
  const areaOrigenId = resEstadoActual.rows[0].area_contexto_id;

  // 3. Obtener IDs físicos de los catálogos (No podemos hardcodear IDs numéricos)
  const resCatalogos = await cliente.query<{ id: string; tipo: string }>(`
    SELECT codigo AS id, 'accion' as tipo FROM sigd_rut.accion_tramite WHERE codigo = 'DERIVACION'
    UNION ALL
    SELECT codigo AS id, 'estado' as tipo FROM sigd_rut.estado_tramite WHERE codigo IN ('DERIVADO', 'PENDIENTE_RECEPCION')
  `);

  const accionId = resCatalogos.rows.find(r => r.tipo === 'accion')?.id;
  const estadoResultanteId = resCatalogos.rows.find(r => r.tipo === 'estado')?.id;

  if (!accionId || !estadoResultanteId) {
    throw new DomainError({ code: 'CATALOGO_NO_ENCONTRADO', message: 'Faltan datos en el catálogo de base de datos.', detail: 'Error fsico: No se encontraron los cdigos DERIVACION o PENDIENTE_RECEPCION en la base de datos.' });
  }

  // 4. Procesar cada destino (Derivacin simple o mltiple)
  for (const destino of datos.destinos) {
    
    // 4.1 INSERT en movimiento_tramite
    const resMovimiento = await cliente.query<{ movimiento_id: string }>(`
      INSERT INTO sigd_rut.movimiento_tramite (
        expediente_id,
        accion_tramite_id,
        estado_anterior_id,
        estado_resultante_id,
        usuario_actor_id,
        area_contexto_id,
        observacion,
        clave_idempotencia
      ) VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8
      ) RETURNING movimiento_id
    `, [
      expedienteId,
      accionId,
      estadoAnteriorId,
      estadoResultanteId,
      usuarioActorId,
      areaOrigenId,
      null,
      randomUUID()
    ]);

    const movimientoId = resMovimiento.rows[0].movimiento_id;

    // 4.2 INSERT en derivacion_tramite
    await cliente.query(`
      INSERT INTO sigd_rut.derivacion_tramite (
        movimiento_id,
        area_origen_id,
        area_destino_id,
        motivo,
        es_copia,
        usuario_asignado_id
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      movimientoId,
      areaOrigenId,
      destino.area_destino_id,
      datos.proveido,
      destino.es_copia,
      destino.usuario_asignado_id || null
    ]);

    // 4.3 GENERAR EVENTO OUTBOX EN LA MISMA TRANSACCIN
    await insertarEvento(cliente, {
      agregado: 'Expediente',
      tipo_evento: 'ExpedienteDerivado',
      payload: {
        identidad: { 
          expediente_id: expedienteId, 
          movimiento_id: movimientoId 
        },
        contexto: { 
          usuario_actor_id: usuarioActorId, 
          area_origen_id: areaOrigenId, 
          area_destino_id: destino.area_destino_id 
        },
        datos_especificos: {
          motivo: datos.proveido,
          es_copia: destino.es_copia,
          usuario_asignado_id: destino.usuario_asignado_id
        }
      }
    });
  }
}

/**
 * Servicio de Atencin Resolutiva (T-BE-RD-07).
 * Mapea la accin al estado 'ATENDIDO'.
 */
export async function atenderExpediente(
  cliente: PoolClient,
  expedienteId: string,
  datos: AtenderExpedienteDTO
): Promise<void> {
  const contexto = getRequestContext();
  const usuarioActorId = contexto?.usuario_id;

  if (!usuarioActorId) {
    throw new UnauthorizedError({ detail: 'No se encontr usuario en el contexto.' });
  }

  // 1. Obtener estado y área actual
  const resEstadoActual = await cliente.query<{ estado_actual_id: string; area_contexto_id: string }>(
    `
    SELECT
      e.estado_nuevo AS estado_actual_id,
      e.area_actual_id AS area_contexto_id
    FROM sigd_rut.estado_actual_expediente e
    WHERE e.expediente_id::text = $1::text
  `,
    [expedienteId],
  );

  if (resEstadoActual.rowCount === 0) {
    throw new NotFoundError({ detail: 'El expediente no existe o no tiene estado actual.' });
  }

  const estadoAnteriorId = resEstadoActual.rows[0].estado_actual_id;
  const areaActualExpediente = resEstadoActual.rows[0].area_contexto_id;

  // =========================================================================
  // VALIDACIÓN DE SEGURIDAD (T-BE-RD-07)
  // Se requiere que el usuario pertenezca al área del expediente para atenderlo.
  // Validado exitosamente a través de unidad_organica_id en el RequestContext.
  // =========================================================================

  if (contexto?.unidad_organica_id !== areaActualExpediente) {
    throw new ForbiddenError({ detail: 'El usuario no pertenece al área donde se encuentra el expediente.' });
  }

  // 2. Obtener IDs físicos de los catálogos
  const resCatalogos = await cliente.query<{ id: string; tipo: string }>(`
    SELECT codigo AS id, 'accion' as tipo FROM sigd_rut.accion_tramite WHERE codigo = 'ATENCION'
    UNION ALL
    SELECT codigo AS id, 'estado' as tipo FROM sigd_rut.estado_tramite WHERE codigo = 'ATENDIDO'
  `);

  const accionId = resCatalogos.rows.find(r => r.tipo === 'accion')?.id;
  const estadoResultanteId = resCatalogos.rows.find(r => r.tipo === 'estado')?.id;

  if (!accionId || !estadoResultanteId) {
    throw new DomainError({ code: 'CATALOGO_NO_ENCONTRADO', message: 'Faltan datos en el catálogo de base de datos.', detail: 'Error fsico: No se encontraron los cdigos ATENCION o ATENDIDO en BD.' });
  }

  // 3. INSERT en movimiento_tramite
  const resMovimiento = await cliente.query<{ movimiento_id: string }>(`
    INSERT INTO sigd_rut.movimiento_tramite (
      expediente_id, accion_tramite_id, estado_anterior_id, estado_resultante_id,
      usuario_actor_id, area_contexto_id, observacion, clave_idempotencia
    ) VALUES (
      $1, $2, $3, $4, $5, $6, null, $7
    ) RETURNING movimiento_id
  `, [
    expedienteId, accionId, estadoAnteriorId, estadoResultanteId,
    usuarioActorId, areaActualExpediente, randomUUID()
  ]);

  const movimientoId = resMovimiento.rows[0].movimiento_id;

  // 4. INSERT en atencion_tramite (Vnculo obligatorio por el trigger de BD)
  await cliente.query(`
    INSERT INTO sigd_rut.atencion_tramite (movimiento_id, resultado_resumen)
    VALUES ($1, $2)
  `, [movimientoId, datos.resultado_resumen]);

  // 5. EVENTO OUTBOX
  await insertarEvento(cliente, {
    agregado: 'Expediente',
    tipo_evento: 'ExpedienteAtendido',
    payload: {
      identidad: { expediente_id: expedienteId, movimiento_id: movimientoId },
      contexto: { usuario_actor_id: usuarioActorId, area_contexto_id: areaActualExpediente },
      datos_especificos: { resultado_resumen: datos.resultado_resumen }
    }
  });
}


/**
 * Servicio de Archivado Formal (T-BE-RD-08).
 * Requiere que el estado previo sea CERRADO.
 */
export async function archivarExpediente(
  cliente: PoolClient,
  expedienteId: string,
  datos: ArchivarExpedienteDTO
): Promise<void> {
  const contexto = getRequestContext();
  const usuarioActorId = contexto?.usuario_id;

  if (!usuarioActorId) {
    throw new UnauthorizedError({ detail: 'No se encontro usuario en el contexto.' });
  }

  // 1. Obtener estado y area actual
  const resEstadoActual = await cliente.query<{
    estado_actual_id: string;
    area_contexto_id: string;
    codigo_estado: string;
  }>(
    `
    SELECT
      e.estado_nuevo AS estado_actual_id,
      e.area_actual_id AS area_contexto_id,
      e.estado_nuevo AS codigo_estado
    FROM sigd_rut.estado_actual_expediente e
    WHERE e.expediente_id::text = $1::text
  `,
    [expedienteId],
  );

  if (resEstadoActual.rowCount === 0) {
    throw new NotFoundError({ detail: 'El expediente no existe o no tiene estado actual.' });
  }

  const {
    estado_actual_id: estadoAnteriorId,
    area_contexto_id: areaActualExpediente,
    codigo_estado: codigoEstadoActual,
  } = resEstadoActual.rows[0];

  if (codigoEstadoActual !== 'CERRADO' && codigoEstadoActual !== 'RESUELTO') {
    throw new DomainError({
      code: 'ESTADO_INVALIDO',
      message: 'El estado actual del expediente no permite realizar esta acción.',
      detail: 'Solo se pueden archivar expedientes en estado CERRADO o RESUELTO.',
    });
  }

  // 2. Obtener IDs fisicos (Accion ARCHIVAR)
  const resCatalogos = await cliente.query<{ id: string }>(`
    SELECT codigo AS id FROM sigd_rut.accion_tramite WHERE codigo IN ('ARCHIVAR', 'CIERRE')
  `);

  if (resCatalogos.rowCount === 0) {
    throw new DomainError({
      code: 'CATALOGO_NO_ENCONTRADO',
      message: 'Faltan datos en el catálogo de base de datos.',
      detail: 'Error fisico: No se encontro la accion ARCHIVAR en BD.',
    });
  }
  const accionId = resCatalogos.rows[0].id;

  // 3. INSERT en movimiento_tramite (Manteniendo estado_resultante = CERRADO)
  const resMovimiento = await cliente.query<{ movimiento_id: string }>(`
    INSERT INTO sigd_rut.movimiento_tramite (
      expediente_id, accion_tramite_id, estado_anterior_id, estado_resultante_id,
      usuario_actor_id, area_contexto_id, observacion, clave_idempotencia
    ) VALUES (
      $1, $2, $3, $3, $4, $5, $6, $7
    ) RETURNING movimiento_id
  `, [
    expedienteId, accionId, estadoAnteriorId,
    usuarioActorId, areaActualExpediente, datos.observaciones || null, randomUUID()
  ]);

  const movimientoId = resMovimiento.rows[0].movimiento_id;

  // 4. INSERT en archivo_tramite
  await cliente.query(`
    INSERT INTO sigd_rut.archivo_tramite (movimiento_id, estante, balda, caja)
    VALUES ($1, $2, $3, $4)
  `, [movimientoId, datos.estante, datos.balda, datos.caja]);

  // 5. EVENTO OUTBOX
  await insertarEvento(cliente, {
    agregado: 'Expediente',
    tipo_evento: 'ExpedienteArchivado',
    payload: {
      identidad: { expediente_id: expedienteId, movimiento_id: movimientoId },
      contexto: { usuario_actor_id: usuarioActorId, area_contexto_id: areaActualExpediente },
      datos_especificos: {
        estante: datos.estante, balda: datos.balda, caja: datos.caja, observaciones: datos.observaciones
      }
    }
  });
}
