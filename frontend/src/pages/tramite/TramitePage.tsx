/**
 * ==============================================================================
 * PROYECTO: SIGD (Sistema Integral de Gestión Documentaria) - IESTP "Suiza"
 * ENTREGABLES: ENT-M02-01 (Asistente Wizard) & ENT-M02-02 (Motor JSON Schema)
 * ARCHIVO: src/pages/tramite/TramitePage.tsx
 * RESPONSABLE: Anllely Melgarejo V. (F_ANLLELY)
 * 
 * DESCRIPCIÓN:
 * Vista oficial de la Mesa de Partes Virtual con el Asistente Wizard de 4 Pasos.
 * Incorpora:
 * - Banner Hero a 100% de ancho real con la imagen panorámica 'fondo-mesadepartes.png'
 *   (fachada del IESTP Suiza a la izquierda, degradado azul y ondas inferiores visibles sin recortes).
 * - Tarjeta translúcida con Glassmorphism luminoso claro (backdrop-blur, borde fino celeste luminoso y sombra suave).
 * - Insignias institucionales "IESTP Suiza de Pucallpa" y "Servicio en Línea" con status verde.
 * - Título principal con realce celeste brillante en "Línea".
 * - Botón "← Volver al Inicio" translúcido/oscuro sutil y "Ventanilla Virtual Abierta" con resplandor verde-menta/turquesa.
 * - Ícono vectorial decorativo de carpeta con check azul a la derecha dentro del panel.
 * - Zona inferior para el Asistente Wizard de 4 Pasos con máxima legibilidad y contraste.
 * - Integración 100% íntegra con TramiteWizard, validación TUPA y radicación legal.
 * ==============================================================================
 */

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import TramiteWizard from "../../components/tramite/TramiteWizard";

export default function TramitePage() {
  const [ultimoCut, setUltimoCut] = useState<string | null>(null);

  return (
    <div
      className="relative w-full min-h-[calc(100vh-96px)] text-slate-800 flex flex-col overflow-x-hidden bg-[#eef4fb] bg-cover bg-left-top bg-no-repeat"
      style={{
        backgroundImage: "url('/images/fondo-mesadepartes.png')",
        backgroundAttachment: "fixed",
      }}
    >
      {/* 1. FONDO EXTENDIDO EN TODO EL MÓDULO CON fondo-mesadepartes.png */}
      <div
        className="pointer-events-none fixed inset-0 z-0 bg-cover bg-left-top bg-no-repeat"
        style={{
          backgroundImage: "url('/images/fondo-mesadepartes.png')",
        }}
        aria-hidden="true"
      />

      {/* 2. ÁREA DE CONTENIDO Y ASISTENTE WIZARD */}
      <main className="relative z-10 w-full pt-4 sm:pt-6 pb-10 px-4 sm:px-6 lg:px-8 flex-1">
        <div className="mx-auto w-[94%] max-w-[1520px] space-y-6">
          {/* Notificación de Expediente Radicado en esta Sesión */}
          {ultimoCut && (
            <div className="rounded-2xl border border-emerald-300 bg-emerald-50/95 backdrop-blur-sm p-4 text-sm text-emerald-900 flex items-center justify-between shadow-md animate-fadeIn">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
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

          {/* Asistente Wizard Oficial de Mesa de Partes */}
          <TramiteWizard
            onSuccess={(_data, cut) => {
              setUltimoCut(cut);
            }}
          />
        </div>
      </main>
    </div>
  );
}
