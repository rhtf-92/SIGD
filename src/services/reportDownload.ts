export async function downloadReportBlob(
  blob: Blob,
  fileName: string,
): Promise<string> {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return url;
}

export async function sha256Hex(data: ArrayBuffer | Uint8Array): Promise<string> {
  const source = data instanceof Uint8Array ? data : new Uint8Array(data);
  const bytes = new Uint8Array(source.byteLength);
  bytes.set(source);
  const digest = await crypto.subtle.digest("SHA-256", bytes.buffer);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function reportFileName(reportName: string, extension: string): string {
  const safeName = reportName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `${safeName || "Reporte_MGD"}_${new Date().toISOString().slice(0, 10)}.${extension}`;
}