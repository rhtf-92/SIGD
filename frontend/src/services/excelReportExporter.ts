import type {
  ExportableReportRecord,
  ReportExportRequest,
  ReportExportResponse,
} from "@/types/reportExportConfig";
import { downloadReportBlob, reportFileName, sha256Hex } from "./reportDownload";

function escapeXml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function worksheetName(reportName: string): string {
  return (reportName.replace(/[\\/*?:\[\]]/g, " ").trim().slice(0, 31) || "Reporte");
}

function styleForCell(header: string, value: unknown): string | undefined {
  const normalizedHeader = header.toLocaleLowerCase("es");
  const normalizedValue = String(value ?? "").toLocaleLowerCase("es");
  if (/estado|status|semaforo/.test(normalizedHeader)) {
    if (/critico|crítico|retrasado|vencido|rojo|bajo/.test(normalizedValue)) return "TrafficRed";
    if (/alerta|riesgo|amarillo|medio|proceso/.test(normalizedValue)) return "TrafficYellow";
    if (/normal|completo|verde|aprobado|resuelto/.test(normalizedValue)) return "TrafficGreen";
  }
  if (
    typeof value === "number" &&
    /porcentaje|percent|cumplimiento|avance|eficiencia|tasa|ratio|hora|duracion|duración/.test(normalizedHeader)
  ) {
    if (/hora|duracion|duración/.test(normalizedHeader)) {
      return value <= 24 ? "TrafficGreen" : value <= 48 ? "TrafficYellow" : "TrafficRed";
    }
    return value >= 90 ? "TrafficGreen" : value >= 70 ? "TrafficYellow" : "TrafficRed";
  }
  return undefined;
}

function xmlCell(header: string, value: unknown): string {
  const style = styleForCell(header, value);
  const styleAttribute = style ? ` ss:StyleID="${style}"` : "";
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<Cell${styleAttribute}><Data ss:Type="Number">${value}</Data></Cell>`;
  }
  if (typeof value === "boolean") {
    return `<Cell${styleAttribute}><Data ss:Type="Boolean">${value ? 1 : 0}</Data></Cell>`;
  }
  return `<Cell${styleAttribute}><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`;
}

export function buildGenuineSpreadsheetXml(
  records: ExportableReportRecord[],
  filters: ReportExportRequest["filters"],
  reportName: string,
): string {
  const headers = records.length > 0 ? Object.keys(records[0]) : ["Sin datos"];
  const rows = records.map((record) =>
    `<Row>${headers.map((header) => xmlCell(header, record[header])).join("")}</Row>`,
  );
  const headerRow = `<Row>${headers.map((header) => `<Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">${escapeXml(header)}</Data></Cell>`).join("")}</Row>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Bottom"/><Font ss:FontName="Calibri" ss:Size="11" ss:Color="#000000"/></Style>
  <Style ss:ID="HeaderStyle"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#145B65" ss:Pattern="Solid"/></Style>
  <Style ss:ID="TitleStyle"><Font ss:FontName="Calibri" ss:Size="14" ss:Bold="1" ss:Color="#123047"/></Style>
  <Style ss:ID="MetaStyle"><Font ss:FontName="Calibri" ss:Size="10" ss:Italic="1" ss:Color="#52636D"/></Style>
  <Style ss:ID="TrafficGreen"><Interior ss:Color="#D8F0E3" ss:Pattern="Solid"/><Font ss:Color="#14532D"/></Style>
  <Style ss:ID="TrafficYellow"><Interior ss:Color="#FFF2C2" ss:Pattern="Solid"/><Font ss:Color="#713F12"/></Style>
  <Style ss:ID="TrafficRed"><Interior ss:Color="#FCE0DD" ss:Pattern="Solid"/><Font ss:Color="#7F1D1D"/></Style>
 </Styles>
 <Worksheet ss:Name="${escapeXml(worksheetName(reportName))}">
  <Table>
   <Row><Cell ss:StyleID="TitleStyle"><Data ss:Type="String">IESTP SUIZA - ${escapeXml(reportName.toUpperCase())}</Data></Cell></Row>
   <Row><Cell ss:StyleID="MetaStyle"><Data ss:Type="String">Periodo: ${escapeXml(filters.periodo || "General")} | Fecha inicio: ${escapeXml(filters.fechaInicio || "-")} | Fecha fin: ${escapeXml(filters.fechaFin || "-")}</Data></Cell></Row>
   ${headerRow}
   ${rows.join("\n   ")}
  </Table>
 </Worksheet>
</Workbook>`;
}

export async function exportExcelReport(
  request: ReportExportRequest,
): Promise<ReportExportResponse> {
  const xml = buildGenuineSpreadsheetXml(request.records, request.filters, request.reportName);
  const blob = new Blob([new TextEncoder().encode(xml)], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  const fileName = reportFileName(request.reportName, "xml");
  const descargaUrl = await downloadReportBlob(blob, fileName);
  return {
    descargaUrl,
    sha256Checksum: await sha256Hex(await blob.arrayBuffer()),
    fileName,
  };
}