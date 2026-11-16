import {
  ETIQUETAS_PESTANA_RUTADOC,
  PESTANAS_RUTADOC,
  type PestanaRutaDoc,
} from "../../types/expediente";

interface BandejaTabFilterProps {
  estadoActivo: PestanaRutaDoc;
  onCambiarEstado: (estado: PestanaRutaDoc) => void;
  /** Conteo de expedientes por estado, para mostrar el badge numérico de cada pestaña. */
  conteos?: Record<PestanaRutaDoc, number>;
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
      className="flex flex-wrap gap-2 border-b border-slate-200 pb-3"
    >
      {PESTANAS_RUTADOC.map((estado) => {
        const activo = estado === estadoActivo;

        return (
          <button
            key={estado}
            type="button"
            role="tab"
            aria-label={`${ETIQUETAS_PESTANA_RUTADOC[estado]} ${conteos?.[estado] ?? "—"}`}
            aria-selected={activo}
            onClick={() => onCambiarEstado(estado)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              activo
                ? "bg-blue-700 text-white shadow-sm"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {ETIQUETAS_PESTANA_RUTADOC[estado]}
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                activo ? "bg-white/20 text-white" : "bg-white text-slate-600"
              }`}
            >
              {conteos?.[estado] ?? "—"}
            </span>
          </button>
        );
      })}
    </div>
  );
}
