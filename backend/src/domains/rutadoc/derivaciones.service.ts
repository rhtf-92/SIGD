import type { PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import { getRequestContext } from '../../shared/request-context/request-context.js';
import { insertarEvento } from '../../audit/evento-outbox.repository.js';
import { UnauthorizedError, NotFoundError, DomainError, ForbiddenError, ConflictError } from '../../shared/domain/errors/index.js';
import type { DerivarExpedienteDTO } from './dto/derivarExpediente.dto.js';
import type { ArchivarExpedienteDTO } from './dto/archivarExpediente.dto.js';
import type { AtenderExpedienteDTO } from './dto/atenderExpediente.dto.js';
import { documentoStorageService } from '../../core/storage/documento-storage.service.js';
import { ExpedienteAsignacionService } from './expedienteAsignacion.service.js';
import { ExpedienteObservacionService } from './expedienteObservacion.service.js';

export function resolverOperadorBigInt(id: string | number | undefined | null): string {
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

  // 1.1 Idempotencia: Verificar si la clave ya fue registrada
  if (datos.clave_idempotencia) {
    const resIdem = await cliente.query<{ id_movimiento: string; datos: any }>(
      `SELECT id_movimiento, datos FROM sigd_rut.movimiento_tramite WHERE clave_idempotencia = $1 LIMIT 1`,
      [datos.clave_idempotencia],
    );
    if (resIdem.rowCount && resIdem.rowCount > 0) {
      const datosExistentes = resIdem.rows[0].datos;
      const primerDestino = datos.destinos[0]?.area_destino_id;
      if (
        datosExistentes?.areaId === primerDestino &&
        datosExistentes?.proveido === datos.proveido
      ) {
        return; // Idempotente: misma clave y mismo payload
      }
      throw new ConflictError({
        code: 'IDEMPOTENCY_CONFLICT',
        message: 'Conflicto de idempotencia: La clave ya fue utilizada con una carga de datos diferente.',
      });
    }
  }

  // 2. Obtener estado y área actual del expediente desde la proyección de baseline
  const resEstadoActual = await cliente.query<{
    estado_actual_id: string;
    area_contexto_id: string;
    codigo_expediente: string;
    solicitante_id: string;
  }>(`
    SELECT
      COALESCE(u.estado_nuevo, e.estado, 'REGISTRADO') AS estado_actual_id,
      COALESCE(u.area_actual_id, e.area_destino_id::text, '') AS area_contexto_id,
      e.codigo_expediente,
      e.solicitante_id::text AS solicitante_id
    FROM sigd_tra.expediente e
    LEFT JOIN sigd_rut.estado_actual_expediente u ON u.expediente_id = e.expediente_id
    WHERE e.expediente_id = $1::uuid
  `, [expedienteId]);

  if (resEstadoActual.rowCount === 0) {
    throw new NotFoundError({ detail: 'El expediente no existe o no tiene estado actual.' });
  }

  const {
    estado_actual_id: estadoActual,
    area_contexto_id: areaOrigenId,
    codigo_expediente: codigoExpediente,
    solicitante_id: solicitanteId,
  } = resEstadoActual.rows[0];

  const estadosPermitidosDerivacion = ['REGISTRADO', 'RECEPCIONADO', 'EN_CALIFICACION', 'DERIVADO', 'EN_REVISION', 'SUBSANADO'];
  if (!estadosPermitidosDerivacion.includes(estadoActual)) {
    throw new DomainError({
      code: 'ESTADO_INVALIDO',
      message: `El expediente en estado ${estadoActual} no puede ser derivado.`,
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
    const esCorreccion = Boolean(datos.es_correccion || datos.motivo === 'CORRECCION_DERIVACION');
    const eventoMov = esCorreccion ? 'CORRECCION_DERIVACION' : 'DERIVACION';
    const claveMov = datos.clave_idempotencia || randomUUID();

    const datosMovimiento = {
      areaId: destino.area_destino_id,
      areaOrigenId: areaOrigenId || null,
      proveido: datos.proveido,
      motivo: datos.proveido,
      es_copia: destino.es_copia,
      es_correccion: esCorreccion,
      usuario_asignado_id: destino.usuario_asignado_id || null,
      persona_asignada_id: destino.persona_asignada_id || null,
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
        $3,
        'DERIVADO',
        $4::bigint,
        $5,
        $6::jsonb
      ) RETURNING id_movimiento AS movimiento_id
    `, [
      expedienteId,
      estadoPrevioDerivacion,
      eventoMov,
      operadorId,
      claveMov,
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
 * Servicio de Recepción Formal en Área de Destino (RutaDoc FSM y LPAG).
 * Mapea la acción desde 'DERIVADO' hacia 'EN_REVISION'.
 */
export async function recepcionarExpediente(
  cliente: PoolClient,
  expedienteId: string,
): Promise<void> {
  const contexto = getRequestContext();
  const usuarioActorId = contexto?.usuario_id;

  if (!usuarioActorId) {
    throw new UnauthorizedError({ detail: 'No se encontró usuario en el contexto para registrar la recepción.' });
  }

  const resEstadoActual = await cliente.query<{ estado_actual_id: string; area_contexto_id: string }>(
    `SELECT
      COALESCE(u.estado_nuevo, e.estado, 'REGISTRADO') AS estado_actual_id,
      COALESCE(u.area_actual_id, e.area_destino_id::text, '') AS area_contexto_id
    FROM sigd_tra.expediente e
    LEFT JOIN sigd_rut.estado_actual_expediente u ON u.expediente_id = e.expediente_id
    WHERE e.expediente_id = $1::uuid`,
    [expedienteId]
  );

  if (resEstadoActual.rowCount === 0) {
    throw new NotFoundError({ detail: 'El expediente no existe o no tiene estado actual.' });
  }

  const estadoActual = resEstadoActual.rows[0].estado_actual_id;
  const areaActualId = resEstadoActual.rows[0].area_contexto_id;

  if (estadoActual === 'EN_REVISION') {
    return; // Idempotente
  }

  if (estadoActual !== 'DERIVADO') {
    throw new DomainError({
      code: 'ESTADO_INVALIDO',
      message: `El expediente en estado ${estadoActual} no puede ser recepcionado. Solo expedientes en estado DERIVADO pueden recepcionarse.`,
    });
  }

  const operadorId = resolverOperadorBigInt(usuarioActorId);

  const datosMovimiento = {
    areaId: areaActualId || null,
    detalle: 'Recepción formal en área de destino',
  };

  const resMovimiento = await cliente.query<{ movimiento_id: string }>(
    `INSERT INTO sigd_rut.movimiento_tramite (
      expediente_id,
      estado_anterior,
      evento,
      estado_nuevo,
      usuario_operador_id,
      clave_idempotencia,
      datos
    ) VALUES (
      $1::uuid,
      'DERIVADO',
      'RECEPCION',
      'EN_REVISION',
      $2::bigint,
      $3,
      $4::jsonb
    ) RETURNING id_movimiento AS movimiento_id`,
    [
      expedienteId,
      operadorId,
      randomUUID(),
      JSON.stringify(datosMovimiento),
    ]
  );

  const movimientoId = resMovimiento.rows[0].movimiento_id;

  const updateRes = await cliente.query(
    `UPDATE sigd_tra.expediente
        SET estado = 'EN_REVISION'
      WHERE expediente_id = $1::uuid
        AND estado = 'DERIVADO'`,
    [expedienteId],
  );

  if ((updateRes?.rowCount ?? 0) !== 1) {
    throw new ConflictError({
      code: 'CONCURRENCY_CONFLICT_EXPEDIENTE_MUTATION',
      message: `No se pudo actualizar el estado a EN_REVISION para el expediente ${expedienteId}.`,
    });
  }

  await insertarEvento(cliente, {
    agregado: 'Expediente',
    tipo_evento: 'ExpedienteRecepcionado',
    payload: {
      identidad: { expediente_id: expedienteId, movimiento_id: movimientoId },
      contexto: { usuario_actor_id: usuarioActorId, area_contexto_id: areaActualId },
      datos_especificos: { detalle: 'Expediente recepcionado en área de destino' },
    },
  });
}

/**
 * Servicio de Atención Resolutiva (T-BE-RD-07).
 * Mapea la acción formalmente hacia 'RESUELTO', emitiendo pase a firma y firma digital,
 * vinculando documento PDF si existe, y depositando notificación en Casilla Electrónica.
 */
// =============================================================================
// Transición FSM Canónica: EN_REVISION -> ENVIAR_A_FIRMA -> EN_FIRMA (5G)
// =============================================================================
export async function enviarAFirmaExpediente(
  cliente: PoolClient,
  expedienteId: string,
  datos: {
    resultado_resumen: string;
    observacion_interna?: string | null;
  },
): Promise<{ movimiento_id: string; estado: 'EN_FIRMA' }> {
  const contexto = getRequestContext();
  const usuarioActorId = contexto?.usuario_id;

  if (!usuarioActorId) {
    throw new UnauthorizedError({ detail: 'No se encontró usuario en el contexto para enviar a firma.' });
  }

  const resEstadoActual = await cliente.query<{
    estado_actual_id: string;
    area_contexto_id: string;
    codigo_expediente: string;
    solicitante_id: string;
  }>(
    `SELECT
      COALESCE(u.estado_nuevo, e.estado, 'REGISTRADO') AS estado_actual_id,
      COALESCE(u.area_actual_id, e.area_destino_id::text, '') AS area_contexto_id,
      e.codigo_expediente,
      e.solicitante_id::text AS solicitante_id
    FROM sigd_tra.expediente e
    LEFT JOIN sigd_rut.estado_actual_expediente u ON u.expediente_id = e.expediente_id
    WHERE e.expediente_id = $1::uuid`,
    [expedienteId],
  );

  if (resEstadoActual.rowCount === 0) {
    throw new NotFoundError({ detail: 'El expediente no existe o no tiene estado actual.' });
  }

  const { estado_actual_id: estadoActual, area_contexto_id: areaActual } = resEstadoActual.rows[0];
  const operadorId = resolverOperadorBigInt(usuarioActorId);

  if (estadoActual === 'DERIVADO') {
    await cliente.query(
      `INSERT INTO sigd_rut.movimiento_tramite (
        expediente_id, estado_anterior, evento, estado_nuevo, usuario_operador_id, datos
      ) VALUES ($1::uuid, 'DERIVADO', 'RECEPCION', 'EN_REVISION', $2::bigint, $3::jsonb)`,
      [expedienteId, operadorId, JSON.stringify({ detalle: 'Recepción previa a pase para firma' })],
    );
  } else if (estadoActual !== 'EN_REVISION') {
    throw new DomainError({
      code: 'ESTADO_INVALIDO',
      message: `El expediente en estado ${estadoActual} no puede ser enviado a firma. Se requiere estado EN_REVISION o DERIVADO.`,
    });
  }

  const resMov = await cliente.query<{ movimiento_id: string }>(
    `INSERT INTO sigd_rut.movimiento_tramite (
      expediente_id,
      estado_anterior,
      evento,
      estado_nuevo,
      usuario_operador_id,
      clave_idempotencia,
      datos
    ) VALUES (
      $1::uuid,
      'EN_REVISION',
      'ENVIAR_A_FIRMA',
      'EN_FIRMA',
      $2::bigint,
      $3,
      $4::jsonb
    ) RETURNING id_movimiento AS movimiento_id`,
    [
      expedienteId,
      operadorId,
      randomUUID(),
      JSON.stringify({
        detalle: 'Pase formal para emisión y firma de resolución',
        resultado_resumen: datos.resultado_resumen,
        observacion_interna: datos.observacion_interna || null,
        areaId: areaActual || null,
      }),
    ],
  );

  const movimientoId = resMov.rows[0]?.movimiento_id || randomUUID();

  const updateRes = await cliente.query(
    `UPDATE sigd_tra.expediente
        SET estado = 'EN_FIRMA'
      WHERE expediente_id = $1::uuid
        AND estado IN ('EN_REVISION', 'DERIVADO')`,
    [expedienteId],
  );

  if ((updateRes?.rowCount ?? 0) !== 1) {
    throw new ConflictError({
      code: 'CONCURRENCY_CONFLICT_EXPEDIENTE_MUTATION',
      message: `No se pudo actualizar el estado a EN_FIRMA para el expediente ${expedienteId}.`,
    });
  }

  await insertarEvento(cliente, {
    agregado: 'Expediente',
    tipo_evento: 'ExpedienteEnviadoAFirma',
    payload: {
      identidad: { expediente_id: expedienteId, movimiento_id: movimientoId },
      contexto: { usuario_actor_id: usuarioActorId, area_contexto_id: areaActual },
      datos_especificos: {
        resultado_resumen: datos.resultado_resumen,
        observacion_interna: datos.observacion_interna || null,
      },
    },
  });

  return { movimiento_id: movimientoId, estado: 'EN_FIRMA' };
}

// =============================================================================
// Transición FSM Canónica: EN_FIRMA -> FIRMA -> RESUELTO (5G)
// Requiere evidencia canónica de firma digital/criptográfica antes de transicionar
// =============================================================================
export async function resolverExpedienteConFirma(
  cliente: PoolClient,
  expedienteId: string,
  datos: AtenderExpedienteDTO,
): Promise<{ movimiento_id: string; estado: 'RESUELTO' }> {
  const contexto = getRequestContext();
  const usuarioActorId = contexto?.usuario_id;

  if (!usuarioActorId) {
    throw new UnauthorizedError({ detail: 'No se encontró usuario en el contexto para resolver el expediente.' });
  }

  const resEstadoActual = await cliente.query<{
    estado_actual_id: string;
    area_contexto_id: string;
    codigo_expediente: string;
    solicitante_id: string;
  }>(
    `SELECT
      COALESCE(u.estado_nuevo, e.estado, 'REGISTRADO') AS estado_actual_id,
      COALESCE(u.area_actual_id, e.area_destino_id::text, '') AS area_contexto_id,
      e.codigo_expediente,
      e.solicitante_id::text AS solicitante_id
    FROM sigd_tra.expediente e
    LEFT JOIN sigd_rut.estado_actual_expediente u ON u.expediente_id = e.expediente_id
    WHERE e.expediente_id = $1::uuid`,
    [expedienteId],
  );

  if (resEstadoActual.rowCount === 0) {
    throw new NotFoundError({ detail: 'El expediente no existe o no tiene estado actual.' });
  }

  const {
    estado_actual_id: estadoActual,
    area_contexto_id: areaActual,
    codigo_expediente: codigoExpediente,
    solicitante_id: solicitanteId,
  } = resEstadoActual.rows[0];

  if (estadoActual !== 'EN_FIRMA') {
    throw new DomainError({
      code: 'ESTADO_INVALIDO',
      message: `El expediente en estado ${estadoActual} no puede ser resuelto directamente. Se requiere estado EN_FIRMA con evidencia de firma válida.`,
    });
  }

  // Comprobar evidencia canónica de firma digital/criptográfica
  let tieneEvidenciaFirma = false;
  let documentoFirmadoId: string | null = null;
  let cvdFirmado: string | null = null;

  // Evidencia 1: Registro formal en sigd_doc.firma_digital_documento
  const resFirmaDoc = await cliente.query<{ documento_id: string; cvd: string | null }>(
    `SELECT f.documento_id, f.cvd
       FROM sigd_doc.firma_digital_documento f
       JOIN sigd_doc.documento_adjunto a ON a.documento_adjunto_id = f.documento_id
      WHERE (a.expediente_id = $1::uuid OR a.expediente_tra_id = $1::uuid)
        AND f.estado = 'FIRMADO_DIGITALMENTE'
      ORDER BY f.fecha_registro DESC
      LIMIT 1`,
    [expedienteId],
  );
  if (resFirmaDoc.rowCount && resFirmaDoc.rowCount > 0) {
    tieneEvidenciaFirma = true;
    documentoFirmadoId = resFirmaDoc.rows[0].documento_id;
    cvdFirmado = resFirmaDoc.rows[0].cvd;
  }

  // Evidencia 2: Resolución oficial firmada en sigd_doc.resolucion
  if (!tieneEvidenciaFirma) {
    const resResolucion = await cliente.query<{ resolucion_id: string }>(
      `SELECT resolucion_id
         FROM sigd_doc.resolucion
        WHERE expediente_id = $1::uuid
          AND estado IN ('FIRMADA', 'NOTIFICADA')
          AND firmado_en IS NOT NULL
        ORDER BY creado_en DESC
        LIMIT 1`,
      [expedienteId],
    );
    if (resResolucion.rowCount && resResolucion.rowCount > 0) {
      tieneEvidenciaFirma = true;
      documentoFirmadoId = resResolucion.rows[0].resolucion_id;
    }
  }

  // Evidencia 3: Si se especificó documento_respuesta_id, verificar firma del adjunto
  if (!tieneEvidenciaFirma && datos.documento_respuesta_id) {
    const resDocResp = await cliente.query<{ documento_id: string; cvd: string | null }>(
      `SELECT documento_id, cvd
         FROM sigd_doc.firma_digital_documento
        WHERE documento_id = $1::uuid
          AND estado = 'FIRMADO_DIGITALMENTE'
        LIMIT 1`,
      [datos.documento_respuesta_id],
    );
    if (resDocResp.rowCount && resDocResp.rowCount > 0) {
      tieneEvidenciaFirma = true;
      documentoFirmadoId = resDocResp.rows[0].documento_id;
      cvdFirmado = resDocResp.rows[0].cvd;
    }
  }

  if (!tieneEvidenciaFirma) {
    throw new ConflictError({
      code: 'EVIDENCIA_FIRMA_REQUERIDA',
      message: 'No se puede resolver el expediente: se requiere evidencia canónica de firma digitalizada/criptográfica válida antes de transicionar a RESUELTO.',
    });
  }

  const operadorId = resolverOperadorBigInt(usuarioActorId);

  // Paso FSM: EN_FIRMA -> FIRMA -> RESUELTO
  const resMovimiento = await cliente.query<{ movimiento_id: string }>(
    `INSERT INTO sigd_rut.movimiento_tramite (
      expediente_id,
      estado_anterior,
      evento,
      estado_nuevo,
      usuario_operador_id,
      clave_idempotencia,
      datos
    ) VALUES (
      $1::uuid,
      'EN_FIRMA',
      'FIRMA',
      'RESUELTO',
      $2::bigint,
      $3,
      $4::jsonb
    ) RETURNING id_movimiento AS movimiento_id`,
    [
      expedienteId,
      operadorId,
      randomUUID(),
      JSON.stringify({
        detalle: 'Atención resolutiva aprobada y firmada formalmente',
        resultado_resumen: datos.resultado_resumen,
        observacion_interna: datos.observacion_interna || null,
        documento_respuesta_id: datos.documento_respuesta_id || null,
        nombre_archivo: datos.nombre_archivo || null,
      }),
    ],
  );

  const movimientoId = resMovimiento.rows[0]?.movimiento_id || randomUUID();

  const updateRes = await cliente.query(
    `UPDATE sigd_tra.expediente
        SET estado = 'RESUELTO'
      WHERE expediente_id = $1::uuid
        AND estado = 'EN_FIRMA'`,
    [expedienteId],
  );

  if ((updateRes?.rowCount ?? 0) !== 1) {
    throw new ConflictError({
      code: 'CONCURRENCY_CONFLICT_EXPEDIENTE_MUTATION',
      message: `No se pudo actualizar el estado a RESUELTO para el expediente ${expedienteId}.`,
    });
  }

  // FASE 5K.1 / REGLA: RutaDoc NO escribe directamente en Casilla.
  // El evento canónico transaccional ExpedienteAtendido alimenta al Transactional Outbox.
  // Privacidad estricta: NO incluir observacion_interna ni notas privadas en el payload ciudadano.
  await insertarEvento(cliente, {
    agregado: 'Expediente',
    tipo_evento: 'ExpedienteAtendido',
    payload: {
      cut: codigoExpediente,
      persona_id: solicitanteId,
      expediente_id: expedienteId,
      movimiento_id: movimientoId,
      documento_id: documentoFirmadoId || datos.documento_respuesta_id || null,
      cvd: cvdFirmado || null,
      asunto: `Resolución de Trámite: ${codigoExpediente}`,
      tipo_acto: 'RESOLUCION',
      subtipo: 'RESOLUCION_FIRMADA',
      resultado_resumen: datos.resultado_resumen,
      documento_url: documentoFirmadoId ? `/expedientes/${expedienteId}` : null,
      identidad: {
        expediente_id: expedienteId,
        movimiento_id: movimientoId,
        codigo_expediente: codigoExpediente,
        persona_id: solicitanteId,
      },
      contexto: { usuario_actor_id: usuarioActorId, area_contexto_id: areaActual },
      datos_especificos: {
        resultado_resumen: datos.resultado_resumen,
        subtipo: 'RESOLUCION_FIRMADA',
        cut: codigoExpediente,
        persona_id: solicitanteId,
      },
    },
  });

  return { movimiento_id: movimientoId, estado: 'RESUELTO' };
}

export async function atenderExpediente(
  cliente: PoolClient,
  expedienteId: string,
  datos: AtenderExpedienteDTO,
): Promise<void> {
  const contexto = getRequestContext();
  const usuarioActorId = contexto?.usuario_id;

  if (!usuarioActorId) {
    throw new UnauthorizedError({ detail: 'No se encontró usuario en el contexto para registrar la atención.' });
  }

  // FASE 5K.1 / INVARIANTE GLOBAL DE RESOLUCIÓN (§19, §20, §21, §22 / TC-5K-11, TC-5K-12):
  // Es imposible que cualquier endpoint lleve un expediente a RESUELTO sin satisfacer:
  // estado previo = EN_FIRMA + evidencia de firma válida según contrato 5I.
  // Queda prohibido producir RESUELTO sin firma o fabricar resoluciones en PDF mock.
  const resEstadoActual = await cliente.query<{
    estado_actual_id: string;
    area_contexto_id: string;
    codigo_expediente: string;
    solicitante_id: string;
    tipo_documental_id: string;
  }>(
    `SELECT
      COALESCE(u.estado_nuevo, e.estado, 'REGISTRADO') AS estado_actual_id,
      COALESCE(u.area_actual_id, e.area_destino_id::text, '') AS area_contexto_id,
      e.codigo_expediente,
      e.solicitante_id::text AS solicitante_id,
      e.tipo_documental_id::text AS tipo_documental_id
    FROM sigd_tra.expediente e
    LEFT JOIN sigd_rut.estado_actual_expediente u ON u.expediente_id = e.expediente_id
    WHERE e.expediente_id = $1::uuid`,
    [expedienteId],
  );

  if (resEstadoActual.rowCount === 0) {
    throw new NotFoundError({ detail: 'El expediente no existe o no tiene estado actual.' });
  }

  const { estado_actual_id: estadoActual } = resEstadoActual.rows[0];

  if (estadoActual !== 'EN_FIRMA') {
    throw new DomainError({
      code: 'FLUJO_RESOLUTIVO_REQUIERE_FIRMA',
      message: `FLUJO_RESOLUTIVO_REQUIERE_FIRMA: El expediente en estado ${estadoActual} no puede ser resuelto directamente mediante /atender. Todo expediente resolutivo requiere pase formal a EN_FIRMA y firma digital válida (Fase 5I). Use el endpoint /resolver.`,
    });
  }

  // Si está formalmente en EN_FIRMA, delega a resolverExpedienteConFirma para validar evidencia 5I
  await resolverExpedienteConFirma(cliente, expedienteId, datos);
}

/**
 * Servicio de Archivado Formal (T-BE-RD-08).
 * Mapea la acción al estado 'ARCHIVADO' desde 'RESUELTO', registrando ubicación física.
 */
export async function archivarExpediente(
  cliente: PoolClient,
  expedienteId: string,
  datos: ArchivarExpedienteDTO,
): Promise<void> {
  const contexto = getRequestContext();
  const usuarioActorId = contexto?.usuario_id;

  if (!usuarioActorId) {
    throw new UnauthorizedError({ detail: 'No se encontró usuario en el contexto para registrar el archivado.' });
  }

  const resEstadoActual = await cliente.query<{
    estado_actual_id: string;
    area_contexto_id: string;
    codigo_expediente: string;
  }>(
    `SELECT
      COALESCE(u.estado_nuevo, e.estado, 'REGISTRADO') AS estado_actual_id,
      COALESCE(u.area_actual_id, e.area_destino_id::text, '') AS area_contexto_id,
      e.codigo_expediente
    FROM sigd_tra.expediente e
    LEFT JOIN sigd_rut.estado_actual_expediente u ON u.expediente_id = e.expediente_id
    WHERE e.expediente_id = $1::uuid`,
    [expedienteId]
  );

  if (resEstadoActual.rowCount === 0) {
    throw new NotFoundError({ detail: 'El expediente no existe o no tiene estado actual.' });
  }

  const {
    estado_actual_id: estadoActual,
    area_contexto_id: areaActualExpediente,
  } = resEstadoActual.rows[0];

  if (estadoActual !== 'RESUELTO') {
    throw new DomainError({
      code: 'ESTADO_INVALIDO',
      message: `El expediente en estado ${estadoActual} no puede ser archivado. Solo se pueden archivar expedientes en estado RESUELTO.`,
    });
  }

  const operadorId = resolverOperadorBigInt(usuarioActorId);

  const datosMovimiento = {
    estante: datos.estante,
    balda: datos.balda,
    caja: datos.caja,
    observaciones: datos.observaciones || null,
    detalle: `Archivado físico formal en Estante: ${datos.estante}, Balda: ${datos.balda}, Caja: ${datos.caja}`,
  };

  const resMovimiento = await cliente.query<{ movimiento_id: string }>(
    `INSERT INTO sigd_rut.movimiento_tramite (
      expediente_id,
      estado_anterior,
      evento,
      estado_nuevo,
      usuario_operador_id,
      clave_idempotencia,
      datos
    ) VALUES (
      $1::uuid,
      'RESUELTO',
      'CIERRE',
      'ARCHIVADO',
      $2::bigint,
      $3,
      $4::jsonb
    ) RETURNING id_movimiento AS movimiento_id`,
    [
      expedienteId,
      operadorId,
      randomUUID(),
      JSON.stringify(datosMovimiento),
    ]
  );

  const movimientoId = resMovimiento.rows[0].movimiento_id;

  const updateRes = await cliente.query(
    `UPDATE sigd_tra.expediente
        SET estado = 'ARCHIVADO'
      WHERE expediente_id = $1::uuid
        AND estado = 'RESUELTO'`,
    [expedienteId],
  );

  if ((updateRes?.rowCount ?? 0) !== 1) {
    throw new ConflictError({
      code: 'CONCURRENCY_CONFLICT_EXPEDIENTE_MUTATION',
      message: `No se pudo actualizar el estado a ARCHIVADO para el expediente ${expedienteId}.`,
    });
  }

  await insertarEvento(cliente, {
    agregado: 'Expediente',
    tipo_evento: 'ExpedienteArchivado',
    payload: {
      identidad: { expediente_id: expedienteId, movimiento_id: movimientoId },
      contexto: { usuario_actor_id: usuarioActorId, area_contexto_id: areaActualExpediente },
      datos_especificos: {
        estante: datos.estante,
        balda: datos.balda,
        caja: datos.caja,
        observaciones: datos.observaciones,
      },
    },
  });
}

/**
 * Servicio de Observación Formal (RutaDoc FSM y LPAG).
 * Mapea la acción al estado 'OBSERVADO', pausando el cómputo de SLA.
 */
export async function observarExpediente(
  cliente: PoolClient,
  expedienteId: string,
  motivo: string,
  opciones?: {
    personaId?: string;
    areaId?: string;
    requisitosAfectados?: string[];
  }
): Promise<void> {
  const contexto = getRequestContext();
  const usuarioActorId = contexto?.usuario_id;

  if (!usuarioActorId) {
    throw new UnauthorizedError({ detail: 'No se encontró usuario en el contexto para registrar la observación.' });
  }

  const resEstadoActual = await cliente.query<{
    estado_actual_id: string;
    area_contexto_id: string;
    codigo_expediente: string;
    solicitante_id: string;
  }>(`
    SELECT
      COALESCE(u.estado_nuevo, e.estado, 'REGISTRADO') AS estado_actual_id,
      COALESCE(u.area_actual_id, e.area_destino_id::text, '') AS area_contexto_id,
      e.codigo_expediente,
      e.solicitante_id::text AS solicitante_id
    FROM sigd_tra.expediente e
    LEFT JOIN sigd_rut.estado_actual_expediente u ON u.expediente_id = e.expediente_id
    WHERE e.expediente_id = $1::uuid
  `, [expedienteId]);

  if (resEstadoActual.rowCount === 0) {
    throw new NotFoundError({ detail: 'El expediente no existe o no tiene estado actual.' });
  }

  const {
    estado_actual_id: estadoActual,
    area_contexto_id: areaOrigenId,
    codigo_expediente: codigoExpediente,
    solicitante_id: solicitanteId,
  } = resEstadoActual.rows[0];

  const estadosPermitidosObservacion = ['REGISTRADO', 'RECEPCIONADO', 'EN_CALIFICACION', 'DERIVADO', 'EN_REVISION'];
  if (!estadosPermitidosObservacion.includes(estadoActual)) {
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
    requisitosAfectados: opciones?.requisitosAfectados ?? [],
    slaPaused: true,
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

  const updateRes = await cliente.query(
    `UPDATE sigd_tra.expediente
        SET estado = 'OBSERVADO'
      WHERE expediente_id = $1::uuid
        AND estado IN ('REGISTRADO', 'RECEPCIONADO', 'EN_CALIFICACION', 'DERIVADO', 'EN_REVISION')`,
    [expedienteId],
  );
  if ((updateRes?.rowCount ?? 0) !== 1) {
    throw new ConflictError({
      code: 'CONCURRENCY_CONFLICT_EXPEDIENTE_MUTATION',
      message: `No se pudo actualizar el estado a OBSERVADO para el expediente ${expedienteId}.`,
    });
  }

  // Registrar observación estructurada en sigd_rut.expediente_observacion
  if (opciones && (opciones.personaId || (opciones.requisitosAfectados && opciones.requisitosAfectados.length > 0))) {
    try {
      const obsSvc = new ExpedienteObservacionService(cliente as any);
      const personaId = opciones.personaId ?? usuarioActorId;

      await obsSvc.registrarObservacion(
        {
          expedienteId,
          motivo,
          requisitosAfectados: opciones.requisitosAfectados,
          usuarioId: usuarioActorId,
          personaId,
          areaId: areaOrigenId || opciones.areaId || '00000000-0000-0000-0000-000000000000',
          estadoAnterior: estadoActual,
          idMovimientoObservacion: movimientoId,
        },
        cliente,
      );
    } catch {
      // Registro estructurado auxiliar
    }
  }

  await insertarEvento(cliente, {
    agregado: 'Expediente',
    tipo_evento: 'ExpedienteObservado',
    payload: {
      cut: codigoExpediente,
      persona_id: solicitanteId,
      expediente_id: expedienteId,
      movimiento_id: movimientoId,
      asunto: `Observación de Trámite: ${codigoExpediente}`,
      tipo_acto: 'NOTIFICACION_OBSERVACION',
      motivo,
      requisitos_afectados: opciones?.requisitosAfectados ?? [],
      identidad: {
        expediente_id: expedienteId,
        movimiento_id: movimientoId,
        codigo_expediente: codigoExpediente,
        persona_id: solicitanteId,
      },
      contexto: { usuario_actor_id: usuarioActorId, area_contexto_id: areaOrigenId },
      datos_especificos: {
        motivo,
        cut: codigoExpediente,
        persona_id: solicitanteId,
        slaPaused: true,
        ...(opciones?.requisitosAfectados && opciones.requisitosAfectados.length > 0
          ? { requisitosAfectados: opciones.requisitosAfectados }
          : {}),
      },
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
  motivo: string,
  opciones?: {
    personaId?: string;
  }
): Promise<void> {
  const contexto = getRequestContext();
  const usuarioActorId = contexto?.usuario_id;

  if (!usuarioActorId) {
    throw new UnauthorizedError({ detail: 'No se encontró usuario en el contexto para registrar la subsanación.' });
  }

  const resEstadoActual = await cliente.query<{
    estado_actual_id: string;
    area_contexto_id: string;
    codigo_expediente: string;
    solicitante_id: string;
  }>(`
    SELECT
      COALESCE(u.estado_nuevo, e.estado, 'REGISTRADO') AS estado_actual_id,
      COALESCE(u.area_actual_id, e.area_destino_id::text, '') AS area_contexto_id,
      e.codigo_expediente,
      e.solicitante_id::text AS solicitante_id
    FROM sigd_tra.expediente e
    LEFT JOIN sigd_rut.estado_actual_expediente u ON u.expediente_id = e.expediente_id
    WHERE e.expediente_id = $1::uuid
  `, [expedienteId]);

  if (resEstadoActual.rowCount === 0) {
    throw new NotFoundError({ detail: 'El expediente no existe o no tiene estado actual.' });
  }

  const {
    estado_actual_id: estadoActual,
    area_contexto_id: areaOrigenId,
    codigo_expediente: codigoExpediente,
    solicitante_id: solicitanteId,
  } = resEstadoActual.rows[0];

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

  const updateRes = await cliente.query(
    `UPDATE sigd_tra.expediente
        SET estado = 'EN_REVISION'
      WHERE expediente_id = $1::uuid
        AND estado = 'OBSERVADO'`,
    [expedienteId],
  );
  if ((updateRes?.rowCount ?? 0) !== 1) {
    throw new ConflictError({
      code: 'CONCURRENCY_CONFLICT_EXPEDIENTE_MUTATION',
      message: `No se pudo actualizar el estado a EN_REVISION para el expediente ${expedienteId}.`,
    });
  }

  // Actualizar observación en sigd_rut.expediente_observacion
  if (opciones && opciones.personaId) {
    try {
      const obsSvc = new ExpedienteObservacionService(cliente as any);
      await obsSvc.subsanarObservacion(
        {
          expedienteId,
          motivo,
          usuarioId: usuarioActorId,
          personaId: opciones.personaId,
          idMovimientoSubsanacion: movimientoId,
        },
        cliente,
      );
    } catch {
      // Si no había observación estructurada, no falla
    }
  }

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
