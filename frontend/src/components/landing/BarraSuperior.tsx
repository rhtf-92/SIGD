import { Landmark, MapPin } from "lucide-react";

import { CONTACTO, ENLACES_SUPERIORES } from "../../data/landingInstitucional";
import EnlaceLanding from "./EnlaceLanding";

export default function BarraSuperior() {
  return (
    <div className="bg-[#04213f] text-blue-50 print:hidden">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-2 text-[11px] font-medium sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-blue-100/90">
          <span className="inline-flex items-center gap-1.5">
            <Landmark aria-hidden="true" className="h-3 w-3 text-cyan-300" />
            {CONTACTO.institucion}
          </span>
          <span className="hidden items-center gap-1.5 text-blue-100/80 md:inline-flex">
            <MapPin aria-hidden="true" className="h-3 w-3 text-cyan-300" />
            {CONTACTO.ubicacion}
          </span>
        </div>

        <nav aria-label="Accesos rápidos" className="flex flex-wrap items-center gap-1">
          {ENLACES_SUPERIORES.map((enlace) => (
            <EnlaceLanding
              key={enlace.etiqueta}
              enlace={enlace}
              className="rounded-full border border-white/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-50 transition hover:border-cyan-300/60 hover:bg-white/10 hover:text-white"
            />
          ))}
        </nav>
      </div>
    </div>
  );
}
