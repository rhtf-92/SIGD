/**
 * DashboardEjecutivoPage — Reportes y Tableros de Control · SIGD.
 * Tablero directivo ejecutivo con KPIs superiores, tendencias,
 * distribución por estado y cuellos de botella.
 * Maquillado: glassmorphism / neón — consistente con el prototipo SIGD.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import ExecutiveKpiSummary from "@/components/dashboard/ExecutiveKpiSummary";
import TimeFilterControls, { type DashboardPeriodMode } from "@/components/dashboard/TimeFilterControls";
import KpiMetricGrid from "@/components/reportes/KpiMetricGrid";
import ReportExportModal from "@/components/reportes/ReportExportModal";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";

type DashboardPageState = "loading" | "error" | "ready";

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="h-3 w-20 rounded-full bg-white/10" />
      <div className="mt-4 h-8 w-2/3 rounded-full bg-white/10" />
      <div className="mt-5 h-12 w-full rounded-xl bg-white/10" />
      <div className="mt-3 h-3 w-11/12 rounded-full bg-white/10" />
    </div>
  );
}

/* ─── Badge de riesgo del tablero ─── */
function RiesgoBadge({ severity }: { severity: "high" | "medium" | "low" }) {
  const map = {
    high: "border-red-400/40 bg-red-500/10 text-red-300",
    medium: "border-amber-400/40 bg-amber-500/10 text-amber-300",
    low: "border-emerald-400/40 bg-emerald-500/10 text-emerald-300",
  };
  const labels = { high: "Alto", medium: "Medio", low: "Bajo" };
  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${map[severity]}`}>
      {labels[severity]}
    </span>
  );
}

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

    return trend.map((point) => ({
      ...point,
      x: (trend.indexOf(point) / Math.max(trend.length - 1, 1)) * 100,
      yRadicados: 100 - (point.radicados / maxValue) * 100,
      yResueltos: 100 - (point.resueltos / maxValue) * 100,
    }));
  }, [trend]);

  /* ── Pantalla de carga ── */
  if (state === "loading") {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 p-4 md:p-8" aria-busy="true">
        <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 fixed top-0 left-0 z-50" />
        <div role="status" aria-live="polite" className="sr-only">Cargando tablero ejecutivo.</div>
        <div className="mx-auto max-w-7xl space-y-6 pt-2">
          <header className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
            <h1 className="text-2xl font-bold text-white">Tablero Directivo Ejecutivo</h1>
          </header>
          {filterControls}
          <section aria-label="Métricas ejecutivas principales" className="grid grid-cols-1 gap-4 sm:grid-cols-2 min-[1025px]:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <SkeletonCard key={index} />
            ))}
          </section>
        </div>
      </main>
    );
  }

  /* ── Pantalla de error ── */
  if (state === "error") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 p-6" aria-live="assertive">
        <div role="status" aria-live="polite" className="sr-only">Error al cargar el tablero ejecutivo.</div>
        <section
          className="w-full max-w-xl rounded-2xl border border-red-400/30 bg-red-500/10 p-8 text-center shadow-xl backdrop-blur-md"
          role="alert"
          aria-label="Error del tablero ejecutivo"
        >
          <span className="text-4xl">⚠️</span>
          <h1 className="mt-4 text-2xl font-bold text-white">No se pudo cargar el tablero</h1>
          <p className="mt-3 text-slate-400">{errorMessage ?? "La consulta a la API de reportes no respondió correctamente."}</p>
          {filterControls}
        </section>
      </main>
    );
  }

  /* ── Dashboard listo ── */
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 text-slate-100">

      {/* Barra de acento */}
      <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500" />

      <div className="p-4 md:p-8">
        <div role="status" aria-live="polite" className="sr-only">Tablero ejecutivo cargado correctamente.</div>
        <div className="mx-auto max-w-7xl space-y-6">

          {/* ── Header ── */}
          <header className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 shadow-xl backdrop-blur-md md:flex-row md:items-end md:justify-between">
            <div>
              <Link
                to="/"
                className="mb-4 inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/20 hover:text-white"
              >
                ← Volver al inicio
              </Link>
              <p className="text-xs font-bold uppercase tracking-widest text-blue-400">
                SIGD · Reportes y Tableros de Control
              </p>
              <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-white md:text-3xl">
                <span className="bg-gradient-to-r from-blue-300 to-violet-300 bg-clip-text text-transparent">
                  Tablero Directivo Ejecutivo
                </span>
              </h1>
            </div>
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
          </header>

          {/* ── Filtros de periodo ── */}
          {filterControls}

          {/* ── KPI ejecutivo banner ── */}
          <ExecutiveKpiSummary metrics={executive} />

          {/* ── Grid de métricas KPI ── */}
          <KpiMetricGrid metrics={summaryMetrics} />

          {/* ── Tendencias + Distribución ── */}
          <div className="grid min-w-0 grid-cols-1 gap-6 min-[1025px]:grid-cols-[1.7fr_1fr]">

            {/* Tendencia de radicados */}
            <section
              className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg backdrop-blur-md"
              aria-labelledby="trend-title"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 id="trend-title" className="text-base font-bold text-white">
                  Tendencia de radicados y resueltos
                </h2>
                <span className="rounded-full border border-blue-400/30 bg-blue-500/15 px-2.5 py-1 text-xs font-semibold text-blue-300">
                  {trend.length} periodos
                </span>
              </div>

              <svg
                viewBox="0 0 100 100"
                className="h-56 w-full"
                role="img"
                aria-label="Gráfico de tendencia de radicados y resueltos"
              >
                {/* área bajo la curva de radicados */}
                <path
                  d={[
                    ...trendChart.map((point) => `${point.x === 0 ? "M" : "L"}${point.x},${point.yRadicados}`),
                    `L${100},${100}`, `L${0},${100}`, "Z",
                  ].join(" ")}
                  fill="url(#grad-radicados)"
                  opacity="0.15"
                />
                {/* línea radicados */}
                <path
                  d={trendChart.map((point) => `${point.x === 0 ? "M" : "L"}${point.x},${point.yRadicados}`).join(" ")}
                  fill="none"
                  stroke="#60a5fa"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* línea resueltos */}
                <path
                  d={trendChart.map((point) => `${point.x === 0 ? "M" : "L"}${point.x},${point.yResueltos}`).join(" ")}
                  fill="none"
                  stroke="#34d399"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* puntos */}
                {trendChart.map((point, index) => (
                  <g key={`${point.label}-${index}`}>
                    <circle cx={point.x} cy={point.yRadicados} r="2" fill="#60a5fa" />
                    <circle cx={point.x} cy={point.yResueltos} r="2" fill="#34d399" />
                  </g>
                ))}
                <defs>
                  <linearGradient id="grad-radicados" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#60a5fa" stopOpacity="1" />
                    <stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>

              <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-400">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-400" />
                  Radicados
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  Resueltos
                </span>
              </div>
            </section>

            {/* Distribución por estado */}
            <section
              className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg backdrop-blur-md"
              aria-labelledby="estado-title"
            >
              <h2 id="estado-title" className="mb-5 text-base font-bold text-white">
                Distribución por estado
              </h2>
              <div className="flex flex-col gap-5">
                {/* gráfico donut */}
                <div
                  className="mx-auto flex h-36 w-36 items-center justify-center rounded-full shadow-xl"
                  style={{
                    background: `conic-gradient(${estados
                      .map((state, index) => {
                        const previous = estados.slice(0, index).reduce((sum, current) => sum + current.value, 0);
                        return `${state.color} ${previous}% ${previous + state.value}%`;
                      })
                      .join(", ")})`,
                    boxShadow: "0 0 40px rgba(99,102,241,0.25)",
                  }}
                  aria-label="Distribución porcentual por estado"
                >
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-950 text-center text-sm font-bold text-white shadow-inner">
                    {estados.reduce((sum, item) => sum + item.value, 0)}%
                  </div>
                </div>

                <ul className="space-y-2.5">
                  {estados.map((state) => (
                    <li key={state.label} className="flex items-center justify-between text-sm">
                      <span className="inline-flex items-center gap-2 text-slate-300">
                        <span
                          className="h-2.5 w-2.5 rounded-full shadow-sm"
                          style={{ background: state.color, boxShadow: `0 0 6px ${state.color}88` }}
                        />
                        {state.label}
                      </span>
                      <span className="font-bold text-white">{state.value}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </div>

          {/* ── Cuellos de botella ── */}
          <section
            className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg backdrop-blur-md"
            aria-labelledby="bottleneck-title"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 id="bottleneck-title" className="text-base font-bold text-white">
                🔴 Cuellos de botella por área
              </h2>
              <span className="rounded-full border border-red-400/30 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-300">
                {cuellosBotella.filter((i) => i.severity === "high").length} críticos
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2.5">Área</th>
                    <th className="px-4 py-2.5 text-right">Expedientes</th>
                    <th className="px-4 py-2.5 text-right">Días promedio</th>
                    <th className="px-4 py-2.5 text-center">Riesgo</th>
                  </tr>
                </thead>
                <tbody>
                  {cuellosBotella.map((item) => (
                    <tr
                      key={item.area}
                      className="border-b border-white/5 transition last:border-none hover:bg-white/5"
                    >
                      <td className="px-4 py-3 font-medium text-white">{item.area}</td>
                      <td className="px-4 py-3 text-right text-slate-300">{item.expedienteCount}</td>
                      <td className="px-4 py-3 text-right text-slate-300">{item.diasPromedio.toFixed(1)} días</td>
                      <td className="px-4 py-3 text-center">
                        <RiesgoBadge severity={item.severity} />
                      </td>
                    </tr>
                  ))}
                  {cuellosBotella.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                        No se registran cuellos de botella para el período consultado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Footer del módulo */}
          <p className="text-center text-xs text-slate-700">
            Reportes y Tableros de Control · SIGD IESTP Suiza · {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </main>
  );
}
