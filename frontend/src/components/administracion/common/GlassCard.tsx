import type { ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  variant?: "default" | "elevated" | "accent" | "bordered";
  glow?: "none" | "cyan" | "blue" | "amber" | "emerald" | "purple" | "rose";
  hoverEffect?: boolean;
}

const GLOW_CLASSES: Record<NonNullable<GlassCardProps["glow"]>, string> = {
  none: "",
  cyan: "shadow-[0_0_20px_rgba(6,182,212,0.12)] border-cyan-500/30",
  blue: "shadow-[0_0_20px_rgba(37,99,235,0.15)] border-blue-500/30",
  amber: "shadow-[0_0_20px_rgba(245,158,11,0.15)] border-amber-500/30",
  emerald: "shadow-[0_0_20px_rgba(16,185,129,0.15)] border-emerald-500/30",
  purple: "shadow-[0_0_20px_rgba(168,85,247,0.15)] border-purple-500/30",
  rose: "shadow-[0_0_20px_rgba(244,63,94,0.15)] border-rose-500/30",
};

const VARIANT_CLASSES: Record<NonNullable<GlassCardProps["variant"]>, string> = {
  default: "bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 text-slate-100",
  elevated: "bg-slate-900/80 backdrop-blur-2xl border border-slate-700/60 shadow-xl text-slate-100",
  accent: "bg-gradient-to-br from-slate-900/80 via-blue-950/40 to-slate-900/80 backdrop-blur-xl border border-blue-500/25 text-slate-100",
  bordered: "bg-slate-950/40 backdrop-blur-md border border-slate-800 text-slate-100",
};

export default function GlassCard({
  children,
  className = "",
  variant = "default",
  glow = "none",
  hoverEffect = false,
}: GlassCardProps) {
  return (
    <div
      className={`relative rounded-2xl p-5 sm:p-6 transition-all duration-300 ${
        VARIANT_CLASSES[variant]
      } ${GLOW_CLASSES[glow]} ${
        hoverEffect
          ? "hover:-translate-y-0.5 hover:border-cyan-500/40 hover:shadow-[0_10px_30px_rgba(6,182,212,0.15)]"
          : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
