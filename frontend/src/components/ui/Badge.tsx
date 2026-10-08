import type { HTMLAttributes, ReactNode } from "react";

export type BadgeTone = "neutral" | "info" | "success" | "warning" | "error";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  children?: ReactNode;
}

const toneClasses: Record<BadgeTone, string> = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  info: "bg-sky-50 text-sigd-blue-dark ring-sky-200",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  warning: "bg-amber-50 text-amber-700 ring-amber-200",
  error: "bg-red-50 text-red-700 ring-red-200",
};

export default function Badge({
  tone = "neutral",
  className = "",
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${toneClasses[tone]} ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}
