import { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { elementoIconoModulo } from "../config/iconosModulos";
import { MODULOS } from "../config/modulos";
import { agruparPorFamilia } from "../config/taxonomiaModulos";
import { useModulosVisibles } from "../hooks/useModulosVisibles";

// Iconos por módulo. La lista se filtra por rol activo mediante
// `useModulosVisibles()`: el menú lateral sólo expone los módulos que el
// rol autenticado tiene permitidos (RBAC de navegación ENT-M05-03).
const CLAVE_COLAPSO = "sigdNavegacionLateralColapsada";

export default function NavegacionLateral() {
  // El estado colapsado se lee del almacenamiento local en el primer render
  // (inicializador perezoso): evita un parpadeo y un render en cascada.
  const [colapsado, setColapsado] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(CLAVE_COLAPSO) === "true";
  });
  const modulos = useModulosVisibles();

  const alternar = () => {
    setColapsado((prev) => {
      const nuevo = !prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(CLAVE_COLAPSO, String(nuevo));
      }
      return nuevo;
    });
  };

  // Los módulos se archivan por familia: el rail se lee como un archivador.
  const grupos = useMemo(() => agruparPorFamilia(modulos), [modulos]);

  // Referencia estable: posición dentro del catálogo completo, no de la vista.
  const referenciaDe = (id: string) => {
    const indice = MODULOS.findIndex((modulo) => modulo.id === id);
    return String(indice >= 0 ? indice + 1 : 0).padStart(2, "0");
  };

  return (
    <nav
      aria-label="Menú lateral de módulos del sistema"
      className={`rail-modulos sticky top-[var(--sigd-altura-cabecera)] hidden h-[calc(100vh_-_var(--sigd-altura-cabecera))] shrink-0 flex-col overflow-hidden transition-[width] duration-200 ease-out md:flex ${
        colapsado ? "w-[4.25rem]" : "w-[var(--sigd-ancho-rail)]"
      }`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-3">
        {!colapsado && (
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white">
              Módulos
            </p>
            <p className="truncate text-[10px] font-medium text-slate-400">
              {modulos.length} de {MODULOS.length} habilitados
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={alternar}
          aria-label={
            colapsado ? "Expandir menú lateral" : "Colapsar menú lateral"
          }
          aria-expanded={!colapsado}
          className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/15 text-slate-400 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          {colapsado ? (
            <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
          ) : (
            <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>

      {modulos.length === 0 ? (
        <p className="px-4 py-4 text-xs font-medium leading-5 text-slate-400">
          No hay módulos habilitados para su perfil institucional.
        </p>
      ) : (
        <div className="scroll-tinta flex-1 overflow-y-auto overflow-x-hidden px-2.5 pb-3">
          {grupos.map((grupo) => (
            <div key={grupo.familia}>
              {!colapsado && <p className="rail-familia">{grupo.nombre}</p>}
              <ul className="flex flex-col gap-0.5">
                {grupo.modulos.map((modulo) => {
                  return (
                    <li key={modulo.id}>
                      <NavLink
                        to={modulo.ruta}
                        title={colapsado ? modulo.titulo : undefined}
                        className="rail-item group"
                      >
                        <span className="rail-icono">
                          {elementoIconoModulo(modulo.id, "h-[16px] w-[16px]")}
                        </span>
                        {!colapsado && (
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-semibold leading-tight">
                              {modulo.titulo}
                            </span>
                            <span className="rail-numero block truncate">
                              {referenciaDe(modulo.id)} · {modulo.id}
                            </span>
                          </span>
                        )}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Pie del rail: sede y estado del servicio. */}
      {!colapsado && (
        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-2 rounded-md bg-white/5 px-2.5 py-2 text-[10px] font-medium text-slate-400">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
            <span className="truncate">Sede Central · Pucallpa</span>
          </div>
          <p className="mt-2 px-1 text-[9px] tracking-wider text-slate-600">
            SIGD v1.0 · RBAC ENT-M05-03
          </p>
        </div>
      )}
    </nav>
  );
}
