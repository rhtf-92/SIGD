import type { PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import { getRequestContext } from '../../shared/request-context/request-context.js';
import { insertarEvento } from '../../audit/evento-outbox.repository.js';
import { UnauthorizedError, NotFoundError, DomainError, ForbiddenError } from '../../shared/domain/errors/index.js';
import type { DerivarExpedienteDTO } from './dto/derivarExpediente.dto.js';
import type { ArchivarExpedienteDTO } from './dto/archivarExpediente.dto.js';
import type { AtenderExpedienteDTO } from './dto/atenderExpediente.dto.js';

function resolverOperadorBigInt(id: string | number | undefined | null): string {
  if (!id) return '1';
  if (typeof id === 'number') return Math.max(1, Math.floor(id)).toString();
  const limpio = String(id).trim();
  if (/^\d+$/.test(limpio)) return limpio;
  try {
    const hex = limpio.replace(/[^0-9a-fA-F]/g, '').slice(0, 15);
    if (hex.length > 0) {
      const num = BigInt('0x' + hex) & 0x7fffffffffffffffn;
      return num === 0n ? '1' : num.toString();
    }
  } catch {
    // fallback
  }
  return '1';
}

/**
 * Servicio exclusivo de la tarea T-BE-RD-06 (Derivaciones y Pases Internos).
 * Adaptado al baseline canónico BASELINE_2026_V1 y FSM formal de RutaDoc.
 * Utiliza únicamente SELECT e INSERT sobre las particiones de movimiento (WORM).
 */
export async function derivarExpediente(
  cliente: PoolClient,
  expedienteId: string,
  datos: DerivarExpedienteDTO
): Promise<void> {
  // 1. Validación de contexto y tenencia de usuario
  const contexto = getRequestContext();
  const usuarioActorId = contexto?.usuario_id;

  if (!usuarioActorId) {
    throw new UnauthorizedError({ detail: 'No se encontró usuario en el contexto para registrar el movimiento.' });
  }

  // 2. Obtener estado y área actual del expediente desde la proyección de baseline
  const resEstadoActual = await cliente.query<{ estado_actual_id: string; area_contexto_id: string }>(`
    SELECT
      COALESCE(u.estado_nuevo, e.estado, 'REGISTRADO') AS estado_actual_id,
      COALESCE(u.area_actual_id, e.area_destino_id::text, '') AS area_contexto_id
    FROM sigd_tra.expediente e
    LEFT JOIN sigd_rut.estado_actual_expediente u ON u.expediente_id = e.expediente_id
    WHERE e.expediente_id = $1::uuid
  `, [expedienteId]);

  if (resEstadoActual.rowCount === 0) {
    throw new NotFoundError({ detail: 'El expediente no existe o no tiene estado actual.' });
  }

  const estadoActual = resEstadoActual.rows[0].estado_actual_id;
  const areaOrigenId = resEstadoActual.rows[0].area_contexto_id;

  if (estadoActual === 'ARCHIVADO') {
    throw new DomainError({
      code: 'ESTADO_INVALIDO',
      message: 'El expediente se encuentra archivado y no puede ser derivado.',
    });
  }

  const operadorId = resolverOperadorBigInt(usuarioActorId);

  // 3. FSM de RutaDoc: garantizar transición válida hacia DERIVADO
  let estadoPrevioDerivacion = estadoActual;
  if (estadoActual === 'REGISTRADO') {
    await cliente.query(`
      INSERT INTO sigd_rut.movimiento_tramite (
        expediente_id, estado_anterior, evento, estado_nuevo, usuario_operador_id, datos
      ) VALUES ($1::uuid, 'REGISTRADO', 'RECEPCION', 'RECEPCIONADO', $2::bigint, $3::jsonb)
    `, [expedienteId, operadorId, JSON.stringify({ detalle: 'Recepción inicial en Mesa de Partes' })]);

    await cliente.query(`
      INSERT INTO sigd_rut.movimiento_tramite (
        expediente_id, estado_anterior, evento, estado_nuevo, usuario_operador_id, datos
      ) VALUES ($1::uuid, 'RECEPCIONADO', 'INICIAR_CALIFICACION', 'EN_CALIFICACION', $2::bigint, $3::jsonb)
    `, [expedienteId, operadorId, JSON.stringify({ detalle: 'Calificación previa a derivación' })]);

    estadoPrevioDerivacion = 'EN_CALIFICACION';
  } else if (estadoActual === 'RECEPCIONADO') {
    await cliente.query(`
      INSERT INTO sigd_rut.movimiento_tramite (
        expediente_id, estado_anterior, evento, estado_nuevo, usuario_operador_id, datos
      ) VALUES ($1::uuid, 'RECEPCIONADO', 'INICIAR_CALIFICACION', 'EN_CALIFICACION', $2::bigint, $3::jsonb)
    `, [expedienteId, operadorId, JSON.stringify({ detalle: 'Calificación previa a derivación' })]);

    estadoPrevioDerivacion = 'EN_CALIFICACION';
  } else if (estadoActual === 'DERIVADO') {
    await cliente.query(`
      INSERT INTO sigd_rut.movimiento_tramite (
        expediente_id, estado_anterior, evento, estado_nuevo, usuario_operador_id, datos
      ) VALUES ($1::uuid, 'DERIVADO', 'RECEPCION', 'EN_REVISION', $2::bigint, $3::jsonb)
    `, [expedienteId, operadorId, JSON.stringify({ detalle: 'Recepción previa a re-derivación' })]);

    estadoPrevioDerivacion = 'EN_REVISION';
  } else if (estadoActual === 'SUBSANADO') {
    await cliente.query(`
      INSERT INTO sigd_rut.movimiento_tramite (
        expediente_id, estado_anterior, evento, estado_nuevo, usuario_operador_id, datos
      ) VALUES ($1::uuid, 'SUBSANADO', 'INICIAR_REVISION', 'EN_REVISION', $2::bigint, $3::jsonb)
    `, [expedienteId, operadorId, JSON.stringify({ detalle: 'Pase a revisión tras subsanación' })]);

    estadoPrevioDerivacion = 'EN_REVISION';
  }

  // 4. Procesar cada destino e insertar movimiento append-only
  for (const destino of datos.destinos) {
    const datosMovimiento = {
      areaId: destino.area_destino_id,
      areaOrigenId: areaOrigenId || null,
      proveido: datos.proveido,
      motivo: datos.proveido,
      es_copia: destino.es_copia,
      usuario_asignado_id: destino.usuario_asignado_id || null,
    };

    const resMovimiento = await cliente.query<{ movimiento_id: string }>(`
      INSERT INTO sigd_rut.movimiento_tramite (
        expediente_id,
        estado_anterior,
        evento,
        estado_nuevo,
        usuario_operador_id,
        clave_idempotencia,
        datos
      ) VALUES (
        $1::uuid,
        $2,
        'DERIVACION',
        'DERIVADO',
        $3::bigint,
        $4,
        $5::jsonb
      ) RETURNING id_movimiento AS movimiento_id
    `, [
      expedienteId,
      estadoPrevioDerivacion,
      operadorId,
      randomUUID(),
      JSON.stringify(datosMovimiento),
    ]);

    const movimientoId = resMovimiento.rows[0].movimiento_id;

    // 5. GENERAR EVENTO OUTBOX EN LA MISMA TRANSACCIÓN
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

  // 1. Obtener estado y orea actual
  const resEstadoActual = await cliente.query<{ estado_actual_id: string, area_contexto_id: string }>(`
    SELECT e.estado_actual_id, m.area_contexto_id
    FROM sigd_rut.estado_actual_tramite e
    JOIN sigd_rut.movimiento_tramite m ON e.movimiento_actual_id = m.movimiento_id
    WHERE e.expediente_id = $1
  `, [expedienteId]);

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

  // 2. Obtener IDs fsicos de los catologos
  const resCatalogos = await cliente.query<{ id: string, tipo: string }>(`
    SELECT accion_tramite_id::text as id, 'accion' as tipo FROM sigd_rut.accion_tramite WHERE codigo = 'ATENCION'
    UNION ALL
    SELECT estado_tramite_id::text as id, 'estado' as tipo FROM sigd_rut.estado_tramite WHERE codigo = 'ATENDIDO'
  `);

  const accionId = resCatalogos.rows.find(r => r.tipo === 'accion')?.id;
  const estadoResultanteId = resCatalogos.rows.find(r => r.tipo === 'estado')?.id;

  if (!accionId || !estadoResultanteId) {
    throw new DomainError({ code: 'CATALOGO_NO_ENCONTRADO', message: 'Faltan datos en el catálogo de base de datos.', detail: 'Error fsico: No se encontraron los cdigos ATENCION o ATENDIDO en BD.' });
  }

  // 3. INSERT en movimiento_tramite
  const resMovimiento = await cliente.query<{ movimiento_id: string }>(`
    INSERT INTO sigd_rut.movimiento_tramite (
      expediente_id, secuencia, accion_tramite_id, estado_anterior_id, estado_resultante_id,
      usuario_actor_id, area_contexto_id, observacion, clave_idempotencia
    ) VALUES (
      $1,
      (SELECT COALESCE(MAX(secuencia), 0) + 1 FROM sigd_rut.movimiento_tramite WHERE expediente_id = $1),
      $2, $3, $4, $5, $6, null, $7
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
  const resEstadoActual = await cliente.query<{ estado_actual_id: string, area_contexto_id: string, codigo_estado: string }>(`
    SELECT e.estado_actual_id, m.area_contexto_id, et.codigo as codigo_estado
    FROM sigd_rut.estado_actual_tramite e
    JOIN sigd_rut.movimiento_tramite m ON e.movimiento_actual_id = m.movimiento_id
    JOIN sigd_rut.estado_tramite et ON et.estado_tramite_id = e.estado_actual_id
    WHERE e.expediente_id = $1
  `, [expedienteId]);

  if (resEstadoActual.rowCount === 0) {
    throw new NotFoundError({ detail: 'El expediente no existe o no tiene estado actual.' });
  }

  const { estado_actual_id: estadoAnteriorId, area_contexto_id: areaActualExpediente, codigo_estado: codigoEstadoActual } = resEstadoActual.rows[0];

  if (codigoEstadoActual !== 'CERRADO') {
    throw new DomainError({ code: 'ESTADO_INVALIDO', message: 'El estado actual del expediente no permite realizar esta acción.', detail: 'Solo se pueden archivar expedientes en estado CERRADO.' });
  }

  // 2. Obtener IDs fisicos (Accion ARCHIVAR)
  const resCatalogos = await cliente.query<{ id: string }>(`
    SELECT accion_tramite_id::text as id FROM sigd_rut.accion_tramite WHERE codigo = 'ARCHIVAR'
  `);

  if (resCatalogos.rowCount === 0) {
    throw new DomainError({ code: 'CATALOGO_NO_ENCONTRADO', message: 'Faltan datos en el catálogo de base de datos.', detail: 'Error fisico: No se encontro la accion ARCHIVAR en BD.' });
  }
  const accionId = resCatalogos.rows[0].id;

  // 3. INSERT en movimiento_tramite (Manteniendo estado_resultante = CERRADO)
  const resMovimiento = await cliente.query<{ movimiento_id: string }>(`
    INSERT INTO sigd_rut.movimiento_tramite (
      expediente_id, secuencia, accion_tramite_id, estado_anterior_id, estado_resultante_id,
      usuario_actor_id, area_contexto_id, observacion, clave_idempotencia
    ) VALUES (
      $1,
      (SELECT COALESCE(MAX(secuencia), 0) + 1 FROM sigd_rut.movimiento_tramite WHERE expediente_id = $1),
      $2, $3, $3, $4, $5, $6, $7
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

/**
 * Servicio de Observación Formal (RutaDoc FSM y LPAG).
 * Mapea la acción al estado 'OBSERVADO', pausando el cómputo de SLA.
 */
export async function observarExpediente(
  cliente: PoolClient,
  expedienteId: string,
  motivo: string
): Promise<void> {
  const contexto = getRequestContext();
  const usuarioActorId = contexto?.usuario_id;

  if (!usuarioActorId) {
    throw new UnauthorizedError({ detail: 'No se encontró usuario en el contexto para registrar la observación.' });
  }

  const resEstadoActual = await cliente.query<{ estado_actual_id: string; area_contexto_id: string }>(`
    SELECT
      COALESCE(u.estado_nuevo, e.estado, 'REGISTRADO') AS estado_actual_id,
      COALESCE(u.area_actual_id, e.area_destino_id::text, '') AS area_contexto_id
    FROM sigd_tra.expediente e
    LEFT JOIN sigd_rut.estado_actual_expediente u ON u.expediente_id = e.expediente_id
    WHERE e.expediente_id = $1::uuid
  `, [expedienteId]);

  if (resEstadoActual.rowCount === 0) {
    throw new NotFoundError({ detail: 'El expediente no existe o no tiene estado actual.' });
  }

  const estadoActual = resEstadoActual.rows[0].estado_actual_id;
  const areaOrigenId = resEstadoActual.rows[0].area_contexto_id;

  if (estadoActual === 'ARCHIVADO' || estadoActual === 'RESUELTO') {
    throw new DomainError({
      code: 'ESTADO_INVALIDO',
      message: `El expediente en estado ${estadoActual} no puede ser observado.`,
    });
  }

  const operadorId = resolverOperadorBigInt(usuarioActorId);

  // FSM formal: transición hacia OBSERVADO
  let estadoPrevioObservacion = estadoActual;
  if (estadoActual === 'REGISTRADO') {
    await cliente.query(`
      INSERT INTO sigd_rut.movimiento_tramite (
        expediente_id, estado_anterior, evento, estado_nuevo, usuario_operador_id, datos
      ) VALUES ($1::uuid, 'REGISTRADO', 'RECEPCION', 'RECEPCIONADO', $2::bigint, $3::jsonb)
    `, [expedienteId, operadorId, JSON.stringify({ detalle: 'Recepción inicial en Mesa de Partes' })]);

    await cliente.query(`
      INSERT INTO sigd_rut.movimiento_tramite (
        expediente_id, estado_anterior, evento, estado_nuevo, usuario_operador_id, datos
      ) VALUES ($1::uuid, 'RECEPCIONADO', 'INICIAR_CALIFICACION', 'EN_CALIFICACION', $2::bigint, $3::jsonb)
    `, [expedienteId, operadorId, JSON.stringify({ detalle: 'Calificación previa a observación' })]);

    estadoPrevioObservacion = 'EN_CALIFICACION';
  } else if (estadoActual === 'RECEPCIONADO') {
    await cliente.query(`
      INSERT INTO sigd_rut.movimiento_tramite (
        expediente_id, estado_anterior, evento, estado_nuevo, usuario_operador_id, datos
      ) VALUES ($1::uuid, 'RECEPCIONADO', 'INICIAR_CALIFICACION', 'EN_CALIFICACION', $2::bigint, $3::jsonb)
    `, [expedienteId, operadorId, JSON.stringify({ detalle: 'Calificación previa a observación' })]);

    estadoPrevioObservacion = 'EN_CALIFICACION';
  } else if (estadoActual === 'DERIVADO') {
    await cliente.query(`
      INSERT INTO sigd_rut.movimiento_tramite (
        expediente_id, estado_anterior, evento, estado_nuevo, usuario_operador_id, datos
      ) VALUES ($1::uuid, 'DERIVADO', 'RECEPCION', 'EN_REVISION', $2::bigint, $3::jsonb)
    `, [expedienteId, operadorId, JSON.stringify({ detalle: 'Recepción previa a observación' })]);

    estadoPrevioObservacion = 'EN_REVISION';
  }

  const datosMovimiento = {
    motivo,
    detalle: motivo,
    areaId: areaOrigenId || null,
  };

  const resMovimiento = await cliente.query<{ movimiento_id: string }>(`
    INSERT INTO sigd_rut.movimiento_tramite (
      expediente_id,
      estado_anterior,
      evento,
      estado_nuevo,
      usuario_operador_id,
      clave_idempotencia,
      datos
    ) VALUES (
      $1::uuid,
      $2,
      'OBSERVACION',
      'OBSERVADO',
      $3::bigint,
      $4,
      $5::jsonb
    ) RETURNING id_movimiento AS movimiento_id
  `, [
    expedienteId,
    estadoPrevioObservacion,
    operadorId,
    randomUUID(),
    JSON.stringify(datosMovimiento),
  ]);

  const movimientoId = resMovimiento.rows[0].movimiento_id;

  await cliente.query(
    `UPDATE sigd_tra.expediente SET estado = 'OBSERVADO' WHERE expediente_id = $1::uuid`,
    [expedienteId],
  );

  await insertarEvento(cliente, {
    agregado: 'Expediente',
    tipo_evento: 'ExpedienteObservado',
    payload: {
      identidad: { expediente_id: expedienteId, movimiento_id: movimientoId },
      contexto: { usuario_actor_id: usuarioActorId, area_contexto_id: areaOrigenId },
      datos_especificos: { motivo, slaPaused: true },
    },
  });
}

/**
 * Servicio de Subsanación Formal (RutaDoc FSM y LPAG).
 * Mapea la acción desde 'OBSERVADO' hacia 'SUBSANADO' y luego 'EN_REVISION'.
 */
export async function subsanarExpediente(
  cliente: PoolClient,
  expedienteId: string,
  motivo: string
): Promise<void> {
  const contexto = getRequestContext();
  const usuarioActorId = contexto?.usuario_id;

  if (!usuarioActorId) {
    throw new UnauthorizedError({ detail: 'No se encontró usuario en el contexto para registrar la subsanación.' });
  }

  const resEstadoActual = await cliente.query<{ estado_actual_id: string; area_contexto_id: string }>(`
    SELECT
      COALESCE(u.estado_nuevo, e.estado, 'REGISTRADO') AS estado_actual_id,
      COALESCE(u.area_actual_id, e.area_destino_id::text, '') AS area_contexto_id
    FROM sigd_tra.expediente e
    LEFT JOIN sigd_rut.estado_actual_expediente u ON u.expediente_id = e.expediente_id
    WHERE e.expediente_id = $1::uuid
  `, [expedienteId]);

  if (resEstadoActual.rowCount === 0) {
    throw new NotFoundError({ detail: 'El expediente no existe o no tiene estado actual.' });
  }

  const estadoActual = resEstadoActual.rows[0].estado_actual_id;
  const areaOrigenId = resEstadoActual.rows[0].area_contexto_id;

  if (estadoActual !== 'OBSERVADO') {
    throw new DomainError({
      code: 'ESTADO_INVALIDO',
      message: `Solo se pueden subsanar expedientes en estado OBSERVADO (actual: ${estadoActual}).`,
    });
  }

  const operadorId = resolverOperadorBigInt(usuarioActorId);

  // FSM formal: OBSERVADO -> CORRECCION -> SUBSANADO -> INICIAR_REVISION -> EN_REVISION
  await cliente.query(`
    INSERT INTO sigd_rut.movimiento_tramite (
      expediente_id, estado_anterior, evento, estado_nuevo, usuario_operador_id, datos
    ) VALUES ($1::uuid, 'OBSERVADO', 'CORRECCION', 'SUBSANADO', $2::bigint, $3::jsonb)
  `, [expedienteId, operadorId, JSON.stringify({ motivo, detalle: motivo, areaId: areaOrigenId || null })]);

  const resMov = await cliente.query<{ movimiento_id: string }>(`
    INSERT INTO sigd_rut.movimiento_tramite (
      expediente_id,
      estado_anterior,
      evento,
      estado_nuevo,
      usuario_operador_id,
      clave_idempotencia,
      datos
    ) VALUES (
      $1::uuid,
      'SUBSANADO',
      'INICIAR_REVISION',
      'EN_REVISION',
      $2::bigint,
      $3,
      $4::jsonb
    ) RETURNING id_movimiento AS movimiento_id
  `, [
    expedienteId,
    operadorId,
    randomUUID(),
    JSON.stringify({ detalle: 'Pase a revisión tras subsanación', areaId: areaOrigenId || null }),
  ]);

  const movimientoId = resMov.rows[0].movimiento_id;

  await cliente.query(
    `UPDATE sigd_tra.expediente SET estado = 'EN_TRAMITE' WHERE expediente_id = $1::uuid`,
    [expedienteId],
  );

  await insertarEvento(cliente, {
    agregado: 'Expediente',
    tipo_evento: 'ExpedienteSubsanado',
    payload: {
      identidad: { expediente_id: expedienteId, movimiento_id: movimientoId },
      contexto: { usuario_actor_id: usuarioActorId, area_contexto_id: areaOrigenId },
      datos_especificos: { motivo },
    },
  });
}
