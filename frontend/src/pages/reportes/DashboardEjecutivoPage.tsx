import { useMemo, useState } from "react";

import ExecutiveKpiSummary from "@/components/dashboard/ExecutiveKpiSummary";
import TimeFilterControls, { type DashboardPeriodMode } from "@/components/dashboard/TimeFilterControls";
import KpiMetricGrid from "@/components/reportes/KpiMetricGrid";
import ReportExportModal from "@/components/reportes/ReportExportModal";
import Badge from "@/components/ui/Badge";
import PageContainer from "@/components/ui/PageContainer";
import PageHeader from "@/components/ui/PageHeader";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";

type DashboardPageState = "loading" | "error" | "ready";

const CHART = { width: 200, height: 60, padX: 8, padTop: 6, padBottom: 14 } as const;
const PLOT_HEIGHT = CHART.height - CHART.padTop - CHART.padBottom;

function SkeletonCard() {
  return (
    <div className="card-sigd animate-pulse p-4">
      <div className="h-4 w-24 rounded bg-slate-200" />
      <div className="mt-4 h-10 w-2/3 rounded bg-slate-200" />
      <div className="mt-6 h-14 w-full rounded bg-slate-200" />
      <div className="mt-4 h-4 w-11/12 rounded bg-slate-200" />
    </div>
  );
}

const severityTone = { high: "error", medium: "warning", low: "success" } as const;
const severityLabel = { high: "Alto", medium: "Medio", low: "Bajo" } as const;

export default function DashboardEjecutivoPage() {
  const [year, setYear] = useState(2026);
  const [periodMode, setPeriodMode] = useState<DashboardPeriodMode>("year");
  const [month, setMonth] = useState("01");
  const [rangeStart, setRangeStart] = useState("2026-01-01");
  const [rangeEnd, setRangeEnd] = useState("2026-12-31");
  const [unitId, setUnitId] = useState("");
  const start = periodMode === "custom"
    ? rangeStart
    : periodMode === "month"
      ? `${year}-${month}-01`
      : `${year}-01-01`;
  const end = periodMode === "custom"
    ? rangeEnd
    : periodMode === "month"
      ? new Date(Date.UTC(year, Number(month), 0)).toISOString().slice(0, 10)
      : `${year}-12-31`;
  const filters = {
    fechaInicio: start,
    fechaFin: end,
    periodo: periodMode === "year" ? "anual" : periodMode === "month" ? "mensual" : "personalizado",
    diasLimite: 5,
    anio: year,
    ...(periodMode === "month" ? { mes: month } : {}),
    ...(unitId ? { unidadOrganicaId: unitId } : {}),
  };
  const { summary, trend, estados, cuellosBotella, executive, units, isLoading, isError, errorMessage } = useDashboardMetrics(filters);

  const state: DashboardPageState = isLoading ? "loading" : isError ? "error" : "ready";
  const summaryMetrics = summary?.metrics ?? [];
  const filterControls = (
    <TimeFilterControls
      year={year}
      mode={periodMode}
      month={month}
      rangeStart={rangeStart}
      rangeEnd={rangeEnd}
      unitId={unitId}
      units={units}
      onYearChange={setYear}
      onModeChange={setPeriodMode}
      onMonthChange={setMonth}
      onRangeStartChange={setRangeStart}
      onRangeEndChange={setRangeEnd}
      onUnitChange={setUnitId}
    />
  );

  const trendChart = useMemo(() => {
    const maxValue = Math.max(...trend.flatMap((point) => [point.radicados, point.resueltos]), 1);
    const count = trend.length;

    return trend.map((point, index) => ({
      ...point,
      x: count > 1
        ? CHART.padX + (index / (count - 1)) * (CHART.width - CHART.padX * 2)
        : CHART.width / 2,
      yRadicados: CHART.padTop + (1 - point.radicados / maxValue) * PLOT_HEIGHT,
      yResueltos: CHART.padTop + (1 - point.resueltos / maxValue) * PLOT_HEIGHT,
    }));
  }, [trend]);

  if (state === "loading") {
    return (
      <main className="min-h-screen bg-sigd-surface p-4 md:p-8" aria-busy="true">
        <div role="status" aria-live="polite" className="sr-only">
          Cargando tablero ejecutivo.
        </div>
        <PageContainer>
          <PageHeader kicker="SIGD / Dashboard" title="Tablero Directivo Ejecutivo" />
          {filterControls}
          <section
            aria-label="Métricas ejecutivas principales"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            {Array.from({ length: 4 }).map((_, index) => (
              <SkeletonCard key={index} />
            ))}
          </section>
        </PageContainer>
      </main>
    );
  }

  if (state === "error") {
    return (
      <main className="min-h-screen bg-sigd-surface p-4 md:p-8" aria-live="assertive">
        <div role="status" aria-live="polite" className="sr-only">
          Error al cargar el tablero ejecutivo.
        </div>
        <PageContainer>
          <PageHeader kicker="SIGD / Dashboard" title="Tablero Directivo Ejecutivo" backTo="/" />
          <section
            className="card-sigd p-6"
            role="alert"
            aria-label="Error del tablero ejecutivo"
          >
            <h2 className="text-lg font-semibold text-sigd-red">
              No se pudo cargar el tablero ejecutivo
            </h2>
            <p className="mt-2 text-slate-600">
              {errorMessage ?? "La consulta a la API de reportes no respondió correctamente."}
            </p>
            <div className="mt-4">{filterControls}</div>
          </section>
        </PageContainer>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-sigd-surface p-4 text-slate-900 md:p-8">
      <div role="status" aria-live="polite" className="sr-only">
        Tablero ejecutivo cargado correctamente.
      </div>
      <PageContainer>
        <PageHeader
          kicker="SIGD / Dashboard"
          title="Tablero Directivo Ejecutivo"
          backTo="/"
          action={
            <ReportExportModal
              reportName="dashboard-ejecutivo"
              filters={filters}
              records={summaryMetrics.map((metric) => ({
                indicador: metric.title,
                valor: metric.value,
                unidad: metric.unit,
                delta: metric.delta,
              }))}
            />
          }
        />

        {filterControls}
        <ExecutiveKpiSummary metrics={executive} />
        <KpiMetricGrid metrics={summaryMetrics} />

        <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[1.7fr_1fr]">
          <section className="card-sigd p-4" aria-labelledby="trend-title">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 id="trend-title" className="text-lg font-semibold text-slate-900">
                Tendencia de radicados y resueltos
              </h2>
              <Badge tone="info">{trend.length} periodos</Badge>
            </div>

            {trendChart.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">
                Sin datos de tendencia para el periodo seleccionado.
              </p>
            ) : (
              <svg
                viewBox={`0 0 ${CHART.width} ${CHART.height}`}
                className="h-auto w-full"
                role="img"
                aria-label="Gráfico de tendencia de radicados y resueltos"
              >
                {[0, 1, 2, 3, 4].map((step) => {
                  const y = CHART.padTop + (step / 4) * PLOT_HEIGHT;
                  return (
                    <line
                      key={`grid-${step}`}
                      x1={CHART.padX}
                      x2={CHART.width - CHART.padX}
                      y1={y}
                      y2={y}
                      stroke="#e2e8f0"
                      strokeWidth="1"
                    />
                  );
                })}
                <path
                  d={trendChart.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.yRadicados}`).join(" ")}
                  fill="none"
                  stroke="#006ec7"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <path
                  d={trendChart.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.yResueltos}`).join(" ")}
                  fill="none"
                  stroke="#059669"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                {trendChart.map((point, index) => (
                  <g key={`${point.label}-${index}`}>
                    <circle cx={point.x} cy={point.yRadicados} r="1.5" fill="#006ec7" />
                    <circle cx={point.x} cy={point.yResueltos} r="1.5" fill="#059669" />
                  </g>
                ))}
                {trendChart.length <= 6
                  ? trendChart.map((point, index) => (
                      <text
                        key={`label-${index}`}
                        x={point.x}
                        y={CHART.height - 3}
                        textAnchor="middle"
                        fontSize="5"
                        fill="#64748b"
                      >
                        {point.label}
                      </text>
                    ))
                  : null}
              </svg>
            )}

            <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-600">
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-sigd-blue" />
                Radicados
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Resueltos
              </span>
            </div>
          </section>

          <section className="card-sigd p-4" aria-labelledby="estado-title">
            <h2 id="estado-title" className="mb-4 text-lg font-semibold text-slate-900">
              Distribución por estado
            </h2>
            {estados.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">
                Sin distribución de estados para el periodo seleccionado.
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                <div
                  className="mx-auto flex h-32 w-32 items-center justify-center rounded-full border-[14px] border-slate-200"
                  style={{
                    background: `conic-gradient(${estados
                      .map((state, index) => {
                        const previous = estados.slice(0, index).reduce((sum, current) => sum + current.value, 0);
                        return `${state.color} ${previous}% ${previous + state.value}%`;
                      })
                      .join(", ")})`,
                  }}
                  aria-label="Distribución porcentual por estado"
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-center text-sm font-bold text-slate-900">
                    {estados.reduce((sum, item) => sum + item.value, 0)}%
                  </div>
                </div>

                <ul className="space-y-2">
                  {estados.map((state) => (
                    <li key={state.label} className="flex items-center justify-between text-sm text-slate-600">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: state.color }} />
                        {state.label}
                      </span>
                      <span className="font-semibold text-slate-800">{state.value}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>

        <section className="card-sigd p-4" aria-labelledby="bottleneck-title">
          <h2 id="bottleneck-title" className="mb-4 text-lg font-semibold text-slate-900">
            Cuellos de botella
          </h2>
          <div className="table-sigd overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <th className="px-3 py-2 font-medium">Área</th>
                  <th className="px-3 py-2 font-medium">Expedientes</th>
                  <th className="px-3 py-2 font-medium">Días promedio</th>
                  <th className="px-3 py-2 font-medium">Riesgo</th>
                </tr>
              </thead>
              <tbody>
                {cuellosBotella.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                      Sin cuellos de botella identificados para el periodo seleccionado.
                    </td>
                  </tr>
                ) : (
                  cuellosBotella.map((item) => (
                    <tr key={item.area} className="border-b border-slate-100 last:border-none">
                      <td className="px-3 py-3 font-medium text-slate-800">{item.area}</td>
                      <td className="px-3 py-3 text-slate-600">{item.expedienteCount}</td>
                      <td className="px-3 py-3 text-slate-600">{item.diasPromedio.toFixed(1)} días</td>
                      <td className="px-3 py-3">
                        <Badge tone={severityTone[item.severity]}>
                          {severityLabel[item.severity]}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </PageContainer>
    </main>
  );
}
