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
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <AdminBreadcrumbs />

            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => navigate("/")}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition-all duration-200 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800 cursor-pointer"
                title="Volver a la portada principal del SIGD"
              >
                <ArrowLeft className="h-3.5 w-3.5 text-blue-700" />
                <span>Volver al portal</span>
              </button>

              <div className="flex items-center gap-2">
                <span className="text-xs font-black tracking-widest text-blue-700 uppercase">
                  SIGD SUIZA
                </span>
                <span className="h-1 w-1 rounded-full bg-slate-300" />
                <span className="text-[11px] font-semibold text-slate-500">
                  Panel de Control Institucional
                </span>
              </div>
            </div>

            <div className="mt-2 flex items-start gap-3">
              {Icon && (
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-700">
                  <Icon className="h-6 w-6" />
                </div>
              )}
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                    {title}
                  </h1>
                  {badge && (
                    <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                      {badge}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs sm:text-sm text-slate-600 max-w-3xl leading-relaxed">
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