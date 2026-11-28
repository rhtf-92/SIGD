import {
  ETIQUETAS_TIPO_EVENTO,
  type BitacoraEventoExpediente,
  type ActuacionRutaDoc,
} from "../../types/trazabilidadExpediente";

interface TimelineItemCardProps {
  evento: BitacoraEventoExpediente | ActuacionRutaDoc;
  /** Indica si es el último nodo (más reciente) para resaltarlo visualmente. */
  esMasReciente?: boolean;
}

const formateadorFechaHora = new Intl.DateTimeFormat("es-PE", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const ORIGEN_ESTILOS: Record<string, { bg: string; text: string; label: string }> = {
  TRAMICORE: { bg: "bg-sky-50 border-sky-200", text: "text-sky-700", label: "TramiCore" },
  TESORERIA: { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", label: "Tesorería" },
  RUTADOC: { bg: "bg-indigo-50 border-indigo-200", text: "text-indigo-700", label: "RutaDoc" },
  DOCUCORE: { bg: "bg-amber-50 border-amber-200", text: "text-amber-700", label: "DocuCore" },
  CASILLA: { bg: "bg-purple-50 border-purple-200", text: "text-purple-700", label: "Casilla Electrónica" },
  CASILLA_ELECTRONICA: { bg: "bg-purple-50 border-purple-200", text: "text-purple-700", label: "Casilla Electrónica" },
  ARCHIVO_CENTRAL: { bg: "bg-teal-50 border-teal-200", text: "text-teal-700", label: "Archivo Central" },
};

export default function TimelineItemCard({
  evento,
  esMasReciente = false,
}: TimelineItemCardProps) {
  const esRutaDoc = "movimientoId" in evento || "idMovimiento" in evento;
  if (esRutaDoc) {
    const ev = evento as any;
    const fechaHoraStr = ev.fechaHora || ev.timestamp;
    const estiloOrigen = ev.origen ? ORIGEN_ESTILOS[ev.origen] ?? { bg: "bg-slate-50 border-slate-200", text: "text-slate-700", label: ev.origen } : null;

    return (
      <li className="relative pl-10">
        <span aria-hidden="true" className={`absolute left-0 top-1.5 h-5 w-5 rounded-full border-2 ${esMasReciente ? "border-blue-700 bg-blue-700" : "border-slate-300 bg-white"}`} />
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold text-slate-400">#{ev.secuencia || 1}</span>
              <h3 className="text-sm font-bold text-slate-900">{(ev.evento || "Actuación").replace(/_/g, " ")}</h3>
              {estiloOrigen && (
                <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${estiloOrigen.bg} ${estiloOrigen.text}`}>
                  {estiloOrigen.label}
                </span>
              )}
            </div>
            <time dateTime={fechaHoraStr} className="text-xs font-medium text-slate-500">
              {fechaHoraStr && Number.isFinite(Date.parse(fechaHoraStr)) ? formateadorFechaHora.format(new Date(fechaHoraStr)) : (fechaHoraStr || "Fecha no registrada")}
            </time>
          </div>
          <dl className="mt-3 grid gap-1 break-all text-xs text-slate-500 sm:grid-cols-2">
            {ev.unidadOrganica && <div><dt className="font-semibold text-slate-600">Unidad Orgánica</dt><dd>{ev.unidadOrganica}</dd></div>}
            {ev.rol && <div><dt className="font-semibold text-slate-600">Rol</dt><dd>{ev.rol}</dd></div>}
            <div><dt className="font-semibold text-slate-600">Transición</dt><dd className="font-medium text-slate-700">{ev.estadoAnterior || "INICIO"} → {ev.estadoNuevo || "REGISTRADO"}</dd></div>
            {ev.tipoActuacion && <div><dt className="font-semibold text-slate-600">Tipo de actuación</dt><dd>{ev.tipoActuacion}</dd></div>}
            {ev.remitente && <div><dt className="font-semibold text-slate-600">Remitente</dt><dd>{ev.remitente}</dd></div>}
            {ev.destinatario && <div><dt className="font-semibold text-slate-600">Destinatario</dt><dd>{ev.destinatario}</dd></div>}
            {ev.usuarioOperadorId && <div><dt className="font-semibold text-slate-600">Operador / Responsable</dt><dd className="font-mono">{ev.usuarioOperadorId}</dd></div>}
          </dl>
          {ev.observaciones && (
            <div className="mt-2.5 rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-xs text-slate-700">
              <span className="font-semibold text-slate-900">Observaciones: </span>
              {ev.observaciones}
            </div>
          )}
          {ev.proveido != null && (
            <div className="mt-2.5 rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-xs text-slate-700">
              <span className="font-semibold text-slate-900">Proveído / Detalle: </span>
              {typeof ev.proveido === "string" ? ev.proveido : JSON.stringify(ev.proveido, null, 2)}
            </div>
          )}
          {ev.datosAsociados && Object.keys(ev.datosAsociados).length > 0 && (
            <details className="mt-2 text-xs text-slate-500">
              <summary className="cursor-pointer font-medium hover:text-slate-700">Metadatos estructurados</summary>
              <pre className="mt-1 max-h-36 overflow-auto rounded bg-slate-50 p-2 whitespace-pre-wrap break-words text-[11px]">{JSON.stringify(ev.datosAsociados, null, 2)}</pre>
            </details>
          )}
        </article>
      </li>
    );
  }
  return (
    <li className="relative pl-10">
      <span
        className={`absolute left-0 top-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 ${
          esMasReciente
            ? "border-blue-700 bg-blue-700"
            : "border-slate-300 bg-white"
        }`}
        aria-hidden="true"
      />

      <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-900">
            {ETIQUETAS_TIPO_EVENTO[evento.tipoEvento]}
          </h3>
          <time
            dateTime={evento.timestamp}
            className="text-xs font-medium text-slate-500"
          >
            {evento.timestamp && Number.isFinite(Date.parse(evento.timestamp))
              ? formateadorFechaHora.format(new Date(evento.timestamp))
              : (evento.timestamp || "Fecha no registrada")}
          </time>
        </div>

        <p className="mt-1 text-sm text-slate-600">
          {evento.descripcionDetallada}
        </p>

        <dl className="mt-3 grid gap-1 text-xs text-slate-500 sm:grid-cols-2">
          <div>
            <dt className="inline font-semibold text-slate-600">Usuario: </dt>
            <dd className="inline">{evento.usuarioNombre}</dd>
          </div>
          <div>
            <dt className="inline font-semibold text-slate-600">Área: </dt>
            <dd className="inline">{evento.areaNombre}</dd>
          </div>
          {evento.estadoAnterior && (
            <div>
              <dt className="inline font-semibold text-slate-600">
                Transición:{" "}
              </dt>
              <dd className="inline">
                {evento.estadoAnterior} → {evento.estadoNuevo}
              </dd>
            </div>
          )}
          <div className="truncate" title={evento.hashTransaccion}>
            <dt className="inline font-semibold text-slate-600">
              Hash SHA-256:{" "}
            </dt>
            <dd className="inline font-mono">
              {evento.hashTransaccion?.slice(0, 16) || "—"}…
            </dd>
          </div>
        </dl>
      </article>
    </li>
  );
}
