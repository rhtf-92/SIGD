import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  BadgeCheck,
  BarChart3,
  Building2,
  ChevronLeft,
  ChevronRight,
  FileSignature,
  FolderOpen,
  GraduationCap,
  Inbox,
  LayoutDashboard,
  Send,
  ShieldCheck,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

import { useModulosVisibles } from "../hooks/useModulosVisibles";

// Iconos por módulo. La lista se filtra por rol activo mediante
// `useModulosVisibles()`: el menú lateral sólo expone los módulos que el
// rol autenticado tiene permitidos (RBAC de navegación ENT-M05-03).
const ICONOS: Record<string, LucideIcon> = {
  registro: UserPlus,
  casilla: Inbox,
  "mesa-partes": Send,
  ventanilla: Building2,
  expedientes: FolderOpen,
  "validez-legal": ShieldCheck,
  titulacion: GraduationCap,
  resoluciones: FileSignature,
  reportes: BarChart3,
  "validador-cvd": BadgeCheck,
  administracion: LayoutDashboard,
};

const CLAVE_COLAPSO = "sigdNavegacionLateralColapsada";

export default function NavegacionLateral() {
  const [colapsado, setColapsado] = useState(false);
  const modulos = useModulosVisibles();

  useEffect(() => {
    if (typeof window === "undefined") return;
    setColapsado(window.localStorage.getItem(CLAVE_COLAPSO) === "true");
  }, []);

  const alternar = () => {
    setColapsado((prev) => {
      const nuevo = !prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(CLAVE_COLAPSO, String(nuevo));
      }
      return nuevo;
    });
  };

  return (
    <nav
      aria-label="Menú lateral de módulos del sistema"
      className={`sticky top-[57px] hidden h-[calc(100vh-57px)] shrink-0 flex-col border-r border-slate-200/80 bg-white/95 backdrop-blur-md shadow-sm transition-all duration-200 ease-out md:flex ${
        colapsado ? "w-[4.25rem]" : "w-64"
      }`}
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-3.5">
        {!colapsado && (
          <div className="min-w-0 pl-1">
            <h2 className="truncate text-xs font-bold uppercase tracking-wider text-slate-800">
              Módulos Activos
            </h2>
            <p className="truncate text-[11px] font-medium text-slate-400">
              Catálogo Institucional
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
          className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
        >
          {colapsado ? (
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>

      {modulos.length === 0 ? (
        <p className="px-4 py-4 text-xs font-medium leading-5 text-slate-500">
          No hay módulos habilitados para su perfil institucional.
        </p>
      ) : (
        <ul className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-2.5 py-3">
          {modulos.map((modulo) => {
            const Icono = ICONOS[modulo.id] ?? LayoutDashboard;

            return (
              <li key={modulo.id}>
                <NavLink
                  to={modulo.ruta}
                  title={colapsado ? modulo.titulo : undefined}
                  className={({ isActive }) =>
                    `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${
                      isActive
                        ? "bg-blue-50/90 text-blue-700 shadow-sm border border-blue-200/60"
                        : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 border border-transparent"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                          isActive
                            ? "bg-blue-600 text-white shadow-sm shadow-blue-500/30"
                            : "bg-slate-100 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-800"
                        }`}
                      >
                        <Icono className="h-4 w-4" aria-hidden="true" />
                      </div>
                      {!colapsado && (
                        <span className="truncate text-xs font-bold tracking-tight">
                          {modulo.titulo}
                        </span>
                      )}
                      {isActive && !colapsado && (
                        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-600" />
                      )}
                    </>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      )}

      {/* Subtle institutional badge in bottom of navigation */}
      {!colapsado && (
        <div className="border-t border-slate-100 p-3">
          <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-2.5 text-[11px] font-medium text-slate-500">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="truncate">Sede Central Pucallpa</span>
          </div>
        </div>
      )}
    </nav>
  );
}
