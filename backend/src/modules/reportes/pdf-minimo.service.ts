/**
 * Generador mínimo de PDF 1.4 en Node.js puro.
 *
 * El plan exige entregar el informe ejecutivo como binario `%PDF-1.4` con
 * membrete institucional (endpoint #53) sin incorporar dependencias binarias
 * externas. El documento se construye con las primitivas del formato PDF 1.4
 * (catálogo, páginas, fuentes base Type1 y streams sin comprimir) y con la
 * tabla de referencias cruzadas necesaria para que los visores y el control
 * de integridad reconozcan el archivo.
 */

const FUENTE_HELVETICA = 'Helvetica';
const FUENTE_HELVETICA_BOLD = 'Helvetica-Bold';

function escaparTexto(texto: string): string {
  return texto.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/**
 * Convierte texto a bytes Latin-1, que es el alfabeto de las fuentes base del
 * PDF. Los caracteres fuera del rango se sustituyen por '?' en lugar de emitir
 * UTF-8 inválido que rompería el renderizado.
 */
function aLatin1(texto: string): Buffer {
  const salida = Buffer.alloc(texto.length);
  for (let i = 0; i < texto.length; i += 1) {
    const codigo = texto.charCodeAt(i);
    salida[i] = codigo <= 0xff ? codigo : 0x3f;
  }
  return salida;
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

const ANCHO_PAGINA = 595.28;
const ALTO_PAGINA = 841.89;

export class DocumentoPdf {
  private readonly lineas: LineaPdf[] = [];
  private titulo: string;
  private autor: string;

  constructor(titulo = 'Informe ejecutivo SIGD', autor = 'SIGD - Sistema de Gestión Documental') {
    this.titulo = titulo;
    this.autor = autor;
  }

  definirMetadatos(titulo: string, autor: string): this {
    this.titulo = titulo;
    this.autor = autor;
    return this;
  }

  agregarTitulo(texto: string): this {
    this.lineas.push({ texto, x: 56, y: ALTO_PAGINA - 80, tamano: 18, negrita: true });
    return this;
  }

  agregarSubtitulo(texto: string): this {
    this.lineas.push({ texto, x: 56, y: ALTO_PAGINA - 104, tamano: 11 });
    return this;
  }

  /** Encabezado de sección en negrita con filete inferior. */
  agregarSeccion(texto: string): this {
    const y = this.siguienteY();
    this.lineas.push({ texto, x: 56, y, tamano: 13, negrita: true });
    this.lineas.push({ texto: '-'.repeat(Math.max(10, texto.length)), x: 56, y: y - 14, tamano: 9 });
    return this;
  }

  agregarParrafo(texto: string): this {
    this.lineas.push({ texto, x: 56, y: this.siguienteY(), tamano: 10 });
    return this;
  }

  agregarFila(celdas: string[], opciones: { negrita?: boolean; separador?: boolean } = {}): this {
    const y = this.siguienteY();
    const ancho = (ANCHO_PAGINA - 112) / Math.max(celdas.length, 1);
    celdas.forEach((celda, indice) => {
      this.lineas.push({
        texto: celda,
        x: 56 + ancho * indice,
        y,
        tamano: 9,
        negrita: opciones.negrita ?? false,
      });
    });
    if (opciones.separador !== false) {
      this.lineas.push({ texto: '.'.repeat(90), x: 56, y: y - 3, tamano: 7 });
    }
    return this;
  }

  private siguienteY(): number {
    const ultima = this.lineas.at(-1);
    return Math.max(60, (ultima?.y ?? ALTO_PAGINA - 120) - 18);
  }

  private contenidoPagina(): Buffer {
    const cuerpo = this.lineas
      .map((linea) => {
        const fuente = linea.negrita ? FUENTE_HELVETICA_BOLD : FUENTE_HELVETICA;
        const tamano = linea.tamano ?? 10;
        let x = linea.x ?? 56;

        if (linea.alineacion && linea.ancho) {
          const anchoEstimado = linea.texto.length * tamano * 0.5;
          if (linea.alineacion === 'centro') x += (linea.ancho - anchoEstimado) / 2;
          if (linea.alineacion === 'derecha') x += linea.ancho - anchoEstimado;
        }

        return `BT /${fuente} ${tamano} Tf 1 0 0 1 ${x.toFixed(2)} ${(linea.y ?? 700).toFixed(2)} Tm (${escaparTexto(linea.texto)}) Tj ET`;
      })
      .join('\n');

    const pie = `BT /${FUENTE_HELVETICA} 8 Tf 1 0 0 1 56 40 Tm (Generado por el Sistema de Gestion Documental SIGD - Membrete institucional) Tj ET`;

    return aLatin1(`${cuerpo}\n${pie}\n`);
  }

  /**
   * Serializa el documento. La tabla xref se calcula sobre los desplazamientos
   * reales de cada objeto; un xref con offsets incorrectos es la causa habitual
   * de que un visor rechace el archivo como dañado.
   */
  construir(): Buffer {
    const objetos: string[] = [];
    const contenido = this.contenidoPagina();

    objetos.push('<< /Type /Catalog /Pages 2 0 R >>');
    objetos.push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    objetos.push(
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] ' +
        '/Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    );
    objetos.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    objetos.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    objetos.push(`<< /Length ${contenido.length} >>\nstream\n${contenido.toString('latin1')}\nendstream`);
    objetos.push(
      `<< /Title (${escaparTexto(this.titulo)}) /Author (${escaparTexto(this.autor)}) ` +
        '/Producer (SIGD Backend - Generador PDF 1.4) /CreationDate (D:20260101000000Z) >>',
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
    pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R /Info ${objetos.length} 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`;

    return Buffer.from(pdf, 'latin1');
  }
}

export function generarPdfInforme(contenido: (doc: DocumentoPdf) => void, titulo: string): Buffer {
  const documento = new DocumentoPdf(titulo);
  contenido(documento);
  return documento.construir();
}
