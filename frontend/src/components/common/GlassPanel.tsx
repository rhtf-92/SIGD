import type { ElementType, HTMLAttributes, ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ExternalLink } from "lucide-react";

/* ========================================================================= */
/* 1. GlassPanel — Contenedor Principal de Liquid Glass                      */
/* ========================================================================= */

export interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  as?: ElementType;
  variant?:
    | "default"
    | "aqua"
    | "sky"
    | "emerald"
    | "indigo"
    | "institutional"
    | "legal"
    | "subtle";
  blur?: "none" | "sm" | "md";
  children: ReactNode;
  className?: string;
}

const VARIANTS: Record<NonNullable<GlassPanelProps["variant"]>, string> = {
  default:
    "bg-white/80 border-white/90 ring-1 ring-slate-100/80 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.9),0_8px_30px_-6px_rgba(0,0,0,0.04)]",
  aqua:
    "bg-gradient-to-br from-white/88 via-cyan-50/45 to-teal-50/30 border-white/85 ring-1 ring-cyan-200/50 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.95),inset_0_-1px_2px_0_rgba(6,182,212,0.05),0_14px_40px_-8px_rgba(6,182,212,0.14),0_2px_10px_-2px_rgba(0,0,0,0.02)]",
  sky:
    "bg-gradient-to-br from-white/88 via-sky-50/45 to-blue-50/25 border-white/85 ring-1 ring-sky-200/50 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.95),inset_0_-1px_2px_0_rgba(14,165,233,0.05),0_14px_40px_-8px_rgba(14,165,233,0.12),0_2px_10px_-2px_rgba(0,0,0,0.02)]",
  emerald:
    "bg-gradient-to-br from-white/88 via-emerald-50/45 to-teal-50/30 border-white/85 ring-1 ring-emerald-200/50 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.95),inset_0_-1px_2px_0_rgba(16,185,129,0.05),0_14px_40px_-8px_rgba(16,185,129,0.12),0_2px_10px_-2px_rgba(0,0,0,0.02)]",
  indigo:
    "bg-gradient-to-br from-white/88 via-slate-50/60 to-indigo-50/30 border-white/85 ring-1 ring-indigo-200/40 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.95),inset_0_-1px_2px_0_rgba(99,102,241,0.04),0_14px_40px_-8px_rgba(99,102,241,0.10),0_2px_10px_-2px_rgba(0,0,0,0.02)]",
  institutional:
    "bg-gradient-to-br from-white/88 via-slate-50/60 to-indigo-50/30 border-white/85 ring-1 ring-indigo-200/40 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.95),inset_0_-1px_2px_0_rgba(99,102,241,0.04),0_14px_40px_-8px_rgba(99,102,241,0.10),0_2px_10px_-2px_rgba(0,0,0,0.02)]",
  legal:
    "bg-gradient-to-br from-white/92 via-slate-50/50 to-teal-50/25 border-white/90 ring-1 ring-teal-200/50 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.95),0_10px_32px_-6px_rgba(20,184,166,0.10)]",
  subtle:
    "bg-white/80 border-white/90 ring-1 ring-slate-100/80 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.9),0_4px_16px_-2px_rgba(0,0,0,0.03)]",
};

const BLURS: Record<NonNullable<GlassPanelProps["blur"]>, string> = {
  none: "",
  sm: "backdrop-blur-xs",
  md: "backdrop-blur-md",
};

export function GlassPanel({
  as: Component = "div",
  variant = "default",
  blur = "md",
  children,
  className = "",
  ...props
}: GlassPanelProps) {
  return (
    <Component
      className={`relative overflow-hidden rounded-3xl border transition-all duration-300 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-[1.5px] before:bg-gradient-to-r before:from-transparent before:via-white/90 before:to-transparent after:pointer-events-none after:absolute after:-top-20 after:-right-20 after:h-44 after:w-44 after:rounded-full after:bg-cyan-300/10 after:blur-2xl ${VARIANTS[variant]} ${BLURS[blur]} ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}

/* ========================================================================= */
/* 2. CapsuleBadge — Controles y Badges Tipo Cápsula de Cristal              */
/* ========================================================================= */

export type CapsuleVariant =
  | "public"
  | "login"
  | "role"
  | "approved"
  | "pending"
  | "security"
  | "legal"
  | "aqua"
  | "sky"
  | "emerald"
  | "amber"
  | "indigo"
  | "slate";

export interface CapsuleBadgeProps {
  children: ReactNode;
  variant?: CapsuleVariant;
  className?: string;
  dot?: boolean;
}

const BADGE_VARIANTS: Record<CapsuleVariant, string> = {
  public:
    "border-cyan-200/80 bg-gradient-to-b from-white/95 via-cyan-50/80 to-sky-50/60 text-cyan-950 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.95),0_2px_6px_rgba(6,182,212,0.14)]",
  aqua:
    "border-cyan-200/80 bg-gradient-to-b from-white/95 via-cyan-50/80 to-sky-50/60 text-cyan-950 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.95),0_2px_6px_rgba(6,182,212,0.14)]",
  login:
    "border-sky-200/80 bg-gradient-to-b from-white/95 via-sky-50/80 to-blue-50/60 text-sky-950 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.95),0_2px_6px_rgba(14,165,233,0.14)]",
  sky:
    "border-sky-200/80 bg-gradient-to-b from-white/95 via-sky-50/80 to-blue-50/60 text-sky-950 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.95),0_2px_6px_rgba(14,165,233,0.14)]",
  role:
    "border-indigo-200/80 bg-gradient-to-b from-white/95 via-indigo-50/70 to-slate-50/60 text-indigo-950 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.95),0_2px_6px_rgba(99,102,241,0.12)]",
  indigo:
    "border-indigo-200/80 bg-gradient-to-b from-white/95 via-indigo-50/70 to-slate-50/60 text-indigo-950 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.95),0_2px_6px_rgba(99,102,241,0.12)]",
  approved:
    "border-emerald-200/80 bg-gradient-to-b from-white/95 via-emerald-50/80 to-teal-50/60 text-emerald-950 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.95),0_2px_6px_rgba(16,185,129,0.14)]",
  emerald:
    "border-emerald-200/80 bg-gradient-to-b from-white/95 via-emerald-50/80 to-teal-50/60 text-emerald-950 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.95),0_2px_6px_rgba(16,185,129,0.14)]",
  pending:
    "border-amber-200/80 bg-gradient-to-b from-white/95 via-amber-50/80 to-orange-50/60 text-amber-950 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.95),0_2px_6px_rgba(245,158,11,0.14)]",
  amber:
    "border-amber-200/80 bg-gradient-to-b from-white/95 via-amber-50/80 to-orange-50/60 text-amber-950 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.95),0_2px_6px_rgba(245,158,11,0.14)]",
  security:
    "border-teal-200/80 bg-gradient-to-b from-white/95 via-teal-50/80 to-cyan-50/60 text-teal-950 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.95),0_2px_6px_rgba(20,184,166,0.14)]",
  legal:
    "border-slate-200/85 bg-gradient-to-b from-white/95 via-slate-50/80 to-slate-100/60 text-slate-800 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.95),0_2px_6px_rgba(0,0,0,0.05)]",
  slate:
    "border-slate-200/85 bg-gradient-to-b from-white/95 via-slate-50/80 to-slate-100/60 text-slate-800 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.95),0_2px_6px_rgba(0,0,0,0.05)]",
};

export function CapsuleBadge({
  children,
  variant = "public",
  className = "",
  dot = false,
}: CapsuleBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-xs font-semibold backdrop-blur-xs transition ${BADGE_VARIANTS[variant]} ${className}`}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-85 animate-pulse shadow-2xs" />}
      {children}
    </span>
  );
}

/* ========================================================================= */
/* 3. InformationGlassPanel — Paneles de Información Normativa y Legal       */
/* ========================================================================= */

export interface InformationGlassPanelProps {
  icon: ElementType;
  title: string;
  summary: ReactNode;
  legalReference?: string;
  ctaText?: string;
  ctaHref?: string;
  variant?: "legal" | "aqua" | "security" | "subtle";
  className?: string;
}

const INFO_THEMES: Record<
  NonNullable<InformationGlassPanelProps["variant"]>,
  {
    border: string;
    bg: string;
    iconBg: string;
    iconColor: string;
    titleColor: string;
    ring: string;
  }
> = {
  legal: {
    border: "border-teal-200/70",
    bg: "bg-gradient-to-br from-white/92 via-teal-50/35 to-cyan-50/25",
    iconBg: "bg-gradient-to-br from-white to-teal-100 text-teal-800 border-teal-200/80",
    iconColor: "text-teal-800",
    titleColor: "text-teal-950",
    ring: "ring-teal-200/40",
  },
  aqua: {
    border: "border-cyan-200/70",
    bg: "bg-gradient-to-br from-white/92 via-cyan-50/40 to-sky-50/25",
    iconBg: "bg-gradient-to-br from-white to-cyan-100 text-cyan-800 border-cyan-200/80",
    iconColor: "text-cyan-800",
    titleColor: "text-cyan-950",
    ring: "ring-cyan-200/40",
  },
  security: {
    border: "border-sky-200/70",
    bg: "bg-gradient-to-br from-white/92 via-sky-50/40 to-indigo-50/25",
    iconBg: "bg-gradient-to-br from-white to-sky-100 text-sky-800 border-sky-200/80",
    iconColor: "text-sky-800",
    titleColor: "text-sky-950",
    ring: "ring-sky-200/40",
  },
  subtle: {
    border: "border-slate-200/80",
    bg: "bg-gradient-to-br from-white/92 via-slate-50/50 to-white",
    iconBg: "bg-gradient-to-br from-white to-slate-100 text-slate-700 border-slate-200",
    iconColor: "text-slate-700",
    titleColor: "text-slate-900",
    ring: "ring-slate-100",
  },
};

export function InformationGlassPanel({
  icon: Icon,
  title,
  summary,
  legalReference,
  ctaText,
  ctaHref,
  variant = "legal",
  className = "",
}: InformationGlassPanelProps) {
  const theme = INFO_THEMES[variant];

  return (
    <article
      className={`group relative overflow-hidden rounded-2xl border ${theme.border} ${theme.bg} p-5 sm:p-6 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.95),0_6px_22px_-4px_rgba(0,0,0,0.04)] ring-1 ${theme.ring} backdrop-blur-sm transition-all duration-300 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-[1.5px] before:bg-gradient-to-r before:from-transparent before:via-white/90 before:to-transparent hover:-translate-y-1 hover:shadow-lg flex flex-col justify-between ${className}`}
    >
      <div className="space-y-3">
        {/* Cabecera del panel de información */}
        <div className="flex flex-wrap items-start justify-between gap-2.5">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-[inset_0_1px_1px_rgba(255,255,255,0.9),0_2px_5px_rgba(0,0,0,0.04)] transition group-hover:scale-105 ${theme.iconBg}`}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h3 className={`text-base font-bold tracking-tight ${theme.titleColor}`}>
                {title}
              </h3>
            </div>
          </div>

          {legalReference && (
            <CapsuleBadge variant="legal" className="text-[11px] font-mono">
              {legalReference}
            </CapsuleBadge>
          )}
        </div>

        {/* Cuerpo del resumen legal con alto contraste */}
        <div className="text-xs sm:text-sm text-slate-700 leading-relaxed space-y-2">
          {summary}
        </div>
      </div>

      {/* CTA opcional al pie */}
      {ctaText && ctaHref && (
        <div className="mt-4 pt-3 border-t border-slate-100">
          <Link
            to={ctaHref}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-800 hover:text-teal-950 transition group/link"
          >
            <span>{ctaText}</span>
            {ctaHref.startsWith("http") ? (
              <ExternalLink className="h-3.5 w-3.5" />
            ) : (
              <ArrowRight className="h-3.5 w-3.5 transition group-hover/link:translate-x-0.5" />
            )}
          </Link>
        </div>
      )}
    </article>
  );
}

/* ========================================================================= */
/* 4. InfoCard (Compatibilidad retrospectiva)                                */
/* ========================================================================= */

export interface InfoCardProps {
  icon: ElementType;
  title: string;
  description: ReactNode;
  badge?: string;
  variant?: "aqua" | "sky" | "emerald" | "amber" | "indigo" | "slate";
  className?: string;
}

export function InfoCard({
  icon,
  title,
  description,
  badge,
  variant = "slate",
  className = "",
}: InfoCardProps) {
  const variantMap: Record<string, InformationGlassPanelProps["variant"]> = {
    aqua: "aqua",
    sky: "security",
    emerald: "legal",
    amber: "subtle",
    indigo: "security",
    slate: "legal",
  };

  return (
    <InformationGlassPanel
      icon={icon}
      title={title}
      summary={description}
      legalReference={badge}
      variant={variantMap[variant] || "subtle"}
      className={className}
    />
  );
}
