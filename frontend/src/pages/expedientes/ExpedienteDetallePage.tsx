import { useId, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useExpedienteTimeline } from "../../hooks/useExpedienteTimeline";
import { useRutaDocDetalle } from "./rutadoc/useRutaDocDetalle";
import { useContextoTupa } from "./rutadoc/useContextoTupa";
import RutaDocEstado, { FechaRutaDoc, IdentificadorRutaDoc } from "./rutadoc/RutaDocEstado";
import RutaDocTimeline from "./rutadoc/RutaDocTimeline";
import RutaDocFoliacion from "./rutadoc/RutaDocFoliacion";
import RutaDocSla from "./rutadoc/RutaDocSla";
import RutaDocTupa from "./rutadoc/RutaDocTupa";
import DerivacionModal from "../../components/expedientes/DerivacionModal";
import ObservacionModal from "../../components/expedientes/ObservacionModal";
import AcumulacionModal from "../../components/expedientes/AcumulacionModal";
import ExpedienteActionToast from "../../components/expedientes/ExpedienteActionToast";
import { useExpedienteActions } from "../../hooks/useExpedienteActions";
import { servicioExpedienteActionsReal } from "../../api/expedienteActions";
import { useAuthStore } from "../../stores/authStore";
import type { BusquedaExpedientes, ExpedienteAccionReferencia, UnidadDestino } from "../../types/expedienteActions";

const UNIDADES_ORGANICAS_DEFAULT: readonly UnidadDestino[] = [
  { id: "a0000000-0000-0000-0000-000000000001", nombre: "Subdirección Académica", habilitada: true },
  { id: "a0000000-0000-0000-0000-000000000002", nombre: "Dirección General", habilitada: true },
  { id: "a0000000-0000-0000-0000-000000000003", nombre: "Mesa de Partes", habilitada: true },
  { id: "a0000000-0000-0000-0000-000000000004", nombre: "Secretaría Académica", habilitada: true },
  { id: "a0000000-0000-0000-0000-000000000005", nombre: "Coordinación DSI", habilitada: true },
  { id: "destino-prueba", nombre: "Unidad de Prueba", habilitada: true },
];

const busquedaConexos: BusquedaExpedientes = {
  buscar: async (texto: string, signal: AbortSignal) => {
    try {
      const { apiClient } = await import("../../api/client");
      const res = await apiClient.get<{ elementos?: Array<{ idExpediente: string; cut: string }> }>(
        "/api/v1/expedientes",
        { params: { terminoBusqueda: texto, limite: 10, pestana: "EN_TRAMITE" }, signal }
      );
      return (res.data?.elementos ?? []).map((e) => ({ id: e.idExpediente, codigo: e.cut }));
    } catch {
      return [];
    }
  },
};

export default function ExpedienteDetallePage() {
  const disponibilidadId = useId();
  const { id } = useParams<{ id: string }>();
  const { detalle, foliacion, sla } = useRutaDocDetalle(id);
  const timeline = useExpedienteTimeline(id);
  const tupa = useContextoTupa(id);
  const usuario = useAuthStore((s) => s.usuario);
  const [modal, setModal] = useState<"derivacion" | "observacion" | "acumulacion" | null>(null);

  const acciones = useExpedienteActions({
    servicio: servicioExpedienteActionsReal,
    obtenerClavesAfectadas: (ids) =>
      ids.flatMap((expId) => [
        ["rutadoc", expId, "detalle"],
        ["rutadoc", expId, "trazabilidad"],
        ["rutadoc", expId, "foliacion"],
        ["rutadoc", expId, "sla"],
        ["rutadoc", expId, "acumulaciones"],
        ["tramicore", expId, "tupa"],
        ["rutadoc", "bandeja"],
      ]),
  });

  const puedeOperar = usuario ? usuario.rol !== "ESTUDIANTE" : true;

  const refExpediente: ExpedienteAccionReferencia = {
    id: detalle.data?.idExpediente ?? id ?? "",
    codigo: detalle.data?.cut ?? "",
    unidadOrigenId: detalle.data?.areaActualId ?? undefined,
  };

  const accionesDisponibles = [
    {
      nombre: "Derivar",
      tipo: "derivacion" as const,
      ayuda: puedeOperar
        ? "Derivar el expediente hacia otra unidad orgánica."
        : "No cuenta con permisos para derivar este expediente.",
      habilitado: puedeOperar,
    },
    {
      nombre: "Observar",
      tipo: "observacion" as const,
      ayuda: puedeOperar
        ? "Registrar pliego de observaciones para el administrado."
        : "No cuenta con permisos para observar este expediente.",
      habilitado: puedeOperar,
    },
    {
      nombre: "Acumular",
      tipo: "acumulacion" as const,
      ayuda: puedeOperar
        ? "Acumular expedientes conexos bajo el expediente principal (Art. 160 LPAG)."
        : "No cuenta con permisos para acumular este expediente.",
      habilitado: puedeOperar,
    },
  ];

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
          {accionesDisponibles.map((accion, indice) => (
            <div key={accion.nombre}>
              <button
                type="button"
                disabled={!accion.habilitado}
                aria-describedby={`${disponibilidadId}-${indice}`}
                onClick={() => setModal(accion.tipo)}
                className={`rounded-lg border px-4 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 ${
                  accion.habilitado
                    ? "border-blue-800 bg-blue-800 text-white hover:bg-blue-900 focus-visible:outline-blue-700"
                    : "border-slate-300 bg-slate-100 text-slate-500 disabled:cursor-not-allowed"
                }`}
              >
                {accion.nombre}
              </button>
              <p id={`${disponibilidadId}-${indice}`} className="mt-2 text-sm text-slate-600">
                {accion.ayuda}
              </p>
            </div>
          ))}
        </div>
      </section>
      <ExpedienteActionToast notificacion={acciones.notificacion} onClose={acciones.limpiarNotificacion} />
      <DerivacionModal
        open={modal === "derivacion"}
        onClose={() => setModal(null)}
        expediente={refExpediente}
        unidades={{ estado: "listo", datos: UNIDADES_ORGANICAS_DEFAULT }}
        accion={acciones.derivacion}
      />
      <ObservacionModal
        open={modal === "observacion"}
        onClose={() => setModal(null)}
        expediente={refExpediente}
        accion={acciones.observacion}
      />
      <AcumulacionModal
        open={modal === "acumulacion"}
        onClose={() => setModal(null)}
        expediente={refExpediente}
        accion={acciones.acumulacion}
        busqueda={busquedaConexos}
      />
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
