const PDF_MAGIC_BYTES = [0x25, 0x50, 0x44, 0x46] as const;

export async function validatePdfMagicBytes(file: File): Promise<boolean> {
  const bytes = new Uint8Array(await file.slice(0, 4).arrayBuffer());

  return PDF_MAGIC_BYTES.every((byte, index) => bytes[index] === byte);
}
