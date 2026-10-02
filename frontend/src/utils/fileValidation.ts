export const MAX_PDF_SIZE_BYTES = 25 * 1024 * 1024;

export type FileValidationResult =
  | { valid: true }
  | { valid: false; reason: string };

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d] as const;

export async function validatePdfMagicBytes(file: File): Promise<boolean> {
  const bytes = new Uint8Array(
    await file.slice(0, PDF_SIGNATURE.length).arrayBuffer(),
  );

  return PDF_SIGNATURE.every((byte, index) => bytes[index] === byte);
}

export async function validatePdfFile(file: File): Promise<FileValidationResult> {
  if (file.size > MAX_PDF_SIZE_BYTES) {
    return {
      valid: false,
      reason: "El archivo supera el tamaño máximo permitido de 25 MB.",
    };
  }

  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return {
      valid: false,
      reason: "El archivo debe tener la extensión .pdf.",
    };
  }

  return (await validatePdfMagicBytes(file))
    ? { valid: true }
    : {
        valid: false,
        reason: "El archivo no contiene la firma binaria PDF válida (%PDF-).",
      };
}
