/**
 * T-BE-DC-09 — Generador institucional de PDF en hoja A4.
 *
 * Problema que resuelve: los documentos de resolucion directoral se armaban con
 * saltos de pagina y desbordes tipograficos cuando el contenido superaba una
 * hoja, lo que producia documentos antiesteticos y observados por la DREU.
 *
 * Reglas tipograficas estrictas aplicadas:
 *   - Hoja A4 exacta: 210 mm x 297 mm (595.2756 x 841.8898 puntos).
 *   - Margenes uniformes de 25 mm en los cuatro lados.
 *   - Encabezado membretado institucional en la primera hoja.
 *   - Encabezado de continuacion y pie con paginacion legal correlativa en
 *     todas las hojas.
 *   - Particion de palabras con ancho real de glifo: ninguna palabra desborda
 *     la caja de texto ni el ancho util.
 *   - Control de lineas viudas y huerfanas, conservacion del titulo junto al
 *     parrafo que introduce, repeticion del encabezado de tabla y atomicidad
 *     de filas de tabla y del bloque de firma.
 *
 * Estado: PROPUESTO. La composicion tipografica es una propuesta tecnica; el
 * membrete por omision contiene datos marcados como [EJEMPLO] y debe ser
 * reemplazado por los datos oficiales de la institucion.
 */

import { createHash } from "node:crypto";

import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
  type RGB,
} from "pdf-lib";

import type {
  Alineacion,
  BloqueResolucion,
  ContenidoResolucion,
  EstiloFuente,
  MembreteInstitucional,
} from "./types.js";

// ---------------------------------------------------------------------------
// Geometria de la hoja
// ---------------------------------------------------------------------------

/** Puntos tipograficos por milimetro (1 pulgada = 25.4 mm = 72 puntos). */
export const PUNTOS_POR_MM = 72 / 25.4;

/** Dimensiones normativas de la hoja A4, en milimetros. */
export const A4_MM = { ancho: 210, alto: 297 } as const;

/** Margen uniforme aplicado a los cuatro lados, en milimetros. */
export const MARGEN_MM = 25;

/** Dimensiones de la hoja A4, en puntos. */
export const A4_PUNTOS = {
  ancho: A4_MM.ancho * PUNTOS_POR_MM,
  alto: A4_MM.alto * PUNTOS_POR_MM,
} as const;

/** Margen uniforme aplicado a los cuatro lados, en puntos. */
export const MARGEN_PUNTOS = MARGEN_MM * PUNTOS_POR_MM;

/** Ancho disponible para el contenido, en puntos. */
export const ANCHO_UTIL = A4_PUNTOS.ancho - 2 * MARGEN_PUNTOS;

/** Alto nominal disponible para el contenido, en puntos. */
export const ALTO_UTIL = A4_PUNTOS.alto - 2 * MARGEN_PUNTOS;

// ---------------------------------------------------------------------------
// Constantes tipograficas
// ---------------------------------------------------------------------------

const CUERPO_POR_DEFECTO = 11;
const INTERLINEADO_POR_DEFECTO = 1.45;
/** Proporcion de la altura de x respecto al cuerpo en Helvetica (0.718 em). */
const PROPORCION_ASCENDENTE = 0.72;
/** Reparto del interlineado adicional: 75 % por encima, 25 % por debajo. */
const REPARTO_INTERLINEADO = 0.75;

const PADDING_CELDA_X = 4;
const PADDING_CELDA_Y = 5;
const ALTO_PIE = 34;
const ALTO_ENCABEZADO_CONTINUACION = 26;

/** Lineas minimas del bloque siguiente que deben accompanyar a un titulo. */
const MIN_LINEAS_COMPANERAS = 2;
/** Lineas minimas para aceptar un corte de pagina dentro de un parrafo. */
const MIN_LINEAS_ANTI_VIUDA = 2;

const COLOR_TEXTO: RGB = rgb(0, 0, 0);
const COLOR_REGLA: RGB = rgb(0.1, 0.1, 0.1);
const COLOR_REGLA_SUAVE: RGB = rgb(0.68, 0.68, 0.68);
const COLOR_SECUNDARIO: RGB = rgb(0.25, 0.25, 0.25);

const FUENTES_BASE: Record<EstiloFuente, StandardFonts> = {
  normal: StandardFonts.Helvetica,
  negrita: StandardFonts.HelveticaBold,
  cursiva: StandardFonts.HelveticaOblique,
  negritaCursiva: StandardFonts.HelveticaBoldOblique,
};

/** Cuerpo tipografico y estilo por nivel de encabezado. */
const ESTILO_ENCABEZADO: Record<1 | 2 | 3, { cuerpo: number; estilo: EstiloFuente }> = {
  1: { cuerpo: 14, estilo: "negrita" },
  2: { cuerpo: 12, estilo: "negrita" },
  3: { cuerpo: 11, estilo: "negrita" },
};

/**
 * Membrete por omision.
 *
 * [EJEMPLO] Los datos siguientes no tienen valor oficial. Deben reemplazarse por
 * los de la institucion antes de generar documentos oficiales.
 */
export const MEMBRETE_POR_DEFECTO: MembreteInstitucional = {
  institucion: 'INSTITUTO DE EDUCACION SUPERIOR TECNICO PUBLICO "SUIZA" [EJEMPLO]',
  unidad: "DIRECCION DE ADMINISTRACION Y UNIDADES ACADEMICAS [EJEMPLO]",
  direccion: "Pucallpa, Ucayali - Peru [EJEMPLO]",
  sigla: 'IESTP "Suiza" [EJEMPLO]',
};

// ---------------------------------------------------------------------------
// Modelo interno de maquetacion
// ---------------------------------------------------------------------------

/** Palabra con su estilo: permite entradillas en negrita dentro de un parrafo. */
interface Palabra {
  texto: string;
  estilo: EstiloFuente;
}

/** Fragmento de texto con estilo uniforme, previo a la particion en palabras. */
interface Tramo {
  texto: string;
  estilo: EstiloFuente;
}

/** Medidor de texto ligado a las fuentes ya incrustadas. */
type Medidor = (texto: string, estilo: EstiloFuente, cuerpo: number) => number;

/** Linea maquetada, todavia sin posicion asignada. */
interface LineaBase {
  palabras: Palabra[];
  anchoPalabras: number;
  cuerpo: number;
  interlineado: number;
  alto: number;
  alineacion: Alineacion;
  justificada: boolean;
  sangriaX: number;
  anchoLinea: number;
  color: RGB;
}

/** Linea maquetada con posicion absoluta dentro de la hoja. */
interface LineaColocada extends LineaBase {
  x: number;
  y: number;
}

/** Regla horizontal con posicion absoluta. */
interface ReglaColocada {
  x1: number;
  x2: number;
  y: number;
  grosor: number;
  color: RGB;
}

interface PaginaCompuesta {
  lineas: LineaColocada[];
  reglas: ReglaColocada[];
}

/** Regla definida dentro de un bloque atomico, en coordenadas locales. */
interface ReglaInterna {
  desplazamientoY: number;
  x1: number;
  x2: number;
  grosor: number;
  color: RGB;
}

/** Bloque atomico: se mantiene entero o pasa integro a la hoja siguiente. */
interface UnidadAtomica {
  clase: "atomica";
  lineas: LineaBase[];
  reglasInternas: readonly ReglaInterna[];
  espacioAntes: number;
  espacioDespues: number;
  conservaConSiguiente: boolean;
}

/** Bloque de texto corrido: puede partirse entre hojas con control de viudas. */
interface UnidadSecuencia {
  clase: "secuencia";
  lineas: LineaBase[];
  espacioAntes: number;
  espacioDespues: number;
}

interface LineaCelda {
  lineas: LineaBase[];
  alto: number;
}

/** Bloque de tabla: la fila de encabezado se repite en cada hoja. */
interface UnidadTabla {
  clase: "tabla";
  encabezado: LineaCelda[];
  filas: LineaCelda[][];
  desplazamientoX: number[];
  espacioAntes: number;
  espacioDespues: number;
}

type UnidadFlujo = UnidadAtomica | UnidadSecuencia | UnidadTabla;

// ---------------------------------------------------------------------------
// Utilidades de medicion y particion de texto
// ---------------------------------------------------------------------------

/** Convierte tramos de texto en una lista de palabras conservando estilos. */
function aPalabras(tramos: readonly Tramo[]): Palabra[] {
  const palabras: Palabra[] = [];
  for (const tramo of tramos) {
    for (const parte of tramo.texto.split(/\s+/u)) {
      if (parte.length > 0) {
        palabras.push({ texto: parte, estilo: tramo.estilo });
      }
    }
  }
  return palabras;
}

/**
 * Parte una palabra mas ancha que la caja en fragmentos que si caben.
 *
 * Evita el desborde tipografico de cadenas largas sin espacios (URLs, numeros de
 * expediente, codigos de documento), que era una de las causas del
 * desbordamiento observado en las resoluciones de varias hojas.
 */
function partirPalabraLarga(
  palabra: Palabra,
  medir: Medidor,
  cuerpo: number,
  anchoMaximo: number,
): Palabra[] {
  const partes: Palabra[] = [];
  let actual = "";

  for (const caracter of palabra.texto) {
    const tentativa = actual + caracter;
    if (actual !== "" && medir(tentativa, palabra.estilo, cuerpo) > anchoMaximo) {
      partes.push({ texto: actual, estilo: palabra.estilo });
      actual = caracter;
    } else {
      actual = tentativa;
    }
  }

  if (actual !== "") {
    partes.push({ texto: actual, estilo: palabra.estilo });
  }

  return partes.length > 0 ? partes : [palabra];
}

/** Ancho total de una linea, incluidos los espacios interpalabra. */
function anchoDeLinea(
  palabras: readonly Palabra[],
  medir: Medidor,
  cuerpo: number,
): number {
  if (palabras.length === 0) {
    return 0;
  }

  let ancho = 0;
  for (let i = 0; i < palabras.length; i += 1) {
    const palabra = palabras[i];
    ancho += medir(palabra.texto, palabra.estilo, cuerpo);
    if (i < palabras.length - 1) {
      ancho += medir(" ", palabra.estilo, cuerpo);
    }
  }
  return ancho;
}

/**
 * Parte una secuencia de palabras en lineas que caben en el ancho dado.
 *
 * El caracter de nueva linea fuerza corte, de modo que los considerandos de una
 * resolucion mantienen la estructura con que fueron redactados.
 */
function ajustarLineas(
  palabrasIniciales: readonly Palabra[],
  medir: Medidor,
  cuerpo: number,
  anchoMaximo: number,
): Palabra[][] {
  const anchoEfectivo = Math.max(anchoMaximo, cuerpo);
  const palabras: Palabra[] = [];

  for (const palabra of palabrasIniciales) {
    const segmentos = palabra.texto.split("\n");
    for (let i = 0; i < segmentos.length; i += 1) {
      if (i > 0) {
        palabras.push({ texto: "\n", estilo: palabra.estilo });
      }
      if (segmentos[i].length > 0) {
        palabras.push(
          ...partirPalabraLarga(
            { texto: segmentos[i], estilo: palabra.estilo },
            medir,
            cuerpo,
            anchoEfectivo,
          ),
        );
      }
    }
  }

  const lineas: Palabra[][] = [];
  let actual: Palabra[] = [];
  let anchoActual = 0;

  const cerrarLinea = (): void => {
    if (actual.length > 0) {
      lineas.push(actual);
      actual = [];
      anchoActual = 0;
    }
  };

  for (const palabra of palabras) {
    if (palabra.texto === "\n") {
      cerrarLinea();
      continue;
    }

    const anchoPalabra = medir(palabra.texto, palabra.estilo, cuerpo);

    if (actual.length > 0) {
      const espacio = medir(" ", actual[actual.length - 1].estilo, cuerpo);
      if (anchoActual + espacio + anchoPalabra > anchoEfectivo) {
        cerrarLinea();
      } else {
        anchoActual += espacio;
      }
    }

    anchoActual += anchoPalabra;
    actual.push(palabra);
  }

  cerrarLinea();
  return lineas;
}

/** Coordenada de la linea base de una linea que arranca en ySuperior. */
function lineaBase(ySuperior: number, cuerpo: number, interlineado: number): number {
  return ySuperior - desplazamientoLineaBase(cuerpo, interlineado);
}

/**
 * Distancia vertical, medida hacia abajo desde el tope de una linea, hasta su
 * linea base. Es el complemento de {@link lineaBase} y permite colocar reglas y
 * separadores en puntos concretos de la caja de una linea.
 */
function desplazamientoLineaBase(cuerpo: number, interlineado: number): number {
  const extra = (interlineado - 1) * cuerpo;
  return extra * REPARTO_INTERLINEADO + cuerpo * PROPORCION_ASCENDENTE;
}

/** Altura total ocupada por un grupo de lineas consecutivas. */
function altoDeLineas(lineas: readonly LineaBase[]): number {
  return lineas.reduce((total, linea) => total + linea.alto, 0);
}

// ---------------------------------------------------------------------------
// Compositor: asignacion de posiciones y control de saltos de pagina
// ---------------------------------------------------------------------------

/**
 * Mantiene el cursor vertical y decide los cortes de hoja.
 *
 * Las coordenadas `y` se calculan de arriba hacia abajo porque PDF lo espera.
 * `limite` es la cota inferior del area de contenido: por debajo ya no se
 * escribe porque ahi se imprime el pie con la paginacion legal.
 */
class Compositor {
  private readonly paginas: PaginaCompuesta[] = [];

  private lineas: LineaColocada[] = [];

  private reglas: ReglaColocada[] = [];

  private numeroHoja = 0;

  private y = 0;

  private limite = 0;

  private iniciada = false;

  constructor(
    private readonly altoMembrete: number,
    private readonly altoEncabezadoContinuacion: number,
    private readonly altoPie: number,
  ) {}

  iniciar(): void {
    if (!this.iniciada) {
      this.abrirHoja();
    }
  }

  /** Abre una hoja nueva conservando la anterior. */
  nuevaHoja(): void {
    this.numeroHoja += 1;
    this.abrirHoja();
  }

  private abrirHoja(): void {
    if (this.iniciada) {
      this.paginas.push({ lineas: this.lineas, reglas: this.reglas });
    }

    this.iniciada = true;
    this.lineas = [];
    this.reglas = [];

    const altoCabecera =
      this.numeroHoja === 0 ? this.altoMembrete : this.altoEncabezadoContinuacion;

    this.y = A4_PUNTOS.alto - MARGEN_PUNTOS - altoCabecera;
    this.limite = MARGEN_PUNTOS + this.altoPie;
  }

  finalizar(): PaginaCompuesta[] {
    if (!this.iniciada) {
      this.abrirHoja();
    }
    this.paginas.push({ lineas: this.lineas, reglas: this.reglas });
    return this.paginas;
  }

  /** Indica si ya se escribio algo en la hoja en curso. */
  tieneContenido(): boolean {
    return this.lineas.length > 0 || this.reglas.length > 0;
  }

  espacioDisponible(): number {
    return this.y - this.limite;
  }

  /** Cursor vertical actual, usado para anclar reglas locales de un bloque. */
  cursor(): number {
    return this.y;
  }

  /** Desplaza el cursor sin escribir contenido. */
  consumir(alto: number): void {
    this.y -= alto;
  }

  /** Espacio antes de un bloque; en cabecera de hoja no se aplica. */
  espacioAntesDe(espacioAntes: number): number {
    return this.tieneContenido() ? espacioAntes : 0;
  }

  colocarLinea(linea: LineaBase): void {
    this.lineas.push({
      ...linea,
      x: MARGEN_PUNTOS + linea.sangriaX,
      y: lineaBase(this.y, linea.cuerpo, linea.interlineado),
    });
    this.y -= linea.alto;
  }

  colocarRegla(regla: ReglaColocada): void {
    this.reglas.push(regla);
  }

  /** Cuantas lineas de altura `alto` caben todavia en la hoja. */
  lineasQueCaben(alto: number): number {
    if (alto <= 0) {
      return Number.POSITIVE_INFINITY;
    }
    return Math.max(0, Math.floor((this.espacioDisponible() + 0.01) / alto));
  }

  /**
   * Abre una hoja si no queda espacio para `alto`.
   *
   * Si la hoja esta vacia y el bloque sigue sin caber, no se fuerza el corte:
   * se dibuja igualmente para garantizar que la composicion siempre avance y
   * termine.
   */
  reservar(alto: number): void {
    if (this.espacioDisponible() >= alto || !this.tieneContenido()) {
      return;
    }
    this.nuevaHoja();
  }
}

// ---------------------------------------------------------------------------
// Generador
// ---------------------------------------------------------------------------

export interface OpcionesGeneracion {
  membrete?: MembreteInstitucional;
  titulo?: string;
  subtitulo?: string;
}

/** Resultado de la generacion de un documento PDF institucional. */
export interface DocumentoGenerado {
  bytes: Uint8Array;
  paginas: number;
  /** Hash SHA-256 en hexadecimal sobre los bytes definitivos del PDF. */
  sha256: string;
  tamanoBytes: number;
  anchoHoja: number;
  altoHoja: number;
}

export class A4GeneratorService {
  /**
   * Genera un PDF institucional en hoja A4 a partir del contenido de una
   * resolucion y devuelve, ademas del archivo, su hash SHA-256.
   *
   * El hash se calcula sobre los bytes definitivos del PDF y es el valor que la
   * pasarela Refirma transporta en el payload protocolar, de modo que la
   * verificacion de integridad viaja ligada al documento realmente entregado.
   */
  async generar(
    contenido: ContenidoResolucion,
    opciones: OpcionesGeneracion = {},
  ): Promise<DocumentoGenerado> {
    const membrete = opciones.membrete ?? MEMBRETE_POR_DEFECTO;

    const documento = await PDFDocument.create();
    documento.setTitle(membrete.numeroDocumento ?? "Resolucion");
    documento.setProducer("SIGD - DocuCore - Generador A4");
    documento.setCreator("SIGD - DocuCore");

    const fuentes = {} as Record<EstiloFuente, PDFFont>;
    for (const [estilo, fuente] of Object.entries(FUENTES_BASE) as [
      EstiloFuente,
      StandardFonts,
    ][]) {
      fuentes[estilo] = await documento.embedFont(fuente);
    }

    const medir: Medidor = (texto, estilo, cuerpo) =>
      fuentes[estilo].widthOfTextAtSize(texto, cuerpo);

    const unidades = this.compilar(contenido, opciones, medir);
    const compositor = this.componer(unidades, membrete);

    const paginas = compositor.finalizar();
    for (const [indice, paginaCompuesta] of paginas.entries()) {
      const hoja = documento.addPage([A4_PUNTOS.ancho, A4_PUNTOS.alto]);
      if (indice === 0) {
        this.pintarMembrete(hoja, fuentes, membrete);
      } else {
        this.pintarEncabezadoContinuacion(hoja, fuentes, membrete);
      }
      this.pintarContenido(hoja, fuentes, paginaCompuesta);
      this.pintarPie(hoja, fuentes, membrete, indice + 1, paginas.length);
    }

    const bytes = await documento.save();

    return {
      bytes,
      paginas: paginas.length,
      sha256: createHash("sha256").update(Buffer.from(bytes)).digest("hex"),
      tamanoBytes: bytes.byteLength,
      anchoHoja: A4_PUNTOS.ancho,
      altoHoja: A4_PUNTOS.alto,
    };
  }

  // -------------------------------------------------------------------------
  // Compilacion: contenido -> unidades de flujo ya maquetadas
  // -------------------------------------------------------------------------

  private lineasDeTexto(
    tramos: readonly Tramo[],
    parametros: {
      cuerpo?: number;
      interlineado?: number;
      alineacion?: Alineacion;
      sangria?: number;
      sangriaIzquierda?: number;
      color?: RGB;
    },
    medir: Medidor,
  ): LineaBase[] {
    const cuerpo = parametros.cuerpo ?? CUERPO_POR_DEFECTO;
    const interlineado = parametros.interlineado ?? INTERLINEADO_POR_DEFECTO;
    const alineacion = parametros.alineacion ?? "justificado";
    const sangria = parametros.sangria ?? 0;
    const sangriaIzquierda = parametros.sangriaIzquierda ?? 0;
    const color = parametros.color ?? COLOR_TEXTO;

    const anchoLinea = ANCHO_UTIL - sangriaIzquierda;
    const particion = ajustarLineas(aPalabras(tramos), medir, cuerpo, anchoLinea - sangria);

    return particion.map((palabras, indice) => ({
      palabras,
      anchoPalabras: anchoDeLinea(palabras, medir, cuerpo),
      cuerpo,
      interlineado,
      alto: cuerpo * interlineado,
      alineacion,
      justificada: alineacion === "justificado" && indice < particion.length - 1,
      sangriaX: sangriaIzquierda + (indice === 0 ? sangria : 0),
      anchoLinea,
      color,
    }));
  }

  private compilar(
    contenido: ContenidoResolucion,
    opciones: OpcionesGeneracion,
    medir: Medidor,
  ): UnidadFlujo[] {
    const unidades: UnidadFlujo[] = [];

    // La opcion explicita tiene prioridad; si falta, se toma el titulo declarado
    // en el propio contenido de la resolucion.
    const titulo = opciones.titulo ?? contenido.titulo;
    const subtitulo = opciones.subtitulo ?? contenido.subtitulo;

    if (titulo !== undefined && titulo.length > 0) {
      unidades.push({
        clase: "atomica",
        lineas: this.lineasDeTexto([{ texto: titulo, estilo: "negrita" }], {
          cuerpo: 13,
          alineacion: "centro",
        }, medir),
        reglasInternas: [],
        espacioAntes: 14,
        espacioDespues: 6,
        conservaConSiguiente: true,
      });
    }

    if (subtitulo !== undefined && subtitulo.length > 0) {
      unidades.push({
        clase: "atomica",
        lineas: this.lineasDeTexto([{ texto: subtitulo, estilo: "normal" }], {
          cuerpo: 10.5,
          alineacion: "centro",
        }, medir),
        reglasInternas: [],
        espacioAntes: 0,
        espacioDespues: 14,
        conservaConSiguiente: true,
      });
    }

    for (const bloque of contenido.bloques) {
      unidades.push(...this.compilarBloque(bloque, medir));
    }

    return unidades;
  }

  private compilarBloque(bloque: BloqueResolucion, medir: Medidor): UnidadFlujo[] {
    switch (bloque.tipo) {
      case "parrafo": {
        if (bloque.texto.trim().length === 0) {
          return [];
        }
        return [
          {
            clase: "secuencia",
            lineas: this.lineasDeTexto(
              [{ texto: bloque.texto, estilo: bloque.estilo ?? "normal" }],
              {
                cuerpo: bloque.cuerpo,
                interlineado: bloque.interlineado,
                alineacion: bloque.alineacion,
                sangria: bloque.sangria,
                sangriaIzquierda: bloque.sangriaIzquierda,
              },
              medir,
            ),
            espacioAntes: bloque.espacioAntes ?? 0,
            espacioDespues: bloque.espacioDespues ?? 8,
          },
        ];
      }

      case "articulo": {
        return [
          {
            clase: "secuencia",
            lineas: this.lineasDeTexto(
              [
                { texto: `${bloque.numero} `, estilo: "negrita" },
                { texto: bloque.texto, estilo: "normal" },
              ],
              {
                cuerpo: bloque.cuerpo,
                interlineado: bloque.interlineado,
                alineacion: bloque.alineacion,
                sangria: bloque.sangria,
              },
              medir,
            ),
            espacioAntes: bloque.espacioAntes ?? 8,
            espacioDespues: bloque.espacioDespues ?? 8,
          },
        ];
      }

      case "encabezado": {
        const nivel = bloque.nivel ?? 2;
        const { cuerpo, estilo } = ESTILO_ENCABEZADO[nivel];
        return [
          {
            clase: "atomica",
            lineas: this.lineasDeTexto([{ texto: bloque.texto, estilo }], {
              cuerpo,
              alineacion: bloque.alineacion ?? "izquierda",
            }, medir),
            reglasInternas: [],
            espacioAntes: bloque.espacioAntes ?? 12,
            espacioDespues: bloque.espacioDespues ?? 6,
            conservaConSiguiente: true,
          },
        ];
      }

      case "lista": {
        const cuerpo = bloque.cuerpo ?? CUERPO_POR_DEFECTO;
        const sangria = bloque.sangria ?? 18;
        const sangriaTexto = sangria + 14;
        const unidades: UnidadFlujo[] = [];

        bloque.items.forEach((item, indice) => {
          const marcador =
            bloque.marcador === "numeros"
              ? `${indice + 1}.`
              : "\u2022";

          const lineas = this.lineasDeTexto([{ texto: item, estilo: "normal" }], {
            cuerpo,
            interlineado: bloque.interlineado,
            alineacion: "justificado",
            sangriaIzquierda: sangriaTexto,
          }, medir);

          if (lineas.length > 0) {
            // El marcador abre la primera linea; el resto mantiene la sangria
            // francesa para que las continuaciones no se confundan con otro item.
            const palabras = [{ texto: marcador, estilo: "normal" as const }, ...lineas[0].palabras];
            lineas[0] = {
              ...lineas[0],
              palabras,
              anchoPalabras: anchoDeLinea(palabras, medir, cuerpo),
              alineacion: "izquierda",
              justificada: false,
              sangriaX: sangria,
              anchoLinea: ANCHO_UTIL,
            };
          }

          unidades.push({
            clase: "secuencia",
            lineas,
            espacioAntes: indice === 0 ? (bloque.espacioAntes ?? 6) : 0,
            espacioDespues: 2,
          });
        });

        unidades.push({
          clase: "atomica",
          lineas: [],
          reglasInternas: [],
          espacioAntes: 0,
          espacioDespues: bloque.espacioDespues ?? 8,
          conservaConSiguiente: false,
        });

        return unidades;
      }

      case "separador": {
        const grosor = bloque.grosor ?? 0.75;
        const espacio = bloque.espacio ?? 8;
        return [
          {
            clase: "atomica",
            lineas: [],
            reglasInternas: [
              {
                desplazamientoY: grosor / 2,
                x1: MARGEN_PUNTOS,
                x2: A4_PUNTOS.ancho - MARGEN_PUNTOS,
                grosor,
                color: COLOR_REGLA_SUAVE,
              },
            ],
            espacioAntes: espacio,
            espacioDespues: espacio,
            conservaConSiguiente: false,
          },
        ];
      }

      case "tabla":
        return [this.compilarTabla(bloque, medir)];

      case "firma": {
        const ancho = 200;
        const x = (A4_PUNTOS.ancho - ancho) / 2;
        const lineasCargo = this.lineasDeTexto(
          [{ texto: bloque.cargo.toUpperCase(), estilo: "normal" }],
          { cuerpo: 10, alineacion: "centro" },
          medir,
        );
        const lineasNombre = this.lineasDeTexto(
          [{ texto: bloque.nombre, estilo: "negrita" }],
          { cuerpo: 11, alineacion: "centro" },
          medir,
        );
        const lineasDocumento = bloque.documento !== undefined
          ? this.lineasDeTexto(
              [{ texto: bloque.documento, estilo: "normal" }],
              { cuerpo: 10, alineacion: "centro" },
              medir,
            )
          : [];
        const lineas = [...lineasCargo, ...lineasNombre, ...lineasDocumento];

        // La linea de firma se dibuja en el blanco entre el cargo y el nombre.
        // Se calcula como el punto medio entre la linea base del cargo y la
        // parte alta (ascensor) del nombre, usando la misma metrica que el
        // resto de la composicion para mantener la coherencia tipografica.
        const desplazamientoFirma = lineasCargo.length > 0 && lineasNombre.length > 0
          ? (desplazamientoLineaBase(lineasCargo[lineasCargo.length - 1].cuerpo, lineasCargo[lineasCargo.length - 1].interlineado)
             + altoDeLineas(lineasCargo)
             + (lineasNombre[0].interlineado - 1) * lineasNombre[0].cuerpo * REPARTO_INTERLINEADO)
            / 2
          : 0;

        return [
          {
            clase: "atomica",
            lineas,
            reglasInternas: [
              {
                desplazamientoY: desplazamientoFirma,
                x1: x,
                x2: x + ancho,
                grosor: 0.75,
                color: COLOR_TEXTO,
              },
            ],
            espacioAntes: bloque.espacioAntes ?? 30,
            espacioDespues: 0,
            conservaConSiguiente: false,
          },
        ];
      }

      default: {
        const noSoportado: never = bloque;
        throw new Error(
          `Bloque de resolucion no soportado: ${JSON.stringify(noSoportado)}`,
        );
      }
    }
  }

  private compilarTabla(
    bloque: Extract<BloqueResolucion, { tipo: "tabla" }>,
    medir: Medidor,
  ): UnidadTabla {
    const cuerpo = bloque.cuerpo ?? 10;
    const pesos = bloque.anchosRelativos ?? bloque.columnas.map(() => 1);
    const sumaPesos = pesos.reduce((total, peso) => total + Math.max(peso, 0.01), 0);

    let desplazamiento = 0;
    const desplazamientoX: number[] = [];
    for (const peso of pesos) {
      desplazamientoX.push(desplazamiento);
      desplazamiento += (Math.max(peso, 0.01) / sumaPesos) * ANCHO_UTIL;
    }

    const aCeldas = (valores: readonly string[], estilo: EstiloFuente): LineaCelda[] =>
      valores.map((valor, indice) => {
        const anchoCelda = Math.max(
          (Math.max(pesos[indice] ?? 1, 0.01) / sumaPesos) * ANCHO_UTIL - 2 * PADDING_CELDA_X,
          cuerpo,
        );

        const lineas = ajustarLineas(aPalabras([{ texto: valor, estilo }]), medir, cuerpo, anchoCelda).map(
          (palabras) => ({
            palabras,
            anchoPalabras: anchoDeLinea(palabras, medir, cuerpo),
            cuerpo,
            interlineado: 1.25,
            alto: cuerpo * 1.25,
            alineacion: "izquierda" as const,
            justificada: false,
            sangriaX: desplazamientoX[indice] + PADDING_CELDA_X,
            anchoLinea: anchoCelda,
            color: COLOR_TEXTO,
          }),
        );

        const altoTexto = lineas.reduce((total, linea) => total + linea.alto, 0);
        return { lineas, alto: altoTexto + 2 * PADDING_CELDA_Y };
      });

    return {
      clase: "tabla",
      encabezado: aCeldas(bloque.columnas, "negrita"),
      filas: bloque.filas.map((fila) => aCeldas(fila, "normal")),
      desplazamientoX,
      espacioAntes: bloque.espacioAntes ?? 10,
      espacioDespues: bloque.espacioDespues ?? 10,
    };
  }

  // -------------------------------------------------------------------------
  // Composicion: unidades de flujo -> hojas con contenido posicionado
  // -------------------------------------------------------------------------

  private componer(
    unidades: readonly UnidadFlujo[],
    membrete: MembreteInstitucional,
  ): Compositor {
    const compositor = new Compositor(
      this.altoMembrete(membrete),
      ALTO_ENCABEZADO_CONTINUACION,
      ALTO_PIE,
    );
    compositor.iniciar();

    for (let indice = 0; indice < unidades.length; indice += 1) {
      const unidad = unidades[indice];
      const siguiente = unidades[indice + 1];

      switch (unidad.clase) {
        case "atomica":
          this.colocarAtomica(compositor, unidad, siguiente);
          break;
        case "secuencia":
          this.colocarSecuencia(compositor, unidad);
          break;
        case "tabla":
          this.colocarTabla(compositor, unidad);
          break;
      }
    }

    return compositor;
  }

  /** Alto que un bloque ocupa completo, sin contar margenes externos. */
  private altoDe(unidad: UnidadFlujo): number {
    if (unidad.clase === "tabla") {
      const encabezado = this.altoFila(unidad.encabezado);
      const filas = unidad.filas.reduce((total, fila) => total + this.altoFila(fila), 0);
      return encabezado + filas;
    }

    const texto = unidad.lineas.reduce((total, linea) => total + linea.alto, 0);
    const reglas = unidad.clase === "atomica"
      ? Math.max(0, ...unidad.reglasInternas.map((r) => r.desplazamientoY + r.grosor / 2))
      : 0;

    return Math.max(texto, reglas);
  }

  /** Alto minimo que un bloque debe reservar para no quedar huerfano. */
  private altoMinimoDe(unidad: UnidadFlujo): number {
    if (unidad.clase === "tabla") {
      const primera = unidad.filas[0];
      return (
        this.altoFila(unidad.encabezado) + (primera !== undefined ? this.altoFila(primera) : 0)
      );
    }

    if (unidad.clase === "atomica") {
      return this.altoDe(unidad);
    }

    let total = 0;
    for (let i = 0; i < Math.min(MIN_LINEAS_COMPANERAS, unidad.lineas.length); i += 1) {
      total += unidad.lineas[i].alto;
    }
    return total;
  }

  private altoFila(celdas: readonly LineaCelda[]): number {
    return celdas.reduce((maximo, celda) => Math.max(maximo, celda.alto), 0);
  }

  private colocarAtomica(
    compositor: Compositor,
    unidad: UnidadAtomica,
    siguiente: UnidadFlujo | undefined,
  ): void {
    const alto = this.altoDe(unidad);

    // Conservar el titulo junto al parrafo que introduce: si no alcanzan las
    // lineas companeras, el titulo pasa integro a la hoja siguiente.
    const reserva =
      unidad.conservaConSiguiente && siguiente !== undefined
        ? this.altoMinimoDe(siguiente)
        : 0;

    compositor.reservar(
      compositor.espacioAntesDe(unidad.espacioAntes) + alto + reserva,
    );

    compositor.consumir(compositor.espacioAntesDe(unidad.espacioAntes));

    const yBloque = compositor.cursor();
    for (const regla of unidad.reglasInternas) {
      compositor.colocarRegla({
        x1: regla.x1,
        x2: regla.x2,
        y: yBloque - regla.desplazamientoY,
        grosor: regla.grosor,
        color: regla.color,
      });
    }

    for (const linea of unidad.lineas) {
      compositor.colocarLinea(linea);
    }

    compositor.consumir(unidad.espacioDespues);
  }

  private colocarSecuencia(compositor: Compositor, unidad: UnidadSecuencia): void {
    if (unidad.lineas.length === 0) {
      compositor.consumir(
        compositor.espacioAntesDe(unidad.espacioAntes) + unidad.espacioDespues,
      );
      return;
    }

    compositor.consumir(compositor.espacioAntesDe(unidad.espacioAntes));

    const total = unidad.lineas.length;
    let indice = 0;
    let corteForzado = false;

    while (indice < total) {
      const restantes = total - indice;
      const alto = unidad.lineas[indice].alto;

      let caben = compositor.lineasQueCaben(alto);

      // Corte de pagina antes de dejar una linea huerfana al final de la hoja.
      if (
        compositor.tieneContenido() &&
        !corteForzado &&
        caben < Math.min(MIN_LINEAS_ANTI_VIUDA, restantes) &&
        caben < restantes
      ) {
        compositor.nuevaHoja();
        caben = compositor.lineasQueCaben(alto);
      }

      if (caben <= 0 && compositor.tieneContenido()) {
        compositor.nuevaHoja();
        caben = compositor.lineasQueCaben(alto);
      }

      let aColocar = Math.min(caben, restantes);

      // No dejar una unica linea viuda en la hoja siguiente.
      if (restantes - aColocar === 1 && aColocar >= MIN_LINEAS_ANTI_VIUDA) {
        aColocar -= 1;
      }

      if (aColocar <= 0) {
        aColocar = 1;
      }

      for (let i = 0; i < aColocar && indice < total; i += 1) {
        compositor.colocarLinea(unidad.lineas[indice]);
        indice += 1;
      }

      corteForzado = false;

      if (indice < total) {
        compositor.nuevaHoja();
        corteForzado = true;
      }
    }

    compositor.consumir(unidad.espacioDespues);
  }

  private colocarTabla(compositor: Compositor, unidad: UnidadTabla): void {
    compositor.consumir(compositor.espacioAntesDe(unidad.espacioAntes));

    const anchoDerecho = A4_PUNTOS.ancho - MARGEN_PUNTOS;
    const altoEncabezado = this.altoFila(unidad.encabezado);

    const dibujarEncabezado = (): void => {
      const ySuperior = compositor.cursor();
      compositor.colocarRegla({
        x1: MARGEN_PUNTOS,
        x2: anchoDerecho,
        y: ySuperior + 2 * PADDING_CELDA_Y,
        grosor: 1,
        color: COLOR_REGLA,
      });

      for (const celda of unidad.encabezado) {
        for (const linea of celda.lineas) {
          compositor.colocarLinea(linea);
        }
      }

      compositor.colocarRegla({
        x1: MARGEN_PUNTOS,
        x2: anchoDerecho,
        y: compositor.cursor() + 2 * PADDING_CELDA_Y,
        grosor: 0.6,
        color: COLOR_REGLA,
      });
    };

    const dibujarFila = (celdas: readonly LineaCelda[], ultima: boolean): void => {
      for (const celda of celdas) {
        for (const linea of celda.lineas) {
          compositor.colocarLinea(linea);
        }
      }
      compositor.colocarRegla({
        x1: MARGEN_PUNTOS,
        x2: anchoDerecho,
        y: compositor.cursor() + 2 * PADDING_CELDA_Y,
        grosor: ultima ? 1 : 0.3,
        color: ultima ? COLOR_REGLA : COLOR_REGLA_SUAVE,
      });
    };

    let necesitaEncabezado = true;
    let corteForzado = false;
    let indice = 0;

    while (indice < unidad.filas.length) {
      if (necesitaEncabezado) {
        const primeraFila = this.altoFila(unidad.filas[indice]);
        compositor.reservar(altoEncabezado + primeraFila);
        dibujarEncabezado();
        necesitaEncabezado = false;
      }

      const celdas = unidad.filas[indice];
      const alto = this.altoFila(celdas);

      if (
        compositor.espacioDisponible() < alto &&
        compositor.tieneContenido() &&
        !corteForzado
      ) {
        compositor.nuevaHoja();
        necesitaEncabezado = true;
        corteForzado = true;
        continue;
      }

      dibujarFila(celdas, indice === unidad.filas.length - 1);
      indice += 1;
      corteForzado = false;
    }

    compositor.consumir(unidad.espacioDespues);
  }

  // -------------------------------------------------------------------------
  // Pintado
  // -------------------------------------------------------------------------

  private altoMembrete(membrete: MembreteInstitucional): number {
    let alto = 3 * 12 + 16;
    if (membrete.tipoDocumento !== undefined) {
      alto += 2 * 16;
    }
    return alto;
  }

  private pintarMembrete(
    hoja: PDFPage,
    fuentes: Record<EstiloFuente, PDFFont>,
    membrete: MembreteInstitucional,
  ): void {
    let y = A4_PUNTOS.alto - MARGEN_PUNTOS;

    const centrar = (texto: string, estilo: EstiloFuente, cuerpo: number, color: RGB): void => {
      const ancho = fuentes[estilo].widthOfTextAtSize(texto, cuerpo);
      hoja.drawText(texto, {
        x: (A4_PUNTOS.ancho - ancho) / 2,
        y,
        size: cuerpo,
        font: fuentes[estilo],
        color,
      });
      y -= cuerpo * 1.35;
    };

    centrar(membrete.institucion, "negrita", 11, COLOR_TEXTO);
    if (membrete.unidad !== undefined) {
      centrar(membrete.unidad, "normal", 9.5, COLOR_TEXTO);
    }
    if (membrete.direccion !== undefined) {
      centrar(membrete.direccion, "normal", 8.5, COLOR_SECUNDARIO);
    }

    y -= 6;
    this.regla(hoja, MARGEN_PUNTOS, A4_PUNTOS.ancho - MARGEN_PUNTOS, y, 1.4, COLOR_REGLA);
    this.regla(hoja, MARGEN_PUNTOS, A4_PUNTOS.ancho - MARGEN_PUNTOS, y - 3, 0.5, COLOR_REGLA);

    y -= 18;
    if (membrete.tipoDocumento !== undefined) {
      centrar(membrete.tipoDocumento, "negrita", 12, COLOR_TEXTO);
    }
    if (membrete.numeroDocumento !== undefined) {
      centrar(membrete.numeroDocumento, "negrita", 12, COLOR_TEXTO);
    }
  }

  private pintarEncabezadoContinuacion(
    hoja: PDFPage,
    fuentes: Record<EstiloFuente, PDFFont>,
    membrete: MembreteInstitucional,
  ): void {
    const texto = membrete.sigla ?? membrete.institucion;
    const ancho = fuentes["normal"].widthOfTextAtSize(texto, 8.5);
    const y = A4_PUNTOS.alto - MARGEN_PUNTOS - 10;

    hoja.drawText(texto, {
      x: (A4_PUNTOS.ancho - ancho) / 2,
      y,
      size: 8.5,
      font: fuentes["normal"],
      color: COLOR_SECUNDARIO,
    });

    this.regla(
      hoja,
      MARGEN_PUNTOS,
      A4_PUNTOS.ancho - MARGEN_PUNTOS,
      y - 8,
      0.4,
      COLOR_REGLA_SUAVE,
    );
  }

  private pintarContenido(
    hoja: PDFPage,
    fuentes: Record<EstiloFuente, PDFFont>,
    pagina: PaginaCompuesta,
  ): void {
    for (const linea of pagina.lineas) {
      this.pintarLinea(hoja, fuentes, linea);
    }

    for (const regla of pagina.reglas) {
      this.regla(hoja, regla.x1, regla.x2, regla.y, regla.grosor, regla.color);
    }
  }

  private pintarLinea(
    hoja: PDFPage,
    fuentes: Record<EstiloFuente, PDFFont>,
    linea: LineaColocada,
  ): void {
    if (linea.palabras.length === 0) {
      return;
    }

    const holgura = linea.anchoLinea - linea.anchoPalabras;
    const x = MARGEN_PUNTOS + linea.sangriaX;

    if (linea.justificada && linea.palabras.length > 1 && holgura >= 0) {
      const hueco = holgura / (linea.palabras.length - 1);
      let cursor = x;
      for (const palabra of linea.palabras) {
        const fuente = fuentes[palabra.estilo];
        hoja.drawText(palabra.texto, {
          x: cursor,
          y: linea.y,
          size: linea.cuerpo,
          font: fuente,
          color: linea.color,
        });
        cursor += fuente.widthOfTextAtSize(palabra.texto, linea.cuerpo) + hueco;
      }
      return;
    }

    let cursor = x;
    if (linea.alineacion === "centro") {
      cursor += holgura / 2;
    } else if (linea.alineacion === "derecha") {
      cursor += holgura;
    }

    const estiloUnico = linea.palabras.every(
      (palabra) => palabra.estilo === linea.palabras[0].estilo,
    );

    if (estiloUnico) {
      hoja.drawText(
        linea.palabras.map((palabra) => palabra.texto).join(" "),
        {
          x: cursor,
          y: linea.y,
          size: linea.cuerpo,
          font: fuentes[linea.palabras[0].estilo],
          color: linea.color,
        },
      );
      return;
    }

    const ultima = linea.palabras.length - 1;
    for (const [indice, palabra] of linea.palabras.entries()) {
      const fuente = fuentes[palabra.estilo];
      hoja.drawText(palabra.texto, {
        x: cursor,
        y: linea.y,
        size: linea.cuerpo,
        font: fuente,
        color: linea.color,
      });
      cursor += fuente.widthOfTextAtSize(palabra.texto, linea.cuerpo);
      if (indice !== ultima) {
        cursor += fuente.widthOfTextAtSize(" ", linea.cuerpo);
      }
    }
  }

  private pintarPie(
    hoja: PDFPage,
    fuentes: Record<EstiloFuente, PDFFont>,
    membrete: MembreteInstitucional,
    pagina: number,
    total: number,
  ): void {
    const y = MARGEN_PUNTOS + 14;

    this.regla(
      hoja,
      MARGEN_PUNTOS,
      A4_PUNTOS.ancho - MARGEN_PUNTOS,
      y + 12,
      0.4,
      COLOR_REGLA_SUAVE,
    );

    const izquierda = membrete.correlativo ?? membrete.sigla ?? membrete.institucion;
    hoja.drawText(izquierda, {
      x: MARGEN_PUNTOS,
      y,
      size: 8,
      font: fuentes["normal"],
      color: COLOR_SECUNDARIO,
    });

    const textoDerecha = `Pagina ${pagina} de ${total}`;
    const anchoDerecha = fuentes["negrita"].widthOfTextAtSize(textoDerecha, 8);
    hoja.drawText(textoDerecha, {
      x: A4_PUNTOS.ancho - MARGEN_PUNTOS - anchoDerecha,
      y,
      size: 8,
      font: fuentes["negrita"],
      color: COLOR_SECUNDARIO,
    });
  }

  private regla(
    hoja: PDFPage,
    x1: number,
    x2: number,
    y: number,
    grosor: number,
    color: RGB,
  ): void {
    hoja.drawLine({
      start: { x: x1, y },
      end: { x: x2, y },
      thickness: grosor,
      color,
    });
  }
}

export const a4GeneratorService = new A4GeneratorService();

export default a4GeneratorService;
