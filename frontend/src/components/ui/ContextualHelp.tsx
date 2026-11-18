import {
  useState,
  useRef,
  useEffect,
  useId,
  type ReactNode,
  type KeyboardEvent,
} from 'react';
import { HelpCircle, X } from 'lucide-react';

export type ContextualHelpPosition = 'top' | 'bottom' | 'left' | 'right';

export interface ContextualHelpProps {
  content: ReactNode;
  title?: string;
  label?: string;
  position?: ContextualHelpPosition;
  className?: string;
}

export function ContextualHelp({
  content,
  title,
  label = 'Más información',
  position = 'top',
  className = '',
}: ContextualHelpProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const openTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const helpId = useId();

  // Cancelar temporizadores pendientes
  const clearTimeouts = () => {
    if (openTimeoutRef.current) {
      clearTimeout(openTimeoutRef.current);
      openTimeoutRef.current = null;
    }
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  // Apertura por hover con ligero delay de 180ms para evitar parpadeos accidentales
  const handleMouseEnter = () => {
    clearTimeouts();
    openTimeoutRef.current = setTimeout(() => {
      setIsOpen(true);
    }, 180);
  };

  // Cierre por hover con delay de 180ms para permitir transición fluida al popover
  const handleMouseLeave = () => {
    clearTimeouts();
    closeTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 180);
  };

  // Toggle directo por clic o tap
  const handleTriggerClick = () => {
    clearTimeouts();
    setIsOpen((prev) => !prev);
  };

  // Cierre accesible con tecla Escape
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && isOpen) {
      e.stopPropagation();
      clearTimeouts();
      setIsOpen(false);
      triggerRef.current?.focus();
    }
  };

  // Cerrar al hacer clic o tap fuera
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        clearTimeouts();
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  // Limpiar temporizadores al desmontar
  useEffect(() => {
    return () => clearTimeouts();
  }, []);

  // Clases de posicionamiento con anclaje visual y contención de viewport
  const positionClasses: Record<ContextualHelpPosition, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <span
      ref={containerRef}
      className={`relative inline-flex items-center align-middle ml-1.5 ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onKeyDown={handleKeyDown}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={handleTriggerClick}
        aria-label={label}
        aria-expanded={isOpen}
        aria-controls={isOpen ? helpId : undefined}
        className="inline-flex items-center justify-center h-4 w-4 rounded-full text-slate-400 hover:text-suiza-primary hover:bg-suiza-primary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-suiza-primary/40 transition cursor-pointer select-none"
      >
        <HelpCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          id={helpId}
          role="region"
          aria-label={title || label}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className={`absolute z-50 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-sky-200/80 bg-sky-50/95 backdrop-blur-sm p-3.5 text-xs text-slate-800 shadow-md animate-in fade-in zoom-in-95 duration-150 ${positionClasses[position]}`}
        >
          <div className="flex items-start justify-between gap-2 border-b border-sky-200/60 pb-1.5 mb-2">
            <span className="font-bold text-sky-950 flex items-center gap-1.5">
              <HelpCircle className="h-3.5 w-3.5 text-suiza-primary shrink-0" />
              {title || 'Información de ayuda'}
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Cerrar ayuda"
              className="rounded p-0.5 text-slate-400 hover:text-slate-700 hover:bg-sky-100/60 transition cursor-pointer"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
          <div className="text-slate-700 leading-relaxed font-normal">
            {content}
          </div>
        </div>
      )}
    </span>
  );
}

export default ContextualHelp;
