import React from 'react';

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
  const { codigo, denominacion, requisitos, monto, fuente, version, vigencia } = procedimiento;
  const vigenciaTexto = vigencia
    ? [vigencia.desde ? `desde ${vigencia.desde}` : null, vigencia.hasta ? `hasta ${vigencia.hasta}` : null]
        .filter(Boolean)
        .join(' ')
    : null;

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-blue-200 pb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            {codigo ? `TUPA ${codigo}: ${denominacion}` : denominacion}
          </h3>
          <dl className="mt-1 text-xs text-slate-600">
            <div><dt className="inline font-semibold">Fuente:</dt> <dd className="inline">{fuente.nombre}</dd></div>
            <div><dt className="inline font-semibold">Página:</dt> <dd className="inline">{fuente.pagina}</dd></div>
            <div><dt className="inline font-semibold">Referencia:</dt> <dd className="inline">{fuente.referenciaFila}</dd></div>
          </dl>
        </div>
        {monto && <p className="max-w-xl text-sm font-semibold text-slate-800">Derecho de pago: {monto}</p>}
      </div>

      {mostrarRequisitos && requisitos.length > 0 && (
        <div className="mt-3">
          <h4 className="mb-2 text-xs font-bold uppercase text-slate-700">Requisitos documentarios</h4>
          <ul className="grid gap-1 text-sm text-slate-700 sm:grid-cols-2">
            {requisitos.map((requisito, index) => (
              <li key={`${procedimiento.registroVersionId}-req-${index}`}>{requisito}</li>
            ))}
          </ul>
        </div>
      )}

      {children}

      {(version.etiqueta || vigenciaTexto) && <dl className="mt-3 grid gap-2 border-t border-blue-200 pt-3 text-xs sm:grid-cols-2">
        {version.etiqueta && <div>
          <dt className="font-bold text-slate-700">Versión</dt>
          <dd className="mt-0.5 text-slate-600">{version.etiqueta}</dd>
        </div>}
        {vigenciaTexto && (
          <div>
            <dt className="font-bold text-slate-700">Vigencia</dt>
            <dd className="mt-0.5 text-slate-600">{vigenciaTexto}</dd>
          </div>
        )}
      </dl>}
    </div>
  );
};

export default TupaDetalleProcedimiento;
