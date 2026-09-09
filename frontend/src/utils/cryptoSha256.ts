export async function computeFileSha256(file: File): Promise<string> {
  const cryptoApi = globalThis.crypto;

  if (!cryptoApi?.subtle) {
    throw new Error("La Web Crypto API no está disponible en este navegador.");
  }

  const hashBuffer = await cryptoApi.subtle.digest("SHA-256", await file.arrayBuffer());

  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
