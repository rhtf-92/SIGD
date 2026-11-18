import type { ReactNode } from "react";
import { FolderOpen } from "lucide-react";

export interface EmptyStateProps {
  icon?: ReactNode;
  imageSrc?: string;
  imageAlt?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}

export function EmptyState({
  icon,
  imageSrc,
  imageAlt,
  title,
  description,
  action,
  compact = false,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      role="status"
      aria-label={title}
      className={`w-full rounded-xl border border-dashed border-slate-300 bg-slate-50/50 text-center transition ${
        compact ? "py-8 px-4" : "py-12 sm:py-16 px-6"
      } ${className}`}
    >
      {imageSrc ? (
        <div className="mx-auto mb-3.5 flex justify-center">
          <img
            src={imageSrc}
            alt={imageAlt || title}
            width={compact ? 96 : 144}
            height={compact ? 96 : 144}
            loading="lazy"
            decoding="async"
            className={`w-auto object-contain aspect-square ${compact ? "h-20 sm:h-24" : "h-28 sm:h-36"}`}
          />
        </div>
      ) : (
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3.5 shadow-2xs">
          {icon ?? <FolderOpen className="h-6 w-6 text-slate-400" aria-hidden="true" />}
        </div>
      )}

      <h3 className="text-sm sm:text-base font-bold text-slate-800 leading-snug">
        {title}
      </h3>

      {description && (
        <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
          {description}
        </p>
      )}

      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export default EmptyState;
