import type { ExecutiveSummaryMetrics } from "@/hooks/useDashboardMetrics";

interface ExecutiveKpiSummaryProps {
  metrics: ExecutiveSummaryMetrics;
}

export default function ExecutiveKpiSummary({ metrics }: ExecutiveKpiSummaryProps) {
  const growthPositive = (metrics.growth ?? 0) >= 0;
  const health = metrics.desksHealth;

  return (
    <section aria-label="Resumen ejecutivo" className="grid min-w-0 grid-cols-1 gap-3 rounded-2xl border border-blue-950 bg-gradient-to-br from-slate-950 via-blue-950 to-blue-900 p-5 text-white shadow-md shadow-blue-950/10 sm:grid-cols-2 xl:grid-cols-3">
      <article className="min-w-0 border-b border-white/15 pb-3 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-4">
        <p className="text-xs font-semibold uppercase text-slate-300">VTEP institucional</p>
        <p className="mt-2 break-words text-3xl font-bold">{metrics.conformity.toLocaleString("es-PE", { maximumFractionDigits: 1 })}%</p>
      </article>
      <article className="min-w-0 sm:border-r sm:border-white/15 sm:px-4">
        <p className="text-xs font-semibold uppercase text-slate-300">Variación mensual</p>
        <p className={`mt-2 break-words text-2xl font-bold ${metrics.growth === null ? "text-slate-300" : growthPositive ? "text-emerald-300" : "text-amber-300"}`}>
          {metrics.growth === null
            ? "Sin comparativo"
            : `${growthPositive ? "+" : ""}${metrics.growth.toLocaleString("es-PE", { maximumFractionDigits: 1 })}%`}
        </p>
      </article>
      <article className="min-w-0 sm:col-span-2 xl:col-span-1 xl:pl-4">
        <p className="text-xs font-semibold uppercase text-slate-300">Última actualización</p>
        <span className="mt-2 inline-flex max-w-full break-words rounded bg-white/10 px-2.5 py-1 text-sm font-semibold text-blue-100 ring-1 ring-white/15">
          {health}
        </span>
      </article>
    </section>
  );
}
