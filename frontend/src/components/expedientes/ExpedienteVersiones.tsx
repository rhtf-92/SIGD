import type { VersionDocumento } from "../../types/expediente";
import { fechaExpediente } from "../../utils/expedientePresentacion";

export default function ExpedienteVersiones({ versiones }: { versiones: readonly VersionDocumento[] }) {
  const ordenadas = [...versiones].sort((a, b) => b.numeroVersion - a.numeroVersion);
  return (
    <section aria-labelledby="versiones-titulo" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 id="versiones-titulo" className="text-lg font-bold text-slate-900">Control de Versiones</h2>
      <p className="mt-1 text-sm text-slate-500">Historial documental de solo lectura. Cada versión conserva su registro de integridad.</p>
      {ordenadas.length === 0 ? <p className="mt-5 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">No hay versiones documentales registradas.</p> : (
        <ol aria-label="Historial de versiones documentales" className="mt-5 space-y-4">
          {ordenadas.map((version) => (
            <li key={version.versionId} className={`min-w-0 rounded-lg border p-4 ${version.estado === "VIGENTE" ? "border-blue-200 bg-blue-50/50" : "border-slate-200 bg-white"}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="font-bold text-slate-900">Versión {version.versionId.replace(/^v/, "")}</h3>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${version.estado === "VIGENTE" ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-600"}`}>{version.estado === "VIGENTE" ? "Vigente" : "Histórica"}</span>
                </div>
                <time dateTime={version.fechaRegistro} className="text-xs text-slate-500">{fechaExpediente(version.fechaRegistro, true)} · Lima</time>
              </div>
              <p className="mt-3 break-words text-sm font-medium text-slate-800">{version.nombreArchivo}</p>
              <p className="mt-1 text-sm text-slate-600"><span className="font-semibold">Responsable: </span>{version.autorCambioNombre}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600"><span className="font-semibold">Cambio: </span>{version.motivoModificacion}</p>
              <details className="mt-3 text-xs text-slate-600">
                <summary className="w-fit cursor-pointer rounded font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700">Hash SHA-256 · {version.hashIntegridad.slice(0, 16)}…</summary>
                <code className="mt-2 block break-all rounded bg-slate-100 p-3 text-slate-700">{version.hashIntegridad}</code>
              </details>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
