import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export interface DatosFutDigital {
  solicitante: string;
  tipoDocumento: string;
  numeroDocumento: string;
  correo: string;
  celular?: string;
  direccion?: string;
  procedimiento: string;
  asunto: string;
  fecha?: Date;
}

/**
 * Genera automáticamente el Formulario Único de Trámite Digital (FUT Digital) en formato PDF
 * para trámites que no requieren requisitos documentales externos conforme al TUPA oficial vigente.
 * Base legal: Art. 113 del TUO de la Ley N° 27444 (LPAG — D.S. N.° 006-2026-JUS).
 */
export async function generarFutDigitalBase64(datos: DatosFutDigital): Promise<string> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // Tamaño estándar A4
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();

  // 1. Cabecera Institucional Azul Oficial IESTP "Suiza"
  page.drawRectangle({
    x: 40,
    y: height - 85,
    width: width - 80,
    height: 50,
    color: rgb(0.02, 0.22, 0.45),
  });

  // Franja Tricolor institucional superior
  page.drawRectangle({ x: 40, y: height - 38, width: (width - 80) / 3, height: 3, color: rgb(0.0, 0.45, 0.74) });
  page.drawRectangle({ x: 40 + (width - 80) / 3, y: height - 38, width: (width - 80) / 3, height: 3, color: rgb(0.9, 0.0, 0.49) });
  page.drawRectangle({ x: 40 + ((width - 80) / 3) * 2, y: height - 38, width: (width - 80) / 3, height: 3, color: rgb(0.98, 0.88, 0.0) });

  page.drawText('INSTITUTO DE EDUCACIÓN SUPERIOR TECNOLÓGICO PÚBLICO "SUIZA"', {
    x: 50,
    y: height - 58,
    size: 11,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText('MESA DE PARTES DIGITAL — FORMULARIO ÚNICO DE TRÁMITE DIGITAL (FUT)', {
    x: 50,
    y: height - 74,
    size: 9,
    font: fontRegular,
    color: rgb(0.92, 0.95, 1.0),
  });

  // Fecha y Base Legal
  const fechaStr = (datos.fecha || new Date()).toLocaleString('es-PE', {
    dateStyle: 'long',
    timeStyle: 'medium',
  });
  page.drawText(`Fecha y Hora de Radicación Digital: ${fechaStr}`, {
    x: 42,
    y: height - 102,
    size: 8.5,
    font: fontRegular,
    color: rgb(0.3, 0.35, 0.4),
  });

  page.drawText('Base Legal: Art. 113 del TUO de la Ley N° 27444 (LPAG — D.S. N.° 006-2026-JUS)', {
    x: 42,
    y: height - 116,
    size: 8,
    font: fontRegular,
    color: rgb(0.45, 0.5, 0.55),
  });

  // SECCIÓN I: DATOS DEL ADMINISTRADO
  let y = height - 142;
  page.drawRectangle({ x: 40, y: y - 5, width: width - 80, height: 18, color: rgb(0.93, 0.96, 0.99) });
  page.drawText('I. DATOS DEL ADMINISTRADO (SOLICITANTE)', {
    x: 48,
    y,
    size: 8.5,
    font: fontBold,
    color: rgb(0.04, 0.22, 0.45),
  });

  y -= 22;
  page.drawText('Nombres y Apellidos / Razón Social:', { x: 48, y, size: 8.5, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
  page.drawText(`${datos.solicitante}`, { x: 235, y, size: 8.5, font: fontRegular, color: rgb(0, 0, 0) });

  y -= 16;
  page.drawText(`Documento de Identidad (${datos.tipoDocumento}):`, { x: 48, y, size: 8.5, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
  page.drawText(`${datos.numeroDocumento}`, { x: 235, y, size: 8.5, font: fontRegular, color: rgb(0, 0, 0) });

  y -= 16;
  page.drawText('Correo Electrónico Notificable:', { x: 48, y, size: 8.5, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
  page.drawText(`${datos.correo}`, { x: 235, y, size: 8.5, font: fontRegular, color: rgb(0, 0, 0) });

  if (datos.celular) {
    y -= 16;
    page.drawText('Teléfono / Celular de Contacto:', { x: 48, y, size: 8.5, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(`${datos.celular}`, { x: 235, y, size: 8.5, font: fontRegular, color: rgb(0, 0, 0) });
  }

  if (datos.direccion) {
    y -= 16;
    page.drawText('Dirección / Domicilio:', { x: 48, y, size: 8.5, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(`${datos.direccion.slice(0, 60)}`, { x: 235, y, size: 8.5, font: fontRegular, color: rgb(0, 0, 0) });
  }

  // SECCIÓN II: DETALLE DEL PROCEDIMIENTO Y PETITORIO
  y -= 26;
  page.drawRectangle({ x: 40, y: y - 5, width: width - 80, height: 18, color: rgb(0.93, 0.96, 0.99) });
  page.drawText('II. PROCEDIMIENTO Y PETITORIO CONCRETO (CATÁLOGO TUPA)', {
    x: 48,
    y,
    size: 8.5,
    font: fontBold,
    color: rgb(0.04, 0.22, 0.45),
  });

  y -= 22;
  page.drawText('Procedimiento TUPA Seleccionado:', { x: 48, y, size: 8.5, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
  page.drawText(`${datos.procedimiento.slice(0, 68)}`, { x: 235, y, size: 8.5, font: fontRegular, color: rgb(0, 0, 0) });

  y -= 22;
  page.drawText('Fundamentación del Petitorio / Asunto Formal:', { x: 48, y, size: 8.5, font: fontBold, color: rgb(0.2, 0.2, 0.2) });

  y -= 16;
  const lineasPetitorio = wrapText(datos.asunto, 85);
  for (const linea of lineasPetitorio.slice(0, 10)) {
    page.drawText(linea, { x: 55, y, size: 8.5, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
    y -= 14;
  }

  // SECCIÓN III: DECLARACIÓN JURADA Y FOLIACIÓN
  y -= 24;
  page.drawRectangle({ x: 40, y: y - 5, width: width - 80, height: 18, color: rgb(0.93, 0.96, 0.99) });
  page.drawText('III. DECLARACIÓN JURADA Y CONSTANCIA DE FOLIACIÓN DIGITAL', {
    x: 48,
    y,
    size: 8.5,
    font: fontBold,
    color: rgb(0.04, 0.22, 0.45),
  });

  y -= 20;
  const textoDeclaracion = [
    '1. El administrado declara bajo juramento la autenticidad de los datos consignados en la presente solicitud,',
    '   sujetándose al Principio de Presunción de Veracidad (Art. IV, numeral 1.7 del TUO de la Ley N° 27444).',
    '2. Conforme al TUPA oficial vigente, este procedimiento no requiere anexos documentales externos obligatorios.',
    '3. Este documento generado digitalmente constituye la Solicitud Principal formal y corresponde al Folio N° 001',
    '   del expediente administrativo institucional.',
  ];

  for (const l of textoDeclaracion) {
    page.drawText(l, { x: 48, y, size: 8, font: fontRegular, color: rgb(0.3, 0.35, 0.4) });
    y -= 12;
  }

  // Cuadro de Sello Digital al pie
  y -= 20;
  page.drawRectangle({
    x: 40,
    y: y - 35,
    width: width - 80,
    height: 40,
    borderWidth: 1,
    borderColor: rgb(0.8, 0.85, 0.9),
    color: rgb(0.98, 0.99, 1.0),
  });

  page.drawText('DOCUMENTO EMITIDO POR LA SEDE DIGITAL OFICIAL — IESTP "SUIZA" DE PUCALLPA', {
    x: 50,
    y: y - 12,
    size: 8,
    font: fontBold,
    color: rgb(0.04, 0.22, 0.45),
  });

  page.drawText('Validez legal acreditada mediante firma electrónica y código único de cargo digital (CVD).', {
    x: 50,
    y: y - 25,
    size: 7.5,
    font: fontRegular,
    color: rgb(0.4, 0.45, 0.5),
  });

  const pdfBytes = await pdfDoc.save();
  return bufferToBase64(pdfBytes);
}

function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if ((current + ' ' + word).trim().length <= maxCharsPerLine) {
      current = (current + ' ' + word).trim();
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function bufferToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
