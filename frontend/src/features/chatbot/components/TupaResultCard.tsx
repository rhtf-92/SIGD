import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Clock, DollarSign, FileText, Tag } from 'lucide-react';
import type { ProcedimientoTupaBusqueda } from '../types';

interface TupaResultCardProps {
  procedimiento: ProcedimientoTupaBusqueda;
  onSelect?: () => void;
}

export const TupaResultCard: React.FC<TupaResultCardProps> = ({
  procedimiento,
  onSelect,
}) => {
  const navigate = useNavigate();

  const handleVerProcedimiento = () => {
    navigate(`/tupa?procedimiento=${encodeURIComponent(procedimiento.codigoRef || procedimiento.codigo)}`);
    if (onSelect) {
      onSelect();
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs hover:border-blue-400 hover:shadow-xs transition-all flex flex-col justify-between gap-2.5">
      <div>
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
            {procedimiento.denominacion}
          </h4>
          <span className="shrink-0 inline-flex items-center gap-1 font-mono text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold border border-slate-200">
            <Tag className="w-2.5 h-2.5 text-slate-400" />
            {procedimiento.codigoRef || procedimiento.codigo}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1 text-blue-800 font-medium">
            <FileText className="w-3 h-3 text-blue-600" />
            {procedimiento.tipoLegible}
          </span>
          <span className="inline-flex items-center gap-1 text-slate-700 font-semibold">
            <DollarSign className="w-3 h-3 text-emerald-600" />
            {procedimiento.monto}
          </span>
          {procedimiento.plazo && (
            <span className="inline-flex items-center gap-1 text-slate-500">
              <Clock className="w-3 h-3 text-amber-500" />
              {procedimiento.plazo}
            </span>
          )}
        </div>
      </div>

      <div className="pt-2 border-t border-slate-100 flex justify-end">
        <button
          type="button"
          onClick={handleVerProcedimiento}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors min-h-[38px] focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <span>Ver procedimiento</span>
          <ArrowRight className="w-3.5 h-3.5 text-blue-600" />
        </button>
      </div>
    </div>
  );
};
