import { useMemo, useState } from "react";
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

  const acciones = useExpedienteActions({
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

  const unidadesDestino = useMemo(() => [
    { id: "area-dg", nombre: "Dirección General", habilitada: true },
    { id: "area-sa", nombre: "Secretaría Académica", habilitada: true },
    { id: "area-inf", nombre: "Coordinación de Informática", habilitada: true },
    { id: "area-mp", nombre: "Mesa de Partes", habilitada: true },
  ], []);

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
