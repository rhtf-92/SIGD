import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import ExpedienteTimeline from "../../components/expedientes/ExpedienteTimeline";
import DerivacionModal from "../../components/expedientes/DerivacionModal";
import ObservacionModal from "../../components/expedientes/ObservacionModal";
import ExpedienteActionToast from "../../components/expedientes/ExpedienteActionToast";
import SlaBadge from "../../components/expedientes/SlaBadge";
import { useExpedienteTimeline } from "../../hooks/useExpedienteTimeline";
import { useExpedienteActions } from "../../hooks/useExpedienteActions";
import { crearServicioExpedienteActions } from "../../api/expedienteActions";
import { apiClient } from "../../api/client";
import type { EstadoRecurso } from "../../types/ccdArchivistica";
import type { UnidadDestino } from "../../types/expedienteActions";

interface ExpedienteDetalleApi {
  idExpediente: string;
  cut: string;
  asunto: string;
  fechaRadicacion: string;
  estadoActual: string;
  areaActualId: string | null;
  solicitanteNombre: string | null;
  totalFolios: number;
  codigoSerie: string | null;
  nombreSerie: string | null;
  solicitanteId: string | null;
  resumenDocumentos: { cantidadDocumentos: number; totalFolios: number } | null;
}

interface FolioApi {
  idDocumento: string;
  nombre: string | null;
  tipo: string | null;
  folioInicio: number;
  folioFin: number;
  cantidadFolios: number;
  rango: string;
  checksumSha256: string | null;
  urlOriginal: string | null;
}

export default function ExpedienteDetallePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [modalActivo, setModalActivo] = useState<"derivacion" | "observacion" | "acumulacion" | null>(null);
  const [resumenAtencion, setResumenAtencion] = useState("");
  const [estante, setEstante] = useState("");
  const [balda, setBalda] = useState("");
  const [caja, setCaja] = useState("");
  const [serieSeleccionada, setSerieSeleccionada] = useState("");
  const [mensajeOperacion, setMensajeOperacion] = useState<string | null>(null);

  const expedienteQuery = useQuery({
    queryKey: ["expedientes", id],
    enabled: Boolean(id),
    queryFn: async () => (await apiClient.get<ExpedienteDetalleApi>(`/api/v1/expedientes/${id}`)).data,
    staleTime: 0,
    refetchInterval: 15_000,
  });
  const expediente = expedienteQuery.data;

  const { data: eventos, isLoading: cargandoTimeline, isError: errorTimeline } =
    useExpedienteTimeline(id);
  const foliosQuery = useQuery({
    queryKey: ["expedientes", id, "foliacion"],
    enabled: Boolean(id),
    queryFn: async () => (await apiClient.get<FolioApi[]>(`/api/v1/expedientes/${id}/foliacion`)).data,
    staleTime: 0,
    refetchInterval: 15 * 60_000,
  });
  const areasQuery = useQuery({
    queryKey: ["areas", "vigentes"],
    queryFn: async () => (await apiClient.get<{ unidades: Array<{ id: string; nombre: string }> }>("/api/v1/areas"))
      .data.unidades.map((unidad) => ({ ...unidad, habilitada: true })),
    staleTime: 5 * 60_000,
  });
  const catalogoCcdQuery = useQuery({
    queryKey: ["expedientes", "clasificador-ccd"],
    queryFn: async () => (await apiClient.get<{ elementos: Array<{ codigo: string; nombre: string; tipo: string }> }>(
      "/api/v1/expedientes/clasificador-ccd",
    )).data.elementos,
    staleTime: 5 * 60_000,
  });

  const servicioExpediente = useMemo(
    () =>
      crearServicioExpedienteActions({
        derivacion: {
          construirPayload: (entrada) => ({
            destinos: [{ area_destino_id: entrada.unidadDestinoId, es_copia: false }],
            proveido: entrada.proveido || "Derivación de expediente",
          }),
        },
        observacion: {
          construirPayload: (entrada) => ({
            motivo: entrada.motivo,
            observacion: entrada.motivo,
          }),
        },
        acumulacion: async (entrada) => {
          const { apiClient } = await import("../../api/client");
          await apiClient.post(`/api/v1/expedientes/${entrada.principal.id}/acumular`, {
            expedientesConexos: entrada.conexos.map((c) => c.id),
            motivo: entrada.motivo,
          });
        },
      }),
    [],
  );

  const acciones = useExpedienteActions({
    servicio: servicioExpediente,
    obtenerClavesAfectadas: () => [["expedientes"]],
  });

  const expedienteParaAccion = useMemo(() => {
    if (!expediente) return { id: "", codigo: "", unidadOrigenId: "" };
    return {
      id: expediente.idExpediente,
      codigo: expediente.cut,
      unidadOrigenId: expediente.areaActualId ?? "",
    };
  }, [expediente]);

  const unidadesDestino: EstadoRecurso<readonly UnidadDestino[]> = areasQuery.isLoading
    ? { estado: "cargando" }
    : areasQuery.isError
      ? { estado: "error", mensaje: "No se pudieron cargar las áreas vigentes." }
      : { estado: "listo", datos: areasQuery.data ?? [] };
  const documentos = foliosQuery.data ?? [];

  async function actualizarVistas() {
    await queryClient.invalidateQueries({ queryKey: ["expedientes"] });
  }

  const recepcionar = useMutation({
    mutationFn: async () => apiClient.post(`/api/v1/expedientes/${id}/recepcionar`, {}),
    onSuccess: async () => {
      setMensajeOperacion("Recepción registrada y agregada a la trazabilidad.");
      await actualizarVistas();
    },
  });
  const atender = useMutation({
    mutationFn: async () => apiClient.post<{ notificadoCasilla: boolean }>(
      `/api/v1/expedientes/${id}/atender`, { resultado_resumen: resumenAtencion.trim() },
    ),
    onSuccess: async ({ data }) => {
      setMensajeOperacion(data.notificadoCasilla
        ? "Respuesta registrada y notificación encolada para la Casilla Electrónica del ciudadano."
        : "Respuesta registrada. El solicitante no tiene una cuenta activa para recibirla en Casilla.");
      setResumenAtencion("");
      await actualizarVistas();
    },
  });
  const archivar = useMutation({
    mutationFn: async () => apiClient.post(`/api/v1/expedientes/${id}/archivar`, {
      estante: estante.trim(), balda: balda.trim(), caja: caja.trim(),
    }),
    onSuccess: async () => {
      setMensajeOperacion("Archivo registrado en la trazabilidad.");
      setEstante("");
      setBalda("");
      setCaja("");
      await actualizarVistas();
    },
  });
  const clasificar = useMutation({
    mutationFn: async () => apiClient.put(`/api/v1/expedientes/${id}/clasificacion-ccd`, {
      codigoSerie: serieSeleccionada || expediente?.codigoSerie,
    }),
    onSuccess: async () => {
      setMensajeOperacion("Clasificación CCD guardada.");
      setSerieSeleccionada("");
      await actualizarVistas();
    },
  });

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-5">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate("/expedientes")}
              className="mb-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              ← Volver a la Bandeja
            </button>
            {expediente && (
              <SlaBadge
                fechaIngreso={expediente.fechaRadicacion}
              />
            )}
          </div>

          <p className="text-sm font-bold text-blue-700">SIGD · IESTP "Suiza"</p>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="break-words text-2xl font-bold">
                {expediente ? expediente.cut : "Detalle de Expediente"}
              </h1>
              {expediente && (
                <p className="mt-1 text-sm text-slate-500">{expediente.asunto}</p>
              )}
            </div>

            {expediente && (
              <div className="flex items-center gap-2">
                {["REGISTRADO", "DERIVADO"].includes(expediente.estadoActual) && (
                  <button type="button" disabled={recepcionar.isPending}
                    onClick={() => recepcionar.mutate()}
                    className="rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:opacity-50">
                    {recepcionar.isPending ? "Recepcionando…" : expediente.estadoActual === "DERIVADO" ? "Recepcionar derivación" : "Recepcionar trámite"}
                  </button>
                )}
                {["EN_CALIFICACION", "EN_REVISION"].includes(expediente.estadoActual) && <>
                  <button type="button" onClick={() => setModalActivo("derivacion")}
                    className="rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-800">
                    Derivar
                  </button>
                  <button type="button" onClick={() => setModalActivo("observacion")}
                    className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 transition hover:bg-amber-100">
                    Observar
                  </button>
                </>}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        {expedienteQuery.isLoading && (
          <p className="text-sm text-slate-500">Cargando expediente…</p>
        )}

        {expedienteQuery.isError && (
          <p role="alert" className="rounded-xl border border-red-200 bg-white p-6 text-sm text-red-800">
            No se pudo cargar el expediente. Verifica tu acceso al área e inténtalo nuevamente.
          </p>
        )}

        {!expedienteQuery.isLoading && !expedienteQuery.isError && !expediente && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            No se encontró el expediente solicitado.
          </p>
        )}

        {expediente && (
          <>
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-bold uppercase text-slate-400">Estado actual</p>
                <p className="mt-1 font-semibold">{expediente.estadoActual}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-bold uppercase text-slate-400">Solicitante</p>
                <p className="mt-1 font-semibold">{expediente.solicitanteNombre ?? "No identificado"}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-bold uppercase text-slate-400">Área responsable</p>
                <p className="mt-1 break-all text-sm">{expediente.areaActualId ?? "Sin área asignada"}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-bold uppercase text-slate-400">Foliación</p>
                <p className="mt-1 font-semibold">{expediente.totalFolios} folios</p>
              </div>
            </section>

            <form className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-end"
              onSubmit={(event) => { event.preventDefault(); clasificar.mutate(); }}>
              <div className="min-w-0 flex-1">
                <label htmlFor="clasificacion-ccd" className="text-sm font-semibold">Serie CCD</label>
                <select id="clasificacion-ccd"
                  value={serieSeleccionada || expediente.codigoSerie || ""}
                  onChange={(event) => setSerieSeleccionada(event.target.value)}
                  disabled={catalogoCcdQuery.isLoading || clasificar.isPending}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                  <option value="">Sin clasificar</option>
                  {(catalogoCcdQuery.data ?? []).filter((item) => item.tipo === "SERIE").map((serie) => (
                    <option key={serie.codigo} value={serie.codigo}>{serie.nombre} ({serie.codigo})</option>
                  ))}
                </select>
              </div>
              <button type="submit" disabled={clasificar.isPending || !serieSeleccionada || serieSeleccionada === expediente.codigoSerie}
                className="rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50 disabled:opacity-50">
                {clasificar.isPending ? "Guardando…" : "Guardar clasificación"}
              </button>
              {catalogoCcdQuery.isError && <p role="alert" className="text-sm text-red-700">No se pudo cargar el catálogo CCD.</p>}
              {clasificar.isError && <p role="alert" className="text-sm text-red-700">No se pudo guardar la clasificación.</p>}
            </form>

            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Documentos adjuntos</h2>
                  <p className="mt-1 text-sm text-slate-500">Documentos y rangos de foliación registrados.</p>
                </div>
                <SlaBadge fechaIngreso={expediente.fechaRadicacion} />
              </div>
              {foliosQuery.isLoading ? <p role="status" className="text-sm text-slate-500">Cargando documentos…</p> : null}
              {foliosQuery.isError ? <p role="alert" className="text-sm text-red-700">No se pudieron cargar los documentos.</p> : null}
              {!foliosQuery.isLoading && !foliosQuery.isError && documentos.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                  No hay documentos foliados vinculados a este expediente.
                </p>
              ) : null}
              <ul className="divide-y divide-slate-100">
                {documentos.map((documento) => (
                  <li key={documento.idDocumento} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold text-slate-800">
                        {documento.nombre ?? `Documento ${documento.idDocumento}`}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {documento.tipo ?? "Tipo no registrado"} · {documento.rango} · {documento.cantidadFolios} folios
                      </p>
                      {documento.checksumSha256 && <p className="mt-1 break-all font-mono text-[0.65rem] text-slate-400">SHA-256 {documento.checksumSha256}</p>}
                    </div>
                    {documento.urlOriginal ? (
                      <a href={documento.urlOriginal} target="_blank" rel="noopener noreferrer"
                        className="inline-flex shrink-0 items-center justify-center rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-50">
                        Abrir documento
                      </a>
                    ) : <span className="text-xs text-slate-500">Archivo no disponible</span>}
                  </li>
                ))}
              </ul>
            </section>

            {errorTimeline ? (
              <p role="alert" className="rounded-xl border border-red-200 bg-white p-6 text-sm text-red-800">
                No se pudo cargar la Hoja de Ruta y Trazabilidad.
              </p>
            ) : (
              <ExpedienteTimeline eventos={eventos ?? []} cargando={cargandoTimeline} />
            )}

            {/* Modales de Acciones Procesales */}
            <DerivacionModal
              open={modalActivo === "derivacion"}
              onClose={() => setModalActivo(null)}
              expediente={expedienteParaAccion}
              unidades={unidadesDestino}
              accion={acciones.derivacion}
            />

            <ObservacionModal
              open={modalActivo === "observacion"}
              onClose={() => setModalActivo(null)}
              expediente={expedienteParaAccion}
              accion={acciones.observacion}
            />

            <ExpedienteActionToast
              notificacion={acciones.notificacion}
              onClose={acciones.limpiarNotificacion}
            />
            {mensajeOperacion && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{mensajeOperacion}</p>}
            {recepcionar.isError && <p role="alert" className="text-sm text-red-700">No se pudo recepcionar el expediente.</p>}
            {atender.isError && <p role="alert" className="text-sm text-red-700">No se pudo registrar la respuesta.</p>}
            {archivar.isError && <p role="alert" className="text-sm text-red-700">No se pudo archivar el expediente.</p>}

            {expediente.estadoActual === "EN_FIRMA" && <form className="rounded-xl border border-emerald-200 bg-white p-5" onSubmit={(event) => { event.preventDefault(); atender.mutate(); }}>
              <h2 className="text-base font-bold">Registrar respuesta y notificar</h2>
              <label className="mt-3 block text-sm font-medium" htmlFor="resumen-respuesta">Resumen de la respuesta</label>
              <textarea id="resumen-respuesta" value={resumenAtencion} onChange={(event) => setResumenAtencion(event.target.value)} required minLength={1} className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm" />
              <button type="submit" disabled={atender.isPending || !resumenAtencion.trim()} className="mt-3 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">
                {atender.isPending ? "Registrando…" : "Emitir respuesta y enviar a Casilla"}
              </button>
            </form>}

            {expediente.estadoActual === "RESUELTO" && <form className="rounded-xl border border-slate-200 bg-white p-5" onSubmit={(event) => { event.preventDefault(); archivar.mutate(); }}>
              <h2 className="text-base font-bold">Archivar expediente</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <label className="text-sm">Estante<input value={estante} onChange={(event) => setEstante(event.target.value)} required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
                <label className="text-sm">Balda<input value={balda} onChange={(event) => setBalda(event.target.value)} required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
                <label className="text-sm">Caja<input value={caja} onChange={(event) => setCaja(event.target.value)} required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
              </div>
              <button type="submit" disabled={archivar.isPending || !estante.trim() || !balda.trim() || !caja.trim()} className="mt-3 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                {archivar.isPending ? "Archivando…" : "Confirmar archivo"}
              </button>
            </form>}
          </>
        )}
      </div>
    </main>
  );
}
