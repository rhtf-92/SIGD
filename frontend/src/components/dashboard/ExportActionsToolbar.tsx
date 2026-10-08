import { useState } from "react";
import { FileSpreadsheet, FileText, LoaderCircle } from "lucide-react";
import Button from "@/components/ui/Button";
import { exportExcelReport } from "@/services/excelReportExporter";
import { exportPdfReport } from "@/services/pdfReportExporter";
import type {
  ExportableReportRecord,
  ReportExportFilterState,
} from "@/types/reportExportConfig";

interface ExportActionsToolbarProps {
  reportName: string;
  filters: ReportExportFilterState;
  records: ExportableReportRecord[];
}

export default function ExportActionsToolbar({
  reportName,
  filters,
  records,
}: ExportActionsToolbarProps) {
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [status, setStatus] = useState("");

  async function handleExport(format: "pdf" | "excel") {
    const setExporting = format === "pdf" ? setIsExportingPdf : setIsExportingExcel;
    setExporting(true);
    setStatus(`Generando ${format === "pdf" ? "PDF" : "Excel"}...`);
    try {
      const request = {
        reportName,
        format: format === "pdf" ? "pdf" as const : "xlsx" as const,
        filters,
        records,
        generatedAt: new Date().toISOString(),
      };
      const result = format === "pdf"
        ? await exportPdfReport(request)
        : await exportExcelReport(request);
      setStatus(`Descarga iniciada: ${result.fileName}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No se pudo exportar el reporte.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Exportación de reportes">
      <Button
        variant="primary"
        onClick={() => void handleExport("pdf")}
        disabled={isExportingPdf}
        className="min-h-10"
        aria-label={isExportingPdf ? "Generando PDF" : "Descargar reporte PDF"}
      >
        {isExportingPdf ? <LoaderCircle className="size-4 animate-spin" /> : <FileText className="size-4" />}
        {isExportingPdf ? "Generando PDF" : "PDF 1.4"}
      </Button>
      <Button
        variant="secondary"
        onClick={() => void handleExport("excel")}
        disabled={isExportingExcel}
        className="min-h-10"
        aria-label={isExportingExcel ? "Generando Excel" : "Descargar reporte Excel SpreadsheetML"}
      >
        {isExportingExcel ? <LoaderCircle className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}
        {isExportingExcel ? "Generando Excel" : "Excel XML"}
      </Button>
      <span className="sr-only" role="status" aria-live="polite">{status}</span>
    </div>
  );
}