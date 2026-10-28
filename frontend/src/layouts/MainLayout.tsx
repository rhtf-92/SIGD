import type { ReactNode } from "react";

import AsistenteIA from "../components/asistente/AsistenteIA";
import HeaderInstitucional from "../components/HeaderInstitucional";
import NavegacionLateral from "../components/NavegacionLateral";
import SelloInstitucional from "../components/common/SelloInstitucional";
import { useAutenticado } from "../hooks/useModulosVisibles";

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
  const autenticado = useAutenticado();

  return (
    <div className="flex min-h-screen flex-col bg-vault-papel text-vault-tinta">
      <HeaderInstitucional />

      <div className="flex flex-1 items-start">
        {autenticado && <NavegacionLateral />}

        <div className="min-w-0 flex-1">{children}</div>
      </div>

      <footer className="footer-sigd print:hidden">
        <div className="mx-auto flex max-w-[1680px] flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <SelloInstitucional className="h-9 w-9 shrink-0 text-tinta-300" />
            <div>
              <p className="text-xs font-semibold text-vault-tinta">
                IESTP Público “Suiza” — Pucallpa
              </p>
              <p className="text-[11px] text-tinta-500">
                Sistema Integral de Gestión Documentaria · SIGD v1.0
              </p>
            </div>
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-tinta-400">
            Ley N.º 27444 · Ley N.º 27269 · Ley N.º 29733
          </p>
        </div>
      </footer>

      <AsistenteIA />
    </div>
  );
}
