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
    border: "border-blue-100 hover:border-blue-300",
    glow: "shadow-sm hover:shadow-md",
    iconBg: "bg-blue-50 border-blue-100 text-blue-700",
    valueText: "text-blue-800",
  },
  cyan: {
    border: "border-cyan-100 hover:border-cyan-300",
    glow: "shadow-sm hover:shadow-md",
    iconBg: "bg-cyan-50 border-cyan-100 text-cyan-700",
    valueText: "text-cyan-800",
  },
  gold: {
    border: "border-amber-100 hover:border-amber-300",
    glow: "shadow-sm hover:shadow-md",
    iconBg: "bg-amber-50 border-amber-100 text-amber-700",
    valueText: "text-amber-800",
  },
  emerald: {
    border: "border-emerald-100 hover:border-emerald-300",
    glow: "shadow-sm hover:shadow-md",
    iconBg: "bg-emerald-50 border-emerald-100 text-emerald-700",
    valueText: "text-emerald-800",
  },
  purple: {
    border: "border-purple-100 hover:border-purple-300",
    glow: "shadow-sm hover:shadow-md",
    iconBg: "bg-purple-50 border-purple-100 text-purple-700",
    valueText: "text-purple-800",
  },
  rose: {
    border: "border-rose-100 hover:border-rose-300",
    glow: "shadow-sm hover:shadow-md",
    iconBg: "bg-rose-50 border-rose-100 text-rose-700",
    valueText: "text-rose-800",
  },
};

const BADGE_STYLES = {
  positive: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  neutral: "bg-slate-100 text-slate-600 border-slate-200",
  danger: "bg-rose-50 text-rose-700 border-rose-200",
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
      className={`relative overflow-hidden rounded-2xl border bg-white p-5 ${styles.border} ${styles.glow} transition-all duration-300 hover:-translate-y-0.5`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold tracking-wider uppercase text-slate-500">
            {title}
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-lg sm:text-xl font-extrabold tracking-tight ${styles.valueText}`}>
              {value}
            </span>
            {badge && (
              <span
                className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${
                  BADGE_STYLES[badge.variant ?? "neutral"]
                }`}
              >
                {badge.text}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="mt-1.5 truncate text-xs text-slate-500">{subtitle}</p>
          )}
        </div>

        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border backdrop-blur-md ${styles.iconBg} shadow-inner`}
        >
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </article>
  );
}
