import type { ReactNode } from "react";
import HeaderInstitucional from "../components/HeaderInstitucional";
import NavegacionLateral from "../components/NavegacionLateral";
import { useAutenticado } from "../hooks/useModulosVisibles";
import { ShieldCheck, Sparkles } from "lucide-react";

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  // La barra lateral es una herramienta de trabajo interna: sólo se monta
  // cuando existe sesión institucional activa. Los ciudadanos externos
  // ingresan al portal público (Mesa de Partes, Registro, Validador CVD)
  // sin iniciar sesión y, por tanto, sin menú de módulos.
  const autenticado = useAutenticado();

  return (
    <div className="relative flex min-h-screen flex-col bg-[#F8FAFC] text-slate-900 font-sans selection:bg-blue-600 selection:text-white">
      {/* Dynamic ambient lighting mesh for an innovative, non-generic depth */}
      <div 
        aria-hidden="true" 
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -top-40 right-0 h-96 w-96 rounded-full bg-blue-500/5 blur-3xl" />
        <div className="absolute top-1/3 -left-20 h-80 w-80 rounded-full bg-emerald-500/5 blur-3xl" />
        <div className="absolute -bottom-20 right-1/4 h-80 w-80 rounded-full bg-rose-500/3 blur-3xl" />
      </div>

      <HeaderInstitucional />

      <div className="flex flex-1">
        {autenticado ? <NavegacionLateral /> : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <main className="flex-1">{children}</main>

          <footer className="mt-auto border-t border-slate-200/80 bg-white/70 backdrop-blur-md print:hidden">
            <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 text-xs font-medium text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <span className="font-bold text-slate-800">
                  IESTP &quot;Suiza&quot;
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-slate-600">
                  Sistema Integral de Gestión Documentaria (SIGD)
                </span>
                <span className="hidden items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 md:inline-flex">
                  <ShieldCheck className="h-3 w-3" /> Validez Legal LPAG
                </span>
              </div>

              <div className="flex items-center gap-4 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1 font-mono text-[10px] text-slate-400">
                  <Sparkles className="h-2.5 w-2.5 text-blue-600" /> v1.0 • Pucallpa
                </span>
                <span className="text-slate-300">•</span>
                <span>© 2026 Todos los derechos reservados</span>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
