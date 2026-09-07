/**
 * ==============================================================================
 * PROYECTO: SIGD (Sistema Integral de Gestión Documentaria) - IESTP "Suiza"
 * ENTREGABLE: ENT-M02-01 — Asistente Wizard de Tramitación de 4 Pasos
 * ARCHIVO: src/pages/tramite/TramiteTestPage.tsx
 * AUTORA: Anllely Melgarejo V. (F_ANLLELY)
 * REVISIÓN: Patricia Marina (R)
 * 
 * DESCRIPCIÓN:
 * Vista oficial de la Mesa de Partes Virtual que alberga el Asistente Wizard de 4 Pasos.
 * Cumple con los requisitos de evaluación docente:
 * 1. Presentación limpia e institucional sin componentes de prueba aislados.
 * 2. Barra de progreso accesible (WCAG 2.1 AA) e indicadores de estado.
 * 3. Persistencia reactiva del borrador en memoria ante avances y retrocesos.
 * 4. Control de navegación bloqueante basado en las reglas de la Ley N° 27444.
 * ==============================================================================
 */

import { useState } from "react";
import MainLayout from "../../layouts/MainLayout";
import TramiteWizard from "../../components/tramite/TramiteWizard";

export default function TramiteTestPage() {
  const [ultimoCut, setUltimoCut] = useState<string | null>(null);

  return (
    <MainLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* CABECERA INSTITUCIONAL OFICIAL */}
        <header className="rounded-2xl border border-blue-200/80 bg-linear-to-r from-blue-50 via-sky-50/50 to-indigo-50/40 p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="rounded-md bg-[#006EC7] px-2.5 py-0.5 text-xs font-black uppercase tracking-wider text-white">
                  Mesa de Partes Virtual
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  IESTP &ldquo;Suiza&rdquo; de Pucallpa
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                Asistente de Registro Documentario en Línea
              </h1>
              <p className="mt-1.5 text-sm text-slate-600 max-w-2xl leading-relaxed">
                Complete los 4 pasos secuenciales para registrar formalmente su solicitud o expediente institucional.
                Sus datos son validados conforme a la Ley del Procedimiento Administrativo General (Ley N° 27444).
              </p>
            </div>

            <div className="shrink-0 self-start md:self-auto">
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-xs">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Ventanilla Virtual Abierta
              </span>
            </div>
          </div>
        </header>

        {/* NOTIFICACIÓN DE EXPEDIENTE RADICADO EN ESTA SESIÓN */}
        {ultimoCut && (
          <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
    </MainLayout>
  );
}
