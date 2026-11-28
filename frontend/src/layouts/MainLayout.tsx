import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import AsistenteVirtual from "../components/AsistenteVirtual";
import ErrorBoundary from "../components/ErrorBoundary";
import HeaderInstitucional from "../components/HeaderInstitucional";

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="sigd-app-shell min-h-screen bg-[#F3F4F6] text-[#111111]">
      <a className="sigd-skip-link" href="#main-content">Saltar al contenido</a>
      <div aria-hidden="true" className="sigd-print-brand">
        <img alt="" height={40} src="/img/logo.jpg" width={40} />
        <span>SIGD SUIZA</span>
      </div>
      <HeaderInstitucional />

      <div id="main-content" tabIndex={-1}>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </div>

      <footer className="sigd-site-footer">
        <div className="sigd-site-footer-inner">
          <div className="sigd-site-footer-brand">
            <img
              alt="Escudo del Instituto Suiza"
              className="sigd-brand-logo"
              height={56}
              src="/img/logo.jpg"
              width={56}
            />
            <div>
              <strong>SIGD SUIZA</strong>
              <p>Instituto de Educación Superior Tecnológico Público &quot;Suiza&quot;</p>
              <p>Pucallpa</p>
            </div>
          </div>
          <nav aria-label="Servicios" className="sigd-site-footer-nav">
            <h3>Servicios</h3>
            <Link to="/tupa">TUPA vigente</Link>
            <Link to="/consulta">Consultar expediente</Link>
            <Link to="/registro">Registrarme</Link>
            <Link to="/casilla">Casilla Electrónica</Link>
          </nav>
          <nav aria-label="Ayuda" className="sigd-site-footer-nav">
            <h3>Ayuda</h3>
            <Link to="/tramite/mesa-partes-virtual">Mesa de Partes Virtual</Link>
            <Link to="/validador-cvd">Validar documento</Link>
          </nav>
        </div>
        <div className="sigd-site-footer-bottom">
          <p>SIGD — Sistema Integral de Gestión Documentaria</p>
          <p>© {new Date().getFullYear()} IESTP Suiza</p>
        </div>
      </footer>
      <AsistenteVirtual />
    </div>
  );
}
