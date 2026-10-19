import { useId } from "react";
import { Link, useParams } from "react-router-dom";
import { useExpedienteTimeline } from "../../hooks/useExpedienteTimeline";
import { useRutaDocDetalle } from "./rutadoc/useRutaDocDetalle";
import { useContextoTupa } from "./rutadoc/useContextoTupa";
import RutaDocEstado, { FechaRutaDoc, IdentificadorRutaDoc } from "./rutadoc/RutaDocEstado";
import RutaDocTimeline from "./rutadoc/RutaDocTimeline";
import RutaDocFoliacion from "./rutadoc/RutaDocFoliacion";
import RutaDocSla from "./rutadoc/RutaDocSla";
import RutaDocTupa from "./rutadoc/RutaDocTupa";

export default function ExpedienteDetallePage() {
  const disponibilidadId = useId();
  const { id } = useParams<{ id: string }>();
  const { detalle, foliacion, sla } = useRutaDocDetalle(id);
  const timeline = useExpedienteTimeline(id);
  const tupa = useContextoTupa(id);
  return <main className="mx-auto max-w-5xl space-y-6 p-6">
    <Link to="/expedientes" className="rounded text-blue-800 underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">Volver a la bandeja</Link>
    <h1 className="text-2xl font-bold">Detalle de expediente</h1>
    <RutaDocEstado pendiente={detalle.isPending} error={detalle.error} reintentar={() => { void detalle.refetch(); }}>
      {detalle.data && <>
        <h2>{detalle.data.cut}</h2><p>{detalle.data.asunto}</p>
        <dl><dt>UUID</dt><dd className="break-all font-mono text-sm">{detalle.data.idExpediente}</dd>
          <dt>Estado</dt><dd>{detalle.data.estadoActual}</dd>
          <dt>Radicación</dt><dd><FechaRutaDoc valor={detalle.data.fechaRadicacion} /></dd>
          <dt>Área actual</dt><dd><IdentificadorRutaDoc valor={detalle.data.areaActualId} /></dd>
          <dt>Solicitante UUID</dt><dd><IdentificadorRutaDoc valor={detalle.data.solicitanteId} /></dd>
          <dt>Resumen documental</dt><dd>{detalle.data.resumenDocumentos
            ? `${detalle.data.resumenDocumentos.cantidadDocumentos} documentos, ${detalle.data.resumenDocumentos.totalFolios} folios`
            : "No disponible"}</dd></dl>
      </>}
    </RutaDocEstado>
    {detalle.isSuccess && <>
      <section aria-label="Acciones del expediente" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold">Acciones del expediente</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {[
            { nombre: "Derivar", ayuda: "El envío del expediente a otra área no está disponible por el momento." },
            { nombre: "Observar", ayuda: "El registro de observaciones no está disponible por el momento." },
            { nombre: "Acumular", ayuda: "La acumulación de expedientes no está disponible por el momento." },
          ].map((accion, indice) => <div key={accion.nombre}>
            <button type="button" disabled aria-describedby={`${disponibilidadId}-${indice}`}
              className="rounded-lg border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-500 disabled:cursor-not-allowed">
              {accion.nombre}
            </button>
            <p id={`${disponibilidadId}-${indice}`} className="mt-2 text-sm text-slate-600">{accion.ayuda}</p>
          </div>)}
        </div>
      </section>
      <section aria-label="Clasificación CCD" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold">Clasificación CCD</h2>
        <p className="mt-2 text-sm text-slate-600">La consulta de clasificación documental no está disponible por el momento.</p>
      </section>
      <section aria-label="Versiones documentales" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold">Versiones documentales</h2>
        <p className="mt-2 text-sm text-slate-600">La consulta del historial de versiones documentales no está disponible por el momento.</p>
      </section>
      <section aria-label="Trazabilidad"><h2>Trazabilidad</h2>
        <RutaDocEstado pendiente={timeline.isPending} error={timeline.error} reintentar={() => { void timeline.refetch(); }}>
          {timeline.data && <RutaDocTimeline datos={timeline.data} />}
        </RutaDocEstado></section>
      <section aria-label="Foliación"><h2>Foliación</h2>
        <RutaDocEstado pendiente={foliacion.isPending} error={foliacion.error} reintentar={() => { void foliacion.refetch(); }}>
          {foliacion.data && <RutaDocFoliacion datos={foliacion.data} />}
        </RutaDocEstado></section>
      <section aria-label="SLA"><h2>SLA</h2>
        <RutaDocEstado pendiente={sla.isPending} error={sla.error} reintentar={() => { void sla.refetch(); }}>
          {sla.data && <RutaDocSla datos={sla.data} />}
        </RutaDocEstado></section>
      <section aria-label="Contexto TUPA"><h2>Contexto TUPA</h2>
        <RutaDocEstado pendiente={tupa.isPending} error={tupa.error} reintentar={() => { void tupa.refetch(); }}>
          {tupa.data && (tupa.data.tupa === null
            ? <p>Expediente sin procedimiento TUPA vinculado</p>
            : <RutaDocTupa datos={tupa.data.tupa} />)}
        </RutaDocEstado></section>
    </>}
  </main>;
}
