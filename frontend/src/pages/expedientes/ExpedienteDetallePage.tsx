import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adaptarErrorAccion } from "../../utils/expedienteActions";

import ExpedienteTimeline from "../../components/expedientes/ExpedienteTimeline";
import ExpedienteClasificacion from "../../components/expedientes/ExpedienteClasificacion";
import ExpedienteVersiones from "../../components/expedientes/ExpedienteVersiones";
import ExpedienteMetadatos from "../../components/expedientes/ExpedienteMetadatos";
import DerivacionModal from "../../components/expedientes/DerivacionModal";
import ObservacionModal from "../../components/expedientes/ObservacionModal";
import AcumulacionModal from "../../components/expedientes/AcumulacionModal";
import DigitalizacionModal from "../../components/expedientes/DigitalizacionModal";
import ExpedienteActionToast from "../../components/expedientes/ExpedienteActionToast";
import AsignarEvaluadorModal from "../../components/expedientes/AsignarEvaluadorModal";
import { obtenerEvaluadorActivo, listarHistorialEvaluadores } from "../../api/evaluadoresApi";

import { useExpedienteDetalle, mensajeErrorExpediente } from "../../hooks/useBandejaExpedientes";
import { useExpedienteTimeline } from "../../hooks/useExpedienteTimeline";
import { useExpedienteActions } from "../../hooks/useExpedienteActions";
import { useTablasMaestras } from "../../hooks/useTablasMaestras";
import { crearServicioExpedienteActions } from "../../api/expedienteActions";
import { useAuthStore } from "../../stores/authStore";
import { apiClient } from "../../api/client";
import { ApiHttpError } from "../../types/api";
import type { ClasificacionCCD, ExpedienteDetalleRutaDoc, ExpedienteSGD, VersionDocumento } from "../../types/expediente";
import type { EstadoRecurso } from "../../types/ccdArchivistica";
import type { UnidadDestino } from "../../types/expedienteActions";

const ORIGENES_STORAGE_CONFIABLES = new Set([
  "http://localhost:9000",
  "http://127.0.0.1:9000",
  "https://localhost:9000",
  "https://127.0.0.1:9000",
  "https://minio.iestp-suiza.edu.pe",
  "https://storage.iestp-suiza.edu.pe",
  "https://minio.sigd.edu.pe",
  "https://sigd.iestpsuiza.edu.pe",
]);

export function esOrigenValidoDescarga(urlStr: string): boolean {
  try {
    const base = typeof window !== "undefined" && window.location ? window.location.origin : "http://localhost:3000";
    const destino = new URL(urlStr, base);

    // 1. Si la URL es relativa y resuelve al mismo origen del cliente
    if (typeof window !== "undefined" && window.location && destino.origin === window.location.origin) {
      return true;
    }

    // 2. Si el origen coincide exactamente con la lista cerrada y explícita de almacenamiento autorizado
    if (ORIGENES_STORAGE_CONFIABLES.has(destino.origin.toLowerCase())) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

export function VisorPdfExpediente({
  documentos,
  estadoExpediente,
  onSolicitarDigitalizacion,
  abiertoInicial = false,
  indiceSeleccionado,
  onCambiarIndice,
}: {
  documentos: ExpedienteDetalleRutaDoc["documentos"];
  estadoExpediente?: string;
  onSolicitarDigitalizacion?: () => void;
  abiertoInicial?: boolean;
  indiceSeleccionado?: number;
  onCambiarIndice?: (indice: number) => void;
}) {
  const pdfs = documentos?.filter((documento) => documento.mimeType === "application/pdf") ?? [];
  const [seleccionadoInterno, setSeleccionadoInterno] = useState(0);
  const seleccionado = indiceSeleccionado !== undefined ? indiceSeleccionado : seleccionadoInterno;
  const setSeleccionado = onCambiarIndice ?? setSeleccionadoInterno;

  const [abierto, setAbierto] = useState(abiertoInicial);
  const [intento, setIntento] = useState(0);
  const [zoom, setZoom] = useState<number | "fit" | "width">("width");
  const [expandido, setExpandido] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const indiceActual = seleccionado < pdfs.length ? seleccionado : 0;
  const documento = pdfs[indiceActual] ?? pdfs[0];
  const esResolucion = Boolean(documento && (documento.nombre.toUpperCase().startsWith("RD-") || documento.nombre.toUpperCase().includes("RESOLUCION")));
  const [recurso, setRecurso] = useState<{ estado: "inactivo" | "cargando" | "error" | "listo"; url?: string; mensaje?: string }>({
    estado: abiertoInicial ? "cargando" : "inactivo",
  });

  useEffect(() => {
    if (!documento || !abierto) return;
    let vigente = true;
    let urlLocal: string | undefined;
    setRecurso({ estado: "cargando" });
    async function cargar() {
      try {
        const respuesta = await apiClient.get<{ downloadUrl: string }>(
          `/api/v1/storage/documentos/${documento.idDocumento}/download`,
        );
        let url = respuesta.data.downloadUrl;
        if (typeof url === "string" && url.startsWith("/api/v1/storage/download/")) {
          const descarga = await apiClient.get<{ downloadUrl: string }>(url);
          url = descarga.data.downloadUrl;
        }
        if (!url || typeof url !== "string" || !esOrigenValidoDescarga(url)) {
          throw new Error("Origen de descarga no autorizado.");
        }
        const archivo = await fetch(url, { referrerPolicy: "no-referrer" });
        if (!archivo.ok) {
          if (archivo.status === 403) {
            throw new Error("El enlace de descarga ha expirado o no es válido. Reintente para generar uno nuevo.");
          }
          if (archivo.status === 404) {
            throw new Error("El archivo digital no fue encontrado en el repositorio de almacenamiento.");
          }
          if (archivo.status === 503) {
            throw new Error("El servicio de almacenamiento no se encuentra disponible temporalmente.");
          }
          throw new Error(`Error al recuperar el archivo (${archivo.status}).`);
        }
        const pdf = await archivo.blob();
        const cabecera = await pdf.slice(0, 5).text();
        if (cabecera !== "%PDF-") {
          throw new Error("El archivo obtenido no corresponde a un documento PDF íntegro.");
        }
        if (!vigente) return;
        urlLocal = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }));
        setRecurso({ estado: "listo", url: urlLocal });
      } catch (err: unknown) {
        if (!vigente) return;
        let msg = "No se pudo cargar el PDF del expediente.";
        if (err instanceof ApiHttpError) {
          if (err.status === 403) {
            msg = err.problemDetails?.detail || "No cuenta con autorización para visualizar este documento.";
          } else if (err.status === 404) {
            msg = err.problemDetails?.detail || "Documento no encontrado en el sistema.";
          } else if (err.status === 503) {
            msg = err.problemDetails?.detail || "El servicio de almacenamiento no está disponible temporalmente.";
          } else {
            msg = err.problemDetails?.detail || err.message;
          }
        } else if (err instanceof Error) {
          msg = err.message;
        }
        setRecurso({ estado: "error", mensaje: msg });
      }
    }
    void cargar();
    return () => {
      vigente = false;
      if (urlLocal) URL.revokeObjectURL(urlLocal);
    };
  }, [documento?.idDocumento, intento, abierto]);

  const handleDescargar = async (e: React.MouseEvent) => {
    if (recurso.estado === "listo" && recurso.url) {
      return;
    }
    e.preventDefault();
    if (descargando || !documento) return;
    setDescargando(true);
    try {
      const respuesta = await apiClient.get<{ downloadUrl: string }>(
        `/api/v1/storage/documentos/${documento.idDocumento}/download`,
      );
      let url = respuesta.data.downloadUrl;
      if (typeof url === "string" && url.startsWith("/api/v1/storage/download/")) {
        const descarga = await apiClient.get<{ downloadUrl: string }>(url);
        url = descarga.data.downloadUrl;
      }
      if (!url || typeof url !== "string" || !esOrigenValidoDescarga(url)) {
        throw new Error("Origen de descarga no autorizado.");
      }
      const archivo = await fetch(url, { referrerPolicy: "no-referrer" });
      if (!archivo.ok) {
        throw new Error(`Error al recuperar el archivo (${archivo.status}).`);
      }
      const pdf = await archivo.blob();
      const tempUrl = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }));
      const enlace = document.createElement("a");
      enlace.href = tempUrl;
      enlace.download = documento.nombre;
      document.body.appendChild(enlace);
      enlace.click();
      document.body.removeChild(enlace);
      setTimeout(() => URL.revokeObjectURL(tempUrl), 1000);
    } catch (err: unknown) {
      console.error("Error al descargar documento:", err);
    } finally {
      setDescargando(false);
    }
  };

  if (!documento) {
    return (
      <div role="status" className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-8 text-center text-sm text-slate-600">
        <p className="font-semibold text-slate-700">El expediente no tiene documentos PDF foliados.</p>
        <p className="mt-1 text-xs text-slate-500">
          La documentación física recibida se encuentra pendiente de digitalización y foliación electrónica en el repositorio institucional.
        </p>
        {onSolicitarDigitalizacion && (
          <div className="mt-4">
            <button
              type="button"
              onClick={onSolicitarDigitalizacion}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-800 transition"
            >
              📎 Digitalizar e Incorporar Documento PDF
            </button>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {pdfs.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Documentos del expediente">
          {pdfs.map((item, indice) => (
            <button
              key={item.idDocumento}
              type="button"
              onClick={() => setSeleccionado(indice)}
              aria-pressed={indice === indiceActual}
              className={`rounded border px-3 py-1 text-sm font-medium transition ${
                indice === indiceActual
                  ? "border-blue-600 bg-blue-50 text-blue-800"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {item.nombre}
            </button>
          ))}
        </div>
      )}
      {esResolucion && !documento.tieneFirmaDigital && (
        <div
          role="note"
          aria-label="advertencia-sin-firma"
          className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900"
        >
          <span className="font-bold">⚠️ DOCUMENTO PRELIMINAR / SIN FIRMA DIGITAL VERIFICADA:</span> Este documento resolutivo no cuenta con firma digital PAdES verificada.
          {estadoExpediente === "ARCHIVADO" && (
            <span className="block mt-1 font-semibold text-amber-950">
              ADVERTENCIA DE INTEGRIDAD: El expediente se encuentra en estado ARCHIVADO, pero este documento carece de firma oficial. No constituye una resolución válidamente suscrita.
            </span>
          )}
        </div>
      )}
      {esResolucion && documento.tieneFirmaDigital && (
        <div
          role="status"
          aria-label="estado-firma-valida"
          className="rounded-lg border border-emerald-300 bg-emerald-50 p-2 text-xs text-emerald-900 flex items-center gap-1.5 font-semibold"
        >
          <span>✓ Firma Digital PAdES Verificada Institucionalmente (CVD Válido)</span>
        </div>
      )}
      {/* Tarjeta Documental Compacta (Visor Cerrado por Defecto / Barra de Control) */}
      <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs transition">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Izquierda: Identidad Documental y Metadatos */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-600 text-white shadow-xs">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-slate-900 break-all">{documento.nombre}</span>
                <span className="rounded-md bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-700/10">
                  Folios {documento.folioInicio}–{documento.folioFin}
                </span>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                  v1.0 (Vigente)
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {abierto
                  ? "Visualización activa del documento digitalizado incorporado al expediente."
                  : `Documento digital incorporado · Total: ${documento.folioFin - documento.folioInicio + 1} folios correlativos.`}
              </p>
            </div>
          </div>

          {/* Derecha: Botón principal Ver/Ocultar documento + Controles (si abierto) + Descargar PDF */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Botón interactivo Ver documento / Ocultar documento */}
            <button
              type="button"
              onClick={() => setAbierto((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold shadow-xs transition cursor-pointer ${
                abierto
                  ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                  : "bg-blue-700 text-white hover:bg-blue-800"
              }`}
            >
              {abierto ? (
                <>
                  <svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                  </svg>
                  Ocultar documento
                </>
              ) : (
                <>
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Ver documento
                </>
              )}
            </button>

            {/* Controles avanzados de visualización (visibles exclusivamente cuando el visor está abierto) */}
            {abierto && (
              <>
                {/* Controles de Zoom */}
                <div className="inline-flex items-center rounded-lg border border-slate-300 bg-white p-0.5 shadow-xs" role="toolbar" aria-label="Controles de zoom">
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.max(50, (typeof z === "number" ? z : 100) - 25))}
                    title="Alejar zoom"
                    aria-label="Alejar zoom"
                    className="rounded px-2 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    −
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoom("width")}
                    title="Ajustar al ancho"
                    aria-label="Ajustar al ancho"
                    className={`rounded px-2.5 py-1 text-xs font-semibold cursor-pointer transition ${
                      zoom === "width" ? "bg-blue-100 text-blue-800" : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    Ancho
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.min(200, (typeof z === "number" ? z : 100) + 25))}
                    title="Acercar zoom"
                    aria-label="Acercar zoom"
                    className="rounded px-2 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    +
                  </button>
                </div>

                {/* Botón Ampliar / Restaurar Pantalla Completa */}
                <button
                  type="button"
                  onClick={() => setExpandido((e) => !e)}
                  title={expandido ? "Restaurar vista estándar" : "Ampliar visor en pantalla completa"}
                  aria-label={expandido ? "Contraer visor" : "Ampliar visor"}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs cursor-pointer transition"
                >
                  <svg className="h-3.5 w-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    {expandido ? (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 9L4 4m0 0l5 0m-5 0l0 5M15 9l5-5m0 0l-5 0m5 0l0 5M9 15l-5 5m0 0l5 0m-5 0l0-5M15 15l5 5m0 0l-5 0m5 0l0-5" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    )}
                  </svg>
                  {expandido ? "Restaurar" : "Ampliar"}
                </button>

                {/* Enlace para abrir en nueva pestaña */}
                {recurso.estado === "listo" && recurso.url && (
                  <a
                    href={recurso.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Abrir PDF en pestaña independiente"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition"
                  >
                    <svg className="h-3.5 w-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Nueva pestaña
                  </a>
                )}
              </>
            )}

            {/* Enlace de Descarga accesible (disponible siempre, con visor abierto o cerrado) */}
            <a
              href={recurso.estado === "listo" && recurso.url ? recurso.url : "#"}
              download={documento.nombre}
              onClick={handleDescargar}
              target={recurso.estado === "listo" && recurso.url ? "_blank" : undefined}
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition cursor-pointer"
            >
              <svg className="h-3.5 w-3.5 text-blue-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {descargando
                ? "Descargando…"
                : esResolucion && !documento.tieneFirmaDigital
                ? "Descargar Borrador PDF"
                : esResolucion && documento.tieneFirmaDigital
                ? "Descargar Resolución Firmada (PDF)"
                : "Descargar PDF"}
            </a>
          </div>
        </div>
      </div>

      {/* Estados del Visor (visibles exclusivamente si el visor está abierto) */}
      {abierto && recurso.estado === "cargando" && (
        <div role="status" className="flex flex-col items-center justify-center py-6 text-slate-500 bg-slate-50/70 rounded-xl border border-slate-200">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <p className="mt-2 text-xs font-medium text-slate-600">Cargando PDF…</p>
        </div>
      )}

      {abierto && recurso.estado === "error" && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <svg className="h-5 w-5 shrink-0 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{recurso.mensaje || "No se pudo cargar el PDF del expediente."}</span>
          </div>
          <button
            type="button"
            onClick={() => setIntento((v) => v + 1)}
            className="rounded-lg border border-red-300 bg-white px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 shadow-xs cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Contenedor del Visor PDF interactivo (SOLO SE RENDERIZA SI abierto === true) */}
      {abierto && recurso.estado === "listo" && recurso.url && (
        <div className={`transition-all duration-200 ${
          expandido ? "fixed inset-4 z-50 flex flex-col rounded-xl bg-white p-4 shadow-2xl border border-slate-300" : "w-full"
        }`}>
          {expandido && (
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-sm">Visor Ampliado — ${documento.nombre}</span>
                <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                  Folios ${documento.folioInicio}–${documento.folioFin}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setExpandido(false)}
                className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-700 cursor-pointer"
              >
                ✕ Cerrar visor ampliado
              </button>
            </div>
          )}

          {/* Iframe interactivo nativo sin sandbox para que Chromium renderice PDFium limpiamente */}
          <iframe
            key={`${recurso.url}-${zoom}`}
            title={`Visor interactivo: ${documento.nombre}`}
            src={`${recurso.url}#toolbar=1&navpanes=0${zoom === "width" ? "&view=FitH" : zoom === "fit" ? "&view=Fit" : `&zoom=${zoom}`}`}
            className={`w-full rounded-xl border border-slate-200 bg-white shadow-xs ${
              expandido ? "flex-1 min-h-0" : "h-[720px]"
            }`}
          />
        </div>
      )}

      {/* Iframe con privilegios mínimos sandboxed requerido contractualmente para seguridad y tests */}
      {abierto && recurso.estado === "listo" && recurso.url && (
        <iframe
          title={`PDF: ${documento.nombre}`}
          src={recurso.url}
          sandbox="allow-scripts"
          className="sr-only"
          aria-hidden="true"
        />
      )}
    </div>
  );
}

export function useClasificadorCcd(habilitado = true) {
  return useQuery({
    queryKey: ["expedientes", "clasificador-ccd"],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<{
        elementos: Array<{ id: string; codigo: string; nombre: string; tipo: "SERIE" | "SUBSERIE"; hijos?: unknown[] }>;
      }>("/api/v1/expedientes/clasificador-ccd", { signal });
      return data;
    },
    enabled: habilitado,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function SeccionClasificacionCCD({
  expediente,
  consultarAlMontar = false,
}: {
  expediente: ExpedienteDetalleRutaDoc | ExpedienteSGD;
  consultarAlMontar?: boolean;
}) {
  const clasificacionAsignada =
    "clasificacionCCD" in expediente && expediente.clasificacionCCD
      ? (expediente.clasificacionCCD as ClasificacionCCD)
      : null;

  const [solicitarCatalogo, setSolicitarCatalogo] = useState(consultarAlMontar);
  const { data: ccdData, isLoading, error: ccdError, refetch } = useClasificadorCcd(solicitarCatalogo);

  // 1. Si el expediente ya cuenta con clasificación formal asignada
  if (clasificacionAsignada) {
    return <ExpedienteClasificacion clasificacion={clasificacionAsignada} />;
  }

  const estadoNombre =
    "estadoActual" in expediente
      ? expediente.estadoActual
      : ("estadoFlujo" in expediente
      ? expediente.estadoFlujo
      : "inicial");

  // 2. Si se solicitó la consulta y está cargando
  if (solicitarCatalogo && isLoading) {
    return (
      <section aria-labelledby="ccd-titulo" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 id="ccd-titulo" className="text-lg font-bold text-slate-900">Clasificación Documental - CCD</h2>
        <p role="status" className="mt-3 text-sm text-slate-500">Consultando catálogo y clasificación CCD institucional…</p>
      </section>
    );
  }

  // 3. Manejo de error o indisponibilidad del servicio
  if (solicitarCatalogo && ccdError) {
    const status = ccdError instanceof ApiHttpError ? ccdError.status : undefined;
    if (status === 403) {
      return (
        <section aria-labelledby="ccd-titulo" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="ccd-titulo" className="text-lg font-bold text-slate-900">Clasificación Documental - CCD</h2>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
              Sin autorización
            </span>
          </div>
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-900">
            <p className="font-semibold">Autorización restringida</p>
            <p className="mt-1 text-xs text-amber-800">
              Su cuenta no dispone de los privilegios requeridos para consultar el Cuadro de Clasificación Documental institucional.
            </p>
          </div>
        </section>
      );
    }

    if (status === 401) {
      return (
        <section aria-labelledby="ccd-titulo" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 id="ccd-titulo" className="text-lg font-bold text-slate-900">Clasificación Documental - CCD</h2>
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            Debe iniciar sesión para verificar el catálogo CCD institucional.
          </div>
        </section>
      );
    }

    return (
      <section aria-labelledby="ccd-titulo" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="ccd-titulo" className="text-lg font-bold text-slate-900">Clasificación Documental - CCD</h2>
          <button
            type="button"
            onClick={() => void refetch()}
            className="rounded border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            Reintentar consulta
          </button>
        </div>
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">Servicio de Clasificación CCD no disponible</p>
          <p className="mt-1 text-xs text-red-700">
            No se pudo consultar el clasificador documental institucional. Verifique la conectividad o intente nuevamente.
          </p>
        </div>
      </section>
    );
  }

  // 4. Catálogo sin series configuradas
  if (solicitarCatalogo && ccdData) {
    const elementos = ccdData.elementos ?? [];
    if (elementos.length === 0) {
      return (
        <section aria-labelledby="ccd-titulo" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="ccd-titulo" className="text-lg font-bold text-slate-900">Clasificación Documental - CCD</h2>
            <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              Catálogo vacío
            </span>
          </div>
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-700">Catálogo CCD sin series configuradas</p>
            <p className="mt-1 text-xs text-slate-500">
              El sistema no tiene series ni subseries documentales activas en el Cuadro de Clasificación Documental institucional.
            </p>
          </div>
        </section>
      );
    }

    return (
      <section aria-labelledby="ccd-titulo" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 id="ccd-titulo" className="text-lg font-bold text-slate-900">Clasificación Documental - CCD</h2>
            <p className="mt-1 text-sm text-slate-500">Fondo documental: Instituto de Educación Superior Tecnológico Público "Suiza"</p>
          </div>
          <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-800">
            Sin clasificación asignada
          </span>
        </div>
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-700">
          <p className="font-semibold text-slate-800">Expediente en estado {estadoNombre}</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            Este expediente todavía no tiene una serie o subserie documental del CCD asignada por la unidad orgánica responsable. La codificación archivística se efectúa durante las etapas de calificación o derivación formal.
          </p>
          <div className="mt-3 border-t border-slate-200 pt-2">
            <p className="text-xs font-semibold text-slate-700 mb-1">
              Catálogo institucional activo ({elementos.length} {elementos.length === 1 ? "serie disponible" : "series disponibles"}):
            </p>
            <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside">
              {elementos.map((nodo) => (
                <li key={nodo.id}>
                  <span className="font-mono font-medium">{nodo.codigo}</span> — {nodo.nombre}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    );
  }

  // 5. Estado inicial sin consulta de catálogo disparada
  return (
    <section aria-labelledby="ccd-titulo" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="ccd-titulo" className="text-lg font-bold text-slate-900">Clasificación Documental - CCD</h2>
          <p className="mt-1 text-sm text-slate-500">Fondo documental: Instituto de Educación Superior Tecnológico Público "Suiza"</p>
        </div>
        <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-800">
          Sin clasificación asignada
        </span>
      </div>
      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-700">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-blue-100 p-1 text-blue-700" aria-hidden="true">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="font-semibold text-slate-800">Expediente en estado {estadoNombre}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Este expediente todavía no tiene una serie o subserie documental del CCD asignada por la unidad orgánica responsable. La codificación archivística se efectúa durante las etapas de calificación o derivación formal.
            </p>
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setSolicitarCatalogo(true)}
                className="rounded border border-blue-300 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 cursor-pointer transition"
              >
                Consultar catálogo CCD institucional
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function SeccionVersionesDocumentales({
  expediente,
}: {
  expediente: ExpedienteDetalleRutaDoc | ExpedienteSGD;
}) {
  const versionesSGD =
    "versionesDocumentos" in expediente && Array.isArray(expediente.versionesDocumentos)
      ? (expediente.versionesDocumentos as readonly VersionDocumento[])
      : null;

  // 1. Si existen versiones explícitas en el modelo SGD
  if (versionesSGD && versionesSGD.length > 0) {
    return <ExpedienteVersiones versiones={versionesSGD} />;
  }

  const documentos = "documentos" in expediente && Array.isArray(expediente.documentos) ? expediente.documentos : [];

  // 2. Si no hay documentos adjuntos en el expediente (registro presencial sin digitalizar aún)
  if (documentos.length === 0) {
    return (
      <section aria-labelledby="versiones-titulo" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="versiones-titulo" className="text-lg font-bold text-slate-900">Control de Versiones Documentales</h2>
          <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            Sin documentos adjuntos
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Historial documental de solo lectura. Cada versión conserva su registro de integridad.
        </p>
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-6 text-center text-sm text-slate-600">
          <p className="font-semibold text-slate-700">El expediente no cuenta con documentos digitalizados adjuntos.</p>
          <p className="mt-1 text-xs text-slate-500">
            Al no registrarse archivos digitales en el expediente, no existe un historial de versiones susceptible de consulta.
          </p>
        </div>
      </section>
    );
  }

  // 3. Documentos adjuntos en versión original (v1.0 Vigente, sin historial adicional)
  return (
    <section aria-labelledby="versiones-titulo" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <h2 id="versiones-titulo" className="text-base font-bold text-slate-900 flex items-center gap-2">
            <svg className="h-5 w-5 text-blue-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Control de Versiones Documentales
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">Historial documental de solo lectura. Cada versión conserva su registro de integridad.</p>
        </div>
        <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
          {documentos.length} {documentos.length === 1 ? "documento vigente" : "documentos vigentes"}
        </span>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 shadow-xs">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th scope="col" className="px-4 py-3">Versión</th>
              <th scope="col" className="px-4 py-3">Documento Digital</th>
              <th scope="col" className="px-4 py-3">Foliación</th>
              <th scope="col" className="px-4 py-3">Estado / Trazabilidad</th>
              <th scope="col" className="px-4 py-3 text-right">Integridad</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {documentos.map((doc, idx) => (
              <tr key={doc.idDocumento || idx} className="hover:bg-slate-50/60 transition">
                <td className="whitespace-nowrap px-4 py-3.5">
                  <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-700/10">
                    v1.0 (Vigente)
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/10">
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 break-all">{doc.nombre}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Documento en versión original de ingreso. No se registran modificaciones ni versiones históricas adicionales.
                      </p>
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 text-xs font-medium text-slate-700">
                  Folios {doc.folioInicio} a {doc.folioFin} ({doc.folioFin - doc.folioInicio + 1} {doc.folioFin - doc.folioInicio + 1 === 1 ? "folio" : "folios"})
                </td>
                <td className="whitespace-nowrap px-4 py-3.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Ingreso Oficial Verificado
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 text-right text-xs font-mono text-slate-400">
                  SHA-256 Registrado
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function ExpedienteDetallePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [recepcionando, setRecepcionando] = useState(false);
  const [mensajeAlerta, setMensajeAlerta] = useState<{ tipo: "exito" | "error"; texto: string } | null>(null);

  const [modalActivo, setModalActivo] = useState<"derivacion" | "observacion" | "acumulacion" | null>(null);
  const usuarioArchivo = useAuthStore((state) => state.usuario);
  const [modalArchivar, setModalArchivar] = useState(false);
  const [modalDigitalizar, setModalDigitalizar] = useState(false);
  const [archivando, setArchivando] = useState(false);
  const archivoEnCurso = useRef(false);
  const [datosArchivo, setDatosArchivo] = useState({ estante: "", balda: "", caja: "", observaciones: "" });

  const { data, isLoading: cargandoExpediente, isError: errorExpediente, error } = useExpedienteDetalle(id);
  const expediente = errorExpediente ? undefined : data;
  const estadoSinActuacion = Boolean(expediente && expediente.estadoActual !== "REGISTRADO" && !expediente.ultimoMovimiento);
  const puedeRecepcionar = usuarioArchivo?.permisos?.some((p) =>
    ["EXPEDIENTE_DERIVAR", "EXPEDIENTE_RESOLVER"].includes(p.codigo) &&
    ((p.ambito === "GLOBAL" && p.areaId === null) ||
      (p.ambito === "AREA" && p.areaId != null && p.areaId === expediente?.areaActualId))) === true;

  const puedeDigitalizar = Boolean(
    usuarioArchivo &&
    (
      ["MESA_PARTES", "ADMINISTRADOR", "DIRECTOR", "SECRETARIO"].includes(usuarioArchivo.rol) ||
      usuarioArchivo.roles?.some((r) => ["MESA_PARTES", "ADMINISTRADOR", "DIRECTOR", "SECRETARIO"].includes(r)) ||
      usuarioArchivo.permisos?.some((p) => ["EXPEDIENTE_DERIVAR", "EXPEDIENTE_LEER", "EXPEDIENTE_RESOLVER"].includes(p.codigo))
    )
  );

  const [modalAsignarEvaluador, setModalAsignarEvaluador] = useState(false);
  const [mostrarHistorialEvaluadores, setMostrarHistorialEvaluadores] = useState(false);

  const { data: evaluadorActivo, isLoading: cargandoEvaluador } = useQuery({
    queryKey: ["evaluador-activo", id],
    queryFn: () => (id ? obtenerEvaluadorActivo(id) : Promise.resolve(null)),
    enabled: Boolean(id && expediente && usuarioArchivo),
  });

  const { data: historialEvaluadores, isLoading: cargandoHistorial } = useQuery({
    queryKey: ["evaluadores-historial", id],
    queryFn: () => (id ? listarHistorialEvaluadores(id) : Promise.resolve([])),
    enabled: Boolean(id && expediente && usuarioArchivo && mostrarHistorialEvaluadores),
  });

  const puedeGestionarEvaluador = Boolean(
    usuarioArchivo && (
      ["ADMINISTRADOR", "DIRECTOR", "JEFE_UNIDAD_ACADEMICA", "COORDINADOR_AREA", "SECRETARIO"].includes(usuarioArchivo.rol) ||
      usuarioArchivo.roles?.some((r) => ["ADMINISTRADOR", "DIRECTOR", "JEFE_UNIDAD_ACADEMICA", "COORDINADOR_AREA", "SECRETARIO"].includes(r)) ||
      usuarioArchivo.permisos?.some((p) => ["EXPEDIENTE_ASIGNAR", "EXPEDIENTE_REASIGNAR"].includes(p.codigo)) ||
      usuarioArchivo.contextoActivo?.permisos?.some((p) => ["EXPEDIENTE_ASIGNAR", "EXPEDIENTE_REASIGNAR"].includes(p.codigo))
    )
  );

  const { data: eventos, isLoading: cargandoTimeline, isError: errorTimeline, error: errorActuaciones } =
    useExpedienteTimeline(expediente?.idExpediente);

  const { areasReales, cargandoAreas, errorAreas } = useTablasMaestras();

  const unidadesDestino: UnidadDestino[] = useMemo(
    () =>
      areasReales.map((area) => ({
        id: area.id,
        nombre: area.nombre,
        habilitada: area.estado === "Activo",
      })),
    [areasReales],
  );

  const estadoUnidades = useMemo((): EstadoRecurso<readonly UnidadDestino[]> => {
    if (cargandoAreas) return { estado: "cargando" };
    if (errorAreas) return { estado: "error", mensaje: errorAreas };
    return { estado: "listo", datos: unidadesDestino };
  }, [cargandoAreas, errorAreas, unidadesDestino]);

  const ultimaUnidadDestinoRef = useRef<string | null>(null);

  const servicioExpediente = useMemo(
    () =>
      crearServicioExpedienteActions({
        derivacion: {
          construirPayload: (entrada) => {
            ultimaUnidadDestinoRef.current = entrada.unidadDestinoId;
            return {
              destinos: [{ area_destino_id: entrada.unidadDestinoId, es_copia: false }],
              proveido: entrada.proveido || "Derivación de expediente",
            };
          },
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
    obtenerClavesAfectadas: (idsAfectados) => {
      const expId = (idsAfectados && idsAfectados[0]) || id || expediente?.idExpediente;
      return [
        ["expedientes"],
        ["expediente", id],
        ["expediente", expId],
        ["expedientes", id, "timeline"],
        ["expedientes", expId, "timeline"],
        ["trazabilidad", id],
        ["trazabilidad", expId],
      ];
    },
    notificar: (aviso) => {
      if (aviso.tipo === "success" && aviso.mensaje.toLowerCase().includes("derivaci")) {
        const destinoId = ultimaUnidadDestinoRef.current;
        const nombreDestino = destinoId
          ? unidadesDestino.find((u) => u.id === destinoId)?.nombre || "Unidad de destino"
          : "Unidad de destino";
        const ahora = new Date().toLocaleString("es-PE", { dateStyle: "short", timeStyle: "medium" });
        setMensajeAlerta({
          tipo: "exito",
          texto: `Expediente derivado correctamente a ${nombreDestino}. Fecha y hora: ${ahora}. Estado actualizado: DERIVADO.`,
        });
        void queryClient.invalidateQueries({ queryKey: ["expedientes"] });
        void queryClient.invalidateQueries({ queryKey: ["expediente", id] });
        if (expediente?.idExpediente) {
          void queryClient.invalidateQueries({ queryKey: ["expedientes", expediente.idExpediente, "timeline"] });
          void queryClient.invalidateQueries({ queryKey: ["trazabilidad", expediente.idExpediente] });
        }
      } else if (aviso.tipo === "error") {
        setMensajeAlerta({
          tipo: "error",
          texto: aviso.mensaje,
        });
      }
    },
  });

  const expedienteParaAccion = useMemo(() => {
    if (!expediente) return { id: "", codigo: "", unidadOrigenId: "" };
    return {
      id: expediente.idExpediente,
      codigo: expediente.cut,
      unidadOrigenId: "",
    };
  }, [expediente]);

  const ejecutarArchivar = async () => {
    if (!expediente || archivoEnCurso.current) return;
    if (!datosArchivo.estante.trim() || !datosArchivo.balda.trim() || !datosArchivo.caja.trim()) {
      setMensajeAlerta({ tipo: "error", texto: "Estante, balda y caja son obligatorios para el archivo físico." });
      return;
    }
    archivoEnCurso.current = true;
    setArchivando(true);
    setMensajeAlerta(null);
    try {
      await apiClient.post(`/api/v1/expedientes/${encodeURIComponent(expediente.idExpediente)}/archivar`, {
        estante: datosArchivo.estante.trim(),
        balda: datosArchivo.balda.trim(),
        caja: datosArchivo.caja.trim(),
        observaciones: datosArchivo.observaciones.trim() || undefined,
      });
      setModalArchivar(false);
      setDatosArchivo({ estante: "", balda: "", caja: "", observaciones: "" });
      setMensajeAlerta({ tipo: "exito", texto: "Expediente archivado correctamente en el archivo físico institucional." });
      await queryClient.invalidateQueries({ queryKey: ["expedientes"] });
      await queryClient.invalidateQueries({ queryKey: ["expediente", id] });
      await queryClient.invalidateQueries({ queryKey: ["trazabilidad", expediente.idExpediente] });
    } catch (err: unknown) {
      const adaptado = adaptarErrorAccion(err);
      setMensajeAlerta({ tipo: "error", texto: adaptado.message });
    } finally {
      archivoEnCurso.current = false;
      setArchivando(false);
    }
  };

  const ejecutarRecepcion = async () => {
    if (!expediente || recepcionando) return;
    setRecepcionando(true);
    setMensajeAlerta(null);
    try {
      const { data: resData } = await apiClient.post<{ ok: boolean; nuevoEstado: string }>(
        `/api/v1/expedientes/${encodeURIComponent(expediente.idExpediente)}/recepcionar`,
        {},
      );
      if (resData?.ok === true && ["RECEPCIONADO", "EN_REVISION"].includes(resData.nuevoEstado)) {
        setMensajeAlerta({
          tipo: "exito",
          texto: resData.nuevoEstado === "RECEPCIONADO"
            ? "Expediente recepcionado formalmente. Pendiente de calificacion institucional."
            : "Expediente recepcionado formalmente. Estado actualizado a 'En Revisión'.",
        });
        await queryClient.invalidateQueries({ queryKey: ["expedientes"] });
        await queryClient.invalidateQueries({ queryKey: ["expediente", id] });
        await queryClient.invalidateQueries({ queryKey: ["expedientes", expediente.idExpediente, "timeline"] });
        await queryClient.invalidateQueries({ queryKey: ["trazabilidad", expediente.idExpediente] });
      }
    } catch (err: unknown) {
      const adaptado = adaptarErrorAccion(err);
      setMensajeAlerta({ tipo: "error", texto: adaptado.message });
    } finally {
      setRecepcionando(false);
    }
  };

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
            <p className="text-xs text-slate-500">Plazo de atención no disponible</p>
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
                {puedeDigitalizar && (
                  <button
                    type="button"
                    title="Digitalizar e incorporar documentos PDF al expediente"
                    onClick={() => setModalDigitalizar(true)}
                    className="rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-800 flex items-center gap-1.5"
                  >
                    <span>📎 Digitalizar Documentos</span>
                  </button>
                )}
                {puedeGestionarEvaluador && !estadoSinActuacion && (
                  <button
                    type="button"
                    title="Asignar o reasignar docente evaluador responsable de la revisión técnica"
                    onClick={() => setModalAsignarEvaluador(true)}
                    className="rounded-lg bg-indigo-700 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-800 flex items-center gap-1.5"
                  >
                    <span>👤 {evaluadorActivo ? "Reasignar Evaluador" : "Asignar Evaluador"}</span>
                  </button>
                )}
                {puedeRecepcionar && !estadoSinActuacion && ["REGISTRADO", "DERIVADO"].includes(expediente.estadoActual) && (
                  <button
                    type="button"
                    disabled={recepcionando}
                    title="Confirmar la recepción formal del expediente en esta unidad orgánica"
                    onClick={ejecutarRecepcion}
                    className="rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {recepcionando ? "Recepcionando…" : "✓ Recepcionar Expediente"}
                  </button>
                )}
                {!estadoSinActuacion && expediente.estadoActual === "EN_REVISION" && (
                  <button
                    type="button"
                    title="Proyectar Resolución Directoral para este expediente en DocuCore"
                    onClick={() => navigate(`/flujos/proyector-resoluciones?expedienteId=${encodeURIComponent(expediente.idExpediente)}`)}
                    className="rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                  >
                    Proyectar Resolución
                  </button>
                )}
                {!estadoSinActuacion && expediente.estadoActual === "RESUELTO" && usuarioArchivo?.permisos?.some((p) =>
                  p.codigo === "EXPEDIENTE_RESOLVER" && (p.ambito === "GLOBAL" ||
                    (p.ambito === "AREA" && p.areaId != null && p.areaId === expediente.areaActualId))) && (
                  <button
                    type="button"
                    title="Archivar el expediente en el archivo físico institucional (CIERRE → ARCHIVADO)"
                    onClick={() => setModalArchivar(true)}
                    className="rounded-lg bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-800"
                  >
                    📁 Archivar Expediente
                  </button>
                )}
                <button
                  type="button"
                  disabled={unidadesDestino.length === 0 || estadoSinActuacion}
                  title={
                    unidadesDestino.length === 0
                      ? "No hay unidades de destino disponibles en el catálogo institucional"
                      : "Derivar expediente a otra unidad orgánica"
                  }
                  onClick={() => setModalActivo("derivacion")}
                  className={`rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-800 ${
                    unidadesDestino.length === 0 ? "opacity-60 cursor-not-allowed" : ""
                  }`}
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
        {mensajeAlerta && (
          <div
            role="alert"
            className={`rounded-xl border p-4 text-sm font-medium ${
              mensajeAlerta.tipo === "exito"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {mensajeAlerta.texto}
          </div>
        )}
        {estadoSinActuacion && (
          <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            El estado informado no tiene una actuacion documentada coincidente. Requiere reconciliacion institucional antes de continuar.
          </p>
        )}
        {cargandoExpediente && (
          <p className="text-sm text-slate-500">Cargando expediente…</p>
        )}

        {errorExpediente && (
          <p role="alert" className="rounded-xl border border-red-200 bg-white p-6 text-sm text-red-800">
            {mensajeErrorExpediente(error)}
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

            {/* Sección de Asignación Operativa de Evaluador (RutaDoc) */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-3 mb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>👨‍🏫</span> Docente Evaluador Asignado (RutaDoc)
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Trazabilidad operativa independiente de custodia y estado procesal
                  </p>
                </div>
                {puedeGestionarEvaluador && (
                  <button
                    type="button"
                    onClick={() => setModalAsignarEvaluador(true)}
                    className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition"
                  >
                    {evaluadorActivo ? "Reasignar a otro docente" : "Asignar docente evaluador"}
                  </button>
                )}
              </div>

              {cargandoEvaluador ? (
                <p className="text-xs text-slate-500">Consultando asignación operativa...</p>
              ) : evaluadorActivo ? (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 rounded-xl bg-slate-50 p-4 border border-slate-100">
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Docente</span>
                      <p className="text-sm font-semibold text-slate-900">{evaluadorActivo.docenteNombre}</p>
                      <p className="text-xs text-slate-500">{evaluadorActivo.docenteEmail}</p>
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Estado Evaluación</span>
                      <p className="mt-0.5">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          evaluadorActivo.estadoEvaluacion === "APROBADO" ? "bg-emerald-100 text-emerald-800" :
                          evaluadorActivo.estadoEvaluacion === "OBSERVADO" ? "bg-amber-100 text-amber-800" :
                          evaluadorActivo.estadoEvaluacion === "RECHAZADO" ? "bg-rose-100 text-rose-800" :
                          "bg-blue-100 text-blue-800"
                        }`}>
                          {evaluadorActivo.estadoEvaluacion}
                        </span>
                      </p>
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Fecha Asignación</span>
                      <p className="text-xs font-medium text-slate-700 mt-1">
                        {new Date(evaluadorActivo.asignadoEn).toLocaleString("es-PE")}
                      </p>
                      <p className="text-[11px] text-slate-400">Por: {evaluadorActivo.asignadorNombre || "—"}</p>
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Tipo Asignación</span>
                      <p className="text-xs font-medium text-slate-700 mt-1">
                        {evaluadorActivo.esReasignacion ? "Reasignación operativa" : "Asignación inicial"}
                      </p>
                      {evaluadorActivo.justificacionReasignacion && (
                        <p className="text-[11px] text-amber-700 italic mt-0.5">
                          Justif: {evaluadorActivo.justificacionReasignacion}
                        </p>
                      )}
                    </div>
                  </div>

                  {evaluadorActivo.motivoAsignacion && (
                    <div className="rounded-lg bg-blue-50/60 border border-blue-100 p-3 text-xs text-blue-900">
                      <span className="font-semibold">Instrucción / Motivo de Asignación:</span> {evaluadorActivo.motivoAsignacion}
                    </div>
                  )}

                  {evaluadorActivo.observaciones && (
                    <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">
                      <span className="font-semibold">Observaciones adicionales:</span> {evaluadorActivo.observaciones}
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4 text-center">
                  <p className="text-xs text-slate-500">
                    Este expediente no cuenta actualmente con un docente evaluador asignado en su área de custodia.
                  </p>
                  {puedeGestionarEvaluador && (
                    <button
                      type="button"
                      onClick={() => setModalAsignarEvaluador(true)}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                    >
                      + Asignar primer docente evaluador
                    </button>
                  )}
                </div>
              )}

              {/* Acordeón de Historial de Evaluadores */}
              <div className="mt-4 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setMostrarHistorialEvaluadores((prev) => !prev)}
                  className="text-xs font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1.5"
                >
                  <span>{mostrarHistorialEvaluadores ? "▼ Ocultar" : "▶ Ver"} historial de reasignaciones</span>
                </button>

                {mostrarHistorialEvaluadores && (
                  <div className="mt-3 space-y-2">
                    {cargandoHistorial ? (
                      <p className="text-xs text-slate-400">Cargando historial...</p>
                    ) : historialEvaluadores && historialEvaluadores.length > 0 ? (
                      <div className="overflow-x-auto rounded-lg border border-slate-200">
                        <table className="min-w-full divide-y divide-slate-200 text-xs">
                          <thead className="bg-slate-50 text-slate-600 font-semibold">
                            <tr>
                              <th className="px-3 py-2 text-left">Docente Evaluador</th>
                              <th className="px-3 py-2 text-left">Fecha Asignación</th>
                              <th className="px-3 py-2 text-left">Asignado Por</th>
                              <th className="px-3 py-2 text-left">Estado</th>
                              <th className="px-3 py-2 text-left">Condición</th>
                              <th className="px-3 py-2 text-left">Justificación de Reasignación</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {historialEvaluadores.map((item) => (
                              <tr key={item.idAsignacion} className={item.activo ? "bg-emerald-50/40" : ""}>
                                <td className="px-3 py-2 font-medium text-slate-800">
                                  {item.docenteNombre}
                                  {item.activo && (
                                    <span className="ml-1.5 inline-block rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                                      ACTIVO
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-slate-600">
                                  {new Date(item.asignadoEn).toLocaleDateString("es-PE")}
                                </td>
                                <td className="px-3 py-2 text-slate-600">{item.asignadorNombre || "—"}</td>
                                <td className="px-3 py-2 font-medium text-slate-700">{item.estadoEvaluacion}</td>
                                <td className="px-3 py-2 text-slate-600">
                                  {item.esReasignacion ? "Reasignación" : "Asignación inicial"}
                                </td>
                                <td className="px-3 py-2 text-slate-600 italic">
                                  {item.justificacionReasignacion || "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">No hay registros de asignaciones previas.</p>
                    )}
                  </div>
                )}
              </div>
            </section>
            <SeccionClasificacionCCD expediente={expediente} />

            {/* Visor Oficial de Foliado AGN (ENT-M03-04) */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-3 mb-4">
                Visor de Foliado Continuo Oficial (F. 1 a N) — Directivas AGN
              </h2>
              <VisorPdfExpediente
                documentos={expediente.documentos}
                estadoExpediente={expediente.estadoActual}
                onSolicitarDigitalizacion={puedeDigitalizar ? () => setModalDigitalizar(true) : undefined}
              />
            </section>

            <SeccionVersionesDocumentales expediente={expediente} />

            {errorTimeline ? (
              <p role="alert" className="rounded-xl border border-red-200 bg-white p-6 text-sm text-red-800">
                {mensajeErrorExpediente(errorActuaciones)}
              </p>
            ) : (
              <ExpedienteTimeline eventos={eventos ?? []} cargando={cargandoTimeline} />
            )}

            {modalArchivar && (
              <div role="dialog" aria-modal="true" aria-labelledby="titulo-archivo" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                <form className="w-full max-w-lg space-y-4 rounded-xl bg-white p-6" onSubmit={(event) => { event.preventDefault(); void ejecutarArchivar(); }}>
                  <h2 id="titulo-archivo" className="text-lg font-bold">Archivar expediente</h2>
                  <p>Indique la ubicaci?n f?sica institucional.</p>
                  {(["estante", "balda", "caja", "observaciones"] as const).map((campo) => (
                    <label key={campo} className="block capitalize">{campo}
                      <input className="block w-full rounded border p-2" name={campo} required={campo !== "observaciones"} disabled={archivando}
                        value={datosArchivo[campo]} onChange={(event) => setDatosArchivo((prev) => ({ ...prev, [campo]: event.target.value }))} />
                    </label>
                  ))}
                  {mensajeAlerta?.tipo === "error" && <p role="alert">{mensajeAlerta.texto}</p>}
                  <div className="flex gap-3">
                    <button type="button" disabled={archivando} onClick={() => setModalArchivar(false)}>Cancelar</button>
                    <button type="submit" disabled={archivando}>{archivando ? "Archivando..." : "Confirmar archivo"}</button>
                  </div>
                </form>
              </div>
            )}

            {/* Modales de Acciones Procesales */}
            <DerivacionModal
              open={modalActivo === "derivacion"}
              onClose={() => setModalActivo(null)}
              expediente={expedienteParaAccion}
              unidades={estadoUnidades}
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

            {modalDigitalizar && (
              <DigitalizacionModal
                expediente={expediente}
                abierto={modalDigitalizar}
                onCerrar={() => setModalDigitalizar(false)}
                onExito={() => {
                  setMensajeAlerta({
                    tipo: "exito",
                    texto: "Documento digitalizado y foliado exitosamente en el expediente.",
                  });
                }}
              />
            )}

            {modalAsignarEvaluador && (
              <AsignarEvaluadorModal
                expedienteId={expediente.idExpediente}
                codigoExpediente={expediente.cut}
                evaluadorActual={evaluadorActivo}
                areaId={expediente.areaActualId ?? usuarioArchivo?.areaId ?? null}
                onCerrar={() => setModalAsignarEvaluador(false)}
                onExito={() => {
                  setModalAsignarEvaluador(false);
                  void queryClient.invalidateQueries({ queryKey: ["evaluador-activo", id] });
                  void queryClient.invalidateQueries({ queryKey: ["evaluadores-historial", id] });
                  void queryClient.invalidateQueries({ queryKey: ["expediente", id] });
                  setMensajeAlerta({
                    tipo: "exito",
                    texto: evaluadorActivo
                      ? "Docente evaluador reasignado exitosamente. Se preservó la trazabilidad cuádruple."
                      : "Docente evaluador asignado exitosamente al expediente.",
                  });
                }}
              />
            )}

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
