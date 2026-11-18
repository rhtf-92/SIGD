import {
  ETIQUETAS_ESTADO_FLUJO,
  ORDEN_PESTANAS_BANDEJA,
  type EstadoFlujoExpediente,
} from "../../types/expediente";

export interface BandejaTabsProps {
  estadoActivo: EstadoFlujoExpediente;
  onCambiarEstado: (estado: EstadoFlujoExpediente) => void;
  conteos: Record<EstadoFlujoExpediente, number>;
}

export function BandejaTabs({
  estadoActivo,
  onCambiarEstado,
  conteos,
}: BandejaTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Pestañas de la Bandeja Operativa de Expedientes"
      className="flex flex-wrap gap-2 border-b border-slate-200 pb-3"
    >
      {ORDEN_PESTANAS_BANDEJA.map((estado) => {
        const activo = estado === estadoActivo;
        const total = conteos[estado] ?? 0;

        return (
          <button
            key={estado}
            type="button"
            role="tab"
            id={`tab-${estado.toLowerCase()}`}
            aria-selected={activo}
            aria-controls={`panel-${estado.toLowerCase()}`}
            onClick={() => onCambiarEstado(estado)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              activo
                ? "bg-blue-700 text-white shadow-sm"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <span>{ETIQUETAS_ESTADO_FLUJO[estado] ?? estado}</span>
            <span
              data-testid={`badge-${estado.toLowerCase()}`}
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                activo
                  ? "bg-white text-blue-800"
                  : "bg-slate-200 text-slate-700"
              }`}
            >
              {total}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default BandejaTabs;
