export type ReportFormat = "xlsx" | "pdf";

export type ReportExportFilterState = {
  fechaInicio?: string;
  fechaFin?: string;
  periodo?: string;
  diasLimite?: number;
  [key: string]: string | number | undefined;
};

export interface ExportableReportRecord {
  [key: string]: string | number | boolean | null | undefined;
}

export interface ReportExportRequest {
  reportName: string;
  format: ReportFormat;
  filters: ReportExportFilterState;
  records: ExportableReportRecord[];
  generatedAt: string;
}

export interface ReportExportResponse {
  descargaUrl?: string;
  sha256Checksum: string;
  fileName?: string;
}
