export type DashboardMetricStatus = "positive" | "warning" | "critical" | "neutral";

export interface DashboardKpiMetric {
  id: string;
  title: string;
  value: number;
  unit: string;
  delta: number;
  deltaLabel: string;
  status: DashboardMetricStatus;
  sparkline: number[];
  description: string;
}

export interface DashboardSummaryResponse {
  metrics: DashboardKpiMetric[];
  generatedAt: string;
}

export interface DashboardTrendPoint {
  label: string;
  radicados: number;
  resueltos: number;
}

export interface DashboardEstadoItem {
  label: string;
  value: number;
  color: string;
}

export interface DashboardCuelloBotellaItem {
  area: string;
  expedienteCount: number;
  diasPromedio: number;
  severity: "low" | "medium" | "high";
}

export interface DashboardFilterState {
  fechaInicio?: string;
  fechaFin?: string;
  periodo?: "mensual" | "semanal";
  diasLimite?: number;
}

export interface DashboardMetricsState {
  summary: DashboardSummaryResponse | null;
  trend: DashboardTrendPoint[];
  estados: DashboardEstadoItem[];
  cuellosBotella: DashboardCuelloBotellaItem[];
  isLoading: boolean;
  isError: boolean;
  errorMessage: string | null;
  refetch: () => Promise<unknown>;
}
