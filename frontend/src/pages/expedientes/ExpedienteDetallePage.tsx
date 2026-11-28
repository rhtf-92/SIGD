import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

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
import { useExpedientesBase } from "../../hooks/useBandejaExpedientes";
import { useExpedienteTimeline } from "../../hooks/useExpedienteTimeline";
import { useExpedienteActions } from "../../hooks/useExpedienteActions";
import { crearServicioExpedienteActions } from "../../api/expedienteActions";
import type { DocumentoExpediente } from "../../types/ccdArchivistica";

export default function ExpedienteDetallePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [modalActivo, setModalActivo] = useState<"derivacion" | "observacion" | "acumulacion" | null>(null);

  const { data: expedientes, isLoading: cargandoExpediente, isError: errorExpediente } =
    useExpedientesBase();
  const expediente = expedientes?.find((exp) => exp.id === id);

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
    obtenerClavesAfectadas: () => [["expedientes"], ["expediente", id]],
  });

  const expedienteParaAccion = useMemo(() => {
    if (!expediente) return { id: "", codigo: "", unidadOrigenId: "" };
    return {
      id: expediente.id,
      codigo: expediente.codigoExpediente,
      unidadOrigenId: expediente.areaOrigen,
    };
  }, [expediente]);

  const UNIDADES_DESTINO_OFICIALES = useMemo(() => [
    // Órganos de Dirección
    { id: "24987bfe-5378-40ba-9c80-a7015e3a6c02", nombre: "Dirección General (ARE_DIR)", habilitada: true },
    { id: "f1e2d3c4-b5a6-4789-9012-345678900001", nombre: "Sub Dirección (ARE_SUBDIR)", habilitada: true },
    // Órgano de Recepción
    { id: "2720dcef-cc8b-440a-a43e-ff83a93266f1", nombre: "Mesa de Partes y Ventanilla (ARE_MPV)", habilitada: true },
    // Órganos de Apoyo y Asesoría
    { id: "f1e2d3c4-b5a6-4789-9012-345678900002", nombre: "Abastecimiento Administrativo (ARE_ABA)", habilitada: true },
    { id: "97f7e7b8-b519-4c0b-b880-a6246cf95e12", nombre: "Secretaría Académica (ARE_SEC)", habilitada: true },
    { id: "f1e2d3c4-b5a6-4789-9012-345678900005", nombre: "Calidad (ARE_CAL)", habilitada: true },
    { id: "79360374-edaa-4c3b-8f6e-e591711b0083", nombre: "Administración y Finanzas (ARE_ADM)", habilitada: true },
    { id: "50329bbd-6cbd-4506-affb-d6ed0d2b2dd1", nombre: "Archivo Central y Acervo Documentario (ARE_ARC)", habilitada: true },
    { id: "4fc2a68f-9eb2-496d-9c59-66a57b7d1118", nombre: "Coordinación de Sistemas e Informática (ARE_DSI)", habilitada: true },
    // Coordinaciones Generales
    { id: "f1e2d3c4-b5a6-4789-9012-345678900003", nombre: "Coordinación Académica (ARE_ACAD)", habilitada: true },
    { id: "f1e2d3c4-b5a6-4789-9012-345678900004", nombre: "Bienestar (ARE_BIE)", habilitada: true },
    { id: "f1e2d3c4-b5a6-4789-9012-345678900006", nombre: "Investigación (ARE_INV)", habilitada: true },
    // Coordinaciones de Programas de Estudio (Carreras)
    { id: "f1e2d3c4-b5a6-4789-9012-345678900011", nombre: "Coordinación de Administración de Empresas (ARE_CADM)", habilitada: true },
    { id: "f1e2d3c4-b5a6-4789-9012-345678900012", nombre: "Coordinación de Administración en Operaciones Turísticas (ARE_CTUR)", habilitada: true },
    { id: "f1e2d3c4-b5a6-4789-9012-345678900013", nombre: "Coordinación de Enfermería Técnica (ARE_CENF)", habilitada: true },
    { id: "f1e2d3c4-b5a6-4789-9012-345678900014", nombre: "Coordinación de Construcción Civil (ARE_CCON)", habilitada: true },
    { id: "f1e2d3c4-b5a6-4789-9012-345678900015", nombre: "Coordinación de Asistencia Administrativa (ARE_CASS)", habilitada: true },
    { id: "f1e2d3c4-b5a6-4789-9012-345678900016", nombre: "Coordinación de Manejo Forestal (ARE_CFOR)", habilitada: true },
    { id: "f1e2d3c4-b5a6-4789-9012-345678900017", nombre: "Coordinación de Producción Agropecuaria (ARE_CAGR)", habilitada: true },
    { id: "f1e2d3c4-b5a6-4789-9012-345678900018", nombre: "Coordinación de Electricidad Industrial (ARE_CELE)", habilitada: true },
    { id: "f1e2d3c4-b5a6-4789-9012-345678900019", nombre: "Coordinación de Contabilidad (ARE_CCONTA)", habilitada: true },
    { id: "f1e2d3c4-b5a6-4789-9012-345678900020", nombre: "Coordinación de Mecatrónica Automotriz (ARE_CAUT)", habilitada: true },
  ], []);

  const [unidadesDestino, setUnidadesDestino] = useState(UNIDADES_DESTINO_OFICIALES);

  useEffect(() => {
    let activo = true;
    import("../../api/client").then(({ apiClient }) => {
      apiClient.get<Array<{ id: string; nombre: string; sigla?: string; estado?: boolean; children?: unknown[] }>>("/api/v1/admin/organigrama")
        .then((res) => {
          if (!activo || !Array.isArray(res.data) || res.data.length === 0) return;
          const aplanar = (nodos: Array<{ id: string; nombre: string; sigla?: string; estado?: boolean; children?: unknown[] }>): Array<{ id: string; nombre: string; habilitada: boolean }> => {
            const resultado: Array<{ id: string; nombre: string; habilitada: boolean }> = [];
            for (const n of nodos) {
              if (n.id && n.nombre) {
                resultado.push({
                  id: String(n.id),
                  nombre: n.sigla ? `${n.nombre} (${n.sigla})` : n.nombre,
                  habilitada: n.estado !== false,
                });
              }
              if (Array.isArray(n.children) && n.children.length > 0) {
                resultado.push(...aplanar(n.children as any));
              }
            }
            return resultado;
          };
          const aplanadas = aplanar(res.data);
          if (aplanadas.length > 0) setUnidadesDestino(aplanadas);
        })
        .catch(() => {});
    });
    return () => { activo = false; };
  }, [UNIDADES_DESTINO_OFICIALES]);

  const documentosFoliados: DocumentoExpediente[] = useMemo(() => {
    if (!expediente || expediente.versionesDocumentos.length === 0) {
      return [
        {
          id: "doc-folio-1",
          nombre: "Expediente_Principal_Foliado.pdf",
          folios: [
            { numero: 1, pagina: 1, urlImagen: "/src/dev/folio-ejemplo.svg" },
            { numero: 2, pagina: 2, urlImagen: "/src/dev/folio-ejemplo.svg" },
          ],
        },
      ];
    }
    return expediente.versionesDocumentos.map((ver, idx) => ({
      id: ver.versionId,
      nombre: ver.nombreArchivo,
      folios: [
        {
          numero: idx + 1,
          pagina: 1,
          urlImagen: "/src/dev/folio-ejemplo.svg",
        },
      ],
    }));
  }, [expediente]);

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
                fechaIngreso={expediente.fechaIngreso}
                fechaLimiteAtencion={expediente.fechaLimiteAtencion}
              />
            )}
          </div>

          <p className="text-sm font-bold text-blue-700">SIGD · IESTP "Suiza"</p>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="break-words text-2xl font-bold">
                {expediente ? expediente.codigoExpediente : "Detalle de Expediente"}
              </h1>
              {expediente && (
                <p className="mt-1 text-sm text-slate-500">{expediente.asunto}</p>
              )}
            </div>

            {expediente && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setModalActivo("derivacion")}
                  className="rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-800 transition"
                >
                  Derivar Expediente
                </button>
                <button
                  type="button"
                  onClick={() => setModalActivo("observacion")}
                  className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition"
                >
                  Observar / Suspender
                </button>
                <button
                  type="button"
                  onClick={() => setModalActivo("acumulacion")}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Acumular
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
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
            <ExpedienteMetadatos expediente={expediente} />
            <ExpedienteClasificacion clasificacion={expediente.clasificacionCCD} />

            {/* Visor Oficial de Foliado AGN (ENT-M03-04) */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-3 mb-4">
                Visor de Foliado Continuo Oficial (F. 1 a N) — Directivas AGN
              </h2>
              <FoliadoDocumentoViewer
                recurso={{ estado: "listo", datos: documentosFoliados }}
              />
            </section>

            <ExpedienteVersiones versiones={expediente.versionesDocumentos} />

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
    </main>
  );
}
