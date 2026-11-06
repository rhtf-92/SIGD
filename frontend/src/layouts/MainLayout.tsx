import type { ReactNode } from "react";

import AsistenteIA from "../components/asistente/AsistenteIA";
import HeaderInstitucional from "../components/HeaderInstitucional";
import SelloInstitucional from "../components/common/SelloInstitucional";

interface MainLayoutProps {
  children: ReactNode;
}

/**
 * Armazón institucional del SIGD.
 *
 * Estructura sobria: banda institucional arriba, rail vertical de módulos
 * (sólo para personal con sesión), lienzo de papel al centro y pie normativo
 * abajo. El ciudadano externo accede sin rail.
 */
export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="sigd-cyber relative flex min-h-screen flex-col bg-[#050506] text-zinc-100">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="cyber-grid animate-grid absolute inset-0 opacity-60" />
        <div className="absolute -left-40 top-[-16%] h-[520px] w-[520px] rounded-full bg-white/[0.05] blur-[130px]" />
        <div className="absolute -right-40 bottom-[-18%] h-[560px] w-[560px] rounded-full bg-white/[0.04] blur-[150px]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        <HeaderInstitucional />

        <div className="flex flex-1 items-start">
          <div className="min-w-0 flex-1">{children}</div>
        </div>

        <footer className="relative border-t border-white/10 bg-black/40 text-zinc-400 backdrop-blur-xl print:hidden">
          <div className="cyber-separator absolute inset-x-0 top-0" />
          <div className="mx-auto flex max-w-[1680px] flex-col gap-4 px-4 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/15 bg-white/[0.04]">
                <SelloInstitucional className="h-7 w-7 shrink-0 text-white/70" />
              </span>
              <div>
                <p className="text-xs font-semibold text-zinc-100">IESTP Público "Suiza" — Pucallpa</p>
                <p className="text-[11px] text-zinc-500">Sistema Integral de Gestión Documentaria · SIGD v1.0</p>
              </div>
            </div>
            <div className="flex flex-col items-start gap-1 sm:items-end">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Ley N.º 27444 · Ley N.º 27269 · Ley N.º 29733
              </p>
              <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-600">
                <span className="h-1.5 w-1.5 rounded-full bg-white/70 animate-pulse-soft" />
                Sistema operativo
              </p>
            </div>
          </div>
        </footer>
      </div>

      <AsistenteIA />
    </div>
  );
}
