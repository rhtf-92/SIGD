import { describe, expect, it } from "vitest";

import {
  MAX_PDF_SIZE_BYTES,
  validatePdfFile,
} from "../../utils/fileValidation";

function createFile(
  signature: number[],
  name = "documento.pdf",
  type = "application/pdf",
  size = signature.length,
): File {
  const bytes = new Uint8Array(size);
  bytes.set(signature);
  return new File([bytes], name, { type });
}

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d];

describe("validatePdfFile", () => {
  it.each(["1.4", "1.7", "2.0"])(
    "acepta PDF %s por la firma real %PDF-",
    async (version) => {
      const file = createFile([...PDF_SIGNATURE, ...new TextEncoder().encode(version)]);
      await expect(validatePdfFile(file)).resolves.toEqual({ valid: true });
    },
  );

  it("rechaza un archivo que no empieza con %PDF-", async () => {
    const file = createFile([0x25, 0x50, 0x44, 0x46, 0x58]);
    await expect(validatePdfFile(file)).resolves.toMatchObject({
      valid: false,
      reason: expect.stringContaining("firma binaria PDF"),
    });
  });

  it("rechaza un EXE renombrado a PDF", async () => {
    const file = createFile([0x4d, 0x5a, 0x90, 0x00, 0x03]);
    await expect(validatePdfFile(file)).resolves.toMatchObject({ valid: false });
  });

  it("rechaza un DOCX renombrado a PDF", async () => {
    const file = createFile([0x50, 0x4b, 0x03, 0x04, 0x14]);
    await expect(validatePdfFile(file)).resolves.toMatchObject({ valid: false });
  });

  it("rechaza MIME application/pdf si los Magic Bytes no son PDF", async () => {
    const file = createFile([0x00, 0x01, 0x02, 0x03, 0x04]);
    await expect(validatePdfFile(file)).resolves.toMatchObject({ valid: false });
  });

  it("rechaza archivos superiores a 25 MB", async () => {
    const file = createFile(
      PDF_SIGNATURE,
      "documento.pdf",
      "application/pdf",
      MAX_PDF_SIZE_BYTES + 1,
    );
    await expect(validatePdfFile(file)).resolves.toMatchObject({
      valid: false,
      reason: expect.stringContaining("25 MB"),
    });
  });

  it("acepta un PDF de exactamente 25 MB", async () => {
    const file = createFile(
      PDF_SIGNATURE,
      "documento.pdf",
      "application/pdf",
      MAX_PDF_SIZE_BYTES,
    );
    await expect(validatePdfFile(file)).resolves.toEqual({ valid: true });
  });
});
