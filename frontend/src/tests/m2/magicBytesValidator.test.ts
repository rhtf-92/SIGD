import { describe, expect, it, vi } from "vitest";
import axios from "axios";

import { uploadToPresignedUrl } from "../../hooks/usePresignedUpload";
import { computeFileSha256 } from "../../utils/cryptoSha256";
import { validatePdfMagicBytes } from "../../utils/magicBytesValidator";

const PDF_BYTES = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31];

function createPdfFile(content: number[] = PDF_BYTES) {
  return new File([new Uint8Array(content)], "documento.pdf", {
    type: "application/pdf",
  });
}

describe("magicBytesValidator", () => {
  it("aprueba un PDF real", async () => {
    const file = createPdfFile();
    await expect(validatePdfMagicBytes(file)).resolves.toBe(true);
  });

  it("rechaza magic bytes incorrectos", async () => {
    const file = createPdfFile([0x25, 0x50, 0x44, 0x45]);
    await expect(validatePdfMagicBytes(file)).resolves.toBe(false);
  });

  it("rechaza un .exe renombrado a .pdf", async () => {
    const file = createPdfFile([0x4d, 0x5a, 0x90, 0x00]);
    await expect(validatePdfMagicBytes(file)).resolves.toBe(false);
  });

  it("rechaza un .docx renombrado a .pdf", async () => {
    const file = createPdfFile([0x50, 0x4b, 0x03, 0x04]);
    await expect(validatePdfMagicBytes(file)).resolves.toBe(false);
  });

  it("calcula SHA-256 correctamente", async () => {
    const file = createPdfFile();
    const hash = await computeFileSha256(file);
    expect(hash).toBe("21af8e71c8703196df7fe1ff901869a88fe64c07bbaa83d838efb45a52b4f303");
  });

  it("cancelación controlada durante la subida", async () => {
    const controller = new AbortController();
    const putSpy = vi.spyOn(axios, "put").mockImplementation(
      () =>
        new Promise((_, reject) => {
          controller.signal.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        }),
    );

    const promise = uploadToPresignedUrl(
      "https://example.com/upload",
      createPdfFile(),
      { "Content-Type": "application/pdf" },
      controller.signal,
      () => undefined,
    );

    controller.abort();

    await expect(promise).rejects.toThrow();
    expect(putSpy).toHaveBeenCalledOnce();
  });
});
