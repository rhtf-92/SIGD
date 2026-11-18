import { ETIQUETAS, PESTANAS, type Bandeja, type Pestana } from "../../pages/expedientes/rutadoc/rutadoc.dto";
export default function BandejaTabFilter({ estadoActivo, onCambiarEstado, conteos, estadoConteos = "disponible" }: {
  estadoActivo: Pestana; onCambiarEstado: (estado: Pestana) => void; conteos?: Bandeja["contadores"];
  estadoConteos?: "cargando" | "error" | "disponible";
}) {
  return <div role="tablist" aria-label="Pestañas de expedientes" className="flex flex-wrap gap-2">
    {PESTANAS.map(p => <button type="button" role="tab" key={p}
      aria-selected={p === estadoActivo} onClick={() => onCambiarEstado(p)}
      className={`rounded border px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${p === estadoActivo
        ? "border-blue-800 bg-blue-800 font-bold text-white underline decoration-2 underline-offset-4"
        : "border-slate-400 bg-white text-slate-900 hover:bg-slate-100"}`}>
      {ETIQUETAS[p]} ({estadoConteos === "cargando" ? "Cargando…" : estadoConteos === "error" ? "No disponible" : conteos?.[p] ?? "Sin dato"})</button>)}
  </div>;
}
