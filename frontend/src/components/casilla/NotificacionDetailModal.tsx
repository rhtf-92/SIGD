/**
 * Módulo: Detalle de Acto Administrativo y Acuse Legal (ENT-M01-03)
 * Componente: NotificacionDetailModal
 * Cumplimiento de accesibilidad (ARIA, foco, Escape), visualización integral del acto
 * y gestión de Acuse Digital Inmutable (Timestamp ISO-8601 y Hash SHA-256 provistos por backend).
 */

import { useEffect, useRef, useState } from "react";

import { casillaService } from "../../services/casillaService";
import type { Notificacion } from "../../types/casilla";

interface NotificacionDetailModalProps {
  isOpen: boolean;
  notificacion: Notificacion | null;
  isGenerandoAcuse: boolean;
  onClose: () => void;
  onGenerarAcuse: (notificacionId: string) => void;
}

function formatIsoFecha(isoString?: string | null): string {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat("es-PE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(d);
  } catch {
    return isoString;
  }
}

export default function NotificacionDetailModal({
  isOpen,
  notificacion,
  isGenerandoAcuse,
  onClose,
  onGenerarAcuse,
}: NotificacionDetailModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // Manejo de teclado (Escape para cerrar) y foco accesible
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    // Auto-focus en el botón de cierre para accesibilidad
    const timeout = setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 50);

    // Evitar scroll en el fondo mientras el modal está abierto
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearTimeout(timeout);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen || !notificacion) return null;

  const acuse = notificacion.acuse;
  const acto = notificacion.actoAdministrativo;

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedHash(label);
      setTimeout(() => setCopiedHash(null), 2500);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/60 backdrop-blur-xs transition-opacity overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-act-title"
      aria-describedby="modal-act-desc"
    >
      <div
        ref={modalRef}
        className="relative my-auto flex max-h-[92vh] w-full max-w-4xl flex-col rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* ================================================================== */}
        {/* CABECERA DEL MODAL                                                 */}
        {/* ================================================================== */}
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 px-6 py-5 text-white">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-blue-500/30 border border-blue-400/40 px-2.5 py-0.5 text-xs font-bold text-blue-200">
                {acto.tipoActo}
              </span>
              <span className="font-mono text-xs text-slate-300">
                {notificacion.numeroNotificacion}
              </span>
              <span className="text-slate-400">•</span>
              <span className="text-xs font-bold text-amber-300">
                {notificacion.numeroExpediente}
              </span>
            </div>
            <h2
              id="modal-act-title"
              className="text-lg font-bold text-white sm:text-xl tracking-tight"
            >
              {acto.numeroDocumento}
            </h2>
            <p className="text-xs text-slate-300">
              Emitido por: {notificacion.unidadEmisora}
            </p>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal de notificación"
            className="rounded-xl border border-white/20 bg-white/10 p-2 text-slate-300 hover:bg-white/20 hover:text-white transition focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </header>

        {/* ================================================================== */}
        {/* CUERPO DEL MODAL (SCROLLABLE)                                      */}
        {/* ================================================================== */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 text-slate-800">
          {/* Metadatos institucionales de la notificación */}
          <section className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:grid-cols-3 text-xs">
            <div>
              <p className="font-semibold text-slate-500">Fecha de Depósito</p>
              <p className="mt-0.5 font-medium text-slate-900">
                {formatIsoFecha(notificacion.fechaDepositoIso)}
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-500">
                Primer Acceso (Lectura)
              </p>
              <p className="mt-0.5 font-medium text-slate-900">
                {notificacion.fechaLecturaIso
                  ? formatIsoFecha(notificacion.fechaLecturaIso)
                  : "Lectura en este momento"}
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-500">
                Estado de Notificación
              </p>
              <p className="mt-0.5 font-bold">
                {notificacion.estado === "NOTIFICADO" ? (
                  <span className="text-emerald-700 flex items-center gap-1">
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    Notificado válidamente
                  </span>
                ) : (
                  <span className="text-amber-700">
                    Pendiente de confirmación de acuse
                  </span>
                )}
              </p>
            </div>
          </section>

          {/* Asunto y Contenido del Acto Administrativo */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-blue-900 flex items-center gap-2">
              <svg
                className="h-4 w-4 text-blue-700"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Contenido Oficial del Acto Administrativo
            </h3>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
              <div>
                <p className="text-xs font-semibold text-slate-500">Asunto:</p>
                <p
                  id="modal-act-desc"
                  className="mt-0.5 text-sm font-bold text-slate-900"
                >
                  {acto.asunto}
                </p>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <p className="text-xs font-semibold text-slate-500">
                  Fundamentación y Resumen Legal:
                </p>
                <p className="mt-1 text-xs sm:text-sm text-slate-700 leading-relaxed text-justify bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  {acto.resumenLegal}
                </p>
              </div>

              {acto.textoCompleto && (
                <div className="border-t border-slate-100 pt-3">
                  <p className="text-xs font-semibold text-slate-500">
                    Parte Resolutiva / Dispositiva:
                  </p>
                  <pre className="mt-1 font-sans text-xs text-slate-800 whitespace-pre-line bg-blue-50/40 p-3.5 rounded-xl border border-blue-100 leading-relaxed">
                    {acto.textoCompleto}
                  </pre>
                </div>
              )}
            </div>
          </section>

          {/* Adjunto Oficial y Firmas Digitales */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-blue-900 flex items-center gap-2">
              <svg
                className="h-4 w-4 text-blue-700"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                />
              </svg>
              Documento Digital Adjunto y Firma Electrónica
            </h3>

            <div className="grid gap-3 sm:grid-cols-2">
              {/* Tarjeta de descarga de documento */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-red-100 p-2 text-red-700 font-bold text-xs">
                      PDF
                    </span>
                    <div>
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {acto.nombreArchivoPdf}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Tamaño: {acto.tamanoArchivo}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1">
                    <p className="text-[11px] font-semibold text-slate-500">
                      Hash SHA-256 (Integridad):
                    </p>
                    <div className="flex items-center gap-1 rounded bg-slate-100 px-2 py-1 font-mono text-[10px] text-slate-700 truncate">
                      <span className="truncate">{acto.hashIntegridadSha256}</span>
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(
                            acto.hashIntegridadSha256,
                            "hash-doc",
                          )
                        }
                        className="ml-auto text-blue-700 hover:text-blue-900 shrink-0 font-sans text-xs font-semibold"
                        title="Copiar Hash"
                      >
                        {copiedHash === "hash-doc" ? "✓" : "Copiar"}
                      </button>
                    </div>

                    <p className="mt-2 text-[11px] font-semibold text-slate-500">
                      Código de Verificación Digital (CVD):
                    </p>
                    <p className="font-mono text-xs font-bold text-blue-800">
                      {acto.cvd}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => casillaService.descargarDocumento(notificacion)}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-2.5 text-xs font-bold text-blue-700 transition hover:bg-blue-100"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  Descargar Acto Administrativo (.PDF)
                </button>
              </div>

              {/* Tarjeta de Firmantes Digitales */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                <p className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                  Firmantes Digitales Validados
                </p>
                <div className="space-y-2.5">
                  {acto.firmantes.map((firmante) => (
                    <div
                      key={firmante.nombre}
                      className="rounded-xl border border-slate-100 bg-slate-50 p-2.5 text-xs"
                    >
                      <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                        <svg
                          className="h-3.5 w-3.5 text-emerald-600 shrink-0"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                          />
                        </svg>
                        <span>{firmante.nombre}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 pl-5">
                        {firmante.cargo}
                      </p>
                      <p className="text-[10px] text-slate-400 pl-5 mt-0.5">
                        Sello: {firmante.fechaFirma}{" "}
                        {firmante.entidadCertificadora &&
                          `• ${firmante.entidadCertificadora}`}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ================================================================ */}
          {/* SECCIÓN CRÍTICA: ACUSE DIGITAL LEGAL (LPAG LEY N° 27444)          */}
          {/* ================================================================ */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-blue-900 flex items-center gap-2">
              <svg
                className="h-4 w-4 text-emerald-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
              Acuse de Notificación Electrónica y Cómputo Legal
            </h3>

            {/* CASO A: YA SE HA GENERADO EL ACUSE LEGAL */}
            {acuse ? (
              <div className="rounded-2xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50/50 via-white to-teal-50/30 p-5 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold text-xs">
                      ✓
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-emerald-950">
                        CÉDULA DE ACUSE DE NOTIFICACIÓN ELECTRÓNICA
                      </h4>
                      <p className="text-xs text-emerald-800">
                        Identificador Oficial: <strong>{acuse.idAcuse}</strong>
                      </p>
                    </div>
                  </div>

                  <span className="rounded-full bg-emerald-100 border border-emerald-300 px-3 py-1 text-xs font-black uppercase tracking-wider text-emerald-800">
                    Validez Jurídica Plena
                  </span>
                </div>

                {/* Datos del Acuse Oficial generados por el servidor */}
                <div className="grid gap-3 sm:grid-cols-2 text-xs">
                  <div>
                    <p className="font-semibold text-slate-500">
                      Timestamp Oficial Servidor (ISO-8601):
                    </p>
                    <div className="mt-1 flex items-center justify-between rounded-lg bg-slate-900 px-3 py-2 font-mono text-emerald-400">
                      <span>{acuse.timestampGeneracionIso}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Hora local certificada:{" "}
                      {formatIsoFecha(acuse.timestampGeneracionIso)}
                    </p>
                  </div>

                  <div>
                    <p className="font-semibold text-slate-500">
                      Hash SHA-256 del Acuse (Inmutable):
                    </p>
                    <div className="mt-1 flex items-center justify-between rounded-lg bg-slate-900 px-3 py-2 font-mono text-xs text-emerald-400">
                      <span className="truncate">{acuse.hashSha256Acuse}</span>
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(acuse.hashSha256Acuse, "hash-acuse")
                        }
                        className="ml-2 text-xs font-sans font-bold text-emerald-300 hover:text-white shrink-0 underline"
                      >
                        {copiedHash === "hash-acuse" ? "Copiado!" : "Copiar"}
                      </button>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      CVD de Verificación:{" "}
                      <strong className="text-slate-800">{acuse.cvdAcuse}</strong>
                    </p>
                  </div>
                </div>

                {/* Surtimiento de Efecto y Cómputo de Plazos */}
                <div className="rounded-xl border border-emerald-200 bg-white p-3.5 text-xs text-slate-700 space-y-1.5">
                  <p className="font-bold text-emerald-900">
                    Efecto Jurídico y Cómputo de Plazos (Art. 20 TUO Ley N° 27444):
                  </p>
                  <p className="text-slate-600 leading-relaxed">
                    {acuse.fechaEfectoLegal}
                  </p>
                  <p className="text-slate-600">
                    • Plazo de atención / impugnación:{" "}
                    <strong>{acuse.plazoImpugnacionDiasHabiles} días hábiles</strong>.
                    {acuse.fechaLimiteImpugnacion && (
                      <span>
                        {" "}
                        (Vencimiento proyectado:{" "}
                        <strong>{acuse.fechaLimiteImpugnacion}</strong>)
                      </span>
                    )}
                  </p>
                </div>

                {/* Botón para descargar Cédula de Acuse Oficial */}
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => casillaService.descargarAcuse(acuse)}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-800"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    Descargar Cédula de Acuse (.TXT / .PDF)
                  </button>
                </div>
              </div>
            ) : (
              /* CASO B: AÚN NO SE HA GENERADO EL ACUSE DIGITAL */
              <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/60 p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white font-bold text-sm">
                    !
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-amber-950">
                      Requisito de Acuse Digital Legal (TUO Ley N° 27444)
                    </h4>
                    <p className="mt-1 text-xs text-amber-900 leading-relaxed">
                      Conforme al Artículo 20 del TUO de la Ley N° 27444, para
                      que la notificación surta plenos efectos jurídicos y se
                      inicie el cómputo legal de plazos, debe generar el acuse de
                      recibo formal.
                    </p>
                  </div>
                </div>

                <div className="rounded-xl bg-white p-3.5 text-xs text-slate-600 border border-amber-200">
                  <p className="font-semibold text-slate-800">
                    Al confirmar el acuse:
                  </p>
                  <ul className="mt-1 list-disc list-inside space-y-0.5 text-slate-600">
                    <li>
                      El servidor del SIGD registrará la marca de tiempo cierta
                      (formato ISO-8601).
                    </li>
                    <li>
                      Se generará y sellará el código criptográfico SHA-256
                      inmutable.
                    </li>
                    <li>
                      Podrá descargar la cédula de acuse como constancia oficial.
                    </li>
                  </ul>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                  <span className="text-[11px] text-amber-800">
                    * Acción certificada y registrada en los logs de auditoría.
                  </span>

                  <button
                    type="button"
                    disabled={isGenerandoAcuse}
                    onClick={() => onGenerarAcuse(notificacion.id)}
                    className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-xs font-bold text-white shadow-md transition hover:bg-blue-800 disabled:cursor-wait disabled:opacity-60"
                  >
                    {isGenerandoAcuse ? (
                      <>
                        <svg
                          className="h-4 w-4 animate-spin text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        Generando acuse legal con timestamp en servidor...
                      </>
                    ) : (
                      <>
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        Generar y Confirmar Acuse Digital Legal
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* ================================================================== */}
        {/* PIE DEL MODAL                                                      */}
        {/* ================================================================== */}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <p className="text-xs text-slate-500">
            IESTP Suiza • Sistema Integral de Gestión Documentaria
          </p>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-100"
            >
              Cerrar
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
