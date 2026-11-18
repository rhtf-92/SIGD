import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, BookOpenCheck, GraduationCap } from "lucide-react";
import BrandingColumn from "../components/auth/BrandingColumn";
import LoginFormCard, { ROLES_CANONICOS } from "../components/auth/LoginFormCard";
import LoginFooter from "../components/auth/LoginFooter";

export { ROLES_CANONICOS };

export function LoginSIGD(): React.JSX.Element {
  return (
    <main className="min-h-screen w-full flex flex-col lg:flex-row bg-[#f8fafc] text-slate-900 font-sans antialiased selection:bg-[#0c2340] selection:text-white">
      <BrandingColumn />

      <section
        aria-label="Acceso al Sistema SIGD"
        className="relative isolate flex min-h-screen flex-1 flex-col overflow-hidden bg-[#edf4fc] px-4 py-8 sm:px-8 lg:px-4 xl:px-6"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center"
          style={{
            backgroundImage: "url('/aula-carreras.jpg')",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{
            backgroundImage:
              "linear-gradient(135deg, rgba(247, 250, 255, 0.48) 0%, rgba(234, 244, 255, 0.38) 52%, rgba(220, 246, 244, 0.48) 100%)",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[2] opacity-[0.18]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(12, 35, 64, 0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(12, 35, 64, 0.07) 1px, transparent 1px)",
            backgroundSize: "42px 42px",
            maskImage:
              "radial-gradient(ellipse at 70% 50%, black, transparent 72%)",
          }}
        />
        <GraduationCap
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 top-1/4 z-[3] h-96 w-96 rotate-[-12deg] text-blue-900/[0.045]"
          strokeWidth={0.7}
        />

        <div className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 hover:text-[#0c2340] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Volver al portal público</span>
          </Link>
        </div>

        <div className="relative z-10 my-auto flex w-full flex-1 items-center justify-center py-6 lg:py-3">
          <div className="grid w-full max-w-6xl grid-cols-1 items-center gap-8 lg:grid-cols-[minmax(0,0.78fr)_minmax(300px,1fr)] lg:gap-5">
            <aside className="relative hidden overflow-hidden rounded-3xl border border-white/90 bg-gradient-to-br from-white/95 via-[#f5f9ff]/95 to-[#e8f4fb]/95 p-7 shadow-2xl shadow-[#0c2340]/20 ring-1 ring-[#0c2340]/10 backdrop-blur-md lg:flex lg:min-h-[25rem] lg:flex-col lg:justify-between xl:p-9">
              <div aria-hidden="true" className="absolute inset-x-8 top-0 h-1 rounded-b-full bg-gradient-to-r from-blue-700 via-cyan-500 to-teal-400" />
              <div aria-hidden="true" className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-cyan-200/70 blur-2xl" />
              <div aria-hidden="true" className="absolute -bottom-24 -left-20 h-52 w-52 rounded-full bg-blue-200/50 blur-3xl" />
              <div className="relative">
                <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0c2340] to-[#176b91] text-white shadow-lg shadow-blue-950/25 ring-4 ring-white/80">
                  <GraduationCap className="h-6 w-6" aria-hidden="true" />
                </div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
                  IESTP “Suiza” · Pucallpa
                </p>
                <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-[#0c2340] xl:text-3xl">
                  Tu próximo paso empieza aquí
                </h1>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Conoce nuestras 11 carreras profesionales y crea tu usuario externo para realizar tus trámites institucionales.
                </p>
              </div>

              <div className="relative mt-8">
                <div className="mb-5 flex items-center gap-3 rounded-2xl border border-blue-100/90 bg-gradient-to-r from-blue-50 to-cyan-50/90 p-4 shadow-sm shadow-blue-950/5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-blue-800 shadow-sm ring-1 ring-blue-100">
                    <BookOpenCheck className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">11 programas de estudio</p>
                    <p className="mt-0.5 text-xs text-slate-500">Explora la oferta académica</p>
                  </div>
                </div>
                <Link
                  to="/oferta-academica"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0c2340] via-[#123f68] to-[#116b83] px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-950/20 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-950/25 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-500/30"
                >
                  <span>Registro de usuario</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <p className="mt-3 text-center text-xs leading-5 text-slate-500">
                  Mira las carreras y continúa al registro en línea.
                </p>
              </div>
            </aside>

            <div className="mx-auto w-full max-w-md">
              <LoginFormCard />
            </div>
          </div>
        </div>

        <div className="relative z-10 mx-auto grid w-full max-w-6xl grid-cols-1 lg:grid-cols-[minmax(0,0.78fr)_minmax(300px,1fr)] lg:gap-5">
          <div aria-hidden="true" className="hidden lg:block" />
          <div className="mx-auto w-full max-w-md">
            <LoginFooter />
          </div>
        </div>
      </section>
    </main>
  );
}

export default LoginSIGD;
