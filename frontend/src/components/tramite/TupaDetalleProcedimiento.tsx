import React from 'react';
import { Info, CheckCircle2, ShieldCheck } from 'lucide-react';
import type { ProcedimientoTupa } from '../../types/procedimientoTupa';

export interface TupaDetalleProcedimientoProps {
  procedimiento: ProcedimientoTupa;
  mostrarRequisitos?: boolean;
  children?: React.ReactNode;
}

export const TupaDetalleProcedimiento: React.FC<TupaDetalleProcedimientoProps> = ({
  procedimiento,
  mostrarRequisitos = true,
  children,
}) => {
  const { codigo, denominacion, requisitos, monto, fuente, version, vigencia, estadoValidacion } = procedimiento;
  const vigenciaTexto = vigencia
    ? [vigencia.desde ? `desde ${vigencia.desde}` : null, vigencia.hasta ? `hasta ${vigencia.hasta}` : null]
        .filter(Boolean)
        .join(' ')
    : null;

  const esMontoGratuito =
    !monto ||
    monto.trim() === '0' ||
    monto.trim() === 'S/ 0.00' ||
    monto.trim() === 'S/. 0.00' ||
    monto.trim() === 'S/ 0' ||
    monto.trim().toLowerCase() === 'gratuito';

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 space-y-3">
      {/* Aviso contextual oficial TUPA */}
      <div className="rounded-lg border border-blue-200 bg-white/90 p-2.5 text-xs text-blue-900 flex items-start gap-2 shadow-xs">
        <Info className="h-4 w-4 text-blue-700 shrink-0 mt-0.5" />
        <span>
          <strong>Aviso al administrado:</strong> Consulta requisitos, costos y condiciones oficiales antes de presentar tu solicitud.
        </span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b border-blue-200 pb-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-bold">
              <CheckCircle2 className="h-3 w-3" />
              {estadoValidacion === 'APROBADO' ? 'Procedimiento Aprobado (TUPA 2026)' : 'Pendiente de Validación'}
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              Ref: {fuente.referenciaFila}
            </span>
          </div>

          <h3 className="text-sm font-bold text-slate-900 leading-snug">
            {codigo ? `TUPA ${codigo}: ${denominacion}` : denominacion}
          </h3>

          <dl className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
            <div>
              <dt className="inline font-semibold text-slate-700">Fuente Oficial:</dt>{' '}
              <dd className="inline">{fuente.nombre} (Pág. {fuente.pagina})</dd>
            </div>
            <div>
              <dt className="inline font-semibold text-slate-700">Unidad Responsable:</dt>{' '}
              <dd className="inline">Secretaría Académica / Dirección</dd>
            </div>
            <div>
              <dt className="inline font-semibold text-slate-700">Plazo de Atención:</dt>{' '}
              <dd className="inline">Hasta 30 días hábiles (TUO Ley N.° 27444)</dd>
            </div>
            <div>
              <dt className="inline font-semibold text-slate-700">Tipo de Calificación:</dt>{' '}
              <dd className="inline">Evaluación previa / Silencio administrativo</dd>
            </div>
          </dl>
        </div>

        <div className="text-left sm:text-right shrink-0">
          <span className="text-[11px] font-medium text-slate-500 block">Derecho de tramitación:</span>
          {esMontoGratuito ? (
            <span className="inline-block mt-0.5 rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800 border border-emerald-200">
              Gratuito
            </span>
          ) : (
            <p className="mt-0.5 text-base font-extrabold text-blue-900">
              {monto} <span className="text-xs font-medium text-slate-600">(PEN)</span>
            </p>
          )}
        </div>
      </div>

      {mostrarRequisitos && requisitos.length > 0 && (
        <div className="mt-2">
          <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-blue-700" />
            Requisitos documentarios obligatorios
          </h4>
          <ul className="grid gap-1.5 text-xs text-slate-700 sm:grid-cols-2 bg-white/70 p-3 rounded-lg border border-blue-100">
            {requisitos.map((requisito, index) => (
              <li key={`${procedimiento.registroVersionId}-req-${index}`} className="flex items-start gap-1.5">
                <span className="text-blue-600 font-bold">•</span>
                <span>{requisito}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {children}

      <dl className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 border-t border-blue-200 pt-2 text-[11px] text-slate-500">
        <div>
          <dt className="font-bold text-slate-700">Versión y Registro</dt>
          <dd className="mt-0.5 text-slate-600">{version.etiqueta ?? 'TUPA 2026 - V1'} (Rev. {fuente.pagina})</dd>
        </div>
        <div>
          <dt className="font-bold text-slate-700">Base Normativa</dt>
          <dd className="mt-0.5 text-slate-600">TUO Ley N.° 27444 (D.S. 006-2026-JUS) • Ley 28693</dd>
        </div>
        {vigenciaTexto && (
          <div>
            <dt className="font-bold text-slate-700">Vigencia</dt>
            <dd className="mt-0.5 text-slate-600">{vigenciaTexto}</dd>
          </div>
        )}
      </dl>
    </div>
  );
};

export default TupaDetalleProcedimiento;
