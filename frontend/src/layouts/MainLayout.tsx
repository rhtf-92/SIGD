import React, { useState } from "react";
import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import HeaderInstitucional from "../components/HeaderInstitucional";
import SidebarInstitucional from "../components/layout/SidebarInstitucional";
import TopHeaderBar from "../components/layout/TopHeaderBar";

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps): React.JSX.Element {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const isLoginPage = location.pathname === "/login";
  const isAcademicCatalogPage = location.pathname === "/oferta-academica";
  const isRegistrationPage = location.pathname === "/registro";
  const isPublicHome =
    location.pathname === "/" &&
    (typeof window === "undefined" || !window.localStorage.getItem("sigd_token"));
  const isExpedientesInbox = location.pathname === "/expedientes";
  const isAdminArea =
    location.pathname === "/admin" || location.pathname.startsWith("/administracion");

  if (isLoginPage || isAcademicCatalogPage || isPublicHome) {
    return <>{children}</>;
  }

  if (isExpedientesInbox) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800">
        <HeaderInstitucional darkTheme />
        {children}
        <footer className="border-t border-slate-200 bg-white text-slate-500 print:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4 text-center text-xs font-medium sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <span>Instituto Suiza • Sistema Integral de Gestión Documentaria</span>
            <span>© 2026</span>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-[#f8fafc] text-slate-900 font-sans antialiased selection:bg-[#0c2340] selection:text-white">
      <SidebarInstitucional
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className={`flex flex-1 flex-col min-w-0 ${isAdminArea ? "h-screen min-h-0 overflow-hidden" : ""}`}>
        <TopHeaderBar onToggleSidebar={() => setSidebarOpen((prev) => !prev)} />
        <main
          className={`flex-1 min-w-0 ${
            isAdminArea ? "min-h-0 overflow-hidden" : ""
          } ${
            isRegistrationPage || isAdminArea
              ? "bg-transparent p-0"
              : "bg-[#f8fafc] p-4 sm:p-6 lg:p-8"
          }`}
        >
          <div
            className={
              isRegistrationPage || isAdminArea
                ? "h-full w-full min-h-0"
                : "mx-auto max-w-7xl"
            }
          >
            {children}
          </div>
        </main>
        {!isAdminArea && (
          <footer className="border-t border-slate-200/90 bg-white px-4 py-3.5 text-center text-xs text-slate-500 sm:px-6 lg:px-8 print:hidden">
            <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 sm:flex-row">
              <span>
                IESTP "Suiza" — Sistema Integral de Gestión Documentaria (SIGD)
              </span>
              <span className="text-[11px] text-slate-400">
                © {new Date().getFullYear()} • Pucallpa, Ucayali — República del Perú
              </span>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}
