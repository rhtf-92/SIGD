import {
  ChevronDown,
  FileSearch,
  Gauge,
  Lock,
  MessagesSquare,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { useState } from "react";

import { PREGUNTAS_FRECUENTES } from "../../data/landingInstitucional";

const PILARES = [
  {
    icono: Lock,
    codigo: "404",
    titulo: "EN MANTENIMIENTO",
    descripcion: "Error 404 - Módulo en Mantenimiento",
    alerta: true,
  },
  {
    icono: Workflow,
    codigo: "02",
    titulo: "Trámites guiados",
    descripcion: "Un asistente paso a paso con validación en tiempo real y cargo digital.",
    alerta: false,
  },
  {
    icono: FileSearch,
    codigo: "03",
    titulo: "Trazabilidad total",
    descripcion: "Consulta el estado de tu expediente con el CUT en cualquier momento.",
    alerta: false,
  },
  {
    icono: MessagesSquare,
    codigo: "04",
    titulo: "Asistente SIGI",
    descripcion: "Orientación inmediata 24/7 sobre requisitos, plazos y soporte técnico.",
    alerta: false,
  },
];

const PASOS = [
  { titulo: "Escanea tu DNI", detalle: "Autocompleta tu identidad." },
  { titulo: "Completa el trámite", detalle: "Adjunta tus requisitos en PDF." },
  { titulo: "Recibe tu CUT", detalle: "Código único de seguimiento." },
  { titulo: "Sigue el expediente", detalle: "Consulta el estado en línea." },
];

export default function SeccionBienvenida() {
  const [abierta, setAbierta] = useState<number | null>(0);

  return (
    <div className="relative">
      <section id="como-funciona" className="scroll-mt-28 bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="section-title inline-flex items-center gap-2">
                <Gauge className="h-3.5 w-3.5" aria-hidden="true" />
                Experiencia SIGD
              </span>
              <h2 className="mt-3 max-w-2xl text-3xl font-black tracking-[-0.035em] text-vault-tinta sm:text-4xl">
                Todo el ciclo documental, en una sola interfaz.
              </h2>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-tinta-500">
              Diseñado para reducir tiempos de atención y eliminar el papel. Cada acción
              queda registrada, firmada y disponible para el ciudadano.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PILARES.map(({ icono: Icono, codigo, titulo, descripcion, alerta }) => (
              <article
                key={codigo}
                className={`ficha-modulo group p-5 ${
                  alerta ? "border-amber-200 bg-amber-50/60" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`ficha-icono ${
                      alerta ? "border-amber-200 bg-amber-100 text-amber-700" : ""
                    }`}
                  >
                    <Icono className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span
                    className={`font-mono text-[10px] font-semibold tracking-[0.16em] ${
                      alerta ? "text-amber-600" : "text-tinta-300"
                    }`}
                  >
                    {codigo}
                  </span>
                </div>
                <h3 className="mt-5 text-base font-bold text-vault-tinta">{titulo}</h3>
                <p className="mt-2 text-sm leading-relaxed text-tinta-500">{descripcion}</p>
              </article>
            ))}
          </div>

          <div className="mt-12 rounded-2xl border border-vault-papel-3 bg-vault-papel p-4 sm:p-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-tinta-400">
              Ruta de atención
            </p>
            <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {PASOS.map((paso, indice) => (
                <li key={paso.titulo} className="relative flex items-start gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-vault-azul font-mono text-xs font-bold text-white">
                    {indice + 1}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-vault-tinta">{paso.titulo}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-tinta-500">{paso.detalle}</p>
                  </div>
                  {indice < PASOS.length - 1 && (
                    <span
                      aria-hidden="true"
                      className="absolute -right-1.5 top-4 hidden h-px w-3 bg-vault-papel-3 lg:block"
                    />
                  )}
                </li>
              ))}
            </ol>
          </div>

          <div className="mt-6 flex flex-col gap-3 rounded-xl border border-vault-azul/15 bg-vault-azul-lavado px-4 py-3 sm:flex-row sm:items-center">
            <ShieldCheck className="h-4 w-4 shrink-0 text-vault-azul" aria-hidden="true" />
            <p className="text-xs leading-relaxed text-vault-azul-tinta">
              <span className="font-bold">Validez legal:</span> el SIGD opera bajo la Ley N.º
              27444 (TUO del Procedimiento Administrativo General), la Ley N.º 27269 de
              Firmas y Certificados Digitales y la Ley N.º 29733 de Protección de Datos
              Personales.
            </p>
          </div>
        </div>
      </section>

      <section
        id="preguntas-frecuentes"
        className="scroll-mt-28 border-t border-vault-papel-3 bg-vault-papel py-16 sm:py-20"
      >
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="section-title inline-flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Resolvemos tus dudas
            </span>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-vault-tinta sm:text-4xl">
              Preguntas frecuentes
            </h2>
            <p className="mt-3 text-sm text-tinta-500">
              Todo lo que necesitas saber para gestionar tus documentos en el SIGD.
            </p>
          </div>

          <div className="mt-9 space-y-3">
            {PREGUNTAS_FRECUENTES.map((item, posicion) => {
              const activa = abierta === posicion;
              return (
                <div
                  key={item.pregunta}
                  className={`overflow-hidden rounded-xl border bg-white transition-colors ${
                    activa
                      ? "border-vault-azul/40 shadow-sm"
                      : "border-vault-papel-3 hover:border-tinta-300"
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
                      <span className="text-sm font-semibold text-vault-tinta sm:text-[15px]">
                        {item.pregunta}
                      </span>
                      <span
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border transition ${
                          activa
                            ? "border-vault-azul bg-vault-azul text-white"
                            : "border-vault-papel-3 bg-vault-papel text-tinta-500"
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
                    className="border-t border-vault-papel-2 px-4 pb-4 pt-3 text-sm leading-relaxed text-tinta-600 sm:px-5"
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
