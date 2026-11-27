import React, { useState } from "react";
import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
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
  const isAdministrationPage = location.pathname.startsWith("/administracion");
  const isMesaPartesPage =
    location.pathname === "/tramite/mesa-partes-virtual" ||
    location.pathname === "/mesa-partes";
  const isValidadorCvdPage = location.pathname === "/validador-cvd";
  const isPublicHome =
    location.pathname === "/" &&
    (typeof window === "undefined" || !window.localStorage.getItem("sigd_token"));
  if (
    isLoginPage ||
    isAcademicCatalogPage ||
    isRegistrationPage ||
    isPublicHome ||
    isAdministrationPage
  ) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen w-full bg-[#f8fafc] text-slate-900 font-sans antialiased selection:bg-[#0c2340] selection:text-white">
      <SidebarInstitucional
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex flex-1 flex-col min-w-0">
        <TopHeaderBar onToggleSidebar={() => setSidebarOpen((prev) => !prev)} />
        <main
          className={`flex-1 p-4 sm:p-6 lg:p-8 ${
            isMesaPartesPage
              ? "mesa-partes-layout"
              : isValidadorCvdPage
                ? "validador-cvd-background"
                : "bg-[#f8fafc]"
          }`}
        >
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
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
      </div>
    </div>
  );
}
