import Badge, { type BadgeTone } from "@/components/ui/Badge";
import StatCard from "@/components/ui/StatCard";
import type { ExecutiveSummaryMetrics } from "@/hooks/useDashboardMetrics";

interface ExecutiveKpiSummaryProps {
  metrics: ExecutiveSummaryMetrics;
}

export default function ExecutiveKpiSummary({ metrics }: ExecutiveKpiSummaryProps) {
  const growthPositive = metrics.growth >= 0;
  const health = metrics.desksHealth;
  const healthTone: BadgeTone = /operativ|normal|saludable|estable/i.test(health)
    ? "success"
    : /alert|cr[ií]tic|ca[ií]d|inciden/i.test(health)
      ? "error"
      : "warning";

  return (
    <section
      aria-label="Resumen ejecutivo"
      className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
    >
      <StatCard
        label="Conformidad institucional"
        value={`${metrics.conformity.toLocaleString("es-PE", { maximumFractionDigits: 1 })}%`}
      />
      <StatCard
        label="Crecimiento vs. mes anterior"
        value={`${growthPositive ? "+" : ""}${metrics.growth.toLocaleString("es-PE", { maximumFractionDigits: 1 })}%`}
        valueTone={growthPositive ? "positive" : "warning"}
      />
      <StatCard label="Mesas de partes" value={<Badge tone={healthTone}>{health}</Badge>} />
    </section>
  );
}
