<<<<<<< Updated upstream
import { Award, Check, ChevronDown, ExternalLink } from "lucide-react";
=======
﻿import { Award, Check, ChevronDown, ExternalLink } from "lucide-react";
>>>>>>> Stashed changes
import { useState } from "react";

import { PREGUNTAS_FRECUENTES } from "../../data/landingInstitucional";

const COMPROMISOS = [
  "Mesa de partes y casilla electrónica integradas.",
  "Firma digital con validez legal (CVD).",
  "Trazabilidad y seguimiento por CUT.",
  "Notificaciones seguras y oportunas.",
];

export default function SeccionBienvenida() {
  const [abierta, setAbierta] = useState<number | null>(0);

  return (
    <section id="nosotros" className="scroll-mt-24 bg-white py-14 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <span className="text-[11px] font-black uppercase tracking-[0.22em] text-[#E6007E]">Bienvenido</span>
            <h2 className="mt-2 text-2xl font-black leading-tight tracking-tight text-[#003366] sm:text-3xl lg:text-4xl">
              Un sistema digital para gestionar tus documentos con seguridad
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">
              El SIGD (Sistema de Gestión Documental) centraliza el registro, seguimiento y archivado de documentos y
              expedientes, permitiendo a ciudadanos e instituciones realizar sus trámites de forma remota y segura.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
              Con firma digital, casilla electrónica y consulta por CUT, garantizamos la validez legal, la integridad y
              la trazabilidad de cada documento gestionado en el sistema.
            </p>

            <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
              {COMPROMISOS.map((compromiso) => (
                <li key={compromiso} className="flex items-start gap-2 text-sm font-medium text-slate-700">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-600">
                    <Check aria-hidden="true" className="h-3 w-3" />
                  </span>
                  {compromiso}
                </li>
              ))}
            </ul>

            <a
              href="/tramite"
              className="mt-7 inline-flex items-center gap-2 rounded-lg bg-[#003366] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#00264d]"
            >
              Iniciar un trámite
              <ExternalLink aria-hidden="true" className="h-4 w-4" />
            </a>
          </div>

          <div className="relative">
            <div aria-hidden="true" className="absolute -inset-3 rounded-3xl bg-gradient-to-br from-[#006EC7]/15 to-[#E6007E]/10" />
            <video
              src="/images/carrusel/SIGD/SIGD.mp4"
              aria-label="Video del sistema de gestión documental SIGD"
              className="relative aspect-video w-full rounded-2xl bg-slate-950 object-contain shadow-xl"
              controls
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
            >
              Tu navegador no admite la reproducción de video.
            </video>
            <div className="absolute -bottom-5 left-4 flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-xl sm:left-6">
              <span className="grid h-11 w-11 place-items-center rounded-lg bg-[#F9E000]/25 text-[#8a7a00]">
                <Award aria-hidden="true" className="h-5 w-5" />
              </span>
              <span className="leading-tight">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Validez legal</span>
                <span className="block text-sm font-black text-[#003366]">Firma digital CVD</span>
              </span>
            </div>
          </div>
        </div>

        <div id="preguntas" className="mt-20 scroll-mt-24 lg:mt-24">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-[11px] font-black uppercase tracking-[0.22em] text-[#E6007E]">Resolvemos tus dudas</span>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-[#003366] sm:text-3xl">Preguntas frecuentes</h2>
            <p className="mt-2 text-sm text-slate-500">
              Todo lo que necesitas saber para gestionar tus documentos en el SIGD.
            </p>
          </div>

          <div className="mx-auto mt-8 max-w-3xl space-y-3">
            {PREGUNTAS_FRECUENTES.map((item, posicion) => {
              const activa = abierta === posicion;
              return (
                <div
                  key={item.pregunta}
                  className={`overflow-hidden rounded-xl border bg-white transition ${
                    activa ? "border-[#006EC7]/40 shadow-md" : "border-slate-200"
                  }`}
                >
                  <h3>
                    <button
                      type="button"
                      onClick={() => setAbierta((actual) => (actual === posicion ? null : posicion))}
                      aria-expanded={activa}
                      aria-controls={`faq-panel-${posicion}`}
                      className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left sm:px-5"
                    >
                      <span className={`text-sm font-bold sm:text-[15px] ${activa ? "text-[#003366]" : "text-slate-700"}`}>
                        {item.pregunta}
                      </span>
                      <span
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full transition ${
                          activa ? "bg-[#003366] text-white" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        <ChevronDown aria-hidden="true" className={`h-4 w-4 transition-transform ${activa ? "rotate-180" : ""}`} />
                      </span>
                    </button>
                  </h3>
                  <div
                    id={`faq-panel-${posicion}`}
                    role="region"
                    hidden={!activa}
                    className="border-t border-slate-100 px-4 pb-4 pt-3 text-sm leading-relaxed text-slate-600 sm:px-5"
                  >
                    {item.respuesta}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
