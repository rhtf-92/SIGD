export type ReportExportType = "pdf" | "excel";

export type ReportExportFilterValue = string | number | boolean | null | undefined;

export interface ReportExportFilter {
  key: string;
  value: ReportExportFilterValue;
}

export interface ReportExportConfig {
  title: string;
  institutionName?: string;
  generatedAt?: string | Date;
  filters?: Record<string, ReportExportFilterValue> | ReportExportFilter[];
  fileName?: string;
  reportType?: ReportExportType;
  includeChecksum?: boolean;
  checksum?: string;
}

export interface ReportExportResult {
  downloadUrl: string;
  sha256Checksum: string;
  fileName: string;
  ready: boolean;
}
