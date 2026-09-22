import type { ReactNode } from "react";
import { ETIQUETAS_ESTADO_FLUJO, type ExpedienteSGD } from "../../types/expediente";
import { etiquetaExpediente, fechaExpediente, plazoExpediente } from "../../utils/expedientePresentacion";

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{etiqueta}</dt>
      <dd className="mt-1 break-words text-sm leading-6 text-slate-800">{children}</dd>
    </div>
  );
}

export default function ExpedienteMetadatos({ expediente }: { expediente: ExpedienteSGD }) {
  const { solicitante, metadatos, clasificacionCCD } = expediente;
  return (
    <section aria-labelledby="metadatos-titulo" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 id="metadatos-titulo" className="text-lg font-bold text-slate-900">Metadatos del Expediente</h2>
      <p className="mt-1 text-sm text-slate-500">Identificación, responsabilidad y plazos de atención.</p>
      <dl className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
        <Dato etiqueta="Solicitante">{solicitante.nombreOrazonSocial}</Dato>
        <Dato etiqueta="Documento de identidad">{solicitante.tipoDocumento} {solicitante.numeroDocumento}</Dato>
        <Dato etiqueta="Estado actual"><span className="inline-flex rounded-full bg-blue-50 px-3 py-0.5 font-semibold text-blue-800">{ETIQUETAS_ESTADO_FLUJO[expediente.estadoFlujo]}</span></Dato>
        <Dato etiqueta="Prioridad"><span className={`inline-flex rounded-full px-3 py-0.5 font-semibold ${expediente.prioridad === "NORMAL" ? "bg-slate-100 text-slate-700" : "bg-amber-50 text-amber-900"}`}>{etiquetaExpediente(expediente.prioridad)}</span></Dato>
        <Dato etiqueta="Área actual">{etiquetaExpediente(expediente.areaActual)}</Dato>
        <Dato etiqueta="Responsable actual">{metadatos.responsableAsignadoNombre ?? "Sin responsable asignado"}</Dato>
        <Dato etiqueta="Tipo documental">{etiquetaExpediente(metadatos.tipoDocumentoPrincipal)}</Dato>
        <Dato etiqueta="Número de folios">{expediente.cantidadFolios}</Dato>
        <Dato etiqueta="Clasificación CCD">{clasificacionCCD.codigoSubserie ?? clasificacionCCD.codigoSerie}</Dato>
        <Dato etiqueta="Fecha de ingreso"><time dateTime={expediente.fechaIngreso}>{fechaExpediente(expediente.fechaIngreso, true)}</time></Dato>
        <Dato etiqueta="Fecha límite de atención"><time dateTime={expediente.fechaLimiteAtencion}>{fechaExpediente(expediente.fechaLimiteAtencion, true)}</time></Dato>
        <Dato etiqueta="Plazo restante">
          {expediente.estadoFlujo === "ARCHIVADO" ? "Expediente archivado" : plazoExpediente(expediente.fechaLimiteAtencion)}
          <span className="block text-xs text-slate-500">Referencia en días calendario · hora de Lima</span>
        </Dato>
        <Dato etiqueta="Área de origen">{etiquetaExpediente(expediente.areaOrigen)}</Dato>
        {metadatos.canalIngreso && <Dato etiqueta="Canal de ingreso">{etiquetaExpediente(metadatos.canalIngreso)}</Dato>}
        <Dato etiqueta="Registrado por">{metadatos.creadorNombre}</Dato>
      </dl>
      {metadatos.palabrasClave.length > 0 && (
        <div className="mt-6 border-t border-slate-100 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Palabras clave</p>
          <ul aria-label="Palabras clave" className="mt-2 flex flex-wrap gap-2">
            {metadatos.palabrasClave.map((palabra) => <li key={palabra} className="rounded-md bg-slate-100 px-2.5 py-1 text-xs text-slate-700">{palabra}</li>)}
          </ul>
        </div>
      )}
    </section>
  );
}
