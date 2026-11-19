import type { PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import { getRequestContext } from '../../shared/request-context/request-context.js';
import { insertarEvento } from '../../audit/evento-outbox.repository.js';
import {
  UnauthorizedError,
  NotFoundError,
  DomainError,
  ConflictError,
  ForbiddenError,
  ValidationError,
} from '../../shared/domain/errors/index.js';
import type { DerivarExpedienteDTO } from './dto/derivarExpediente.dto.js';
import type { ArchivarExpedienteDTO } from './dto/archivarExpediente.dto.js';
import type { AtenderExpedienteDTO } from './dto/atenderExpediente.dto.js';
import type { RecepcionarExpedienteDTO } from './dto/recepcionarExpediente.dto.js';
import { obtenerSiguienteEstado } from './rutadoc.fsm.js';
import { exigirSinPagoDemoPendiente } from '../tramicore/demoPago.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function esUuid(valor: unknown): boolean {
  return typeof valor === 'string' && UUID_REGEX.test(valor.trim());
}

export interface ResultadoDerivacionBackend {
  derivacionId: string;
  nuevoEstado: string;
}

export interface ResultadoRecepcionBackend {
  movimientoId: string;
  nuevoEstado: string;
  secuencia: string;
}

async function resolverOperadorParam(
  cliente: PoolClient,
  usuarioActorId: string,
): Promise<string | bigint> {
  const colInfo = await cliente.query<{ data_type: string }>(`
    SELECT data_type
    FROM information_schema.columns
    WHERE table_schema = 'sigd_rut'
      AND table_name = 'movimiento_tramite'
      AND column_name = 'usuario_operador_id'
  `);
  const tipoColumna = colInfo.rows[0]?.data_type?.toLowerCase() ?? 'bigint';

  if (tipoColumna === 'uuid') {
    if (!esUuid(usuarioActorId)) {
      throw new UnauthorizedError({ detail: 'La identidad institucional del operador no es un UUID válido.' });
    }
    return usuarioActorId;
  }
  if (/^\d+$/.test(usuarioActorId)) {
    return BigInt(usuarioActorId);
  }
  if (!esUuid(usuarioActorId)) {
    throw new UnauthorizedError({ detail: 'La identidad institucional del operador no es un UUID válido.' });
  }

  try {
    const resMapeo = await cliente.query<{ operador_id: string }>(`
      SELECT operador_id::text
      FROM sigd_auth.operador_identidad
      WHERE id_usuario = $1::uuid
    `, [usuarioActorId]);
    if (resMapeo?.rows?.[0]?.operador_id) {
      return BigInt(resMapeo.rows[0].operador_id);
    }
  } catch {
    // Si la tabla sigd_auth.operador_identidad no existe aún en la base de datos
  }

  throw new DomainError({
    code: 'OPERADOR_INCOMPATIBLE',
    message: 'Incompatibilidad de identidad: el operador es un UUID y el esquema exige BIGINT sin correspondencia institucional válida.',
    detail: `El usuario '${usuarioActorId}' no cuenta con un operador numérico mapeado en el catálogo institucional.`,
  });
}

/**
 * Servicio institucional de Derivaciones y Pases Internos (RutaDoc).
 *
 * Invariantes de persistencia y arquitectura institucional:
 * 1. Consulta el estado oficial en sigd_tra.expediente y sigd_rut.estado_actual_expediente con bloqueo pesimista (FOR UPDATE).
 * 2. Valida transiciones canónicas de la FSM (06_sigd_rut.sql): 'EN_CALIFICACION' | 'EN_REVISION' + 'DERIVACION' -> 'DERIVADO'.
 * 3. Valida existencia y vigencia de áreas de destino en sigd_org.area.
 * 4. Delega la secuencia atómica al trigger institucional tr_registrar_movimiento_identidad (sin suministrar secuencia manual).
 * 5. Delega la actualización del estado del expediente al trigger tr_estado_actual_movimiento (mediante datos->>'areaId').
 * 6. Registra el evento transaccional en el outbox institucional (ExpedienteDerivado).
 * 7. Preserva trazabilidad de identidad del operador auténtico.
 */
export async function derivarExpediente(
  cliente: PoolClient,
  expedienteId: string,
  datos: DerivarExpedienteDTO,
): Promise<ResultadoDerivacionBackend> {
  // 1. Validación de contexto y tenencia de usuario autenticado
  const contexto = getRequestContext();
  const usuarioActorId = contexto?.usuario_id;

  if (!usuarioActorId) {
    throw new UnauthorizedError({
      detail: 'No se encontró usuario en el contexto para registrar el movimiento institucional.',
    });
  }

  // 2. Obtener estado y área actual del expediente con bloqueo de concurrencia
  await exigirSinPagoDemoPendiente(cliente, expedienteId);
  const resExpediente = await cliente.query<{
    expediente_id: string;
    codigo_expediente: string;
    estado_actual: string;
    area_actual_id: string | null;
    secuencia: string | null;
  }>(`
    SELECT
      e.expediente_id::text,
      e.codigo_expediente,
      COALESCE(ultimo.estado_nuevo, e.estado, 'REGISTRADO') AS estado_actual,
      COALESCE(
        NULLIF(ultimo.area_actual_id, ''),
        CASE WHEN ar.canal_ingreso IN ('MESA_PRESENCIAL', 'MESA_VIRTUAL')
             THEN (SELECT area_id::text FROM sigd_org.area WHERE codigo = 'MP')
             ELSE e.area_destino_id::text
        END,
        (SELECT area_id::text FROM sigd_org.area WHERE codigo = 'MP')
      ) AS area_actual_id,
      ultimo.secuencia::text
    FROM sigd_tra.expediente e
    LEFT JOIN sigd_tra.asiento_registro ar ON ar.expediente_id = e.expediente_id
    LEFT JOIN sigd_rut.estado_actual_expediente ultimo ON ultimo.expediente_id = e.expediente_id
    WHERE e.expediente_id = $1::uuid
    FOR UPDATE OF e
  `, [expedienteId]);

  if (resExpediente.rowCount === 0) {
    throw new NotFoundError({ detail: `El expediente '${expedienteId}' no existe en el sistema.` });
  }

  const estadoAnterior = resExpediente.rows[0].estado_actual;
  const areaOrigenId = resExpediente.rows[0].area_actual_id;

  // 3. Validación de FSM: Transición institucional (06_sigd_rut.sql)
  // Las únicas transiciones canónicas que desembocan en 'DERIVADO' son:
  // - Si está en REGISTRADO (recién radicado en Ventanilla Presencial):
  //     1) RECEPCION: REGISTRADO -> RECEPCIONADO
  //     2) INICIAR_CALIFICACION: RECEPCIONADO -> EN_CALIFICACION
  //     3) DERIVACION: EN_CALIFICACION -> DERIVADO
  // - Si está en RECEPCIONADO (recibido formalmente en Mesa de Partes):
  //     1) INICIAR_CALIFICACION: RECEPCIONADO -> EN_CALIFICACION
  //     2) DERIVACION: EN_CALIFICACION -> DERIVADO
  // - Si está en EN_CALIFICACION:
  //     1) DERIVACION: EN_CALIFICACION -> DERIVADO
  // - Si está en EN_REVISION:
  //     1) DERIVACION: EN_REVISION -> DERIVADO
  if (
    estadoAnterior !== 'EN_CALIFICACION' &&
    estadoAnterior !== 'EN_REVISION' &&
    estadoAnterior !== 'RECEPCIONADO' &&
    estadoAnterior !== 'REGISTRADO'
  ) {
    throw new ConflictError({
      code: 'ESTADO_NO_DERIVABLE',
      message: `El expediente en estado '${estadoAnterior}' no admite derivación. Solo expedientes en 'REGISTRADO', 'RECEPCIONADO', 'EN_CALIFICACION' o 'EN_REVISION' pueden ser derivados conforme a la FSM institucional.`,
    });
  }

  // 4. Validar existencia y vigencia de las áreas de destino en sigd_org.area
  for (const destino of datos.destinos) {
    const resArea = await cliente.query<{ area_id: string; vigente: boolean; nombre: string }>(`
      SELECT area_id::text, vigente, nombre
      FROM sigd_org.area
      WHERE area_id = $1::uuid
    `, [destino.area_destino_id]);

    if (resArea.rowCount === 0) {
      throw new NotFoundError({
        detail: `El área de destino '${destino.area_destino_id}' no existe en el catálogo institucional (sigd_org.area).`,
      });
    }

    if (!resArea.rows[0].vigente) {
      throw new DomainError({
        code: 'AREA_INACTIVA',
        message: `El área de destino '${resArea.rows[0].nombre}' se encuentra inactiva.`,
      });
    }

    if (areaOrigenId && destino.area_destino_id === areaOrigenId) {
      throw new ConflictError({
        code: 'DESTINO_IGUAL_ORIGEN',
        message: 'El área de destino no puede ser idéntica a la unidad orgánica actual del expediente.',
      });
    }
  }

  // 5. Resolución de tipo de operador (UUID directo, BIGINT nativo o correspondencia)
  const operadorParam = await resolverOperadorParam(cliente, usuarioActorId);

  let estadoEfectivoDerivacion = estadoAnterior;

  // 1. Recepción inaugural atómica si el expediente se encontraba en REGISTRADO (FSM 06_sigd_rut.sql)
  if (estadoAnterior === 'REGISTRADO') {
    const correlationIdRec = contexto?.correlation_id && esUuid(contexto.correlation_id)
      ? contexto.correlation_id
      : randomUUID();
    const claveIdempotenciaRec = `RECEP-${expedienteId}-${Date.now()}`;
    const datosJsonRec = {
      areaId: areaOrigenId ?? null,
      observaciones: 'Recepción inicial en Mesa de Partes para derivación y despacho institucional',
      usuarioActorUuid: usuarioActorId,
    };

    const resRec = await cliente.query<{ id_movimiento: string; secuencia: string }>(`
      INSERT INTO sigd_rut.movimiento_tramite (
        expediente_id,
        estado_anterior,
        evento,
        estado_nuevo,
        usuario_operador_id,
        correlation_id,
        clave_idempotencia,
        datos
      ) VALUES (
        $1::uuid,
        'REGISTRADO',
        'RECEPCION',
        'RECEPCIONADO',
        $2,
        $3::uuid,
        $4,
        $5::jsonb
      ) RETURNING id_movimiento::text, secuencia::text
    `, [
      expedienteId,
      operadorParam,
      correlationIdRec,
      claveIdempotenciaRec,
      JSON.stringify(datosJsonRec),
    ]);

    await insertarEvento(cliente, {
      agregado: 'Expediente',
      tipo_evento: 'ExpedienteRecepcionado',
      payload: {
        identidad: {
          expediente_id: expedienteId,
          movimiento_id: resRec.rows[0].id_movimiento,
          cut: resExpediente.rows[0].codigo_expediente,
        },
        contexto: {
          usuario_actor_id: usuarioActorId,
          area_id: areaOrigenId,
        },
        datos_especificos: {
          observaciones: 'Recepción inicial en Mesa de Partes para derivación y despacho institucional',
          secuencia: resRec.rows[0].secuencia,
        },
      },
    });

    estadoEfectivoDerivacion = 'RECEPCIONADO';
  }

  // 2. Apertura formal de calificación si el expediente se encontraba en RECEPCIONADO (FSM 06_sigd_rut.sql)
  if (estadoEfectivoDerivacion === 'RECEPCIONADO') {
    const correlationIdCal = contexto?.correlation_id && esUuid(contexto.correlation_id)
      ? contexto.correlation_id
      : randomUUID();
    const claveIdempotenciaCal = `CALIF-${expedienteId}-${Date.now()}`;
    const datosJsonCal = {
      areaId: areaOrigenId ?? null,
      observaciones: 'Apertura de calificación para trámite presencial en Mesa de Partes',
      usuarioActorUuid: usuarioActorId,
    };
    await cliente.query(`
      INSERT INTO sigd_rut.movimiento_tramite (
        expediente_id,
        estado_anterior,
        evento,
        estado_nuevo,
        usuario_operador_id,
        correlation_id,
        clave_idempotencia,
        datos
      ) VALUES (
        $1::uuid,
        'RECEPCIONADO',
        'INICIAR_CALIFICACION',
        'EN_CALIFICACION',
        $2,
        $3::uuid,
        $4,
        $5::jsonb
      )
    `, [
      expedienteId,
      operadorParam,
      correlationIdCal,
      claveIdempotenciaCal,
      JSON.stringify(datosJsonCal),
    ]);
    estadoEfectivoDerivacion = 'EN_CALIFICACION';
  }

  let ultimoMovimientoId = expedienteId;

  // 6. Procesar cada destino
  for (const destino of datos.destinos) {
    const correlationId = contexto?.correlation_id && esUuid(contexto.correlation_id)
      ? contexto.correlation_id
      : randomUUID();

    const claveIdempotencia = `DERIV-${expedienteId}-${destino.area_destino_id}-${Date.now()}`;

    // Estructura JSONB requerida por RutaDoc:
    // datos->>'areaId' es consumido automáticamente por el trigger tr_estado_actual_movimiento
    // para actualizar area_actual_id en sigd_rut.estado_actual_expediente.
    const datosJson = {
      areaId: destino.area_destino_id,
      areaOrigenId: areaOrigenId ?? null,
      areaDestinoId: destino.area_destino_id,
      proveido: datos.proveido,
      motivo: datos.proveido,
      esCopia: Boolean(destino.es_copia),
      usuarioAsignadoId: destino.usuario_asignado_id ?? null,
      usuarioActorUuid: usuarioActorId,
    };

    const resMovimiento = await cliente.query<{ id_movimiento: string; secuencia: string }>(`
      INSERT INTO sigd_rut.movimiento_tramite (
        expediente_id,
        estado_anterior,
        evento,
        estado_nuevo,
        usuario_operador_id,
        correlation_id,
        clave_idempotencia,
        datos
      ) VALUES (
        $1::uuid,
        $2,
        'DERIVACION',
        'DERIVADO',
        $3,
        $4::uuid,
        $5,
        $6::jsonb
      ) RETURNING id_movimiento::text, secuencia::text
    `, [
      expedienteId,
      estadoEfectivoDerivacion,
      operadorParam,
      correlationId,
      claveIdempotencia,
      JSON.stringify(datosJson),
    ]);

    ultimoMovimientoId = resMovimiento.rows[0].id_movimiento;

    // 7. Generar Evento Outbox en la misma transacción (Atomicidad)
    await insertarEvento(cliente, {
      agregado: 'Expediente',
      tipo_evento: 'ExpedienteDerivado',
      payload: {
        identidad: {
          expediente_id: expedienteId,
          movimiento_id: ultimoMovimientoId,
        },
        contexto: {
          usuario_actor_id: usuarioActorId,
          area_origen_id: areaOrigenId,
          area_destino_id: destino.area_destino_id,
        },
        datos_especificos: {
          motivo: datos.proveido,
          es_copia: Boolean(destino.es_copia),
          usuario_asignado_id: destino.usuario_asignado_id ?? null,
        },
      },
    });
  }

  return {
    derivacionId: ultimoMovimientoId,
    nuevoEstado: 'DERIVADO',
  };
}

/**
 * Servicio de Atención Resolutiva (T-BE-RD-07).
 * Mapea la acción al estado 'RESUELTO' mediante evento 'FIRMA'.
 */
export async function atenderExpediente(
  cliente: PoolClient,
  expedienteId: string,
  datos: AtenderExpedienteDTO,
): Promise<void> {
  const contexto = getRequestContext();
  const usuarioActorId = contexto?.usuario_id;

  if (!usuarioActorId) {
    throw new UnauthorizedError({ detail: 'No se encontró usuario en el contexto.' });
  }

  await exigirSinPagoDemoPendiente(cliente, expedienteId);
  const resExpediente = await cliente.query<{
    expediente_id: string;
    estado_actual: string;
    area_actual_id: string | null;
  }>(`
    SELECT
      e.expediente_id::text,
      COALESCE(ultimo.estado_nuevo, 'REGISTRADO') AS estado_actual,
      COALESCE(NULLIF(ultimo.area_actual_id, ''), e.area_destino_id::text) AS area_actual_id
    FROM sigd_tra.expediente e
    LEFT JOIN sigd_rut.estado_actual_expediente ultimo ON ultimo.expediente_id = e.expediente_id
    WHERE e.expediente_id = $1::uuid
    FOR UPDATE OF e
  `, [expedienteId]);

  if (resExpediente.rowCount === 0) {
    throw new NotFoundError({ detail: 'El expediente no existe o no tiene estado actual.' });
  }

  const { estado_actual: estadoAnterior, area_actual_id: areaActualExpediente } = resExpediente.rows[0];

  if (contexto?.unidad_organica_id && areaActualExpediente && contexto.unidad_organica_id !== areaActualExpediente) {
    throw new ForbiddenError({ detail: 'El usuario no pertenece al área donde se encuentra el expediente.' });
  }

  const correlationId = contexto?.correlation_id && esUuid(contexto.correlation_id)
    ? contexto.correlation_id
    : randomUUID();

  const datosJson = {
    areaId: areaActualExpediente,
    resultadoResumen: datos.resultado_resumen,
    usuarioActorUuid: usuarioActorId,
  };

  const operadorParam = await resolverOperadorParam(cliente, usuarioActorId);

  // FSM institucional (06_sigd_rut.sql):
  // Si el expediente se encuentra en 'EN_REVISION' o 'ATENDIDO', la atención resolutiva lo deriva
  // al despacho de firma ('EN_REVISION' | 'ATENDIDO' + 'ENVIAR_A_FIRMA' -> 'EN_FIRMA').
  // En ningún caso se transiciona a 'RESUELTO' sin firma digital efectiva.
  if (estadoAnterior === 'EN_REVISION' || estadoAnterior === 'ATENDIDO') {
    // 1. Validar que exista el proyecto de resolución en DocuCore con documento PDF firmable
    const resResolucion = await cliente.query<{
      resolucion_id: string;
      numero_borrador: string;
      estado: string;
      tiene_adjunto_pdf: boolean;
    }>(`
      SELECT
        r.resolucion_id::text,
        r.numero_borrador,
        r.estado,
        EXISTS (
          SELECT 1
          FROM sigd_doc.documento_adjunto d
          WHERE d.expediente_id = r.expediente_id
            AND (d.s3_key = 'resoluciones/' || r.numero_borrador || '.pdf' OR d.mime_type = 'application/pdf')
            AND d.sha256 IS NOT NULL
        ) AS tiene_adjunto_pdf
      FROM sigd_doc.resolucion r
      WHERE r.expediente_id = $1::uuid
      ORDER BY r.creado_en DESC
      LIMIT 1
    `, [expedienteId]);

    if (resResolucion.rowCount === 0) {
      throw new ConflictError({
        code: 'BORRADOR_RESOLUCION_REQUERIDO',
        detail: `El expediente se encuentra en ${estadoAnterior === 'ATENDIDO' ? 'atención técnica concluida' : 'revisión'} pero no cuenta con un proyecto de resolución registrado en DocuCore. Proyecte la resolución antes de elevar a firma digital.`,
      });
    }

    const { resolucion_id, numero_borrador, tiene_adjunto_pdf } = resResolucion.rows[0];

    if (!tiene_adjunto_pdf) {
      throw new ConflictError({
        code: 'DOCUMENTO_FIRMABLE_REQUERIDO',
        detail: `La resolución ${numero_borrador} no cuenta con un documento binario PDF generado y apto para firma digital en el repositorio institucional.`,
      });
    }

    const correlationIdFirma = contexto?.correlation_id && esUuid(contexto.correlation_id)
      ? contexto.correlation_id
      : randomUUID();
    const datosJsonFirma = {
      areaId: areaActualExpediente,
      observaciones: datos.resultado_resumen || 'Pase a despacho y firma resolutiva',
      usuarioActorUuid: usuarioActorId,
      resolucionId: resolucion_id,
      numeroBorrador: numero_borrador,
    };
    const resPase = await cliente.query<{ id_movimiento: string }>(`
      INSERT INTO sigd_rut.movimiento_tramite (
        expediente_id, estado_anterior, evento, estado_nuevo,
        usuario_operador_id, correlation_id, clave_idempotencia, datos
      ) VALUES (
        $1::uuid, $2, 'ENVIAR_A_FIRMA', 'EN_FIRMA',
        $3, $4::uuid, $5, $6::jsonb
      ) RETURNING id_movimiento::text
    `, [
      expedienteId, estadoAnterior, operadorParam, correlationIdFirma,
      `ENV-FIRMA-${expedienteId}-${Date.now()}`, JSON.stringify(datosJsonFirma),
    ]);

    await cliente.query(
      `UPDATE sigd_tra.expediente SET estado = 'EN_FIRMA' WHERE expediente_id = $1::uuid`,
      [expedienteId],
    );

    await insertarEvento(cliente, {
      agregado: 'Expediente',
      tipo_evento: 'ExpedienteEnviadoAFirma',
      payload: {
        identidad: { expediente_id: expedienteId, movimiento_id: resPase.rows[0].id_movimiento },
        contexto: { usuario_actor_id: usuarioActorId, area_contexto_id: areaActualExpediente },
        datos_especificos: { resultado_resumen: datos.resultado_resumen, resolucion_id, numero_borrador },
      },
    });

    return;
  }

  // Si el expediente se encuentra en 'EN_FIRMA', verificar si existe evidencia de firma digital
  if (estadoAnterior === 'EN_FIRMA') {
    const resVerificacionFirma = await cliente.query<{ tiene_firma: boolean }>(`
      SELECT EXISTS (
        SELECT 1
        FROM sigd_doc.resolucion r
        JOIN sigd_doc.documento_adjunto d
          ON d.expediente_id = r.expediente_id
         AND d.s3_key = 'resoluciones/' || r.numero_borrador || '.pdf'
        JOIN sigd_doc.firma_digital_documento f
          ON f.documento_id = d.documento_adjunto_id
         AND f.estado = 'FIRMADO_DIGITALMENTE'
        WHERE r.expediente_id = $1::uuid
          AND r.estado = 'FIRMADA'
      ) AS tiene_firma
    `, [expedienteId]);

    if (!resVerificacionFirma.rows[0]?.tiene_firma) {
      throw new ConflictError({
        detail: 'El expediente se encuentra en despacho para firma (EN_FIRMA) y no cuenta con firma digital verificada. Debe completarse la firma digital PAdES institucional antes de resolver el trámite.',
      });
    }

    const resMovimiento = await cliente.query<{ id_movimiento: string }>(`
      INSERT INTO sigd_rut.movimiento_tramite (
        expediente_id, estado_anterior, evento, estado_nuevo,
        usuario_operador_id, correlation_id, clave_idempotencia, datos
      ) VALUES (
        $1::uuid, 'EN_FIRMA', 'FIRMA', 'RESUELTO',
        $2, $3::uuid, $4, $5::jsonb
      ) RETURNING id_movimiento::text
    `, [
      expedienteId, operadorParam,
      correlationId, `ATEN-${expedienteId}-${Date.now()}`, JSON.stringify(datosJson),
    ]);

    await insertarEvento(cliente, {
      agregado: 'Expediente',
      tipo_evento: 'ExpedienteAtendido',
      payload: {
        identidad: { expediente_id: expedienteId, movimiento_id: resMovimiento.rows[0].id_movimiento },
        contexto: { usuario_actor_id: usuarioActorId, area_contexto_id: areaActualExpediente },
        datos_especificos: { resultado_resumen: datos.resultado_resumen },
      },
    });

    return;
  }

  if (estadoAnterior === 'RESUELTO') {
    throw new ConflictError({ detail: 'El expediente ya se encuentra RESUELTO.' });
  }

  throw new ConflictError({
    detail: `El expediente no se encuentra en estado apto para atención resolutiva. Estado actual: ${estadoAnterior}.`,
  });
}

/**
 * Servicio de Archivado Formal (T-BE-RD-08).
 * Requiere que el estado previo sea RESUELTO y transiciona a ARCHIVADO vía CIERRE.
 */
export async function archivarExpediente(
  cliente: PoolClient,
  expedienteId: string,
  datos: ArchivarExpedienteDTO,
): Promise<void> {
  const contexto = getRequestContext();
  const usuarioActorId = contexto?.usuario_id;

  if (!usuarioActorId) {
    throw new UnauthorizedError({ detail: 'No se encontro usuario en el contexto.' });
  }

  const campos = ['estante', 'balda', 'caja'] as const;
  if (campos.some((campo) => !datos[campo].trim())) {
    throw new ValidationError({ invalidParams: campos.filter((campo) => !datos[campo].trim())
      .map((campo) => ({ name: campo, reason: 'La ubicacion de archivo no puede estar vacia.' })) });
  }
  datos = { estante: datos.estante.trim(), balda: datos.balda.trim(), caja: datos.caja.trim(),
    observaciones: datos.observaciones?.trim() || undefined };
  await exigirSinPagoDemoPendiente(cliente, expedienteId);
  // Adquirir el bloqueo antes de consultar la vista: tras esperar a otro cierre,
  // la consulta siguiente debe usar una instantanea nueva de READ COMMITTED.
  const bloqueo = await cliente.query('SELECT expediente_id FROM sigd_tra.expediente WHERE expediente_id = $1::uuid FOR UPDATE', [expedienteId]);
  if (!bloqueo.rowCount) throw new NotFoundError({ detail: 'El expediente no existe.' });

  const resExpediente = await cliente.query<{
    expediente_id: string;
    estado_actual: string;
    area_actual_id: string | null;
  }>(`
    SELECT
      e.expediente_id::text,
      COALESCE(ultimo.estado_nuevo, 'REGISTRADO') AS estado_actual,
      COALESCE(NULLIF(ultimo.area_actual_id, ''), e.area_destino_id::text) AS area_actual_id
    FROM sigd_tra.expediente e
    LEFT JOIN sigd_rut.estado_actual_expediente ultimo ON ultimo.expediente_id = e.expediente_id
    WHERE e.expediente_id = $1::uuid
    FOR UPDATE OF e
  `, [expedienteId]);

  if (resExpediente.rowCount === 0) {
    throw new NotFoundError({ detail: 'El expediente no existe o no tiene estado actual.' });
  }

  const { estado_actual: estadoAnterior, area_actual_id: areaActualExpediente } = resExpediente.rows[0];

  if (estadoAnterior === 'ARCHIVADO') {
    const anterior = await cliente.query<{ datos: Record<string, unknown> }>(
      `SELECT datos FROM sigd_rut.movimiento_tramite
        WHERE expediente_id = $1::uuid AND evento = 'CIERRE' AND estado_nuevo = 'ARCHIVADO'
        ORDER BY secuencia DESC LIMIT 1`, [expedienteId]);
    const guardado = anterior.rows[0]?.datos;
    if (guardado && campos.every((campo) => guardado[campo] === datos[campo]) &&
        (guardado.observaciones || null) === (datos.observaciones || null) &&
        guardado.usuarioActorUuid === usuarioActorId) return;
    throw new ConflictError({ detail: 'El expediente ya fue archivado con otra ubicacion o actuacion.' });
  }

  if (estadoAnterior !== 'RESUELTO') {
    throw new DomainError({
      code: 'ESTADO_INVALIDO',
      message: 'El estado actual del expediente no permite realizar esta acción.',
      detail: `Solo se pueden archivar expedientes en estado RESUELTO conforme a la FSM. Estado actual: ${estadoAnterior}.`,
    });
  }

  const correlationId = contexto?.correlation_id && esUuid(contexto.correlation_id)
    ? contexto.correlation_id
    : randomUUID();

  const datosJson = {
    areaId: areaActualExpediente,
    estante: datos.estante,
    balda: datos.balda,
    caja: datos.caja,
    observaciones: datos.observaciones || null,
    usuarioActorUuid: usuarioActorId,
  };

  const operadorParam = await resolverOperadorParam(cliente, usuarioActorId);

  const resMovimiento = await cliente.query<{ id_movimiento: string }>(`
    INSERT INTO sigd_rut.movimiento_tramite (
      expediente_id, estado_anterior, evento, estado_nuevo,
      usuario_operador_id, correlation_id, clave_idempotencia, datos
    ) VALUES (
      $1::uuid, $2, 'CIERRE', 'ARCHIVADO',
      $3, $4::uuid, $5, $6::jsonb
    ) RETURNING id_movimiento::text
  `, [
    expedienteId, estadoAnterior, operadorParam,
    correlationId, `ARCH-${expedienteId}-${Date.now()}`, JSON.stringify(datosJson),
  ]);

  await insertarEvento(cliente, {
    agregado: 'Expediente',
    tipo_evento: 'ExpedienteArchivado',
    payload: {
      identidad: { expediente_id: expedienteId, movimiento_id: resMovimiento.rows[0].id_movimiento },
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
 * Servicio de Recepción Formal en Unidad Orgánica de Destino (T-BE-RD-12 / FASE 7B).
 * Aplica la transición canónica de la FSM (06_sigd_rut.sql): 'DERIVADO' + 'RECEPCION' -> 'EN_REVISION'.
 *
 * Invariantes institucionales:
 * 1. Consulta y bloquea el expediente en sigd_tra.expediente (FOR UPDATE).
 * 2. Valida pertenencia orgánica del usuario operador si cuenta con unidad definida.
 * 3. Valida que el estado actual sea DERIVADO e impide recepciones duplicadas o incompatibles.
 * 4. Resuelve el identificador de operador institucional (BIGINT/UUID).
 * 5. Inserta el movimiento transaccional en sigd_rut.movimiento_tramite, delegando secuencia y estado a los triggers.
 * 6. Registra atómicamente el evento 'ExpedienteRecepcionado' en el Outbox.
 */
export async function recepcionarExpediente(
  cliente: PoolClient,
  expedienteId: string,
  datos?: RecepcionarExpedienteDTO,
): Promise<ResultadoRecepcionBackend> {
  const contexto = getRequestContext();
  const usuarioActorId = contexto?.usuario_id;

  if (!usuarioActorId) {
    throw new UnauthorizedError({
      detail: 'No se encontró usuario en el contexto para registrar la recepción institucional.',
    });
  }

  await exigirSinPagoDemoPendiente(cliente, expedienteId);
  const resExpediente = await cliente.query<{
    expediente_id: string;
    codigo_expediente: string;
    estado_actual: string;
    area_actual_id: string | null;
    secuencia: string | null;
  }>(`
    SELECT
      e.expediente_id::text,
      e.codigo_expediente,
      COALESCE(ultimo.estado_nuevo, e.estado, 'REGISTRADO') AS estado_actual,
      COALESCE(
        NULLIF(ultimo.area_actual_id, ''),
        CASE WHEN ar.canal_ingreso IN ('MESA_PRESENCIAL', 'MESA_VIRTUAL')
             THEN (SELECT area_id::text FROM sigd_org.area WHERE codigo = 'MP')
             ELSE e.area_destino_id::text
        END,
        (SELECT area_id::text FROM sigd_org.area WHERE codigo = 'MP')
      ) AS area_actual_id,
      ultimo.secuencia::text
    FROM sigd_tra.expediente e
    LEFT JOIN sigd_tra.asiento_registro ar ON ar.expediente_id = e.expediente_id
    LEFT JOIN sigd_rut.estado_actual_expediente ultimo ON ultimo.expediente_id = e.expediente_id
    WHERE e.expediente_id = $1::uuid
    FOR UPDATE OF e
  `, [expedienteId]);

  if (resExpediente.rowCount === 0) {
    throw new NotFoundError({ detail: `El expediente '${expedienteId}' no existe en el sistema.` });
  }

  const { estado_actual: estadoAnterior, area_actual_id: areaActualExpediente, codigo_expediente: cut } = resExpediente.rows[0];

  if (contexto?.unidad_organica_id && areaActualExpediente && contexto.unidad_organica_id !== areaActualExpediente) {
    throw new ForbiddenError({ detail: 'El usuario no pertenece al área donde se encuentra el expediente derivado.' });
  }

  if (estadoAnterior === 'EN_REVISION') {
    throw new ConflictError({
      code: 'EXPEDIENTE_YA_RECEPCIONADO',
      message: 'El expediente ya se encuentra recepcionado formalmente y en estado de revisión.',
    });
  }

  if (estadoAnterior !== 'DERIVADO' && estadoAnterior !== 'REGISTRADO') {
    throw new ConflictError({
      code: 'ESTADO_NO_RECEPCIONABLE',
      message: `El expediente en estado '${estadoAnterior}' no admite recepcion conforme a la FSM institucional.`,
    });
  }

  const nuevoEstado = obtenerSiguienteEstado(estadoAnterior, 'RECEPCION');
  const operadorParam = await resolverOperadorParam(cliente, usuarioActorId);

  const correlationId = contexto?.correlation_id && esUuid(contexto.correlation_id)
    ? contexto.correlation_id
    : randomUUID();

  const claveIdempotencia = `RECEP-${expedienteId}-${Date.now()}`;

  const datosJson = {
    areaId: areaActualExpediente,
    observaciones: datos?.observaciones || 'Recepción formal en unidad orgánica de destino',
    usuarioActorUuid: usuarioActorId,
  };

  const resMovimiento = await cliente.query<{ id_movimiento: string; secuencia: string }>(`
    INSERT INTO sigd_rut.movimiento_tramite (
      expediente_id,
      estado_anterior,
      evento,
      estado_nuevo,
      usuario_operador_id,
      correlation_id,
      clave_idempotencia,
      datos
    ) VALUES (
      $1::uuid,
      $2,
      'RECEPCION',
      $7,
      $3,
      $4::uuid,
      $5,
      $6::jsonb
    ) RETURNING id_movimiento::text, secuencia::text
  `, [
    expedienteId,
    estadoAnterior,
    operadorParam,
    correlationId,
    claveIdempotencia,
    JSON.stringify(datosJson),
    nuevoEstado,
  ]);

  const ultimoMovimientoId = resMovimiento.rows[0].id_movimiento;
  const nuevaSecuencia = resMovimiento.rows[0].secuencia;

  await insertarEvento(cliente, {
    agregado: 'Expediente',
    tipo_evento: 'ExpedienteRecepcionado',
    payload: {
      identidad: {
        expediente_id: expedienteId,
        movimiento_id: ultimoMovimientoId,
        cut,
      },
      contexto: {
        usuario_actor_id: usuarioActorId,
        area_id: areaActualExpediente,
      },
      datos_especificos: {
        observaciones: datos?.observaciones ?? null,
        secuencia: nuevaSecuencia,
      },
    },
  });

  return {
    movimientoId: ultimoMovimientoId,
    nuevoEstado,
    secuencia: nuevaSecuencia,
  };
}
