import { CheckCircle2, FileCheck2, Landmark, MapPin, Send, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";

import { COLUMNAS_PIE, CONTACTO } from "../data/landingInstitucional";
import EnlaceLanding from "./landing/EnlaceLanding";

export default function FooterInstitucional() {
  const [correo, setCorreo] = useState("");
  const [suscrito, setSuscrito] = useState(false);

  const suscribir = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (!correo.trim()) return;
    setSuscrito(true);
    setCorreo("");
  };

  return (
    <footer id="contacto" className="mt-auto scroll-mt-24 print:hidden">
      <div className="relative overflow-hidden bg-gradient-to-r from-[#006EC7] to-[#003366]">
        <div aria-hidden="true" className="absolute inset-0">
          <div className="absolute -left-16 -top-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-24 right-0 h-64 w-64 rounded-full bg-[#E6007E]/25 blur-3xl" />
        </div>
        <div className="relative mx-auto grid max-w-7xl items-center gap-6 px-4 py-9 sm:px-6 lg:grid-cols-[1fr_0.9fr] lg:px-8">
          <div>
            <h2 className="text-xl font-black tracking-tight text-white sm:text-2xl">
              No te pierdas nuestras actualizaciones
            </h2>
            <p className="mt-1 max-w-md text-sm text-blue-100/90">
              Recibe novedades, mantenimientos y mejoras del sistema SIGD directamente en tu correo.
            </p>
          </div>
          {suscrito ? (
            <div className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white">
              <CheckCircle2 aria-hidden="true" className="h-5 w-5 text-[#F9E000]" />
              ¡Suscripción registrada! Revisa tu correo para confirmar.
            </div>
          ) : (
            <form onSubmit={suscribir} className="flex flex-col gap-2 sm:flex-row">
              <label htmlFor="boletin-email" className="sr-only">
                Correo electrónico
              </label>
              <input
                id="boletin-email"
                type="email"
                required
                autoComplete="email"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                placeholder="Escribe tu correo electrónico"
                className="w-full rounded-lg border border-white/25 bg-white/95 px-4 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#F9E000] focus:ring-2 focus:ring-[#F9E000]/40"
              />
              <button
                type="submit"
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#F9E000] px-5 py-2.5 text-sm font-black text-[#003366] transition hover:bg-[#e6cf00]"
              >
                Suscribirme
                <Send aria-hidden="true" className="h-4 w-4" />
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="relative bg-[#04213f] text-blue-50">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-white text-base font-black text-[#003366]">
                S
              </span>
              <div>
                <p className="text-sm font-black uppercase tracking-[0.14em] text-white">SIGD</p>
                <p className="text-[11px] font-semibold text-blue-200/80">Sistema de Gestión Documental</p>
              </div>
            </div>
            <p className="mt-4 max-w-xs text-[13px] leading-6 text-blue-100/80">
              Plataforma de gestión documental que digitaliza trámites, expedientes y notificaciones con firma digital
              y plena validez legal.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-200">
                <ShieldCheck aria-hidden="true" className="h-3 w-3" />
                Validez legal
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-cyan-200">
                <FileCheck2 aria-hidden="true" className="h-3 w-3" />
                Firma digital CVD
              </span>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-200">Institución</p>
            <ul className="mt-3 space-y-2.5 text-[13px] text-blue-100/90">
              <li className="flex items-start gap-2.5">
                <Landmark aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#F9E000]" />
                <span>
                  {CONTACTO.institucion}
                  <span className="block text-[11px] text-blue-200/60">{CONTACTO.sistema}</span>
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#F9E000]" />
                <span>
                  {CONTACTO.ubicacion}
                  <span className="block text-[11px] text-blue-200/60">{CONTACTO.referencia}</span>
                </span>
              </li>
            </ul>
          </div>

          {COLUMNAS_PIE.map((columna) => (
            <nav key={columna.titulo} aria-label={columna.titulo}>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-200">{columna.titulo}</p>
              <ul className="mt-3 space-y-1.5">
                {columna.enlaces.map((enlace) => (
                  <li key={enlace.etiqueta}>
                    <EnlaceLanding
                      enlace={enlace}
                      className="inline-block py-0.5 text-[13px] font-semibold text-blue-50/85 transition hover:text-white hover:underline hover:underline-offset-2"
                    />
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="relative border-t border-white/10">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-4 text-center sm:flex-row sm:px-6 sm:text-left lg:px-8">
            <p className="text-xs font-medium text-blue-200/70">
              © 2026 SIGD — Sistema de Gestión Documental. Todos los derechos reservados.
            </p>
            <div className="flex items-center gap-4 text-[11px] font-semibold text-blue-200/60">
              <a
                href="/consulta"
                className="transition hover:text-white"
              >
                Consulta de trámites
              </a>
              <span className="font-mono">SIGD v1.0</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
