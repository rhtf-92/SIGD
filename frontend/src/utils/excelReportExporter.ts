import type {
  ExportableReportRecord,
  ReportExportRequest,
  ReportExportResponse,
} from "@/types/reportExportConfig";

function escapeXml(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Genera un archivo de hoja de cálculo nativo compatible con Microsoft Excel y LibreOffice
 * utilizando el estándar SpreadsheetML (XML Spreadsheet 2003).
 */
export function buildGenuineSpreadsheetXml(
  records: ExportableReportRecord[],
  filters: ReportExportRequest["filters"],
  reportName: string,
): string {
  const headers = records.length > 0 ? Object.keys(records[0]) : ["Sin datos"];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Bottom"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#000000"/>
  </Style>
  <Style ss:ID="HeaderStyle">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#1D4ED8" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="TitleStyle">
   <Font ss:FontName="Calibri" ss:Size="14" ss:Bold="1" ss:Color="#0F172A"/>
  </Style>
  <Style ss:ID="MetaStyle">
   <Font ss:FontName="Calibri" ss:Size="10" ss:Italic="1" ss:Color="#64748B"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="${escapeXml(reportName.slice(0, 31) || "Reporte")}">
  <Table>
   <Row>
    <Cell ss:StyleID="TitleStyle"><Data ss:Type="String">IESTP SUIZA - ${escapeXml(reportName.toUpperCase())}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="MetaStyle"><Data ss:Type="String">Periodo: ${escapeXml(filters.periodo || "General")} | Fecha Inicio: ${escapeXml(filters.fechaInicio || "-")} | Fecha Fin: ${escapeXml(filters.fechaFin || "-")}</Data></Cell>
   </Row>
   <Row></Row>
   <Row>`;

  // Encabezados de tabla
  for (const h of headers) {
    xml += `<Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`;
  }
  xml += `</Row>`;

  // Filas de datos
  for (const record of records) {
    xml += `<Row>`;
    for (const h of headers) {
      const val = record[h];
      const isNumber = typeof val === "number";
      const type = isNumber ? "Number" : "String";
      xml += `<Cell><Data ss:Type="${type}">${escapeXml(val)}</Data></Cell>`;
    }
    xml += `</Row>`;
  }

  xml += `
  </Table>
 </Worksheet>
</Workbook>`;

  return xml;
}

export async function exportExcelReport(
  request: ReportExportRequest,
): Promise<ReportExportResponse> {
  const xmlContent = buildGenuineSpreadsheetXml(
    request.records,
    request.filters,
    request.reportName,
  );

  const blob = new Blob([new TextEncoder().encode(xmlContent)], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  const fileName = `${request.reportName || "reporte"}-${new Date().toISOString().slice(0, 10)}.xls`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);

  const checksum = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(xmlContent),
  );
  const checksumHex = Array.from(new Uint8Array(checksum))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return {
    descargaUrl: url,
    sha256Checksum: checksumHex,
    fileName,
  };
}
