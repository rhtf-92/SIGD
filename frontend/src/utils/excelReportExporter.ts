import type { ExportableReportRecord, ReportExportRequest, ReportExportResponse } from "@/types/reportExportConfig";

function escapeCellValue(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).replace(/\r?\n/g, " ").trim();
}

function buildWorkbookRows(records: ExportableReportRecord[], filters: ReportExportRequest["filters"]): string[][] {
  const headers = [
    "Reporte",
    "Fecha de emisión",
    "Fecha inicio",
    "Fecha fin",
    "Periodo",
    "Días límite",
    ...Object.keys(records[0] ?? {}),
  ];

  const rows: string[][] = [headers];
  const now = new Date().toISOString();

  rows.push([
    "Dashboard ejecutivo",
    now,
    filters.fechaInicio ?? "-",
    filters.fechaFin ?? "-",
    filters.periodo ?? "mensual",
    String(filters.diasLimite ?? 5),
    ...new Array(Math.max(Object.keys(records[0] ?? {}).length, 0)).fill(""),
  ]);

  rows.push([
    "Filtros aplicados",
    "",
    "",
    "",
    "",
    "",
    ...new Array(Math.max(Object.keys(records[0] ?? {}).length, 0)).fill(""),
  ]);

  for (const record of records) {
    const values = Object.values(record).map((value) => escapeCellValue(value));
    rows.push([
      "",
      "",
      "",
      "",
      "",
      "",
      ...values,
    ]);
  }

  return rows;
}

export async function exportExcelReport(request: ReportExportRequest): Promise<ReportExportResponse> {
  const headers = [
    "Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet; charset=utf-8",
  ];

  const csvRows = buildWorkbookRows(request.records, request.filters);
  const csvContent = csvRows
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([new TextEncoder().encode(csvContent)], { type: headers[0] });
  const fileName = `${request.reportName || "reporte"}-${new Date().toISOString().slice(0, 10)}.xlsx`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);

  const checksum = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(csvContent));
  const checksumHex = Array.from(new Uint8Array(checksum))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return {
    descargaUrl: url,
    sha256Checksum: checksumHex,
  };
}
