import { PDFDocument } from 'pdf-lib';

export interface DocumentoCargadoConFolios {
  id: string;
  idRequisito?: string | null;
  nombreRequisito?: string;
  archivo: File;
  nombreArchivo: string;
  tamanoBytes: number;
  paginas: number;
  folioInicio: number;
  folioFin: number;
  hashSha256?: string;
  base64?: string;
}

/**
 * Lee el contenido binario del archivo PDF y obtiene la cantidad exacta de páginas físicas.
 */
export async function contarPaginasPdfArchivo(file: File): Promise<number> {
  try {
    const buffer = await file.arrayBuffer();
    const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const count = pdf.getPageCount();
    return count > 0 ? count : 1;
  } catch (error) {
    console.warn('[Foliación] No se pudo contar páginas físicas con pdf-lib, fallback a 1:', error);
    return 1;
  }
}

/**
 * Recalcula de forma continua y secuencial los rangos de foliación de los documentos cargados.
 * Garantiza la regla: 1 página física = 1 folio documental, con folio_inicio = anterior_fin + 1.
 */
export function recalcularRangosFolios(documentos: DocumentoCargadoConFolios[]): {
  documentosConFolios: DocumentoCargadoConFolios[];
  totalFolios: number;
} {
  let folioActual = 1;
  const documentosConFolios = documentos.map((doc) => {
    const folioInicio = folioActual;
    const folioFin = folioInicio + doc.paginas - 1;
    folioActual = folioFin + 1;
    return {
      ...doc,
      folioInicio,
      folioFin,
    };
  });
  const totalFolios = documentosConFolios.length > 0 ? folioActual - 1 : 0;
  return { documentosConFolios, totalFolios };
}

/**
 * Recalcula de forma continua y secuencial los rangos de foliación para objetos genéricos con paginas.
 */
export function recalcularRangosArchivos<T extends { paginas?: number; folioInicio?: number; folioFin?: number }>(
  archivos: T[],
): {
  archivosConFolios: T[];
  totalFolios: number;
} {
  let folioActual = 1;
  const archivosConFolios = archivos.map((archivo) => {
    const paginas = archivo.paginas && archivo.paginas > 0 ? archivo.paginas : 1;
    const folioInicio = folioActual;
    const folioFin = folioInicio + paginas - 1;
    folioActual = folioFin + 1;
    return {
      ...archivo,
      paginas,
      folioInicio,
      folioFin,
    };
  });
  const totalFolios = archivosConFolios.length > 0 ? folioActual - 1 : 0;
  return { archivosConFolios, totalFolios };
}
