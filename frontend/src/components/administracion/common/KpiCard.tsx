import type { ComponentType } from "react";

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ComponentType<{ className?: string }>;
  badge?: {
    text: string;
    variant?: "positive" | "warning" | "neutral" | "danger";
  };
  color?: "blue" | "cyan" | "gold" | "emerald" | "purple" | "rose";
}

const COLOR_STYLES = {
  blue: {
    border: "border-blue-500/30 hover:border-blue-400/50",
    glow: "shadow-[0_0_20px_rgba(37,99,235,0.1)]",
    iconBg: "bg-blue-500/15 border-blue-400/30 text-blue-400",
    valueText: "text-blue-100",
  },
  cyan: {
    border: "border-cyan-500/30 hover:border-cyan-400/50",
    glow: "shadow-[0_0_20px_rgba(6,182,212,0.1)]",
    iconBg: "bg-cyan-500/15 border-cyan-400/30 text-cyan-400",
    valueText: "text-cyan-100",
  },
  gold: {
    border: "border-amber-500/30 hover:border-amber-400/50",
    glow: "shadow-[0_0_20px_rgba(245,158,11,0.1)]",
    iconBg: "bg-amber-500/15 border-amber-400/30 text-amber-400",
    valueText: "text-amber-100",
  },
  emerald: {
    border: "border-emerald-500/30 hover:border-emerald-400/50",
    glow: "shadow-[0_0_20px_rgba(16,185,129,0.1)]",
    iconBg: "bg-emerald-500/15 border-emerald-400/30 text-emerald-400",
    valueText: "text-emerald-100",
  },
  purple: {
    border: "border-purple-500/30 hover:border-purple-400/50",
    glow: "shadow-[0_0_20px_rgba(168,85,247,0.1)]",
    iconBg: "bg-purple-500/15 border-purple-400/30 text-purple-400",
    valueText: "text-purple-100",
  },
  rose: {
    border: "border-rose-500/30 hover:border-rose-400/50",
    glow: "shadow-[0_0_20px_rgba(244,63,94,0.1)]",
    iconBg: "bg-rose-500/15 border-rose-400/30 text-rose-400",
    valueText: "text-rose-100",
  },
};

const BADGE_STYLES = {
  positive: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  warning: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  neutral: "bg-slate-700/30 text-slate-300 border-slate-600/30",
  danger: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

export default function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  badge,
  color = "blue",
}: KpiCardProps) {
  const styles = COLOR_STYLES[color];

  return (
    <article
      className={`relative overflow-hidden rounded-2xl bg-slate-900/60 p-5 backdrop-blur-xl border ${styles.border} ${styles.glow} transition-all duration-300 hover:-translate-y-0.5 hover:bg-slate-900/80`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold tracking-wider uppercase text-slate-400">
            {title}
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${styles.valueText}`}>
              {value}
            </span>
            {badge && (
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                  BADGE_STYLES[badge.variant ?? "neutral"]
                }`}
              >
                {badge.text}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="mt-1.5 truncate text-xs text-slate-400">{subtitle}</p>
          )}
        </div>

        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border backdrop-blur-md ${styles.iconBg} shadow-inner`}
        >
          <Icon className="h-6 w-6 drop-shadow-[0_0_8px_currentColor]" />
        </div>
      </div>
    </article>
  );
}
