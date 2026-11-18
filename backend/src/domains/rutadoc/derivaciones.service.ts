import type { PoolClient, Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { getRequestContext } from '../../shared/request-context/request-context.js';
import { insertarEvento } from '../../audit/evento-outbox.repository.js';
import { UnauthorizedError, NotFoundError, DomainError, ForbiddenError, ConflictError } from '../../shared/domain/errors/index.js';
import type { DerivarExpedienteDTO } from './dto/derivarExpediente.dto.js';
import type { ArchivarExpedienteDTO } from './dto/archivarExpediente.dto.js';
import type { AtenderExpedienteDTO } from './dto/atenderExpediente.dto.js';
import { documentoStorageService } from '../../core/storage/documento-storage.service.js';
import { obtenerConfiguracionS3 } from '../../config/s3.config.js';
import { ExpedienteAsignacionService } from './expedienteAsignacion.service.js';
import { ExpedienteObservacionService } from './expedienteObservacion.service.js';
import { verificarFacultadFirma } from '../../core/auth/auth.guard.js';
import type { ActorRutaDoc } from './rutadoc.types.js';

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

export interface EstadoEtapaTecnicaExpediente {
  requiereEvaluacionTecnica: boolean;
  tieneAsignacion: boolean;
  tieneDictamenTecnico: boolean;
  completada: boolean;
  areaResponsableId: string | null;
  areaResolutivaId: string | null;
  areaActualId: string | null;
}

/**
 * Evalúa si un expediente con procedimiento TUPA de etapa técnica intermedia
 * (unidad responsable != unidad resolutiva, ej. SDA != DIR) cuenta con
 * asignación formal y dictamen técnico completado en workflow_instancia.
 */
export async function verificarEvidenciaEtapaTecnica(
  db: Pool | PoolClient,
  expedienteId: string,
): Promise<{ tieneAsignacion: boolean; tieneDictamenTecnico: boolean; completada: boolean }> {
  const res = await db.query<{
    tiene_asignacion: boolean;
    historial_pasos: any;
  }>(
    `SELECT
       EXISTS (
         SELECT 1
           FROM sigd_rut.expediente_asignacion ea
          WHERE ea.expediente_id = $1::uuid
       ) AS tiene_asignacion,
       (
         SELECT wi.historial_pasos
           FROM sigd_rut.workflow_instancia wi
          WHERE wi.expediente_id = $1::uuid
          LIMIT 1
       ) AS historial_pasos`,
    [expedienteId],
  );
  const row = res.rows[0];
  const tieneAsignacion = Boolean(row?.tiene_asignacion);
  const historial = row?.historial_pasos ?? [];
  const tieneDictamenTecnico =
    Array.isArray(historial) &&
    historial.some((h: any) => h?.evento === 'ATENCION_TECNICA' || h?.evento === 'ATENCION');

  return {
    tieneAsignacion,
    tieneDictamenTecnico,
    completada: tieneAsignacion && tieneDictamenTecnico,
  };
}

export async function consultarEstadoEtapaTecnicaTupa(
  db: Pool | PoolClient,
  expedienteId: string,
): Promise<EstadoEtapaTecnicaExpediente> {
  const resWf = await db.query<{
    unidad_responsable_id: string | null;
    unidad_resolutiva_id: string | null;
    area_actual_id: string | null;
  }>(
    `SELECT
       COALESCE(tp.unidad_responsable_id, v.unidad_responsable_id)::text AS unidad_responsable_id,
       COALESCE(tp.unidad_resolutiva_id, v.unidad_resolutiva_id, (SELECT area_id FROM sigd_org.area WHERE codigo = 'DIR'))::text AS unidad_resolutiva_id,
       COALESCE(u.area_actual_id, e.area_destino_id::text) AS area_actual_id
     FROM sigd_tra.expediente e
     LEFT JOIN sigd_rut.estado_actual_expediente u ON u.expediente_id = e.expediente_id
     LEFT JOIN sigd_doc.expediente_tupa_vinculo v ON v.expediente_id = e.expediente_id AND v.reemplaza_vinculo_id IS NULL
     LEFT JOIN sigd_doc.tupa_procedimiento tp ON tp.registro_version_id = v.registro_version_id
     WHERE e.expediente_id = $1::uuid
     ORDER BY v.vinculado_en DESC NULLS LAST
     LIMIT 1`,
    [expedienteId],
  );
  if (resWf.rows.length === 0) {
    return {
      requiereEvaluacionTecnica: false,
      tieneAsignacion: false,
      tieneDictamenTecnico: false,
      completada: true,
      areaResponsableId: null,
      areaResolutivaId: null,
      areaActualId: null,
    };
  }
  const w = resWf.rows[0];
  const requiereEvaluacionTecnica = Boolean(
    w.unidad_responsable_id &&
    w.unidad_resolutiva_id &&
    w.unidad_responsable_id !== w.unidad_resolutiva_id,
  );
  if (!requiereEvaluacionTecnica) {
    return {
      requiereEvaluacionTecnica: false,
      tieneAsignacion: false,
      tieneDictamenTecnico: false,
      completada: true,
      areaResponsableId: w.unidad_responsable_id,
      areaResolutivaId: w.unidad_resolutiva_id,
      areaActualId: w.area_actual_id,
    };
  }
  const evidencia = await verificarEvidenciaEtapaTecnica(db, expedienteId);
  return {
    requiereEvaluacionTecnica: true,
    tieneAsignacion: evidencia.tieneAsignacion,
    tieneDictamenTecnico: evidencia.tieneDictamenTecnico,
    completada: evidencia.completada,
    areaResponsableId: w.unidad_responsable_id,
    areaResolutivaId: w.unidad_resolutiva_id,
    areaActualId: w.area_actual_id,
  };
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
      CASE WHEN e.estado = 'PENDIENTE_PAGO' THEN 'PENDIENTE_PAGO' ELSE COALESCE(u.estado_nuevo, e.estado, 'REGISTRADO') END AS estado_actual_id,
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

  const estadosPermitidosDerivacion = ['REGISTRADO', 'RECEPCIONADO', 'EN_CALIFICACION', 'DERIVADO', 'EN_REVISION'];
  if (!estadosPermitidosDerivacion.includes(estadoActual)) {
    throw new DomainError({
      code: 'ESTADO_INVALIDO',
      message: `El expediente en estado ${estadoActual} no puede ser derivado.${
        estadoActual === 'SUBSANADO' ? ' Debe iniciar formalmente la revisión institucional antes de derivarlo.' : ''
      }`,
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
  }

  // 4. Procesar cada destino e insertar movimiento append-only
  for (const destino of datos.destinos) {
    const esCorreccion = Boolean(datos.es_correccion || datos.motivo === 'CORRECCION_DERIVACION');
    // La FK sigd_rut.fk_movimiento_transicion exige el evento canónico 'DERIVACION';
    // el carácter correctivo queda auditado en datos.es_correccion, workflow y outbox.
    const eventoMov = 'DERIVACION';
    const claveMov = datos.clave_idempotencia || randomUUID();

    const datosMovimiento = {
      areaId: destino.area_destino_id,
      areaOrigenId: areaOrigenId || null,
      proveido: datos.proveido,
      motivo: datos.proveido,
      es_copia: destino.es_copia,
      es_correccion: esCorreccion,
      justificacion_desviacion: datos.justificacion_desviacion ?? null,
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
    actor_unidad_organica_id?: string | null;
    actor_roles?: readonly string[] | string[];
    exigir_custodia?: boolean;
    actor_id?: string | null;
    actor_id_persona?: string | null;
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
    unidad_responsable_id?: string | null;
    unidad_resolutiva_id?: string | null;
  }>(
    `SELECT
      COALESCE(u.estado_nuevo, e.estado, 'REGISTRADO') AS estado_actual_id,
      COALESCE(u.area_actual_id, e.area_destino_id::text, '') AS area_contexto_id,
      e.codigo_expediente,
      e.solicitante_id::text AS solicitante_id,
      COALESCE(tp.unidad_responsable_id, v.unidad_responsable_id) AS unidad_responsable_id,
      COALESCE(tp.unidad_resolutiva_id, v.unidad_resolutiva_id, (SELECT area_id FROM sigd_org.area WHERE codigo = 'DIR')) AS unidad_resolutiva_id
    FROM sigd_tra.expediente e
    LEFT JOIN sigd_rut.estado_actual_expediente u ON u.expediente_id = e.expediente_id
    LEFT JOIN sigd_doc.expediente_tupa_vinculo v ON v.expediente_id = e.expediente_id AND v.reemplaza_vinculo_id IS NULL
    LEFT JOIN sigd_doc.tupa_procedimiento tp ON tp.registro_version_id = v.registro_version_id
    WHERE e.expediente_id = $1::uuid`,
    [expedienteId],
  );

  if (resEstadoActual.rowCount === 0) {
    throw new NotFoundError({ detail: 'El expediente no existe o no tiene estado actual.' });
  }

  const {
    estado_actual_id: estadoActual,
    area_contexto_id: areaActual,
    solicitante_id: solicitanteId,
    unidad_responsable_id: areaResponsable,
    unidad_resolutiva_id: areaResolutivaRaw,
  } = resEstadoActual.rows[0];
  const operadorId = resolverOperadorBigInt(usuarioActorId);
  const areaResolutiva = areaResolutivaRaw || 'a0000000-0000-0000-0000-000000000002';

  if (datos.exigir_custodia) {
    if (
      solicitanteId &&
      ((datos.actor_id_persona && datos.actor_id_persona === solicitanteId) ||
        (datos.actor_id && datos.actor_id === solicitanteId) ||
        usuarioActorId === solicitanteId)
    ) {
      throw new ForbiddenError({
        code: 'CONFLICTO_INTERES_EXPEDIENTE_PROPIO',
        detail: 'AUTOATENCION_PROHIBIDA: El solicitante no puede elevar a firma su propio expediente.',
      });
    }

    const enAreaCustodia = Boolean(
      datos.actor_unidad_organica_id && areaActual && datos.actor_unidad_organica_id === areaActual,
    );
    if (!enAreaCustodia) {
      let tieneEncargatura = false;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (areaActual && uuidRegex.test(areaActual) && datos.actor_id && uuidRegex.test(datos.actor_id)) {
        const resEnc = await cliente
          .query(
            `SELECT 1
               FROM sigd_org.responsabilidad_temporal rt
              WHERE (rt.id_usuario = $1::uuid OR ($3::uuid IS NOT NULL AND rt.id_persona = $3::uuid))
                AND rt.area_id = $2::uuid
                AND rt.estado = 'ACTIVO'
                AND rt.tipo_responsabilidad IN ('ENCARGATURA', 'DELEGACION', 'SUPLENCIA', 'DESIGNACION_ESPECIFICA')
                AND rt.vigente_desde <= now()
                AND (rt.vigente_hasta IS NULL OR rt.vigente_hasta > now())
              LIMIT 1`,
            [
              datos.actor_id,
              areaActual,
              datos.actor_id_persona && uuidRegex.test(datos.actor_id_persona) ? datos.actor_id_persona : null,
            ],
          )
          .catch(() => ({ rowCount: 0 }));
        tieneEncargatura = (resEnc.rowCount ?? 0) > 0;
      }
      if (!tieneEncargatura) {
        throw new ForbiddenError({
          code: 'BOLA_VIOLATION_CUSTODIA_AJENA',
          detail: 'No pertenece al área de custodia del expediente para remitirlo a despacho de firma.',
        });
      }
    }
  } else if (datos.actor_unidad_organica_id) {
    if (areaActual && datos.actor_unidad_organica_id !== areaActual) {
      throw new ForbiddenError({
        code: 'BOLA_VIOLATION_CUSTODIA_AJENA',
        detail: 'No pertenece al área de custodia del expediente para remitirlo a despacho de firma.',
      });
    }
  }

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

  // Si el procedimiento tiene un área intermedia responsable técnica diferente de la resolutiva,
  // exigir asignación formal y dictamen técnico completado sin importar en qué área se encuentre actualmente.
  if (areaResponsable && areaResolutiva && areaResponsable !== areaResolutiva) {
    const evidencia = await verificarEvidenciaEtapaTecnica(cliente, expedienteId);
    if (!evidencia.completada) {
      throw new DomainError({
        code: 'ATENCION_TECNICA_REQUERIDA',
        message: !evidencia.tieneAsignacion
          ? 'ATENCION_TECNICA_REQUERIDA: El expediente requiere asignación formal a especialista y dictamen técnico válido en la unidad responsable (SDA) antes de ser elevado a firma.'
          : 'ATENCION_TECNICA_REQUERIDA: El expediente requiere dictamen y evaluación técnica completada en la unidad responsable (SDA) antes de ser enviado a firma de Dirección.',
      });
    }
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
        areaId: areaResolutiva,
        areaOrigenId: areaActual,
      }),
    ],
  );

  const movimientoId = resMov.rows[0]?.movimiento_id || randomUUID();

  const updateRes = await cliente.query(
    `UPDATE sigd_tra.expediente
        SET estado = 'EN_FIRMA',
            area_destino_id = $2::uuid
      WHERE expediente_id = $1::uuid
        AND estado IN ('EN_REVISION', 'DERIVADO')`,
    [expedienteId, areaResolutiva],
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
    unidad_responsable_id?: string | null;
    unidad_resolutiva_id?: string | null;
  }>(
    `SELECT
      COALESCE(u.estado_nuevo, e.estado, 'REGISTRADO') AS estado_actual_id,
      COALESCE(u.area_actual_id, e.area_destino_id::text, '') AS area_contexto_id,
      e.codigo_expediente,
      e.solicitante_id::text AS solicitante_id,
      COALESCE(tp.unidad_responsable_id, v.unidad_responsable_id)::text AS unidad_responsable_id,
      COALESCE(tp.unidad_resolutiva_id, v.unidad_resolutiva_id)::text AS unidad_resolutiva_id
    FROM sigd_tra.expediente e
    LEFT JOIN sigd_rut.estado_actual_expediente u ON u.expediente_id = e.expediente_id
    LEFT JOIN sigd_doc.expediente_tupa_vinculo v ON v.expediente_id = e.expediente_id AND v.reemplaza_vinculo_id IS NULL
    LEFT JOIN sigd_doc.tupa_procedimiento tp ON tp.registro_version_id = v.registro_version_id
    WHERE e.expediente_id = $1::uuid
    ORDER BY v.vinculado_en DESC NULLS LAST
    LIMIT 1`,
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
    unidad_responsable_id: areaResponsableTupa,
    unidad_resolutiva_id: areaResolutivaTupa,
  } = resEstadoActual.rows[0];

  if (estadoActual !== 'EN_FIRMA') {
    throw new DomainError({
      code: 'ESTADO_INVALIDO',
      message: `El expediente en estado ${estadoActual} no puede ser resuelto directamente. Se requiere estado EN_FIRMA con evidencia de firma válida.`,
    });
  }

  if (areaResponsableTupa && areaResolutivaTupa && areaResponsableTupa !== areaResolutivaTupa) {
    const evidencia = await verificarEvidenciaEtapaTecnica(cliente, expedienteId);
    if (!evidencia.completada) {
      throw new DomainError({
        code: 'ATENCION_TECNICA_REQUERIDA',
        message: 'ATENCION_TECNICA_REQUERIDA: No se puede resolver el expediente sin asignación formal y dictamen técnico válido de la unidad responsable.',
      });
    }
  }

  // Comprobar evidencia canónica de firma digital/criptográfica
  let tieneEvidenciaFirma = false;
  let documentoFirmadoId: string | null = null;
  let cvdFirmado: string | null = null;
  let s3KeyFirmado: string | null = null;
  let sha256Firmado: string | null = null;

  // Evidencia 1: Si se especificó documento_respuesta_id, verificar que sea un acto institucional válido
  if (datos.documento_respuesta_id) {
    const resDocResp = await cliente.query<{
      documento_id: string;
      cvd: string | null;
      s3_key?: string | null;
      sha256_firmado?: string | null;
      id_requisito: string | null;
      s3_key_adjunto: string;
    }>(
      `SELECT f.documento_id, f.cvd, f.s3_key, f.sha256_firmado, a.id_requisito, a.s3_key AS s3_key_adjunto
         FROM sigd_doc.firma_digital_documento f
         JOIN sigd_doc.documento_adjunto a ON a.documento_adjunto_id = f.documento_id
        WHERE f.documento_id = $1::uuid
          AND f.estado = 'FIRMADO_DIGITALMENTE'
        LIMIT 1`,
      [datos.documento_respuesta_id],
    );
    if (resDocResp.rowCount && resDocResp.rowCount > 0) {
      const resp = resDocResp.rows[0];
      if (resp.id_requisito !== null || resp.s3_key_adjunto.startsWith('expedientes/')) {
        throw new DomainError({
          code: 'DOCUMENTO_NO_ES_ACTO_RESOLUTIVO',
          message: 'El documento especificado como respuesta corresponde a un recaudo de entrada y no a un acto resolutivo institucional válido.',
        });
      }
      tieneEvidenciaFirma = true;
      documentoFirmadoId = resp.documento_id;
      cvdFirmado = resp.cvd;
      s3KeyFirmado = resp.s3_key ?? resp.s3_key_adjunto ?? null;
      sha256Firmado = resp.sha256_firmado ?? null;
    }
  }

  // Evidencia 2: Registro formal institucional en sigd_doc.firma_digital_documento (excluye recaudos del ciudadano)
  if (!tieneEvidenciaFirma) {
    const resFirmaDoc = await cliente.query<{
      documento_id: string;
      cvd: string | null;
      s3_key?: string | null;
      sha256_firmado?: string | null;
    }>(
      `SELECT f.documento_id, f.cvd, f.s3_key, f.sha256_firmado
         FROM sigd_doc.firma_digital_documento f
         JOIN sigd_doc.documento_adjunto a ON a.documento_adjunto_id = f.documento_id
        WHERE (a.expediente_id = $1::uuid OR a.expediente_tra_id = $1::uuid)
          AND f.estado = 'FIRMADO_DIGITALMENTE'
          AND a.id_requisito IS NULL
          AND NOT (a.s3_key LIKE 'expedientes/%')
        ORDER BY f.fecha_registro DESC
        LIMIT 1`,
      [expedienteId],
    );
    if (resFirmaDoc.rowCount && resFirmaDoc.rowCount > 0) {
      tieneEvidenciaFirma = true;
      documentoFirmadoId = resFirmaDoc.rows[0].documento_id;
      cvdFirmado = resFirmaDoc.rows[0].cvd;
      s3KeyFirmado = resFirmaDoc.rows[0].s3_key ?? null;
      sha256Firmado = resFirmaDoc.rows[0].sha256_firmado ?? null;
    }
  }

  // Evidencia 3: Resolución oficial firmada en sigd_doc.resolucion
  if (!tieneEvidenciaFirma) {
    const resResolucion = await cliente.query<{ resolucion_id: string }>(
      `SELECT resolucion_id
         FROM sigd_doc.resolucion
        WHERE (expediente_id = $1::uuid OR expediente_tra_id = $1::uuid)
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

  // Actualizar resolución institucional a NOTIFICADA si existía en estado FIRMADA
  await cliente.query(
    `UPDATE sigd_doc.resolucion
        SET estado = 'NOTIFICADA'
      WHERE (expediente_tra_id = $1::uuid OR expediente_id = $1::uuid)
        AND estado = 'FIRMADA'`,
    [expedienteId],
  );

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
      sha256: sha256Firmado || null,
      asunto: `Resolución de Trámite: ${codigoExpediente}`,
      tipo_acto: 'RESOLUCION',
      subtipo: 'RESOLUCION_FIRMADA',
      resultado_resumen: datos.resultado_resumen,
      documento_url: s3KeyFirmado || (documentoFirmadoId ? `firmados/${documentoFirmadoId}.pdf` : null),
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
    unidad_responsable_id?: string | null;
    unidad_resolutiva_id?: string | null;
    registro_version_id?: string | null;
  }>(
    `SELECT
      COALESCE(u.estado_nuevo, e.estado, 'REGISTRADO') AS estado_actual_id,
      COALESCE(u.area_actual_id, e.area_destino_id::text, '') AS area_contexto_id,
      e.codigo_expediente,
      e.solicitante_id::text AS solicitante_id,
      e.tipo_documental_id::text AS tipo_documental_id,
      COALESCE(tp.unidad_responsable_id, v.unidad_responsable_id) AS unidad_responsable_id,
      COALESCE(tp.unidad_resolutiva_id, v.unidad_resolutiva_id, (SELECT area_id FROM sigd_org.area WHERE codigo = 'DIR')) AS unidad_resolutiva_id,
      v.registro_version_id
    FROM sigd_tra.expediente e
    LEFT JOIN sigd_rut.estado_actual_expediente u ON u.expediente_id = e.expediente_id
    LEFT JOIN sigd_doc.expediente_tupa_vinculo v ON v.expediente_id = e.expediente_id AND v.reemplaza_vinculo_id IS NULL
    LEFT JOIN sigd_doc.tupa_procedimiento tp ON tp.registro_version_id = v.registro_version_id
    WHERE e.expediente_id = $1::uuid`,
    [expedienteId],
  );

  if (resEstadoActual.rowCount === 0) {
    throw new NotFoundError({ detail: 'El expediente no existe o no tiene estado actual.' });
  }

  const {
    estado_actual_id: estadoActual,
    area_contexto_id: areaActual,
    unidad_responsable_id: areaResponsable,
    unidad_resolutiva_id: areaResolutivaRaw,
    registro_version_id: registroVersionId,
  } = resEstadoActual.rows[0];

  const areaResolutiva = areaResolutivaRaw || 'a0000000-0000-0000-0000-000000000002';
  const esIntermediaTecnica = Boolean(areaResponsable && areaResolutiva && areaResponsable !== areaResolutiva);

  if (estadoActual === 'EN_REVISION' && esIntermediaTecnica) {
    if (areaActual !== areaResponsable) {
      throw new DomainError({
        code: 'AREA_TECNICA_REQUERIDA',
        message: 'El dictamen técnico de este procedimiento debe registrarse en la unidad responsable asignada (SDA), no en Dirección General.',
      });
    }

    const resAsignacion = await cliente.query<{ id_usuario: string }>(
      `SELECT id_usuario::text AS id_usuario
         FROM sigd_rut.expediente_asignacion
        WHERE expediente_id = $1::uuid AND activo = true
        ORDER BY asignado_en DESC
        LIMIT 1`,
      [expedienteId],
    );
    const asignacionActiva = resAsignacion.rows[0];
    if (!asignacionActiva) {
      throw new ForbiddenError({
        code: 'EXPEDIENTE_NO_ASIGNADO_AL_ESPECIALISTA',
        message: 'El expediente no cuenta con asignación formal vigente para registrar dictamen técnico.',
      });
    }
    if (asignacionActiva.id_usuario !== usuarioActorId) {
      throw new ForbiddenError({
        code: 'EXPEDIENTE_NO_ASIGNADO_AL_ESPECIALISTA',
        message: 'Solo el especialista formalmente asignado al expediente puede emitir el dictamen técnico.',
      });
    }

    // 1. Asegurar que existe instancia de workflow inicializada
    const resInstancia = await cliente.query<{ id_instancia: string }>(
      `SELECT id_instancia FROM sigd_rut.workflow_instancia WHERE expediente_id = $1::uuid`,
      [expedienteId],
    );

    if (resInstancia.rows.length === 0 && registroVersionId) {
      const versionWf = await cliente.query<{ id_version: string; total_pasos: number }>(
        `SELECT v.id_version, jsonb_array_length(v.pasos) AS total_pasos
           FROM sigd_rut.workflow_procedimiento_config c
           JOIN sigd_rut.workflow_version v ON v.id_version = c.id_version_workflow
          WHERE (c.id_procedimiento = $1::uuid OR c.id_procedimiento IN (
            SELECT p.id_procedimiento FROM sigd_doc.tupa_procedimiento p WHERE p.registro_version_id = $1::uuid
          )) AND c.activo = true AND v.activo = true LIMIT 1`,
        [registroVersionId],
      );
      if (versionWf.rows.length > 0) {
        await cliente.query(
          `INSERT INTO sigd_rut.workflow_instancia (
            expediente_id, id_version_workflow, paso_actual, total_pasos, estado_instancia
          ) VALUES ($1::uuid, $2::uuid, 4, $3, 'EN_CURSO')
          ON CONFLICT (expediente_id) DO NOTHING`,
          [expedienteId, versionWf.rows[0].id_version, versionWf.rows[0].total_pasos],
        );
      }
    }

    // 2. Registrar atención técnica en historial de workflow
    await cliente.query(
      `UPDATE sigd_rut.workflow_instancia
          SET paso_actual = GREATEST(paso_actual, 4),
              historial_pasos = COALESCE(historial_pasos, '[]'::jsonb) || jsonb_build_array(
                jsonb_build_object(
                  'paso', 4,
                  'evento', 'ATENCION_TECNICA',
                  'usuarioId', $2::text,
                  'areaId', $3::text,
                  'detalle', $4::text,
                  'completadoEn', now()
                )
              )
        WHERE expediente_id = $1::uuid`,
      [expedienteId, usuarioActorId, areaActual, datos.resultado_resumen],
    );

    // 2.1 Si se adjuntó un documento de dictamen técnico / informe, persistirlo en sigd_doc.documento_adjunto
    if (datos.s3_key && datos.sha256 && datos.nombre_archivo) {
      const configS3 = obtenerConfiguracionS3();
      const resTipo = await cliente.query<{ tipo_documental_id: string }>(
        `SELECT tipo_documental_id FROM sigd_doc.tipo_documento
          WHERE vigente = true
          ORDER BY CASE WHEN codigo IN ('INF', 'INFORME', 'DICTAMEN') THEN 0 ELSE 1 END, nombre ASC
          LIMIT 1`,
      );
      const tipoDocId = resTipo.rows[0]?.tipo_documental_id;
      if (tipoDocId) {
        const docId = datos.documento_respuesta_id || randomUUID();
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
             subido_por,
             id_requisito
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
             $10::uuid,
             NULL
           ) ON CONFLICT (documento_adjunto_id) DO NOTHING`,
          [
            docId,
            expedienteId,
            tipoDocId,
            datos.nombre_archivo,
            configS3.bucket,
            datos.s3_key,
            datos.sha256,
            datos.tamano_bytes || 0,
            datos.mime_type || 'application/pdf',
            usuarioActorId,
          ],
        );
      }
    }

    // 3. Emitir evento outbox
    await insertarEvento(cliente, {
      agregado: 'Expediente',
      tipo_evento: 'ExpedienteAtendidoTecnicamente',
      payload: {
        identidad: { expediente_id: expedienteId },
        contexto: { usuario_actor_id: usuarioActorId, area_contexto_id: areaActual },
        datos_especificos: {
          resultado_resumen: datos.resultado_resumen,
          observacion_interna: datos.observacion_interna,
        },
      },
    });

    return;
  }

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
    areaId: areaActualExpediente || null,
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
      CASE WHEN e.estado = 'PENDIENTE_PAGO' THEN 'PENDIENTE_PAGO' ELSE COALESCE(u.estado_nuevo, e.estado, 'REGISTRADO') END AS estado_actual_id,
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

      let areaIdValida = areaOrigenId || opciones.areaId;
      if (!areaIdValida || areaIdValida === '00000000-0000-0000-0000-000000000000') {
        const areaRes = await cliente.query<{ area_id: string }>(
          `SELECT area_id FROM sigd_org.area WHERE codigo = 'DIR' LIMIT 1`,
        );
        areaIdValida = areaRes.rows[0]?.area_id || 'a0000000-0000-0000-0000-000000000002';
      }

      await obsSvc.registrarObservacion(
        {
          expedienteId,
          motivo,
          requisitosAfectados: opciones.requisitosAfectados,
          usuarioId: usuarioActorId,
          personaId,
          areaId: areaIdValida,
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
      CASE WHEN e.estado = 'PENDIENTE_PAGO' THEN 'PENDIENTE_PAGO' ELSE COALESCE(u.estado_nuevo, e.estado, 'REGISTRADO') END AS estado_actual_id,
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

  // FSM formal: OBSERVADO -> CORRECCION -> SUBSANADO
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
      'OBSERVADO',
      'CORRECCION',
      'SUBSANADO',
      $2::bigint,
      $3,
      $4::jsonb
    ) RETURNING id_movimiento AS movimiento_id
  `, [
    expedienteId,
    operadorId,
    randomUUID(),
    JSON.stringify({ motivo, detalle: motivo, areaId: areaOrigenId || null }),
  ]);

  const movimientoId = resMov.rows[0].movimiento_id;

  const updateRes = await cliente.query(
    `UPDATE sigd_tra.expediente
        SET estado = 'SUBSANADO'
      WHERE expediente_id = $1::uuid
        AND estado = 'OBSERVADO'`,
    [expedienteId],
  );
  if ((updateRes?.rowCount ?? 0) !== 1) {
    throw new ConflictError({
      code: 'CONCURRENCY_CONFLICT_EXPEDIENTE_MUTATION',
      message: `No se pudo actualizar el estado a SUBSANADO para el expediente ${expedienteId}.`,
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

/**
 * Servicio de Inicio Formal de Revisión (RutaDoc FSM y LPAG).
 * Mapea la acción formal institucional desde 'SUBSANADO' hacia 'EN_REVISION'.
 */
export async function iniciarRevisionExpediente(
  cliente: PoolClient,
  expedienteId: string,
  motivo?: string,
): Promise<{ movimientoId: string }> {
  const contexto = getRequestContext();
  const usuarioActorId = contexto?.usuario_id;

  if (!usuarioActorId) {
    throw new UnauthorizedError({ detail: 'No se encontró usuario en el contexto para iniciar la revisión.' });
  }

  const resEstadoActual = await cliente.query<{
    estado_actual_id: string;
    area_contexto_id: string;
    codigo_expediente: string;
    solicitante_id: string;
  }>(`
    SELECT
      CASE WHEN e.estado = 'PENDIENTE_PAGO' THEN 'PENDIENTE_PAGO' ELSE COALESCE(u.estado_nuevo, e.estado, 'REGISTRADO') END AS estado_actual_id,
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
  } = resEstadoActual.rows[0];

  if (estadoActual !== 'SUBSANADO') {
    throw new DomainError({
      code: 'ESTADO_INVALIDO',
      message: `Solo se puede iniciar revisión de expedientes en estado SUBSANADO (actual: ${estadoActual}).`,
    });
  }

  const operadorId = resolverOperadorBigInt(usuarioActorId);

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
    JSON.stringify({
      detalle: motivo ?? 'Inicio formal de revisión tras subsanación',
      areaId: areaOrigenId || null,
    }),
  ]);

  const movimientoId = resMov.rows[0].movimiento_id;

  const updateRes = await cliente.query(
    `UPDATE sigd_tra.expediente
        SET estado = 'EN_REVISION'
      WHERE expediente_id = $1::uuid
        AND estado = 'SUBSANADO'`,
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
    tipo_evento: 'ExpedienteRevisionIniciada',
    payload: {
      identidad: { expediente_id: expedienteId, movimiento_id: movimientoId },
      contexto: { usuario_actor_id: usuarioActorId, area_contexto_id: areaOrigenId },
      datos_especificos: { motivo: motivo ?? 'Inicio formal de revisión' },
    },
  });

  return { movimientoId };
}

export interface ElegibilidadDerivacion {
  puedeDerivar: boolean;
  requisitosConformes: boolean;
  pagoConforme: boolean;
  bloqueos: string[];
  totalRequisitosDocumentalesObligatorios: number;
  totalRequisitosDocumentalesConformes: number;
  montoRequerido: number;
  pagoRegistrado: boolean;
}

/**
 * Evalúa centralizadamente la elegibilidad formal para la derivación institucional de un expediente.
 * Regla de Negocio C3.6.2:
 * 1. Todos los requisitos DOCUMENTALES obligatorios y activos de la versión snapshot vinculada al expediente
 *    deben contar con evidencia en estado VALIDADO (o CONFORME).
 * 2. Si el procedimiento arancelado requiere pago, debe contar con al menos una orden de pago en estado CONFIRMADO.
 * 3. Si 0 requisitos documentales obligatorios aplican, el gate documental se considera plenamente satisfecho.
 */
export async function evaluarElegibilidadDerivacion(
  cliente: PoolClient | Pool,
  expedienteId: string,
): Promise<ElegibilidadDerivacion> {
  const bloqueos: string[] = [];

  // 1. Obtener vínculo TUPA del expediente (o snapshot asociado)
  const { rows: vincRows } = await cliente.query<{
    registro_version_id: string;
    id_procedimiento: string | null;
    monto_efectivo: string | null;
    monto_proc: string | null;
    intervencion_financiera: string | null;
  }>(`
    SELECT
      v.registro_version_id,
      p.id_procedimiento,
      v.monto_efectivo,
      p.monto AS monto_proc,
      p.intervencion_financiera
    FROM sigd_doc.expediente_tupa_vinculo v
    LEFT JOIN sigd_doc.tupa_procedimiento p ON p.registro_version_id = v.registro_version_id
    WHERE v.expediente_id = $1::uuid
    ORDER BY v.vinculado_en DESC
    LIMIT 1
  `, [expedienteId]);

  if (vincRows.length === 0) {
    return {
      puedeDerivar: true,
      requisitosConformes: true,
      pagoConforme: true,
      bloqueos: [],
      totalRequisitosDocumentalesObligatorios: 0,
      totalRequisitosDocumentalesConformes: 0,
      montoRequerido: 0,
      pagoRegistrado: true,
    };
  }

  const vinculo = vincRows[0];
  const registroVersionId = vinculo.registro_version_id;
  const idProcedimiento = vinculo.id_procedimiento;

  // 2. Requisitos documentales obligatorios y activos de la versión snapshot exacta
  const { rows: reqDocObligatorios } = await cliente.query<{
    id_requisito: string;
    nombre: string;
    regla_condicional: unknown;
  }>(`
    SELECT r.id_requisito, r.nombre, r.regla_condicional
      FROM sigd_doc.tupa_requisito_documental r
     WHERE (r.registro_version_id = $1::uuid OR (r.registro_version_id IS NULL AND r.id_procedimiento = $2::uuid))
       AND r.tipo_requisito = 'DOCUMENTAL'
       AND r.obligatorio = true
       AND r.activo = true
     ORDER BY r.orden ASC
  `, [registroVersionId, idProcedimiento]);

  const totalObligatorios = reqDocObligatorios.length;
  let totalConformes = 0;
  let requisitosConformes = true;

  if (totalObligatorios > 0) {
    const reqIds = reqDocObligatorios.map((r: { id_requisito: string }) => r.id_requisito);
    const { rows: evidencias } = await cliente.query<{
      id_requisito: string;
      estado_validacion: string;
      creado_en: Date;
    }>(`
      SELECT e.id_requisito, e.estado_validacion, e.creado_en
        FROM sigd_doc.expediente_evidencia_requisito e
       WHERE e.expediente_id = $1::uuid
         AND e.id_requisito = ANY($2::uuid[])
       ORDER BY e.creado_en ASC
    `, [expedienteId, reqIds]);

    const ultimasEvidencias = new Map<string, string>();
    for (const ev of evidencias) {
      ultimasEvidencias.set(ev.id_requisito, ev.estado_validacion);
    }

    for (const req of reqDocObligatorios) {
      const estado = ultimasEvidencias.get(req.id_requisito);
      if (estado === 'VALIDADO' || estado === 'CONFORME') {
        totalConformes++;
      } else {
        requisitosConformes = false;
      }
    }

    if (!requisitosConformes) {
      bloqueos.push('REQUISITOS_DOCUMENTALES_PENDIENTES');
    }
  }

  // 3. Validación financiera (Pago)
  const { rows: reqFinancieros } = await cliente.query<{ id_requisito: string }>(`
    SELECT r.id_requisito
      FROM sigd_doc.tupa_requisito_documental r
     WHERE (r.registro_version_id = $1::uuid OR (r.registro_version_id IS NULL AND r.id_procedimiento = $2::uuid))
       AND r.tipo_requisito = 'FINANCIERO'
       AND r.obligatorio = true
       AND r.activo = true
       AND (r.estado_homologacion = 'HOMOLOGADO' OR r.estado_homologacion IS NULL)
  `, [registroVersionId, idProcedimiento]);

  const montoEfectivo = Number(vinculo.monto_efectivo ?? vinculo.monto_proc ?? 0);
  const exigePago = reqFinancieros.length > 0 || (montoEfectivo > 0 && vinculo.intervencion_financiera === 'REQUIERE_PAGO');

  let pagoConforme = true;
  let pagoRegistrado = false;

  if (exigePago) {
    const { rows: pagosConfirmados } = await cliente.query<{ orden_pago_id: string }>(`
      SELECT orden_pago_id
        FROM sigd_tra.orden_pago
       WHERE expediente_id = $1::uuid
         AND estado = 'CONFIRMADO'
       LIMIT 1
    `, [expedienteId]);

    pagoRegistrado = pagosConfirmados.length > 0;
    if (!pagoRegistrado) {
      pagoConforme = false;
      bloqueos.push('PAGO_PENDIENTE');
    }
  }

  const puedeDerivar = requisitosConformes && pagoConforme;

  return {
    puedeDerivar,
    requisitosConformes,
    pagoConforme,
    bloqueos,
    totalRequisitosDocumentalesObligatorios: totalObligatorios,
    totalRequisitosDocumentalesConformes: totalConformes,
    montoRequerido: montoEfectivo,
    pagoRegistrado,
  };
}

export interface CapacidadAccionDto {
  visible: boolean;
  habilitado: boolean;
  codigo?: string;
  motivo?: string;
}

export interface CapacidadesExpedienteDto {
  derivar: CapacidadAccionDto;
  recepcionar: CapacidadAccionDto;
  observar: CapacidadAccionDto;
  subsanar: CapacidadAccionDto;
  iniciarRevision: CapacidadAccionDto;
  asignar: CapacidadAccionDto;
  atender: CapacidadAccionDto;
  enviarAFirma: CapacidadAccionDto;
  resolver: CapacidadAccionDto;
  archivar: CapacidadAccionDto;
  acumular: CapacidadAccionDto;
}

const AREA_DIR_CANONICA = 'a0000000-0000-0000-0000-000000000002';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Verifica si el actor posee facultad explícita de derivación para el área dada.
 * DIRECTOR, SECRETARIO y MESA_PARTES poseen facultad por rol de despacho/recepción.
 * ESPECIALISTA requiere perfil operativo con EXPEDIENTE_DERIVAR o DELEGACION vigente
 * de tipo DERIVACION/TODAS; pertenecer al área NO otorga facultad de derivación por sí solo.
 */
export async function verificarFacultadDerivacion(
  db: Pool | PoolClient,
  actor: ActorRutaDoc,
  areaActualId: string | null | undefined,
  idPersonaActor?: string | null,
): Promise<boolean> {
  const roles = actor.roles ?? [];
  if (roles.some((r) => ['DIRECTOR', 'SECRETARIO', 'MESA_PARTES'].includes(r))) {
    return true;
  }
  if (!roles.includes('ESPECIALISTA')) {
    return false;
  }
  if (!UUID_REGEX.test(actor.id)) {
    return false;
  }

  const areaParam = areaActualId && UUID_REGEX.test(areaActualId) ? areaActualId : null;
  const personaParam = idPersonaActor && UUID_REGEX.test(idPersonaActor) ? idPersonaActor : null;

  try {
    const resPerfil = await db.query(
      `SELECT 1
         FROM sigd_org.asignacion_perfil_operativo ap
         JOIN sigd_org.perfil_operativo p ON p.perfil_id = ap.perfil_id
         JOIN sigd_org.perfil_permiso pp ON pp.perfil_id = p.perfil_id
         JOIN sigd_org.permiso_sistema ps ON ps.permiso_id = pp.permiso_id
        WHERE ap.id_usuario = $1::uuid
          AND ap.estado = 'ACTIVO'
          AND p.vigente = TRUE
          AND ap.vigente_desde <= now()
          AND (ap.vigente_hasta IS NULL OR ap.vigente_hasta > now())
          AND ps.codigo = 'EXPEDIENTE_DERIVAR'
          AND (ap.scope = 'INSTITUCIONAL' OR $2::uuid IS NULL OR ap.area_id = $2::uuid)
        LIMIT 1`,
      [actor.id, areaParam],
    );
    if ((resPerfil.rowCount ?? 0) > 0) {
      return true;
    }

    const resDelegacion = await db.query(
      `SELECT 1
         FROM sigd_org.responsabilidad_temporal rt
        WHERE (rt.id_usuario = $1::uuid OR ($3::uuid IS NOT NULL AND rt.id_persona = $3::uuid))
          AND rt.estado = 'ACTIVO'
          AND rt.tipo_responsabilidad = 'DELEGACION'
          AND rt.vigente_desde <= now()
          AND (rt.vigente_hasta IS NULL OR rt.vigente_hasta > now())
          AND UPPER(COALESCE(rt.alcance->>'tipoActuacion', '')) IN ('DERIVACION', 'TODAS')
          AND ($2::uuid IS NULL OR rt.area_id = $2::uuid)
        LIMIT 1`,
      [actor.id, areaParam, personaParam],
    );
    return (resDelegacion.rowCount ?? 0) > 0;
  } catch {
    return false;
  }
}

export async function evaluarCapacidadesExpediente(
  db: Pool | PoolClient,
  expedienteId: string,
  actor: ActorRutaDoc,
  contextoOperacion: 'INSTITUCIONAL' | 'PERSONAL',
  precalculados?: {
    estadoActual?: string;
    areaActualId?: string | null;
    solicitanteId?: string | null;
    elegibilidad?: Awaited<ReturnType<typeof evaluarElegibilidadDerivacion>> | null;
    etapaTecnica?: EstadoEtapaTecnicaExpediente | null;
  },
): Promise<CapacidadesExpedienteDto> {
  const resExp = await db.query<{
    solicitante_id: string | null;
    estado_actual: string;
    area_actual_id: string | null;
  }>(
    `SELECT e.solicitante_id::text AS solicitante_id,
            COALESCE(u.estado_nuevo, e.estado, 'REGISTRADO') AS estado_actual,
            COALESCE(u.area_actual_id, e.area_destino_id::text) AS area_actual_id
       FROM sigd_tra.expediente e
       LEFT JOIN sigd_rut.estado_actual_expediente u ON u.expediente_id = e.expediente_id
      WHERE e.expediente_id = $1::uuid`,
    [expedienteId],
  );

  const rowExp = resExp.rows?.[0];
  const estadoActual = rowExp?.estado_actual ?? precalculados?.estadoActual ?? 'REGISTRADO';
  const areaActualId = rowExp?.area_actual_id ?? precalculados?.areaActualId ?? null;
  const solicitanteId = rowExp?.solicitante_id ?? precalculados?.solicitanteId ?? null;

  let idPersonaActor = actor.idPersona ?? null;
  if (!idPersonaActor) {
    const resPer = await db
      .query<{ id_persona: string | null }>(
        'SELECT id_persona::text AS id_persona FROM sigd_auth.cuenta_usuario WHERE id_usuario = $1::uuid',
        [actor.id],
      )
      .catch(() => ({ rows: [] as Array<{ id_persona: string | null }> }));
    idPersonaActor = resPer.rows[0]?.id_persona ?? null;
  }

  const elegibilidad =
    precalculados?.elegibilidad ??
    (await evaluarElegibilidadDerivacion(db, expedienteId).catch(() => null));
  const etapa =
    precalculados?.etapaTecnica ??
    (await consultarEstadoEtapaTecnicaTupa(db, expedienteId).catch(() => null));

  const resAsig = await db
    .query<{ id_usuario: string | null; id_persona: string | null }>(
      `SELECT id_usuario::text AS id_usuario, id_persona::text AS id_persona
         FROM sigd_rut.expediente_asignacion
        WHERE expediente_id = $1::uuid AND activo = true
        ORDER BY asignado_en DESC
        LIMIT 1`,
      [expedienteId],
    )
    .catch(() => ({ rows: [] as Array<{ id_usuario: string | null; id_persona: string | null }> }));
  const asignacionActiva = resAsig.rows[0] ?? null;

  let tieneEncargaturaArea = false;
  const uuidRegexCap = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (areaActualId && uuidRegexCap.test(areaActualId) && uuidRegexCap.test(actor.id)) {
    const resEnc = await db
      .query(
        `SELECT 1
           FROM sigd_org.responsabilidad_temporal rt
          WHERE (rt.id_usuario = $1::uuid OR ($3::uuid IS NOT NULL AND rt.id_persona = $3::uuid))
            AND rt.area_id = $2::uuid
            AND rt.estado = 'ACTIVO'
            AND rt.tipo_responsabilidad IN ('ENCARGATURA', 'DELEGACION', 'SUPLENCIA', 'DESIGNACION_ESPECIFICA')
            AND rt.vigente_desde <= now()
            AND (rt.vigente_hasta IS NULL OR rt.vigente_hasta > now())
          LIMIT 1`,
        [actor.id, areaActualId, idPersonaActor && uuidRegexCap.test(idPersonaActor) ? idPersonaActor : null],
      )
      .catch(() => ({ rowCount: 0 }));
    tieneEncargaturaArea = (resEnc.rowCount ?? 0) > 0;
  }

  const roles = actor.roles ?? [];
  const rolesNoAdmin = roles.filter((r) => r !== 'ADMINISTRADOR' && r !== 'SUPERADMINISTRADOR');
  const facultadFirma = await verificarFacultadFirma(db as Pool, actor.id, rolesNoAdmin).catch(() => ({
    puedeFirmar: rolesNoAdmin.includes('DIRECTOR'),
    roles: rolesNoAdmin,
    facultadGlobal: rolesNoAdmin.includes('DIRECTOR'),
    tiposAutorizados: [] as string[],
    motivo: null as string | null,
  }));

  const rolesNegocio = ['DIRECTOR', 'SECRETARIO', 'ESPECIALISTA', 'MESA_PARTES'];
  const esContextoPersonal =
    contextoOperacion === 'PERSONAL' ||
    (roles.some((r) => ['CIUDADANO', 'ESTUDIANTE'].includes(r)) &&
      !roles.some((r) => [...rolesNegocio, 'ADMINISTRADOR', 'SUPERADMINISTRADOR', 'TESORERIA'].includes(r)));
  const esTitular = Boolean(
    solicitanteId &&
      ((idPersonaActor && idPersonaActor === solicitanteId) || actor.id === solicitanteId),
  );
  const esSoloAdminTecnico =
    roles.some((r) => ['ADMINISTRADOR', 'SUPERADMINISTRADOR'].includes(r)) &&
    !roles.some((r) => rolesNegocio.includes(r));
  const esSoloTesoreria =
    roles.includes('TESORERIA') && !roles.some((r) => rolesNegocio.includes(r));

  const tieneCustodiaArea = Boolean(
    (actor.unidadOrganicaId && areaActualId && actor.unidadOrganicaId === areaActualId) ||
      tieneEncargaturaArea,
  );
  const enAreaMesaODir = Boolean(
    !areaActualId || areaActualId === AREA_DIR_CANONICA || areaActualId === 'DIR' || areaActualId === 'Mesa de Partes',
  );
  const tieneCustodiaMesaIntake = roles.includes('MESA_PARTES') && enAreaMesaODir;

  const requiereEvaluacionTecnica = Boolean(etapa?.requiereEvaluacionTecnica);
  const atencionTecnicaYaCompletada = Boolean(etapa?.requiereEvaluacionTecnica && etapa.completada);
  const estaEnAreaTecnica = Boolean(
    requiereEvaluacionTecnica && areaActualId && etapa?.areaResponsableId && areaActualId === etapa.areaResponsableId,
  );
  const esUsuarioAsignado = Boolean(
    asignacionActiva &&
      ((asignacionActiva.id_usuario && asignacionActiva.id_usuario === actor.id) ||
        (idPersonaActor && asignacionActiva.id_persona && asignacionActiva.id_persona === idPersonaActor)),
  );

  const requisitosConformes = elegibilidad ? elegibilidad.requisitosConformes : true;
  const pagoConforme = elegibilidad ? elegibilidad.pagoConforme : true;

  const motivoNoOperativo = (permisoFallback: string): { codigo: string; motivo: string } => {
    if (esTitular) {
      return {
        codigo: 'CONFLICTO_INTERES_EXPEDIENTE_PROPIO',
        motivo: 'Autoatención no permitida en expedientes propios. No cuenta con permisos para operar este expediente.',
      };
    }
    if (esContextoPersonal) {
      return {
        codigo: 'CONTEXTO_PERSONAL_SIN_FACULTADES_INSTITUCIONALES',
        motivo: 'Cambie al contexto Institucional para operar este expediente. No cuenta con permisos en este contexto.',
      };
    }
    if (esSoloAdminTecnico) {
      return {
        codigo: 'PODER_TECNICO_SIN_AUTORIDAD_NEGOCIO',
        motivo: 'El perfil técnico administra la plataforma y no otorga facultades sustantivas de tramitación.',
      };
    }
    if (esSoloTesoreria) {
      return {
        codigo: 'ROL_FINANCIERO_SIN_FACULTAD_DOCUMENTAL',
        motivo: 'El rol TESORERIA únicamente gestiona cobros y recibos, sin custodia documental.',
      };
    }
    return { codigo: 'SIN_FACULTAD', motivo: permisoFallback };
  };

  const puedeBaseInstitucional = !esContextoPersonal && !esTitular && !esSoloAdminTecnico && !esSoloTesoreria;
  const tieneRolOperativo = roles.some((r) => rolesNegocio.includes(r));

  // 1. DERIVAR
  const facultadDerivar = puedeBaseInstitucional && tieneRolOperativo;
  const tieneFacultadDerivacion =
    facultadDerivar &&
    (await verificarFacultadDerivacion(db, actor, areaActualId, idPersonaActor));
  const custodiaDerivar =
    tieneCustodiaArea || (estadoActual === 'REGISTRADO' && tieneCustodiaMesaIntake);
  const estadoDerivarOk = ['REGISTRADO', 'RECEPCIONADO', 'EN_CALIFICACION', 'DERIVADO', 'EN_REVISION'].includes(estadoActual);
  const derivar: CapacidadAccionDto = !facultadDerivar
    ? { visible: esContextoPersonal || esTitular, habilitado: false, ...motivoNoOperativo('No cuenta con permisos para derivar este expediente.') }
    : !tieneFacultadDerivacion
      ? {
          visible: false,
          habilitado: false,
          codigo: 'SIN_FACULTAD_DERIVACION',
          motivo: 'El rol ESPECIALISTA no posee facultad explícita ni delegación vigente para derivar este expediente.',
        }
      : !custodiaDerivar
        ? { visible: true, habilitado: false, codigo: 'BOLA_VIOLATION_CUSTODIA_AJENA', motivo: 'No pertenece al área de custodia actual para derivar este expediente.' }
        : !estadoDerivarOk
        ? {
            visible: true,
            habilitado: false,
            codigo: 'ESTADO_INVALIDO',
            motivo:
              estadoActual === 'SUBSANADO'
                ? 'El expediente se encuentra subsanado. Debe iniciar formalmente la revisión antes de poder derivarlo.'
                : `No es posible derivar un expediente en estado ${estadoActual}.`,
          }
        : !requisitosConformes
          ? { visible: true, habilitado: false, codigo: 'REQUISITOS_DOCUMENTALES_PENDIENTES', motivo: 'Faltan requisitos documentales obligatorios por validar o conformar.' }
          : !pagoConforme
            ? { visible: true, habilitado: false, codigo: 'PAGO_PENDIENTE', motivo: 'El expediente requiere pago confirmado en Tesorería antes de continuar.' }
            : { visible: true, habilitado: true, motivo: 'Derivar el expediente hacia otra unidad orgánica para su atención.' };

  // 2. RECEPCIONAR
  const recepcionar: CapacidadAccionDto = !facultadDerivar
    ? { visible: false, habilitado: false, ...motivoNoOperativo('No cuenta con permisos para recepcionar este expediente.') }
    : !tieneCustodiaArea
      ? { visible: true, habilitado: false, codigo: 'BOLA_VIOLATION_CUSTODIA_AJENA', motivo: 'Solo personal del área de custodia puede recepcionar el expediente.' }
      : estadoActual !== 'DERIVADO'
        ? { visible: true, habilitado: false, codigo: 'ESTADO_INVALIDO', motivo: 'Solo se pueden recepcionar expedientes en estado DERIVADO.' }
        : { visible: true, habilitado: true, motivo: 'Confirmar recepción formal en el área.' };

  // 3. OBSERVAR
  const custodiaObservar = tieneCustodiaArea || (estadoActual === 'EN_CALIFICACION' && tieneCustodiaMesaIntake);
  const observar: CapacidadAccionDto = !facultadDerivar
    ? { visible: esContextoPersonal || esTitular, habilitado: false, ...motivoNoOperativo('No cuenta con permisos para observar este expediente.') }
    : !custodiaObservar
      ? { visible: true, habilitado: false, codigo: 'BOLA_VIOLATION_CUSTODIA_AJENA', motivo: 'No tiene custodia activa en el área para registrar observaciones.' }
      : !['EN_CALIFICACION', 'EN_REVISION'].includes(estadoActual)
        ? { visible: true, habilitado: false, codigo: 'ESTADO_INVALIDO', motivo: 'Solo se pueden observar expedientes en estado EN_CALIFICACION o EN_REVISION.' }
        : { visible: true, habilitado: true, motivo: 'Registrar pliego de observaciones formales para el administrado.' };

  // 4. SUBSANAR
  const facultadSubsanar =
    esTitular || (!esContextoPersonal && roles.includes('MESA_PARTES') && tieneCustodiaMesaIntake);
  const subsanar: CapacidadAccionDto = !facultadSubsanar
    ? { visible: false, habilitado: false, codigo: 'SIN_FACULTAD_SUBSANACION', motivo: 'Solo el titular administrado o personal de Mesa de Partes puede subsanar el expediente.' }
    : estadoActual !== 'OBSERVADO'
      ? { visible: true, habilitado: false, codigo: 'ESTADO_INVALIDO', motivo: 'Solo se pueden subsanar expedientes en estado OBSERVADO.' }
      : { visible: true, habilitado: true, motivo: 'Registrar la corrección y subsanación de las observaciones.' };

  // 5. INICIAR REVISIÓN
  const custodiaIniciarRev = tieneCustodiaArea || tieneCustodiaMesaIntake;
  const iniciarRevision: CapacidadAccionDto = !facultadDerivar
    ? { visible: false, habilitado: false, ...motivoNoOperativo('No cuenta con permisos para iniciar revisión.') }
    : !custodiaIniciarRev
      ? { visible: true, habilitado: false, codigo: 'BOLA_VIOLATION_CUSTODIA_AJENA', motivo: 'No cuenta con custodia en el área para iniciar revisión.' }
      : estadoActual !== 'SUBSANADO'
        ? { visible: true, habilitado: false, codigo: 'ESTADO_INVALIDO', motivo: 'Solo se puede iniciar revisión cuando el expediente está SUBSANADO.' }
        : { visible: true, habilitado: true, motivo: 'Iniciar revisión formal tras subsanación.' };

  // 6. ASIGNAR
  const facultadAsignarRol =
    roles.includes('SECRETARIO') || (roles.includes('DIRECTOR') && tieneEncargaturaArea);
  const puedeAsignarBase = puedeBaseInstitucional && facultadAsignarRol;
  const asignar: CapacidadAccionDto = !facultadAsignarRol
    ? { visible: false, habilitado: false, codigo: 'SIN_FACULTAD_ASIGNACION', motivo: 'Solo el Secretario del área con custodia o funcionario con encargatura vigente posee facultades para asignar especialistas.' }
    : !puedeAsignarBase
      ? { visible: false, habilitado: false, ...motivoNoOperativo('No cuenta con permisos para asignar especialistas.') }
      : !tieneCustodiaArea
        ? { visible: true, habilitado: false, codigo: 'BOLA_VIOLATION_CUSTODIA_AJENA', motivo: 'El expediente está en custodia de otra área.' }
        : estadoActual !== 'EN_REVISION'
          ? { visible: true, habilitado: false, codigo: 'ESTADO_INVALIDO', motivo: 'Solo se pueden asignar especialistas en estado EN_REVISION.' }
          : requiereEvaluacionTecnica && !estaEnAreaTecnica
            ? { visible: true, habilitado: false, codigo: 'AREA_TECNICA_REQUERIDA', motivo: 'La asignación corresponde al área responsable una vez derivado el expediente.' }
            : { visible: true, habilitado: true, motivo: 'Asignar expediente a un especialista o responsable técnico del área.' };

  // 7. ATENDER (Dictamen técnico en etapa intermedia)
  const rolAtencionTecnica = requiereEvaluacionTecnica && roles.includes('ESPECIALISTA');
  const puedeAtenderBase = puedeBaseInstitucional && rolAtencionTecnica;
  const atender: CapacidadAccionDto = !rolAtencionTecnica
    ? {
        visible: false,
        habilitado: false,
        codigo: roles.includes('DIRECTOR') ? 'DIRECTOR_SIN_FACULTAD_DICTAMEN' : 'ROL_SIN_FACULTAD_ATENCION',
        motivo: !requiereEvaluacionTecnica
          ? 'Este procedimiento no requiere dictamen técnico intermedio; eleve directamente a Dirección con Enviar a Firma.'
          : 'El dictamen técnico corresponde al especialista asignado del área técnica.',
      }
    : !puedeAtenderBase
      ? { visible: false, habilitado: false, ...motivoNoOperativo('No cuenta con permisos para atender este expediente.') }
      : !tieneCustodiaArea
        ? { visible: true, habilitado: false, codigo: 'BOLA_VIOLATION_CUSTODIA_AJENA', motivo: 'No cuenta con custodia en el área actual para atender el expediente.' }
        : estadoActual !== 'EN_REVISION'
          ? { visible: true, habilitado: false, codigo: 'ESTADO_INVALIDO', motivo: 'Solo se puede registrar dictamen técnico cuando el expediente se encuentra EN_REVISION.' }
          : !estaEnAreaTecnica
            ? { visible: true, habilitado: false, codigo: 'AREA_TECNICA_REQUERIDA', motivo: 'El dictamen técnico debe registrarse en la unidad técnica responsable.' }
            : atencionTecnicaYaCompletada
              ? { visible: true, habilitado: false, codigo: 'ETAPA_COMPLETADA', motivo: 'El dictamen de atención técnica ya fue registrado; proceda con Enviar a Firma.' }
              : !esUsuarioAsignado
                ? {
                    visible: true,
                    habilitado: false,
                    codigo: 'EXPEDIENTE_NO_ASIGNADO_AL_ESPECIALISTA',
                    motivo: asignacionActiva
                      ? 'El expediente se encuentra asignado a otro especialista.'
                      : 'El expediente aún no ha sido asignado formalmente para su atención técnica.',
                  }
                : { visible: true, habilitado: true, motivo: 'Registrar dictamen e informe de atención técnica del expediente.' };

  // 8. ENVIAR A FIRMA
  const facultadDespachoRol = roles.some((r) => ['SECRETARIO', 'DIRECTOR'].includes(r));
  const puedeDespachoBase = puedeBaseInstitucional && facultadDespachoRol;
  const enviarAFirma: CapacidadAccionDto = !facultadDespachoRol
    ? {
        visible: false,
        habilitado: false,
        codigo: roles.includes('ESPECIALISTA') ? 'ESPECIALISTA_NO_PUEDE_ELEVAR_A_FIRMA' : 'SIN_FACULTAD_DESPACHO_FIRMA',
        motivo: 'Solo Secretaría o Dirección del área con custodia posee facultad de despacho para elevar a firma.',
      }
    : !puedeDespachoBase
      ? { visible: false, habilitado: false, ...motivoNoOperativo('No cuenta con facultades de despacho para elevar a firma.') }
      : !tieneCustodiaArea
        ? { visible: true, habilitado: false, codigo: 'BOLA_VIOLATION_CUSTODIA_AJENA', motivo: 'No pertenece al área de custodia para elevar este expediente a firma.' }
        : estadoActual !== 'EN_REVISION'
          ? { visible: true, habilitado: false, codigo: 'ESTADO_INVALIDO', motivo: 'Solo se puede enviar a firma cuando el expediente se encuentra EN_REVISION.' }
          : requiereEvaluacionTecnica && !atencionTecnicaYaCompletada
            ? { visible: true, habilitado: false, codigo: 'ATENCION_TECNICA_REQUERIDA', motivo: 'Requiere asignación formal y dictamen técnico previo antes de elevar a Dirección.' }
            : { visible: true, habilitado: true, motivo: 'Elevar expediente evaluado a Despacho de Dirección para suscripción formal.' };

  // 9. RESOLVER CON FIRMA
  const facultadResolverRol = facultadFirma.puedeFirmar;
  const puedeResolverBase = puedeBaseInstitucional && facultadResolverRol;
  const resolver: CapacidadAccionDto = !facultadResolverRol
    ? { visible: false, habilitado: false, codigo: 'SIN_FACULTAD_RESOLUTIVA', motivo: 'Acceso reservado a autoridad directiva con facultad de firma.' }
    : !puedeResolverBase
      ? { visible: false, habilitado: false, ...motivoNoOperativo('No cuenta con facultades resolutivas institucionales.') }
      : !tieneCustodiaArea
        ? { visible: true, habilitado: false, codigo: 'BOLA_VIOLATION_CUSTODIA_AJENA', motivo: 'La resolución requiere custodia activa del área resolutiva.' }
        : requiereEvaluacionTecnica && !atencionTecnicaYaCompletada
          ? { visible: true, habilitado: false, codigo: 'ATENCION_TECNICA_REQUERIDA', motivo: 'Falta asignación formal y dictamen técnico de la unidad responsable antes de resolver.' }
          : estadoActual !== 'EN_FIRMA'
            ? { visible: true, habilitado: false, codigo: 'ESTADO_INVALIDO', motivo: 'Solo se pueden resolver expedientes en estado EN_FIRMA.' }
            : { visible: true, habilitado: true, motivo: 'Emitir acto resolutivo formal suscrito y notificar a Casilla Electrónica.' };

  // 10. ARCHIVAR
  const facultadArchivarRol = roles.some((r) => ['DIRECTOR', 'SECRETARIO', 'MESA_PARTES'].includes(r));
  const puedeArchivarBase = puedeBaseInstitucional && facultadArchivarRol;
  const custodiaArchivar = tieneCustodiaArea || tieneCustodiaMesaIntake;
  const archivar: CapacidadAccionDto = !facultadArchivarRol
    ? { visible: false, habilitado: false, codigo: 'SIN_FACULTAD_ARCHIVO', motivo: 'El rol activo no posee facultades para el archivado formal.' }
    : !puedeArchivarBase
      ? { visible: false, habilitado: false, ...motivoNoOperativo('No cuenta con facultades para archivar el expediente.') }
      : !custodiaArchivar
        ? { visible: true, habilitado: false, codigo: 'BOLA_VIOLATION_CUSTODIA_AJENA', motivo: 'No tiene custodia sobre el área actual del expediente para archivarlo.' }
        : estadoActual !== 'RESUELTO'
          ? { visible: true, habilitado: false, codigo: 'ESTADO_INVALIDO', motivo: 'Solo se pueden archivar expedientes en estado RESUELTO.' }
          : { visible: true, habilitado: true, motivo: 'Registrar ubicación de inventario físico y archivar expediente.' };

  // 11. ACUMULAR
  const custodiaAcumular = tieneCustodiaArea || tieneCustodiaMesaIntake;
  const acumular: CapacidadAccionDto = !facultadDerivar
    ? { visible: esContextoPersonal || esTitular, habilitado: false, ...motivoNoOperativo('No cuenta con permisos para acumular este expediente.') }
    : !custodiaAcumular
      ? { visible: true, habilitado: false, codigo: 'BOLA_VIOLATION_CUSTODIA_AJENA', motivo: 'No pertenece al área de custodia para acumular este expediente.' }
      : estadoActual === 'ARCHIVADO'
        ? { visible: true, habilitado: false, codigo: 'ESTADO_INVALIDO', motivo: 'No se pueden acumular expedientes en estado ARCHIVADO.' }
        : { visible: true, habilitado: true, motivo: 'Acumular expedientes conexos bajo este expediente principal (Art. 160 LPAG).' };

  return {
    derivar,
    recepcionar,
    observar,
    subsanar,
    iniciarRevision,
    asignar,
    atender,
    enviarAFirma,
    resolver,
    archivar,
    acumular,
  };
}
