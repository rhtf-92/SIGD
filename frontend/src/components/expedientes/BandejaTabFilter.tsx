import { ETIQUETAS, PESTANAS, type Bandeja, type Pestana } from "../../pages/expedientes/rutadoc/rutadoc.dto";

export default function BandejaTabFilter({
  estadoActivo,
  onCambiarEstado,
  conteos,
  estadoConteos = "disponible",
}: {
  estadoActivo: Pestana;
  onCambiarEstado: (estado: Pestana) => void;
  conteos?: Bandeja["contadores"];
  estadoConteos?: "cargando" | "error" | "disponible";
}) {
  return (
    <div
      role="tablist"
      aria-label="Pestañas de expedientes por estado"
      className="flex flex-wrap items-center gap-2 pt-1"
    >
      {PESTANAS.map((p) => {
        const esActivo = p === estadoActivo;
        const total =
          estadoConteos === "cargando"
            ? "…"
            : estadoConteos === "error"
            ? "—"
            : conteos?.[p] ?? 0;

        return (
          <button
            type="button"
            role="tab"
            key={p}
            aria-selected={esActivo}
            onClick={() => onCambiarEstado(p)}
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition border cursor-pointer ${
              esActivo
                ? "bg-blue-900 border-blue-900 text-white shadow-xs font-bold ring-2 ring-blue-900/20"
                : "bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <span>{ETIQUETAS[p]}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold font-mono transition ${
                esActivo
                  ? "bg-blue-800 text-white border border-blue-700"
                  : "bg-slate-100 text-slate-600 border border-slate-200"
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
