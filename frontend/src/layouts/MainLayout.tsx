import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import HeaderInstitucional from "../components/HeaderInstitucional";

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const location = useLocation();
  const esPortada = location.pathname === "/";
  const esTesoreria = location.pathname === '/tesoreria';
  const esTramite = location.pathname.startsWith('/tramite');
  const esCasilla = location.pathname.startsWith('/casilla');
  const esConsulta = location.pathname.startsWith('/consulta');
  const esValidador = location.pathname.startsWith('/validador');
  const esFluido = esTesoreria || esTramite || esCasilla || esConsulta || esValidador;

  return (
    <div className={`min-h-screen ${esFluido ? 'min-w-0 w-full' : 'min-w-[1448px]'} ${esPortada || esCasilla || esTramite || esConsulta || esValidador ? "bg-[#E8F4FE]" : "bg-[#F3F4F6]"} text-[#111111]`}>
      {esTesoreria ? <div className="overflow-x-auto"><div className="min-w-[1448px]"><HeaderInstitucional /></div></div> : <HeaderInstitucional />}

      {children}

      {!esPortada && (
        <footer className="border-t border-slate-200 bg-white/90 backdrop-blur-sm print:hidden relative z-10">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4 text-center text-xs font-medium text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <span>Instituto Suiza • Sistema Integral de Gestión Documentaria</span>
            <span>© 2026</span>
          </div>
        </footer>
      )}
    </div>
  );
}