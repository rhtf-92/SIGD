import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { ExpedienteDetalleRutaDoc, ResolucionInfoRutaDoc } from "../../types/expediente";

export interface DespachoResolutivoSeccionProps {
  expediente: ExpedienteDetalleRutaDoc;
  resolucion?: ResolucionInfoRutaDoc | null;
  puedeResolver: boolean;
  esFirmanteAutorizado: boolean;
  onElevarAFirma?: (resumen?: string) => Promise<void>;
  cargandoAccion?: boolean;
}

export function DespachoResolutivoSeccion({
  expediente,
  resolucion: resolucionProp,
  puedeResolver,
  esFirmanteAutorizado,
  onElevarAFirma,
  cargandoAccion = false,
}: DespachoResolutivoSeccionProps) {
  const navigate = useNavigate();
  const [confirmandoElevacion, setConfirmandoElevacion] = useState(false);
  const [resumenElevacion, setResumenElevacion] = useState("");
  const [ejecutandoElevacion, setEjecutandoElevacion] = useState(false);

  // La resolución puede provenir directamente del detalle o de la prop
  const resolucion = resolucionProp !== undefined ? resolucionProp : expediente.resolucionInfo;

  if (expediente.tipoTramiteCodigo === "SUZ26-006" && !resolucion) {
    return null;
  }

  const estadoResolucion = resolucion?.estado?.toUpperCase() || "";
  const esFirmada = estadoResolucion === "FIRMADA";
  const esEnFirma = estadoResolucion === "EN_FIRMA" || expediente.estadoActual === "EN_FIRMA";
  const esBorrador = estadoResolucion === "BORRADOR_PENDIENTE_FIRMA" || estadoResolucion === "BORRADOR";

  const formatearTipo = (tipo?: string | null) => {
    if (!tipo) return "Resolución Directoral";
    switch (tipo) {
      case "DIRECTORAL_TITULACION":
        return "Resolución Directoral de Titulación";
      case "DIRECTORAL_CONVALIDACION":
        return "Resolución Directoral de Convalidación";
      case "DIRECTORAL_ADMINISTRATIVA":
        return "Resolución Directoral Administrativa";
      default:
        return tipo.replace(/_/g, " ");
    }
  };

  const handleConfirmarElevacion = async () => {
    if (!onElevarAFirma) return;
    setEjecutandoElevacion(true);
    try {
      await onElevarAFirma(resumenElevacion.trim() || undefined);
      setConfirmandoElevacion(false);
    } finally {
      setEjecutandoElevacion(false);
    }
  };

  // Buscar documento PDF asociado a la resolución en el expediente
  const docPdfResolucion = expediente.documentos?.find(
    (d) =>
      d.mimeType === "application/pdf" &&
      (d.nombre.toUpperCase().startsWith("RD-") ||
        (resolucion?.numeroBorrador && d.nombre.includes(resolucion.numeroBorrador)) ||
        (resolucion?.numeroResolucion && d.nombre.includes(resolucion.numeroResolucion)))
  );

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby="seccion-despacho-resolutivo">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 id="seccion-despacho-resolutivo" className="text-base font-bold text-slate-900">
              Despacho Resolutivo y Validez Legal
            </h2>
            {esFirmada && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                Firmada Digitalmente
              </span>
            )}
            {esEnFirma && !esFirmada && (
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 border border-indigo-200">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                En Despacho para Firma
              </span>
            )}
            {esBorrador && !esEnFirma && !esFirmada && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                Borrador Pendiente de Firma
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Ciclo de vida resolutivo institucional, suscripción digital PAdES (LFE N° 27269) y verificación CVD.
          </p>
        </div>

        {/* Acciones principales de cabecera */}
        <div className="flex flex-wrap items-center gap-2">
          {!resolucion && puedeResolver && ["EN_REVISION", "EN_CALIFICACION", "RECEPCIONADO", "ATENDIDO"].includes(expediente.estadoActual) && (
            <Link
              to={`/flujos/proyector-resoluciones?expedienteId=${encodeURIComponent(expediente.idExpediente)}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-800 transition"
            >
              + Proyectar Resolución Directoral
            </Link>
          )}

          {resolucion && esBorrador && puedeResolver && (
            <Link
              to={`/flujos/proyector-resoluciones?id=${encodeURIComponent(resolucion.resolucionId)}&expedienteId=${encodeURIComponent(expediente.idExpediente)}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition"
            >
              Editar Proyecto de Resolución
            </Link>
          )}

          {resolucion && esEnFirma && esFirmanteAutorizado && (
            <Link
              to="/flujo-validez-legal/firma"
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition"
            >
              Ir a Pasarela de Firma Refirma →
            </Link>
          )}

          {resolucion && esFirmada && resolucion.cvd && (
            <Link
              to={`/validador-cvd`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition"
            >
              Verificar Autenticidad CVD
            </Link>
          )}
        </div>
      </div>

      {/* Caso 1: Expediente sin proyecto de resolución */}
      {!resolucion && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 mb-2">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-slate-800">Sin Resolución Directoral Proyectada</h3>
          <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
            Este expediente aún no cuenta con un acto resolutivo en DocuCore. Al concluir la calificación técnica, el operador responsable puede proyectar la resolución correspondiente.
          </p>
          {puedeResolver && (
            <div className="mt-4">
              <Link
                to={`/flujos/proyector-resoluciones?expedienteId=${encodeURIComponent(expediente.idExpediente)}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-800 transition"
              >
                + Proyectar Resolución Directoral Ahora
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Caso 2: Expediente con proyecto de resolución */}
      {resolucion && (
        <div className="space-y-4">
          {/* Banner de estado */}
          {esFirmada && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs text-emerald-900 flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-emerald-200 p-1 text-emerald-800">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-bold">Resolución Directoral Oficial Suscrita con Firma Digital</p>
                <p className="mt-0.5 text-emerald-800">
                  El presente acto administrativo cuenta con firma digital avanzada / cualificada (PAdES-B-LTA), sello de tiempo oficial y plena validez legal conforme a la Ley N° 27269. Documento inmutable.
                </p>
              </div>
            </div>
          )}

          {esEnFirma && !esFirmada && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-4 text-xs text-indigo-900 flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-indigo-200 p-1 text-indigo-800">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-bold">Expediente en Despacho de Dirección General</p>
                <p className="mt-0.5 text-indigo-800">
                  El expediente y su proyecto resolutivo han sido formalmente elevados a Despacho para su suscripción digital por el Director General. La edición técnica se encuentra bloqueada por seguridad procesal.
                </p>
              </div>
            </div>
          )}

          {esBorrador && !esEnFirma && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900 flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-amber-200 p-1 text-amber-800">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-bold">Proyecto de Resolución en Revisión Técnica</p>
                <p className="mt-0.5 text-amber-800">
                  El borrador puede ser editado y actualizado las veces que sea necesario. Una vez validada la conformidad técnica y normativa, el operador debe elevarlo a Despacho para su firma digital.
                </p>
              </div>
            </div>
          )}

          {/* Grilla de metadatos resolutivos */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
              <span className="text-slate-400 font-medium block">Tipo de Resolución</span>
              <span className="font-bold text-slate-800 mt-1 block">
                {formatearTipo(resolucion.tipoResolucion)}
              </span>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
              <span className="text-slate-400 font-medium block">
                {esFirmada ? "Número de Resolución Oficial" : "Identificador de Borrador"}
              </span>
              <span className="font-mono font-bold text-blue-800 mt-1 block">
                {esFirmada
                  ? (resolucion.numeroResolucion || resolucion.numeroBorrador)
                  : resolucion.numeroBorrador}
              </span>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
              <span className="text-slate-400 font-medium block">Fecha de Proyección</span>
              <span className="font-semibold text-slate-700 mt-1 block">
                {resolucion.fechaProyeccion || "—"}
              </span>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
              <span className="text-slate-400 font-medium block">
                {esFirmada ? "Fecha de Suscripción Digital" : "Estado del Acto"}
              </span>
              <span className="font-semibold text-slate-700 mt-1 block">
                {esFirmada && resolucion.firmadoEn
                  ? new Date(resolucion.firmadoEn).toLocaleString("es-PE")
                  : resolucion.estado}
              </span>
            </div>
          </div>

          {/* Fila secundaria: Asunto y Firmante */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="md:col-span-2 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
              <span className="text-slate-400 font-medium block">Asunto / Síntesis Resolutiva</span>
              <p className="font-medium text-slate-800 mt-1 line-clamp-2">
                {resolucion.asunto || "Sin síntesis especificada."}
              </p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
              <span className="text-slate-400 font-medium block">Autoridad / Firmante</span>
              <span className="font-semibold text-slate-800 mt-1 block">
                {resolucion.firmanteNombre || "Dirección General (Titular de la Entidad)"}
              </span>
            </div>
          </div>

          {/* Bloque de Evidencia Criptográfica (Solo si está FIRMADA) */}
          {esFirmada && (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3.5 text-xs space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                  Evidencia de Firma y Validez Legal
                </span>
                {resolucion.cvd && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500 font-medium">CVD:</span>
                    <span className="font-mono font-bold text-blue-700 bg-white px-2 py-0.5 rounded border border-blue-200">
                      {resolucion.cvd}
                    </span>
                    <Link
                      to={`/validador-cvd`}
                      className="text-[11px] font-semibold text-blue-700 hover:underline"
                    >
                      Validar →
                    </Link>
                  </div>
                )}
              </div>

              {resolucion.hashPades && (
                <div className="text-[11px] text-slate-600 flex items-center gap-1 font-mono bg-white/80 p-1.5 rounded border border-emerald-200/60 overflow-hidden">
                  <span className="font-semibold text-slate-500 shrink-0">SHA-256 (PAdES):</span>
                  <span className="truncate" title={resolucion.hashPades}>{resolucion.hashPades}</span>
                </div>
              )}
            </div>
          )}

          {/* Actuaciones y elevación de ciclo de vida */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
            <div className="flex flex-wrap items-center gap-2">
              {docPdfResolucion && (
                <span className="text-xs font-medium text-slate-500">
                  Documento adjunto oficial: <strong className="text-slate-700">{docPdfResolucion.nombre}</strong> (Folios {docPdfResolucion.folioInicio} a {docPdfResolucion.folioFin})
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Botón Elevar a Despacho para Firma */}
              {esBorrador && puedeResolver && (
                <>
                  {!confirmandoElevacion ? (
                    <button
                      type="button"
                      onClick={() => setConfirmandoElevacion(true)}
                      disabled={cargandoAccion}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 transition"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                      </svg>
                      Elevar a Despacho para Firma
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 bg-indigo-50 p-2 rounded-lg border border-indigo-200 text-xs">
                      <input
                        type="text"
                        placeholder="Resumen o justificación del pase (opcional)..."
                        value={resumenElevacion}
                        onChange={(e) => setResumenElevacion(e.target.value)}
                        className="rounded border border-indigo-300 px-2 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={handleConfirmarElevacion}
                        disabled={ejecutandoElevacion}
                        className="rounded bg-indigo-600 px-2.5 py-1 font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {ejecutandoElevacion ? "Elevando..." : "Confirmar Elevación"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmandoElevacion(false)}
                        className="rounded bg-slate-200 px-2 py-1 font-semibold text-slate-700 hover:bg-slate-300"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* Botón de acceso a Refirma para Director */}
              {esEnFirma && esFirmanteAutorizado && (
                <button
                  type="button"
                  onClick={() => navigate("/flujo-validez-legal/firma")}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition"
                >
                  Firmar Digitalmente en Refirma →
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
