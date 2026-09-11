import { useState } from "react";

import { exportExcelReport } from "@/utils/excelReportExporter";
import { exportPdfReport } from "@/utils/pdfReportExporter";
import type { ExportableReportRecord, ReportExportFilterState, ReportFormat } from "@/types/reportExportConfig";

interface ReportExportModalProps {
  reportName: string;
  filters: ReportExportFilterState;
  records: ExportableReportRecord[];
}

export default function ReportExportModal({ reportName, filters, records }: ReportExportModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleExport = async (format: ReportFormat) => {
    setStatus("loading");
    setMessage("Generando archivo...");

    try {
      const response =
        format === "xlsx"
          ? await exportExcelReport({
              reportName,
              format,
              filters,
              records,
              generatedAt: new Date().toISOString(),
            })
          : await exportPdfReport({
              reportName,
              format,
              filters,
              records,
              generatedAt: new Date().toISOString(),
            });

      setStatus("success");
      setMessage(`Archivo exportado correctamente. SHA-256: ${response.sha256Checksum.slice(0, 12)}...`);
    } catch (error) {
      const err = error instanceof Error ? error.message : "No se pudo exportar el reporte.";
      setStatus("error");
      setMessage(err);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        aria-label="Abrir opciones de exportación del dashboard"
      >
        Exportar
      </button>

      {isOpen && (
        <div className="absolute right-0 z-10 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <p className="mb-2 text-sm font-semibold text-slate-800">Formato</p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                void handleExport("xlsx");
                setIsOpen(false);
              }}
              className="rounded-lg border border-slate-200 px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Excel (.xlsx)
            </button>
            <button
              type="button"
              onClick={() => {
                void handleExport("pdf");
                setIsOpen(false);
              }}
              className="rounded-lg border border-slate-200 px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              PDF (A4)
            </button>
          </div>
          {status !== "idle" && (
            <p className={`mt-3 text-xs ${status === "error" ? "text-red-700" : "text-slate-600"}`} role="status" aria-live="polite">
              {message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
