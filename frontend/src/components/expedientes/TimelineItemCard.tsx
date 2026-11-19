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

export default function TimelineItemCard({
  evento,
  esMasReciente = false,
}: TimelineItemCardProps) {
  if ("movimientoId" in evento) {
    return (
      <li className="relative pl-10">
        <span aria-hidden="true" className={`absolute left-0 top-1.5 h-5 w-5 rounded-full border-2 ${esMasReciente ? "border-blue-700 bg-blue-700" : "border-slate-300 bg-white"}`} />
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900">{evento.evento}</h3>
            <time dateTime={evento.fechaHora} className="text-xs font-medium text-slate-500">
              {Number.isFinite(Date.parse(evento.fechaHora)) ? formateadorFechaHora.format(new Date(evento.fechaHora)) : evento.fechaHora}
            </time>
          </div>
          <dl className="mt-3 grid gap-1 break-all text-xs text-slate-500 sm:grid-cols-2">
            <div><dt>ID del operador</dt><dd>{evento.usuarioOperadorId}</dd></div>
            <div><dt>Transición</dt><dd>{evento.estadoAnterior} → {evento.estadoNuevo}</dd></div>
            <div><dt>Secuencia / tipo de actuación</dt><dd>{evento.secuencia} / {evento.tipoActuacion}</dd></div>
            {evento.areaAnteriorId && <div><dt>Área anterior (ID)</dt><dd>{evento.areaAnteriorId}</dd></div>}
            {evento.areaDestinoId && <div><dt>Área destino (ID)</dt><dd>{evento.areaDestinoId}</dd></div>}
            {evento.remitente && <div><dt>Remitente</dt><dd>{evento.remitente}</dd></div>}
            {evento.destinatario && <div><dt>Destinatario</dt><dd>{evento.destinatario}</dd></div>}
          </dl>
          {evento.proveido != null && <pre className="mt-2 whitespace-pre-wrap break-words text-sm">{typeof evento.proveido === "string" ? evento.proveido : JSON.stringify(evento.proveido, null, 2)}</pre>}
          {Object.keys(evento.datosAsociados ?? {}).length > 0 && <pre className="mt-2 whitespace-pre-wrap break-words text-xs">{JSON.stringify(evento.datosAsociados, null, 2)}</pre>}
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
            {formateadorFechaHora.format(new Date(evento.timestamp))}
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
              {evento.hashTransaccion.slice(0, 16)}…
            </dd>
          </div>
        </dl>
      </article>
    </li>
  );
}
