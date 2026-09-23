import { useMemo } from "react";

import type { AreaCuelloBotellaDTO } from "../../types/dashboardEjecutivo";

export interface BottleNeckHeatmapProps {
  data: AreaCuelloBotellaDTO[];
  title?: string;
  description?: string;
}

type HeatmapState = "ok" | "warning" | "critical";

interface HeatmapCellDescriptor {
  key: string;
  label: string;
  value: number | string;
  state: HeatmapState;
  icon: string;
}

const statePalette: Record<
  HeatmapState,
  {
    icon: string;
    badgeClassName: string;
    cellClassName: string;
    label: string;
  }
> = {
  ok: {
    icon: "✓",
    badgeClassName: "bg-emerald-100 text-emerald-900 border-emerald-300",
    cellClassName: "bg-emerald-50 text-emerald-900 border-emerald-300",
    label: "Normal",
  },
  warning: {
    icon: "⚠",
    badgeClassName: "bg-amber-100 text-amber-900 border-amber-300",
    cellClassName: "bg-amber-50 text-amber-900 border-amber-300",
    label: "Advertencia",
  },
  critical: {
    icon: "✕",
    badgeClassName: "bg-red-100 text-red-900 border-red-300",
    cellClassName: "bg-red-50 text-red-900 border-red-300",
    label: "Crítico",
  },
};

function normalizeAlertState(value: string | number | undefined): HeatmapState {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (["ok", "normal", "bajo", "low", "estable"].includes(normalized)) {
    return "ok";
  }

  if (["warning", "advertencia", "medio", "moderado", "atencion"].includes(normalized)) {
    return "warning";
  }

  if (["critical", "critico", "alto", "alarm", "riesgo"].includes(normalized)) {
    return "critical";
  }

  const numericValue = Number(value ?? 0);

  if (Number.isFinite(numericValue) && numericValue >= 5) {
    return "critical";
  }

  if (Number.isFinite(numericValue) && numericValue >= 3) {
    return "warning";
  }

  return "ok";
}

function formatAlertText(value: string | number | undefined): string {
  const normalized = String(value ?? "").trim();

  if (!normalized) {
    return "Sin alerta";
  }

  return normalized;
}

export default function BottleNeckHeatmap({
  data,
  title = "Mapa de calor de cuellos de botella",
  description = "Índice de retención por dependencia y nivel de riesgo institucional.",
}: BottleNeckHeatmapProps) {
  const rows = useMemo(() => {
    return data.map((item) => {
      const estancados = Number(item.estancados ?? item.expedientesEstancados ?? 0);
      const diasRetencion = Number(item.diasRetencion ?? item.dias ?? 0);
      const alertState = normalizeAlertState(
        item.nivelAlerta ?? item.nivel ?? item.riesgo ?? "normal",
      );

      const cells: HeatmapCellDescriptor[] = [
        {
          key: "diasRetencion",
          label: "Días",
          value: diasRetencion,
          state: diasRetencion >= 5 ? "critical" : diasRetencion >= 3 ? "warning" : "ok",
          icon: diasRetencion >= 5 ? "✕" : diasRetencion >= 3 ? "⚠" : "✓",
        },
        {
          key: "estancados",
          label: "Estancados",
          value: estancados,
          state: estancados >= 5 ? "critical" : estancados >= 3 ? "warning" : "ok",
          icon: estancados >= 5 ? "✕" : estancados >= 3 ? "⚠" : "✓",
        },
        {
          key: "alerta",
          label: "Estado",
          value: formatAlertText(item.nivelAlerta ?? item.nivel ?? "normal"),
          state: alertState,
          icon: statePalette[alertState].icon,
        },
      ];

      return {
        ...item,
        estancados,
        diasRetencion,
        alertState,
        cells,
      };
    });
  }, [data]);

  const totalCriticos = rows.filter((row) => row.alertState === "critical").length;
  const totalAdvertencias = rows.filter((row) => row.alertState === "warning").length;

  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      aria-labelledby="bottleneck-heatmap-title"
      aria-live="polite"
    >
      <header className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2
            id="bottleneck-heatmap-title"
            className="text-lg font-semibold text-slate-900"
          >
            {title}
          </h2>
          <p className="text-sm text-slate-600">{description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-700">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-emerald-900">
            <span aria-hidden="true">✓</span>
            {rows.length > 0 ? `${rows.filter((row) => row.alertState === "ok").length} ok` : "0 ok"}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-amber-900">
            <span aria-hidden="true">⚠</span>
            {totalAdvertencias} atención
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-red-300 bg-red-50 px-2.5 py-1 text-red-900">
            <span aria-hidden="true">✕</span>
            {totalCriticos} críticos
          </span>
        </div>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
          No hay cuellos de botella registrados para el período consultado.
        </div>
      ) : (
        <div
          className="overflow-x-auto"
          role="grid"
          aria-label="Mapa de calor de cuellos de botella por dependencia"
        >
          <div className="min-w-[640px]">
            <div
              className="grid grid-cols-[minmax(170px,1.6fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(120px,1fr)] gap-2 border-b border-slate-200 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-600"
              role="row"
            >
              <div role="columnheader">Dependencia</div>
              <div role="columnheader">Días</div>
              <div role="columnheader">Estancados</div>
              <div role="columnheader">Estado</div>
            </div>

            <div className="mt-2 space-y-2" role="rowgroup">
              {rows.map((row) => (
                <div
                  key={row.areaId}
                  className="grid grid-cols-[minmax(170px,1.6fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(120px,1fr)] gap-2"
                  role="row"
                >
                  <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800" role="cell">
                    {row.nombreArea || row.area || `Área ${row.areaId}`}
                  </div>

                  {row.cells.map((cell) => {
                    const palette = statePalette[cell.state];
                    const ariaLabel = `${row.nombreArea || row.area || `Área ${row.areaId}`} ${cell.label}: ${String(cell.value)} ${palette.label}`;

                    return (
                      <div
                        key={`${row.areaId}-${cell.key}`}
                        className={`flex items-center justify-between rounded-xl border px-2.5 py-2 text-sm font-medium ${palette.cellClassName}`}
                        role="cell"
                        aria-label={ariaLabel}
                        title={ariaLabel}
                      >
                        <span className="font-semibold" aria-hidden="true">
                          {cell.icon}
                        </span>
                        <span>{String(cell.value)}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
