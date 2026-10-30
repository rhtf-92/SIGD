import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { PREGUNTAS_FRECUENTES } from "../../data/landingInstitucional";

export default function SeccionBienvenida() {
  const [abierta, setAbierta] = useState<number | null>(0);

  return (
    <section id="preguntas-frecuentes" className="scroll-mt-24 bg-white py-10 sm:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div id="preguntas" className="mx-auto mt-10 max-w-3xl scroll-mt-24">
          <div className="text-center">
            <span className="text-[11px] font-black uppercase tracking-[0.22em] text-[#E6007E]">
              Resolvemos tus dudas
            </span>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-[#003366] sm:text-3xl">
              Preguntas frecuentes
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Todo lo que necesitas saber para gestionar tus documentos en el SIGD.
            </p>
          </div>

          <div className="mt-6 space-y-3">
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
