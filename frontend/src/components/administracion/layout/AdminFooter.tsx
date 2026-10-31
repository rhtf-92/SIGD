import { MapPin } from "lucide-react";

export default function AdminFooter() {
  return (
    <footer className="mt-auto border-t border-slate-800/80 bg-slate-950/80 py-5 text-slate-400 text-xs backdrop-blur-md print:hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Institutional Info Left */}
          <div className="flex items-center gap-3 text-center md:text-left">
            {/* Bandera de Perú SVG Oficial */}
            <div
              className="w-7 h-4.5 rounded-xs overflow-hidden flex border border-slate-700 shadow-xs shrink-0"
              title="República del Perú"
            >
              <div className="w-1/3 bg-red-600 h-full" />
              <div className="w-1/3 bg-white h-full flex items-center justify-center">
                <div className="w-1 h-1 rounded-full bg-amber-500/80" />
              </div>
              <div className="w-1/3 bg-red-600 h-full" />
            </div>

            <div>
              <p className="font-semibold text-slate-200">
                IESTP Suiza • Dirección Regional de Educación de Ucayali
              </p>
              <p className="text-[11px] text-slate-400">
                Gobierno Regional de Ucayali — República del Perú
              </p>
            </div>
          </div>

          {/* Location & Normative Details Right */}
          <div className="flex items-center gap-3.5 flex-wrap justify-center">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-800 text-slate-300 font-medium text-[11px]">
              <MapPin className="w-3 h-3 text-red-400" />
              <span>Pucallpa, Coronel Portillo, Ucayali</span>
            </div>

            <div className="text-right text-[11px] text-slate-400">
              <span className="font-mono text-cyan-400 font-medium">
                Versión 6.51.3.02.3 : D4
              </span>
              <span className="mx-2 text-slate-600">•</span>
              <span>Conforme a Ley 27269 / 27444</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
