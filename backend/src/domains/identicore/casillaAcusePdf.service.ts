/**
 * TSK-DEV-05.3: Servicio de Generación de Cédula y Certificado Oficial de Acuse
 * de Notificación Electrónica en PDF para Casilla Ciudadana.
 *
 * Cumplimiento normativo vigente a noviembre de 2026:
 * - D.S. N° 006-2026-JUS (TUO de la Ley N° 27444 - LPAG), Arts. 20, 24, 25, 134, 207.2 y 218.
 * - Ley N° 31736 (Ley de Notificación Administrativa mediante Casilla Electrónica), Arts. 5.2, 5.3, 5.4 y 5.6.
 * - Ley N° 27269 (Firmas y Certificados Digitales).
 * - Ley N° 29733 (Protección de Datos Personales).
 * - Directiva Institucional de Casilla Electrónica - IESTP «Suiza» (Pucallpa, Ucayali).
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export interface DatosAcusePdf {
  idAcuse: string;
  cut: string;
  numeroDocumento: string;
  asunto: string;
  tipoActo: string;
  destinatario: {
    nombresCompletos: string;
    numeroDocumento: string;
    tipoDocumento: string;
    direccionCasilla: string;
  };
  entidadEmisora: string;
  unidadEmisora: string;
  fechaDepositoIso: string;
  fechaEfectoLegalIso: string;
  fechaInicioImpugnacionIso?: string;
  fechaAcuseIso: string;
  cvdAcuse: string;
  hashSha256Acuse: string;
  plazoImpugnacionDiasHabiles: number;
  fechaLimiteImpugnacionIso: string;
  notificacionId: string;
}

function formatearFechaLima(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return isoString;
    return new Intl.DateTimeFormat('es-PE', {
      timeZone: 'America/Lima',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(d) + ' (Hora de Lima)';
  } catch {
    return isoString;
  }
}

function formatearSoloFecha(isoDate: string): string {
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
      const [y, m, d] = isoDate.split('-');
      return `${d}/${m}/${y}`;
    }
    const dateObj = new Date(isoDate);
    return new Intl.DateTimeFormat('es-PE', {
      timeZone: 'America/Lima',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(dateObj);
  } catch {
    return isoDate;
  }
}

function limpiarTexto(str: string | null | undefined): string {
  if (str == null) return '';
  return String(str).replace(/[^\x20-\x7E\u00A0-\u00FF]/gu, (c) => `\\u{${c.codePointAt(0)?.toString(16)}}`);
}

export async function generarCertificadoAcusePdf(datos: DatosAcusePdf): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Certificado de Acuse Notificatorio Digital - ${datos.idAcuse}`);
  pdf.setAuthor('IESTP «Suiza» - Sistema Integral de Gestión Documentaria');
  pdf.setSubject(`Acuse de Notificación Oficial - Expediente ${datos.cut}`);
  pdf.setKeywords(['SIGD', 'Casilla Electrónica', 'Acuse Legal', 'LPAG', 'IESTP Suiza', datos.idAcuse]);
  pdf.setCreationDate(new Date(datos.fechaAcuseIso));
  pdf.setModificationDate(new Date(datos.fechaAcuseIso));

  // Página A4 estándar: 595.28 x 841.89 puntos
  const pagina = pdf.addPage([595.28, 841.89]);
  const fontNormal = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fontMono = await pdf.embedFont(StandardFonts.Courier);

  const ancho = 595.28;
  const alto = 841.89;
  const margen = 40;
  const anchoUtil = ancho - margen * 2;

  // Fondo y marco exterior
  pagina.drawRectangle({
    x: margen - 10,
    y: margen - 10,
    width: anchoUtil + 20,
    height: alto - (margen - 10) * 2,
    borderWidth: 1.5,
    borderColor: rgb(0.12, 0.25, 0.45),
    color: rgb(0.99, 0.99, 1.0),
  });

  // Franja superior institucional
  pagina.drawRectangle({
    x: margen - 10,
    y: alto - margen - 65,
    width: anchoUtil + 20,
    height: 75,
    color: rgb(0.08, 0.22, 0.42),
  });

  pagina.drawText('INSTITUTO DE EDUCACIÓN SUPERIOR TECNOLÓGICO PÚBLICO «SUIZA»', {
    x: margen + 10,
    y: alto - margen - 18,
    size: 11,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  pagina.drawText('SISTEMA INTEGRAL DE GESTIÓN DOCUMENTARIA — SIGD RENATO', {
    x: margen + 10,
    y: alto - margen - 32,
    size: 9,
    font: fontNormal,
    color: rgb(0.8, 0.9, 1.0),
  });

  pagina.drawText('CONSTANCIA Y CÉDULA OFICIAL DE ACUSE DE NOTIFICACIÓN ELECTRÓNICA', {
    x: margen + 10,
    y: alto - margen - 50,
    size: 10,
    font: fontBold,
    color: rgb(1, 0.85, 0.3),
  });

  let y = alto - margen - 95;

  // Cuadro resumen de identificación
  pagina.drawRectangle({
    x: margen,
    y: y - 35,
    width: anchoUtil,
    height: 45,
    color: rgb(0.93, 0.96, 1.0),
    borderColor: rgb(0.7, 0.82, 0.95),
    borderWidth: 1,
  });

  pagina.drawText(`IDENTIFICADOR DE ACUSE: ${limpiarTexto(datos.idAcuse)}`, {
    x: margen + 12,
    y: y - 12,
    size: 10,
    font: fontBold,
    color: rgb(0.08, 0.25, 0.55),
  });

  pagina.drawText(`EXPEDIENTE (CUT): ${limpiarTexto(datos.cut)}`, {
    x: margen + 12,
    y: y - 27,
    size: 9.5,
    font: fontBold,
    color: rgb(0.2, 0.2, 0.2),
  });

  pagina.drawText(`CVD DEL ACUSE: ${limpiarTexto(datos.cvdAcuse)}`, {
    x: margen + 260,
    y: y - 12,
    size: 9.5,
    font: fontBold,
    color: rgb(0.1, 0.4, 0.2),
  });

  pagina.drawText(`ESTADO: NOTIFICADO CON ACUSE LEGAL`, {
    x: margen + 260,
    y: y - 27,
    size: 9,
    font: fontBold,
    color: rgb(0.05, 0.5, 0.2),
  });

  y -= 60;

  // Sección 1: Acto Administrativo Notificado
  const dibujarSeccion = (titulo: string, posY: number) => {
    pagina.drawRectangle({
      x: margen,
      y: posY - 6,
      width: anchoUtil,
      height: 18,
      color: rgb(0.15, 0.28, 0.48),
    });
    pagina.drawText(titulo, {
      x: margen + 8,
      y: posY - 2,
      size: 9,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
    return posY - 22;
  };

  y = dibujarSeccion('1. DATOS DEL ACTO ADMINISTRATIVO NOTIFICADO', y);

  const dibujarFilaClaveValor = (clave: string, valor: string, posY: number, esMono = false) => {
    pagina.drawText(limpiarTexto(clave), {
      x: margen + 6,
      y: posY,
      size: 8.5,
      font: fontBold,
      color: rgb(0.25, 0.25, 0.3),
    });
    pagina.drawText(limpiarTexto(valor), {
      x: margen + 160,
      y: posY,
      size: 8.5,
      font: esMono ? fontMono : fontNormal,
      color: rgb(0.1, 0.1, 0.1),
    });
    return posY - 14;
  };

  y = dibujarFilaClaveValor('Acto Administrativo:', datos.tipoActo, y);
  y = dibujarFilaClaveValor('Número de Documento:', datos.numeroDocumento, y);
  y = dibujarFilaClaveValor('Entidad Emisora:', datos.entidadEmisora, y);
  y = dibujarFilaClaveValor('Unidad Emisora:', datos.unidadEmisora, y);
  y = dibujarFilaClaveValor('Asunto:', datos.asunto.slice(0, 75), y);
  if (datos.asunto.length > 75) {
    y = dibujarFilaClaveValor('', datos.asunto.slice(75, 150), y);
  }

  y -= 8;

  // Sección 2: Identificación del Administrado Destinatario
  y = dibujarSeccion('2. DESTINATARIO Y DOMICILIO DIGITAL (CASILLA CIUDADANA)', y);
  y = dibujarFilaClaveValor('Nombres y Apellidos / Razón Social:', datos.destinatario.nombresCompletos, y);
  y = dibujarFilaClaveValor('Documento de Identidad:', `${datos.destinatario.tipoDocumento} ${datos.destinatario.numeroDocumento}`, y);
  y = dibujarFilaClaveValor('Dirección de Casilla Electrónica:', datos.destinatario.direccionCasilla, y, true);

  y -= 8;

  // Sección 3: Cómputo Legal de Plazos y Eficacia (Ley N° 31736 y D.S. N° 006-2026-JUS)
  y = dibujarSeccion('3. CÓMPUTO LEGAL DE PLAZOS Y EFICACIA (LEY N° 31736 Y D.S. N° 006-2026-JUS)', y);
  y = dibujarFilaClaveValor('Fecha y Hora de Depósito en Buzón:', formatearFechaLima(datos.fechaDepositoIso), y);
  y = dibujarFilaClaveValor('Fecha de Adquisición de Eficacia (Art. 5.2):', formatearSoloFecha(datos.fechaEfectoLegalIso), y);
  y = dibujarFilaClaveValor('Inicio del Cómputo - Día 1 (Art. 5.3):', formatearSoloFecha(datos.fechaInicioImpugnacionIso ?? datos.fechaEfectoLegalIso), y);
  y = dibujarFilaClaveValor('Plazo para Recursos (Art. 207.2 TUO):', `${datos.plazoImpugnacionDiasHabiles} días hábiles perentorios`, y);
  y = dibujarFilaClaveValor('Fecha Límite para Impugnación:', formatearSoloFecha(datos.fechaLimiteImpugnacionIso), y);

  // Cuadro informativo de base legal
  pagina.drawRectangle({
    x: margen + 6,
    y: y - 26,
    width: anchoUtil - 12,
    height: 30,
    color: rgb(0.98, 0.98, 0.95),
    borderColor: rgb(0.85, 0.85, 0.75),
    borderWidth: 0.8,
  });

  const textoBaseLegal = 'Base Legal: D.S. N° 006-2026-JUS (Arts. 20, 25, 134, 207.2 y 218) y Ley N° 31736 (Arts. 5.2, 5.3 y 5.6). '
    + 'El cómputo de 15 días hábiles inicia el día de eficacia (Día 1), excluyendo días inhábiles y feriados de Ucayali. Agotamiento de la vía: Art. 218.';
  pagina.drawText(limpiarTexto(textoBaseLegal.slice(0, 95)), {
    x: margen + 12,
    y: y - 10,
    size: 7.2,
    font: fontNormal,
    color: rgb(0.3, 0.3, 0.3),
  });
  pagina.drawText(limpiarTexto(textoBaseLegal.slice(95)), {
    x: margen + 12,
    y: y - 20,
    size: 7.2,
    font: fontNormal,
    color: rgb(0.3, 0.3, 0.3),
  });

  y -= 42;

  // Sección 4: Certificación Digital del Acuse de Recibo
  y = dibujarSeccion('4. CONSTANCIA FEHACIENTE DE CONFIRMACIÓN DE RECEPCIÓN (ACUSE)', y);
  y = dibujarFilaClaveValor('Sellado de Tiempo de Confirmación:', formatearFechaLima(datos.fechaAcuseIso), y);
  y = dibujarFilaClaveValor('Identificador Único de Acuse:', datos.idAcuse, y, true);
  y = dibujarFilaClaveValor('Código de Verificación Digital (CVD):', datos.cvdAcuse, y, true);

  // Hash SHA-256 en bloque destacado
  pagina.drawText('Hash SHA-256 del Registro de Acuse:', {
    x: margen + 6,
    y,
    size: 8.5,
    font: fontBold,
    color: rgb(0.25, 0.25, 0.3),
  });
  y -= 14;

  pagina.drawRectangle({
    x: margen + 6,
    y: y - 6,
    width: anchoUtil - 12,
    height: 18,
    color: rgb(0.06, 0.1, 0.16),
  });

  pagina.drawText(datos.hashSha256Acuse, {
    x: margen + 12,
    y: y - 2,
    size: 7.5,
    font: fontMono,
    color: rgb(0.2, 0.95, 0.5),
  });

  y -= 30;

  // Nota de declaración de consentimiento y validez probatoria
  const textoValidez = 'DECLARACIÓN: El administrado destinatario ha registrado válidamente la confirmación de recepción '
    + 'en su Casilla Electrónica Institucional conforme a la Ley N° 31736 (Art. 5.6) y el D.S. N° 006-2026-JUS. '
    + 'La presente constancia goza de fe pública administrativa y pleno valor probatorio en sede administrativa y judicial.';

  pagina.drawText(limpiarTexto(textoValidez.slice(0, 105)), {
    x: margen + 6,
    y: y,
    size: 7,
    font: fontNormal,
    color: rgb(0.35, 0.35, 0.35),
  });
  pagina.drawText(limpiarTexto(textoValidez.slice(105)), {
    x: margen + 6,
    y: y - 9,
    size: 7,
    font: fontNormal,
    color: rgb(0.35, 0.35, 0.35),
  });

  // Pie de página con verificación CVD
  const yPie = margen + 12;
  pagina.drawLine({
    start: { x: margen, y: yPie + 16 },
    end: { x: ancho - margen, y: yPie + 16 },
    thickness: 0.8,
    color: rgb(0.7, 0.75, 0.8),
  });

  pagina.drawText('IESTP «Suiza» — Jr. Guillermo Sisley N° 1200, Pucallpa, Ucayali | Verificación: /api/v1/validador-cvd/verificar/' + datos.cvdAcuse, {
    x: margen,
    y: yPie + 4,
    size: 7.5,
    font: fontNormal,
    color: rgb(0.4, 0.45, 0.5),
  });

  pagina.drawText(`Documento oficial inmutable expedido el ${formatearSoloFecha(datos.fechaAcuseIso)} — Página 1 de 1`, {
    x: margen,
    y: yPie - 6,
    size: 7,
    font: fontNormal,
    color: rgb(0.5, 0.55, 0.6),
  });

  const pdfBytes = await pdf.save();
  return Buffer.from(pdfBytes);
}
