import crypto from 'node:crypto';
import type { Pool } from 'pg';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { obtenerConfiguracionS3 } from '../../config/s3.config.js';
import { generarUrlPresigned } from '../../core/storage/s3-storage.service.js';
import { NotFoundError } from '../../shared/domain/errors/index.js';
import {
  A4InstitutionalDocBuilder,
  INSTITUCION_SISTEMA,
} from '../docucore/institucionalPdf.helper.js';

export interface DestinatarioCedula {
  nombresCompletos: string;
  tipoDocumento: string;
  numeroDocumento: string;
  correoPersonal?: string | null;
}

export interface DatosCedulaAcuse {
  idNotificacion: string;
  cut: string;
  tipoActo: string;
  asunto: string;
  fechaDeposito: Date | string;
  fechaLectura?: Date | string | null;
  estadoNotificacion?: string | null;
  canalNotificacion?: string | null;
  documentoUrlNotificado?: string | null;
  cvdActoNotificado?: string | null;
  hashActoNotificado?: string | null;

  idAcuse: string;
  cvdAcuse: string;
  acuseSelladoTiempo: Date | string;
  acuseHashSha256: string;

  destinatario: DestinatarioCedula;
}

export function formatearFechaLocal(fecha: Date | string): string {
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
  return d.toLocaleString('es-PE', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatearFechaIso(fecha: Date | string): string {
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
  return d.toISOString();
}

/**
 * Genera el documento físico en PDF (A4) de la Cédula Oficial de Acuse de Notificación Electrónica.
 * Conforme al Art. 20 del TUO de la Ley N° 27444 (LPAG) y Ley N° 29733.
 */
export async function generarCedulaAcusePdf(datos: DatosCedulaAcuse): Promise<Buffer> {
  const canal = datos.canalNotificacion || 'Casilla Electrónica Institucional SIGD';
  const fechaAcuseLocal = formatearFechaLocal(datos.acuseSelladoTiempo);
  const fechaAcuseIso = formatearFechaIso(datos.acuseSelladoTiempo);
  const fechaDepositoLocal = formatearFechaLocal(datos.fechaDeposito);
  const fechaLecturaLocal = datos.fechaLectura
    ? formatearFechaLocal(datos.fechaLectura)
    : 'Lectura simultánea o previa al registro del acuse';

  const tieneAcuseConfirmado = Boolean(datos.idAcuse && datos.acuseSelladoTiempo);
  const estadoTrazabilidad = tieneAcuseConfirmado
    ? 'ACUSE DE RECIBO SELLADO (NOTIFICACIÓN DILIGENCIADA)'
    : datos.fechaLectura
      ? 'PUESTA A DISPOSICIÓN Y LEÍDA (ACUSE PENDIENTE)'
      : 'PUESTA A DISPOSICIÓN EN CASILLA (PENDIENTE DE LECTURA/ACUSE)';

  const builder = await A4InstitutionalDocBuilder.create({
    tituloDocumento: 'CÉDULA DE ACUSE DE NOTIFICACIÓN ELECTRÓNICA',
    subtituloDocumento: 'Casilla Electrónica Ciudadana — Constancia Oficial LPAG (Art. 20 Ley N° 27444)',
    unidadEmisora: 'SECRETARÍA GENERAL / CASILLA ELECTRÓNICA',
    codigoReferencia: datos.idAcuse,
    fechaEmisionTexto: `Sellado (Lima): ${fechaAcuseLocal}`,
    metadataTitle: `Cédula de Acuse - ${datos.idAcuse}`,
  });

  builder.drawSectionTitle('1. TRAZABILIDAD DEL DILIGENCIAMIENTO Y ESTADO DE NOTIFICACIÓN');
  builder.drawKeyValueTable([
    { label: 'Estado de notificación', value: estadoTrazabilidad, highlight: true },
    { label: 'Canal de diligenciamiento', value: canal },
    { label: '1) Generación y depósito (casilla)', value: fechaDepositoLocal },
    { label: '2) Acceso / lectura registrada', value: fechaLecturaLocal },
    { label: '3) Emisión y sellado de acuse formal', value: `${fechaAcuseLocal} (${fechaAcuseIso})` },
    { label: 'Identificador oficial de acuse', value: datos.idAcuse, mono: true },
  ]);

  builder.drawSectionTitle('2. EXPEDIENTE Y ACTO ADMINISTRATIVO NOTIFICADO');
  builder.drawKeyValueTable([
    { label: 'Código Único de Trámite (CUT)', value: datos.cut || 'No asignado', mono: true, highlight: true },
    { label: 'Identificador de notificación', value: datos.idNotificacion, mono: true },
    { label: 'Tipo de acto administrativo', value: datos.tipoActo },
    { label: 'Asunto del acto notificado', value: datos.asunto },
    ...(datos.cvdActoNotificado
      ? [{ label: 'CVD del acto notificado', value: datos.cvdActoNotificado, mono: true }]
      : []),
    ...(datos.hashActoNotificado
      ? [{ label: 'Hash SHA-256 del acto notificado', value: datos.hashActoNotificado, mono: true }]
      : []),
  ]);

  builder.drawSectionTitle('3. DATOS DEL DESTINATARIO (ADMINISTRADO)');
  builder.drawKeyValueTable([
    { label: 'Nombre completo / razón social', value: datos.destinatario.nombresCompletos },
    {
      label: 'Documento de identidad',
      value: `${datos.destinatario.tipoDocumento} ${datos.destinatario.numeroDocumento}`,
      mono: true,
    },
    ...(datos.destinatario.correoPersonal
      ? [{ label: 'Correo electrónico de aviso', value: datos.destinatario.correoPersonal }]
      : []),
  ]);

  builder.drawNoticeBox(
    '4. EFECTOS JURÍDICOS Y CÓMPUTO DE PLAZOS (TUO LEY N° 27444)',
    [
      '• SURTIMIENTO DE EFECTOS (Art. 20, num. 20.4 LPAG): La notificación electrónica surte efectos legales desde el día en que conste el acuse de recibo formal en la Casilla Electrónica del administrado; no basta la sola generación en base de datos.',
      '• CÓMPUTO DE PLAZOS ADMINISTRATIVOS (Art. 144 y 218 LPAG): Los plazos para subsanación o interposición de recursos (15 días hábiles) se computan a partir del día hábil siguiente de recibida efectivamente la notificación.',
      '• INTEGRIDAD Y FECHA CIERTA: El sello de tiempo del servidor institucional y la huella SHA-256 garantizan la inmutabilidad del acuse emitido.',
    ],
    'legal',
  );

  const portalBase = (process.env.APP_URL || process.env.HOST_PUBLICO || 'http://localhost:5173').replace(/\/$/, '');
  const urlVerificacionCvd = `${portalBase}/api/v1/validador-cvd/verificar/${encodeURIComponent(datos.cvdAcuse)}`;

  await builder.drawVerificationCard({
    qrContent: urlVerificacionCvd,
    qrCaption: 'VERIFICAR CVD ACUSE',
    titulo: 'INTEGRIDAD CRIPTOGRÁFICA Y VALIDACIÓN CVD',
    filas: [
      { label: 'Código de Verificación Digital (CVD) del Acuse', value: datos.cvdAcuse, mono: true },
      { label: 'Huella SHA-256 inmutable del Acuse', value: datos.acuseHashSha256, mono: true },
    ],
  });

  return builder.finalize(
    `${INSTITUCION_SISTEMA} · Ley N° 27444 y Ley N° 29733 · CVD ${datos.cvdAcuse}`,
  );
}

/**
 * Genera la representación en texto plano estructurado (.TXT) de la Cédula de Acuse.
 */
export function generarCedulaAcuseTxt(datos: DatosCedulaAcuse): string {
  const lineas = [
    '================================================================================',
    'INSTITUTO DE EDUCACIÓN SUPERIOR TECNOLÓGICO PÚBLICO "SUIZA"',
    'SISTEMA INTEGRAL DE GESTIÓN DOCUMENTARIA (SIGD 2026)',
    'CASILLA ELECTRÓNICA CIUDADANA — CONSTANCIA OFICIAL',
    'CÉDULA DE ACUSE DE NOTIFICACIÓN ELECTRÓNICA (LPAG LEY N° 27444)',
    '================================================================================',
    '',
    '1. DATOS DEL ACUSE DE NOTIFICACIÓN ELECTRÓNICA',
    `   Identificador Oficial de Acuse : ${datos.idAcuse}`,
    `   CVD del Acuse                  : ${datos.cvdAcuse}`,
    `   Timestamp Oficial Servidor ISO : ${formatearFechaIso(datos.acuseSelladoTiempo)}`,
    `   Fecha y Hora Local (Perú)      : ${formatearFechaLocal(datos.acuseSelladoTiempo)}`,
    `   Hash SHA-256 del Acuse         : ${datos.acuseHashSha256}`,
    '',
    '2. EXPEDIENTE Y ACTO ADMINISTRATIVO DILIGENCIADO',
    `   Código Único de Trámite (CUT)  : ${datos.cut}`,
    `   ID de Notificación             : ${datos.idNotificacion}`,
    `   Tipo de Acto Administrativo    : ${datos.tipoActo}`,
    `   Asunto del Acto                : ${datos.asunto}`,
    `   Fecha de Depósito en Casilla   : ${formatearFechaLocal(datos.fechaDeposito)}`,
    datos.cvdActoNotificado ? `   CVD del Acto Notificado        : ${datos.cvdActoNotificado}` : '',
    datos.hashActoNotificado ? `   Hash SHA-256 del Acto          : ${datos.hashActoNotificado}` : '',
    '',
    '3. DATOS DEL DESTINATARIO (ADMINISTRADO)',
    `   Administrado                   : ${datos.destinatario.nombresCompletos}`,
    `   Documento de Identidad         : ${datos.destinatario.tipoDocumento} ${datos.destinatario.numeroDocumento}`,
    datos.destinatario.correoPersonal ? `   Correo de Contacto             : ${datos.destinatario.correoPersonal}` : '',
    '   Canal de Diligenciamiento      : Casilla Electrónica Ciudadana (IESTP Suiza)',
    '',
    '4. EFECTOS JURÍDICOS Y CÓMPUTO DE PLAZOS (TUO LEY N° 27444)',
    '   - De conformidad con el Artículo 20, numeral 20.4 del TUO de la Ley N° 27444',
    '     (Ley del Procedimiento Administrativo General), la notificación electrónica',
    '     surte plenos efectos legales el mismo día en que se genera el presente acuse.',
    '   - El cómputo de los plazos administrativos legalmente establecidos para interponer',
    '     recursos (15 días hábiles conforme al Art. 218) o subsanaciones se iniciará a',
    '     partir del primer día hábil siguiente a la fecha de recepción consignada.',
    '   - Plazo de atención / impugnación: 15 días hábiles.',
    '',
    '5. VALIDEZ Y SEGURIDAD FORENSE',
    '   - Cédula emitida conforme al TUO de la Ley N° 27444 y Ley N° 29733.',
    '   - La autenticidad e integridad de este documento puede verificarse mediante el',
    `     Código de Verificación Digital (CVD): ${datos.cvdAcuse}.`,
    '================================================================================',
  ].filter((l) => l !== '');

  return lineas.join('\r\n') + '\r\n';
}

/**
 * Persiste los archivos PDF y TXT de la Cédula de Acuse en MinIO S3 y vincula
 * las claves resultantes en la tabla `sigd_auth.notificacion_casilla` (campo jsonb `cuerpo`).
 */
export async function persistirCedulaAcuse(
  pool: Pool,
  notificacionId: string,
  datos: DatosCedulaAcuse,
): Promise<{
  s3KeyPdf: string;
  s3KeyTxt: string;
  sha256Pdf: string;
  sha256Txt: string;
}> {
  const configS3 = obtenerConfiguracionS3();
  const s3 = new S3Client({
    region: configS3.region,
    endpoint: configS3.endpoint,
    forcePathStyle: configS3.forcePathStyle,
    credentials: {
      accessKeyId: configS3.accessKey,
      secretAccessKey: configS3.secretKey,
    },
  });

  const s3KeyPdf = `acuses/${notificacionId}/${datos.idAcuse}.pdf`;
  const s3KeyTxt = `acuses/${notificacionId}/${datos.idAcuse}.txt`;

  // Generar buffers
  const bufferPdf = await generarCedulaAcusePdf(datos);
  const contenidoTxt = generarCedulaAcuseTxt(datos);
  const bufferTxt = Buffer.from(contenidoTxt, 'utf-8');

  const sha256Pdf = crypto.createHash('sha256').update(bufferPdf).digest('hex');
  const sha256Txt = crypto.createHash('sha256').update(bufferTxt).digest('hex');

  // Subir PDF a MinIO
  await s3.send(
    new PutObjectCommand({
      Bucket: configS3.bucket,
      Key: s3KeyPdf,
      Body: bufferPdf,
      ContentType: 'application/pdf',
    }),
  );

  // Subir TXT a MinIO
  await s3.send(
    new PutObjectCommand({
      Bucket: configS3.bucket,
      Key: s3KeyTxt,
      Body: bufferTxt,
      ContentType: 'text/plain; charset=utf-8',
    }),
  );

  // Vincular atómicamente en sigd_auth.notificacion_casilla
  await pool.query(
    `UPDATE sigd_auth.notificacion_casilla
        SET cuerpo = jsonb_set(
              jsonb_set(
                jsonb_set(
                  jsonb_set(
                    COALESCE(cuerpo, '{}'::jsonb),
                    '{acuse_documento_url}',
                    to_jsonb($1::text)
                  ),
                  '{acuse_documento_txt_url}',
                  to_jsonb($2::text)
                ),
                '{acuse_pdf_sha256}',
                to_jsonb($3::text)
              ),
              '{acuse_txt_sha256}',
              to_jsonb($4::text)
            )
      WHERE id = $5::uuid`,
    [s3KeyPdf, s3KeyTxt, sha256Pdf, sha256Txt, notificacionId],
  );

  return {
    s3KeyPdf,
    s3KeyTxt,
    sha256Pdf,
    sha256Txt,
  };
}

/**
 * Asegura que una Cédula de Acuse para una notificación dada esté persistida físicamente en S3
 * y vinculada al registro de la notificación, devolviendo los enlaces presignados de descarga.
 */
export async function asegurarCedulaAcusePersistida(
  pool: Pool,
  notificacionId: string,
  usuarioId: string,
  formato: 'pdf' | 'txt' = 'pdf',
): Promise<{
  downloadUrl: string;
  url: string;
  downloadUrlPdf: string;
  downloadUrlTxt: string;
  expiraEnSegundos: number;
  idAcuse: string;
  formato: 'pdf' | 'txt';
}> {
  const configS3 = obtenerConfiguracionS3();

  const notifRes = await pool.query<{
    id: string;
    usuario_id: string;
    persona_id: string | null;
    correo_destinatario: string | null;
    cut: string | null;
    asunto: string;
    tipo_acto: string;
    estado: string | null;
    fecha_deposito: Date | string;
    fecha_lectura: Date | string | null;
    hash_sha256: string | null;
    cvd: string | null;
    id_acuse: string | null;
    acuse_hash_sha256: string | null;
    acuse_sellado_tiempo: Date | string | null;
    documento_url: string | null;
    cuerpo: any;
  }>(
    `SELECT id, usuario_id, persona_id, correo_destinatario, cut, asunto, tipo_acto,
            estado, fecha_deposito, fecha_lectura, hash_sha256, cvd, id_acuse, acuse_hash_sha256,
            acuse_sellado_tiempo, documento_url, cuerpo
       FROM sigd_auth.notificacion_casilla
      WHERE id = $1::uuid
        AND (usuario_id = $2::uuid OR persona_id IN (SELECT id_persona FROM sigd_auth.cuenta_usuario WHERE id_usuario = $2::uuid))`,
    [notificacionId, usuarioId],
  );

  if (notifRes.rows.length === 0) {
    throw new NotFoundError({
      detail: `No existe la notificación de casilla para descargar acuse: ${notificacionId}`,
    });
  }

  const notif = notifRes.rows[0];
  if (!notif.id_acuse) {
    throw new NotFoundError({
      detail: 'La notificación no cuenta con un acuse de recibo generado.',
    });
  }

  // Obtener destinatario
  const resPersona = await pool.query<{
    nombre_completo: string;
    id_documento: string;
    tipo: string;
  }>(
    `SELECT COALESCE(pn.nombre_completo, pj.razon_social) AS nombre_completo,
            p.id_documento, p.tipo
       FROM sigd_auth.cuenta_usuario c
       JOIN sigd_auth.persona p ON p.id_persona = c.id_persona
       LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = p.id_persona
       LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = p.id_persona
      WHERE c.id_usuario = $1::uuid`,
    [notif.usuario_id],
  );

  const persona = resPersona.rows[0];
  const destinatario: DestinatarioCedula = {
    nombresCompletos: persona?.nombre_completo || 'Administrado',
    tipoDocumento: persona?.tipo === 'JURIDICA' ? 'RUC' : /^\d{8}$/.test(persona?.id_documento ?? '') ? 'DNI' : 'CE',
    numeroDocumento: persona?.id_documento || 'No especificado',
    correoPersonal: notif.correo_destinatario || undefined,
  };

  const anio = new Date(notif.fecha_deposito).getFullYear();
  const cvdAcuse = `CVD-${anio}-ACU-${notif.id.slice(0, 6).toUpperCase()}-7B12`;

  const datos: DatosCedulaAcuse = {
    idNotificacion: notif.id,
    cut: notif.cut ?? '',
    tipoActo: notif.tipo_acto,
    asunto: notif.asunto,
    fechaDeposito: notif.fecha_deposito,
    fechaLectura: notif.fecha_lectura,
    estadoNotificacion: notif.estado,
    documentoUrlNotificado: notif.documento_url,
    cvdActoNotificado: notif.cvd,
    hashActoNotificado: notif.hash_sha256,
    idAcuse: notif.id_acuse,
    cvdAcuse,
    acuseSelladoTiempo: notif.acuse_sellado_tiempo ?? notif.fecha_deposito,
    acuseHashSha256: notif.acuse_hash_sha256 ?? 'HASH-NO-DISPONIBLE',
    destinatario,
  };

  const s3 = new S3Client({
    region: configS3.region,
    endpoint: configS3.endpoint,
    forcePathStyle: configS3.forcePathStyle,
    credentials: {
      accessKeyId: configS3.accessKey,
      secretAccessKey: configS3.secretKey,
    },
  });

  const s3KeyPdf = `acuses/${notificacionId}/${notif.id_acuse}.pdf`;
  const s3KeyTxt = `acuses/${notificacionId}/${notif.id_acuse}.txt`;

  // Comprobar si el PDF ya existe en S3
  let existeEnS3 = false;
  try {
    await s3.send(new HeadObjectCommand({ Bucket: configS3.bucket, Key: s3KeyPdf }));
    existeEnS3 = true;
  } catch {
    existeEnS3 = false;
  }

  // Si no existe, persistirlo físicamente
  if (!existeEnS3) {
    await persistirCedulaAcuse(pool, notificacionId, datos);
  }

  const downloadUrlPdf = generarUrlPresigned(s3KeyPdf, configS3, { metodo: 'GET', expiraSegundos: 900 });
  const downloadUrlTxt = generarUrlPresigned(s3KeyTxt, configS3, { metodo: 'GET', expiraSegundos: 900 });
  const downloadUrl = formato === 'txt' ? downloadUrlTxt : downloadUrlPdf;

  return {
    downloadUrl,
    url: downloadUrl,
    downloadUrlPdf,
    downloadUrlTxt,
    expiraEnSegundos: 900,
    idAcuse: notif.id_acuse,
    formato,
  };
}
