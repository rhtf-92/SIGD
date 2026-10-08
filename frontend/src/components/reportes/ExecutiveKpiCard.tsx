import Badge, { type BadgeTone } from "@/components/ui/Badge";
import StatCard from "@/components/ui/StatCard";
import type { DashboardKpiMetric } from "@/types/dashboardEjecutivo";

interface ExecutiveKpiCardProps {
  metric: DashboardKpiMetric;
}

const statusTone: Record<DashboardKpiMetric["status"], BadgeTone> = {
  positive: "success",
  warning: "warning",
  critical: "error",
  neutral: "neutral",
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
  const tone = statusTone[metric.status];

  return (
    <StatCard
      className="min-h-[220px] focus-within:ring-2 focus-within:ring-sigd-blue"
      aria-label={`${metric.title}: ${metric.value.toFixed(1)} ${metric.unit}, variación ${metric.deltaLabel}`}
      tabIndex={0}
      label={metric.title}
      value={metric.value.toLocaleString("es-PE", { maximumFractionDigits: 1 })}
      unit={metric.unit}
      trend={
        <Badge tone={tone}>
          <span aria-hidden="true">{deltaPositive ? "▲" : "▼"}</span>
          {metric.deltaLabel}
        </Badge>
      }
      children={
        sparklinePath ? (
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="h-14 w-full rounded-xl bg-slate-50 p-1"
            aria-hidden="true"
          >
            <path d={sparklinePath} fill="none" stroke="#006ec7" strokeWidth="3" strokeLinecap="round" />
          </svg>
        ) : null
      }
      footer={
        <>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-slate-600">Δ vs. período anterior</span>
            <Badge tone={tone}>{statusLabel[metric.status]}</Badge>
          </div>
          <p className="text-sm text-slate-600">{metric.description}</p>
        </>
      }
    />
  );
}
