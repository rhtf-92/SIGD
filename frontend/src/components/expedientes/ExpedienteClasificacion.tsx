import type { ClasificacionCCD } from "../../types/expediente";
import { etiquetaExpediente } from "../../utils/expedientePresentacion";

export default function ExpedienteClasificacion({ clasificacion }: { clasificacion: ClasificacionCCD }) {
  const niveles = [
    { etiqueta: "Sección", nombre: etiquetaExpediente(clasificacion.seccion) },
    { etiqueta: "Serie", nombre: etiquetaExpediente(clasificacion.serieDocumental) },
    { etiqueta: "Subserie", nombre: clasificacion.subserieDocumental ?? "Sin subserie registrada" },
  ];
  return (
    <section aria-labelledby="ccd-titulo" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="ccd-titulo" className="text-lg font-bold text-slate-900">Clasificación Documental - CCD</h2>
          <p className="mt-1 text-sm text-slate-500">Fondo documental: {etiquetaExpediente(clasificacion.fondo)}</p>
        </div>
        <p className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-900">Código CCD: <span className="font-mono font-bold">{clasificacion.codigoSubserie ?? clasificacion.codigoSerie}</span></p>
      </div>
      <ol aria-label="Jerarquía de clasificación documental" className="mt-6 grid gap-8 sm:grid-cols-3">
        {niveles.map((nivel, indice) => (
          <li key={nivel.etiqueta} className="relative min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-700">{nivel.etiqueta}</p>
            <p className="mt-2 break-words text-sm font-semibold text-slate-800">{nivel.nombre}</p>
            {indice < niveles.length - 1 && <span aria-hidden="true" className="absolute -bottom-7 left-1/2 text-xl text-slate-400 sm:-right-6 sm:bottom-auto sm:left-auto sm:top-1/2 sm:-translate-y-1/2"><span className="sm:hidden">↓</span><span className="hidden sm:inline">→</span></span>}
          </li>
        ))}
      </ol>
    </section>
  );
}
