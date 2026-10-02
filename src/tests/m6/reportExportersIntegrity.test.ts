import { describe, it, expect, vi } from "vitest";
import { buildGenuinePdfBlob, exportPdfReport } from "../../utils/pdfReportExporter";
import { buildGenuineSpreadsheetXml, exportExcelReport } from "../../utils/excelReportExporter";
import { validatePdfMagicBytes } from "../../utils/magicBytesValidator";
import type { ReportExportRequest } from "../../types/reportExportConfig";

const mockExportRequest: ReportExportRequest = {
  reportName: "Kpis_MGD_PCM_IESTP_Suiza",
  format: "pdf",
  generatedAt: "2026-09-23T14:30:00.000Z",
  filters: {
    fechaInicio: "2026-01-01",
    fechaFin: "2026-12-31",
    periodo: "mensual",
    diasLimite: 5,
  },
  records: [
    { periodo: "Enero", radicados: 45, resueltos: 40, pendientes: 5, tao: "88.89%" },
    { periodo: "Febrero", radicados: 50, resueltos: 48, pendientes: 2, tao: "96.00%" },
  ],
};

describe("Suite de Integridad de Exportadores de Reportes PDF y Excel (BR-07 / ENT-M06-05)", () => {
  it("buildGenuinePdfBlob: genera un archivo PDF 1.4 auténtico con Magic Bytes %PDF", async () => {
    const blob = buildGenuinePdfBlob(mockExportRequest);
    expect(blob.type).toBe("application/pdf");

    const file = new File([blob], "reporte.pdf", { type: "application/pdf" });
    const isMagicBytesValid = await validatePdfMagicBytes(file);

    expect(isMagicBytesValid).toBe(true);

    const textContent = await blob.text();
    expect(textContent.startsWith("%PDF-1.4")).toBe(true);
    expect(textContent).toContain("%%EOF");
    expect(textContent).toContain("IESTP SUIZA");
  });

  it("buildGenuineSpreadsheetXml: genera una estructura SpreadsheetML válida para Microsoft Excel", () => {
    const xml = buildGenuineSpreadsheetXml(
      mockExportRequest.records,
      mockExportRequest.filters,
      mockExportRequest.reportName,
    );

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<?mso-application progid="Excel.Sheet"?>');
    expect(xml).toContain('<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"');
    expect(xml).toContain('<Worksheet ss:Name=');
    expect(xml).toContain("IESTP SUIZA");
    expect(xml).toContain("Enero");
  });

  it("exportPdfReport y exportExcelReport: retornan checksum SHA-256 legítimo de 64 caracteres hex", async () => {
    // Mock de click en DOM para entornos de test
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    const pdfRes = await exportPdfReport(mockExportRequest);
    expect(pdfRes.sha256Checksum).toMatch(/^[a-f0-9]{64}$/i);
    expect(pdfRes.fileName).toContain(".pdf");

    const excelRes = await exportExcelReport({ ...mockExportRequest, format: "xlsx" });
    expect(excelRes.sha256Checksum).toMatch(/^[a-f0-9]{64}$/i);
    expect(excelRes.fileName).toContain(".xls");

    clickSpy.mockRestore();
  });
});
