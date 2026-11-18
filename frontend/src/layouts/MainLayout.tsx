import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Shield, Users, FileText, Info, Mail, Clock } from "lucide-react";
import HeaderInstitucional from "../components/HeaderInstitucional";
import logoSuiza from "../assets/sigd/logo-suiza.png";

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen min-h-dvh bg-[#edf8ff] text-slate-900 flex flex-col selection:bg-blue-100 selection:text-blue-900 overflow-x-hidden">
      {/* 1. Header Institucional Oficial */}
      <HeaderInstitucional />
      <div className="flex-1 w-full flex flex-col">
        {children}
      </div>

      {/* 2. Footer Institucional Completo (Diseño Aprobado SIGD — Traslado de index.html) */}
      <footer className="sigd-footer print:hidden" id="pie-de-pagina">
        <div className="sigd-footer-row">
          {/* Identidad / Marca Institucional */}
          <div className="sigd-footer-brand">
            <img
              src={logoSuiza}
              alt="Emblema IESTP SUIZA"
              loading="lazy"
              decoding="async"
            />
            <span>
              <strong>IESTP SUIZA</strong>
              <small>Educación tecnológica<br />de calidad para la región.</small>
            </span>
          </div>

          {/* Columna 1: Privacidad de tus datos */}
          <div className="sigd-footer-column">
            <h2>
              <Shield className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              <span>Privacidad de tus datos</span>
            </h2>
            <Link to="/transparencia/privacidad">Política de Privacidad</Link>
            <Link to="/transparencia/datos-personales">Tratamiento de Datos Personales</Link>
          </div>

          {/* Columna 2: Tus derechos y trámites */}
          <div className="sigd-footer-column">
            <h2>
              <Users className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              <span>Tus derechos y trámites</span>
            </h2>
            <Link to="/transparencia/datos-personales">Derechos ARCO</Link>
            <Link to="/transparencia/terminos">Términos de Uso</Link>
          </div>

          {/* Columna 3: Transparencia y normas */}
          <div className="sigd-footer-column">
            <h2>
              <FileText className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              <span>Transparencia y normas</span>
            </h2>
            <Link to="/transparencia/acceso-informacion">Transparencia Institucional</Link>
            <Link to="/transparencia/normativa">Normativa y Bases Legales</Link>
          </div>

          {/* Columna 4: Atención y contacto */}
          <div className="sigd-footer-column contact-footer">
            <h2>
              <Info className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              <span>Atención y contacto</span>
            </h2>
            <span>
              <Clock className="w-3.5 h-3.5 shrink-0" />
              Horario: Lun. a Vie. 8:00 a.m. – 4:30 p.m.
            </span>
            <a href="mailto:suiza@iestpsuiza.edu.pe" className="inline-flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 shrink-0" />
              suiza@iestpsuiza.edu.pe
            </a>
          </div>
        </div>

        {/* Pie inferior con derechos reservados */}
        <div className="sigd-copyright">
          © 2026 IESTP SUIZA. Todos los derechos reservados.
        </div>
      </footer>
    </div>
  );
}
