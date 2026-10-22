import type { ComponentType, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import AdminBreadcrumbs from "./AdminBreadcrumbs";

interface AdminPageHeaderProps {
  title: string;
  description: string;
  icon?: ComponentType<{ className?: string }>;
  badge?: string;
  action?: ReactNode;
}

export default function AdminPageHeader({
  title,
  description,
  icon: Icon,
  badge,
  action,
}: AdminPageHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="border-b border-slate-800/80 bg-slate-950/40 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <AdminBreadcrumbs />

            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => navigate("/")}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700/60 bg-slate-900/60 px-3 py-1.5 text-xs font-semibold text-slate-300 backdrop-blur-md transition-all duration-200 hover:border-cyan-500/40 hover:bg-slate-800/80 hover:text-white cursor-pointer"
                title="Volver a la portada principal del SIGD"
              >
                <ArrowLeft className="h-3.5 w-3.5 text-cyan-400" />
                <span>Volver al portal</span>
              </button>

              <div className="flex items-center gap-2">
                <span className="text-xs font-black tracking-widest text-cyan-400 uppercase drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]">
                  SIGD SUIZA
                </span>
                <span className="h-1 w-1 rounded-full bg-slate-600" />
                <span className="text-[11px] font-semibold text-slate-400">
                  Panel de Control Institucional
                </span>
              </div>
            </div>

            <div className="mt-3 flex items-start gap-3.5">
              {Icon && (
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600/20 via-cyan-500/15 to-transparent border border-cyan-400/30 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
                  <Icon className="h-6 w-6" />
                </div>
              )}
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white drop-shadow-sm">
                    {title}
                  </h1>
                  {badge && (
                    <span className="inline-flex items-center rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-xs font-semibold text-cyan-300">
                      {badge}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs sm:text-sm text-slate-400 max-w-3xl leading-relaxed">
                  {description}
                </p>
              </div>
            </div>
          </div>

          {action && (
            <div className="flex shrink-0 items-center gap-3 self-start md:self-center">
              {action}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}