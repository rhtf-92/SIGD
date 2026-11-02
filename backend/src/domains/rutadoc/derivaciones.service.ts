import type { PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import { getRequestContext } from '../../shared/request-context/request-context.js';
import { insertarEvento } from '../../audit/evento-outbox.repository.js';
import { UnauthorizedError, NotFoundError, DomainError, ForbiddenError, ConflictError } from '../../shared/domain/errors/index.js';
import type { DerivarExpedienteDTO } from './dto/derivarExpediente.dto.js';
import type { ArchivarExpedienteDTO } from './dto/archivarExpediente.dto.js';
import type { AtenderExpedienteDTO } from './dto/atenderExpediente.dto.js';
import { documentoStorageService } from '../../core/storage/documento-storage.service.js';

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
    [expedienteId]
  );

  if (resEstadoActual.rowCount === 0) {
    throw new NotFoundError({ detail: 'El expediente no existe o no tiene estado actual.' });
  }

  const {
    estado_actual_id: estadoActual,
    area_contexto_id: areaActualExpediente,
    codigo_expediente: codigoExpediente,
    solicitante_id: solicitanteId,
    tipo_documental_id: tipoDocumentalId,
  } = resEstadoActual.rows[0];

  const operadorId = resolverOperadorBigInt(usuarioActorId);

  // Si está en DERIVADO, auto-recepcionamos primero
  if (estadoActual === 'DERIVADO') {
    await cliente.query(
      `INSERT INTO sigd_rut.movimiento_tramite (
        expediente_id, estado_anterior, evento, estado_nuevo, usuario_operador_id, datos
      ) VALUES ($1::uuid, 'DERIVADO', 'RECEPCION', 'EN_REVISION', $2::bigint, $3::jsonb)`,
      [expedienteId, operadorId, JSON.stringify({ detalle: 'Recepción previa a atención resolutiva' })]
    );
  } else if (estadoActual !== 'EN_REVISION') {
    throw new DomainError({
      code: 'ESTADO_INVALIDO',
      message: `El expediente en estado ${estadoActual} no puede ser atendido. Se requiere estado EN_REVISION o DERIVADO.`,
    });
  }

  // 1. Paso FSM: EN_REVISION -> ENVIAR_A_FIRMA -> EN_FIRMA
  await cliente.query(
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
    )`,
    [
      expedienteId,
      operadorId,
      randomUUID(),
      JSON.stringify({
        detalle: 'Pase a validación y emisión de resolución',
        resultado_resumen: datos.resultado_resumen,
        observacion_interna: datos.observacion_interna || null,
      }),
    ]
  );

  // 2. Paso FSM: EN_FIRMA -> FIRMA -> RESUELTO
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
        detalle: 'Atención resolutiva aprobada y emitida',
        resultado_resumen: datos.resultado_resumen,
        observacion_interna: datos.observacion_interna || null,
        documento_respuesta_id: datos.documento_respuesta_id || null,
        nombre_archivo: datos.nombre_archivo || null,
      }),
    ]
  );

  const movimientoId = resMovimiento.rows[0].movimiento_id;

  // Actualizar estado en sigd_tra.expediente a RESUELTO
  const updateRes = await cliente.query(
    `UPDATE sigd_tra.expediente
        SET estado = 'RESUELTO'
      WHERE expediente_id = $1::uuid
        AND estado IN ('EN_REVISION', 'DERIVADO', 'EN_FIRMA')`,
    [expedienteId],
  );

  if ((updateRes?.rowCount ?? 0) !== 1) {
    throw new ConflictError({
      code: 'CONCURRENCY_CONFLICT_EXPEDIENTE_MUTATION',
      message: `No se pudo actualizar el estado a RESUELTO para el expediente ${expedienteId}.`,
    });
  }

  // Persistir documento PDF de respuesta en sigd_doc.documento_adjunto
  let documentoUrl: string | null = null;
  let hashDocRespuesta: string | null = null;

  // CASO 1: Si el cliente envía documento_respuesta_id, verificar ownership estricto
  if (datos.documento_respuesta_id) {
    const docExistenteRes = await cliente.query<{
      documento_adjunto_id: string;
      expediente_tra_id: string | null;
      expediente_id: string | null;
      s3_bucket: string;
      s3_key: string;
      sha256: string;
      tamano_bytes: number;
    }>(
      `SELECT documento_adjunto_id, expediente_tra_id, expediente_id, s3_bucket, s3_key, sha256, tamano_bytes
         FROM sigd_doc.documento_adjunto
        WHERE documento_adjunto_id = $1::uuid`,
      [datos.documento_respuesta_id],
    );
    const docRow = docExistenteRes.rows[0];
    if (!docRow) {
      throw new NotFoundError({ detail: 'DOCUMENTO_NO_ENCONTRADO: El documento de respuesta especificado no existe.' });
    }
    // REGLA: Ownership estricto server-side. El documento DEBE pertenecer al expediente actual.
    if (docRow.expediente_tra_id !== expedienteId && docRow.expediente_id !== expedienteId) {
      throw new ForbiddenError({
        code: 'DOCUMENTO_NO_PERTENECE_EXPEDIENTE',
        detail: 'DOCUMENTO_NO_PERTENECE_EXPEDIENTE: El documento especificado no pertenece al expediente actual.',
      });
    }

    hashDocRespuesta = docRow.sha256;
    documentoUrl = `/api/v1/storage/download/${docRow.s3_bucket}/${docRow.s3_key}`;
  } else {
    // CASO 2: Generación oficial server-side. El backend SIEMPRE genera la resolución y su clave canónica.
    // NUNCA se confía en s3_key enviado por el cliente (se ignora cualquier s3_key del cliente).
    const s3KeyResolucion = documentoStorageService.generarKeyResolucion(expedienteId);
    const resolucionBuffer = await documentoStorageService.generarResolucionPdf({
      cut: codigoExpediente,
      fechaHora: new Date(),
      administrado: solicitanteId,
      resultadoResumen: datos.resultado_resumen,
      observacionInterna: datos.observacion_interna || null,
      operador: usuarioActorId,
      area: areaActualExpediente || 'Subdirección Académica',
    });

    const verificado = await documentoStorageService.subirDocumentoPdf({
      s3Key: s3KeyResolucion,
      buffer: resolucionBuffer,
      bucket: documentoStorageService.canonicalBucket,
    });

    const docId = randomUUID();
    const nombreArchivo = datos.nombre_archivo || 'Resolucion_Respuesta.pdf';
    hashDocRespuesta = verificado.sha256;
    documentoUrl = `/api/v1/storage/download/${verificado.s3Bucket}/${verificado.s3Key}`;

    await cliente.query(
      `INSERT INTO sigd_doc.documento_adjunto (
        documento_adjunto_id,
        expediente_tra_id,
        tipo_documental_id,
        nombre_archivo,
        s3_bucket,
        s3_key,
        sha256,
        tamano_bytes,
        mime_type,
        magic_bytes,
        subido_por,
        creado_en
      ) VALUES (
        $1::uuid,
        $2::uuid,
        $3::uuid,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        '25504446',
        $10::uuid,
        now()
      )`,
      [
        docId,
        expedienteId,
        tipoDocumentalId,
        nombreArchivo,
        verificado.s3Bucket,
        verificado.s3Key,
        verificado.sha256,
        verificado.tamanoBytes,
        datos.mime_type || 'application/pdf',
        usuarioActorId,
      ],
    );
  }

  // Notificación a la Casilla Electrónica del Ciudadano (sigd_auth.notificacion_casilla)
  if (solicitanteId) {
    let usuarioDestinatarioId: string | null = null;
    let correoDestinatario: string | null = null;
    try {
      const resUsuario = await cliente.query<{ id_usuario: string }>(
        `SELECT id_usuario::text AS id_usuario
           FROM sigd_auth.cuenta_usuario
          WHERE id_persona = $1::uuid OR id_usuario = $1::uuid
          LIMIT 1`,
        [solicitanteId]
      );
      if (resUsuario?.rows?.[0]?.id_usuario) {
        usuarioDestinatarioId = resUsuario.rows[0].id_usuario;
      }
    } catch {
      usuarioDestinatarioId = null;
    }

    try {
      const resPersona = await cliente.query<{ correo: string | null }>(
        `SELECT COALESCE(pn.correo, u.correo) AS correo
           FROM sigd_auth.persona p
           LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = p.id_persona
           LEFT JOIN sigd_auth.cuenta_usuario u ON u.id_persona = p.id_persona
          WHERE p.id_persona = $1::uuid
          LIMIT 1`,
        [solicitanteId]
      );
      if (resPersona?.rows?.[0]?.correo) {
        correoDestinatario = resPersona.rows[0].correo;
      }
    } catch {
      correoDestinatario = null;
    }

    const cuerpoJson = JSON.stringify({
      resumen: datos.resultado_resumen,
      expediente: codigoExpediente,
      fecha: new Date().toISOString(),
      observacion: datos.observacion_interna || undefined,
    });

    await cliente.query(
      `INSERT INTO sigd_auth.notificacion_casilla (
        id,
        usuario_id,
        correo_destinatario,
        cut,
        asunto,
        tipo_acto,
        numero_documento,
        cuerpo,
        referencia,
        estado,
        fecha_deposito,
        hash_sha256,
        documento_url,
        creado_en
      ) VALUES (
        gen_random_uuid(),
        $1::uuid,
        $2,
        $3,
        $4,
        'RESOLUCION',
        $5,
        $6::jsonb,
        $7,
        'NO_LEIDO',
        now(),
        $8,
        $9,
        now()
      )`,
      [
        usuarioDestinatarioId,
        correoDestinatario,
        codigoExpediente,
        `Resolución de Trámite: ${codigoExpediente}`,
        `RES-${codigoExpediente}`,
        cuerpoJson,
        `Atención realizada por ${areaActualExpediente || 'Subdirección Académica'}`,
        hashDocRespuesta || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        documentoUrl || `/expedientes/${expedienteId}`,
      ]
    );
  }

  // Evento Outbox
  await insertarEvento(cliente, {
    agregado: 'Expediente',
    tipo_evento: 'ExpedienteAtendido',
    payload: {
      identidad: { expediente_id: expedienteId, movimiento_id: movimientoId },
      contexto: { usuario_actor_id: usuarioActorId, area_contexto_id: areaActualExpediente },
      datos_especificos: {
        resultado_resumen: datos.resultado_resumen,
        observacion_interna: datos.observacion_interna,
        documento_respuesta_id: datos.documento_respuesta_id,
        codigo_expediente: codigoExpediente,
      },
    },
  });
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
