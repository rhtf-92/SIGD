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
import { useHorarioCorte } from "../../hooks/useHorarioCorte";

export default function TramitePage() {
  const [ultimoCut, setUltimoCut] = useState<string | null>(null);
  const horario = useHorarioCorte();
  const fechaLegalFormateada = new Date(horario.legalTimestamp).toLocaleDateString("es-PE");

  return (
    /* Contenedor Raíz Luminoso */
    <div className="relative min-h-screen w-full overflow-x-hidden bg-slate-100/80 py-6 px-4 sm:px-6 lg:px-8 text-slate-800">
      {/* Capa de imagen ambiental clara (oficina moderna/tecnológica) */}
      <div
        className="fixed inset-0 pointer-events-none bg-cover bg-center bg-no-repeat opacity-45 scale-105"
        style={{ backgroundImage: `url('/images/mesa-partes-hero-banner.jpg')` }}
        aria-hidden="true"
      />

      {/* Overlay diáfano (degradado claro de luz celestial, no azul oscuro pesado) */}
      <div
        className="fixed inset-0 pointer-events-none bg-gradient-to-b from-sky-100/50 via-white/60 to-slate-100/85 backdrop-blur-[2px]"
        aria-hidden="true"
      />

      {/* Orbes de luz suave para acento visual */}
      <div className="fixed -top-20 -right-20 w-[550px] h-[550px] bg-cyan-400/15 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />
      <div className="fixed top-1/2 -left-20 w-[450px] h-[450px] bg-blue-500/10 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />

      {/* HERO BANNER ELEGANTE */}
      <div className="relative z-10 w-full max-w-7xl mx-auto mb-8 pt-6">
        {/* BOTÓN "IR A INICIO" REDISEÑADO (Cápsula flotante elegante sin casita) */}
        <div className="absolute top-0 left-4 z-30">
          <Link
            to="/"
            className="group inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/95 hover:bg-white text-[#002B49] border border-blue-200/80 shadow-md shadow-blue-950/10 backdrop-blur-md text-xs font-bold transition-all duration-150 hover:-translate-y-0.5 hover:border-cyan-400 select-none cursor-pointer"
            title="Volver a la página principal"
          >
            <span className="text-blue-600 font-extrabold transition-transform duration-150 group-hover:-translate-x-1">←</span>
            <span>Ir a Inicio</span>
          </Link>
        </div>

        {/* TARJETA DEL HERO BANNER (Con imagen fundida en el fondo) */}
        <div className="relative rounded-3xl bg-white/95 backdrop-blur-2xl border border-white/90 shadow-2xl shadow-blue-900/10 overflow-hidden">
          {/* CAPA DE IMAGEN FUSIONADA A LA DERECHA (Sin cuadro, fondo continuo) */}
          <div
            className="absolute right-0 top-0 bottom-0 w-full lg:w-3/5 bg-cover bg-center pointer-events-none opacity-85"
            style={{ backgroundImage: `url('/images/mesa-partes-hero-banner.jpg')` }}
            aria-hidden="true"
          />
          {/* Velo de degradado para fundir la imagen con el blanco del contenido izquierdo */}
          <div
            className="absolute inset-0 bg-gradient-to-r from-white via-white/95 via-45% to-white/20 pointer-events-none"
            aria-hidden="true"
          />

          {/* CONTENIDO INTERNO EN CAPA SUPERIOR (z-10) */}
          <div className="relative z-10 p-6 sm:px-10 sm:pt-8 sm:pb-8 flex flex-col justify-between min-h-[300px]">
            {/* FILA SUPERIOR: BADGES INSTITUCIONALES */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Badge Mesa de Partes */}
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-50/90 border border-blue-200/80 text-blue-700 text-xs font-bold tracking-wide uppercase shadow-xs">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">🏛️</span>
                  <span>MESA DE PARTES VIRTUAL</span>
                  <span className="text-slate-400 font-normal">| IESTP SUIZA</span>
                </div>

                {/* Badge Horario / Ventanilla Legal */}
                <div
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50/90 border border-amber-200/80 text-amber-800 text-xs font-semibold shadow-xs"
                  title={
                    horario.isHorarioHabil
                      ? "Ventanilla dentro de horario de atención oficial (08:00 - 16:30 hrs)"
                      : `Recepción extemporánea. Ingreso formal: ${fechaLegalFormateada} (08:00 hrs)`
                  }
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                  <span>Ventanilla 24/7 · Horario formal Ley N° 27444</span>
                </div>
              </div>
            </div>

            {/* CUERPO PRINCIPAL DE TEXTO */}
            <div className="max-w-2xl">
              <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-black text-[#002B49] tracking-tight leading-tight">
                Asistente de Registro Documentario en{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 drop-shadow-xs">
                  Línea
                </span>
              </h1>

              <p className="mt-3.5 text-sm text-slate-600 leading-relaxed max-w-xl">
                Gestiona, registra y da seguimiento a tus documentos de manera rápida y segura. Accede a tus trámites, verifica el estado de tus expedientes y mantén toda tu documentación en un solo lugar.
              </p>
            </div>

            {/* TRILOGÍA DE SELLOS EN LA BASE */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-8 pt-6 border-t border-slate-100/80 max-w-2xl">
              {/* Seguro */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center text-base shadow-sm shadow-blue-500/25 flex-shrink-0">
                  🛡️
                </div>
                <div>
                  <h2 className="text-xs font-bold text-slate-900 leading-none">Seguro</h2>
                  <p className="text-[11px] text-slate-500 mt-1">Firmas Digitales y CVD</p>
                </div>
              </div>

              {/* Rápido */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-cyan-500 text-white flex items-center justify-center text-base shadow-sm shadow-cyan-500/25 flex-shrink-0">
                  ⚡
                </div>
                <div>
                  <h2 className="text-xs font-bold text-slate-900 leading-none">Rápido</h2>
                  <p className="text-[11px] text-slate-500 mt-1">Atención en línea</p>
                </div>
              </div>

              {/* Transparente */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center text-base shadow-sm shadow-emerald-500/25 flex-shrink-0">
                  📄
                </div>
                <div>
                  <h2 className="text-xs font-bold text-slate-900 leading-none">Transparente</h2>
                  <p className="text-[11px] text-slate-500 mt-1">Seguimiento en tiempo real</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* NOTIFICACIÓN DE EXPEDIENTE RADICADO EN ESTA SESIÓN */}
      {ultimoCut && (
        <div className="relative z-10 w-full max-w-7xl mx-auto mb-6 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900 flex items-center justify-between shadow-xs animate-fadeIn">
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

      {/* ASISTENTE WIZARD OFICIAL DE 4 PASOS (GLASSMORPHISM WRAPPER) */}
      <main className="relative z-10 w-full max-w-7xl mx-auto bg-white/95 backdrop-blur-xl rounded-3xl shadow-xl shadow-slate-900/5 border border-white/80 p-6 sm:p-10">
        <TramiteWizard
          onSuccess={(_data, cut) => {
            setUltimoCut(cut);
          }}
        />
      </main>
    </div>
  );
}
