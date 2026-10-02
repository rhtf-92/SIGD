/**
 * Tipos compartidos del dominio DocuCore (Grupo 5).
 *
 * Alcance: modelos de contenido institucional que consume el generador de PDF
 * hoja A4 y el modelo de datos de la sesion de firma digital.
 *
 * Estado: PROPUESTO. Los nombres de bloques y sus opciones son una propuesta
 * tecnica del Backend y deben validarse contra la plantilla oficial de
 * resoluciones directorales que entregue la institucion.
 */

/** Alineacion horizontal admitida en un bloque de texto. */
export type Alineacion = "izquierda" | "centro" | "derecha" | "justificado";

/** Estilos de fuente disponibles. Las variantes derivan de la familia Helvetica. */
export type EstiloFuente = "normal" | "negrita" | "cursiva" | "negritaCursiva";

/** Opciones tipograficas comunes a todo bloque de texto corrido. */
export interface OpcionesTipograficas {
  /** Alineacion horizontal. Por omision, "justificado". */
  alineacion?: Alineacion;
  /** Sangria de primera linea, en puntos. */
  sangria?: number;
  /** Sangria izquierda aplicada a todas las lineas, en puntos. */
  sangriaIzquierda?: number;
  /** Espacio vertical antes del bloque, en puntos. */
  espacioAntes?: number;
  /** Espacio vertical despues del bloque, en puntos. */
  espacioDespues?: number;
  /** Factor de interlineado respecto al cuerpo tipografico. Por omision, 1.45. */
  interlineado?: number;
  /** Cuerpo tipografico en puntos. Por omision, 11. */
  cuerpo?: number;
  /** Estilo de fuente. Por omision, "normal". */
  estilo?: EstiloFuente;
}

export interface BloqueParrafo extends OpcionesTipograficas {
  tipo: "parrafo";
  texto: string;
}

export interface BloqueEncabezado {
  tipo: "encabezado";
  texto: string;
  /** 1 = titulo de seccion, 2 = subtitulo, 3 = titulo menor. Por omision, 2. */
  nivel?: 1 | 2 | 3;
  alineacion?: Alineacion;
  espacioAntes?: number;
  espacioDespues?: number;
}

/** Articulo de la parte resolutiva, con entradilla en negrita. */
export interface BloqueArticulo extends OpcionesTipograficas {
  tipo: "articulo";
  /** Entradilla ya formateada, por ejemplo "Articulo 1.-". */
  numero: string;
  texto: string;
}

export interface BloqueLista {
  tipo: "lista";
  items: readonly string[];
  marcador?: "vinetas" | "numeros";
  sangria?: number;
  espacioAntes?: number;
  espacioDespues?: number;
  interlineado?: number;
  cuerpo?: number;
}

export interface BloqueSeparador {
  tipo: "separador";
  /** Grosor de la linea horizontal, en puntos. Por omision, 0.75. */
  grosor?: number;
  /** Espacio vertical antes y despues del separador, en puntos. */
  espacio?: number;
}

export interface BloqueTabla {
  tipo: "tabla";
  columnas: readonly string[];
  filas: readonly (readonly string[])[];
  /**
   * Anchos relativos por columna. Si se omite, se distribuyen segun el numero
   * de columnas. La suma no necesita sumar 1: se normaliza internamente.
   */
  anchosRelativos?: readonly number[];
  cuerpo?: number;
  espacioAntes?: number;
  espacioDespues?: number;
}

export interface BloqueFirma {
  tipo: "firma";
  cargo: string;
  nombre: string;
  documento?: string;
  espacioAntes?: number;
  alineacion?: Alineacion;
}

export type BloqueResolucion =
  | BloqueParrafo
  | BloqueEncabezado
  | BloqueArticulo
  | BloqueLista
  | BloqueSeparador
  | BloqueTabla
  | BloqueFirma;

/** Datos del membrete institucional que encabezan el documento. */
export interface MembreteInstitucional {
  institucion: string;
  unidad?: string;
  direccion?: string;
  /** Tipo y numero del acto, por ejemplo "Resolucion Directoral N.° 0001-2026". */
  tipoDocumento?: string;
  numeroDocumento?: string;
  /** Correlativo legal impreso en el pie de cada hoja. */
  correlativo?: string;
  /** Texto breve que se repite en las hojas de continuacion. */
  sigla?: string;
}

/** Contenido completo de una resolucion directional. */
export interface ContenidoResolucion {
  titulo?: string;
  subtitulo?: string;
  bloques: readonly BloqueResolucion[];
}
