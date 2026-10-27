import { ArrowRight, ChevronLeft, ChevronRight, LayoutGrid } from "lucide-react";
import { useRef } from "react";
import { Link } from "react-router-dom";

import { useSesion } from "../../config/accesoModulos";
import { MODULOS_DESTACADOS, MODULOS_SIGD } from "../../data/landingInstitucional";

export default function SeccionProgramas() {
  const { autenticado } = useSesion();
  const pistaRef = useRef<HTMLDivElement>(null);

  const desplazar = (direccion: number) => {
    pistaRef.current?.scrollBy({ left: direccion * 340, behavior: "smooth" });
  };

  const modulos = MODULOS_DESTACADOS.length > 0 ? MODULOS_DESTACADOS : MODULOS_SIGD;

  return (
    <section id="programas" className="scroll-mt-24 bg-white py-14 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.22em] text-[#E6007E]">
              <LayoutGrid aria-hidden="true" className="h-4 w-4" />
              Módulos destacados
            </span>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-[#003366] sm:text-3xl">Módulos del SIGD</h2>
            <p className="mt-1 max-w-xl text-sm text-slate-500">
              Accede a los módulos del Sistema Integral de Gestión Documentaria.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => desplazar(-1)}
              aria-label="Módulos anteriores"
              className="grid h-9 w-9 place-items-center rounded-full border border-slate-300 text-slate-600 transition hover:border-[#003366] hover:bg-[#003366] hover:text-white"
            >
              <ChevronLeft aria-hidden="true" className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => desplazar(1)}
              aria-label="Módulos siguientes"
              className="grid h-9 w-9 place-items-center rounded-full border border-slate-300 text-slate-600 transition hover:border-[#003366] hover:bg-[#003366] hover:text-white"
            >
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div
          ref={pistaRef}
          className="mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {modulos.map((modulo) => (
            <article
              key={modulo.id}
              className="group flex w-[78%] shrink-0 snap-start flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl sm:w-[46%] lg:w-[31.5%] xl:w-[23.4%]"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-lg font-black text-[#003366]">
                  {modulo.titulo.slice(0, 1)}
                </span>
                {modulo.subtitulo && (
                  <span className="rounded bg-[#F9E000] px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#003366]">
                    {modulo.subtitulo}
                  </span>
                )}
              </div>
              <h3 className="mt-3 min-h-[2.5rem] text-sm font-black leading-snug text-[#003366]">
                {modulo.titulo}
              </h3>
              <p className="mt-1 flex-1 text-xs leading-relaxed text-slate-500">{modulo.descripcion}</p>
              <Link
                to={autenticado ? modulo.ruta : "/login"}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#E6007E] transition hover:gap-2.5"
              >
                Abrir módulo
                <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
              </Link>
            </article>
          ))}
        </div>

        <div className="mt-6 text-center">
          <Link
            to="/tramite"
            className="inline-flex items-center gap-2 rounded-lg bg-[#003366] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#00264d]"
          >
            Ir a la Mesa de Partes
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
