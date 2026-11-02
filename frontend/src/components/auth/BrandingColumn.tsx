import React from "react";
import { ShieldCheck, FileCheck2, Stamp, Sparkles, Building2 } from "lucide-react";

export default function BrandingColumn(): React.JSX.Element {
  return (
    <aside
      aria-label="Información institucional del IESTP Suiza y del sistema SIGD"
      className="relative flex flex-col justify-between overflow-hidden bg-gradient-to-br from-[#0c2340] via-[#0f3261] to-[#1e3a8a] px-6 py-8 sm:px-10 sm:py-12 lg:w-1/2 lg:min-h-screen lg:px-14 lg:py-14 text-white"
    >
      <video
        aria-hidden="true"
        autoPlay
        className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover object-center"
        loop
        muted
        playsInline
        preload="metadata"
      >
        <source
          src="https://iestpsuiza.edu.pe/wp-content/uploads/2023/09/instituto.mp4"
          type="video/mp4"
        />
      </video>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1] bg-[#0c2340]/65"
      />

      {/* Patrón geométrico institucional de fondo (efecto filigrana de seguridad sobria) */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
          backgroundSize: "28px 28px",
        }}
        aria-hidden="true"
      />

      {/* Sutil halo decorativo institucional */}
      <div
        className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-[#0c2340]/60 blur-3xl"
        aria-hidden="true"
      />

      {/* 1. Cabecera y servicios institucionales */}
      <div className="relative isolate -mx-6 -mt-8 mb-8 overflow-hidden px-6 pb-6 pt-8 sm:-mx-10 sm:-mt-12 sm:mb-10 sm:px-10 sm:pb-7 sm:pt-12 lg:-mx-14 lg:-mt-14 lg:mb-12 lg:px-14 lg:pb-8 lg:pt-14">
        <div className="relative z-10">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white text-[#0c2340] shadow-md select-none"
                aria-label="Logotipo oficial S del IESTP Suiza"
              >
                <span className="font-serif text-2xl font-black tracking-tight">S</span>
              </div>

              <div className="flex flex-col">
                <span className="text-base font-extrabold tracking-wider uppercase text-white font-sans leading-tight">
                  IESTP SUIZA
                </span>
                <span className="text-[11px] font-semibold tracking-widest uppercase text-slate-200">
                  PUCALLPA • UCAYALI
                </span>
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-slate-950/25 px-3 py-1 text-xs font-semibold text-white shadow-sm backdrop-blur-xs">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
              <span>Portal Oficial v1.0</span>
            </div>
          </header>

          <div className="mt-8 flex flex-wrap items-center gap-2 sm:mt-10">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-white/25 bg-slate-950/25 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-xs">
              <FileCheck2 className="h-3.5 w-3.5 text-blue-200" aria-hidden="true" />
              Trámite Documentario
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-white/25 bg-slate-950/25 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-xs">
              <Stamp className="h-3.5 w-3.5 text-blue-200" aria-hidden="true" />
              Firma Digital Legal
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-white/25 bg-slate-950/25 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-xs">
              <Sparkles className="h-3.5 w-3.5 text-blue-200" aria-hidden="true" />
              Cero Papel
            </span>
          </div>
        </div>
      </div>

      {/* 2. Contenido Central */}
      <section className="relative z-10 my-10 lg:my-auto max-w-xl space-y-6">
        {/* Título y Subtítulo */}
        <div className="space-y-2">
          <h1 className="text-5xl font-black tracking-tight text-white sm:text-6xl lg:text-7xl">
            SIGD
          </h1>
          <p className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">
            Sistema Integral de Gestión Documentaria
          </p>
        </div>

        {/* Descripción Institucional */}
        <p className="text-sm sm:text-base text-slate-200/90 leading-relaxed font-normal">
          Plataforma oficial para la administración, tramitación y seguimiento de expedientes
          académicos y administrativos con valor probatorio y plena validez legal.
        </p>

        {/* Distintivo Institucional Licenciamiento */}
        <div className="inline-flex w-full items-center gap-3.5 rounded-xl border border-amber-300/30 bg-amber-400/10 p-3.5 sm:p-4 text-amber-100 backdrop-blur-xs">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-400/20 text-amber-300">
            <ShieldCheck className="h-6 w-6 text-amber-300" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs sm:text-sm font-bold tracking-wider uppercase text-amber-200">
              INSTITUCIÓN LICENCIADA POR MINEDU
            </p>
            <p className="text-xs text-slate-300">
              Resolución Ministerial N° 409-2019-MINEDU • Excelencia en Educación Superior Pública
            </p>
          </div>
        </div>
      </section>

      {/* 3. Footer Izquierdo */}
      <footer className="relative z-10 pt-6 sm:pt-8 border-t border-white/15 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-blue-300 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold text-white">
              IESTP "Suiza"
            </p>
            <p className="text-[11px] text-slate-400">
              Dirección Regional de Educación de Ucayali
            </p>
          </div>
        </div>

        {/* Distintivo República del Perú */}
        <div
          className="inline-flex items-center gap-2 font-bold tracking-widest uppercase text-slate-200 text-[11px] self-start sm:self-auto bg-black/20 px-3 py-1.5 rounded-md border border-white/10"
          aria-label="República del Perú"
        >
          <div className="flex h-3 w-4.5 overflow-hidden rounded-xs border border-white/40 shadow-xs" aria-hidden="true">
            <span className="w-1.5 h-full bg-red-600" />
            <span className="w-1.5 h-full bg-white" />
            <span className="w-1.5 h-full bg-red-600" />
          </div>
          <span>REPÚBLICA DEL PERÚ</span>
        </div>
      </footer>
    </aside>
  );
}
