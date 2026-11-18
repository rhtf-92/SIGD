import type { ExecutiveSummaryMetrics } from "@/hooks/useDashboardMetrics";

interface ExecutiveKpiSummaryProps {
  metrics: ExecutiveSummaryMetrics;
}

export default function ExecutiveKpiSummary({ metrics }: ExecutiveKpiSummaryProps) {
  const growthPositive = metrics.growth >= 0;
  const health = metrics.desksHealth;
  const healthTone = /operativ|normal|saludable|estable/i.test(health)
    ? "bg-emerald-50 text-emerald-800"
    : /alert|cr[ií]tic|ca[ií]d|inciden/i.test(health)
      ? "bg-red-50 text-red-800"
      : "bg-amber-50 text-amber-800";

  return (
    <section aria-label="Resumen ejecutivo" className="grid min-w-0 grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-900 p-4 text-white sm:grid-cols-2 xl:grid-cols-3">
      <article className="min-w-0 border-b border-white/15 pb-3 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-4">
        <p className="text-xs font-semibold uppercase text-slate-300">Conformidad institucional</p>
        <p className="mt-2 break-words text-3xl font-bold">{metrics.conformity.toLocaleString("es-PE", { maximumFractionDigits: 1 })}%</p>
      </article>
      <article className="min-w-0 sm:border-r sm:border-white/15 sm:px-4">
        <p className="text-xs font-semibold uppercase text-slate-300">Crecimiento vs. mes anterior</p>
        <p className={`mt-2 break-words text-2xl font-bold ${growthPositive ? "text-emerald-300" : "text-amber-300"}`}>
          {growthPositive ? "+" : ""}{metrics.growth.toLocaleString("es-PE", { maximumFractionDigits: 1 })}%
        </p>
      </article>
      <article className="min-w-0 sm:col-span-2 xl:col-span-1 xl:pl-4">
        <p className="text-xs font-semibold uppercase text-slate-300">Mesas de partes</p>
        <span className={`mt-2 inline-flex max-w-full break-words rounded px-2.5 py-1 text-sm font-semibold ${healthTone}`}>
          {health}
        </span>
      </article>
    </section>
  );
}
