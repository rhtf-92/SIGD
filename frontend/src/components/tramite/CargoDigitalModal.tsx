/**
 * ==============================================================================
 * PROYECTO: SIGD (Sistema Integral de Gestión Documentaria) - IESTP "Suiza"
 * MÓDULO 2: Registro Documentario - Mesa de Partes Virtual
 * TAREA: T-FE-MPV-16 — Modal Institucional CargoDigitalModal con Acciones Legales
 * ARCHIVO: src/components/tramite/CargoDigitalModal.tsx
 * ==============================================================================
 * DESCRIPCIÓN:
 * Modal institucional accesible (WCAG 2.1 AA) para la visualización y emisión del
 * Cargo de Recepción Digital probatorio tras la radicación formal de un expediente.
 *
 * Características principales:
 * - Cabecera institucional con fecha y hora certificada conforme a Ley N° 27444.
 * - Bloque de Código Único de Trámite (CUT) con copiado interactivo al portapapeles.
 * - Trazabilidad pública mediante código QR vectorial determinista (<QrCodeView />).
 * - Metadatos de integridad: Remitente, Asunto y Hash SHA-256 de la transacción.
 * - Botones de acción legal: Descargar Cargo (PDF), Acceder a Casilla, Imprimir Ticket y Cerrar.
 * - Manejo de foco (Focus Trap), tecla Escape y accesibilidad aria-modal/dialog.
 * - Soporte bimodal: consume CargoDigitalResponse y retrocompatibilidad con CargoOficialTramite.
 * - Cero 'any' (PEN-06), compatible con verbatimModuleSyntax y React 18 / 19.
 * ==============================================================================
 */

import React, { useEffect, useRef, useState, useCallback, useId } from 'react';
import type { CargoDigitalResponse } from '../../types/tramiteWizardState';
import type { CargoOficialTramite } from '../../types/cargoOficial';
import QrCodeView from '../common/QrCodeView';

export interface CargoDigitalModalProps {
  /** Controla la apertura y visibilidad del modal */
  isOpen: boolean;
  /** Datos del cargo digital emitido en la radicación (Mesa de Partes Virtual) */
  cargoData?: CargoDigitalResponse;
  /** Datos alternativos del cargo emitido en ventanilla presencial (retrocompatibilidad) */
  cargo?: CargoOficialTramite;
  /** Callback para cerrar el diálogo modal */
  onClose: () => void;
  /** Callback opcional al pulsar en descargar PDF */
  onDownloadPdf?: () => void;
}

export const CargoDigitalModal: React.FC<CargoDigitalModalProps> = ({
  isOpen,
  cargoData,
  cargo,
  onClose,
  onDownloadPdf,
}) => {
  const modalId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [copiado, setCopiado] = useState<boolean>(false);

  // Normalización segura y exhaustiva de los datos del cargo provisto
  const resolvedCargo = React.useMemo(() => {
    if (cargoData) {
      return {
        cut: cargoData.cut,
        fechaRadicacion: cargoData.fechaRadicacion,
        fechaRecepcionOficial: cargoData.fechaRecepcionOficial,
        asunto: cargoData.asunto,
        remitente: cargoData.remitente,
        hashTransaccion: cargoData.hashTransaccion,
        qrValidationUrl:
          cargoData.qrValidationUrl ||
          `https://sigd.iestpsuiza.edu.pe/consulta/${cargoData.cut}`,
        esFueraDeHorario: false,
        horaCorteAplicada: undefined as string | undefined,
        cantidadFolios: undefined as number | undefined,
        documentoPrincipalTipo: undefined as string | undefined,
      };
    }

    if (cargo) {
      const remitenteTexto =
        cargo.solicitante.tipoPersona === 'JURIDICA'
          ? cargo.solicitante.nombreOrazonSocial
          : `${cargo.solicitante.nombreOrazonSocial} (${cargo.solicitante.tipoDocumento}: ${cargo.solicitante.numeroDocumento})`;

      return {
        cut: cargo.codigoExpediente,
        fechaRadicacion: `${cargo.fechaRecepcionIso.substring(0, 10)} ${cargo.horaRecepcion}`,
        fechaRecepcionOficial: cargo.fechaIngresoFormalIso,
        asunto: cargo.asunto,
        remitente: remitenteTexto,
        hashTransaccion: cargo.hashSha256Recepcion,
        qrValidationUrl:
          cargo.urlSeguimiento ||
          `https://sigd.iestpsuiza.edu.pe/tramite?cut=${cargo.codigoExpediente}`,
        esFueraDeHorario: Boolean(cargo.radicadoDiaSiguiente),
        horaCorteAplicada: cargo.horaCorteAplicada,
        cantidadFolios: cargo.cantidadFolios,
        documentoPrincipalTipo: cargo.documentoPrincipalTipo,
      };
    }

    return null;
  }, [cargoData, cargo]);

  // Manejo accesible de teclado: tecla Escape y trampa de foco
  useEffect(() => {
    if (!isOpen) return;

    // Foco automático en el botón de cierre al abrir el modal
    const focusTimer = setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      // Confinamiento cíclico de tabulación (Focus Trap)
      if (e.key === 'Tab' && dialogRef.current) {
        const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Copiado interactivo del CUT al portapapeles
  const handleCopiarCut = useCallback(async () => {
    if (!resolvedCargo?.cut) return;

    try {
      await navigator.clipboard.writeText(resolvedCargo.cut);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Fallback seguro si clipboard API está restringida
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    }
  }, [resolvedCargo?.cut]);

  // Descarga del Cargo Digital en formato PDF o impresión
  const handleDescargarPdf = useCallback(() => {
    if (onDownloadPdf) {
      onDownloadPdf();
    } else {
      window.print();
    }
  }, [onDownloadPdf]);

  // Redirección hacia la Casilla Electrónica
  const handleAccederCasilla = useCallback(() => {
    onClose();
    try {
      window.location.href = '/casilla';
    } catch {
      // Ignorar excepción de navegación no implementada en JSDOM
    }
  }, [onClose]);

  if (!isOpen || !resolvedCargo) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${modalId}-title`}
      aria-describedby={`${modalId}-desc`}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/70 p-4 backdrop-blur-xs transition-opacity animate-fadeIn"
    >
      <div
        ref={dialogRef}
        className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200 print:m-0 print:p-0 print:shadow-none print:w-full print:max-w-none print:border-none"
      >
        {/* ===================================================================
            1. CABECERA INSTITUCIONAL OFICIAL (Oculta en Impresión Ticket)
            =================================================================== */}
        <header className="flex items-start justify-between border-b border-slate-200 bg-linear-to-r from-blue-50 via-sky-50/60 to-slate-50 px-6 py-4.5 print:hidden">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#006EC7] text-white shadow-xs">
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-[#006EC7]">
                IESTP &ldquo;SUIZA&rdquo; · MESA DE PARTES
              </span>
              <h2
                id={`${modalId}-title`}
                className="text-lg font-black tracking-tight text-slate-900"
              >
                Cargo de Recepción Digital
              </h2>
              <p id={`${modalId}-desc`} className="text-xs text-slate-500 mt-0.5">
                Certificación oficial con valor legal según el TUO de la Ley N° 27444.
              </p>
            </div>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition cursor-pointer"
            aria-label="Cerrar ventana de cargo"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </header>

        {/* ===================================================================
            2. CUERPO DEL CARGO / TICKET OFICIAL (Formato Ticket & A4)
            =================================================================== */}
        <div className="p-6 space-y-5 print:p-2 print:text-black">
          {/* Encabezado Imprimible Institucional */}
          <div className="text-center border-b border-dashed border-slate-300 pb-3 print:border-black">
            <p className="font-black text-sm tracking-wider text-slate-900 print:text-black uppercase">
              IESTP &ldquo;Suiza&rdquo; de Pucallpa
            </p>
            <p className="text-[11px] font-semibold text-slate-600 print:text-black">
              Mesa de Partes Virtual y Trámite Documentario
            </p>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">
              RUC: 20131312955 • Jr. Tarapacá N° 645, Coronel Portillo, Ucayali
            </p>
          </div>

          {/* Bloque Destacado del CUT con Botón Interactivo de Copiado */}
          <div className="rounded-xl border-2 border-dashed border-[#006EC7] bg-blue-50/70 p-4 text-center shadow-xs">
            <p className="text-[11px] font-bold uppercase tracking-wider text-blue-900">
              Código Único de Trámite (CUT Oficial)
            </p>
            <p className="mt-1 font-mono text-2xl sm:text-3xl font-black tracking-tight text-[#006EC7] print:text-black">
              {resolvedCargo.cut}
            </p>

            <div className="mt-2.5 flex items-center justify-center print:hidden">
              <button
                type="button"
                onClick={handleCopiarCut}
                className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1 text-xs font-bold text-[#006EC7] shadow-xs border border-blue-200 hover:bg-blue-50 transition cursor-pointer"
                aria-live="polite"
              >
                {copiado ? (
                  <>
                    <svg
                      className="h-3.5 w-3.5 text-emerald-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span className="text-emerald-700">¡Copiado!</span>
                  </>
                ) : (
                  <>
                    <svg
                      className="h-3.5 w-3.5 text-[#006EC7]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    <span>Copiar CUT</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Código QR Interactivo de Trazabilidad Pública */}
          <div className="flex flex-col items-center justify-center py-1">
            <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs">
              <QrCodeView
                value={resolvedCargo.qrValidationUrl}
                size={135}
                ariaLabel={`Código QR de verificación legal. QR para seguimiento del trámite ${resolvedCargo.cut}`}
              />
            </div>
            <p className="mt-2 text-center text-[10px] text-slate-500 font-medium">
              Escanee para verificar autenticidad en la plataforma pública 24/7
            </p>
          </div>

          {/* Metadatos Estructurados del Trámite */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-2 text-xs text-slate-700">
            <div className="flex flex-col sm:flex-row sm:justify-between border-b border-slate-200/80 pb-1.5 gap-0.5">
              <span className="font-bold text-slate-900 shrink-0">Remitente / Administrado:</span>
              <span className="sm:text-right font-medium text-slate-800 break-words">
                {resolvedCargo.remitente}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:justify-between border-b border-slate-200/80 pb-1.5 gap-0.5">
              <span className="font-bold text-slate-900 shrink-0">Asunto o Petitorio:</span>
              <span className="sm:text-right font-medium text-slate-800 break-words line-clamp-2">
                {resolvedCargo.asunto}
              </span>
            </div>

            {resolvedCargo.documentoPrincipalTipo && (
              <div className="flex justify-between border-b border-slate-200/80 pb-1.5">
                <span className="font-bold text-slate-900">Doc. Principal:</span>
                <span>{resolvedCargo.documentoPrincipalTipo}</span>
              </div>
            )}

            {resolvedCargo.cantidadFolios !== undefined && (
              <div className="flex justify-between border-b border-slate-200/80 pb-1.5">
                <span className="font-bold text-slate-900">Folios:</span>
                <span>{resolvedCargo.cantidadFolios} foja(s)</span>
              </div>
            )}

            <div className="flex justify-between border-b border-slate-200/80 pb-1.5">
              <span className="font-bold text-slate-900">Fecha y Hora de Radicación:</span>
              <span className="font-mono text-slate-800">{resolvedCargo.fechaRadicacion}</span>
            </div>

            <div className="flex justify-between border-b border-slate-200/80 pb-1.5">
              <span className="font-bold text-slate-900">Recepción Oficial (LPAG):</span>
              <span className="font-mono font-semibold text-emerald-700">
                {resolvedCargo.fechaRecepcionOficial}
              </span>
            </div>

            <div className="flex flex-col pt-0.5 space-y-0.5">
              <span className="font-bold text-slate-900 text-[11px]">
                Hash SHA-256 de Transacción e Integridad:
              </span>
              <span
                className="font-mono text-[10px] text-slate-500 break-all bg-white p-1.5 rounded border border-slate-200"
                title={resolvedCargo.hashTransaccion}
              >
                {resolvedCargo.hashTransaccion}
              </span>
            </div>
          </div>

          {/* Nota Normativa en caso de corte posterior a 16:30 hrs */}
          {resolvedCargo.esFueraDeHorario && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <p className="font-bold">⚠️ Nota Normativa LPAG (Ley N° 27444):</p>
              <p className="mt-0.5 text-[11px] leading-relaxed">
                El trámite fue presentado fuera del horario hábil de atención
                {resolvedCargo.horaCorteAplicada ? ` (${resolvedCargo.horaCorteAplicada} hrs)` : ''}.
                El cómputo de plazos procesales inicia formalmente a las 08:00 horas del siguiente día hábil institucional.
              </p>
            </div>
          )}
        </div>

        {/* ===================================================================
            3. BOTONERA DE ACCIONES LEGALES AL PIE (Oculta en Impresión)
            =================================================================== */}
        <footer className="flex flex-wrap items-center justify-end gap-2.5 border-t border-slate-200 bg-slate-50 px-6 py-4 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            Finalizar y Cerrar
          </button>

          <button
            type="button"
            onClick={handleAccederCasilla}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#006EC7] bg-blue-50 px-3.5 py-2 text-xs font-bold text-[#006EC7] shadow-xs hover:bg-blue-100 transition cursor-pointer"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            <span>Acceder a Casilla Electrónica</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            🖨️ Imprimir Ticket Térmico
          </button>

          <button
            type="button"
            onClick={handleDescargarPdf}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#006EC7] px-4.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#005ba3] transition cursor-pointer"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            <span>Descargar Cargo Digital (PDF)</span>
          </button>
        </footer>
      </div>
    </div>
  );
};

export default CargoDigitalModal;
