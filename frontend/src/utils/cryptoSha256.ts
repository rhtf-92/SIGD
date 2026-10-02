/**
 * Normaliza bytes al realm actual antes de invocar WebCrypto.
 *
 * En jsdom (Vitest) el `ArrayBuffer` devuelto por `Blob.arrayBuffer()`
 * pertenece a otro realm y `crypto.subtle.digest` (Node) lo rechaza con:
 * "2nd argument is not instance of ArrayBuffer, Buffer, TypedArray, or DataView".
 * Envolverlo en un `Uint8Array` del realm actual resuelve el problema
 * tanto en navegador como en tests.
 */
export function normalizeBytesForDigest(data: ArrayBuffer | ArrayBufferView): Uint8Array {
  if (ArrayBuffer.isView(data)) {
    const maybeDataView = data as unknown as {
      getUint8?: unknown;
      length?: unknown;
    };
    if (
      typeof maybeDataView.getUint8 === "function" &&
      typeof maybeDataView.length === "undefined"
    ) {
      const dataView = data as unknown as DataView;
      const copy = new Uint8Array(dataView.byteLength);
      for (let i = 0; i < dataView.byteLength; i++) {
        copy[i] = dataView.getUint8(i);
      }
      return copy;
    }
    return new Uint8Array(data as unknown as Uint8Array);
  }
  return new Uint8Array(data);
}

export async function computeSha256Hex(data: ArrayBuffer | ArrayBufferView): Promise<string> {
  const cryptoApi = globalThis.crypto;

  if (!cryptoApi?.subtle) {
    throw new Error("La Web Crypto API no está disponible en este navegador.");
  }

  const bytes = normalizeBytesForDigest(data);
  const hashBuffer = await cryptoApi.subtle.digest("SHA-256", bytes as BufferSource);

  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function computeFileSha256(file: File): Promise<string> {
  const rawBuffer = await file.arrayBuffer();
  return computeSha256Hex(rawBuffer);
}

export const calculateFileSha256 = computeFileSha256;
