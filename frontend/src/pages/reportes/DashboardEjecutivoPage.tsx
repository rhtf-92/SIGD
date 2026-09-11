import { useMemo } from "react";

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
  const { summary, trend, estados, cuellosBotella, isLoading, isError, errorMessage } = useDashboardMetrics({
    fechaInicio: "2026-01-01",
    fechaFin: "2026-12-31",
    periodo: "mensual",
    diasLimite: 5,
  });

  const state: DashboardPageState = isLoading ? "loading" : isError ? "error" : "ready";
  const summaryMetrics = summary?.metrics ?? [];

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
      <main className="min-h-screen bg-slate-100 p-4 md:p-8" aria-busy="true">
        <div role="status" aria-live="polite" className="sr-only">
          Cargando tablero ejecutivo.
        </div>
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="h-12 w-64 animate-pulse rounded bg-slate-200" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <SkeletonCard key={index} />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (state === "error") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6" aria-live="assertive">
        <div role="status" aria-live="polite" className="sr-only">
          Error al cargar el tablero ejecutivo.
        </div>
        <section
          className="max-w-xl rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm"
          role="alert"
          aria-label="Error del tablero ejecutivo"
        >
          <h1 className="text-2xl font-bold text-slate-900">No se pudo cargar el tablero ejecutivo</h1>
          <p className="mt-3 text-slate-600">{errorMessage ?? "La consulta a la API de reportes no respondió correctamente."}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-900 md:p-8">
      <div role="status" aria-live="polite" className="sr-only">
        Tablero ejecutivo cargado correctamente.
      </div>
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-blue-700">SIGD / Dashboard</p>
            <h1 className="mt-2 text-2xl font-bold md:text-3xl">Tablero Directivo Ejecutivo</h1>
          </div>
          <ReportExportModal
            reportName="dashboard-ejecutivo"
            filters={{
              fechaInicio: "2026-01-01",
              fechaFin: "2026-12-31",
              periodo: "mensual",
              diasLimite: 5,
            }}
            records={summaryMetrics.map((metric) => ({
              indicador: metric.title,
              valor: metric.value,
              unidad: metric.unit,
              delta: metric.delta,
            }))}
          />
        </header>

        <KpiMetricGrid metrics={summaryMetrics} />

        <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="trend-title">
            <div className="mb-4 flex items-center justify-between">
              <h2 id="trend-title" className="text-lg font-semibold text-slate-900">
                Tendencia de radicados y resueltos
              </h2>
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                {trend.length} periodos
              </span>
            </div>

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
    </main>
  );
}
