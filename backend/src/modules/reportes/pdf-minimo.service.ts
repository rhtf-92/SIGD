/**
 * Generador mínimo de PDF 1.4 en Node.js puro (sincrónico, sin dependencias nativas).
 *
 * Emite reportes analíticos institucionales multipágina para el endpoint #53
 * con membrete del IESTP "Suiza", codificación WinAnsi completa (tildes/eñes),
 * tablas con ajuste de columnas y numeración de páginas.
 */

const ANCHO_PAGINA = 595.28;
const ALTO_PAGINA = 841.89;
const MARGEN_X = 48;
const ANCHO_UTIL = ANCHO_PAGINA - MARGEN_X * 2;
const Y_LIMITE_INFERIOR = 64;

const WIN_ANSI_EXT: Record<string, number> = {
  '€': 0x80,
  '‚': 0x82,
  'ƒ': 0x83,
  '„': 0x84,
  '…': 0x85,
  '†': 0x86,
  '‡': 0x87,
  'ˆ': 0x88,
  '‰': 0x89,
  'Š': 0x8a,
  '‹': 0x8b,
  'Œ': 0x8c,
  'Ž': 0x8e,
  '‘': 0x91,
  '’': 0x92,
  '“': 0x93,
  '”': 0x94,
  '•': 0x95,
  '–': 0x96,
  '—': 0x97,
  '™': 0x99,
  'š': 0x9a,
  '›': 0x9b,
  'œ': 0x9c,
  'ž': 0x9e,
  'Ÿ': 0x9f,
};

function normalizarWinAnsi(texto: string): string {
  return String(texto ?? '')
    .replace(/[\u2192\u2794]/g, '->')
    .replace(/[\u2713\u2714]/g, '[OK]')
    .replace(/[\u2264]/g, '<=')
    .replace(/[\u2265]/g, '>=')
    .replace(/[\u2010-\u2012\u2212]/g, '-');
}

function escaparTextoWinAnsi(texto: string): string {
  const limpio = normalizarWinAnsi(texto);
  const salida: string[] = [];
  for (const ch of limpio) {
    const codigo = WIN_ANSI_EXT[ch] ?? ch.codePointAt(0) ?? 0x3f;
    const byte = codigo <= 0xff && (codigo >= 0x20 || codigo === 0x09) ? codigo : 0x3f;
    if (byte === 0x28 || byte === 0x29 || byte === 0x5c) {
      salida.push(`\\${String.fromCharCode(byte)}`);
    } else if (byte > 0x7e || byte < 0x20) {
      salida.push(`\\${byte.toString(8).padStart(3, '0')}`);
    } else {
      salida.push(String.fromCharCode(byte));
    }
  }
  return salida.join('');
}

function truncarAjustado(texto: string, maxAncho: number, tamano: number): string {
  const clean = normalizarWinAnsi(texto).trim();
  const maxChars = Math.max(4, Math.floor(maxAncho / (tamano * 0.52)));
  if (clean.length <= maxChars) return clean;
  return `${clean.slice(0, maxChars - 1)}…`;
}

function envolverSimple(texto: string, maxAncho: number, tamano: number): string[] {
  const clean = normalizarWinAnsi(texto).trim();
  const maxChars = Math.max(12, Math.floor(maxAncho / (tamano * 0.52)));
  if (clean.length <= maxChars) return [clean];
  const palabras = clean.split(/\s+/);
  const lineas: string[] = [];
  let actual = '';
  for (const palabra of palabras) {
    const tent = actual ? `${actual} ${palabra}` : palabra;
    if (tent.length <= maxChars) {
      actual = tent;
    } else {
      if (actual) lineas.push(actual);
      actual = palabra.length > maxChars ? palabra.slice(0, maxChars - 1) + '…' : palabra;
    }
  }
  if (actual) lineas.push(actual);
  return lineas.length > 0 ? lineas : [''];
}

export type Alineacion = 'izquierda' | 'centro' | 'derecha';

export interface LineaPdf {
  texto: string;
  x?: number;
  y?: number;
  tamano?: number;
  negrita?: boolean;
  alineacion?: Alineacion;
  ancho?: number;
}

export class DocumentoPdf {
  private readonly paginas: string[][] = [];
  private comandosActuales: string[] = [];
  private cursorY = ALTO_PAGINA - 150;
  private titulo: string;
  private subtitulo = '';
  private autor: string;
  private iniciada = false;

  constructor(
    titulo = 'Reporte analítico institucional SIGD',
    autor = 'IESTP "SUIZA" - SIGD',
  ) {
    this.titulo = titulo;
    this.autor = autor;
  }

  definirMetadatos(titulo: string, autor: string): this {
    this.titulo = titulo;
    this.autor = autor;
    return this;
  }

  private asegurarPagina(altoRequerido = 20): void {
    if (!this.iniciada) {
      this.iniciarPrimeraPagina();
      return;
    }
    if (this.cursorY - altoRequerido < Y_LIMITE_INFERIOR) {
      this.nuevaPaginaContinuacion();
    }
  }

  private comandoTexto(
    texto: string,
    x: number,
    y: number,
    tamano = 9,
    negrita = false,
    colorRgb = '0.11 0.14 0.18',
  ): string {
    const fontKey = negrita ? 'F2' : 'F1';
    return `${colorRgb} rg BT /${fontKey} ${tamano} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${escaparTextoWinAnsi(texto)}) Tj ET`;
  }

  private comandoLinea(x1: number, y1: number, x2: number, y2: number, grosor = 0.6, color = '0.78 0.82 0.87'): string {
    return `${color} RG ${grosor} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`;
  }

  private iniciarPrimeraPagina(): void {
    this.iniciada = true;
    const cmds: string[] = [];
    // Banda superior institucional
    const bandBottom = ALTO_PAGINA - 108;
    cmds.push(`0.08 0.22 0.39 rg 0 ${bandBottom.toFixed(2)} ${ANCHO_PAGINA} 108 re f`);
    cmds.push(this.comandoTexto('INSTITUTO DE EDUCACIÓN SUPERIOR TECNOLÓGICO PÚBLICO "SUIZA"', MARGEN_X, ALTO_PAGINA - 34, 9.5, true, '0.84 0.91 0.98'));
    cmds.push(this.comandoTexto('Av. Túpac Amaru s/n, Pucallpa – Ucayali | Sistema Integral de Gestión Documentaria (SIGD)', MARGEN_X, ALTO_PAGINA - 48, 7.8, false, '0.78 0.86 0.95'));
    cmds.push(this.comandoTexto(this.titulo.toUpperCase(), MARGEN_X, ALTO_PAGINA - 74, 13.5, true, '1 1 1'));
    if (this.subtitulo) {
      cmds.push(this.comandoTexto(this.subtitulo, MARGEN_X, ALTO_PAGINA - 93, 9, false, '0.90 0.94 0.99'));
    }
    this.comandosActuales = cmds;
    this.paginas.push(cmds);
    this.cursorY = bandBottom - 22;
  }

  private nuevaPaginaContinuacion(): void {
    const cmds: string[] = [];
    const headerY = ALTO_PAGINA - 38;
    cmds.push(this.comandoTexto(`IESTP "SUIZA" — ${this.titulo}`, MARGEN_X, headerY, 8.2, true, '0.35 0.40 0.47'));
    cmds.push(this.comandoLinea(MARGEN_X, headerY - 8, ANCHO_PAGINA - MARGEN_X, headerY - 8, 0.6));
    this.comandosActuales = cmds;
    this.paginas.push(cmds);
    this.cursorY = headerY - 26;
  }

  agregarTitulo(texto: string): this {
    this.titulo = texto;
    if (this.iniciada) {
      this.comandosActuales.push(this.comandoTexto(texto, MARGEN_X, ALTO_PAGINA - 74, 13.5, true, '1 1 1'));
    }
    return this;
  }

  agregarSubtitulo(texto: string): this {
    this.subtitulo = texto;
    if (!this.iniciada) {
      this.iniciarPrimeraPagina();
    } else {
      this.comandosActuales.push(this.comandoTexto(texto, MARGEN_X, ALTO_PAGINA - 93, 9, false, '0.90 0.94 0.99'));
    }
    return this;
  }

  /** Encabezado de sección en negrita con filete institucional. */
  agregarSeccion(texto: string): this {
    this.asegurarPagina(32);
    this.cursorY -= 6;
    this.comandosActuales.push(`0.08 0.22 0.39 rg ${MARGEN_X} ${(this.cursorY - 2).toFixed(2)} 3 12 re f`);
    this.comandosActuales.push(this.comandoTexto(texto.toUpperCase(), MARGEN_X + 8, this.cursorY, 10, true, '0.08 0.22 0.39'));
    this.comandosActuales.push(this.comandoLinea(MARGEN_X, this.cursorY - 6, ANCHO_PAGINA - MARGEN_X, this.cursorY - 6, 0.7, '0.08 0.22 0.39'));
    this.cursorY -= 20;
    return this;
  }

  agregarParrafo(texto: string): this {
    const lineas = envolverSimple(texto, ANCHO_UTIL, 9.5);
    for (const linea of lineas) {
      this.asegurarPagina(15);
      this.comandosActuales.push(this.comandoTexto(linea, MARGEN_X, this.cursorY, 9.5, false));
      this.cursorY -= 14;
    }
    this.cursorY -= 4;
    return this;
  }

  agregarFila(celdas: string[], opciones: { negrita?: boolean; separador?: boolean } = {}): this {
    this.asegurarPagina(22);
    const colCount = Math.max(celdas.length, 1);
    const ancho = ANCHO_UTIL / colCount;
    const yFila = this.cursorY;

    if (opciones.negrita) {
      this.comandosActuales.push(`0.94 0.96 0.99 rg ${MARGEN_X} ${(yFila - 5).toFixed(2)} ${ANCHO_UTIL} 16 re f`);
    }

    celdas.forEach((celda, indice) => {
      const txt = truncarAjustado(celda, ancho - 8, 8.5);
      this.comandosActuales.push(
        this.comandoTexto(
          txt,
          MARGEN_X + 4 + ancho * indice,
          yFila,
          8.5,
          Boolean(opciones.negrita),
          opciones.negrita ? '0.08 0.22 0.39' : '0.11 0.14 0.18',
        ),
      );
    });

    if (opciones.separador !== false) {
      this.comandosActuales.push(this.comandoLinea(MARGEN_X, yFila - 5, ANCHO_PAGINA - MARGEN_X, yFila - 5, 0.45, '0.84 0.87 0.91'));
    }

    this.cursorY -= 18;
    return this;
  }

  construir(): Buffer {
    if (!this.iniciada) {
      this.iniciarPrimeraPagina();
    }

    const totalPaginas = this.paginas.length;
    const streams = this.paginas.map((cmds, idx) => {
      const pieIzq = this.comandoTexto(
        'IESTP "Suiza" (Pucallpa, Ucayali) · Reporte generado por el SIGD',
        MARGEN_X,
        28,
        7.5,
        false,
        '0.42 0.47 0.54',
      );
      const pieDer = this.comandoTexto(
        `Página ${idx + 1} de ${totalPaginas}`,
        ANCHO_PAGINA - MARGEN_X - 56,
        28,
        7.5,
        true,
        '0.42 0.47 0.54',
      );
      const lineaPie = this.comandoLinea(MARGEN_X, 40, ANCHO_PAGINA - MARGEN_X, 40, 0.5, '0.78 0.82 0.87');
      const streamText = [...cmds, lineaPie, pieIzq, pieDer].join('\n') + '\n';
      return Buffer.from(streamText, 'latin1');
    });

    const objetos: string[] = [];
    const primerPageId = 5;
    const pageIds = streams.map((_, idx) => primerPageId + idx * 2);
    const infoId = primerPageId + streams.length * 2;

    objetos.push('<< /Type /Catalog /Pages 2 0 R >>');
    objetos.push(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${streams.length} >>`);
    objetos.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    objetos.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');

    streams.forEach((streamBuf, idx) => {
      const streamId = primerPageId + idx * 2 + 1;
      objetos.push(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ANCHO_PAGINA} ${ALTO_PAGINA}] ` +
          `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${streamId} 0 R >>`,
      );
      objetos.push(`<< /Length ${streamBuf.length} >>\nstream\n${streamBuf.toString('latin1')}\nendstream`);
    });

    objetos.push(
      `<< /Title (${escaparTextoWinAnsi(this.titulo)}) /Author (${escaparTextoWinAnsi(this.autor)}) ` +
        '/Producer (SIGD IESTP Suiza - Generador PDF 1.4) /CreationDate (D:20260101000000Z) >>',
    );

    let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
    const offsets: number[] = [];

    objetos.forEach((cuerpo, indice) => {
      offsets.push(Buffer.byteLength(pdf, 'latin1'));
      pdf += `${indice + 1} 0 obj\n${cuerpo}\nendobj\n`;
    });

    const inicioXref = Buffer.byteLength(pdf, 'latin1');
    pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
    for (const offset of offsets) {
      pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R /Info ${infoId} 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`;

    return Buffer.from(pdf, 'latin1');
  }
}

export function generarPdfInforme(contenido: (doc: DocumentoPdf) => void, titulo: string): Buffer {
  const documento = new DocumentoPdf(titulo);
  contenido(documento);
  return documento.construir();
}
