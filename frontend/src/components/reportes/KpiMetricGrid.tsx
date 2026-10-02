import ExecutiveKpiCard from "./ExecutiveKpiCard";
import type { DashboardKpiMetric } from "@/types/dashboardEjecutivo";

interface KpiMetricGridProps {
  metrics: DashboardKpiMetric[];
}

export default function KpiMetricGrid({ metrics }: KpiMetricGridProps) {
  return (
    <section aria-live="polite" aria-label="Métricas ejecutivas principales" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <ExecutiveKpiCard key={metric.id} metric={metric} />
      ))}
    </section>
  );
}
