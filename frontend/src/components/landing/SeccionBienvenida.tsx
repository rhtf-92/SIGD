import {
  ChevronDown,
  FileSearch,
  Fingerprint,
  Gauge,
  MessagesSquare,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { useState } from "react";

import { PREGUNTAS_FRECUENTES } from "../../data/landingInstitucional";

const PILARES = [
  {
    icono: Fingerprint,
    codigo: "01",
    titulo: "Identidad digital",
    descripcion: "Lectura del DNI electrónico y autocompletado seguro de tus datos.",
  },
  {
    icono: Workflow,
    codigo: "02",
    titulo: "Trámites guiados",
    descripcion: "Un asistente paso a paso con validación en tiempo real y cargo digital.",
  },
  {
    icono: FileSearch,
    codigo: "03",
    titulo: "Trazabilidad total",
    descripcion: "Consulta el estado de tu expediente con el CUT en cualquier momento.",
  },
  {
    icono: MessagesSquare,
    codigo: "04",
    titulo: "Asistente SIGI",
    descripcion: "Orientación inmediata 24/7 sobre requisitos, plazos y soporte técnico.",
  },
];

const PASOS = ["Escanea tu DNI", "Completa el trámite", "Recibe tu CUT", "Sigue el expediente"];

export default function SeccionBienvenida() {
  const [abierta, setAbierta] = useState<number | null>(0);

  return (
    <div className="relative">
      <section id="como-funciona" className="scroll-mt-28 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="cyber-chip">
                <Gauge className="h-3.5 w-3.5" />
                Experiencia SIGD
              </span>
              <h2 className="mt-5 max-w-2xl text-3xl font-black tracking-[-0.035em] text-white sm:text-4xl">
                Todo el ciclo documental, en una sola interfaz.
              </h2>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-zinc-400">
              Diseñado para reducir tiempos de atención y eliminar el papel. Cada acción queda
              registrada, firmada y disponible para el ciudadano.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PILARES.map(({ icono: Icono, codigo, titulo, descripcion }) => (
              <article key={codigo} className="glass-card group relative overflow-hidden p-5">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-0 transition group-hover:opacity-100" />
                <div className="flex items-center justify-between">
                  <span className="grid h-11 w-11 place-items-center rounded-xl border border-white/12 bg-white/[0.04] text-white">
                    <Icono className="h-5 w-5" />
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-600">
                    {codigo}
                  </span>
                </div>
                <h3 className="mt-5 text-base font-bold text-white">{titulo}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{descripcion}</p>
              </article>
            ))}
          </div>

          <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {PASOS.map((paso, indice) => (
              <div key={paso} className="relative flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/20 bg-white/[0.06] font-mono text-xs font-bold text-white">
                  {indice + 1}
                </span>
                <span className="text-sm font-semibold text-zinc-200">{paso}</span>
                {indice < PASOS.length - 1 && (
                  <span className="absolute -right-2 top-1/2 hidden h-px w-4 -translate-y-1/2 bg-white/25 lg:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="preguntas-frecuentes"
        className="scroll-mt-28 border-t border-white/10 py-16 sm:py-20"
      >
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="cyber-chip">
              <ShieldCheck className="h-3.5 w-3.5" />
              Resolvemos tus dudas
            </span>
            <h2 className="mt-5 text-3xl font-black tracking-[-0.035em] text-white sm:text-4xl">
              Preguntas frecuentes
            </h2>
            <p className="mt-3 text-sm text-zinc-400">
              Todo lo que necesitas saber para gestionar tus documentos en el SIGD.
            </p>
          </div>

          <div className="mt-9 space-y-3">
            {PREGUNTAS_FRECUENTES.map((item, posicion) => {
              const activa = abierta === posicion;
              return (
                <div
                  key={item.pregunta}
                  className={`overflow-hidden rounded-xl border transition-colors ${
                    activa
                      ? "border-white/30 bg-white/[0.05]"
                      : "border-white/10 bg-white/[0.02] hover:border-white/20"
                  }`}
                >
                  <h3>
                    <button
                      type="button"
                      onClick={() => setAbierta((actual) => (actual === posicion ? null : posicion))}
                      aria-expanded={activa}
                      aria-controls={`faq-panel-${posicion}`}
                      className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left sm:px-5"
                    >
                      <span className={`text-sm font-semibold sm:text-[15px] ${activa ? "text-white" : "text-zinc-300"}`}>
                        {item.pregunta}
                      </span>
                      <span
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border transition ${
                          activa ? "border-white bg-white text-black" : "border-white/15 bg-white/[0.04] text-zinc-400"
                        }`}
                      >
                        <ChevronDown
                          aria-hidden="true"
                          className={`h-4 w-4 transition-transform ${activa ? "rotate-180" : ""}`}
                        />
                      </span>
                    </button>
                  </h3>
                  <div
                    id={`faq-panel-${posicion}`}
                    role="region"
                    hidden={!activa}
                    className="border-t border-white/10 px-4 pb-4 pt-3 text-sm leading-relaxed text-zinc-400 sm:px-5"
                  >
                    {item.respuesta}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
