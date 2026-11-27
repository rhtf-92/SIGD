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

export interface DashboardCounters {
  total: number;
  pendientes: number;
  atendidos: number;
  enTramite: number;
  vencidos: number;
  observados: number;
}

const CONTADORES_VACIOS: DashboardCounters = {
  total: 0,
  pendientes: 0,
  atendidos: 0,
  enTramite: 0,
  vencidos: 0,
  observados: 0,
};

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

type DashboardEndpointError = Error & { endpoint?: string; endpointUrl?: string };

const ENDPOINT_LABELS: Readonly<Record<string, string>> = {
  "/api/v1/reportes/dashboard/resumen": "resumen de indicadores",
  "/api/v1/reportes/dashboard/tendencias": "tendencias mensuales",
  "/api/v1/reportes/dashboard/cuellos-botella": "cuellos de botella",
};

async function dashboardGet<T>(
  url: string,
  params: Record<string, string | number | undefined>,
) {
  try {
    return await apiClient.get<T>(url, { params });
  } catch (error) {
    const labeled = (error instanceof Error ? error : new Error(String(error))) as DashboardEndpointError;
    labeled.endpoint = ENDPOINT_LABELS[url] ?? url;
    labeled.endpointUrl = url;
    throw labeled;
  }
}

function errorMeta(error: unknown, key: "endpoint" | "endpointUrl"): string | undefined {
  const value = (error as DashboardEndpointError | null | undefined)?.[key];
  return typeof value === "string" ? value : undefined;
}

interface DashboardResponses {
  resumen: unknown;
  tendencias: unknown;
  cuellosBotella: unknown;
  opcionesUnidades?: unknown;
}

function normalizeDashboard(value: DashboardResponses, params: DashboardMetricsQuery): DashboardEjecutivoData & {
  executive: ExecutiveSummaryMetrics;
  units: DashboardUnitOption[];
  counters: DashboardCounters;
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
  const resueltos = asNumber(contadores.nResueltos);
  const dentroPlazo = asNumber(contadores.nResueltosDentroPlazo);
  const otros = Math.max(total - procesados - enTramite - observados, 0);
  const counters: DashboardCounters = {
    total,
    pendientes: Math.max(total - procesados - enTramite, 0),
    atendidos: procesados,
    enTramite,
    vencidos: Math.max(resueltos - dentroPlazo, 0),
    observados,
  };

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

  const unidadesFuente = value.opcionesUnidades !== undefined
    ? unwrapPayload(value.opcionesUnidades)
    : bottlenecks;
  const unidadesArreglo = Array.isArray(unidadesFuente) ? unidadesFuente : [];
  const units: DashboardUnitOption[] = unidadesArreglo.flatMap((entry) => {
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
    counters,
  };
}

export function useDashboardMetrics(params: DashboardMetricsQuery) {
  const query = useQuery({
    queryKey: [
      "dashboard-ejecutivo",
      params.anio,
      params.mes,
      params.periodo,
      params.periodoDesde,
      params.periodoHasta,
      params.diasLimite,
      params.unidadOrganicaId,
    ],
    queryFn: async () => {
      const unidadOrganicaId = params.unidadOrganicaId?.trim() || undefined;
      const filtrosComunes = {
        ...(params.periodo
          ? { periodo: params.periodo }
          : params.periodoDesde && params.periodoHasta
            ? { periodoDesde: params.periodoDesde, periodoHasta: params.periodoHasta }
            : {}),
        ...(unidadOrganicaId ? { unidadOrganicaId } : {}),
      };
      const opcionesUnidadesPromise = unidadOrganicaId
        ? dashboardGet<unknown>("/api/v1/reportes/dashboard/cuellos-botella", {
            ...(params.periodo
              ? { periodo: params.periodo }
              : params.periodoDesde && params.periodoHasta
                ? { periodoDesde: params.periodoDesde, periodoHasta: params.periodoHasta }
                : {}),
            diasLimite: params.diasLimite ?? 5,
          }).then((response) => response.data).catch(() => undefined)
        : Promise.resolve(undefined);
      const [resumen, tendencias, cuellosBotella, opcionesUnidades] = await Promise.all([
        dashboardGet<unknown>("/api/v1/reportes/dashboard/resumen", filtrosComunes),
        dashboardGet<unknown>("/api/v1/reportes/dashboard/tendencias", {
          anio: params.anio,
          ...(unidadOrganicaId ? { unidadOrganicaId } : {}),
        }),
        dashboardGet<unknown>("/api/v1/reportes/dashboard/cuellos-botella", {
          ...filtrosComunes,
          diasLimite: params.diasLimite ?? 5,
        }),
        opcionesUnidadesPromise,
      ]);
      return normalizeDashboard({
        resumen: resumen.data,
        tendencias: tendencias.data,
        cuellosBotella: cuellosBotella.data,
        opcionesUnidades,
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
    counters: query.data?.counters ?? CONTADORES_VACIOS,
    isLoading: query.isPending,
    isFetching: query.isFetching,
    isError: query.isError,
    errorMessage: query.error instanceof Error ? query.error.message : undefined,
    errorStatus: query.error instanceof ApiHttpError ? query.error.status : undefined,
    errorCode: query.error instanceof ApiHttpError ? query.error.problemDetails.code : undefined,
    errorCorrelationId: query.error instanceof ApiHttpError ? query.error.correlationId : undefined,
    errorEndpoint: errorMeta(query.error, "endpoint"),
    errorEndpointUrl: errorMeta(query.error, "endpointUrl"),
    refetch: () => query.refetch(),
  };
}
