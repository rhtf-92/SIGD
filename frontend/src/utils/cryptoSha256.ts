export async function computeFileSha256(file: File): Promise<string> {
  const cryptoApi = globalThis.crypto;

  if (!cryptoApi?.subtle) {
    throw new Error("La Web Crypto API no está disponible en este navegador.");
  }

  const rawBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(rawBuffer);
  const hashBuffer = await cryptoApi.subtle.digest("SHA-256", uint8Array);

  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
