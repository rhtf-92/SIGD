import type { HTMLAttributes, ReactNode } from "react";

export type StatCardTone = "default" | "positive" | "warning" | "error";

interface StatCardProps extends HTMLAttributes<HTMLElement> {
  label: string;
  value: ReactNode;
  unit?: ReactNode;
  trend?: ReactNode;
  status?: ReactNode;
  valueTone?: StatCardTone;
  children?: ReactNode;
  footer?: ReactNode;
}

const toneClasses: Record<StatCardTone, string> = {
  default: "text-slate-900",
  positive: "text-emerald-700",
  warning: "text-amber-700",
  error: "text-red-700",
};

export default function StatCard({
  label,
  value,
  unit,
  trend,
  status,
  valueTone = "default",
  children,
  footer,
  className = "",
  ...rest
}: StatCardProps) {
  return (
    <article
      className={`card-sigd flex min-w-0 flex-col justify-between gap-4 p-4 transition-shadow duration-200 hover:shadow-card-hover ${className}`}
      {...rest}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
          <p className={`mt-3 break-words text-3xl font-bold ${toneClasses[valueTone]}`} aria-live="polite">
            {value}
            {unit ? <span className="ml-1 text-sm font-medium text-slate-500">{unit}</span> : null}
          </p>
        </div>
        {trend || status ? (
          <div className="flex shrink-0 flex-col items-end gap-2">
            {trend}
            {status}
          </div>
        ) : null}
      </div>
      {children}
      {footer}
    </article>
  );
}
