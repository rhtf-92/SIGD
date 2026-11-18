import { useEffect, useRef, useState } from "react";
import QrCodeView from "../common/QrCodeView";
import type { CargoOficialTramite } from "../../types/cargoOficial";
import type { CargoDigitalResponse } from "../../types/tramiteWizardState";

export type CargoModalPayload = CargoOficialTramite | CargoDigitalResponse;

export interface CargoDigitalModalProps {
  isOpen: boolean;
  onClose: () => void;
  cargo: CargoModalPayload;
}

export default function CargoDigitalModal({
  isOpen,
  onClose,
  cargo,
}: CargoDigitalModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    focusable?.item(0)?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key !== "Tab" || !focusable?.length) return;

      const first = focusable.item(0);
      const last = focusable.item(focusable.length - 1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen || !cargo) return null;

  // Normalización polimórfica de propiedades
  const isDigitalResponse = "cut" in cargo;
  const codigoCut = isDigitalResponse ? cargo.cut : cargo.codigoExpediente;
  const solicitanteNombre = isDigitalResponse
    ? cargo.remitente
    : cargo.solicitante.nombreOrazonSocial;
  const tipoDoc = isDigitalResponse ? "DOC" : cargo.solicitante.tipoDocumento;
  const numDoc = isDigitalResponse ? "" : cargo.solicitante.numeroDocumento;
  const asunto = cargo.asunto;
  const folios = isDigitalResponse ? 1 : cargo.cantidadFolios;
  const docPrincipalTipo = isDigitalResponse ? "SOLICITUD DIGITAL" : cargo.documentoPrincipalTipo;
  const horaRecepcion = isDigitalResponse
    ? cargo.fechaRecepcionOficial
    : cargo.horaRecepcion;
  const operador = isDigitalResponse
    ? "Mesa de Partes Virtual"
    : cargo.operadorVentanillaNombre;
  const urlSeguimiento = isDigitalResponse
    ? cargo.qrValidationUrl
    : cargo.urlSeguimiento;
  const hashSha256 = isDigitalResponse
    ? cargo.hashTransaccion
    : cargo.hashSha256Recepcion;
  const radicadoDiaSiguiente = !isDigitalResponse && cargo.radicadoDiaSiguiente;
  const horaCorteAplicada = !isDigitalResponse ? cargo.horaCorteAplicada : "16:30";

  function handleImprimirTicket() {
    window.print();
  }

  async function handleCopiarCut() {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(codigoCut);
      }
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    }
  }

  function handleDescargarPdf() {
    window.print();
  }

  function handleAccederCasilla() {
    window.location.href = "/casilla";
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-cargo-modal"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm"
    >
      <div
        ref={dialogRef}
        className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden print:m-0 print:p-0 print:shadow-none print:w-full print:max-w-none"
      >
        {/* Cabecera del Modal (Oculta en Impresión) */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4 print:hidden">
          <div>
            <h3 id="titulo-cargo-modal" className="text-sm font-bold text-slate-900">
              Cargo de Recepción Digital (CUT)
            </h3>
            <p className="text-xs text-slate-500">Mesa de Partes / Ventanilla Presencial</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
            aria-label="Cerrar ventana de cargo"
          >
            ✕
          </button>
        </div>

        {/* TICKET TÉRMICO IMPRIMIBLE (80mm / 58mm / A4) */}
        <div className="p-6 font-mono text-xs text-slate-900 space-y-4 print:p-2 print:text-black">
          {/* Encabezado del Ticket */}
          <div className="text-center border-b border-dashed border-slate-400 pb-3">
            <p className="font-bold text-sm tracking-wide">IESTP &ldquo;SUIZA&rdquo;</p>
            <p className="text-[10px] text-slate-600">PUCALLPA — UCAYALI</p>
            <p className="text-[9px] text-slate-500 mt-0.5">Mesa de Partes y Trámite Documentario</p>
            <p className="text-[9px] text-slate-500">RUC: 20131312955</p>
          </div>

          {/* Código CUT Destacado */}
          <div className="text-center py-2 bg-slate-50 rounded border border-slate-200 print:bg-transparent print:border-black">
            <p className="text-[10px] font-sans font-semibold text-slate-500">CÓDIGO ÚNICO DE TRÁMITE</p>
            <p className="text-lg font-black text-blue-700 print:text-black tracking-wider font-mono">
              {codigoCut}
            </p>
          </div>

          {/* Código QR Centrado */}
          <div className="flex justify-center py-1">
            <QrCodeView
              value={urlSeguimiento || codigoCut}
              size={140}
              ariaLabel={`QR para seguimiento del trámite ${codigoCut}`}
            />
          </div>
          <p className="text-center text-[9px] text-slate-500">
            Escanee para consultar estado en línea 24/7
          </p>

          {/* Datos del Trámite */}
          <div className="border-t border-b border-dashed border-slate-400 py-3 space-y-1.5 text-[11px]">
            <p>
              <span className="font-bold">Solicitante:</span>{" "}
              {solicitanteNombre}
            </p>
            {numDoc ? (
              <p>
                <span className="font-bold">{tipoDoc}:</span>{" "}
                {numDoc}
              </p>
            ) : null}
            <p>
              <span className="font-bold">Asunto:</span> {asunto}
            </p>
            <p>
              <span className="font-bold">Doc. Principal:</span> {docPrincipalTipo}
            </p>
            <p>
              <span className="font-bold">Folios:</span> {folios} foja(s)
            </p>
            <p>
              <span className="font-bold">Fecha / Hora:</span>{" "}
              {horaRecepcion}
            </p>
            <p>
              <span className="font-bold">Operador:</span>{" "}
              {operador}
            </p>
          </div>

          {/* Notificación de Horario de Corte LPAG */}
          {radicadoDiaSiguiente && (
            <div className="rounded bg-amber-50 p-2 text-[10px] border border-amber-300 text-amber-900 print:border-black">
              <p className="font-bold">⚠️ NOTA NORMATIVA LEY N.° 27444:</p>
              <p className="leading-snug mt-0.5">
                Ingreso registrado después del corte de las {horaCorteAplicada} hrs.
                La radicación formal se computa a partir de las 08:00 hrs del día hábil siguiente.
              </p>
            </div>
          )}

          {/* Hash de Integridad y Pie */}
          <div className="text-[9px] text-slate-500 text-center space-y-1 pt-1">
            <p className="font-mono break-all">
              Hash: {hashSha256 ? hashSha256.slice(0, 32) : "n/a"}…
            </p>
            <p>Conserve este cargo oficial para todo reclamo.</p>
            <p className="text-[8px] italic">Plataforma SIGD · TUO Ley N.° 27444</p>
          </div>
        </div>

        {/* Acciones del Modal (Ocultas en Impresión) */}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 print:hidden">
          <button
            type="button"
            onClick={handleCopiarCut}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            {copiado ? "✓ ¡Copiado!" : "Copiar CUT"}
          </button>
          <button
            type="button"
            onClick={handleDescargarPdf}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            Descargar Cargo Digital (PDF)
          </button>
          <button
            type="button"
            onClick={handleAccederCasilla}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            Acceder a Casilla Electrónica
          </button>
          <button
            type="button"
            onClick={handleImprimirTicket}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-800 transition cursor-pointer"
          >
            🖨️ Imprimir Ticket Térmico
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            Finalizar y Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
