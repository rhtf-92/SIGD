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
  const esLogin = location.pathname === '/login';

  return (
    <div className={`min-h-screen flex flex-col ${esTesoreria || esLogin ? 'min-w-0' : 'min-w-[1448px]'} ${esPortada || esLogin ? "bg-[#E8F4FE]" : "bg-[#F3F4F6]"} text-[#111111]`}>
      {esTesoreria ? (
        <div className="overflow-x-auto">
          <div className="min-w-[1448px]">
            <HeaderInstitucional />
          </div>
        </div>
      ) : (
        <HeaderInstitucional />
      )}

      {children}

      {!esPortada && !esLogin && (
        <footer className="border-t border-slate-200 bg-white/80 print:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4 text-center text-xs font-medium text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <span>Instituto Suiza • Sistema Integral de Gestión Documentaria</span>
            <span>© 2026</span>
          </div>
        </footer>
      )}
    </div>
  );
}
