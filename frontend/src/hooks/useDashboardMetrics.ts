import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";

import { apiClient } from "@/api/client";
import type {
  DashboardCuelloBotellaItem,
  DashboardEstadoItem,
  DashboardFilterState,
  DashboardMetricsState,
  DashboardSummaryResponse,
  DashboardTrendPoint,
} from "@/types/dashboardEjecutivo";

const FALLBACK_SUMMARY: DashboardSummaryResponse = {
  generatedAt: new Date().toISOString(),
  metrics: [
    {
      id: "tpr",
      title: "Tiempo promedio de respuesta",
      value: 18.4,
      unit: "hrs",
      delta: 12,
      deltaLabel: "+12%",
      status: "positive",
      sparkline: [18, 20, 19, 17, 15, 18, 18.4],
      description: "Cumple la meta institucional en horas hábiles.",
    },
    {
      id: "tro",
      title: "Tasa de resolución oportuna",
      value: 92.8,
      unit: "%",
      delta: 4.2,
      deltaLabel: "+4.2%",
      status: "positive",
      sparkline: [87, 88, 89, 90, 91, 92, 92.8],
      description: "Supera la meta mínima establecida por la dirección.",
    },
    {
      id: "teo",
      title: "Expedientes observados",
      value: 3.6,
      unit: "%",
      delta: -1.3,
      deltaLabel: "-1.3%",
      status: "warning",
      sparkline: [8, 7, 6, 5, 4, 4, 3.6],
      description: "Se mantiene por debajo del umbral crítico.",
    },
    {
      id: "vtep",
      title: "Volumen total procesado",
      value: 1480,
      unit: "exp.",
      delta: 7.5,
      deltaLabel: "+7.5%",
      status: "neutral",
      sparkline: [1200, 1290, 1330, 1380, 1410, 1455, 1480],
      description: "Procesamiento total anual en línea con la meta.",
    },
  ],
};

const FALLBACK_TREND: DashboardTrendPoint[] = [
  { label: "Ene", radicados: 300, resueltos: 260 },
  { label: "Feb", radicados: 420, resueltos: 330 },
  { label: "Mar", radicados: 500, resueltos: 420 },
  { label: "Abr", radicados: 620, resueltos: 550 },
  { label: "May", radicados: 700, resueltos: 615 },
  { label: "Jun", radicados: 760, resueltos: 680 },
  { label: "Jul", radicados: 820, resueltos: 735 },
];

const FALLBACK_ESTADOS: DashboardEstadoItem[] = [
  { label: "Resueltos", value: 54, color: "#10B981" },
  { label: "En trámite", value: 28, color: "#3B82F6" },
  { label: "Observados", value: 12, color: "#F59E0B" },
  { label: "Desestimados", value: 6, color: "#EF4444" },
];

const FALLBACK_CUELLOS: DashboardCuelloBotellaItem[] = [
  { area: "Secretaría Académica", expedienteCount: 41, diasPromedio: 6.2, severity: "high" },
  { area: "Mesa de Partes", expedienteCount: 29, diasPromedio: 4.8, severity: "medium" },
  { area: "Administración", expedienteCount: 20, diasPromedio: 3.6, severity: "low" },
];

function buildQueryParams(filters: DashboardFilterState) {
  const params = new URLSearchParams();

  if (filters.fechaInicio) {
    params.set("fechaInicio", filters.fechaInicio);
  }

  if (filters.fechaFin) {
    params.set("fechaFin", filters.fechaFin);
  }

  if (filters.periodo) {
    params.set("periodo", filters.periodo);
  }

  if (filters.diasLimite) {
    params.set("diasLimite", String(filters.diasLimite));
  }

  return params;
}

async function getDashboardSummary(filters: DashboardFilterState): Promise<DashboardSummaryResponse> {
  const params = buildQueryParams(filters);
  const response = await apiClient.get("/api/v1/reportes/dashboard/resumen", {
    params,
  });

  return response.data as DashboardSummaryResponse;
}

async function getDashboardTrend(filters: DashboardFilterState): Promise<DashboardTrendPoint[]> {
  const params = new URLSearchParams();

  if (filters.periodo) {
    params.set("periodo", filters.periodo);
  } else {
    params.set("periodo", "mensual");
  }

  const response = await apiClient.get("/api/v1/reportes/dashboard/tendencia", {
    params,
  });

  return (response.data as DashboardTrendPoint[]) ?? FALLBACK_TREND;
}

async function getDashboardEstados(): Promise<DashboardEstadoItem[]> {
  const response = await apiClient.get("/api/v1/reportes/dashboard/estados");
  return (response.data as DashboardEstadoItem[]) ?? FALLBACK_ESTADOS;
}

async function getDashboardCuellosBotella(filters: DashboardFilterState): Promise<DashboardCuelloBotellaItem[]> {
  const params = new URLSearchParams();
  params.set("diasLimite", String(filters.diasLimite ?? 5));

  const response = await apiClient.get("/api/v1/reportes/dashboard/cuellos-botella", {
    params,
  });

  return (response.data as DashboardCuelloBotellaItem[]) ?? FALLBACK_CUELLOS;
}

export function useDashboardMetrics(filters: DashboardFilterState = {}): DashboardMetricsState {
  const summaryQuery = useQuery({
    queryKey: ["dashboard", "resumen", filters.fechaInicio ?? "", filters.fechaFin ?? ""],
    queryFn: () => getDashboardSummary(filters),
    staleTime: 60_000,
    retry: 1,
    placeholderData: FALLBACK_SUMMARY,
  });

  const trendQuery = useQuery({
    queryKey: ["dashboard", "tendencia", filters.periodo ?? "mensual"],
    queryFn: () => getDashboardTrend(filters),
    staleTime: 60_000,
    retry: 1,
    placeholderData: FALLBACK_TREND,
  });

  const estadosQuery = useQuery({
    queryKey: ["dashboard", "estados"],
    queryFn: getDashboardEstados,
    staleTime: 60_000,
    retry: 1,
    placeholderData: FALLBACK_ESTADOS,
  });

  const cuelloQuery = useQuery({
    queryKey: ["dashboard", "cuellos-botella", filters.diasLimite ?? 5],
    queryFn: () => getDashboardCuellosBotella(filters),
    staleTime: 60_000,
    retry: 1,
    placeholderData: FALLBACK_CUELLOS,
  });

  const hasError = summaryQuery.isError || trendQuery.isError || estadosQuery.isError || cuelloQuery.isError;
  const errorMessage =
    summaryQuery.error || trendQuery.error || estadosQuery.error || cuelloQuery.error
      ? [summaryQuery.error, trendQuery.error, estadosQuery.error, cuelloQuery.error]
          .filter(Boolean)
          .map((error) => {
            if (isAxiosError(error)) {
              return error.response?.data?.message ?? error.message;
            }

            return error instanceof Error ? error.message : "Error desconocido";
          })
          .join(" | ")
      : null;

  return {
    summary: summaryQuery.data ?? FALLBACK_SUMMARY,
    trend: trendQuery.data ?? FALLBACK_TREND,
    estados: estadosQuery.data ?? FALLBACK_ESTADOS,
    cuellosBotella: cuelloQuery.data ?? FALLBACK_CUELLOS,
    isLoading: summaryQuery.isLoading || trendQuery.isLoading || estadosQuery.isLoading || cuelloQuery.isLoading,
    isError: hasError,
    errorMessage,
    refetch: async () => {
      await Promise.all([
        summaryQuery.refetch(),
        trendQuery.refetch(),
        estadosQuery.refetch(),
        cuelloQuery.refetch(),
      ]);
    },
  } satisfies DashboardMetricsState;
}
