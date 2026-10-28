import React, { useEffect, useRef } from 'react';
import { ArrowLeft, Bot, Home, X } from 'lucide-react';
import type { GuidedNode, GuidedOption } from '../types';
import { GuidedNodeView } from './GuidedNodeView';

interface ChatbotPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentNode: GuidedNode;
  canGoBack: boolean;
  onBack: () => void;
  onReset: () => void;
  onSelectOption: (option: GuidedOption, navigate: (to: string) => void) => void;
}

export const ChatbotPanel: React.FC<ChatbotPanelProps> = ({
  isOpen,
  onClose,
  currentNode,
  canGoBack,
  onBack,
  onReset,
  onSelectOption,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  // Escuchar tecla Escape para cerrar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-label="Asistente de orientación institucional SIGD"
      className="fixed inset-x-3 bottom-3 sm:bottom-6 sm:right-6 sm:inset-x-auto w-auto sm:w-[390px] max-h-[85vh] sm:max-h-[620px] h-[580px] z-50 flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Cabecera Institucional Azul Oscuro (Estándar Corporativo SIGD) */}
      <div className="bg-slate-900 border-b border-slate-800 text-white px-4 py-3 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2.5">
          {canGoBack ? (
            <button
              type="button"
              onClick={onBack}
              title="Volver"
              aria-label="Volver a la opción anterior"
              className="p-1.5 -ml-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition min-h-[44px] min-w-[44px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-2xs shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
          )}

          <div>
            <h2 className="text-xs sm:text-sm font-bold tracking-tight leading-none text-white flex items-center gap-1.5">
              <span>{currentNode.title}</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
            </h2>
            <p className="text-[11px] text-slate-300 font-medium mt-0.5">
              {currentNode.subtitle || 'Orientación sobre trámites y servicios'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {canGoBack && (
            <button
              type="button"
              onClick={onReset}
              title="Volver al inicio"
              aria-label="Volver al inicio del asistente"
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition min-h-[44px] min-w-[44px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <Home className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            title="Cerrar asistente"
            aria-label="Cerrar asistente"
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition min-h-[44px] min-w-[44px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Contenido del Nodo Actual */}
      <GuidedNodeView
        node={currentNode}
        onSelectOption={onSelectOption}
        onBack={onBack}
        onClose={onClose}
      />

      {/* Pie institucional estandarizado */}
      <div className="px-3.5 py-2.5 bg-slate-50 border-t border-slate-200 text-center">
        <p className="text-[10px] text-slate-500 font-medium leading-tight">
          Asistente público guiado · IESTP «Suiza»
        </p>
      </div>
    </div>
  );
};
