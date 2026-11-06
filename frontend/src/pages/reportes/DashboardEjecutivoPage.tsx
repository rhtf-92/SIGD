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
    <div className="animate-pulse rounded-2xl border border-slate-200 bg-slate-100 p-4 shadow-sm">
      <div className="h-4 w-24 rounded bg-slate-200" />
      <div className="mt-4 h-10 w-2/3 rounded bg-slate-200" />
      <div className="mt-6 h-14 w-full rounded bg-slate-200" />
      <div className="mt-4 h-4 w-11/12 rounded bg-slate-200" />
    </div>
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

  if (state === "loading") {
    return (
      <div role="main" className="flex-1 w-full bg-slate-100 px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-6 sm:py-8" aria-busy="true">
        <div role="status" aria-live="polite" className="sr-only">
          Cargando tablero ejecutivo.
        </div>
        <div className="w-full space-y-6">
          <header className="rounded-lg border border-slate-200 bg-white p-4">
            <h1 className="text-2xl font-bold text-slate-900">Tablero Directivo Ejecutivo</h1>
          </header>
          {filterControls}
          <section aria-label="Métricas ejecutivas principales" className="grid grid-cols-1 gap-4 sm:grid-cols-2 min-[1025px]:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <SkeletonCard key={index} />
            ))}
          </section>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex-1 flex min-h-[60vh] items-center justify-center bg-slate-100 p-6" aria-live="assertive">
        <div role="status" aria-live="polite" className="sr-only">
          Error al cargar el tablero ejecutivo.
        </div>
        <section
          className="w-full max-w-xl rounded-lg border border-red-200 bg-white p-8 text-center shadow-sm"
          role="alert"
          aria-label="Error del tablero ejecutivo"
        >
          <h1 className="text-2xl font-bold text-slate-900">No se pudo cargar el tablero ejecutivo</h1>
          <p className="mt-3 text-slate-600">{errorMessage ?? "La consulta a la API de reportes no respondió correctamente."}</p>
            {filterControls}
        </section>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full bg-slate-100 px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-6 sm:py-8 text-slate-900">
      <div role="status" aria-live="polite" className="sr-only">
        Tablero ejecutivo cargado correctamente.
      </div>
      <div className="w-full space-y-5 sm:space-y-6">
        {/* Migajas de pan canónicas */}
        <nav
          aria-label="Migajas de pan del tablero ejecutivo"
          className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-slate-500"
        >
          <Link to="/" className="hover:text-blue-700 hover:underline transition-colors">
            Inicio
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-slate-600">Reportes MGD</span>
          <span className="text-slate-300">/</span>
          <span aria-current="page" className="font-semibold text-blue-700">
            Tablero Directivo Ejecutivo
          </span>
        </nav>

        {/* Botones de navegación intermodular */}
        <nav
          aria-label="Navegación gerencial institucional"
          className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none"
        >
          <Link
            to="/reportes"
            aria-current="page"
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs sm:text-sm font-semibold bg-blue-700 text-white shadow-xs"
          >
            <span>📊 Tablero Ejecutivo</span>
          </Link>
          <Link
            to="/expedientes"
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs sm:text-sm font-semibold bg-white text-slate-700 border border-slate-200 hover:bg-blue-50 hover:text-blue-700 transition"
          >
            <span>📂 Bandeja de Expedientes</span>
          </Link>
          <Link
            to="/flujo-validez-legal"
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs sm:text-sm font-semibold bg-white text-slate-700 border border-slate-200 hover:bg-blue-50 hover:text-blue-700 transition"
          >
            <span>📜 Validez Legal</span>
          </Link>
          <Link
            to="/administracion"
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs sm:text-sm font-semibold bg-white text-slate-700 border border-slate-200 hover:bg-blue-50 hover:text-blue-700 transition"
          >
            <span>⚙️ Panel de Administración</span>
          </Link>
        </nav>

        <header className="flex flex-col sm:flex-row gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-xs sm:items-end justify-between">
          <div>
            <Link
              to="/"
              className="mb-3 inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-blue-700"
            >
              ← Volver al inicio
            </Link>
            <h1 className="mt-1 text-xl sm:text-2xl md:text-3xl font-bold">Tablero Directivo Ejecutivo</h1>
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

        {filterControls}
        <ExecutiveKpiSummary metrics={executive} />
        <KpiMetricGrid metrics={summaryMetrics} />

        <div className="grid min-w-0 grid-cols-1 gap-6 xl:gap-8 min-[1025px]:grid-cols-[1.7fr_1fr] 2xl:grid-cols-[2fr_1fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="trend-title">
            <div className="mb-4 flex items-center justify-between">
              <h2 id="trend-title" className="text-lg font-semibold text-slate-900">
                Tendencia de radicados y resueltos
              </h2>
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                {trend.length} periodos
              </span>
            </div>

            <svg viewBox="0 0 100 100" className="h-56 sm:h-64 lg:h-72 xl:h-80 w-full" role="img" aria-label="Gráfico de tendencia de radicados y resueltos">
              <path d={trendChart.map((point) => `${point.x === 0 ? "M" : "L"}${point.x},${point.yRadicados}`).join(" ")} fill="none" stroke="#1E40AF" strokeWidth="2.3" strokeLinecap="round" />
              <path d={trendChart.map((point) => `${point.x === 0 ? "M" : "L"}${point.x},${point.yResueltos}`).join(" ")} fill="none" stroke="#10B981" strokeWidth="2.3" strokeLinecap="round" />
              {trendChart.map((point, index) => (
                <g key={`${point.label}-${index}`}>
                  <circle cx={point.x} cy={point.yRadicados} r="1.5" fill="#1E40AF" />
                  <circle cx={point.x} cy={point.yResueltos} r="1.5" fill="#10B981" />
                </g>
              ))}
            </svg>

            <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-600">
              <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-blue-700" />Radicados</span>
              <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Resueltos</span>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="estado-title">
            <h2 id="estado-title" className="mb-4 text-lg font-semibold text-slate-900">Distribución por estado</h2>
            <div className="flex flex-col gap-4">
              <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-full border-[14px] border-slate-200 bg-white"
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
                    <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: state.color }} />{state.label}</span>
                    <span className="font-semibold text-slate-800">{state.value}%</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="bottleneck-title">
          <h2 id="bottleneck-title" className="mb-4 text-lg font-semibold text-slate-900">Cuellos de botella</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="px-3 py-2 font-medium">Área</th>
                  <th className="px-3 py-2 font-medium">Expedientes</th>
                  <th className="px-3 py-2 font-medium">Días promedio</th>
                  <th className="px-3 py-2 font-medium">Riesgo</th>
                </tr>
              </thead>
              <tbody>
                {cuellosBotella.map((item) => (
                  <tr key={item.area} className="border-b border-slate-100 last:border-none">
                    <td className="px-3 py-3 font-medium text-slate-800">{item.area}</td>
                    <td className="px-3 py-3 text-slate-600">{item.expedienteCount}</td>
                    <td className="px-3 py-3 text-slate-600">{item.diasPromedio.toFixed(1)} días</td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        item.severity === "high"
                          ? "bg-red-100 text-red-700"
                          : item.severity === "medium"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-emerald-100 text-emerald-700"
                      }`}>
                        {item.severity === "high" ? "Alto" : item.severity === "medium" ? "Medio" : "Bajo"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
