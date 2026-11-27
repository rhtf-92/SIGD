import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, BarChart3, KeyRound, RefreshCw, TriangleAlert } from "lucide-react";

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
  const [rangeStart, setRangeStart] = useState("2026-01");
  const [rangeEnd, setRangeEnd] = useState("2026-12");
  const [unitId, setUnitId] = useState("");
  const start = periodMode === "custom"
    ? `${rangeStart}-01`
    : periodMode === "month"
      ? `${year}-${month}-01`
      : `${year}-01-01`;
  const end = periodMode === "custom"
    ? `${rangeEnd}-01`
    : periodMode === "month"
      ? new Date(Date.UTC(year, Number(month), 0)).toISOString().slice(0, 10)
      : `${year}-12-31`;
  const filters = {
    fechaInicio: start,
    fechaFin: end,
    ...(periodMode === "month"
      ? { periodo: `${year}-${month}` }
      : periodMode === "year"
        ? { periodoDesde: `${year}-01`, periodoHasta: `${year}-12` }
        : { periodoDesde: rangeStart, periodoHasta: rangeEnd }),
    diasLimite: 5,
    anio: year,
    ...(periodMode === "month" ? { mes: month } : {}),
    ...(unitId ? { unidadOrganicaId: unitId } : {}),
  };
  const {
    summary,
    trend,
    estados,
    cuellosBotella,
    executive,
    units,
    counters,
    isLoading,
    isFetching,
    isError,
    errorMessage,
    errorStatus,
    errorCode,
    errorCorrelationId,
    errorEndpoint,
    errorEndpointUrl,
    refetch,
  } = useDashboardMetrics(filters);

  const state: DashboardPageState = isLoading ? "loading" : isError ? "error" : "ready";
  const summaryMetrics = summary?.metrics ?? [];
  const hasTrendData = trend.some((point) => point.radicados > 0 || point.resueltos > 0);
  const falloConexion = errorCode === "ERR_NETWORK"
    || errorStatus === 0
    || (errorStatus === undefined && /network|timeout|fetch|conexi|conectar/i.test(errorMessage ?? ""));
  const filterControls = (
    <TimeFilterControls
      year={year}
      mode={periodMode}
      month={month}
      rangeStart={rangeStart}
      rangeEnd={rangeEnd}
      unitId={unitId}
      units={units}
      onYearChange={(nextYear) => {
        setYear(nextYear);
        setRangeStart(`${nextYear}-01`);
        setRangeEnd(`${nextYear}-12`);
      }}
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
      <main className="min-h-screen bg-slate-50 p-4 md:p-8" aria-busy="true">
        <div role="status" aria-live="polite" className="sr-only">
          Cargando tablero ejecutivo.
        </div>
        <div className="mx-auto max-w-7xl space-y-6">
          <header className="dashboard-enter flex items-center gap-4 rounded-2xl border border-blue-100 bg-gradient-to-r from-slate-950 via-blue-950 to-blue-800 p-5 text-white shadow-lg shadow-blue-950/10">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10 text-blue-100 ring-1 ring-white/15">
              <BarChart3 size={25} aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">SIGD · Reportes y control</p>
              <h1 className="mt-1 text-2xl font-bold">Tablero Directivo Ejecutivo</h1>
            </div>
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

  if (state === "error") {
    return (
      <main className="min-h-screen bg-slate-50 p-4 text-slate-900 md:p-8" aria-live="assertive">
        <div role="status" aria-live="polite" className="sr-only">
          Error al cargar el tablero ejecutivo.
        </div>
        <div className="mx-auto max-w-7xl space-y-6">
          <header className="dashboard-enter flex items-center gap-4 rounded-2xl border border-blue-100 bg-gradient-to-r from-slate-950 via-blue-950 to-blue-800 p-5 text-white shadow-lg shadow-blue-950/10">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10 text-blue-100 ring-1 ring-white/15">
              <BarChart3 size={25} aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">SIGD · Reportes y control</p>
              <h1 className="mt-1 text-2xl font-bold">Tablero Directivo Ejecutivo</h1>
            </div>
          </header>
          {filterControls}
          <section
            className="dashboard-enter dashboard-enter-delay-2 rounded-2xl border border-amber-200 bg-white p-6 shadow-sm sm:p-8"
            role="alert"
            aria-label="Error del tablero ejecutivo"
          >
            <div className="mx-auto max-w-2xl text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <TriangleAlert size={24} aria-hidden="true" />
              </span>
              <h2 className="mt-4 text-xl font-bold text-slate-900">No se pudo cargar el tablero</h2>
              {errorEndpoint && (
                <p className="mt-2 text-sm font-semibold text-amber-800">
                  Consulta afectada: {errorEndpoint}
                  {errorEndpointUrl ? ` (${errorEndpointUrl})` : ""}
                </p>
              )}
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {errorStatus === 401
                  ? "La sesión no es válida para el servicio de reportes. Inicia sesión con tu cuenta institucional."
                  : errorStatus === 403
                    ? "Tu cuenta no tiene permiso para consultar el tablero. Se requiere el rol DIRECTOR o SUPER_ADMIN."
                    : errorCode === "ERR_TIMEOUT"
                      ? "El servicio de reportes está tardando más de lo esperado. Vuelve a intentarlo en unos instantes."
                      : falloConexion
                        ? "No se pudo contactar con el servicio de reportes. Comprueba tu conexión e inténtalo de nuevo; si el problema continúa, avisa a soporte técnico."
                        : typeof errorStatus === "number" && errorStatus > 0 && errorMessage
                            && !/localhost|https?:\/\/|ECONN|ERR_/i.test(errorMessage)
                          ? errorMessage
                          : "El servicio de reportes no respondió correctamente. Vuelve a intentarlo."}
              </p>
              {(errorStatus !== undefined || errorCorrelationId) && (
                <p className="mt-3 text-xs text-slate-500">
                  {errorStatus !== undefined && <>Estado HTTP {errorStatus}. </>}
                  {errorCorrelationId && <>Id. de correlación: {errorCorrelationId}. </>}
                  Si el problema persiste, proporcione estos datos al administrador.
                </p>
              )}
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => void refetch()}
                  disabled={isFetching}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70"
                >
                  <RefreshCw size={16} className={isFetching ? "animate-spin" : ""} aria-hidden="true" />
                  {isFetching ? "Conectando..." : "Reintentar"}
                </button>
                {(errorStatus === 401 || errorStatus === 403) && (
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2"
                  >
                    <KeyRound size={16} aria-hidden="true" />
                    Iniciar sesión
                  </Link>
                )}
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                >
                  <ArrowLeft size={16} aria-hidden="true" />
                  Volver al inicio
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 p-4 text-slate-900 md:p-8" aria-busy={isFetching}>
      <div role="status" aria-live="polite" className="sr-only">
        Tablero ejecutivo cargado correctamente.
      </div>
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="dashboard-enter relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-r from-slate-950 via-blue-950 to-blue-800 p-5 text-white shadow-lg shadow-blue-950/10 md:flex-row md:items-end md:justify-between md:p-6">
          <div className="dashboard-orbit absolute -right-10 -top-16 h-56 w-56 rounded-full border-[28px] border-white/5" aria-hidden="true" />
          <div className="relative z-10">
            <Link
              to="/"
              className="mb-5 inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <ArrowLeft size={16} aria-hidden="true" />
              Volver al inicio
            </Link>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">
              <BarChart3 size={15} aria-hidden="true" />
              SIGD / Reportes y control
            </p>
            <h1 className="mt-2 text-2xl font-bold md:text-3xl">Tablero Directivo Ejecutivo</h1>
            <p className="mt-1 text-sm text-blue-100">Indicadores y seguimiento de la gestión institucional</p>
          </div>
          <div className="relative z-10 self-start md:self-auto">
            <ReportExportModal
              reportName="dashboard-ejecutivo"
              filters={filters}
              records={summaryMetrics.map((metric) => ({
                indicador: metric.title,
                valor: metric.value,
                unidad: metric.unit,
                meta: metric.deltaLabel,
              }))}
            />
          </div>
        </header>

        <div className="dashboard-enter dashboard-enter-delay-1">{filterControls}</div>
        {isFetching && (
          <p className="dashboard-enter flex items-center gap-2 text-sm font-medium text-blue-700" role="status">
            <span className="h-2 w-2 animate-pulse rounded-full bg-blue-600" aria-hidden="true" />
            Actualizando indicadores...
          </p>
        )}
        <section
          className="dashboard-enter dashboard-enter-delay-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
          aria-label="Resumen de expedientes"
        >
          {[
            { label: "Total de expedientes", value: counters.total, hint: "Radicados en el periodo", tone: "text-slate-900" },
            { label: "Pendientes", value: counters.pendientes, hint: "Sin procesar ni en trámite", tone: "text-amber-700" },
            { label: "Atendidos", value: counters.atendidos, hint: "Atendidos y archivados", tone: "text-emerald-700" },
            { label: "En trámite", value: counters.enTramite, hint: "En revisión, subsanación u observados", tone: "text-blue-700" },
            { label: "Vencidos", value: counters.vencidos, hint: "Resueltos fuera de plazo", tone: "text-rose-700" },
          ].map((card) => (
            <article
              key={card.label}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow-md"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
              <p className={`mt-2 text-2xl font-bold tabular-nums ${card.tone}`}>
                {card.value.toLocaleString("es-PE")} exp.
              </p>
              <p className="mt-1 text-xs leading-4 text-slate-500">{card.hint}</p>
            </article>
          ))}
        </section>

        <div className="dashboard-enter dashboard-enter-delay-2">
          <ExecutiveKpiSummary metrics={executive} />
        </div>
        <div className="dashboard-stagger">
          <KpiMetricGrid metrics={summaryMetrics} />
        </div>

        <div className="dashboard-enter dashboard-enter-delay-3 grid min-w-0 grid-cols-1 gap-6 min-[1025px]:grid-cols-[1.7fr_1fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="trend-title">
            <div className="mb-4 flex items-center justify-between">
              <h2 id="trend-title" className="text-lg font-semibold text-slate-900">
                Tendencia de radicados y resueltos
              </h2>
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                {trend.length} periodos
              </span>
            </div>

            {hasTrendData ? (
              <>
                <svg viewBox="0 0 100 100" className="h-56 w-full" role="img" aria-label="Gráfico de tendencia de radicados y resueltos">
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
              </>
            ) : (
              <p className="flex h-56 items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-500">
                No hay datos de tendencia para el periodo seleccionado.
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="estado-title">
            <h2 id="estado-title" className="mb-4 text-lg font-semibold text-slate-900">Distribución por estado</h2>
            <div className="flex flex-col gap-4">
              {estados.length > 0 ? (
                <div
                  className="mx-auto flex h-32 w-32 items-center justify-center rounded-full border-[14px] border-slate-200 bg-white"
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
              ) : (
                <p className="flex h-32 items-center justify-center text-center text-sm text-slate-500">
                  No hay datos de estados para este periodo.
                </p>
              )}

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

        <section className="dashboard-enter dashboard-enter-delay-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="bottleneck-title">
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
                {cuellosBotella.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-sm text-slate-500">
                      {unitId
                        ? "No se identificaron cuellos de botella para esta unidad en el periodo seleccionado."
                        : "No se identificaron cuellos de botella para el periodo seleccionado."}
                    </td>
                  </tr>
                ) : cuellosBotella.map((item) => (
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
    </main>
  );
}
