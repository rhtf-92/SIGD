/**
 * ==============================================================================
 * PROYECTO: SIGD (Sistema Integral de Gestión Documentaria) - IESTP "Suiza"
 * ENTREGABLES: ENT-M02-01 (Asistente Wizard) & ENT-M02-02 (Motor JSON Schema)
 * ARCHIVO: src/pages/tramite/TramitePage.tsx
 * RESPONSABLE: Anllely Melgarejo V. (F_ANLLELY)
 * COLABORADORAS: Lucy Panduro Ramos, Noelia Alva (Grupo 1)
 * 
 * DESCRIPCIÓN:
 * Vista oficial de la Mesa de Partes Virtual que alberga el Asistente Wizard de 4 Pasos.
 * Diseño institucional moderno:
 * - Paleta oficial azul marino oscuro (#062856) y acentos en azul brillante (#1877f2).
 * - Fondo degradado celeste/azul suave (#eef4fb a #f8fafc) con patrones decorativos laterales.
 * - Hero Card institucional con ilustración vectorial y badges normativos.
 * - Mantenimiento 100% íntegro de la lógica, estados, reducers y persistencia reactiva.
 * ==============================================================================
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import TramiteWizard from "../../components/tramite/TramiteWizard";

export default function TramitePage() {
  const [ultimoCut, setUltimoCut] = useState<string | null>(null);

  return (
    <div className="relative min-h-[calc(100vh-65px)] w-full bg-gradient-to-b from-[#eef4fb] via-[#f1f6fc] to-[#f8fafc] py-8 px-4 sm:px-6 lg:px-8 text-slate-800 overflow-x-hidden">
      {/* Patrones decorativos sutiles de puntos en los laterales */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-24 sm:w-48 opacity-35 bg-[radial-gradient(#94a3b8_1.2px,transparent_1.2px)] [background-size:16px_16px] [mask-image:linear-gradient(to_right,white,transparent)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-24 sm:w-48 opacity-35 bg-[radial-gradient(#94a3b8_1.2px,transparent_1.2px)] [background-size:16px_16px] [mask-image:linear-gradient(to_left,white,transparent)]"
        aria-hidden="true"
      />

      <div className="relative z-10 max-w-5xl mx-auto space-y-7">
        {/* TARJETA BANNER DE CABECERA (HERO CARD) */}
        <header className="rounded-2xl border border-sky-100 bg-gradient-to-r from-white via-white to-sky-50/80 p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            {/* Lado izquierdo */}
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 border border-blue-200/80 px-3.5 py-1 text-xs font-semibold text-[#1877f2] mb-3 shadow-2xs">
                <svg className="w-3.5 h-3.5 text-[#1877f2]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <span className="font-extrabold tracking-wide uppercase">MESA DE PARTES VIRTUAL</span>
                <span className="text-blue-300">|</span>
                <span className="text-slate-600 font-medium">IESTP &ldquo;Suiza&rdquo; de Pucallpa</span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#062856]">
                Asistente de Registro Documentario en Línea
              </h1>

              <p className="mt-2 text-sm text-slate-600 max-w-2xl leading-relaxed">
                Complete los 4 pasos secuenciales para registrar formalmente su solicitud o expediente institucional.
                Sus datos son validados conforme a la Ley del Procedimiento Administrativo General (Ley N° 27444).
              </p>
            </div>

            {/* Lado derecho: Ilustración vectorial y botones horizontales */}
            <div className="flex flex-col items-center sm:items-end justify-between gap-4 shrink-0">
              {/* Ilustración vectorial de carpeta azul con documento saliendo y check circular azul */}
              <div className="w-28 h-20 sm:w-32 sm:h-24 relative flex items-center justify-center">
                <svg viewBox="0 0 120 100" fill="none" className="w-full h-full drop-shadow-sm">
                  {/* Pestaña posterior */}
                  <path d="M14 26C14 22.6863 16.6863 20 20 20H44C46.5 20 48.5 21.5 50 23L55 28C56.5 29.5 58.5 31 61 31H100C103.314 31 106 33.6863 106 37V80C106 83.3137 103.314 86 100 86H20C16.6863 86 14 83.3137 14 80V26Z" fill="#1877f2" fillOpacity="0.18" />
                  {/* Hoja de documento saliendo de la carpeta */}
                  <rect x="36" y="8" width="48" height="60" rx="4" fill="#ffffff" stroke="#93c5fd" strokeWidth="1.5" />
                  <line x1="44" y1="18" x2="68" y2="18" stroke="#1877f2" strokeWidth="2.5" strokeLinecap="round" />
                  <line x1="44" y1="26" x2="76" y2="26" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
                  <line x1="44" y1="34" x2="72" y2="34" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
                  <line x1="44" y1="42" x2="62" y2="42" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
                  {/* Solapa frontal de la carpeta */}
                  <path d="M10 36C10 32.6863 12.6863 30 16 30H104C107.314 30 110 32.6863 110 36V82C110 85.3137 107.314 88 104 88H16C12.6863 88 10 85.3137 10 82V36Z" fill="url(#heroFolderGradient)" />
                  {/* Check circular azul */}
                  <circle cx="88" cy="68" r="14" fill="#1877f2" stroke="#ffffff" strokeWidth="2.5" />
                  <path d="M82 68L86 72L94 64" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  <defs>
                    <linearGradient id="heroFolderGradient" x1="10" y1="30" x2="110" y2="88" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#2563eb" />
                      <stop offset="1" stopColor="#0a3269" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>

              {/* Botones horizontales debajo */}
              <div className="flex flex-wrap items-center gap-2.5">
                <Link
                  to="/"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-slate-400 transition"
                >
                  <span>←</span>
                  <span>Volver al Inicio</span>
                </Link>
                <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-200/80 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span>Ventanilla Virtual Abierta</span>
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* NOTIFICACIÓN DE EXPEDIENTE RADICADO EN ESTA SESIÓN */}
        {ultimoCut && (
          <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900 flex items-center justify-between shadow-xs animate-fadeIn">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>
                Expediente radicado con éxito. Código Único de Trámite: <strong>{ultimoCut}</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={() => setUltimoCut(null)}
              className="text-xs text-emerald-700 hover:underline font-bold cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* ASISTENTE WIZARD OFICIAL DE 4 PASOS */}
        <main>
          <TramiteWizard
            onSuccess={(_data, cut) => {
              setUltimoCut(cut);
            }}
          />
        </main>
      </div>
    </div>
  );
}
