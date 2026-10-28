import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Home } from 'lucide-react';
import type { GuidedNode, GuidedOption } from '../types';
import { TupaSearchInline } from './TupaSearchInline';

interface GuidedNodeViewProps {
  node: GuidedNode;
  onSelectOption: (option: GuidedOption, navigate: (to: string) => void) => void;
  onBack: () => void;
  onClose: () => void;
}

export const GuidedNodeView: React.FC<GuidedNodeViewProps> = ({
  node,
  onSelectOption,
  onBack,
  onClose,
}) => {
  const navigate = useNavigate();
  const [hasSearchError, setHasSearchError] = useState(false);

  // Reiniciar estado de error al navegar a otro nodo
  useEffect(() => {
    setHasSearchError(false);
  }, [node.id]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3.5 bg-slate-50/60">
      {/* Mensaje institucional de orientación */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
        {node.subtitle && (
          <span className="block text-[10px] uppercase font-bold tracking-wider text-blue-700 mb-1">
            {node.subtitle}
          </span>
        )}
        <p className="text-xs sm:text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
          {node.message}
        </p>
      </div>

      {/* Si el nodo es de búsqueda TUPA, desplegar el buscador */}
      {node.isTupaSearch && (
        <TupaSearchInline
          onBack={onBack}
          onClose={onClose}
          onErrorChange={setHasSearchError}
        />
      )}

      {/* Listado de Opciones Guiadas (Botones / Chips) — Solo si no hay error de búsqueda bloqueante */}
      {!hasSearchError && (
        <div className="space-y-2 pt-1">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Selecciona una opción
          </p>
          <div className="flex flex-col gap-1.5">
            {node.options.map((opt) => {
              const isBack = opt.isBack;
              const isHome = opt.isHome;

              if (isBack) {
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onSelectOption(opt, navigate)}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-slate-300 bg-slate-100/90 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-semibold transition-all min-h-[44px] focus:outline-none focus:ring-2 focus:ring-slate-400 mt-2"
                  >
                    <span className="flex items-center gap-2">
                      <ArrowLeft className="w-4 h-4 text-slate-500" />
                      <span>{opt.label}</span>
                    </span>
                  </button>
                );
              }

              if (isHome) {
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onSelectOption(opt, navigate)}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 text-xs sm:text-sm font-medium transition-all min-h-[44px] focus:outline-none focus:ring-2 focus:ring-slate-400"
                  >
                    <span className="flex items-center gap-2">
                      <Home className="w-4 h-4 text-slate-400" />
                      <span>{opt.label}</span>
                    </span>
                  </button>
                );
              }

              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onSelectOption(opt, navigate)}
                  className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl border border-slate-200 bg-white hover:bg-blue-50/50 hover:border-blue-400 active:bg-blue-100 text-slate-800 hover:text-blue-950 text-xs sm:text-sm font-medium shadow-2xs transition-all min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500 group"
                >
                  <span className="text-left leading-snug">{opt.label}</span>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 shrink-0 ml-2 transition-transform group-hover:translate-x-0.5" />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
