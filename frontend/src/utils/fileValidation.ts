export const MAX_PDF_SIZE_BYTES = 25 * 1024 * 1024;
export const MAX_FILE_SIZE_BYTES = MAX_PDF_SIZE_BYTES;

export const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".doc",
  ".docx",
] as const;

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/octet-stream",
] as const;

export type FileValidationResult =
  | { valid: true }
  | { valid: false; reason: string };

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d] as const; // %PDF-
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47] as const; // .PNG
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff] as const; // JPEG SOI
const ZIP_OOXML_SIGNATURE = [0x50, 0x4b, 0x03, 0x04] as const; // PK.. (.docx)
const OLE2_DOC_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0] as const; // OLE2 (.doc)

function startsWithSignature(bytes: Uint8Array, signature: readonly number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((byte, index) => bytes[index] === byte);
}

export function getFileExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : "";
}

export function inferInstitutionalMimeType(file: File): string {
  const ext = getFileExtension(file.name);
  switch (ext) {
    case ".pdf":
      return "application/pdf";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".doc":
      return "application/msword";
    case ".docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    default:
      return file.type || "application/pdf";
  }
}

export async function validatePdfMagicBytes(file: File): Promise<boolean> {
  const bytes = new Uint8Array(
    await file.slice(0, PDF_SIGNATURE.length).arrayBuffer(),
  );

  return startsWithSignature(bytes, PDF_SIGNATURE);
}

/**
 * Valida de forma flexible la firma binaria según la extensión del archivo
 * (.pdf, .png, .jpg/.jpeg, .doc, .docx), evitando rechazos rígidos innecesarios
 * en documentos institucionales legítimos.
 */
export async function validateFlexibleMagicBytes(file: File): Promise<boolean> {
  if (file.size === 0) return false;

  const ext = getFileExtension(file.name);
  const headerBytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());

  if (ext === ".pdf") {
    return startsWithSignature(headerBytes, PDF_SIGNATURE);
  }
  if (ext === ".png") {
    return startsWithSignature(headerBytes, PNG_SIGNATURE);
  }
  if (ext === ".jpg" || ext === ".jpeg") {
    return startsWithSignature(headerBytes, JPEG_SIGNATURE);
  }
  if (ext === ".docx") {
    return startsWithSignature(headerBytes, ZIP_OOXML_SIGNATURE) || headerBytes.length > 0;
  }
  if (ext === ".doc") {
    return startsWithSignature(headerBytes, OLE2_DOC_SIGNATURE) || headerBytes.length > 0;
  }

  return headerBytes.length > 0;
}

export async function validateInstitutionalFile(
  file: File,
): Promise<FileValidationResult> {
  if (file.size === 0) {
    return {
      valid: false,
      reason:
        "El archivo seleccionado parece estar vacío. Por favor, elige un documento válido.",
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      reason:
        "Tu archivo supera el tamaño máximo permitido de 25 MB. Por favor, comprime el documento o selecciona uno más liviano.",
    };
  }

  const ext = getFileExtension(file.name);
  const isAllowedExt = (ALLOWED_EXTENSIONS as readonly string[]).includes(ext);
  const isAllowedMime =
    Boolean(file.type) &&
    (ALLOWED_MIME_TYPES as readonly string[]).includes(file.type.toLowerCase());

  if (!isAllowedExt && !isAllowedMime) {
    return {
      valid: false,
      reason:
        "Formato de archivo no compatible. Puedes adjuntar documentos en PDF, Word (.doc, .docx) o imágenes (.png, .jpg).",
    };
  }

  const validSignature = await validateFlexibleMagicBytes(file);
  if (!validSignature) {
    return {
      valid: false,
      reason:
        "El contenido del archivo no coincide con su formato o parece estar dañado. Por favor, verifica tu documento e inténtalo nuevamente.",
    };
  }

  return { valid: true };
}

export async function validatePdfFile(file: File): Promise<FileValidationResult> {
  return validateInstitutionalFile(file);
}
