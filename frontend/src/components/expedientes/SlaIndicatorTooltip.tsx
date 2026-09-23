import type { ReactNode } from "react";

interface SlaIndicatorTooltipProps {
  mensaje: string;
  diasConsumidos: number;
  diasRestantes: number;
  plazoMaximo: number;
  fechaVencimiento: string;
  children: ReactNode;
}

export default function SlaIndicatorTooltip({
  mensaje,
  diasConsumidos,
  diasRestantes,
  plazoMaximo,
  fechaVencimiento,
  children,
}: SlaIndicatorTooltipProps) {
  return (
    <div className="group relative inline-flex items-center">
      {children}
      <div
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 -translate-x-1/2 whitespace-normal rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100 w-64 text-center leading-relaxed"
      >
        <p className="font-semibold text-slate-100">{mensaje}</p>
        <div className="mt-1.5 border-t border-slate-700 pt-1 text-[11px] text-slate-300">
          <p>Días hábiles consumidos: <span className="font-bold text-white">{diasConsumidos}</span> / {plazoMaximo}</p>
          <p>
            {diasRestantes >= 0
              ? `Días hábiles restantes: `
              : `Días hábiles de mora: `}
            <span
              className={`font-bold ${
                diasRestantes < 0
                  ? "text-red-400"
                  : diasRestantes <= 4
                  ? "text-rose-300"
                  : diasRestantes <= 14
                  ? "text-amber-300"
                  : "text-emerald-300"
              }`}
            >
              {Math.abs(diasRestantes)}
            </span>
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Vencimiento legal: {fechaVencimiento}</p>
        </div>
      </div>
    </div>
  );
}
