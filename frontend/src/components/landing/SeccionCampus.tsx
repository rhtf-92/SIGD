<<<<<<< Updated upstream
import {
=======
﻿import {
>>>>>>> Stashed changes
  ArrowRight,
  BookOpen,
  ChevronDown,
  LifeBuoy,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { CENTRO_AYUDA } from "../../data/landingInstitucional";

export default function SeccionCampus() {
  const [abierto, setAbierto] = useState<string | null>(CENTRO_AYUDA[0]?.id ?? null);

  return (
    <section id="campus" className="scroll-mt-24 bg-slate-50 py-14 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
          <div>
            <span className="text-[11px] font-black uppercase tracking-[0.22em] text-[#E6007E]">Centro de ayuda</span>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-[#003366] sm:text-3xl">Guías del SIGD</h2>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-slate-500">
              Consulta cómo realizar tus gestiones en el Sistema Integral de Gestión Documentaria, con información
              oficial del Instituto.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-[#006EC7]">
                  <LifeBuoy aria-hidden="true" className="h-4 w-4" />
                </span>
                <span className="text-xs font-bold leading-tight text-slate-700">Asistente institucional</span>
              </div>
              <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-[#006EC7]">
                  <BookOpen aria-hidden="true" className="h-4 w-4" />
                </span>
                <span className="text-xs font-bold leading-tight text-slate-700">Guías por trámite</span>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600 shadow-sm">
                <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5 text-emerald-600" />
                Información oficial
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {CENTRO_AYUDA.map((tema) => {
              const activo = abierto === tema.id;
              return (
                <div
                  key={tema.id}
                  className={`overflow-hidden rounded-xl border bg-white transition ${
                    activo ? "border-[#006EC7]/40 shadow-md" : "border-slate-200"
                  }`}
                >
                  <h3>
                    <button
                      type="button"
                      onClick={() => setAbierto((actual) => (actual === tema.id ? null : tema.id))}
                      aria-expanded={activo}
                      aria-controls={`ayuda-panel-${tema.id}`}
                      className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left sm:px-5"
                    >
                      <span className={`text-sm font-bold sm:text-[15px] ${activo ? "text-[#003366]" : "text-slate-700"}`}>
                        {tema.titulo}
                      </span>
                      <span
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full transition ${
                          activo ? "bg-[#003366] text-white" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        <ChevronDown aria-hidden="true" className={`h-4 w-4 transition-transform ${activo ? "rotate-180" : ""}`} />
                      </span>
                    </button>
                  </h3>
                  {activo && (
                    <div
                      id={`ayuda-panel-${tema.id}`}
                      role="region"
                      className="border-t border-slate-100 px-4 pb-4 pt-3 text-sm leading-relaxed text-slate-600 sm:px-5"
                    >
                      <p>{tema.respuesta}</p>
                      {tema.enlaces.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {tema.enlaces.map((enlace) => (
                            <Link
                              key={enlace.to}
                              to={enlace.to ?? "/"}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-[11px] font-bold text-[#006EC7] transition hover:bg-blue-100"
                            >
                              {enlace.etiqueta}
                              <ArrowRight aria-hidden="true" className="h-3 w-3" />
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
