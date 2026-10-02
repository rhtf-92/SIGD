import type {
  ExportableReportRecord,
  ReportExportRequest,
  ReportExportResponse,
} from "@/types/reportExportConfig";
import { downloadReportBlob, reportFileName, sha256Hex } from "./reportDownload";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;

const WIN_ANSI: Record<string, number> = {
  "€": 0x80,
  "‚": 0x82,
  "ƒ": 0x83,
  "„": 0x84,
  "…": 0x85,
  "†": 0x86,
  "‡": 0x87,
  "ˆ": 0x88,
  "‰": 0x89,
  "Š": 0x8a,
  "‹": 0x8b,
  "Œ": 0x8c,
  "Ž": 0x8e,
  "‘": 0x91,
  "’": 0x92,
  "“": 0x93,
  "”": 0x94,
  "•": 0x95,
  "–": 0x96,
  "—": 0x97,
  "™": 0x99,
  "š": 0x9a,
  "›": 0x9b,
  "œ": 0x9c,
  "ž": 0x9e,
  "Ÿ": 0x9f,
};

function escapePdfText(value: unknown): string {
  const escaped: string[] = [];
  for (const character of String(value ?? "")) {
    const code = WIN_ANSI[character] ?? character.codePointAt(0) ?? 63;
    const byte = code <= 0xff && (code >= 0x20 || code === 0x09) ? code : 63;
    if (byte === 0x28 || byte === 0x29 || byte === 0x5c) {
      escaped.push(`\\${String.fromCharCode(byte)}`);
    } else if (byte > 0x7e || byte < 0x20) {
      escaped.push(`\\${byte.toString(8).padStart(3, "0")}`);
    } else {
      escaped.push(String.fromCharCode(byte));
    }
  }
  return escaped.join("");
}

function textCommand(
  text: unknown,
  x: number,
  y: number,
  size = 9,
  font = "F1",
): string {
  return `BT /${font} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${(PAGE_HEIGHT - y).toFixed(2)} Tm (${escapePdfText(text)}) Tj ET`;
}

function lineCommand(x1: number, y1: number, x2: number, y2: number): string {
  return `${x1.toFixed(2)} ${(PAGE_HEIGHT - y1).toFixed(2)} m ${x2.toFixed(2)} ${(PAGE_HEIGHT - y2).toFixed(2)} l S`;
}

function makeCoverPage(request: ReportExportRequest): string {
  const commands = [
    `0.08 0.25 0.39 rg 0 ${(PAGE_HEIGHT - 140).toFixed(2)} ${PAGE_WIDTH} 140 re f`,
    "1 1 1 rg",
    textCommand("IESTP SUIZA | SISTEMA INTEGRAL DE GESTION DOCUMENTARIA", 42, 48, 10, "F2"),
    textCommand(request.reportName.toUpperCase(), 42, 91, 19, "F2"),
    "0 0 0 rg",
    textCommand("REPORTE INSTITUCIONAL", 42, 178, 11, "F2"),
    textCommand(`Generado: ${request.generatedAt}`, 42, 201, 9),
    textCommand(`Periodo: ${request.filters.periodo || "General"}`, 42, 218, 9),
    textCommand(`Desde: ${request.filters.fechaInicio || "-"}    Hasta: ${request.filters.fechaFin || "-"}`, 42, 235, 9),
    textCommand(`Registros: ${request.records.length}`, 42, 252, 9),
  ];

  const numericKey = Object.keys(request.records[0] ?? {}).find((key) =>
    request.records.some((record) => typeof record[key] === "number" && Number.isFinite(record[key])),
  );
  if (numericKey) {
    const chartRecords = request.records
      .filter((record) => typeof record[numericKey] === "number" && Number.isFinite(record[numericKey]))
      .slice(0, 8);
    const maximum = Math.max(1, ...chartRecords.map((record) => Math.abs(Number(record[numericKey]))));
    commands.push(textCommand(`Indicador: ${numericKey}`, 42, 302, 11, "F2"));
    commands.push("0.12 0.43 0.48 rg");
    chartRecords.forEach((record, index) => {
      const barHeight = (Math.abs(Number(record[numericKey])) / maximum) * 112;
      const x = 56 + index * 62;
      const y = 466 - barHeight;
      commands.push(`${x} ${PAGE_HEIGHT - 466} ${38} ${barHeight.toFixed(2)} re f`);
      commands.push("0 0 0 rg");
      commands.push(textCommand(Object.values(record)[0], x - 7, 484, 7));
      commands.push(textCommand(record[numericKey], x, y - 7, 7));
      commands.push("0.12 0.43 0.48 rg");
    });
    commands.push("0 0 0 RG 0.7 w");
    commands.push(lineCommand(42, 466, 550, 466));
  }
  commands.push("0.08 0.25 0.39 RG 0.8 w");
  commands.push(lineCommand(42, 780, 553, 780));
  commands.push("0 0 0 rg");
  commands.push(textCommand("Documento generado por el Sistema Integral de Gestion Documentaria", 42, 798, 8));
  return commands.join("\n");
}

function makeTablePage(
  request: ReportExportRequest,
  pageNumber: number,
  records: ExportableReportRecord[],
): string {
  const headers = Object.keys(records[0] ?? request.records[0] ?? {});
  const columnCount = Math.max(1, headers.length);
  const columnWidth = 511 / columnCount;
  const commands = [
    textCommand(request.reportName, 42, 48, 14, "F2"),
    textCommand(`Detalle | Pagina ${pageNumber}`, 42, 68, 8),
    "0.08 0.25 0.39 rg 42 700 511 28 re f",
  ];
  headers.forEach((header, index) => {
    commands.push("1 1 1 rg");
    commands.push(textCommand(header.slice(0, 28), 47 + index * columnWidth, 718, 8, "F2"));
  });
  commands.push("0 0 0 rg 0.75 w");
  records.forEach((record, rowIndex) => {
    const y = 132 + rowIndex * 22;
    commands.push(lineCommand(42, y, 553, y));
    headers.forEach((header, columnIndex) => {
      commands.push(textCommand(record[header], 47 + columnIndex * columnWidth, y + 15, 7));
    });
  });
  commands.push(lineCommand(42, 132 + records.length * 22, 553, 132 + records.length * 22));
  commands.push(textCommand(`Total de registros: ${request.records.length}`, 42, 795, 8));
  return commands.join("\n");
}

export function buildGenuinePdfBlob(request: ReportExportRequest): Blob {
  const pageSize = 24;
  const pages = [makeCoverPage(request)];
  if (request.records.length === 0) {
    pages.push(makeTablePage(request, 2, []));
  } else {
    for (let start = 0; start < request.records.length; start += pageSize) {
      pages.push(makeTablePage(request, pages.length + 1, request.records.slice(start, start + pageSize)));
    }
  }
  const objects: string[] = [""];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  const pageObjectIds = pages.map((_, index) => 5 + index * 2);
  objects[2] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  pages.forEach((content, index) => {
    const pageId = 5 + index * 2;
    const streamId = pageId + 1;
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${streamId} 0 R >>`;
    objects[streamId] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  });

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let objectId = 1; objectId < objects.length; objectId += 1) {
    offsets[objectId] = pdf.length;
    pdf += `${objectId} 0 obj\n${objects[objectId]}\nendobj\n`;
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let objectId = 1; objectId < objects.length; objectId += 1) {
    pdf += `${String(offsets[objectId]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return new Blob([pdf], { type: "application/pdf" });
}

export async function exportPdfReport(
  request: ReportExportRequest,
): Promise<ReportExportResponse> {
  const blob = buildGenuinePdfBlob(request);
  const fileName = reportFileName(request.reportName, "pdf");
  const descargaUrl = await downloadReportBlob(blob, fileName);
  return {
    descargaUrl,
    sha256Checksum: await sha256Hex(await blob.arrayBuffer()),
    fileName,
  };
}