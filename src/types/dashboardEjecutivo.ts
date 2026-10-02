export type DashboardKpiStatus = "positive" | "warning" | "critical" | "neutral";

export type DashboardAlertLevel =
  | "normal"
  | "bajo"
  | "advertencia"
  | "warning"
  | "critico"
  | "critical"
  | "alto"
  | "ok"
  | "alerta"
  | string;

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

export interface TendenciaTemporalDTO {
  fecha: string;
  fechaLabel?: string;
  radicados: number;
  resueltos: number;
  atendidos?: number;
  valor?: number;
  porcentaje?: number;
  tendencia?: number;
}

export interface DistribucionEstadosDTO {
  estado: string;
  total: number;
  porcentaje: number;
  cantidad?: number;
  valor?: number;
}

export interface DashboardKpiResumenDTO {
  totalProcesados: number;
  totalExpedientes?: number;
  totalRadicados?: number;
  totalResueltos?: number;
  volumenProcesado?: number;
  tasaResolucionOportuna: number;
  tasaCompletitud?: number;
  tasaExpedientesObservados: number;
  tiempoPromedioRespuestaHoras: number;
  tprHoras?: number;
  atrasadosCriticos?: number;
  deltaMensual: number;
  deltaPorcentaje?: number;
  fechaInicio?: string;
  fechaFin?: string;
  periodo?: {
    fechaInicio: string;
    fechaFin: string;
  };
  tendencia?: TendenciaTemporalDTO[];
  estados?: DistribucionEstadosDTO[];
}

export interface AreaCuelloBotellaDTO {
  areaId: number;
  nombreArea: string;
  area?: string;
  estancados: number;
  expedientesEstancados?: number;
  tprPromedio: number;
  tiempoPromedioRespuesta?: number;
  nivelAlerta: DashboardAlertLevel;
  nivel?: DashboardAlertLevel;
  diasRetencion?: number;
  dias?: number;
  riesgo?: number;
}

