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
 * Cumple con los requisitos de evaluación docente:
 * 1. Presentación limpia e institucional sin componentes de prueba aislados.
 * 2. Barra de progreso accesible (WCAG 2.1 AA) e indicadores de estado.
 * 3. Persistencia reactiva del borrador en memoria ante avances y retrocesos.
 * 4. Control de navegación bloqueante basado en las reglas de la Ley N° 27444.
 * ==============================================================================
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import TramiteWizard from "../../components/tramite/TramiteWizard";

export default function TramitePage() {
  const [ultimoCut, setUltimoCut] = useState<string | null>(null);

  return (
    <div className="space-y-5 w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-4 sm:py-6">
      {/* Migajas de pan canónicas */}
      <nav
        aria-label="Migajas de pan de trámites"
        className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-slate-500"
      >
        <Link to="/" className="hover:text-blue-700 hover:underline transition-colors">
          Inicio
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-slate-600">Trámites</span>
        <span className="text-slate-300">/</span>
        <span aria-current="page" className="font-semibold text-blue-700">
          Mesa de Partes Virtual
        </span>
      </nav>


      {/* CABECERA INSTITUCIONAL OFICIAL */}
      <header className="rounded-xl sm:rounded-2xl border border-blue-200/80 bg-linear-to-r from-blue-50 via-sky-50/50 to-indigo-50/40 p-4 sm:p-7 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-slate-900">
              Asistente de Registro Documentario en Línea
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-600 max-w-3xl xl:max-w-4xl leading-relaxed">
              Complete los 4 pasos secuenciales para registrar formalmente su solicitud o expediente institucional.
              Sus datos son validados conforme a la Ley del Procedimiento Administrativo General (Ley N° 27444).
            </p>
          </div>

          <div className="flex flex-wrap shrink-0 items-center gap-2 sm:gap-3 self-start md:self-auto">
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Ventanilla Virtual 24x7
            </span>
          </div>
        </div>
      </header>

      {/* NOTIFICACIÓN DE EXPEDIENTE RADICADO EN ESTA SESIÓN */}
      {ultimoCut && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-xs sm:text-sm text-emerald-900 flex items-center justify-between shadow-xs animate-fadeIn">
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
            className="text-xs text-emerald-700 hover:underline font-bold cursor-pointer ml-2"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* ASISTENTE WIZARD OFICIAL DE 4 PASOS */}
      <div className="w-full">
        <TramiteWizard
          onSuccess={(_data, cut) => {
            setUltimoCut(cut);
          }}
        />
      </div>
    </div>
  );
}
