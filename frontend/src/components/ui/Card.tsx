import type { HTMLAttributes, ReactNode } from "react";

export type CardPadding = "none" | "sm" | "md" | "lg";

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title?: ReactNode;
  description?: ReactNode;
  headerAction?: ReactNode;
  footer?: ReactNode;
  padding?: CardPadding;
  children?: ReactNode;
  className?: string;
}

const PADDING_CLASSES: Record<CardPadding, string> = {
  none: "p-0",
  sm: "p-3 sm:p-4",
  md: "p-5 sm:p-6",
  lg: "p-6 sm:p-8",
};

export function Card({
  title,
  description,
  headerAction,
  footer,
  padding = "md",
  children,
  className = "",
  ...props
}: CardProps) {
  const hasHeader = Boolean(title || description || headerAction);

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white shadow-xs text-slate-900 transition-shadow ${className}`}
      {...props}
    >
      {hasHeader && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="space-y-0.5 min-w-0">
            {title && (
              <h3 className="text-base font-bold text-slate-900 tracking-tight leading-snug">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                {description}
              </p>
            )}
          </div>
          {headerAction && <div className="shrink-0">{headerAction}</div>}
        </div>
      )}

      {children && <div className={PADDING_CLASSES[padding]}>{children}</div>}

      {footer && (
        <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-3 sm:px-6 rounded-b-xl">
          {footer}
        </div>
      )}
    </div>
  );
}

export default Card;
