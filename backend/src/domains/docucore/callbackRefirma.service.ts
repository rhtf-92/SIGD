import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { PoolClient } from 'pg';
import { Readable } from 'node:stream';
import { obtenerConfiguracionS3 } from '../../config/s3.config.js';
import { generarUrlPresigned, validarMagicBytes } from '../../core/storage/s3-storage.service.js';
import { HashIntegrityService } from './hashIntegrity.service.js';
import {
  validarFirmaPades,
  obtenerPoliticaValidacionPades,
  type OpcionesValidacionPades,
} from './verificadorPades.service.js';
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../shared/domain/errors/index.js';

export interface CallbackRefirma {
  documento_id: string;
  sha256_firmado: string;
  firmante: string;
  fecha_sello_tsa: string;
  s3_bucket: string;
  s3_key: string;
}

export function verificarFirmaWebhook(
  rawBody: Buffer,
  firmaRecibida: string | undefined,
  secreto: string,
  timestampHeader?: string,
): void {
  if (!secreto || typeof secreto !== 'string' || secreto.trim().length < 16) {
    throw new ForbiddenError({
      detail: 'La clave secreta del webhook de Refirma no está configurada o no cumple los requisitos mínimos de seguridad (mínimo 16 caracteres).',
    });
  }

  if (!firmaRecibida) {
    throw new ForbiddenError({
      detail: 'Callback de Refirma no autenticado.',
    });
  }

  if (!timestampHeader) throw new ForbiddenError({ detail: 'El callback requiere una marca de tiempo vigente.' });
  if (timestampHeader) {
    const timestampMs = Date.parse(timestampHeader);
    if (Number.isNaN(timestampMs) || Math.abs(Date.now() - timestampMs) > 300_000) {
      throw new ForbiddenError({
        detail: 'La marca de tiempo del webhook ha expirado o está fuera de la ventana de validez permitida (300 segundos).',
      });
    }
  }

  const esperada = createHmac('sha256', secreto)
    .update(rawBody)
    .digest('hex');

  const recibida = firmaRecibida.replace(/^sha256=/i, '').toLowerCase();

  if (
    !/^[a-f0-9]{64}$/.test(recibida) ||
    recibida.length !== esperada.length ||
    !timingSafeEqual(Buffer.from(recibida), Buffer.from(esperada))
  ) {
    throw new ForbiddenError({
      detail: 'La firma del callback de Refirma es inválida.',
    });
  }
}

/**
 * Guarda la evidencia de firma devuelta por Refirma.
 * Esta función debe invocarse dentro de una transacción.
 */
export async function registrarCallbackRefirma(
  cliente: PoolClient,
  datos: CallbackRefirma,
  opcionesValidacion?: OpcionesValidacionPades,
): Promise<string> {
  const fechaTsaMs = Date.parse(datos.fecha_sello_tsa);
  if (
    !/^[0-9a-fA-F]{64}$/.test(datos.sha256_firmado) ||
    !datos.firmante.trim() ||
    !datos.s3_bucket.trim() ||
    !datos.s3_key.trim() ||
    Number.isNaN(fechaTsaMs) ||
    fechaTsaMs > Date.now() + 60_000
  ) {
    throw new ValidationError({
      invalidParams: [
        {
          name: 'datosRefirma',
          reason: 'Los datos recibidos desde Refirma son inválidos o están incompletos.',
        },
      ],
    });
  }

  const documento = await cliente.query<{ documento_adjunto_id: string; expediente_id: string | null; s3_bucket: string }>(
    `SELECT documento_adjunto_id, expediente_id, s3_bucket
       FROM sigd_doc.documento_adjunto
      WHERE documento_adjunto_id = $1
      FOR UPDATE`,
    [datos.documento_id],
  );

  if (documento.rowCount !== 1) {
    throw new NotFoundError({
      detail: 'El documento a firmar no existe.',
    });
  }

  const config = obtenerConfiguracionS3();
  if (datos.s3_bucket !== config.bucket || documento.rows[0].s3_bucket !== config.bucket ||
      /[\\/]/.test(datos.s3_bucket) || datos.s3_key.split('/').some(p => !p || p === '.' || p === '..')) {
    throw new ForbiddenError({ detail: 'La referencia firmada no pertenece al almacenamiento documental configurado.' });
  }
  await cotejarPdfFirmado(datos, opcionesValidacion);

  // El bloqueo del documento serializa callbacks concurrentes. Un reintento
  // idéntico conserva el CVD; otro resultado no reemplaza evidencia ya registrada.
  const anterior = await cliente.query<{ cvd: string; coincide: boolean }>(
    `SELECT cvd, (sha256_firmado = $2 AND firmante = $3 AND fecha_sello_tsa = $4::timestamptz
       AND s3_bucket = $5 AND s3_key = $6 AND estado = 'FIRMADO_DIGITALMENTE') AS coincide
     FROM sigd_doc.firma_digital_documento WHERE documento_id = $1`,
    [datos.documento_id, datos.sha256_firmado.toLowerCase(), datos.firmante.trim(),
      datos.fecha_sello_tsa, datos.s3_bucket, datos.s3_key],
  );
  if (anterior.rowCount) {
    if (!anterior.rows[0].coincide) throw new ConflictError({ detail: 'El documento ya tiene otra evidencia de firma registrada.' });
    return anterior.rows[0].cvd;
  }

  const resultado = await cliente.query<{ cvd: string }>(
    `INSERT INTO sigd_doc.firma_digital_documento
      (
        documento_id,
        sha256_firmado,
        firmante,
        fecha_sello_tsa,
        s3_bucket,
        s3_key,
        estado
      )
     VALUES ($1, $2, $3, $4, $5, $6, 'FIRMADO_DIGITALMENTE')
     RETURNING cvd`,
    [
      datos.documento_id,
      datos.sha256_firmado.toLowerCase(),
      datos.firmante.trim(),
      datos.fecha_sello_tsa,
      datos.s3_bucket.trim(),
      datos.s3_key.trim(),
    ],
  );

  const cvd = resultado.rows[0].cvd;

  const expedienteId = documento.rows[0].expediente_id;
  if (expedienteId) {
    const resResolucion = await cliente.query<{ resolucion_id: string; numero_resolucion: string }>(
      `UPDATE sigd_doc.resolucion
          SET estado = 'FIRMADA',
              firmado_en = $1::timestamptz,
              firmado_por = (
                SELECT cu.id_usuario
                  FROM sigd_auth.cuenta_usuario cu
                 WHERE (CASE WHEN $2 ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                             THEN cu.id_usuario = $2::uuid ELSE FALSE END)
                    OR cu.usuario = $2
                 LIMIT 1
              ),
              hash_pades = $3
        WHERE expediente_id = $4::uuid
          AND EXISTS (SELECT 1 FROM sigd_doc.documento_adjunto d
                       WHERE d.documento_adjunto_id = $5::uuid
                         AND d.expediente_id = sigd_doc.resolucion.expediente_id
                         AND d.s3_key = 'resoluciones/' || sigd_doc.resolucion.numero_borrador || '.pdf')
          AND estado IN ('BORRADOR_PENDIENTE_FIRMA', 'EN_FIRMA')
        RETURNING resolucion_id, COALESCE(numero_resolucion, numero_borrador) AS numero_resolucion`,
      [
        datos.fecha_sello_tsa,
        datos.firmante.trim(),
        datos.sha256_firmado.toLowerCase(),
        expedienteId,
        datos.documento_id,
      ],
    );

    if (resResolucion.rows.length > 1) throw new ConflictError({ detail: 'El documento corresponde a varias resoluciones.' });
    if (resResolucion.rows.length > 0) {
      const resolucion = resResolucion.rows[0];
      const correlationId = randomUUID();
      const detalleAuditoria = {
        resolucion_id: resolucion.resolucion_id,
        numero_resolucion: resolucion.numero_resolucion,
        documento_id: datos.documento_id,
        cvd,
        sha256_firmado: datos.sha256_firmado.toLowerCase(),
        firmante: datos.firmante.trim(),
        fecha_sello_tsa: datos.fecha_sello_tsa,
        s3_bucket: datos.s3_bucket.trim(),
        s3_key: datos.s3_key.trim(),
        estado: 'FIRMADA',
      };

      await cliente.query(
        `INSERT INTO sigd_audit.bitacora_auditoria
           (correlation_id, usuario_id, esquema, tabla, operacion, datos_antes, datos_despues, fecha_hora)
         VALUES ($1::uuid, (
           SELECT cu.id_usuario FROM sigd_auth.cuenta_usuario cu
            WHERE (CASE WHEN $2 ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                        THEN cu.id_usuario = $2::uuid ELSE FALSE END)
               OR cu.usuario = $2 LIMIT 1
         ), 'sigd_doc', 'resolucion', 'UPDATE', $3::jsonb, $4::jsonb, clock_timestamp())`,
        [
          correlationId,
          datos.firmante.trim(),
          JSON.stringify({ estado: 'BORRADOR_PENDIENTE_FIRMA' }),
          JSON.stringify(detalleAuditoria),
        ],
      );

      // FSM institucional (06_sigd_rut.sql): si el expediente se encuentra en 'EN_FIRMA',
      // la validación criptográfica PAdES exitosa transiciona legítimamente a 'RESUELTO'
      const resExpEstado = await cliente.query<{ estado_actual: string; area_actual_id: string | null }>(
        `SELECT COALESCE(ultimo.estado_nuevo, 'REGISTRADO') AS estado_actual,
                ultimo.area_actual_id
           FROM sigd_tra.expediente e
           LEFT JOIN sigd_rut.estado_actual_expediente ultimo ON ultimo.expediente_id = e.expediente_id
          WHERE e.expediente_id = $1::uuid
            FOR UPDATE OF e`,
        [expedienteId],
      );

      if (resExpEstado.rows.length > 0 && resExpEstado.rows[0].estado_actual === 'EN_FIRMA') {
        const resOperador = await cliente.query<{ operador_id: string }>(
          `SELECT oi.operador_id::text
             FROM sigd_auth.cuenta_usuario cu
             JOIN sigd_auth.operador_identidad oi ON oi.id_usuario = cu.id_usuario
            WHERE (CASE WHEN $1 ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                        THEN cu.id_usuario = $1::uuid ELSE FALSE END)
               OR cu.usuario = $1
            LIMIT 1`,
          [datos.firmante.trim()],
        );

        const operadorParam = resOperador.rows[0]?.operador_id
          ? BigInt(resOperador.rows[0].operador_id)
          : 990000002n;

        await cliente.query(
          `INSERT INTO sigd_rut.movimiento_tramite (
              expediente_id, estado_anterior, evento, estado_nuevo,
              usuario_operador_id, correlation_id, clave_idempotencia, datos
            ) VALUES (
              $1::uuid, 'EN_FIRMA', 'FIRMA', 'RESUELTO',
              $2, $3::uuid, $4, $5::jsonb
            )`,
          [
            expedienteId,
            operadorParam,
            correlationId,
            `FIRMA-RESOLUCION-${resolucion.resolucion_id}`,
            JSON.stringify({
              areaId: resExpEstado.rows[0]?.area_actual_id || null,
              resolucion_id: resolucion.resolucion_id,
              numero_resolucion: resolucion.numero_resolucion,
              cvd,
              firmante: datos.firmante.trim(),
              sha256_firmado: datos.sha256_firmado.toLowerCase(),
              fecha_sello_tsa: datos.fecha_sello_tsa,
            }),
          ],
        );
      }

      // Recuperar destinatario de Casilla: usuario_id y CUT del titular activo del expediente.
      // Si el expediente fue registrado por ventanilla presencial (solicitante sin cuenta digital),
      // la columna id_usuario quedará NULL y DestinoCasilla omitirá el evento correctamente.
      const titularRes = await cliente.query<{
        usuario_id: string | null;
        cut: string;
        correo: string | null;
      }>(
        `SELECT cu.id_usuario AS usuario_id, e.codigo_expediente AS cut, cu.correo
           FROM sigd_doc.expediente e
           LEFT JOIN sigd_auth.cuenta_usuario cu
             ON cu.id_persona = e.solicitante_id AND cu.activo = TRUE
          WHERE e.expediente_id = $1::uuid`,
        [expedienteId],
      );
      if (titularRes.rows.length > 1) throw new ConflictError({ detail: 'El solicitante tiene varias cuentas activas; no se puede determinar el destinatario.' });
      const titular = titularRes.rows[0];

      await cliente.query(
        `INSERT INTO sigd_audit.evento_outbox
           (correlation_id, agregado, tipo_evento, payload, estado)
         VALUES ($1::uuid, 'resolucion', 'resolucion_emitida', $2::jsonb, 'PENDIENTE')`,
        [
          correlationId,
          JSON.stringify({
            documento_id: datos.documento_id,
            resolucion_id: resolucion.resolucion_id,
            expediente_id: expedienteId,
            numero_resolucion: resolucion.numero_resolucion,
            cvd,
            sha256_firmado: datos.sha256_firmado.toLowerCase(),
            firmado_en: datos.fecha_sello_tsa,
            s3_bucket: datos.s3_bucket.trim(),
            s3_key: datos.s3_key.trim(),
            usuario_id: titular?.usuario_id ?? null,
            cut: titular?.cut ?? null,
            asunto: `Resolución ${resolucion.numero_resolucion} emitida — Expediente ${titular?.cut ?? expedienteId}`,
            correo_destinatario: titular?.correo ?? null,
            tipo_acto: 'resolucion_emitida',
            numero_documento: resolucion.numero_resolucion,
          }),
        ],
      );
    }
  }

  return cvd;
}

/**
 * Coteja bytes, integridad en Storage y valida criptografía PAdES / CMS conforme a normativa.
 */
export async function cotejarPdfFirmado(
  datos: Pick<CallbackRefirma, 'sha256_firmado' | 's3_bucket' | 's3_key'>,
  opcionesValidacion?: OpcionesValidacionPades,
): Promise<Buffer> {
  const config = obtenerConfiguracionS3();
  if (datos.s3_bucket !== config.bucket || /[\\/]/.test(datos.s3_bucket) ||
      datos.s3_key.split('/').some(p => !p || p === '.' || p === '..')) {
    throw new ForbiddenError({ detail: 'La referencia firmada no pertenece al almacenamiento configurado.' });
  }
  // El HMAC identifica al proveedor; no demuestra que el objeto exista ni que
  // sus bytes coincidan. Solo se consulta el endpoint S3 configurado, sin redirecciones.
  const url = generarUrlPresigned(datos.s3_key, config, { metodo: 'GET', expiraSegundos: 60 });
  let contenido: Buffer;
  try {
    const respuesta = await fetch(url, { signal: AbortSignal.timeout(10000), redirect: 'error' });
    if (!respuesta.ok || !respuesta.body) throw new Error('Objeto no disponible');
    const partes: Buffer[] = [];
    let tamano = 0;
    for await (const parte of Readable.fromWeb(respuesta.body as never)) {
      const bytes = Buffer.from(parte);
      tamano += bytes.length;
      if (tamano > 26_214_400) throw new Error('Documento demasiado grande');
      partes.push(bytes);
    }
    contenido = Buffer.concat(partes);
  } catch {
    throw new AppError({ status: 503, code: 'SIGNED_DOCUMENT_UNAVAILABLE', message: 'No se pudo cotejar el documento firmado almacenado.' });
  }
  if (!validarMagicBytes(contenido, 'PDF') ||
      new HashIntegrityService().calculateFromBuffer(contenido).sha256 !== datos.sha256_firmado.toLowerCase()) {
    throw new ConflictError({ detail: 'El PDF almacenado no coincide con la evidencia recibida.' });
  }

  // Validación criptográfica PAdES obligatoria conforme a política institucional o parámetros suministrados
  const opciones = opcionesValidacion ?? obtenerPoliticaValidacionPades();
  const resultadoPades = await validarFirmaPades(contenido, opciones);

  if (!resultadoPades.valido || !resultadoPades.validacionCriptografica) {
    throw new ValidationError({
      invalidParams: [
        {
          name: 'firmaPades',
          reason:
            resultadoPades.detalles.motivoRechazo ||
            resultadoPades.detalles.advertencia ||
            'El documento recibido no superó la validación criptográfica PAdES requerida.',
        },
      ],
    });
  }

  return contenido;
}
