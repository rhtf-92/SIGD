import crypto from 'node:crypto';
import type { Pool } from 'pg';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { obtenerConfiguracionS3 } from '../../config/s3.config.js';
import { generarUrlPresigned } from '../../core/storage/s3-storage.service.js';
import { NotFoundError } from '../../shared/domain/errors/index.js';

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
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 estándar
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontMono = await pdfDoc.embedFont(StandardFonts.Courier);
  const fontMonoBold = await pdfDoc.embedFont(StandardFonts.CourierBold);

  const { width, height } = page.getSize();
  const margenX = 45;
  const anchoUtil = width - 2 * margenX;

  // 1. Encabezado institucional con franja decorativa
  page.drawRectangle({
    x: margenX,
    y: height - 42,
    width: anchoUtil,
    height: 4,
    color: rgb(0.08, 0.22, 0.44), // Azul institucional
  });

  page.drawText('INSTITUTO DE EDUCACIÓN SUPERIOR TECNOLÓGICO PÚBLICO "SUIZA"', {
    x: margenX,
    y: height - 60,
    size: 11,
    font: fontBold,
    color: rgb(0.06, 0.16, 0.36),
  });

  page.drawText('SISTEMA INTEGRAL DE GESTIÓN DOCUMENTARIA (SIGD 2026) — CASILLA ELECTRÓNICA CIUDADANA', {
    x: margenX,
    y: height - 74,
    size: 8,
    font,
    color: rgb(0.3, 0.35, 0.4),
  });

  page.drawText('CONSTANCIA OFICIAL DE DILIGENCIAMIENTO Y RECEPCIÓN DE NOTIFICACIÓN ELECTRÓNICA', {
    x: margenX,
    y: height - 86,
    size: 7.5,
    font: fontBold,
    color: rgb(0.2, 0.5, 0.3),
  });

  page.drawLine({
    start: { x: margenX, y: height - 95 },
    end: { x: width - margenX, y: height - 95 },
    thickness: 1,
    color: rgb(0.8, 0.85, 0.9),
  });

  // 2. Título de la Cédula
  page.drawText('CÉDULA DE ACUSE DE NOTIFICACIÓN ELECTRÓNICA', {
    x: margenX,
    y: height - 120,
    size: 13,
    font: fontBold,
    color: rgb(0.05, 0.18, 0.4),
  });

  // Distintivo de Validez Legal
  page.drawRectangle({
    x: margenX,
    y: height - 146,
    width: anchoUtil,
    height: 20,
    color: rgb(0.92, 0.98, 0.94),
    borderColor: rgb(0.4, 0.75, 0.5),
    borderWidth: 0.8,
  });

  page.drawText('VALIDEZ JURÍDICA PLENA — ART. 20 DEL TUO DE LA LEY N° 27444 (LPAG) Y LEY N° 29733', {
    x: margenX + 10,
    y: height - 141,
    size: 7.5,
    font: fontBold,
    color: rgb(0.08, 0.45, 0.22),
  });

  let curY = height - 170;

  // Función auxiliar para renderizar títulos de sección
  const dibujarTituloSeccion = (titulo: string) => {
    page.drawRectangle({
      x: margenX,
      y: curY - 2,
      width: anchoUtil,
      height: 16,
      color: rgb(0.94, 0.96, 0.98),
      borderColor: rgb(0.8, 0.85, 0.9),
      borderWidth: 0.5,
    });
    page.drawText(titulo, {
      x: margenX + 8,
      y: curY + 2,
      size: 8.5,
      font: fontBold,
      color: rgb(0.1, 0.2, 0.38),
    });
    curY -= 20;
  };

  // Función auxiliar para filas de datos clave/valor
  const dibujarFilaDato = (etiqueta: string, valor: string, esMono: boolean = false) => {
    page.drawText(etiqueta, {
      x: margenX + 8,
      y: curY,
      size: 8,
      font: fontBold,
      color: rgb(0.25, 0.3, 0.35),
    });
    page.drawText(valor, {
      x: margenX + 190,
      y: curY,
      size: esMono ? 7.5 : 8,
      font: esMono ? fontMono : font,
      color: rgb(0.1, 0.1, 0.1),
    });
    curY -= 14;
  };

  // SECCIÓN 1: DATOS DEL ACUSE OFICIAL
  dibujarTituloSeccion('1. DATOS DEL ACUSE DE NOTIFICACIÓN ELECTRÓNICA');
  dibujarFilaDato('Identificador Oficial de Acuse:', datos.idAcuse, true);
  dibujarFilaDato('CVD de Verificación del Acuse:', datos.cvdAcuse, true);
  dibujarFilaDato('Timestamp Oficial Servidor (ISO-8601):', formatearFechaIso(datos.acuseSelladoTiempo), true);
  dibujarFilaDato('Fecha y Hora Local Certificada (Perú):', formatearFechaLocal(datos.acuseSelladoTiempo));
  dibujarFilaDato('Hash SHA-256 del Acuse (Inmutable):', datos.acuseHashSha256, true);
  curY -= 6;

  // SECCIÓN 2: EXPEDIENTE Y ACTO ADMINISTRATIVO DILIGENCIADO
  dibujarTituloSeccion('2. EXPEDIENTE Y ACTO ADMINISTRATIVO NOTIFICADO');
  dibujarFilaDato('Código Único de Trámite (CUT):', datos.cut, true);
  dibujarFilaDato('Identificador de Notificación:', datos.idNotificacion, true);
  dibujarFilaDato('Tipo de Acto Notificado:', datos.tipoActo);
  dibujarFilaDato('Asunto del Acto:', datos.asunto.slice(0, 95));
  dibujarFilaDato('Fecha de Depósito en Casilla:', formatearFechaLocal(datos.fechaDeposito));
  if (datos.cvdActoNotificado) {
    dibujarFilaDato('CVD del Acto Notificado:', datos.cvdActoNotificado, true);
  }
  if (datos.hashActoNotificado) {
    dibujarFilaDato('Hash SHA-256 del Acto Notificado:', datos.hashActoNotificado, true);
  }
  curY -= 6;

  // SECCIÓN 3: DATOS DEL ADMINISTRADO (DESTINATARIO)
  dibujarTituloSeccion('3. DATOS DEL DESTINATARIO (ADMINISTRADO)');
  dibujarFilaDato('Nombre / Razón Social:', datos.destinatario.nombresCompletos);
  dibujarFilaDato('Documento de Identidad:', `${datos.destinatario.tipoDocumento} ${datos.destinatario.numeroDocumento}`, true);
  if (datos.destinatario.correoPersonal) {
    dibujarFilaDato('Correo Registrado:', datos.destinatario.correoPersonal);
  }
  dibujarFilaDato('Canal Oficial de Entrega:', 'Casilla Electrónica Ciudadana (IESTP Suiza)');
  curY -= 8;

  // SECCIÓN 4: EFECTOS JURÍDICOS Y CÓMPUTO DE PLAZOS (MARCO LEGAL LPAG)
  dibujarTituloSeccion('4. EFECTOS JURÍDICOS Y CÓMPUTO DE PLAZOS (TUO LEY N° 27444)');

  page.drawRectangle({
    x: margenX,
    y: curY - 78,
    width: anchoUtil,
    height: 82,
    color: rgb(0.97, 0.99, 0.97),
    borderColor: rgb(0.7, 0.85, 0.75),
    borderWidth: 0.8,
  });

  const textosLegales = [
    '• SURTIMIENTO DE EFECTOS (Art. 20, num. 20.4 LPAG): La notificación electrónica surte plenos efectos legales',
    '  el mismo día en que se genera y sella el presente acuse de recibo en la Casilla Electrónica del administrado.',
    '• CÓMPUTO DE PLAZOS ADMINISTRATIVOS: El cómputo de los plazos para la interposición de recursos',
    '  administrativos (15 días hábiles conforme al Art. 218) o subsanación de observaciones se inicia a partir del',
    '  primer día hábil siguiente a la fecha consignada en este acuse de recepción.',
    '• INMUTABILIDAD Y FECHA CIERTA: Este acuse digital constituye plena prueba fehaciente de la fecha y hora de',
    '  recepción, certificado mediante hash criptográfico SHA-256 y Código de Verificación Digital (CVD).',
  ];

  let legalY = curY - 8;
  for (const linea of textosLegales) {
    page.drawText(linea, {
      x: margenX + 8,
      y: legalY,
      size: 7,
      font: linea.startsWith('•') ? fontBold : font,
      color: rgb(0.12, 0.35, 0.18),
    });
    legalY -= 10.5;
  }

  // 5. Pie de página institucional
  page.drawLine({
    start: { x: margenX, y: 55 },
    end: { x: width - margenX, y: 55 },
    thickness: 0.6,
    color: rgb(0.75, 0.8, 0.85),
  });

  page.drawText('Documento emitido electrónicamente por el IESTP "Suiza" (Pucallpa, Ucayali) conforme a la Ley N° 27444 y Ley N° 29733.', {
    x: margenX,
    y: 42,
    size: 7,
    font,
    color: rgb(0.4, 0.45, 0.5),
  });

  page.drawText(`Verificación oficial en portal institucional mediante CVD: ${datos.cvdAcuse}`, {
    x: margenX,
    y: 31,
    size: 7,
    font: fontBold,
    color: rgb(0.1, 0.25, 0.45),
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
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
    fecha_deposito: Date | string;
    hash_sha256: string | null;
    cvd: string | null;
    id_acuse: string | null;
    acuse_hash_sha256: string | null;
    acuse_sellado_tiempo: Date | string | null;
    documento_url: string | null;
    cuerpo: any;
  }>(
    `SELECT id, usuario_id, persona_id, correo_destinatario, cut, asunto, tipo_acto,
            fecha_deposito, hash_sha256, cvd, id_acuse, acuse_hash_sha256,
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
