import { PDFDocument } from 'pdf-lib';
import { createHash } from 'node:crypto';
import { ValidationError } from '../../shared/domain/errors/index.js';

export interface AnalisisPdfResultado {
  valido: boolean;
  paginas: number;
  tamanoBytes: number;
  sha256: string;
}

export interface DocumentoFoliado {
  nombreArchivo: string;
  paginas: number;
  folioInicio: number;
  folioFin: number;
}

/**
 * Analiza la estructura real de un archivo binario PDF en backend.
 * - Verifica magic bytes (%PDF-).
 * - Analiza estructura con pdf-lib (PDFDocument.load).
 * - Detecta archivos cifrados o protegidos con contraseña.
 * - Detecta archivos corruptos o dañados con mensajes comprensibles.
 * - Obtiene el conteo real de páginas.
 * - No confía en metadatos enviados desde el cliente.
 */
export async function analizarPdfBuffer(bytes: Buffer): Promise<AnalisisPdfResultado> {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) {
    throw new ValidationError({
      invalidParams: [{ name: 'archivo', reason: 'El archivo está vacío o no es un búfer válido.' }],
    });
  }

  // 1. Verificación de firma binaria PDF (%PDF-)
  if (bytes.length < 5 || bytes.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw new ValidationError({
      invalidParams: [{ name: 'archivo', reason: 'El archivo no es un documento PDF válido (firma binaria ausente).' }],
    });
  }

  const sha256 = createHash('sha256').update(bytes).digest('hex');

  // 2. Carga y verificación estructural
  let pdf: PDFDocument;
  let paginas: number;
  try {
    pdf = await PDFDocument.load(bytes, { ignoreEncryption: false });
    if (pdf.isEncrypted) {
      throw new ValidationError({
        invalidParams: [{ name: 'archivo', reason: 'El archivo PDF está cifrado o protegido por contraseña. Desbloquee el documento antes de adjuntarlo.' }],
      });
    }
    paginas = pdf.getPageCount();
  } catch (error: any) {
    if (error instanceof ValidationError) {
      throw error;
    }
    const errorMsg = String(error?.message ?? '');
    if (errorMsg.includes('encrypted') || errorMsg.includes('password') || error?.name === 'EncryptedPDFError') {
      throw new ValidationError({
        invalidParams: [{ name: 'archivo', reason: 'El archivo PDF está cifrado o protegido por contraseña. Desbloquee el documento antes de adjuntarlo.' }],
      });
    }
    throw new ValidationError({
      invalidParams: [{ name: 'archivo', reason: 'El archivo PDF está dañado o tiene una estructura interna inválida.' }],
    });
  }

  // 3. Verificación de límites de páginas
  if (!Number.isInteger(paginas) || paginas < 1) {
    throw new ValidationError({
      invalidParams: [{ name: 'archivo', reason: 'El archivo PDF no contiene páginas legibles o válidas.' }],
    });
  }

  if (paginas > 5000) {
    throw new ValidationError({
      invalidParams: [{ name: 'archivo', reason: 'El documento PDF supera el límite institucional de 5000 páginas por archivo.' }],
    });
  }

  return {
    valido: true,
    paginas,
    tamanoBytes: bytes.length,
    sha256,
  };
}

/** Cuenta las páginas del PDF recibido desde el storage; nunca acepta conteo del cliente. */
export async function contarPaginasPdf(bytes: Buffer): Promise<number> {
  const analisis = await analizarPdfBuffer(bytes);
  return analisis.paginas;
}

/**
 * Asigna foliación correlativa ininterrumpida a una lista determinista de documentos.
 * Ejemplo:
 * - Doc 1 (2 págs) -> Folios 1–2
 * - Doc 2 (1 pág)  -> Folio 3
 * - Doc 3 (3 págs) -> Folios 4–6
 * - Doc 4 (4 págs) -> Folios 7–10
 * Total = 10 folios.
 */
export function calcularFoliacionCorrelativa<T extends { nombreArchivo: string; paginas: number }>(
  documentos: T[],
  folioBase = 1,
): { documentosFoliados: Array<T & { folioInicio: number; folioFin: number }>; totalFolios: number } {
  let actual = Math.max(1, folioBase);
  let totalFolios = 0;

  const documentosFoliados = documentos.map((doc) => {
    const pags = Math.max(1, doc.paginas);
    const folioInicio = actual;
    const folioFin = actual + pags - 1;
    actual = folioFin + 1;
    totalFolios += pags;
    return {
      ...doc,
      folioInicio,
      folioFin,
    };
  });

  return { documentosFoliados, totalFolios };
}
