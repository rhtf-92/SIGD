import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Clock, GraduationCap, LogIn, Mail, UserPlus } from "lucide-react";
import { ROLES_CANONICOS } from "../components/auth/LoginFormCard";
import LoginFormCardLampara from "../components/auth/LoginFormCardLampara";

export { ROLES_CANONICOS };

export function LoginSIGD(): React.JSX.Element {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-slate-950 font-sans text-slate-900 antialiased">
      <video
        aria-hidden="true"
        autoPlay
        className="pointer-events-none absolute inset-0 h-full w-full scale-[1.03] object-cover object-center blur-[2px]"
        loop
        muted
        playsInline
        preload="metadata"
      >
        <source
          src="https://iestpsuiza.edu.pe/wp-content/uploads/2023/09/instituto.mp4"
          type="video/mp4"
        />
      </video>
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-slate-950/55"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-br from-blue-950/30 via-transparent to-slate-950/30"
      />

      <header className="relative z-10 flex w-full items-center justify-between px-5 py-5 sm:px-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white/85 transition hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Volver al portal público</span>
        </Link>
        <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-slate-950/30 px-3 py-1.5 text-xs font-semibold text-white/90 backdrop-blur">
          <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />
          Portal Oficial v1.0
        </span>
      </header>

      <section
        aria-label="Acceso al Sistema SIGD"
        className="relative z-10 flex flex-1 items-center justify-center px-4 py-6"
      >
        <div className="w-full max-w-[390px] overflow-hidden rounded-2xl border border-white/80 bg-white shadow-2xl shadow-slate-950/35">
          <nav
            aria-label="Opciones de acceso"
            role="tablist"
            className="grid grid-cols-2 border-b border-slate-200 bg-slate-50"
          >
            <Link
              to="/login"
              role="tab"
              aria-selected="true"
              className="inline-flex min-h-14 items-center justify-center gap-2 border-b-[3px] border-blue-800 bg-white px-3 text-sm font-bold text-slate-900"
            >
              <LogIn className="h-4 w-4" aria-hidden="true" />
              Iniciar Sesión
            </Link>
            <Link
              to="/registro"
              role="tab"
              aria-selected="false"
              className="inline-flex min-h-14 items-center justify-center gap-2 border-b-[3px] border-transparent px-3 text-sm font-semibold text-slate-500 transition hover:bg-white hover:text-slate-800"
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Registro Externo
            </Link>
          </nav>

          <div className="px-6 pb-6 pt-5 sm:px-7">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-[#0c2340] shadow-md ring-1 ring-slate-200">
                <GraduationCap className="h-7 w-7" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h1 className="text-3xl font-black tracking-tight text-[#0c2340]">SIGD</h1>
                <p className="text-xs leading-5 text-slate-600">
                  Sistema Integral de Gestión Documentaria
                </p>
              </div>
            </div>

            <LoginFormCardLampara embedded minimal />
          </div>
        </div>
      </section>

      <footer className="relative z-10 px-4 pb-5 text-center text-xs text-white/85">
        <div className="mb-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            Atención: Lun - Vie 08:00 a 16:30 hrs
          </span>
          <a
            href="mailto:soporte.sigd@iestpsuiza.edu.pe"
            className="inline-flex items-center gap-1.5 transition hover:text-white hover:underline"
          >
            <Mail className="h-3.5 w-3.5" aria-hidden="true" />
            soporte.sigd@iestpsuiza.edu.pe
          </a>
        </div>
        <p>
          © {new Date().getFullYear()} IESTP "Suiza" — Pucallpa, Ucayali. Todos los derechos reservados.
        </p>
      </footer>
    </main>
  );
}

export default LoginSIGD;
