import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import HeaderInstitucional from "../components/HeaderInstitucional";

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const location = useLocation();
  const isLoginPage = location.pathname === "/login";
  const isHomePage = location.pathname === "/";
  const isCasillaPage = location.pathname.startsWith("/casilla");
  const isExpedientesInbox = location.pathname === "/expedientes";
  const isAdminPage =
    location.pathname.startsWith("/administracion") ||
    location.pathname.startsWith("/admin");

  if (isLoginPage || isHomePage || isCasillaPage || isAdminPage) {
    return <>{children}</>;
  }

  return (
    <div
      className={
        isExpedientesInbox
          ? "min-h-screen bg-[#06131b] text-slate-100"
          : "min-h-screen bg-[#F3F4F6] text-[#111111]"
      }
    >
      <HeaderInstitucional darkTheme={isExpedientesInbox} />

      {children}

      <footer
        className={
          isExpedientesInbox
            ? "border-t border-amber-400/35 bg-slate-950/90 text-amber-100/75 print:hidden before:block before:h-px before:w-full before:bg-gradient-to-r before:from-transparent before:via-amber-300/80 before:to-transparent"
            : "border-t border-slate-200 bg-white/80 print:hidden"
        }
      >
        <div
          className={`mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4 text-center text-xs font-medium sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8 ${
            isExpedientesInbox ? "text-amber-100/75" : "text-slate-600"
          }`}
        >
          <span>Instituto Suiza • Sistema Integral de Gestión Documentaria</span>
          <span>© 2026</span>
        </div>
      </footer>
    </div>
  );
}
