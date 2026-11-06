import type { ReactNode } from "react";
import HeaderInstitucional from "../components/HeaderInstitucional";

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen w-full overflow-x-hidden flex flex-col bg-[#F3F4F6] text-[#111111] antialiased">
      <HeaderInstitucional />

      <main className="flex-1 w-full flex flex-col">
        {children}
      </main>

      <footer className="w-full border-t border-slate-200 bg-white/95 print:hidden mt-auto">
        <div className="w-full flex flex-col gap-2 px-4 py-4 text-center text-xs font-medium text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
          <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 text-slate-500">
            <span className="font-bold text-slate-800">IESTP "Suiza" — Pucallpa</span>
            <span className="hidden sm:inline">•</span>
            <span>Sistema Integral de Gestión Documentaria (SIGD)</span>
          </div>
          <div className="flex items-center justify-center gap-3 text-[11px] text-slate-400">
            <span>D.S. N° 004-2019-JUS / R.S. N° 001-2017-PCM</span>
            <span className="hidden sm:inline">•</span>
            <span className="font-mono font-semibold">© 2026</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
