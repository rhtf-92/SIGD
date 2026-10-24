import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import HeaderInstitucional from "../components/HeaderInstitucional";

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-[#F3F4F6] text-[#111111] flex flex-col justify-between">
      <div>
        <HeaderInstitucional />
        {children}
      </div>

      <footer className="border-t border-slate-200 bg-white print:hidden mt-12 text-slate-600">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 text-xs border-b border-slate-100 pb-6">
            <div className="space-y-2 md:col-span-1">
              <span className="font-bold text-slate-900 text-sm block">IESTP &quot;Suiza&quot;</span>
              <p className="text-slate-500 text-[11px] leading-relaxed">
                Sistema Integral de Gestión Documentaria y Notificación Electrónica con Validez Legal.
                Pucallpa, Ucayali, Perú.
              </p>
            </div>

            <div className="space-y-1.5">
              <span className="font-bold text-slate-900 block text-[11px] uppercase tracking-wider">
                Transparencia y Ley
              </span>
              <ul className="space-y-1">
                <li>
                  <Link to="/transparencia/privacidad" className="hover:text-blue-700 transition">
                    Política de Privacidad
                  </Link>
                </li>
                <li>
                  <Link to="/transparencia/datos-personales" className="hover:text-blue-700 transition">
                    Tratamiento y Derechos ARCO
                  </Link>
                </li>
                <li>
                  <Link to="/transparencia/acceso-informacion" className="hover:text-blue-700 transition">
                    Acceso a la Información (Ley 27806)
                  </Link>
                </li>
              </ul>
            </div>

            <div className="space-y-1.5">
              <span className="font-bold text-slate-900 block text-[11px] uppercase tracking-wider">
                Plataforma y TUPA
              </span>
              <ul className="space-y-1">
                <li>
                  <Link to="/transparencia/terminos" className="hover:text-blue-700 transition">
                    Términos de Uso (TUO Ley 27444)
                  </Link>
                </li>
                <li>
                  <Link to="/transparencia/tupa" className="hover:text-blue-700 transition">
                    Catálogo TUPA 2026 (72 procedimientos)
                  </Link>
                </li>
                <li>
                  <Link to="/consulta" className="hover:text-blue-700 transition">
                    Consulta Pública por CUT
                  </Link>
                </li>
              </ul>
            </div>

            <div className="space-y-1.5">
              <span className="font-bold text-slate-900 block text-[11px] uppercase tracking-wider">
                Seguridad y Firmas
              </span>
              <ul className="space-y-1">
                <li>
                  <Link to="/transparencia/seguridad" className="hover:text-blue-700 transition">
                    Seguridad de la Cuenta
                  </Link>
                </li>
                <li>
                  <Link to="/transparencia/firma-digital" className="hover:text-blue-700 transition">
                    Validez de Firma Digital (Ley 27269)
                  </Link>
                </li>
                <li>
                  <Link to="/validador-cvd" className="hover:text-blue-700 transition">
                    Validador Oficial CVD
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col gap-2 text-center text-[11px] sm:flex-row sm:items-center sm:justify-between text-slate-500">
            <span>Instituto de Educación Superior Tecnológico Público &quot;Suiza&quot; • SIGD v1.0</span>
            <span>© 2026 • Todos los derechos reservados conforme a ley</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
