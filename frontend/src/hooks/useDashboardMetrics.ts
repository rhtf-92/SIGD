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
  if (value === null || value === undefined) return 0;
  const number = typeof value === 'number' || (typeof value === 'string' && value.trim() !== '') ? Number(value) : NaN;
  if (!Number.isFinite(number)) throw new Error('La API devolvió un valor numérico no verificable.');
  return number;
}

function unwrapPayload(value: unknown): Record<string, unknown> {
  const record = asRecord(value);
  return record.data ? asRecord(record.data) : record;
}

function normalizeDashboard(value: unknown): DashboardEjecutivoData & {
  executive: ExecutiveSummaryMetrics;
  executiveAvailable: boolean;
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
      available: metric.value !== null && metric.value !== undefined,
      deltaAvailable: metric.delta !== null && metric.delta !== undefined,
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
    if (!['totalProcesados', 'totalExpedientes', 'totalRadicados', 'volumenProcesado', 'tasaResolucionOportuna',
      'tasaResolucion', 'atrasadosCriticos', 'expedientesCriticos', 'tasaCompletitud', 'cumplimientoDocumental']
      .some(campo => dto[campo] !== undefined)) throw new Error('La API no devolvió indicadores reconocidos.');
    metrics.push(
      { id: "procesados", title: "Expedientes procesados", value: processed, unit: "casos", delta: 0, deltaLabel: "0", status: "neutral", sparkline: [], description: "Volumen procesado en el periodo seleccionado." },
      { id: "resolucion", title: "Tasa de resolución", value: resolution, unit: "%", delta: 0, deltaLabel: "0%", status: resolution >= 80 ? "positive" : "warning", sparkline: [], description: "Resoluciones dentro del periodo seleccionado." },
      { id: "criticos", title: "Expedientes críticos", value: critical, unit: "casos", delta: 0, deltaLabel: "0", status: critical > 0 ? "warning" : "positive", sparkline: [], description: "Expedientes atrasados críticos." },
      { id: "completitud", title: "Cumplimiento documental", value: completeness, unit: "%", delta: 0, deltaLabel: "0%", status: completeness >= 90 ? "positive" : "warning", sparkline: [], description: "Completitud documental reportada." },
    );
    const fuentes = [dto.totalProcesados ?? dto.totalExpedientes ?? dto.totalRadicados ?? dto.volumenProcesado,
      dto.tasaResolucionOportuna ?? dto.tasaResolucion, dto.atrasadosCriticos ?? dto.expedientesCriticos,
      dto.tasaCompletitud ?? dto.cumplimientoDocumental];
    metrics.forEach((metric, index) => {
      metric.available = fuentes[index] !== undefined && fuentes[index] !== null && Number.isFinite(Number(fuentes[index]));
      metric.deltaAvailable = false;
      metric.status = 'neutral';
    });
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
    executiveAvailable: dto.saludMesasPartes !== undefined && dto.deltaMensual !== undefined &&
      (dto.conformidadGlobal !== undefined || dto.tasaCompletitud !== undefined || dto.tasaResolucionOportuna !== undefined),
    units,
  };
}

function normalizeMgd(value: unknown, trends: unknown, bottlenecks: unknown) {
  const dto = unwrapPayload(value);
  const disponible = asRecord(dto.disponibilidad);
  const contadores = asRecord(dto.contadores);
  const definiciones = [
    ['vtep', 'Volumen de expedientes atendidos (VTEP)', '%', 'Atendidos y archivados sobre radicados.'],
    ['tprHorasHabiles', 'Tiempo promedio de respuesta (TPR)', 'horas hábiles', 'Tiempo hábil de los expedientes resueltos.'],
    ['tro', 'Resolución oportuna (TRO)', '%', 'Resueltos dentro de 30 días hábiles sobre resueltos.'],
    ['teo', 'Expedientes observados (TEO)', '%', 'Observados sobre expedientes en trámite.'],
  ];
  const metrics: DashboardKpiMetric[] = definiciones.map(([id, title, unit, description]) => {
    const indicador = asRecord(dto[id]);
    if (typeof indicador.valor !== 'number' || !Number.isFinite(indicador.valor)) throw new Error('La API no devolvió un indicador verificable: ' + id);
    const denominador = id === 'vtep' ? contadores.nRadicados : id === 'teo' ? contadores.nEnTramite : contadores.nResueltos;
    const available = typeof disponible[id] === 'boolean' ? disponible[id] : typeof denominador === 'number' && denominador > 0;
    return { id, title, unit, description, value: indicador.valor, available,
      delta: 0, deltaLabel: 'Sin comparación disponible', deltaAvailable: false, sparkline: [],
      status: !available ? 'neutral' : indicador.cumple === true ? 'positive' : 'warning' };
  });
  if (!Array.isArray(trends) || !Array.isArray(bottlenecks)) throw new Error('La API no devolvió las series del reporte.');
  const trend: DashboardTrendPoint[] = trends.map(raw => {
    const p = asRecord(raw);
    if (p.radicados === null || p.radicados === undefined || p.atendidos === null || p.atendidos === undefined) {
      throw new Error('La API no devolvió los contadores de la tendencia.');
    }
    return { label: String(p.mes), radicados: asNumber(p.radicados), resueltos: asNumber(p.atendidos) };
  });
  const cuellosBotella: DashboardCuelloBotellaItem[] = bottlenecks.map(raw => {
    const p = asRecord(raw);
    return { area: String(p.areaNombre), expedienteCount: asNumber(p.expedientesEstancados),
      diasPromedio: asNumber(p.diasRetencion), severity: p.riesgo === 'alto' ? 'high' : p.riesgo === 'medio' ? 'medium' : 'low' };
  });
  return { summary: { metrics }, trend, cuellosBotella, estados: [] as DashboardEstadoItem[],
    executive: { conformity: 0, growth: 0, desksHealth: 'Sin datos' }, executiveAvailable: false,
    units: bottlenecks.filter(raw => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(asRecord(raw).areaId)))
      .map(raw => { const p = asRecord(raw); return { id: String(p.areaId), name: String(p.areaNombre) }; }) };
}

export function useDashboardMetrics(params: DashboardMetricsQuery) {
  const query = useQuery({
    queryKey: ["dashboard-ejecutivo", params],
    queryFn: async () => {
      const comunes = { fechaInicio: params.fechaInicio, fechaFin: params.fechaFin,
        unidadOrganicaId: params.unidadOrganicaId || undefined };
      const primerAnio = Number(params.fechaInicio.slice(0, 4));
      const ultimoAnio = Number(params.fechaFin.slice(0, 4));
      if (!Number.isInteger(primerAnio) || !Number.isInteger(ultimoAnio) || primerAnio < 2000 || ultimoAnio > 2100 || primerAnio > ultimoAnio) {
        throw new Error('Seleccione un rango de fechas válido entre 2000 y 2100.');
      }
      const anios = Array.from({ length: ultimoAnio - primerAnio + 1 }, (_, i) => primerAnio + i);
      const [series, cuellos, response] = await Promise.all([
        Promise.all(anios.map(anio => apiClient.get<unknown>('/api/v1/reportes/dashboard/tendencias', { params: {
          ...comunes, anio, fechaInicio: params.fechaInicio > `${anio}-01-01` ? params.fechaInicio : `${anio}-01-01`,
          fechaFin: params.fechaFin < `${anio}-12-31` ? params.fechaFin : `${anio}-12-31`,
        } }))),
        apiClient.get<unknown>('/api/v1/reportes/dashboard/cuellos-botella', { params: { ...comunes, diasLimite: params.diasLimite } }),
        apiClient.get<unknown>('/api/v1/reportes/dashboard/resumen', { params: comunes }),
      ]);
      if (!unwrapPayload(response.data).vtep) return normalizeDashboard(response.data);
      const tendencias = series.flatMap((serie, i) => {
        if (!Array.isArray(serie.data)) throw new Error('La API no devolvió la serie mensual.');
        return serie.data.map(raw => anios.length === 1 ? raw : {
          ...asRecord(raw), mes: `${anios[i]}-${String(asRecord(raw).mes).padStart(2, '0')}`,
        });
      });
      return normalizeMgd(response.data, tendencias, cuellos.data);
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
    executiveAvailable: query.data?.executiveAvailable ?? false,
    units: query.data?.units ?? [],
    isLoading: query.isPending,
    isFetching: query.isFetching,
    isError: query.isError,
    errorMessage: query.error instanceof Error ? query.error.message : undefined,
    reintentar: query.refetch,
  };
}
