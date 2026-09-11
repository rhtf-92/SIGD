export type DashboardKpiStatus = "positive" | "warning" | "critical" | "neutral";

export interface DashboardKpiMetric {
  id: string;
  title: string;
  value: number;
  unit: string;
  delta: number;
  deltaLabel: string;
  status: DashboardKpiStatus;
  sparkline: number[];
  description: string;
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
  severity: "high" | "medium" | "low";
}

export interface DashboardSummaryMetricsResponse {
  metrics: DashboardKpiMetric[];
}

export interface DashboardEjecutivoData {
  summary: DashboardSummaryMetricsResponse;
  trend: DashboardTrendPoint[];
  estados: DashboardEstadoItem[];
  cuellosBotella: DashboardCuelloBotellaItem[];
}
