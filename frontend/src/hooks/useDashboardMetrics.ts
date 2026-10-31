import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/api/client";
import { ApiHttpError } from "@/types/api";
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
  periodoDesde?: string;
  periodoHasta?: string;
  diasLimite?: number;
  anio?: number;
  mes?: string;
  unidadOrganicaId?: string;
}

export interface DashboardUnitOption {
  id: string;
  name: string;
}

export interface ExecutiveSummaryMetrics {
  conformity: number;
  growth: number | null;
  desksHealth: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function asNumber(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
}

function unwrapPayload(value: unknown): unknown {
  const record = asRecord(value);
  return record.data ?? value;
}

interface DashboardResponses {
  resumen: unknown;
  tendencias: unknown;
  cuellosBotella: unknown;
}

function normalizeDashboard(value: DashboardResponses, params: DashboardMetricsQuery): DashboardEjecutivoData & {
  executive: ExecutiveSummaryMetrics;
  units: DashboardUnitOption[];
} {
  const resumen = asRecord(unwrapPayload(value.resumen));
  const indicadores = asRecord(resumen);
  const contadores = asRecord(resumen.contadores);
  const vtep = asRecord(indicadores.vtep);
  const tpr = asRecord(indicadores.tprHorasHabiles);
  const tro = asRecord(indicadores.tro);
  const teo = asRecord(indicadores.teo);
  const total = asNumber(contadores.nRadicados);
  const atendidos = asNumber(contadores.nAtendidos);
  const archivados = asNumber(contadores.nArchivados);
  const enTramite = asNumber(contadores.nEnTramite);
  const observados = asNumber(contadores.nObservados);
  const procesados = atendidos + archivados;
  const otros = Math.max(total - procesados - enTramite - observados, 0);

  const trendData = unwrapPayload(value.tendencias);
  const trend: DashboardTrendPoint[] = Array.isArray(trendData)
    ? trendData.flatMap((entry) => {
      const point = asRecord(entry);
      const month = asNumber(point.mes);
      if (month < 1 || month > 12) return [];
      return [{
        label: new Intl.DateTimeFormat("es-PE", { month: "short", timeZone: "UTC" })
          .format(new Date(Date.UTC(params.anio ?? new Date().getFullYear(), month - 1, 1))),
        radicados: asNumber(point.radicados),
        resueltos: asNumber(point.atendidos),
      }];
    })
    : [];
  const filteredTrend = params.periodo
    ? trend.filter((_, index) => String(index + 1).padStart(2, "0") === params.mes)
    : params.periodoDesde && params.periodoHasta
      ? trend.filter((_, index) => {
        const month = `${params.anio ?? new Date().getFullYear()}-${String(index + 1).padStart(2, "0")}`;
        return month >= params.periodoDesde! && month <= params.periodoHasta!;
      })
      : trend;
  const sparkline = trend
    .filter((point) => point.radicados > 0)
    .map((point) => (point.resueltos / point.radicados) * 100);

  const metricDefinitions = [
    {
      id: "vtep",
      title: "Expedientes procesados",
      indicator: vtep,
      unit: "%",
      target: "Meta ≥ 95%",
      description: "Porcentaje de expedientes atendidos o archivados respecto a los radicados.",
      sparkline,
    },
    {
      id: "tpr",
      title: "Tiempo de respuesta",
      indicator: tpr,
      unit: "h",
      target: "Meta ≤ 24 h",
      description: "Tiempo promedio de respuesta en horas hábiles.",
      sparkline: [],
    },
    {
      id: "tro",
      title: "Resolución oportuna",
      indicator: tro,
      unit: "%",
      target: "Meta ≥ 90%",
      description: "Porcentaje de expedientes resueltos dentro del plazo establecido.",
      sparkline: [],
    },
    {
      id: "teo",
      title: "Expedientes observados",
      indicator: teo,
      unit: "%",
      target: "Meta ≤ 5%",
      description: "Porcentaje de expedientes observados respecto a los que están en trámite.",
      sparkline: [],
    },
  ];

  const metrics: DashboardKpiMetric[] = metricDefinitions.map((definition) => {
    const indicator = definition.indicator;
    return {
      id: definition.id,
      title: definition.title,
      value: asNumber(indicator.valor),
      unit: definition.unit,
      delta: 0,
      deltaLabel: definition.target,
      status: indicator.cumple === true ? "positive" : indicator.cumple === false ? "warning" : "neutral",
      sparkline: definition.sparkline,
      description: definition.description,
    };
  });

  const estados: DashboardEstadoItem[] = total > 0
    ? [
      { label: "Procesados", value: (procesados / total) * 100, color: "#059669" },
      { label: "En trámite", value: (enTramite / total) * 100, color: "#2563eb" },
      { label: "Observados", value: (observados / total) * 100, color: "#d97706" },
      ...(otros > 0 ? [{ label: "Otros", value: (otros / total) * 100, color: "#64748b" }] : []),
    ].filter((state) => state.value > 0)
    : [];

  const bottlenecksData = unwrapPayload(value.cuellosBotella);
  const bottlenecks = Array.isArray(bottlenecksData) ? bottlenecksData : [];
  const cuellosBotella: DashboardCuelloBotellaItem[] = bottlenecks.map((entry) => {
    const item = asRecord(entry);
    const risk = String(item.riesgo ?? "").toLowerCase();
    return {
      area: String(item.areaNombre ?? item.areaId ?? "Área"),
      expedienteCount: asNumber(item.expedientesEstancados),
      diasPromedio: asNumber(item.diasRetencion),
      severity: risk === "alto" ? "high" : risk === "medio" ? "medium" : "low",
    };
  });

  const units = bottlenecks.flatMap((entry) => {
    const item = asRecord(entry);
    return item.areaId !== undefined && item.areaNombre !== undefined
      ? [{ id: String(item.areaId), name: String(item.areaNombre) }]
      : [];
  });

  return {
    summary: { metrics },
    trend: filteredTrend,
    estados,
    cuellosBotella,
    executive: {
      conformity: asNumber(vtep.valor),
      growth: null,
      desksHealth: typeof resumen.actualizadoEn === "string"
        ? new Date(resumen.actualizadoEn).toLocaleString("es-PE")
        : "Sin registro de actualización",
    },
    units,
  };
}

export function useDashboardMetrics(params: DashboardMetricsQuery) {
  const query = useQuery({
    queryKey: ["dashboard-ejecutivo", params],
    queryFn: async () => {
      const filtrosPeriodo = params.periodo
        ? { periodo: params.periodo }
        : params.periodoDesde && params.periodoHasta
          ? { periodoDesde: params.periodoDesde, periodoHasta: params.periodoHasta }
          : {};
      const [resumen, tendencias, cuellosBotella] = await Promise.all([
        apiClient.get<unknown>("/api/v1/reportes/dashboard/resumen", { params: filtrosPeriodo }),
        apiClient.get<unknown>("/api/v1/reportes/dashboard/tendencias", {
          params: { anio: params.anio },
        }),
        apiClient.get<unknown>("/api/v1/reportes/dashboard/cuellos-botella", {
          params: { ...filtrosPeriodo, diasLimite: params.diasLimite ?? 5 },
        }),
      ]);
      return normalizeDashboard({
        resumen: resumen.data,
        tendencias: tendencias.data,
        cuellosBotella: cuellosBotella.data,
      }, params);
    },
    staleTime: 60_000,
    placeholderData: (previousData) => previousData,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  return {
    summary: query.data?.summary ?? { metrics: [] },
    trend: query.data?.trend ?? [],
    estados: query.data?.estados ?? [],
    cuellosBotella: query.data?.cuellosBotella ?? [],
    executive: query.data?.executive ?? { conformity: 0, growth: null, desksHealth: "Sin datos" },
    units: query.data?.units ?? [],
    isLoading: query.isPending,
    isFetching: query.isFetching,
    isError: query.isError,
    errorMessage: query.error instanceof Error ? query.error.message : undefined,
    errorStatus: query.error instanceof ApiHttpError ? query.error.status : undefined,
    refetch: () => query.refetch(),
  };
}
