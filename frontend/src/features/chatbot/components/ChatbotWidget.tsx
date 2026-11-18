import React from 'react';
import { useGuidedAssistant } from '../hooks/useGuidedAssistant';
import { ChatbotPanel } from './ChatbotPanel';
import chatbotImg from '../../../assets/sigd/chatbot-sm.webp';

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
      {/* Botón flotante accesible con identidad gráfica oficial Chatbot.png */}
      {!isOpen && (
        <button
          type="button"
          onClick={toggleOpen}
          aria-expanded={isOpen}
          aria-label="¿Necesitas ayuda? Abrir asistente institucional"
          title="Asistente SIGD"
          className="fixed bottom-3 right-3 sm:bottom-3 sm:right-4 z-40 group flex items-center justify-center gap-2 bg-[#00478f] hover:bg-[#003875] text-white p-2 2xl:px-4 2xl:py-2.5 rounded-full shadow-lg shadow-blue-950/30 border border-sky-400/30 transition-all duration-200 transform hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-blue-300 min-h-[44px] min-w-[44px]"
        >
          <div className="relative shrink-0">
            <img
              src={chatbotImg}
              alt=""
              width={30}
              height={30}
              loading="lazy"
              decoding="async"
              className="w-7 h-7 rounded-full object-contain bg-white/10 p-0.5 aspect-square"
            />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 border-2 border-[#00478f] rounded-full" />
          </div>
          <span className="hidden 2xl:inline text-xs font-bold tracking-wide">
            Asistente SIGD
          </span>
          <span className="sr-only">¿Necesitas ayuda?</span>
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
