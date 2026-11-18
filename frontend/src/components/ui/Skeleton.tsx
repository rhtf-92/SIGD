import type { HTMLAttributes } from "react";

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function Skeleton({ className = "", ...props }: SkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Cargando contenido"
      className={`animate-pulse rounded-md bg-slate-200/80 ${className}`}
      {...props}
    />
  );
}

export interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

export function SkeletonText({ lines = 3, className = "" }: SkeletonTextProps) {
  const widths = ["w-full", "w-4/5", "w-3/5", "w-2/3", "w-1/2"];

  return (
    <div className={`space-y-2 ${className}`} role="status" aria-label="Cargando texto">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-3.5 ${widths[i % widths.length]}`}
        />
      ))}
    </div>
  );
}

export interface SkeletonCardProps {
  className?: string;
  hasHeader?: boolean;
  hasFooter?: boolean;
}

export function SkeletonCard({
  className = "",
  hasHeader = true,
  hasFooter = false,
}: SkeletonCardProps) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4 ${className}`}
      role="status"
      aria-label="Cargando tarjeta"
    >
      {hasHeader && (
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-4 w-16 rounded-full" />
        </div>
      )}
      <SkeletonText lines={3} />
      {hasFooter && (
        <div className="pt-2 border-t border-slate-100 flex justify-end">
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
      )}
    </div>
  );
}

export interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function SkeletonTable({
  rows = 5,
  columns = 5,
  className = "",
}: SkeletonTableProps) {
  return (
    <div
      className={`w-full overflow-hidden rounded-xl border border-slate-200 bg-white ${className}`}
      role="status"
      aria-label="Cargando datos de tabla"
    >
      {/* Cabecera de tabla fija */}
      <div className="flex items-center gap-4 bg-slate-50 px-4 py-3 border-b border-slate-200">
        {Array.from({ length: columns }).map((_, j) => (
          <div key={`th-${j}`} className="flex-1">
            <Skeleton className="h-3.5 w-3/4 bg-slate-300/70" />
          </div>
        ))}
      </div>

      {/* Filas con altura fija garantizada para evitar CLS (Cumulative Layout Shift) */}
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={`tr-${i}`}
            className="flex items-center gap-4 px-4 py-3.5 min-h-[52px]"
          >
            {Array.from({ length: columns }).map((_, j) => (
              <div key={`td-${i}-${j}`} className="flex-1">
                <Skeleton
                  className={`h-3.5 ${
                    j === 0
                      ? "w-1/2 font-mono"
                      : j === columns - 1
                      ? "w-16 rounded-full"
                      : "w-4/5"
                  }`}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
