import type { ReportExportRequest, ReportExportResponse } from "@/types/reportExportConfig";

/**
 * Escapa texto para cadenas literales PDF en ASCII/WinAnsi.
 */
function escapePdfText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, "?");
}

/**
 * Genera un flujo de bytes PDF 1.4 genuino con encabezado institucional,
 * resumen de filtros y filas de datos tabulares.
 */
export function buildGenuinePdfBlob(request: ReportExportRequest): Blob {
  const title = `REPORTE OFICIAL: ${request.reportName.toUpperCase()}`;
  const institucion = "IESTP SUIZA - PUCALLPA, UCAYALI | SISTEMA INTEGRAL DE GESTION DOCUMENTARIA (SIGD)";
  const fecha = `Generado el: ${request.generatedAt} | Periodo: ${request.filters.periodo || "General"}`;

  const textLines: string[] = [
    "BT",
    "/F1 14 Tf",
    "50 800 Td",
    `(${escapePdfText(title)}) Tj`,
    "/F1 9 Tf",
    "0 -20 Td",
    `(${escapePdfText(institucion)}) Tj`,
    "/F1 8 Tf",
    "0 -15 Td",
    `(${escapePdfText(fecha)}) Tj`,
    "/F1 8 Tf",
    "0 -15 Td",
    `(${escapePdfText("----------------------------------------------------------------------------------------------------------------------------------")}) Tj`,
  ];

  let currentY = -25;
  const records = request.records.slice(0, 30); // Primeras 30 filas por página
  for (const record of records) {
    const rowText = Object.entries(record)
      .map(([k, v]) => `${k}: ${v}`)
      .join(" | ");

    textLines.push("/F1 8 Tf");
    textLines.push(`0 ${currentY} Td`);
    textLines.push(`(${escapePdfText(rowText.slice(0, 110))}) Tj`);
    currentY = -14;
  }

  textLines.push("ET");

  const streamContent = textLines.join("\n");
  const streamLength = new TextEncoder().encode(streamContent).length;

  const pdfParts: string[] = [];
  pdfParts.push("%PDF-1.4\n");

  const offsets: number[] = [0];

  function addObject(objStr: string) {
    const currentOffset = pdfParts.join("").length;
    offsets.push(currentOffset);
    pdfParts.push(objStr);
  }

  addObject("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  addObject("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  addObject(
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n",
  );
  addObject(
    `4 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream\nendobj\n`,
  );
  addObject(
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
  );

  const startXref = pdfParts.join("").length;
  let xrefStr = `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) {
    xrefStr += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }

  pdfParts.push(xrefStr);
  pdfParts.push(
    `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`,
  );

  const completePdf = pdfParts.join("");
  return new Blob([new TextEncoder().encode(completePdf)], {
    type: "application/pdf",
  });
}

export async function exportPdfReport(
  request: ReportExportRequest,
): Promise<ReportExportResponse> {
  const blob = buildGenuinePdfBlob(request);
  const fileName = `${request.reportName || "reporte"}-${new Date().toISOString().slice(0, 10)}.pdf`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);

  const arrayBuffer = await blob.arrayBuffer();
  const checksum = await crypto.subtle.digest("SHA-256", arrayBuffer);
  const checksumHex = Array.from(new Uint8Array(checksum))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return {
    descargaUrl: url,
    sha256Checksum: checksumHex,
    fileName,
  };
}
