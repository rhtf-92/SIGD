import type { ReportExportRequest, ReportExportResponse } from "@/types/reportExportConfig";

export async function exportPdfReport(request: ReportExportRequest): Promise<ReportExportResponse> {
  const payload = JSON.stringify(
    {
      reportName: request.reportName,
      generatedAt: request.generatedAt,
      filters: request.filters,
      records: request.records,
    },
    null,
    2,
  );

  const blob = new Blob([payload], { type: "application/pdf" });
  const fileName = `${request.reportName || "reporte"}-${new Date().toISOString().slice(0, 10)}.pdf`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);

  const checksum = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
  const checksumHex = Array.from(new Uint8Array(checksum))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return {
    descargaUrl: url,
    sha256Checksum: checksumHex,
    fileName,
  };
}
