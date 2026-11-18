import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage, type RGB } from 'pdf-lib';
import * as QRCode from 'qrcode';

export const INSTITUCION_NOMBRE = 'INSTITUTO DE EDUCACIÓN SUPERIOR TECNOLÓGICO PÚBLICO "SUIZA"';
export const INSTITUCION_SIGLA = 'IESTP "SUIZA"';
export const INSTITUCION_DIRECCION = 'Av. Túpac Amaru s/n, Pucallpa – Ucayali';
export const INSTITUCION_SISTEMA = 'Sistema Integral de Gestión Documentaria (SIGD)';

const A4_ANCHO = 595.28;
const A4_ALTO = 841.89;
const MARGEN_X = 48;
const MARGEN_SUPERIOR = 42;
const MARGEN_INFERIOR = 54;
const ANCHO_CONTENIDO = A4_ANCHO - MARGEN_X * 2;

export const COLOR_NAVY = rgb(0.08, 0.22, 0.39);
export const COLOR_TEXTO = rgb(0.11, 0.14, 0.18);
export const COLOR_SECUNDARIO = rgb(0.36, 0.41, 0.48);
export const COLOR_BORDE = rgb(0.79, 0.83, 0.88);
export const COLOR_FONDO_SUAVE = rgb(0.95, 0.97, 0.99);
export const COLOR_FONDO_FILA = rgb(0.985, 0.99, 0.995);
export const COLOR_FONDO_AVISO = rgb(0.99, 0.96, 0.88);
export const COLOR_BORDE_AVISO = rgb(0.84, 0.65, 0.20);

let logoSuizaCache: Uint8Array | null | undefined;

/**
 * Carga y almacena en caché el escudo oficial en PNG del IESTP "Suiza".
 */
export function cargarLogoInstitucionalPng(): Uint8Array | undefined {
  if (logoSuizaCache !== undefined) {
    return logoSuizaCache ?? undefined;
  }
  const actualDir = path.dirname(fileURLToPath(import.meta.url));
  const candidatos = [
    path.resolve(actualDir, '../../../assets/logo-suiza.png'),
    path.resolve(actualDir, '../../../../assets/logo-suiza.png'),
    path.resolve(process.cwd(), 'assets/logo-suiza.png'),
    path.resolve(process.cwd(), 'backend/assets/logo-suiza.png'),
    path.resolve(process.cwd(), '../frontend/src/assets/sigd/logo-suiza.png'),
    path.resolve(process.cwd(), 'frontend/src/assets/sigd/logo-suiza.png'),
  ];
  for (const ruta of candidatos) {
    try {
      if (fs.existsSync(ruta)) {
        logoSuizaCache = new Uint8Array(fs.readFileSync(ruta));
        return logoSuizaCache;
      }
    } catch {
      // Continuar con el siguiente candidato
    }
  }
  logoSuizaCache = null;
  return undefined;
}

/**
 * Normaliza caracteres fuera del rango WinAnsi para evitar excepciones en fuentes Type1.
 */
export function sanitizarTextoWinAnsi(texto: string): string {
  return String(texto ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\u2192\u2794]/g, '->')
    .replace(/[\u2713\u2714]/g, '[OK]')
    .replace(/[\u26A0]/g, '[!]')
    .replace(/[\u2010-\u2012\u2212]/g, '-')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[^\x09\x0A\x20-\x7E\xA0-\xFF\u2013\u2014\u2018\u2019\u201C\u201D\u2022\u2026\u20AC]/g, ' ');
}

/**
 * Envuelve un texto respetando saltos de línea y partiendo tokens largos sin espacios.
 */
export function envolverLineasPdf(
  texto: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number,
): string[] {
  const limpio = sanitizarTextoWinAnsi(texto);
  const anchoEfectivo = Math.max(fontSize * 2, maxWidth);
  const resultado: string[] = [];

  for (const parrafo of limpio.split('\n')) {
    const trimmed = parrafo.trim();
    if (!trimmed) {
      resultado.push('');
      continue;
    }

    const palabras = trimmed.split(/\s+/);
    let lineaActual = '';

    for (const palabra of palabras) {
      const tentativa = lineaActual ? `${lineaActual} ${palabra}` : palabra;
      if (font.widthOfTextAtSize(tentativa, fontSize) <= anchoEfectivo) {
        lineaActual = tentativa;
        continue;
      }

      if (lineaActual) {
        resultado.push(lineaActual);
        lineaActual = '';
      }

      if (font.widthOfTextAtSize(palabra, fontSize) <= anchoEfectivo) {
        lineaActual = palabra;
        continue;
      }

      // Cortar token largo (hash SHA-256, URL, identificador sin espacios)
      let fragmento = '';
      for (const ch of palabra) {
        const intento = fragmento + ch;
        if (fragmento && font.widthOfTextAtSize(intento, fontSize) > anchoEfectivo) {
          resultado.push(fragmento);
          fragmento = ch;
        } else {
          fragmento = intento;
        }
      }
      if (fragmento) {
        lineaActual = fragmento;
      }
    }

    if (lineaActual) {
      resultado.push(lineaActual);
    }
  }

  return resultado.length > 0 ? resultado : [''];
}

/**
 * Genera una imagen QR en PNG para incrustar en documentos PDF A4.
 */
export async function generarQrPngBuffer(contenido: string, width = 220): Promise<Buffer> {
  const dataUrl = await QRCode.toDataURL(contenido, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width,
  });
  const base64 = dataUrl.split(',')[1];
  if (!base64) {
    throw new Error('No se pudo codificar el código QR en formato PNG.');
  }
  return Buffer.from(base64, 'base64');
}

export interface FilaClaveValor {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
}

export interface OpcionesDocumentoInstitucional {
  tituloDocumento: string;
  subtituloDocumento?: string;
  unidadEmisora: string;
  codigoReferencia: string;
  fechaEmisionTexto?: string;
  metadataTitle?: string;
}

/**
 * Constructor estandarizado de documentos administrativos A4 del IESTP "Suiza".
 * Administra membrete oficial con escudo real, tablas paginadas sin desbordes,
 * bloques de texto envueltos y numeración de páginas institucional.
 */
export class A4InstitutionalDocBuilder {
  public readonly doc: PDFDocument;
  public readonly fontNormal: PDFFont;
  public readonly fontBold: PDFFont;
  public readonly fontMono: PDFFont;
  public readonly fontItalic: PDFFont;
  private readonly logoImg?: PDFImage;
  private readonly opts: OpcionesDocumentoInstitucional;
  private readonly pages: PDFPage[] = [];
  private page!: PDFPage;
  private y = A4_ALTO - MARGEN_SUPERIOR;

  private constructor(
    doc: PDFDocument,
    fontNormal: PDFFont,
    fontBold: PDFFont,
    fontMono: PDFFont,
    fontItalic: PDFFont,
    logoImg: PDFImage | undefined,
    opts: OpcionesDocumentoInstitucional,
  ) {
    this.doc = doc;
    this.fontNormal = fontNormal;
    this.fontBold = fontBold;
    this.fontMono = fontMono;
    this.fontItalic = fontItalic;
    this.logoImg = logoImg;
    this.opts = opts;
  }

  public static async create(
    opts: OpcionesDocumentoInstitucional,
  ): Promise<A4InstitutionalDocBuilder> {
    const doc = await PDFDocument.create();
    doc.setTitle(sanitizarTextoWinAnsi(opts.metadataTitle ?? `${opts.tituloDocumento} - ${opts.codigoReferencia}`));
    doc.setAuthor(INSTITUCION_SIGLA);
    doc.setCreator(INSTITUCION_SISTEMA);

    const [fontNormal, fontBold, fontMono, fontItalic] = await Promise.all([
      doc.embedFont(StandardFonts.Helvetica),
      doc.embedFont(StandardFonts.HelveticaBold),
      doc.embedFont(StandardFonts.Courier),
      doc.embedFont(StandardFonts.HelveticaOblique),
    ]);

    const logoBytes = cargarLogoInstitucionalPng();
    const logoImg =
      logoBytes && logoBytes.byteLength > 0
        ? await doc.embedPng(logoBytes).catch(() => undefined)
        : undefined;

    const builder = new A4InstitutionalDocBuilder(
      doc,
      fontNormal,
      fontBold,
      fontMono,
      fontItalic,
      logoImg,
      opts,
    );
    builder.startFirstPage();
    return builder;
  }

  private startFirstPage(): void {
    const page = this.doc.addPage([A4_ANCHO, A4_ALTO]);
    this.pages.push(page);
    this.page = page;

    const topY = A4_ALTO - MARGEN_SUPERIOR;

    // Escudo institucional a la izquierda (proporcional en caja 42x42)
    if (this.logoImg) {
      const dims = this.logoImg.scale(1);
      const ratio = dims.width > 0 && dims.height > 0 ? dims.width / dims.height : 1;
      const box = 42;
      const drawW = ratio >= 1 ? box : box * ratio;
      const drawH = ratio >= 1 ? box / ratio : box;
      page.drawImage(this.logoImg, {
        x: MARGEN_X,
        y: topY - 40 + (box - drawH) / 2,
        width: drawW,
        height: drawH,
      });
    }

    // Textos del membrete centrados en la zona útil (respetando caja de logo de 48pt)
    const textAreaLeft = MARGEN_X + (this.logoImg ? 50 : 0);
    const textAreaRight = A4_ANCHO - MARGEN_X - (this.logoImg ? 50 : 0);
    const drawCenteredHeader = (text: string, yPos: number, size: number, font: PDFFont, color: RGB) => {
      const clean = sanitizarTextoWinAnsi(text);
      const w = font.widthOfTextAtSize(clean, size);
      const centerX = (textAreaLeft + textAreaRight - w) / 2;
      page.drawText(clean, {
        x: Math.max(MARGEN_X, centerX),
        y: yPos,
        size,
        font,
        color,
      });
    };

    drawCenteredHeader(INSTITUCION_NOMBRE, topY - 10, 9.2, this.fontBold, COLOR_NAVY);
    drawCenteredHeader(this.opts.unidadEmisora, topY - 23, 8.5, this.fontBold, COLOR_TEXTO);
    drawCenteredHeader(INSTITUCION_DIRECCION, topY - 35, 7.6, this.fontNormal, COLOR_SECUNDARIO);

    // Doble línea institucional separadora
    const ruleY = topY - 47;
    page.drawLine({
      start: { x: MARGEN_X, y: ruleY },
      end: { x: A4_ANCHO - MARGEN_X, y: ruleY },
      thickness: 1.4,
      color: COLOR_NAVY,
    });
    page.drawLine({
      start: { x: MARGEN_X, y: ruleY - 2.6 },
      end: { x: A4_ANCHO - MARGEN_X, y: ruleY - 2.6 },
      thickness: 0.5,
      color: COLOR_NAVY,
    });

    // Banda de título del documento
    const bannerH = this.opts.subtituloDocumento ? 44 : 36;
    const bannerBottomY = ruleY - 10 - bannerH;
    page.drawRectangle({
      x: MARGEN_X,
      y: bannerBottomY,
      width: ANCHO_CONTENIDO,
      height: bannerH,
      color: COLOR_NAVY,
    });

    page.drawText(sanitizarTextoWinAnsi(this.opts.tituloDocumento), {
      x: MARGEN_X + 12,
      y: bannerBottomY + bannerH - 16,
      size: 11,
      font: this.fontBold,
      color: rgb(1, 1, 1),
    });

    if (this.opts.subtituloDocumento) {
      page.drawText(sanitizarTextoWinAnsi(this.opts.subtituloDocumento), {
        x: MARGEN_X + 12,
        y: bannerBottomY + 10,
        size: 8.2,
        font: this.fontNormal,
        color: rgb(0.86, 0.91, 0.97),
      });
    }

    const refClean = sanitizarTextoWinAnsi(this.opts.codigoReferencia);
    const refW = this.fontBold.widthOfTextAtSize(refClean, 9.5);
    page.drawText(refClean, {
      x: A4_ANCHO - MARGEN_X - 12 - refW,
      y: bannerBottomY + bannerH - 16,
      size: 9.5,
      font: this.fontBold,
      color: rgb(1, 1, 1),
    });

    if (this.opts.fechaEmisionTexto) {
      const fechaClean = sanitizarTextoWinAnsi(this.opts.fechaEmisionTexto);
      const fechaW = this.fontNormal.widthOfTextAtSize(fechaClean, 7.6);
      page.drawText(fechaClean, {
        x: A4_ANCHO - MARGEN_X - 12 - fechaW,
        y: bannerBottomY + 10,
        size: 7.6,
        font: this.fontNormal,
        color: rgb(0.86, 0.91, 0.97),
      });
    }

    this.y = bannerBottomY - 14;
  }

  private startContinuationPage(): void {
    const page = this.doc.addPage([A4_ANCHO, A4_ALTO]);
    this.pages.push(page);
    this.page = page;

    const headerY = A4_ALTO - MARGEN_SUPERIOR;
    const label = sanitizarTextoWinAnsi(
      `${INSTITUCION_SIGLA} · ${this.opts.tituloDocumento} · ${this.opts.codigoReferencia}`,
    );
    page.drawText(label, {
      x: MARGEN_X,
      y: headerY - 8,
      size: 8,
      font: this.fontBold,
      color: COLOR_SECUNDARIO,
    });
    page.drawLine({
      start: { x: MARGEN_X, y: headerY - 14 },
      end: { x: A4_ANCHO - MARGEN_X, y: headerY - 14 },
      thickness: 0.6,
      color: COLOR_BORDE,
    });
    this.y = headerY - 28;
  }

  public ensureSpace(neededHeight: number): void {
    if (this.y - neededHeight < MARGEN_INFERIOR + 10) {
      this.startContinuationPage();
    }
  }

  public drawSectionTitle(titulo: string): void {
    this.ensureSpace(26);
    const barY = this.y - 12;
    this.page.drawRectangle({
      x: MARGEN_X,
      y: barY,
      width: 3,
      height: 12,
      color: COLOR_NAVY,
    });
    this.page.drawText(sanitizarTextoWinAnsi(titulo), {
      x: MARGEN_X + 8,
      y: barY + 2,
      size: 9.3,
      font: this.fontBold,
      color: COLOR_NAVY,
    });
    this.page.drawLine({
      start: { x: MARGEN_X, y: barY - 4 },
      end: { x: A4_ANCHO - MARGEN_X, y: barY - 4 },
      thickness: 0.6,
      color: COLOR_BORDE,
    });
    this.y = barY - 10;
  }

  public drawKeyValueTable(rows: readonly FilaClaveValor[], labelColWidth = 152): void {
    const valueColWidth = ANCHO_CONTENIDO - labelColWidth;
    const padX = 8;
    const padY = 5;
    const lineHeight = 11.5;

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const fontVal = row.mono ? this.fontMono : row.highlight ? this.fontBold : this.fontNormal;
      const sizeVal = row.mono ? 8.0 : 8.6;
      const labelLines = envolverLineasPdf(row.label, this.fontBold, 8.3, labelColWidth - padX * 2);
      const valueLines = envolverLineasPdf(row.value || '—', fontVal, sizeVal, valueColWidth - padX * 2);
      const rowLines = Math.max(labelLines.length, valueLines.length);
      const rowH = rowLines * lineHeight + padY * 2;

      this.ensureSpace(rowH + 2);

      const bottomY = this.y - rowH;
      this.page.drawRectangle({
        x: MARGEN_X,
        y: bottomY,
        width: ANCHO_CONTENIDO,
        height: rowH,
        color: row.highlight ? COLOR_FONDO_SUAVE : i % 2 === 0 ? COLOR_FONDO_FILA : rgb(1, 1, 1),
        borderColor: COLOR_BORDE,
        borderWidth: 0.5,
      });

      this.page.drawLine({
        start: { x: MARGEN_X + labelColWidth, y: bottomY },
        end: { x: MARGEN_X + labelColWidth, y: bottomY + rowH },
        thickness: 0.5,
        color: COLOR_BORDE,
      });

      for (let l = 0; l < labelLines.length; l += 1) {
        this.page.drawText(labelLines[l], {
          x: MARGEN_X + padX,
          y: bottomY + rowH - padY - 8 - l * lineHeight,
          size: 8.3,
          font: this.fontBold,
          color: COLOR_SECUNDARIO,
        });
      }

      for (let v = 0; v < valueLines.length; v += 1) {
        this.page.drawText(valueLines[v], {
          x: MARGEN_X + labelColWidth + padX,
          y: bottomY + rowH - padY - 8 - v * lineHeight,
          size: sizeVal,
          font: fontVal,
          color: row.highlight ? COLOR_NAVY : COLOR_TEXTO,
        });
      }

      this.y = bottomY;
    }

    this.y -= 10;
  }

  public drawParagraph(texto: string, options?: { size?: number; bold?: boolean; indent?: number }): void {
    const size = options?.size ?? 9.2;
    const font = options?.bold ? this.fontBold : this.fontNormal;
    const indent = options?.indent ?? 0;
    const lineHeight = size * 1.38;
    const lines = envolverLineasPdf(texto, font, size, ANCHO_CONTENIDO - indent);

    for (const line of lines) {
      this.ensureSpace(lineHeight + 2);
      if (line) {
        this.page.drawText(line, {
          x: MARGEN_X + indent,
          y: this.y - size,
          size,
          font,
          color: COLOR_TEXTO,
        });
      }
      this.y -= lineHeight;
    }
    this.y -= 6;
  }

  public drawNoticeBox(
    titulo: string,
    parrafos: readonly string[],
    tone: 'info' | 'warn' | 'legal' = 'info',
  ): void {
    const padX = 10;
    const padY = 8;
    const lineHeight = 11.2;
    const wrappedBlocks = parrafos.map((p) =>
      envolverLineasPdf(p, this.fontNormal, 8.2, ANCHO_CONTENIDO - padX * 2),
    );
    const totalBodyLines = wrappedBlocks.reduce((acc, b) => acc + b.length, 0);
    const boxH = padY * 2 + 14 + totalBodyLines * lineHeight + Math.max(0, parrafos.length - 1) * 3;

    this.ensureSpace(boxH + 8);
    const bottomY = this.y - boxH;
    const bgColor = tone === 'warn' ? COLOR_FONDO_AVISO : COLOR_FONDO_SUAVE;
    const borderColor = tone === 'warn' ? COLOR_BORDE_AVISO : COLOR_BORDE;
    const titleColor = tone === 'warn' ? rgb(0.55, 0.34, 0.04) : COLOR_NAVY;

    this.page.drawRectangle({
      x: MARGEN_X,
      y: bottomY,
      width: ANCHO_CONTENIDO,
      height: boxH,
      color: bgColor,
      borderColor,
      borderWidth: 0.75,
    });

    let cursorY = bottomY + boxH - padY - 8;
    this.page.drawText(sanitizarTextoWinAnsi(titulo), {
      x: MARGEN_X + padX,
      y: cursorY,
      size: 8.6,
      font: this.fontBold,
      color: titleColor,
    });
    cursorY -= 13;

    for (let b = 0; b < wrappedBlocks.length; b += 1) {
      for (const line of wrappedBlocks[b]) {
        if (line) {
          this.page.drawText(line, {
            x: MARGEN_X + padX,
            y: cursorY,
            size: 8.1,
            font: this.fontNormal,
            color: COLOR_TEXTO,
          });
        }
        cursorY -= lineHeight;
      }
      cursorY -= 3;
    }

    this.y = bottomY - 10;
  }

  public async drawVerificationCard(params: {
    qrContent: string;
    qrCaption: string;
    titulo: string;
    filas: readonly FilaClaveValor[];
  }): Promise<void> {
    const qrBuf = await generarQrPngBuffer(params.qrContent, 240);
    const qrImg = await this.doc.embedPng(qrBuf);
    const qrSize = 74;
    const leftPaneW = qrSize + 24;
    const rightPaneW = ANCHO_CONTENIDO - leftPaneW - 14;
    const lineHeight = 10.5;

    const prepared = params.filas.map((f) => ({
      label: f.label,
      mono: Boolean(f.mono),
      lines: envolverLineasPdf(
        f.value,
        f.mono ? this.fontMono : this.fontNormal,
        f.mono ? 7.4 : 8.0,
        rightPaneW - 12,
      ),
    }));

    const rightHeight =
      18 +
      prepared.reduce((acc, item) => acc + 10 + item.lines.length * lineHeight + 3, 0) +
      8;
    const cardH = Math.max(qrSize + 34, rightHeight + 10);

    this.ensureSpace(cardH + 8);
    const bottomY = this.y - cardH;

    this.page.drawRectangle({
      x: MARGEN_X,
      y: bottomY,
      width: ANCHO_CONTENIDO,
      height: cardH,
      color: COLOR_FONDO_SUAVE,
      borderColor: COLOR_NAVY,
      borderWidth: 0.75,
    });

    // Columna izquierda: QR centrado
    const qrX = MARGEN_X + 12;
    const qrY = bottomY + cardH - 14 - qrSize;
    this.page.drawRectangle({
      x: qrX - 3,
      y: qrY - 3,
      width: qrSize + 6,
      height: qrSize + 6,
      color: rgb(1, 1, 1),
      borderColor: COLOR_BORDE,
      borderWidth: 0.5,
    });
    this.page.drawImage(qrImg, { x: qrX, y: qrY, width: qrSize, height: qrSize });

    const capLines = envolverLineasPdf(params.qrCaption, this.fontBold, 6.8, leftPaneW - 8);
    capLines.forEach((cap, idx) => {
      const capW = this.fontBold.widthOfTextAtSize(cap, 6.8);
      this.page.drawText(cap, {
        x: qrX + (qrSize - capW) / 2,
        y: qrY - 12 - idx * 8.5,
        size: 6.8,
        font: this.fontBold,
        color: COLOR_NAVY,
      });
    });

    // Separador vertical
    this.page.drawLine({
      start: { x: MARGEN_X + leftPaneW, y: bottomY + 8 },
      end: { x: MARGEN_X + leftPaneW, y: bottomY + cardH - 8 },
      thickness: 0.5,
      color: COLOR_BORDE,
    });

    // Columna derecha: título y metadatos de verificación
    const rightX = MARGEN_X + leftPaneW + 10;
    let cursorY = bottomY + cardH - 16;
    this.page.drawText(sanitizarTextoWinAnsi(params.titulo), {
      x: rightX,
      y: cursorY,
      size: 8.6,
      font: this.fontBold,
      color: COLOR_NAVY,
    });
    cursorY -= 13;

    for (const item of prepared) {
      this.page.drawText(sanitizarTextoWinAnsi(item.label), {
        x: rightX,
        y: cursorY,
        size: 7.4,
        font: this.fontBold,
        color: COLOR_SECUNDARIO,
      });
      cursorY -= 9.5;
      const font = item.mono ? this.fontMono : this.fontNormal;
      const size = item.mono ? 7.3 : 7.9;
      for (const l of item.lines) {
        this.page.drawText(l, {
          x: rightX,
          y: cursorY,
          size,
          font,
          color: COLOR_TEXTO,
        });
        cursorY -= lineHeight;
      }
      cursorY -= 2;
    }

    this.y = bottomY - 10;
  }

  public drawSignatureBlock(cargo: string, responsable: string, entidad?: string): void {
    const blockH = entidad ? 72 : 58;
    this.ensureSpace(blockH + 10);
    this.y -= 18;

    const lineW = 190;
    const centerX = A4_ANCHO / 2;
    this.page.drawLine({
      start: { x: centerX - lineW / 2, y: this.y },
      end: { x: centerX + lineW / 2, y: this.y },
      thickness: 0.75,
      color: COLOR_TEXTO,
    });

    const drawCentered = (txt: string, dy: number, size: number, font: PDFFont, color: RGB) => {
      const clean = sanitizarTextoWinAnsi(txt);
      const w = font.widthOfTextAtSize(clean, size);
      this.page.drawText(clean, {
        x: centerX - w / 2,
        y: this.y - dy,
        size,
        font,
        color,
      });
    };

    drawCentered(cargo, 12, 8.6, this.fontBold, COLOR_NAVY);
    drawCentered(responsable, 24, 8.6, this.fontNormal, COLOR_TEXTO);
    if (entidad) {
      drawCentered(entidad, 35, 7.8, this.fontItalic, COLOR_SECUNDARIO);
    }
    this.y -= blockH - 18;
  }

  public async finalize(leftFooterText: string): Promise<Buffer> {
    const total = this.pages.length;
    const ruleY = 40;
    const textY = 27;

    for (let i = 0; i < total; i += 1) {
      const page = this.pages[i];
      page.drawLine({
        start: { x: MARGEN_X, y: ruleY },
        end: { x: A4_ANCHO - MARGEN_X, y: ruleY },
        thickness: 0.5,
        color: COLOR_BORDE,
      });

      page.drawText(sanitizarTextoWinAnsi(leftFooterText), {
        x: MARGEN_X,
        y: textY,
        size: 7.4,
        font: this.fontNormal,
        color: COLOR_SECUNDARIO,
      });

      const pageText = `Página ${i + 1} de ${total}`;
      const pw = this.fontBold.widthOfTextAtSize(pageText, 7.4);
      page.drawText(pageText, {
        x: A4_ANCHO - MARGEN_X - pw,
        y: textY,
        size: 7.4,
        font: this.fontBold,
        color: COLOR_SECUNDARIO,
      });
    }

    const bytes = await this.doc.save();
    return Buffer.from(bytes);
  }
}
