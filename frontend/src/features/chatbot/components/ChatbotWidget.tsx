import React from 'react';
import { MessageSquare } from 'lucide-react';
import { useGuidedAssistant } from '../hooks/useGuidedAssistant';
import { ChatbotPanel } from './ChatbotPanel';

export const ChatbotWidget: React.FC = () => {
  const {
    isOpen,
    toggleOpen,
    closeAssistant,
    currentNode,
    canGoBack,
    goBack,
    resetToRoot,
    handleSelectOption,
  } = useGuidedAssistant();

  return (
    <>
      {/* Botón flotante accesible con identidad corporativa SIGD */}
      {!isOpen && (
        <button
          type="button"
          onClick={toggleOpen}
          aria-expanded={isOpen}
          aria-label="¿Necesitas ayuda? Abrir asistente institucional"
          className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-40 group flex items-center gap-2.5 bg-slate-900 hover:bg-slate-800 text-white px-4 py-3 sm:px-5 sm:py-3.5 rounded-full shadow-lg shadow-slate-900/25 border border-slate-700 transition-all duration-200 transform hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-blue-300 min-h-[44px] min-w-[44px]"
        >
          <div className="relative">
            <MessageSquare className="w-5 h-5 text-white" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 border-2 border-slate-900 rounded-full" />
          </div>
          <span className="text-xs sm:text-sm font-semibold tracking-wide">
            ¿Necesitas ayuda?
          </span>
        </button>
      )}

      {/* Panel guiado del asistente institucional */}
      <ChatbotPanel
        isOpen={isOpen}
        onClose={closeAssistant}
        currentNode={currentNode}
        canGoBack={canGoBack}
        onBack={goBack}
        onReset={resetToRoot}
        onSelectOption={handleSelectOption}
      />
    </>
  );
};

export default ChatbotWidget;
