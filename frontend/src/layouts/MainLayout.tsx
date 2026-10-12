import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import AnimatedUniverseBackground from "../components/common/AnimatedUniverseBackground";
import HeaderInstitucional from "../components/HeaderInstitucional";

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const { pathname } = useLocation();

  if (pathname === "/login") {
    return <div className="min-h-screen bg-[#06132F]">{children}</div>;
  }

  return (
    <AnimatedUniverseBackground compact>
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
