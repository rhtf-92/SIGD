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
  return (reportName.replace(/[\\/*?:[\]]/g, " ").trim().slice(0, 31) || "Reporte");
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

type ZipEntry = { name: string; content: string };

const CRC32_TABLE = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function littleEndianHeader(length: number, fields: Array<[number, number, number]>): Uint8Array {
  const bytes = new Uint8Array(length);
  const view = new DataView(bytes.buffer);
  for (const [offset, value, width] of fields) {
    if (width === 2) view.setUint16(offset, value, true);
    else view.setUint32(offset, value, true);
  }
  return bytes;
}

function joinBytes(parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function zipStore(entries: ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const content = encoder.encode(entry.content);
    const checksum = crc32(content);
    const localHeader = littleEndianHeader(30 + name.length, [
      [0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, 0, 2],
      [10, 0, 2], [12, 0x21, 2], [14, checksum, 4], [18, content.length, 4],
      [22, content.length, 4], [26, name.length, 2], [28, 0, 2],
    ]);
    localHeader.set(name, 30);
    localParts.push(localHeader, content);

    const centralHeader = littleEndianHeader(46 + name.length, [
      [0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, 0, 2],
      [12, 0, 2], [14, 0x21, 2], [16, checksum, 4], [20, content.length, 4],
      [24, content.length, 4], [28, name.length, 2], [30, 0, 2], [32, 0, 2],
      [34, 0, 2], [36, 0, 2], [38, 0, 4], [42, localOffset, 4],
    ]);
    centralHeader.set(name, 46);
    centralParts.push(centralHeader);
    localOffset += localHeader.length + content.length;
  }

  const centralDirectory = joinBytes(centralParts);
  const endRecord = littleEndianHeader(22, [
    [0, 0x06054b50, 4], [4, 0, 2], [6, 0, 2], [8, entries.length, 2],
    [10, entries.length, 2], [12, centralDirectory.length, 4], [16, localOffset, 4], [20, 0, 2],
  ]);
  return joinBytes([...localParts, centralDirectory, endRecord]);
}

function columnName(index: number): string {
  let value = index + 1;
  let name = "";
  while (value > 0) {
    value -= 1;
    name = String.fromCharCode(65 + (value % 26)) + name;
    value = Math.floor(value / 26);
  }
  return name;
}

function xlsxCell(reference: string, value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return `<c r="${reference}"><v>${value}</v></c>`;
  if (typeof value === "boolean") return `<c r="${reference}" t="b"><v>${value ? 1 : 0}</v></c>`;
  return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function safeSheetName(reportName: string): string {
  return reportName.replace(/[\\/*?:\]]|\[/g, " ").trim().slice(0, 31) || "Reporte";
}

function xlsxSheet(request: ReportExportRequest): string {
  const headers = request.records.length ? Object.keys(request.records[0]) : ["Sin datos"];
  const rows: Array<Array<unknown>> = [
    [`IESTP SUIZA - ${request.reportName.toLocaleUpperCase("es")}`],
    [`Período: ${request.filters.periodo || "General"} | Desde: ${request.filters.fechaInicio || "-"} | Hasta: ${request.filters.fechaFin || "-"}`],
    [`Fecha de emisión: ${request.generatedAt}`],
    headers,
    ...request.records.map((record) => headers.map((header) => record[header])),
  ];
  const rowXml = rows.map((values, rowIndex) =>
    `<row r="${rowIndex + 1}">${values.map((value, columnIndex) => xlsxCell(`${columnName(columnIndex)}${rowIndex + 1}`, value)).join("")}</row>`,
  ).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`+
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowXml}</sheetData></worksheet>`;
}

export function buildGenuineXlsxBlob(request: ReportExportRequest): Blob {
  const sheetName = escapeXml(safeSheetName(request.reportName));
  const entries: ZipEntry[] = [
    { name: "[Content_Types].xml", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>` },
    { name: "_rels/.rels", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: "xl/workbook.xml", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${sheetName}" sheetId="1" r:id="rId1"/></sheets></workbook>` },
    { name: "xl/_rels/workbook.xml.rels", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>` },
    { name: "xl/worksheets/sheet1.xml", content: xlsxSheet(request) },
  ];
  const zip = zipStore(entries);
  const zipBuffer = new ArrayBuffer(zip.byteLength);
  new Uint8Array(zipBuffer).set(zip);
  return new Blob([zipBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
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
  const blob = buildGenuineXlsxBlob(request);
  const fileName = reportFileName(request.reportName, "xlsx");
  const descargaUrl = await downloadReportBlob(blob, fileName);
  return {
    descargaUrl,
    sha256Checksum: await sha256Hex(await blob.arrayBuffer()),
    fileName,
  };
}
