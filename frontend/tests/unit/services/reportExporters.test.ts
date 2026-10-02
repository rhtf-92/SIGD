import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildGenuinePdfBlob,
  exportPdfReport,
} from "../../../src/services/pdfReportExporter";
import {
  buildGenuineSpreadsheetXml,
  exportExcelReport,
} from "../../../src/services/excelReportExporter";
import type { ReportExportRequest } from "../../../src/types/reportExportConfig";

const request: ReportExportRequest = {
  reportName: "Gestión Documentaria",
  format: "pdf",
  generatedAt: "2026-10-01T12:00:00.000Z",
  filters: { periodo: "octubre", fechaInicio: "2026-10-01", fechaFin: "2026-10-31" },
  records: [
    { oficina: "Dirección", cumplimiento: 95, horas: 12, activo: true, estado: "Completo & aprobado" },
    { oficina: "Archivo", cumplimiento: 75, horas: 36, activo: false, estado: "Crítico" },
  ],
};

const filters = request.filters;

describe("exportadores de reportes institucionales", () => {
  beforeEach(() => {
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:reporte-temporal"),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(window, "setTimeout").mockImplementation(() => 1);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("emite la firma binaria PDF 1.4", async () => {
    const blob = buildGenuinePdfBlob(request);
    expect(blob.type).toBe("application/pdf");
    expect((await blob.text()).startsWith("%PDF-1.4")).toBe(true);
  });

  it("incluye texto PDF seleccionable y referencias de fuente vectorial", async () => {
    const pdf = await buildGenuinePdfBlob(request).text();
    expect(pdf).toContain("/BaseFont /Helvetica");
    expect(pdf).toContain("/BaseFont /Helvetica-Bold");
    expect(pdf).toContain("0.08 0.25 0.39 rg 0 701.89 595.28 140 re f");
    expect(pdf).toContain(" Tj");
    expect(pdf).toContain("IESTP SUIZA");
    expect(pdf).toContain("%%EOF");
  });

  it("conserva tildes españolas con codificación WinAnsi", async () => {
    const pdf = await buildGenuinePdfBlob(request).text();
    expect(pdf).toContain("Gesti\\363n Documentaria");
    expect(pdf).toContain("Direcci\\363n");
  });

  it("integra un gráfico vectorial para una columna numérica", async () => {
    const pdf = await buildGenuinePdfBlob(request).text();
    expect(pdf).toContain("Indicador: cumplimiento");
    expect(pdf).toMatch(/\d+ \d+\.\d+ 38 \d+\.\d+ re f/);
  });

  it("página registros y conserva todos los datos", async () => {
    const manyRecords = Array.from({ length: 25 }, (_, index) => ({ fila: index + 1 }));
    const pdf = await buildGenuinePdfBlob({ ...request, records: manyRecords }).text();
    expect(pdf.match(/\/Type \/Page \/Parent/g)).toHaveLength(3);
    expect(pdf).toContain("Total de registros: 25");
  });

  it("escribe offsets xref que apuntan a los objetos PDF", async () => {
    const pdf = await buildGenuinePdfBlob(request).text();
    const xrefOffset = Number(pdf.match(/startxref\n(\d+)/)?.[1]);
    expect(pdf.slice(xrefOffset, xrefOffset + 4)).toBe("xref");
  });

  it("declara SpreadsheetML XML y UTF-8 sin perder caracteres españoles", () => {
    const xml = buildGenuineSpreadsheetXml(request.records, filters, request.reportName);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain("Gestión Documentaria");
    expect(xml).toContain("Dirección");
    expect(xml).toContain("octubre");
  });

  it("genera XML SpreadsheetML bien formado", () => {
    const xml = buildGenuineSpreadsheetXml(request.records, filters, request.reportName);
    const parsed = new DOMParser().parseFromString(xml, "application/xml");
    expect(parsed.getElementsByTagName("parsererror")).toHaveLength(0);
    expect(parsed.getElementsByTagNameNS("urn:schemas-microsoft-com:office:spreadsheet", "Worksheet")).toHaveLength(1);
  });

  it("escribe valores numéricos y booleanos como celdas tipadas", () => {
    const xml = buildGenuineSpreadsheetXml(request.records, filters, request.reportName);
    expect(xml).toContain('<Data ss:Type="Number">95</Data>');
    expect(xml).toContain('<Data ss:Type="Number">12</Data>');
    expect(xml).toContain('<Data ss:Type="Boolean">1</Data>');
    expect(xml).toContain('<Data ss:Type="Boolean">0</Data>');
  });

  it("asigna estilos de semáforo a métricas y estados", () => {
    const xml = buildGenuineSpreadsheetXml(request.records, filters, request.reportName);
    expect(xml).toContain('ss:StyleID="TrafficGreen"><Data ss:Type="Number">95');
    expect(xml).toContain('ss:StyleID="TrafficYellow"><Data ss:Type="Number">75');
    expect(xml).toContain('ss:StyleID="TrafficGreen"><Data ss:Type="Number">12');
    expect(xml).toContain('ss:StyleID="TrafficYellow"><Data ss:Type="Number">36');
  });

  it("escapa caracteres XML reservados sin romper el documento", () => {
    const xml = buildGenuineSpreadsheetXml(request.records, filters, request.reportName);
    expect(xml).toContain("Completo &amp; aprobado");
    expect(new DOMParser().parseFromString(xml, "application/xml").getElementsByTagName("parsererror")).toHaveLength(0);
  });

  it("descarga PDF y Excel con nombre, checksum y liberación temporal", async () => {
    const pdf = await exportPdfReport(request);
    const excel = await exportExcelReport({ ...request, format: "xlsx" });
    expect(pdf.fileName).toMatch(/Gestión|Gestion/);
    expect(pdf.fileName).toMatch(/\.pdf$/);
    expect(excel.fileName).toMatch(/\.xml$/);
    expect(pdf.sha256Checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(excel.sha256Checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
    expect(window.setTimeout).toHaveBeenCalledWith(expect.any(Function), 1000);
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(2);
  });
});