import type { DashboardKpiMetric } from "@/types/dashboardEjecutivo";

interface ExecutiveKpiCardProps {
  metric: DashboardKpiMetric;
}

const statusClasses: Record<DashboardKpiMetric["status"], string> = {
  positive: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  warning: "bg-amber-50 text-amber-700 ring-amber-200",
  critical: "bg-red-50 text-red-700 ring-red-200",
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
};

const statusLabel: Record<DashboardKpiMetric["status"], string> = {
  positive: "En meta",
  warning: "Atención",
  critical: "Crítico",
  neutral: "Estable",
};

function buildSparklinePath(values: number[]) {
  if (values.length === 0) {
    return "";
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * 100;
      const y = 100 - ((value - min) / range) * 100;
      return `${index === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");
}

export default function ExecutiveKpiCard({ metric }: ExecutiveKpiCardProps) {
  const sparklinePath = buildSparklinePath(metric.sparkline);
  const deltaPositive = metric.delta >= 0;

  return (
    <article
      className="flex min-h-[220px] flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100 transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md focus-within:ring-2 focus-within:ring-blue-500"
      aria-label={`${metric.title}: ${metric.value.toFixed(1)} ${metric.unit}, variación ${metric.deltaLabel}`}
      tabIndex={0}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            {metric.title}
          </p>
          <p className="mt-3 text-3xl font-bold text-slate-900" aria-live="polite">
            {metric.value.toLocaleString("es-PE", { maximumFractionDigits: 1 })}
            <span className="ml-1 text-sm font-medium text-slate-500">{metric.unit}</span>
          </p>
        </div>
        <div className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusClasses[metric.status]}`}>
          <span aria-hidden="true">{deltaPositive ? "▲" : "▼"}</span>
          {metric.deltaLabel}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-slate-600">Δ vs. período anterior</span>
        <span className={`rounded-full px-2 py-1 text-xs font-semibold ring-1 ${statusClasses[metric.status]}`}>
          {statusLabel[metric.status]}
        </span>
      </div>

      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="mt-4 h-14 w-full rounded-xl bg-slate-50 p-1"
        aria-hidden="true"
      >
        <path d={sparklinePath} fill="none" stroke="#1E40AF" strokeWidth="3" strokeLinecap="round" />
      </svg>

      <p className="mt-3 text-sm text-slate-600">{metric.description}</p>
    </article>
  );
}
