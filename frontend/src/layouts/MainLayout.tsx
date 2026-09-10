import type { ReactNode } from "react";

import HeaderInstitucional from "../components/HeaderInstitucional";

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-[#F3F4F6] text-[#111111]">
      <HeaderInstitucional />

      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>

      <footer className="border-t border-slate-200 bg-white/80">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4 text-center text-xs font-medium text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span>Instituto Suiza • Sistema Integral de Gestión Documentaria</span>
          <span>© 2026</span>
        </div>
      </footer>
    </div>
  );
}
