import type { AreaBottleneckRecord, AreaBottleneckRisk } from "@/hooks/useAreaBottlenecks";
import { normalizeAreaRisk } from "@/hooks/useAreaBottlenecks";

export interface AreaRetentionChartProps {
  data?: AreaBottleneckRecord[];
  isLoading?: boolean;
  isError?: boolean;
  error?: Error | null;
  emptyMessage?: string;
}

type RiskMeta = {
  icon: string;
  label: string;
  className: string;
  ariaLabel: string;
};

const riskMetaMap: Record<AreaBottleneckRisk, RiskMeta> = {
  bajo: {
    icon: "✓",
    label: "Bajo",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    ariaLabel: "Riesgo bajo: no se registran incidencias críticas",
  },
  medio: {
    icon: "⚠",
    label: "Medio",
    className: "border-amber-200 bg-amber-50 text-amber-800",
    ariaLabel: "Riesgo medio: requiere revisión",
  },
  alto: {
    icon: "✕",
    label: "Alto",
    className: "border-red-200 bg-red-50 text-red-800",
    ariaLabel: "Riesgo alto: retención crítica",
  },
};

function resolveRiskMeta(risk: AreaBottleneckRisk | string | null | undefined): RiskMeta {
  return riskMetaMap[normalizeAreaRisk(risk)] ?? riskMetaMap.medio;
}

export default function AreaRetentionChart({
  data = [],
  isLoading = false,
  isError = false,
  error,
  emptyMessage = "No se registran áreas con expedientes retenidos.",
}: AreaRetentionChartProps) {
  if (isLoading) {
    return (
      <section
        aria-live="polite"
        aria-label="Mapa de retención por áreas"
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div className="mb-4 h-5 w-40 animate-pulse rounded bg-slate-200" />
        <div className="space-y-3">
          <div className="h-12 animate-pulse rounded-xl bg-slate-200" />
          <div className="h-12 animate-pulse rounded-xl bg-slate-200" />
          <div className="h-12 animate-pulse rounded-xl bg-slate-200" />
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section
        aria-live="assertive"
        role="alert"
        className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900 shadow-sm"
      >
        <p className="font-semibold">No se pudo cargar el mapa de retención.</p>
        <p className="mt-1 text-sm text-red-700">
          {error?.message ?? "Ocurrió un error de conexión o validación."}
        </p>
      </section>
    );
  }

  if (data.length === 0) {
    return (
      <section
        className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm"
        aria-live="polite"
      >
        <div className="text-3xl" aria-hidden="true">
          —
        </div>
        <p className="mt-3 font-medium text-slate-700">{emptyMessage}</p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="area-retention-title"
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 id="area-retention-title" className="text-lg font-semibold text-slate-900">
            Mapa de calor de retención por área
          </h3>
          <p className="text-sm text-slate-600">
            Detección de áreas con expedientes retenidos por más de 5 días hábiles.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
          {data.length} áreas
        </span>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div
            role="row"
            className="grid grid-cols-[minmax(0,1.9fr)_120px_140px_120px] gap-2 border-b border-slate-200 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-600"
          >
            <div role="columnheader">Área</div>
            <div role="columnheader" className="text-right">
              Expedientes
            </div>
            <div role="columnheader" className="text-right">
              Días
            </div>
            <div role="columnheader" className="text-center">
              Riesgo
            </div>
          </div>

          <div className="mt-2 space-y-2">
            {data.map((record) => {
              const areaName =
                record.areaNombre ?? record.nombreArea ?? record.dependencia ?? record.area ?? "Área sin nombre";
              const expedientes =
                record.expedientesEstancados ?? record.expedientes ?? record.totalExpedientes ?? 0;
              const diasRetencion =
                record.diasRetencion ?? record.diasEstancados ?? record.dias ?? 0;
              const risk = resolveRiskMeta(record.riesgo ?? record.nivelRiesgo ?? "medio");
              const riskValue = normalizeAreaRisk(record.riesgo ?? record.nivelRiesgo ?? "medio");

              return (
                <div
                  key={record.id}
                  role="row"
                  tabIndex={0}
                  aria-label={`${areaName}. Tiene ${expedientes} expedientes retenidos. ${diasRetencion} días de retención. Nivel de riesgo ${risk.label}.`}
                  className="grid grid-cols-[minmax(0,1.9fr)_120px_140px_120px] gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800 shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  <div role="cell" className="font-medium text-slate-900">
                    {areaName}
                  </div>

                  <div role="cell" className="text-right font-semibold text-slate-900">
                    {expedientes}
                  </div>

                  <div role="cell" className="text-right font-semibold text-slate-900">
                    {diasRetencion}
                  </div>

                  <div
                    role="cell"
                    aria-label={risk.ariaLabel}
                    className={`inline-flex items-center justify-center gap-2 rounded-lg border px-2 py-1 text-xs font-semibold ${risk.className}`}
                  >
                    <span aria-hidden="true">{risk.icon}</span>
                    <span>{risk.label}</span>
                    <span className="sr-only">{riskValue}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
