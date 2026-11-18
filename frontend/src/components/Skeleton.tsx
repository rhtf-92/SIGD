import type { CSSProperties, ReactElement } from "react";

export interface SkeletonProps {
  variant?: "line" | "lines" | "card";
  lines?: number;
  count?: number;
  className?: string;
  width?: string | number;
  height?: string | number;
  style?: CSSProperties;
  "aria-label"?: string;
}

export function SkeletonLine({
  className = "",
  width,
  height,
  style,
  "aria-label": ariaLabel,
}: Omit<SkeletonProps, "variant" | "lines" | "count">): ReactElement {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={ariaLabel || "Cargando..."}
      className={`sigd-skeleton sigd-skeleton-line ${className}`}
      style={{
        width,
        height,
        ...style,
      }}
    />
  );
}

export function SkeletonCard({
  className = "",
  style,
  "aria-label": ariaLabel,
}: Omit<SkeletonProps, "variant" | "lines" | "count">): ReactElement {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={ariaLabel || "Cargando..."}
      className={`sigd-skeleton-card animate-pulse rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}
      style={style}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="h-6 w-32 rounded-md bg-slate-200" />
        <div className="h-6 w-24 rounded-full bg-slate-200" />
      </div>
      <div className="mb-3 h-5 w-3/4 rounded bg-slate-200" />
      <div className="h-4 w-1/2 rounded bg-slate-100" />
      <div className="mt-4 flex gap-4 border-t border-slate-100 pt-3">
        <div className="h-4 w-28 rounded bg-slate-200" />
        <div className="h-4 w-40 rounded bg-slate-200" />
      </div>
    </div>
  );
}

export function SkeletonLines({
  lines = 3,
  className = "",
  style,
  "aria-label": ariaLabel,
}: Omit<SkeletonProps, "variant" | "count">): ReactElement {
  const widths = ["100%", "85%", "92%", "72%", "60%"];
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={ariaLabel || "Cargando lista..."}
      className={`space-y-3 ${className}`}
      style={style}
    >
      {Array.from({ length: lines }, (_, idx) => (
        <div
          key={idx}
          className="sigd-skeleton sigd-skeleton-line h-4 rounded"
          style={{ width: widths[idx % widths.length] }}
        />
      ))}
    </div>
  );
}

export default function Skeleton({
  variant = "line",
  lines = 3,
  count = 1,
  className = "",
  width,
  height,
  style,
  "aria-label": ariaLabel,
}: SkeletonProps): ReactElement {
  const total = Math.max(1, count);
  const items = Array.from({ length: total }, (_, index) => {
    if (variant === "card") {
      return (
        <SkeletonCard
          key={index}
          className={className}
          style={style}
          aria-label={ariaLabel}
        />
      );
    }
    if (variant === "lines") {
      return (
        <SkeletonLines
          key={index}
          lines={lines}
          className={className}
          style={style}
          aria-label={ariaLabel}
        />
      );
    }
    return (
      <SkeletonLine
        key={index}
        className={className}
        width={width}
        height={height}
        style={style}
        aria-label={ariaLabel}
      />
    );
  });

  if (total === 1) {
    return items[0];
  }

  return (
    <div className={`sigd-skeleton-group space-y-4 ${className}`} role="status" aria-busy="true">
      {items}
    </div>
  );
}

Skeleton.Line = SkeletonLine;
Skeleton.Card = SkeletonCard;
Skeleton.Lines = SkeletonLines;
