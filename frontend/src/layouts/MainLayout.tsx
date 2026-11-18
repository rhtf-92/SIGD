import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import HeaderInstitucional from "../components/HeaderInstitucional";

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="relative min-h-screen min-h-dvh bg-gradient-to-br from-slate-50 via-cyan-50/25 to-teal-50/15 text-slate-900 flex flex-col justify-between selection:bg-cyan-200 selection:text-cyan-950">
      {/* Fondo ambiental abstracto con iluminación difusa tipo Liquid Glass (iOS 26 inspirado) */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        {/* Nodo radial aqua superior derecha */}
        <div className="absolute -top-32 right-0 sm:right-1/4 h-96 w-96 rounded-full bg-cyan-200/25 blur-3xl opacity-80" />
        {/* Nodo radial sky inferior izquierda */}
        <div className="absolute bottom-10 -left-20 h-96 w-96 rounded-full bg-sky-200/25 blur-3xl opacity-75" />
        {/* Halo ambiental central tenue */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 h-[500px] w-[900px] max-w-full rounded-full bg-gradient-to-b from-teal-100/20 via-cyan-100/15 to-transparent blur-3xl" />
      </div>

      <div>
        <HeaderInstitucional />
        {children}
      </div>

      <footer className="border-t border-cyan-100/80 bg-white/85 backdrop-blur-md print:hidden mt-12 text-slate-600 shadow-2xs">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 text-xs border-b border-cyan-100/70 pb-6">
            <div className="space-y-2 md:col-span-1 rounded-xl bg-gradient-to-br from-cyan-50/50 to-white/70 border border-cyan-200/60 p-4 shadow-xs backdrop-blur-xs">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-cyan-600 to-blue-700 text-white font-black text-xs flex items-center justify-center shadow-2xs">
                  S
                </div>
                <span className="font-bold text-slate-900 text-sm block">IESTP &quot;Suiza&quot;</span>
              </div>
              <p className="text-slate-500 text-[11px] leading-relaxed">
                Sistema Integral de Gestión Documentaria y Notificación Electrónica con Validez Legal.
                Pucallpa, Ucayali, Perú.
              </p>
            </div>

            <div className="space-y-2 p-2">
              <span className="font-bold text-slate-900 block text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
                Transparencia y Ley
              </span>
              <ul className="space-y-1.5">
                <li>
                  <Link to="/transparencia/privacidad" className="hover:text-cyan-700 hover:underline transition">
                    Política de Privacidad
                  </Link>
                </li>
                <li>
                  <Link to="/transparencia/datos-personales" className="hover:text-cyan-700 hover:underline transition">
                    Tratamiento y Derechos ARCO
                  </Link>
                </li>
                <li>
                  <Link to="/transparencia/acceso-informacion" className="hover:text-cyan-700 hover:underline transition">
                    Acceso a la Información (Ley 27806)
                  </Link>
                </li>
              </ul>
            </div>

            <div className="space-y-2 p-2">
              <span className="font-bold text-slate-900 block text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                Plataforma y TUPA
              </span>
              <ul className="space-y-1.5">
                <li>
                  <Link to="/transparencia/terminos" className="hover:text-sky-700 hover:underline transition">
                    Términos de Uso (TUO Ley 27444)
                  </Link>
                </li>
                <li>
                  <Link to="/transparencia/tupa" className="hover:text-sky-700 hover:underline transition">
                    Catálogo TUPA 2026 (72 procedimientos)
                  </Link>
                </li>
                <li>
                  <Link to="/consulta" className="hover:text-sky-700 hover:underline transition">
                    Consulta Pública por CUT
                  </Link>
                </li>
              </ul>
            </div>

            <div className="space-y-2 p-2">
              <span className="font-bold text-slate-900 block text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                Seguridad y Firmas
              </span>
              <ul className="space-y-1.5">
                <li>
                  <Link to="/transparencia/seguridad" className="hover:text-teal-700 hover:underline transition">
                    Seguridad de la Cuenta
                  </Link>
                </li>
                <li>
                  <Link to="/transparencia/firma-digital" className="hover:text-teal-700 hover:underline transition">
                    Validez de Firma Digital (Ley 27269)
                  </Link>
                </li>
                <li>
                  <Link to="/validador-cvd" className="hover:text-teal-700 hover:underline transition">
                    Validador Oficial CVD
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col gap-2 text-center text-[11px] sm:flex-row sm:items-center sm:justify-between text-slate-500">
            <span>Instituto de Educación Superior Tecnológico Público &quot;Suiza&quot; • SIGD v1.0</span>
            <span className="rounded-full bg-slate-100 border border-slate-200 px-3 py-0.5 self-center sm:self-auto font-mono text-[10px]">
              © 2026 • Todos los derechos reservados conforme a ley
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
