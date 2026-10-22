import type { ReactNode } from "react";
import { Loader2, Inbox, AlertTriangle, RefreshCw } from "lucide-react";
import { SecondaryButton } from "./Buttons";

export function LoadingState({
  message = "Cargando información...",
  submessage = "Por favor espere un momento",
}: {
  message?: string;
  submessage?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="relative mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/10 border border-cyan-500/20 shadow-[0_0_20px_rgba(6,182,212,0.15)]">
        <Loader2 className="h-7 w-7 animate-spin text-cyan-400" />
      </div>
      <p className="text-base font-semibold text-slate-100">{message}</p>
      {submessage && (
        <p className="mt-1 text-xs text-slate-400 max-w-sm">{submessage}</p>
      )}
    </div>
  );
}

export function EmptyState({
  title = "No se encontraron registros",
  description = "Intente ajustar los filtros de búsqueda o consulte nuevamente.",
  icon: Icon = Inbox,
  action,
}: {
  title?: string;
  description?: string;
  icon?: typeof Inbox;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800/80 border border-slate-700/60 text-slate-400 shadow-inner">
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="text-base font-semibold text-slate-200">{title}</h3>
      <p className="mt-1 text-xs text-slate-400 max-w-md leading-relaxed">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "Ocurrió un error al cargar la información",
  description = "No se pudo completar la operación en el servidor. Revise su conexión o intente nuevamente.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.15)]">
        <AlertTriangle className="h-7 w-7" />
      </div>
      <h3 className="text-base font-semibold text-rose-200">{title}</h3>
      <p className="mt-1 text-xs text-slate-400 max-w-md leading-relaxed">
        {description}
      </p>
      {onRetry && (
        <div className="mt-5">
          <SecondaryButton
            size="sm"
            onClick={onRetry}
            icon={RefreshCw}
          >
            Reintentar
          </SecondaryButton>
        </div>
      )}
    </div>
  );
}
