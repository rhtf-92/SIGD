import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ReportExportModal from "@/components/reportes/ReportExportModal";
import { exportExcelReport } from "@/services/excelReportExporter";

vi.mock("@/services/excelReportExporter", () => ({
  exportExcelReport: vi.fn().mockResolvedValue({ fileName: "dashboard.xlsx", sha256Checksum: "a".repeat(64) }),
}));
vi.mock("@/services/pdfReportExporter", () => ({
  exportPdfReport: vi.fn().mockResolvedValue({ fileName: "dashboard.pdf", sha256Checksum: "b".repeat(64) }),
}));

afterEach(() => vi.clearAllMocks());

describe("ReportExportModal", () => {
  it("exports the selected dashboard records as an XLSX workbook", async () => {
    const filters = { periodo: "anual", fechaInicio: "2026-01-01", fechaFin: "2026-12-31" };
    const records = [{ indicador: "VTEP", valor: 95, unidad: "%" }];
    render(<ReportExportModal reportName="dashboard-ejecutivo" filters={filters} records={records} />);

    fireEvent.click(screen.getByRole("button", { name: /abrir opciones de exportación/i }));
    fireEvent.click(screen.getByRole("button", { name: /excel.*\.xlsx/i }));

    await waitFor(() => expect(exportExcelReport).toHaveBeenCalledWith(expect.objectContaining({
      reportName: "dashboard-ejecutivo",
      format: "xlsx",
      filters,
      records,
    })));
    expect(await screen.findByRole("status")).toHaveTextContent(/sha-256/i);
  });
});
