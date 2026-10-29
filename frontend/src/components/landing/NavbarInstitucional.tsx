import { ChevronDown, Menu, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { MENU_PRINCIPAL } from "../../data/landingInstitucional";
import EnlaceLanding from "./EnlaceLanding";

interface NavbarInstitucionalProps {
  acciones?: ReactNode;
}

export default function NavbarInstitucional({ acciones }: NavbarInstitucionalProps) {
  const [abierto, setAbierto] = useState<string | null>(null);
  const [movil, setMovil] = useState(false);
  const [movilGrupo, setMovilGrupo] = useState<string | null>(null);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto && !movil) return;
    const onTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAbierto(null);
        setMovil(false);
      }
    };
    const onClicFuera = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setAbierto(null);
      }
    };
    document.addEventListener("keydown", onTecla);
    document.addEventListener("mousedown", onClicFuera);
    return () => {
      document.removeEventListener("keydown", onTecla);
      document.removeEventListener("mousedown", onClicFuera);
    };
  }, [abierto, movil]);

  const cerrar = () => {
    setAbierto(null);
    setMovil(false);
    setMovilGrupo(null);
  };

  return (
    <div ref={navRef} className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur print:hidden">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
        <Link to="/" className="flex min-w-0 items-center gap-2.5" onClick={cerrar}>
          <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-white">
            <img src={new URL("../../assets/LOGOS ACTUALES/EDITADO 01 .jpg", import.meta.url).href} alt="SIGD" className="h-full w-full object-contain animate-pulse" />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[15px] font-black tracking-tight text-[#003366]">
              SIGD
            </span>
            <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-[#006EC7]">
              Gestión Documental
            </span>
          </span>
        </Link>

        <nav aria-label="Navegación principal" className="hidden items-center gap-0.5 xl:flex">
          {MENU_PRINCIPAL.map((grupo) => {
            const activo = abierto === grupo.etiqueta;
            if (!grupo.enlaces) {
              return (
                <EnlaceLanding
                  key={grupo.etiqueta}
                  enlace={{ etiqueta: grupo.etiqueta, to: grupo.to }}
                  className="rounded-lg px-2.5 py-2 text-[12px] font-bold text-slate-700 transition hover:bg-blue-50 hover:text-[#003366]"
                />
              );
            }
            return (
              <div
                key={grupo.etiqueta}
                className="relative"
                onMouseEnter={() => setAbierto(grupo.etiqueta)}
                onMouseLeave={() => setAbierto((actual) => (actual === grupo.etiqueta ? null : actual))}
              >
                <button
                  type="button"
                  aria-expanded={activo}
                  aria-haspopup="menu"
                  onClick={() => setAbierto(grupo.etiqueta)}
                  className={`flex items-center gap-1 rounded-lg px-2.5 py-2 text-[12px] font-bold transition ${
                    activo ? "bg-blue-50 text-[#003366]" : "text-slate-700 hover:bg-blue-50 hover:text-[#003366]"
                  }`}
                >
                  {grupo.etiqueta}
                  <ChevronDown
                    aria-hidden="true"
                    className={`h-3.5 w-3.5 text-slate-400 transition-transform ${activo ? "rotate-180" : ""}`}
                  />
                </button>
                {activo && (
                  <div
                    role="menu"
                    className="absolute left-0 top-full z-50 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 text-slate-700 shadow-2xl"
                  >
                    {grupo.enlaces.map((enlace) => (
                      <EnlaceLanding
                        key={enlace.etiqueta}
                        enlace={enlace}
                        onClick={cerrar}
                        className="flex items-center justify-between gap-2 px-4 py-2 text-left text-[12.5px] font-semibold transition hover:bg-blue-50 hover:text-[#003366]"
                      >
                        <span className="flex items-center gap-1.5">
                          {enlace.etiqueta}
                          {enlace.href && (
                            <span aria-hidden="true" className="text-[10px] text-slate-400">
                              ↗
                            </span>
                          )}
                        </span>
                      </EnlaceLanding>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setMovil((v) => !v);
              setAbierto(null);
            }}
            aria-expanded={movil}
            aria-label={movil ? "Cerrar menú de navegación" : "Abrir menú de navegación"}
            className="grid h-9 w-9 place-items-center rounded-lg border border-slate-300 text-slate-700 transition hover:bg-slate-100 xl:hidden"
          >
            {movil ? <X aria-hidden="true" className="h-4 w-4" /> : <Menu aria-hidden="true" className="h-4 w-4" />}
          </button>
          {acciones}
        </div>
      </div>

      {movil && (
        <div className="border-t border-slate-200 bg-white xl:hidden">
          <nav aria-label="Navegación principal móvil" className="mx-auto max-h-[70vh] max-w-7xl overflow-y-auto px-4 py-2 sm:px-6">
            {MENU_PRINCIPAL.map((grupo) => {
              const activo = movilGrupo === grupo.etiqueta;
              if (!grupo.enlaces) {
                return (
                  <EnlaceLanding
                    key={grupo.etiqueta}
                    enlace={{ etiqueta: grupo.etiqueta, to: grupo.to }}
                    onClick={cerrar}
                    className="block border-b border-slate-100 py-2.5 text-sm font-bold text-slate-800"
                  />
                );
              }
              return (
                <div key={grupo.etiqueta} className="border-b border-slate-100">
                  <button
                    type="button"
                    aria-expanded={activo}
                    onClick={() => setMovilGrupo((actual) => (actual === grupo.etiqueta ? null : grupo.etiqueta))}
                    className="flex w-full items-center justify-between gap-2 py-2.5 text-left text-sm font-bold text-slate-800"
                  >
                    {grupo.etiqueta}
                    <ChevronDown
                      aria-hidden="true"
                      className={`h-4 w-4 text-slate-400 transition-transform ${activo ? "rotate-180" : ""}`}
                    />
                  </button>
                  {activo && (
                    <ul className="pb-2">
                      {grupo.enlaces.map((enlace) => (
                        <li key={enlace.etiqueta}>
                          <EnlaceLanding
                            enlace={enlace}
                            onClick={cerrar}
                            className="block rounded-md px-3 py-2 text-[13px] font-semibold text-slate-600 transition hover:bg-blue-50 hover:text-[#003366]"
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </nav>
        </div>
      )}
    </div>
  );
}
