import { useEffect, useRef } from "react";
import QrCodeView from "../common/QrCodeView";
import type { CargoOficialTramite } from "../../types/cargoOficial";

interface CargoDigitalModalProps {
  isOpen: boolean;
  onClose: () => void;
  cargo: CargoOficialTramite;
}

export default function CargoDigitalModal({
  isOpen,
  onClose,
  cargo,
}: CargoDigitalModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  function handleImprimirTicket() {
    window.print();
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
        className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden print:m-0 print:p-0 print:shadow-none print:w-full print:max-w-none"
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
            <p className="font-bold text-sm tracking-wide">IESTP "SUIZA"</p>
            <p className="text-[10px] text-slate-600">PUCALLPA — UCAYALI</p>
            <p className="text-[9px] text-slate-500 mt-0.5">Mesa de Partes y Trámite Documentario</p>
            <p className="text-[9px] text-slate-500">RUC: 20131312955</p>
          </div>

          {/* Código CUT Destacado */}
          <div className="text-center py-1 bg-slate-50 rounded border border-slate-200 print:bg-transparent print:border-black">
            <p className="text-[10px] font-sans font-semibold text-slate-500">CÓDIGO ÚNICO DE TRÁMITE</p>
            <p className="text-base font-extrabold text-blue-700 print:text-black tracking-wider">
              {cargo.codigoExpediente}
            </p>
          </div>

          {/* Código QR Centrado */}
          <div className="flex justify-center py-1">
            <QrCodeView
              value={cargo.urlSeguimiento}
              size={140}
              ariaLabel={`QR para seguimiento del trámite ${cargo.codigoExpediente}`}
            />
          </div>
          <p className="text-center text-[9px] text-slate-500">
            Escanee para consultar estado en línea 24/7
          </p>

          {/* Datos del Trámite */}
          <div className="border-t border-b border-dashed border-slate-400 py-3 space-y-1.5 text-[11px]">
            <p>
              <span className="font-bold">Solicitante:</span>{" "}
              {cargo.solicitante.nombreOrazonSocial}
            </p>
            <p>
              <span className="font-bold">{cargo.solicitante.tipoDocumento}:</span>{" "}
              {cargo.solicitante.numeroDocumento}
            </p>
            <p>
              <span className="font-bold">Asunto:</span> {cargo.asunto}
            </p>
            <p>
              <span className="font-bold">Doc. Principal:</span> {cargo.documentoPrincipalTipo}
            </p>
            <p>
              <span className="font-bold">Folios:</span> {cargo.cantidadFolios} foja(s)
            </p>
            <p>
              <span className="font-bold">Fecha / Hora:</span>{" "}
              {cargo.horaRecepcion}
            </p>
            <p>
              <span className="font-bold">Operador:</span>{" "}
              {cargo.operadorVentanillaNombre}
            </p>
          </div>

          {/* Notificación de Horario de Corte LPAG */}
          {cargo.radicadoDiaSiguiente && (
            <div className="rounded bg-amber-50 p-2 text-[10px] border border-amber-300 text-amber-900 print:border-black">
              <p className="font-bold">⚠️ NOTA NORMATIVA LEY N.° 27444:</p>
              <p className="leading-snug mt-0.5">
                Ingreso registrado después del corte de las {cargo.horaCorteAplicada} hrs.
                La radicación formal se computa a partir de las 08:00 hrs del día hábil siguiente.
              </p>
            </div>
          )}

          {/* Hash de Integridad y Pie */}
          <div className="text-[9px] text-slate-500 text-center space-y-1 pt-1">
            <p className="font-mono break-all">
              Hash: {cargo.hashSha256Recepcion.slice(0, 32)}…
            </p>
            <p>Conserve este cargo oficial para todo reclamo.</p>
            <p className="text-[8px] italic">Plataforma SIGD · TUO Ley N.° 27444</p>
          </div>
        </div>

        {/* Acciones del Modal (Ocultas en Impresión) */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={handleImprimirTicket}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-800 transition"
          >
            🖨️ Imprimir Ticket Térmico
          </button>
        </div>
      </div>
    </div>
  );
}
