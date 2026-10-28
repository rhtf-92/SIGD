import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { useExpedienteTimeline } from "../../hooks/useExpedienteTimeline";
import { useRutaDocDetalle } from "./rutadoc/useRutaDocDetalle";
import { useContextoTupa } from "./rutadoc/useContextoTupa";
import { rutaDoc } from "./rutadoc/rutadoc.service";
import RutaDocEstado, { FechaRutaDoc, IdentificadorRutaDoc } from "./rutadoc/RutaDocEstado";
import RutaDocTimeline from "./rutadoc/RutaDocTimeline";
import RutaDocFoliacion from "./rutadoc/RutaDocFoliacion";
import RutaDocSla from "./rutadoc/RutaDocSla";
import RutaDocTupa from "./rutadoc/RutaDocTupa";
import DerivacionModal from "../../components/expedientes/DerivacionModal";
import ObservacionModal from "../../components/expedientes/ObservacionModal";
import SubsanacionModal from "../../components/expedientes/SubsanacionModal";
import AcumulacionModal from "../../components/expedientes/AcumulacionModal";
import ExpedienteActionToast from "../../components/expedientes/ExpedienteActionToast";
import { useExpedienteActions } from "../../hooks/useExpedienteActions";
import { servicioExpedienteActionsReal } from "../../api/expedienteActions";
import { useAuthStore } from "../../stores/authStore";
import { apiClient } from "../../api/client";
import type { BusquedaExpedientes, ExpedienteAccionReferencia, UnidadDestino } from "../../types/expedienteActions";

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

  // Estados de carga bajo demanda
  const [verTrazabilidad, setVerTrazabilidad] = useState(false);
  const [verFoliacionDetallada, setVerFoliacionDetallada] = useState(false);

  // 1. Endpoint consolidado: 1 solo request HTTP (/resumen) alimenta la vista inicial
  const resumen = useQuery({
    queryKey: ["rutadoc", id, "resumen"],
    queryFn: ({ signal }) => rutaDoc.resumen(id!, signal),
    enabled: Boolean(id),
    retry: false,
  });

  const debeUsarFallback = resumen.isError || (resumen.isSuccess && !resumen.data?.expediente);
  const usaResumen = Boolean(resumen.data?.expediente);

  // Fallback transparente a endpoints granulares si /resumen falla o no contiene expediente
  const { detalle: detalleLegacy, sla: slaLegacy } = useRutaDocDetalle(
    debeUsarFallback ? id : undefined,
    { habilitarFoliacion: false }
  );

  // Foliación detallada: habilitada bajo demanda explícita (verFoliacionDetallada) o en modo fallback
  const foliacionDetallada = useQuery({
    queryKey: ["rutadoc", id, "foliacion"],
    queryFn: ({ signal }) => rutaDoc.foliacion(id!, signal),
    enabled: Boolean(id) && (debeUsarFallback || verFoliacionDetallada),
    retry: false,
  });

  const timelineQuery = useExpedienteTimeline(
    debeUsarFallback || verTrazabilidad ? id : undefined
  );
  const tupaLegacy = useContextoTupa(debeUsarFallback ? id : undefined);

  // Datos consolidados
  const detalleData = usaResumen ? resumen.data!.expediente : detalleLegacy.data;
  const isPending = usaResumen ? resumen.isPending : detalleLegacy.isPending;
  const isSuccess = Boolean(detalleData);
  const error = usaResumen ? resumen.error : detalleLegacy.error;

  const foliacionResumen = usaResumen ? resumen.data?.foliacionResumen : null;

  const usuario = useAuthStore((s) => s.usuario);
  const [modal, setModal] = useState<"derivacion" | "observacion" | "subsanacion" | "acumulacion" | null>(null);
  const puedeOperar = Boolean(usuario && ["ADMINISTRADOR", "DIRECTOR", "ESPECIALISTA", "SECRETARIO", "MESA_PARTES"].includes(usuario.rol));
  const unidadesQuery = useQuery({
    queryKey: ["organigrama", "areas-activas"],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<UnidadDestino[]>("/api/v1/organigrama/areas-activas", { signal });
      if (!Array.isArray(data)) throw new Error("Respuesta de unidades inválida.");
      return data;
    },
    enabled: puedeOperar && modal === "derivacion",
    staleTime: 60_000,
  });

  const acciones = useExpedienteActions({
    servicio: servicioExpedienteActionsReal,
    obtenerClavesAfectadas: (ids) =>
      ids.flatMap((expId) => [
        ["rutadoc", expId, "resumen"],
        ["rutadoc", expId, "detalle"],
        ["rutadoc", expId, "trazabilidad"],
        ["rutadoc", expId, "foliacion"],
        ["rutadoc", expId, "sla"],
        ["rutadoc", expId, "acumulaciones"],
        ["tramicore", expId, "tupa"],
        ["rutadoc", "bandeja"],
      ]),
  });

  const esTitular = Boolean(usuario?.idPersona && usuario.idPersona === detalleData?.solicitanteId);
  const rolSubsanacionInstitucional = Boolean(usuario && ["ADMINISTRADOR", "DIRECTOR", "MESA_PARTES"].includes(usuario.rol));
  const tienePermisoSubsanacion = esTitular || rolSubsanacionInstitucional;
  const puedeSubsanar = tienePermisoSubsanacion && detalleData?.estadoActual === "OBSERVADO";

  const refExpediente: ExpedienteAccionReferencia = {
    id: detalleData?.idExpediente ?? id ?? "",
    codigo: detalleData?.cut ?? "",
    unidadOrigenId: detalleData?.areaActualId ?? undefined,
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
      nombre: "Subsanar",
      tipo: "subsanacion" as const,
      ayuda: !tienePermisoSubsanacion
        ? "No cuenta con permisos para subsanar este expediente."
        : detalleData?.estadoActual !== "OBSERVADO"
          ? "Solo se pueden subsanar expedientes en estado OBSERVADO."
          : "Registrar la corrección de las observaciones del expediente.",
      habilitado: puedeSubsanar,
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
    <RutaDocEstado pendiente={isPending} error={error} reintentar={() => { void resumen.refetch(); void detalleLegacy.refetch(); }}>
      {detalleData && <>
        <h2>{detalleData.cut}</h2><p>{detalleData.asunto}</p>
        <dl><dt>UUID</dt><dd className="break-all font-mono text-sm">{detalleData.idExpediente}</dd>
          <dt>Estado</dt><dd>{detalleData.estadoActual}</dd>
          <dt>Radicación</dt><dd><FechaRutaDoc valor={detalleData.fechaRadicacion} /></dd>
          <dt>Área actual</dt><dd><IdentificadorRutaDoc valor={detalleData.areaActualId} /></dd>
          <dt>Solicitante UUID</dt><dd><IdentificadorRutaDoc valor={detalleData.solicitanteId} /></dd>
          <dt>Resumen documental</dt><dd>{foliacionResumen
            ? `${foliacionResumen.cantidadDocumentos} documentos, ${foliacionResumen.totalFolios} folios`
            : detalleData.resumenDocumentos
            ? `${detalleData.resumenDocumentos.cantidadDocumentos} documentos, ${detalleData.resumenDocumentos.totalFolios} folios`
            : "No disponible"}</dd></dl>
      </>}
    </RutaDocEstado>
    {isSuccess && <>
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
        unidades={unidadesQuery.isError
          ? { estado: "error", mensaje: "No se pudieron consultar las unidades vigentes." }
          : unidadesQuery.isSuccess
            ? { estado: "listo", datos: unidadesQuery.data }
            : { estado: "cargando" }}
        accion={acciones.derivacion}
      />
      <ObservacionModal
        open={modal === "observacion"}
        onClose={() => setModal(null)}
        expediente={refExpediente}
        accion={acciones.observacion}
      />
      <SubsanacionModal
        open={modal === "subsanacion" && puedeSubsanar}
        onClose={() => setModal(null)}
        expediente={refExpediente}
        accion={acciones.subsanacion}
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
      <section aria-label="Trazabilidad">
        {usaResumen ? (
          <>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold">Trazabilidad</h2>
              {!verTrazabilidad && (
                <button
                  type="button"
                  onClick={() => setVerTrazabilidad(true)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cargar trazabilidad completa
                </button>
              )}
            </div>
            {verTrazabilidad && (
              <RutaDocEstado pendiente={timelineQuery.isPending} error={timelineQuery.error} reintentar={() => { void timelineQuery.refetch(); }}>
                {timelineQuery.data && <RutaDocTimeline datos={timelineQuery.data} />}
              </RutaDocEstado>
            )}
          </>
        ) : (
          <>
            <h2>Trazabilidad</h2>
            <RutaDocEstado pendiente={timelineQuery.isPending} error={timelineQuery.error} reintentar={() => { void timelineQuery.refetch(); }}>
              {timelineQuery.data && <RutaDocTimeline datos={timelineQuery.data} />}
            </RutaDocEstado>
          </>
        )}
      </section>
      <section aria-label="Foliación">
        {usaResumen && foliacionResumen && !verFoliacionDetallada ? (
          <>
            <h2 className="text-lg font-bold">Foliación</h2>
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 space-y-2">
              <p className="font-semibold text-slate-900">
                Resumen documental: {foliacionResumen.cantidadDocumentos} documento(s), {foliacionResumen.totalFolios} folio(s) foliados.
              </p>
              <button
                type="button"
                onClick={() => setVerFoliacionDetallada(true)}
                className="text-xs font-semibold text-blue-800 underline hover:text-blue-900"
              >
                Ver desglose detallado de documentos y folios
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-2">
              <h2>Foliación</h2>
              {usaResumen && (
                <button
                  type="button"
                  onClick={() => setVerFoliacionDetallada(false)}
                  className="text-xs font-semibold text-blue-800 underline hover:text-blue-900"
                >
                  Ocultar desglose detallado
                </button>
              )}
            </div>
            <RutaDocEstado pendiente={foliacionDetallada.isPending} error={foliacionDetallada.error} reintentar={() => { void foliacionDetallada.refetch(); }}>
              {foliacionDetallada.data && <RutaDocFoliacion datos={foliacionDetallada.data} />}
            </RutaDocEstado>
          </>
        )}
      </section>
      <section aria-label="SLA">
        <h2>SLA</h2>
        {usaResumen ? (
          resumen.data?.slaResumen ? (
            <dl aria-label="SLA del backend" className="rounded border p-3">
              <dt>Estado SLA</dt><dd>{resumen.data.slaResumen.estado}</dd>
              <dt>Fecha límite</dt><dd>{resumen.data.slaResumen.fechaLimite}</dd>
              <dt>Días restantes</dt><dd>{resumen.data.slaResumen.diasHabilesRestantes}</dd>
              <dt>Porcentaje</dt><dd>{resumen.data.slaResumen.porcentaje}%</dd>
            </dl>
          ) : (
            <p className="text-sm text-slate-500">Expediente sin plazo de SLA configurado</p>
          )
        ) : (
          <RutaDocEstado pendiente={slaLegacy.isPending} error={slaLegacy.error} reintentar={() => { void slaLegacy.refetch(); }}>
            {slaLegacy.data && <RutaDocSla datos={slaLegacy.data} />}
          </RutaDocEstado>
        )}
      </section>
      <section aria-label="Contexto TUPA">
        <h2>Contexto TUPA</h2>
        {usaResumen ? (
          resumen.data?.tupaResumen ? (
            <dl aria-label="Contexto TUPA del expediente" className="rounded border p-3">
              <dt>Código</dt>
              <dd>{resumen.data.tupaResumen.codigo || <span>No disponible</span>}</dd>
              <dt>Denominación</dt>
              <dd>{resumen.data.tupaResumen.denominacion}</dd>
              <dt>Clasificación</dt>
              <dd>{resumen.data.tupaResumen.clasificacion}</dd>
              <dt>Plazo (días hábiles)</dt>
              <dd>{resumen.data.tupaResumen.plazoDias}</dd>
              <dt>Costo</dt>
              <dd>{resumen.data.tupaResumen.costo > 0 ? `S/ ${resumen.data.tupaResumen.costo.toFixed(2)}` : "Gratuito"}</dd>
            </dl>
          ) : (
            <p>Expediente sin procedimiento TUPA vinculado</p>
          )
        ) : (
          <RutaDocEstado pendiente={tupaLegacy.isPending} error={tupaLegacy.error} reintentar={() => { void tupaLegacy.refetch(); }}>
            {tupaLegacy.data && (tupaLegacy.data.tupa === null
              ? <p>Expediente sin procedimiento TUPA vinculado</p>
              : <RutaDocTupa datos={tupaLegacy.data.tupa} />)}
          </RutaDocEstado>
        )}
      </section>
    </>}
  </main>;
}
