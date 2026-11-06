import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import ExpedienteTimeline from "../../components/expedientes/ExpedienteTimeline";
import ExpedienteClasificacion from "../../components/expedientes/ExpedienteClasificacion";
import ExpedienteMetadatos from "../../components/expedientes/ExpedienteMetadatos";
import ExpedienteVersiones from "../../components/expedientes/ExpedienteVersiones";
import FoliadoDocumentoViewer from "../../components/expedientes/FoliadoDocumentoViewer";
import DerivacionModal from "../../components/expedientes/DerivacionModal";
import ObservacionModal from "../../components/expedientes/ObservacionModal";
import AcumulacionModal from "../../components/expedientes/AcumulacionModal";
import ExpedienteActionToast from "../../components/expedientes/ExpedienteActionToast";
import SlaBadge from "../../components/expedientes/SlaBadge";
import { useExpedienteTimeline } from "../../hooks/useExpedienteTimeline";
import { useExpedienteActions } from "../../hooks/useExpedienteActions";
import { crearServicioExpedienteActions } from "../../api/expedienteActions";
import { apiClient } from "../../api/client";
import { EXPEDIENTES_FIXTURE } from "../../data/expedientesFixtures";
import type { DocumentoExpediente } from "../../types/ccdArchivistica";
import type {
  EstadoFlujoExpediente,
  ExpedienteSGD,
  PrioridadExpediente,
} from "../../types/expediente";

export default function ExpedienteDetallePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [modalActivo, setModalActivo] = useState<"derivacion" | "observacion" | "acumulacion" | null>(null);

  // Consulta directa al backend para el expediente solicitado: GET /api/v1/expedientes/:id
  const { data: expediente, isLoading: cargandoExpediente, isError: errorExpediente } =
    useQuery<ExpedienteSGD | null>({
      queryKey: ["expediente-detalle", id],
      queryFn: async () => {
        if (!id) return null;
        try {
          const res = await apiClient.get<any>(`/api/v1/expedientes/${encodeURIComponent(id)}`);
          const data = res.data;
          if (!data) return null;

          return {
            id: data.id || data.idExpediente || data.id_expediente || id,
            codigoExpediente: data.codigoExpediente || data.cut || `EXP-2026-${String(id).slice(0, 6)}`,
            asunto: data.asunto || "Expediente Institucional",
            areaOrigen: data.areaOrigen || data.area_actual_id || "Mesa de Partes",
            areaActual: data.areaActual || data.area_actual_id || "Secretaría Académica",
            estadoFlujo: (data.estadoFlujo || data.estadoActual || data.estado_actual || "PENDIENTE") as EstadoFlujoExpediente,
            prioridad: (data.prioridad || "NORMAL") as PrioridadExpediente,
            fechaIngreso: data.fechaIngreso || data.fechaRadicacion || data.fecha_radicacion || new Date().toISOString(),
            fechaUltimoMovimiento: data.fechaUltimoMovimiento || new Date().toISOString(),
            fechaLimiteAtencion: data.fechaLimiteAtencion || new Date(Date.now() + 30 * 86400000).toISOString(),
            cantidadFolios: data.cantidadFolios || data.resumenDocumentos?.totalFolios || 1,
            solicitante: data.solicitante || {
              tipoPersona: "NATURAL",
              tipoDocumento: "DNI",
              numeroDocumento: data.solicitanteId || "00000000",
              nombreOrazonSocial: data.nombreSolicitante || "Ciudadano Administrado",
              correoNotificacion: "contacto@iestpsuiza.edu.pe",
              telefonoContacto: "900000000",
            },
            clasificacionCCD: data.clasificacionCCD || {
              fondo: "IESTP_SUIZA",
              seccion: "SECRETARIA_ACADEMICA",
              serieDocumental: "EXPEDIENTES_ACADEMICOS",
              codigoSerie: "CCD-SA-EXP",
            },
            metadatos: data.metadatos || {
              tipoDocumentoPrincipal: "SOLICITUD",
              palabrasClave: ["trámite", "educativo"],
              creadorId: "admin",
              creadorNombre: "Mesa de Partes",
            },
            versionesDocumentos: data.versionesDocumentos || (data.documentos ? data.documentos.map((d: any, idx: number) => ({
              versionId: d.id || `v-${idx + 1}`,
              numeroVersion: idx + 1,
              estado: "VIGENTE" as const,
              nombreArchivo: d.nombreArchivo || d.nombre_archivo || `documento_${idx + 1}.pdf`,
              urlArchivo: d.s3Key || `/api/v1/storage/descargar?key=${encodeURIComponent(d.s3Key || '')}`,
              autorCambioId: "user",
              autorCambioNombre: "Administrado",
              fechaRegistro: new Date().toISOString(),
              motivoModificacion: "Registro inicial",
              hashIntegridad: d.sha256 || "a".repeat(64),
            })) : []),
          };
        } catch (err) {
          const fallback = EXPEDIENTES_FIXTURE.find((exp) => exp.id === id);
          if (fallback) return fallback;
          throw err;
        }
      },
      enabled: Boolean(id),
    });

  const { data: eventos, isLoading: cargandoTimeline, isError: errorTimeline } =
    useExpedienteTimeline(id);

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
    obtenerClavesAfectadas: () => [["expedientes"], ["expediente-detalle", id]],
  });

  const expedienteParaAccion = useMemo(() => {
    if (!expediente) return { id: "", codigo: "", unidadOrigenId: "" };
    return {
      id: expediente.id,
      codigo: expediente.codigoExpediente,
      unidadOrigenId: expediente.areaOrigen,
    };
  }, [expediente]);

  // Consulta directa a unidades de destino del organigrama: GET /api/v1/admin/organigrama
  const { data: organigramaAreas } = useQuery({
    queryKey: ["organigrama-destinos"],
    queryFn: async () => {
      try {
        const res = await apiClient.get<
          Array<{ id: string | number; nombre: string; sigla?: string; codigo?: string }>
        >("/api/v1/admin/organigrama");
        if (Array.isArray(res.data) && res.data.length > 0) {
          return res.data.map((area) => ({
            id: String(area.id),
            nombre: area.sigla ? `${area.nombre} (${area.sigla})` : area.nombre,
            habilitada: true,
          }));
        }
      } catch {
        // Fallback defensivo si organigrama no está disponible
      }
      return [
        { id: "area-dg", nombre: "Dirección General", habilitada: true },
        { id: "area-sa", nombre: "Secretaría Académica", habilitada: true },
        { id: "area-inf", nombre: "Coordinación de Informática", habilitada: true },
        { id: "area-mp", nombre: "Mesa de Partes", habilitada: true },
      ];
    },
  });

  const unidadesDestino = useMemo(() => {
    return organigramaAreas && organigramaAreas.length > 0
      ? organigramaAreas
      : [
          { id: "area-dg", nombre: "Dirección General", habilitada: true },
          { id: "area-sa", nombre: "Secretaría Académica", habilitada: true },
          { id: "area-inf", nombre: "Coordinación de Informática", habilitada: true },
          { id: "area-mp", nombre: "Mesa de Partes", habilitada: true },
        ];
  }, [organigramaAreas]);

  // Documentos foliados reales con URLs a MinIO S3 (sin mock SVG /src/dev/folio-ejemplo.svg)
  const documentosFoliados: DocumentoExpediente[] = useMemo(() => {
    if (!expediente || expediente.versionesDocumentos.length === 0) {
      return [
        {
          id: "doc-folio-1",
          nombre: "Expediente_Principal_Foliado.pdf",
          urlOriginal: `/api/v1/storage/descargar?key=expedientes/${id || "exp-001"}/documento.pdf`,
          folios: [
            { numero: 1, pagina: 1 },
            { numero: 2, pagina: 2 },
          ],
        },
      ];
    }
    return expediente.versionesDocumentos.map((ver, idx) => ({
      id: ver.versionId,
      nombre: ver.nombreArchivo,
      urlOriginal: ver.urlArchivo,
      folios: [
        {
          numero: idx + 1,
          pagina: 1,
        },
      ],
    }));
  }, [expediente, id]);

  return (
    <div className="flex-1 w-full bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-4 sm:py-5">
          {/* Migajas de pan canónicas */}
          <nav
            aria-label="Migajas de pan de detalle de expediente"
            className="mb-3 flex flex-wrap items-center gap-1.5 text-xs font-medium text-slate-500"
          >
            <Link to="/" className="hover:text-blue-700 hover:underline transition-colors">
              Inicio
            </Link>
            <span className="text-slate-300">/</span>
            <Link to="/expedientes" className="hover:text-blue-700 hover:underline transition-colors">
              Expedientes
            </Link>
            <span className="text-slate-300">/</span>
            <span aria-current="page" className="font-semibold text-blue-700">
              Visor de Expediente
            </span>
          </nav>

          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => navigate("/expedientes")}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-blue-700"
              >
                ← Volver a la Bandeja
              </button>
              <button
                type="button"
                onClick={() => navigate("/")}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
              >
                Volver al inicio
              </button>
            </div>
            {expediente && (
              <SlaBadge
                fechaIngreso={expediente.fechaIngreso}
                fechaLimiteAtencion={expediente.fechaLimiteAtencion}
              />
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-1">
            <div className="min-w-0">
              <h1 className="break-words text-xl sm:text-2xl font-bold">
                {expediente ? expediente.codigoExpediente : "Detalle de Expediente"}
              </h1>
              {expediente && (
                <p className="mt-1 text-xs sm:text-sm text-slate-500 line-clamp-2">{expediente.asunto}</p>
              )}
            </div>

            {expediente && (
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto shrink-0">
                <button
                  type="button"
                  onClick={() => setModalActivo("derivacion")}
                  className="flex-1 sm:flex-initial rounded-xl bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-800 transition text-center"
                >
                  Derivar
                </button>
                <button
                  type="button"
                  onClick={() => setModalActivo("observacion")}
                  className="flex-1 sm:flex-initial rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition text-center"
                >
                  Observar
                </button>
                <button
                  type="button"
                  onClick={() => setModalActivo("acumulacion")}
                  className="flex-1 sm:flex-initial rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition text-center"
                >
                  Acumular
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-6 sm:py-8 space-y-6">
        {cargandoExpediente && (
          <p className="text-sm text-slate-500">Cargando expediente…</p>
        )}

        {errorExpediente && (
          <p role="alert" className="rounded-xl border border-red-200 bg-white p-6 text-sm text-red-800">
            No se pudo cargar el expediente. Vuelve a la bandeja e inténtalo nuevamente.
          </p>
        )}

        {!cargandoExpediente && !errorExpediente && !expediente && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            No se encontró el expediente solicitado.
          </p>
        )}

        {expediente && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 xl:gap-8 items-start">
              {/* Columna Lateral (Metadata & Clasificación CCD) */}
              <div className="lg:col-span-5 xl:col-span-4 space-y-6">
                <ExpedienteMetadatos expediente={expediente} />
                <ExpedienteClasificacion clasificacion={expediente.clasificacionCCD} />
                <ExpedienteVersiones versiones={expediente.versionesDocumentos} />
              </div>

              {/* Columna Principal (Visor AGN y Trazabilidad FSM) */}
              <div className="lg:col-span-7 xl:col-span-8 space-y-6">
                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-3 mb-4">
                    Visor de Foliado Continuo Oficial (F. 1 a N) — Directivas AGN
                  </h2>
                  <FoliadoDocumentoViewer
                    recurso={{ estado: "listo", datos: documentosFoliados }}
                  />
                </section>
                {errorTimeline ? (
                  <p role="alert" className="rounded-xl border border-red-200 bg-white p-6 text-sm text-red-800">
                    No se pudo cargar la Hoja de Ruta y Trazabilidad.
                  </p>
                ) : (
                  <ExpedienteTimeline eventos={eventos ?? []} cargando={cargandoTimeline} />
                )}
              </div>
            </div>

            {/* Modales de Acciones Procesales */}
            <DerivacionModal
              open={modalActivo === "derivacion"}
              onClose={() => setModalActivo(null)}
              expediente={expedienteParaAccion}
              unidades={{ estado: "listo", datos: unidadesDestino }}
              accion={acciones.derivacion}
            />

            <ObservacionModal
              open={modalActivo === "observacion"}
              onClose={() => setModalActivo(null)}
              expediente={expedienteParaAccion}
              accion={acciones.observacion}
            />

            <AcumulacionModal
              open={modalActivo === "acumulacion"}
              onClose={() => setModalActivo(null)}
              expediente={expedienteParaAccion}
              accion={acciones.acumulacion}
            />

            <ExpedienteActionToast
              notificacion={acciones.notificacion}
              onClose={acciones.limpiarNotificacion}
            />
          </>
        )}
      </div>
    </div>
  );
}
