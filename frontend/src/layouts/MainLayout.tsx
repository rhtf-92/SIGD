import type { ReactNode } from "react";
import HeaderInstitucional from "../components/HeaderInstitucional";

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-sigd-surface text-sigd-text">
      <a href="#contenido" className="skip-link">
        Saltar al contenido
      </a>

      <HeaderInstitucional />

      <div id="contenido" className="flex-1">
        {children}
      </div>

      <footer className="mt-auto border-t border-sigd-line bg-white print:hidden">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-center text-xs text-sigd-muted sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:text-left lg:px-8">
          <span className="font-medium">
            IESTP &quot;Suiza&quot; — Pucallpa · Sistema Integral de Gestión
            Documentaria
          </span>
          <span>© 2026 SIGD</span>
        </div>
      </footer>
    </div>
  );
}
