import {
  ETIQUETAS_ESTADO_FLUJO,
  ORDEN_PESTANAS_BANDEJA,
  type EstadoFlujoExpediente,
} from "../../types/expediente";

interface BandejaTabFilterProps {
  estadoActivo: EstadoFlujoExpediente;
  onCambiarEstado: (estado: EstadoFlujoExpediente) => void;
  /** Conteo de expedientes por estado, para mostrar el badge numérico de cada pestaña. */
  conteos: Record<EstadoFlujoExpediente, number>;
}

export default function BandejaTabFilter({
  estadoActivo,
  onCambiarEstado,
  conteos,
}: BandejaTabFilterProps) {
  return (
    <div
      role="tablist"
      aria-label="Pestañas de la Bandeja Operativa de Expedientes"
      className="flex flex-wrap gap-2 border-b border-cyan-300/20 pb-3"
    >
      {ORDEN_PESTANAS_BANDEJA.map((estado) => {
        const activo = estado === estadoActivo;

        return (
          <button
            key={estado}
            type="button"
            role="tab"
            aria-selected={activo}
            onClick={() => onCambiarEstado(estado)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              activo
                ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-[0_0_20px_rgba(245,158,11,0.42)] ring-1 ring-amber-300"
                : "border border-cyan-300/25 bg-slate-950/60 text-cyan-100 shadow-[0_0_12px_rgba(34,211,238,0.08)] backdrop-blur-md hover:border-cyan-300/60 hover:bg-cyan-950/50 hover:text-cyan-50"
            }`}
          >
            {ETIQUETAS_ESTADO_FLUJO[estado]}
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                activo ? "bg-white/20 text-white" : "bg-slate-800/90 text-cyan-200"
              }`}
            >
              {conteos[estado] ?? 0}
            </span>
          </button>
        );
      })}
    </div>
  );
}
