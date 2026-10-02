import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/api/client";
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
  growth: number;
  desksHealth: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function asNumber(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
}

function unwrapPayload(value: unknown): Record<string, unknown> {
  const record = asRecord(value);
  return record.data ? asRecord(record.data) : record;
}

function normalizeDashboard(value: unknown): DashboardEjecutivoData & {
  executive: ExecutiveSummaryMetrics;
  units: DashboardUnitOption[];
} {
  const dto = unwrapPayload(value);
  const rawMetrics = Array.isArray(dto.metrics) ? dto.metrics : [];
  const metrics: DashboardKpiMetric[] = rawMetrics.map((value, index) => {
    const metric = asRecord(value);
    const number = asNumber(metric.value);
    const delta = asNumber(metric.delta);
    return {
      id: String(metric.id ?? `kpi-${index + 1}`),
      title: String(metric.title ?? metric.nombre ?? `Indicador ${index + 1}`),
      value: number,
      unit: String(metric.unit ?? metric.unidad ?? ""),
      delta,
      deltaLabel: String(metric.deltaLabel ?? `${delta > 0 ? "+" : ""}${delta}${metric.unit === "%" ? "%" : ""}`),
      status: metric.status === "positive" || metric.status === "warning" || metric.status === "critical" ? metric.status : "neutral",
      sparkline: Array.isArray(metric.sparkline) ? metric.sparkline.map(asNumber) : [],
      description: String(metric.description ?? ""),
    };
  });

  const processed = asNumber(dto.totalProcesados ?? dto.totalExpedientes ?? dto.totalRadicados ?? dto.volumenProcesado);
  const resolution = asNumber(dto.tasaResolucionOportuna ?? dto.tasaResolucion);
  const critical = asNumber(dto.atrasadosCriticos ?? dto.expedientesCriticos);
  const completeness = asNumber(dto.tasaCompletitud ?? dto.cumplimientoDocumental);
  if (metrics.length === 0) {
    metrics.push(
      { id: "procesados", title: "Expedientes procesados", value: processed, unit: "casos", delta: 0, deltaLabel: "0", status: "neutral", sparkline: [], description: "Volumen procesado en el periodo seleccionado." },
      { id: "resolucion", title: "Tasa de resolución", value: resolution, unit: "%", delta: 0, deltaLabel: "0%", status: resolution >= 80 ? "positive" : "warning", sparkline: [], description: "Resoluciones dentro del periodo seleccionado." },
      { id: "criticos", title: "Expedientes críticos", value: critical, unit: "casos", delta: 0, deltaLabel: "0", status: critical > 0 ? "warning" : "positive", sparkline: [], description: "Expedientes atrasados críticos." },
      { id: "completitud", title: "Cumplimiento documental", value: completeness, unit: "%", delta: 0, deltaLabel: "0%", status: completeness >= 90 ? "positive" : "warning", sparkline: [], description: "Completitud documental reportada." },
    );
  }

  const trendData = Array.isArray(dto.tendencia) ? dto.tendencia : [];
  const trend: DashboardTrendPoint[] = trendData.map((value) => {
    const point = asRecord(value);
    return {
      label: String(point.fechaLabel ?? point.label ?? point.fecha ?? ""),
      radicados: asNumber(point.radicados ?? point.totalRadicados),
      resueltos: asNumber(point.resueltos ?? point.atendidos ?? point.totalResueltos),
    };
  });

  const statesData = Array.isArray(dto.estados) ? dto.estados : [];
  const colors = ["#1d4ed8", "#059669", "#d97706", "#64748b"];
  const estados: DashboardEstadoItem[] = statesData.map((value, index) => {
    const state = asRecord(value);
    return {
      label: String(state.estado ?? state.label ?? "Sin estado"),
      value: asNumber(state.porcentaje ?? state.value),
      color: String(state.color ?? colors[index % colors.length]),
    };
  });

  const bottlenecks = Array.isArray(dto.cuellosBotella) ? dto.cuellosBotella : [];
  const cuellosBotella: DashboardCuelloBotellaItem[] = bottlenecks.map((value) => {
    const item = asRecord(value);
    const risk = String(item.severity ?? item.nivelAlerta ?? "low").toLowerCase();
    return {
      area: String(item.area ?? item.nombreArea ?? item.unidadOrganica ?? "Área"),
      expedienteCount: asNumber(item.expedienteCount ?? item.expedientesEstancados),
      diasPromedio: asNumber(item.diasPromedio ?? item.tprPromedio),
      severity: risk === "high" || risk === "alto" || risk === "critico" ? "high" : risk === "medium" || risk === "medio" || risk === "advertencia" ? "medium" : "low",
    };
  });

  const unitsData = Array.isArray(dto.unidades) ? dto.unidades : [];
  const units = unitsData.flatMap((value) => {
    const unit = asRecord(value);
    const id = unit.id ?? unit.unidadOrganicaId ?? unit.areaId;
    const name = unit.nombre ?? unit.nombreArea ?? unit.descripcion;
    return id !== undefined && name !== undefined ? [{ id: String(id), name: String(name) }] : [];
  });

  return {
    summary: { metrics },
    trend,
    estados,
    cuellosBotella,
    executive: {
      conformity: asNumber(dto.conformidadGlobal ?? dto.tasaCompletitud ?? dto.tasaResolucionOportuna),
      growth: asNumber(dto.deltaMensual ?? dto.deltaPorcentaje),
      desksHealth: String(dto.saludMesasPartes ?? dto.estadoOperativo ?? "Sin datos"),
    },
    units,
  };
}

export function useDashboardMetrics(params: DashboardMetricsQuery) {
  const query = useQuery({
    queryKey: ["dashboard-ejecutivo", params],
    queryFn: async () => {
      const response = await apiClient.get<unknown>("/api/v1/reportes/dashboard/resumen", {
        params: {
          fechaInicio: params.fechaInicio,
          fechaFin: params.fechaFin,
          periodo: params.periodo,
          diasLimite: params.diasLimite,
          anio: params.anio,
          mes: params.mes,
          unidadOrganicaId: params.unidadOrganicaId || undefined,
        },
      });
      return normalizeDashboard(response.data);
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
    executive: query.data?.executive ?? { conformity: 0, growth: 0, desksHealth: "Sin datos" },
    units: query.data?.units ?? [],
    isLoading: query.isPending,
    isFetching: query.isFetching,
    isError: query.isError,
    errorMessage: query.error instanceof Error ? query.error.message : undefined,
  };
}
