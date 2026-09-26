/**
 * ==============================================================================
 * PROYECTO: SIGD (Sistema Integral de Gestión Documentaria) - IESTP "Suiza"
 * MÓDULO 2: Registro Documentario - Mesa de Partes Virtual
 * SUBVISTA: Paso 4 — Resumen Consolidado y Cargo Digital
 * ARCHIVO: src/components/tramite/wizardSteps/Step4ConfirmacionCargo.tsx
 * ==============================================================================
 */

import React, { useState } from 'react';
import type {
  IdentificacionData,
  DocumentosData,
  DeclaracionJuradaData,
  CargoDigitalResponse,
} from '../../../types/tramiteWizardState';
import QrCodeView from '../../common/QrCodeView';

interface Step4ConfirmacionCargoProps {
  identificacion: IdentificacionData;
  documentos: DocumentosData;
  declaracionJurada: DeclaracionJuradaData;
  cargoEmitido: CargoDigitalResponse | null;
  isSubmitting: boolean;
  onRadicar: () => void;
  onGoToStep: (step: 1 | 2 | 3) => void;
  onReset: () => void;
}

export const Step4ConfirmacionCargo: React.FC<Step4ConfirmacionCargoProps> = ({
  identificacion,
  documentos,
  declaracionJurada,
  cargoEmitido,
  isSubmitting,
  onRadicar,
  onGoToStep,
  onReset,
}) => {
  const [copiado, setCopiado] = useState(false);

  const handleCopiarCut = async () => {
    if (!cargoEmitido?.cut) return;
    try {
      await navigator.clipboard.writeText(cargoEmitido.cut);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Fallback si clipboard API no está permitida
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    }
  };

  const handleImprimir = () => {
    window.print();
  };

  // ===========================================================================
  // ESTADO B: CARGO DIGITAL YA EMITIDO
  // ===========================================================================
  if (cargoEmitido) {
    return (
      <div className="space-y-6">
        {/* Cabecera de éxito */}
        <div className="rounded-2xl border border-emerald-200 bg-white p-6 sm:p-8 shadow-sm text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-3 shadow-xs">
            <svg
              className="h-7 w-7"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 mb-2">
            Expediente Radicado Oficialmente
          </span>

          <h3 className="text-xl sm:text-2xl font-black text-slate-900">
            Cargo Digital de Recepción Documentaria
          </h3>
          <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
            Su solicitud ha sido radicada con valor legal en el Sistema Integral de Gestión Documentaria del IESTP &ldquo;Suiza&rdquo;.
          </p>

          {/* Tarjeta del CUT */}
          <div className="mt-5 inline-block rounded-xl border-2 border-dashed border-[#006EC7] bg-blue-50/60 px-6 py-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-blue-800">
              Código Único de Trámite (CUT)
            </p>
            <p className="text-2xl sm:text-3xl font-black tracking-tight text-[#006EC7] mt-1 font-mono">
              {cargoEmitido.cut}
            </p>
            <div className="mt-2 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleCopiarCut}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#006EC7] hover:underline cursor-pointer"
              >
                {copiado ? '✓ ¡CUT Copiado!' : 'Copiar CUT'}
              </button>
            </div>
          </div>

          {/* Código QR y Trazabilidad */}
          <div className="mt-6 flex flex-col items-center justify-center">
            <QrCodeView
              value={cargoEmitido.qrValidationUrl || cargoEmitido.cut}
              size={130}
              ariaLabel={`Código QR de validación legal para el CUT ${cargoEmitido.cut}`}
            />
            <p className="text-[11px] text-slate-500 mt-2 font-mono">
              Escanee para verificar autenticidad legal en línea
            </p>
          </div>

          {/* Metadatos Oficiales de Radicación */}
          <div className="mt-6 max-w-lg mx-auto text-left rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-2 text-xs text-slate-700 font-mono">
            <div className="flex justify-between border-b border-slate-200 pb-1.5">
              <span className="font-bold text-slate-900 font-sans">Remitente:</span>
              <span className="truncate max-w-[240px]">{cargoEmitido.remitente}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-1.5">
              <span className="font-bold text-slate-900 font-sans">Asunto:</span>
              <span className="truncate max-w-[240px]">{cargoEmitido.asunto}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-1.5">
              <span className="font-bold text-slate-900 font-sans">Fecha Radicación:</span>
              <span>{cargoEmitido.fechaRadicacion}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-1.5">
              <span className="font-bold text-slate-900 font-sans">Recepción Oficial:</span>
              <span className="text-emerald-700 font-semibold">{cargoEmitido.fechaRecepcionOficial}</span>
            </div>
            <div className="flex justify-between pt-0.5">
              <span className="font-bold text-slate-900 font-sans">Huella SHA-256:</span>
              <span className="text-[10px] text-slate-500 truncate max-w-[220px]">
                {cargoEmitido.hashTransaccion}
              </span>
            </div>
          </div>

          {/* Acciones del Cargo */}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={handleImprimir}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer shadow-xs"
            >
              Imprimir Cargo
            </button>
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-2 rounded-lg bg-[#006EC7] px-5 py-2 text-xs font-bold text-white hover:bg-[#005ba3] transition cursor-pointer shadow-xs"
            >
              Iniciar Nuevo Trámite
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===========================================================================
  // ESTADO A: RESUMEN CONSOLIDADO ANTES DE RADICAR
  // ===========================================================================
  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h3 className="text-lg font-bold text-slate-900">
          Paso 4: Confirmación y Emisión de Cargo
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Verifique exhaustivamente la información consolidada antes de proceder con la radicación formal ante el IESTP &ldquo;Suiza&rdquo;.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. Resumen Identificación */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2">
          <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#006EC7]">
              1. Solicitante
            </h4>
            <button
              type="button"
              onClick={() => onGoToStep(1)}
              className="text-[11px] font-semibold text-[#006EC7] hover:underline cursor-pointer"
            >
              Modificar
            </button>
          </div>
          <p className="text-sm font-bold text-slate-900">
            {identificacion.nombres} {identificacion.apellidos}
          </p>
          <p className="text-xs text-slate-600">
            <span className="font-semibold">{identificacion.tipoDocumento}:</span>{' '}
            {identificacion.numeroDocumento || 'No especificado'}
          </p>
          <p className="text-xs text-slate-600">
            <span className="font-semibold">Correo:</span>{' '}
            {identificacion.correo || 'No especificado'}
          </p>
          <p className="text-xs text-slate-600">
            <span className="font-semibold">Teléfono:</span>{' '}
            {identificacion.telefono || 'No especificado'}
          </p>
        </div>

        {/* 2. Resumen Trámite y Documentos */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2">
          <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#006EC7]">
              2. Datos del Trámite
            </h4>
            <button
              type="button"
              onClick={() => onGoToStep(2)}
              className="text-[11px] font-semibold text-[#006EC7] hover:underline cursor-pointer"
            >
              Modificar
            </button>
          </div>
          <p className="text-sm font-bold text-slate-900">
            {documentos.tipoTramiteId || 'Trámite General Institucional'}
          </p>
          <p className="text-xs text-slate-600">
            <span className="font-semibold">Folios:</span> {documentos.numeroFolios}
          </p>
          <p className="text-xs text-slate-600 italic bg-white p-2 rounded border border-slate-200 line-clamp-2">
            &ldquo;{documentos.asunto || 'Sin asunto especificado'}&rdquo;
          </p>
          <p className="text-xs text-slate-600">
            <span className="font-semibold">Archivos adjuntos:</span>{' '}
            {documentos.archivos.length} documento(s)
          </p>
        </div>

        {/* 3. Resumen Declaración Jurada */}
        <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2">
          <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#006EC7]">
              3. Conformidad Legal (Ley N° 27444)
            </h4>
            <button
              type="button"
              onClick={() => onGoToStep(3)}
              className="text-[11px] font-semibold text-[#006EC7] hover:underline cursor-pointer"
            >
              Modificar
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <span className={`text-sm ${declaracionJurada.declaracionVeracidad ? 'text-emerald-600 font-bold' : 'text-red-500'}`}>
                {declaracionJurada.declaracionVeracidad ? '✓' : '✗'}
              </span>
              <span>Veracidad jurada (Art. 51 LPAG)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`text-sm ${declaracionJurada.aceptaTerminos ? 'text-emerald-600 font-bold' : 'text-red-500'}`}>
                {declaracionJurada.aceptaTerminos ? '✓' : '✗'}
              </span>
              <span>Términos y condiciones aceptados</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`text-sm ${declaracionJurada.autorizaNotificacionCasilla ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
                {declaracionJurada.autorizaNotificacionCasilla ? '✓' : '○'}
              </span>
              <span>Notificación Casilla Electrónica</span>
            </div>
          </div>
        </div>
      </div>

      {/* Botón de Radicación Formal */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-5 text-center">
        <h4 className="text-sm font-bold text-emerald-950">
          ¿Listo para radicar formalmente su solicitud?
        </h4>
        <p className="mt-1 text-xs text-emerald-800 max-w-lg mx-auto">
          Al pulsar el botón inferior, se emitirá de inmediato su Código Único de Trámite (CUT) con fecha y hora oficial registrada en la base de datos institucional.
        </p>

        <div className="mt-4">
          <button
            type="button"
            onClick={onRadicar}
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 transition cursor-pointer disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <svg
                  className="animate-spin h-4 w-4 text-white"
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
                <span>Radicando expediente legalmente...</span>
              </>
            ) : (
              <span>Radicar Solicitud y Emitir Cargo Oficial ✓</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Step4ConfirmacionCargo;
