import type { ReportExportRequest, ReportExportResponse } from "@/types/reportExportConfig";
import { buildGenuinePdfBlob } from "../services/pdfReportExporter";
import { computeSha256Hex } from "./cryptoSha256";

export { buildGenuinePdfBlob };

/**
 * Exporta el reporte en formato PDF A4 institucional con codificación WinAnsi,
 * gráfico resumen, tablas paginadas e identidad IESTP "Suiza", devolviendo SHA-256.
 */
export async function exportPdfReport(
  request: ReportExportRequest,
): Promise<ReportExportResponse> {
  const blob = buildGenuinePdfBlob(request);
  const fileName = `${request.reportName || "reporte"}-${new Date().toISOString().slice(0, 10)}.pdf`;

  let url = "";
  if (typeof URL.createObjectURL === "function") {
    url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    if (typeof URL.revokeObjectURL === "function") {
      URL.revokeObjectURL(url);
    }
  }

  const arrayBuffer = await blob.arrayBuffer();
  const checksumHex = await computeSha256Hex(arrayBuffer);

  return {
    descargaUrl: url,
    sha256Checksum: checksumHex,
    fileName,
  };
}
