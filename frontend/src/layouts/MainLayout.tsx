import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import AnimatedUniverseBackground from "../components/common/AnimatedUniverseBackground";
import LogoSIGD3D from "../components/common/LogoSIGD3D";
import HeaderInstitucional from "../components/HeaderInstitucional";

interface MainLayoutProps {
  children: ReactNode;
}

const RUTAS_CON_LOGO_AMBIENTAL = new Set([
  "/",
  "/tramite",
  "/expedientes",
  "/reportes/dashboard",
]);

export default function MainLayout({ children }: MainLayoutProps) {
  const { pathname } = useLocation();
  const reemplazaOrbeConLogo = RUTAS_CON_LOGO_AMBIENTAL.has(pathname);

  if (pathname === "/login") {
    return <div className="min-h-screen bg-[#06132F]">{children}</div>;
  }

  return (
    <AnimatedUniverseBackground
      compact
      orbReplacement={reemplazaOrbeConLogo ? <LogoSIGD3D variant="ambient" /> : undefined}
    >
      <div className="sigd-app-shell">
        <HeaderInstitucional />
        <div className="sigd-app-content">{children}</div>
        <footer className="sigd-app-footer print:hidden">
          <div>
            <span>IESTP “Suiza” · Sistema Integral de Gestión Documentaria</span>
            <span>Plataforma institucional segura · © {new Date().getFullYear()}</span>
          </div>
        </footer>
      </div>
    </AnimatedUniverseBackground>
  );
}
