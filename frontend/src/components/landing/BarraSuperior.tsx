import { Landmark, MapPin } from "lucide-react";

import { CONTACTO, ENLACES_SUPERIORES } from "../../data/landingInstitucional";
import EnlaceLanding from "./EnlaceLanding";

export default function BarraSuperior() {
  return (
    <div className="bg-[#f4f8fb] text-[#4b6b85] print:hidden">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-2 text-[11px] font-medium sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[#e8f4ff]/90">
          <span className="inline-flex items-center gap-1.5">
            <Landmark aria-hidden="true" className="h-3 w-3 text-cyan-300" />
            {CONTACTO.institucion}
          </span>
          <span className="hidden items-center gap-1.5 text-[#e8f4ff]/80 md:inline-flex">
            <MapPin aria-hidden="true" className="h-3 w-3 text-cyan-300" />
            {CONTACTO.ubicacion}
          </span>
        </div>

        <nav aria-label="Accesos rápidos" className="flex flex-wrap items-center gap-1">
          {ENLACES_SUPERIORES.map((enlace) => (
            <EnlaceLanding
              key={enlace.etiqueta}
              enlace={enlace}
              className="rounded-full border border-[#d7e9f7] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#4b6b85] transition hover:border-[#006ec7] hover:bg-[#e8f4ff] hover:text-[#006ec7]"
            />
          ))}
        </nav>
      </div>
    </div>
  );
}
