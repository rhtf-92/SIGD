import {
  useEffect,
  useId,
  useRef,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export type ModalSize = "sm" | "md" | "lg" | "xl";

export interface ModalBaseProps {
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  size?: ModalSize;
  children: ReactNode;
  footer?: ReactNode;
  closeOnEsc?: boolean;
  closeOnEscape?: boolean;
  closeOnBackdropClick?: boolean;
  closeOnBackdrop?: boolean;
  className?: string;
}

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function ModalBase({
  isOpen,
  onClose,
  title,
  subtitle,
  size = "md",
  children,
  footer,
  closeOnEsc = true,
  closeOnEscape,
  closeOnBackdropClick = true,
  closeOnBackdrop,
  className = "",
}: ModalBaseProps) {
  const titleId = useId();
  const modalRef = useRef<HTMLDivElement | null>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  const shouldCloseOnEsc = closeOnEscape !== undefined ? closeOnEscape : closeOnEsc;
  const shouldCloseOnBackdrop = closeOnBackdrop !== undefined ? closeOnBackdrop : closeOnBackdropClick;

  // Gestión de foco previo (guardar elemento disparador y restaurarlo al cerrar)
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = (document.activeElement as HTMLElement) || null;
    } else if (previousActiveElement.current) {
      previousActiveElement.current.focus?.();
      previousActiveElement.current = null;
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (previousActiveElement.current) {
        previousActiveElement.current.focus?.();
      }
    };
  }, []);

  // Foco inicial accesible al abrir (primer elemento interactivo o contenedor)
  useEffect(() => {
    if (!isOpen) return;

    if (modalRef.current) {
      const focusables = modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusables.length > 0) {
        focusables[0].focus();
      } else {
        modalRef.current.focus();
      }
    }
  }, [isOpen]);

  // Focus trap (Tab / Shift+Tab) y tecla Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        if (shouldCloseOnEsc) {
          e.stopPropagation();
          onClose();
        }
        return;
      }

      if (e.key === "Tab") {
        if (!modalRef.current) return;

        const focusables = Array.from(
          modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        );

        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first || !modalRef.current.contains(document.activeElement)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last || !modalRef.current.contains(document.activeElement)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, shouldCloseOnEsc, onClose]);

  // Bloqueo de scroll en body al estar abierto
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen || typeof document === "undefined") {
    return null;
  }

  const handleBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && shouldCloseOnBackdrop) {
      onClose();
    }
  };

  const modalContent = (
    <div
      role="presentation"
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`w-full ${SIZE_CLASSES[size]} max-h-[90vh] flex flex-col rounded-xl border border-slate-200 bg-white shadow-xl outline-none overflow-hidden animate-in zoom-in-95 duration-150 ${className}`}
      >
        {/* Cabecera Estandarizada */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6 shrink-0 bg-white">
          <div className="min-w-0 pr-2">
            <h2
              id={titleId}
              className="text-base sm:text-lg font-bold text-slate-900 leading-tight"
            >
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 text-xs text-slate-500 font-medium leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-suiza-primary cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Cuerpo con Scroll Interno */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 text-sm text-slate-700">
          {children}
        </div>

        {/* Pie Fijo Estandarizado (si existe) */}
        {footer && (
          <div className="border-t border-slate-200 bg-slate-50/80 px-5 py-3 sm:px-6 flex items-center justify-end gap-3 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

export default ModalBase;
