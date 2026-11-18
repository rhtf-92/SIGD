import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import HeaderInstitucional from "../components/HeaderInstitucional";

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const { pathname } = useLocation();
  const isHome = pathname === "/";

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-slate-950 text-slate-800 flex flex-col">
      {/* CAPA 1: FONDO 3D TECNOLÓGICO INMERSIVO GLOBAL */}
      <div
        className="fixed inset-0 pointer-events-none bg-cover bg-center bg-no-repeat opacity-30 scale-105"
        style={{ backgroundImage: `url('/images/bg-tramite-digital.jpg')` }}
        aria-hidden="true"
      />

      {/* CAPA 2: GRADIENTE NOCTURNO / CIAN PARA CONTRASTE Y LEGIBILIDAD */}
      <div
        className="fixed inset-0 pointer-events-none bg-gradient-to-b from-[#00182E]/80 via-slate-900/70 to-[#00182E]/90 backdrop-blur-[1px]"
        aria-hidden="true"
      />

      {/* CAPA 3: LUCES AMBIENTALES FIJAS (AURORA / GLOW) */}
      <div
        className="fixed -top-32 -right-32 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="fixed -bottom-32 -left-32 w-[500px] h-[500px] bg-blue-600/15 rounded-full blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      <HeaderInstitucional />

      <main className="sigd-main-stage relative z-10 flex-1 w-full py-8 px-4 sm:px-6 lg:px-8">
        {children}
      </main>

      {!isHome && (
        <footer className="relative z-10 w-full border-t border-white/10 bg-slate-950/60 backdrop-blur-md py-6 px-4 sm:px-6 lg:px-8 print:hidden">
          <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between text-xs text-blue-200/70 gap-4">
            <div className="flex items-center gap-2 font-bold text-white tracking-wider">
              <span>S</span> IESTP SUIZA
            </div>
            <div className="text-center">
              IESTP &quot;SUIZA&quot; — Pucallpa | SIGD — Sistema Integral de Gestión Documentaria
            </div>
            <div className="italic text-cyan-300/80">
              — Tu trámite, en buenas manos —
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
