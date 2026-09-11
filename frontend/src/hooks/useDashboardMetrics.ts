import { useMemo } from "react";

import type {
  DashboardCuelloBotellaItem,
  DashboardEjecutivoData,
  DashboardEstadoItem,
  DashboardKpiMetric,
  DashboardTrendPoint,
} from "@/types/dashboardEjecutivo";

export interface DashboardMetricsQuery {
  fechaInicio: string;
  fechaFin: string;
  periodo?: string;
  diasLimite?: number;
}

export function useDashboardMetrics(_params: DashboardMetricsQuery): DashboardEjecutivoData & {
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
} {
  const summary = useMemo(
    () => ({
      metrics: [
        {
          id: "kpi-01",
          title: "Tasa de resolución",
          value: 82.4,
          unit: "%",
          delta: 6.2,
          deltaLabel: "+6.2%",
          status: "positive",
          sparkline: [68, 71, 74, 79, 81, 82, 84],
          description: "Expedientes resueltos dentro del plazo en el periodo vigente.",
        },
        {
          id: "kpi-02",
          title: "Tiempo promedio de gestión",
          value: 14.6,
          unit: "días",
          delta: -2.1,
          deltaLabel: "-2.1%",
          status: "warning",
          sparkline: [20, 18, 19, 17, 16, 15, 14],
          description: "Promedio de resolución por expediente según el flujo de gestión.",
        },
        {
          id: "kpi-03",
          title: "Expedientes críticos",
          value: 18,
          unit: "casos",
          delta: 3,
          deltaLabel: "+3",
          status: "critical",
          sparkline: [24, 22, 21, 19, 18, 16, 18],
          description: "Casos con vencimiento próximo o riesgo documental.",
        },
        {
          id: "kpi-04",
          title: "Cumplimiento documental",
          value: 91.5,
          unit: "%",
          delta: 1.8,
          deltaLabel: "+1.8%",
          status: "neutral",
          sparkline: [88, 89, 90, 90, 91, 91, 92],
          description: "Atención y cierre documental según el estándar institucional.",
        },
      ] satisfies DashboardKpiMetric[],
    }),
    [],
  );

  const trend: DashboardTrendPoint[] = [
    { label: "Ene", radicados: 420, resueltos: 340 },
    { label: "Feb", radicados: 460, resueltos: 360 },
    { label: "Mar", radicados: 480, resueltos: 390 },
    { label: "Abr", radicados: 510, resueltos: 420 },
    { label: "May", radicados: 540, resueltos: 470 },
    { label: "Jun", radicados: 560, resueltos: 490 },
  ];

  const estados: DashboardEstadoItem[] = [
    { label: "En trámite", value: 40, color: "#3B82F6" },
    { label: "Resueltos", value: 35, color: "#10B981" },
    { label: "Observados", value: 15, color: "#F59E0B" },
    { label: "Archivados", value: 10, color: "#94A3B8" },
  ];

  const cuellosBotella: DashboardCuelloBotellaItem[] = [
    { area: "Jurídica", expedienteCount: 42, diasPromedio: 9.4, severity: "high" },
    { area: "Documentación", expedienteCount: 31, diasPromedio: 7.6, severity: "medium" },
    { area: "Registro", expedienteCount: 18, diasPromedio: 5.2, severity: "low" },
  ];

  return {
    summary,
    trend,
    estados,
    cuellosBotella,
    isLoading: false,
    isError: false,
    errorMessage: undefined,
  };
}
