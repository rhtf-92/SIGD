import { ChevronsLeft, ChevronsRight, Home } from "lucide-react";
import { useState } from "react";
import { NavLink } from "react-router-dom";

import { useSession } from "../hooks/useSession";
import { seccionesVisiblesPara } from "../routes/routeMeta";

const CLAVE_COLAPSO = "sigd_barra_lateral_colapsada";

function leerColapsoInicial(): boolean {
  try {
    return window.localStorage.getItem(CLAVE_COLAPSO) === "true";
  } catch {
    return false;
  }
}

// Barra de tareas vertical del lado izquierdo: muestra SOLO los módulos
// a los que el usuario tiene acceso (rol + matriz RBAC). En móvil se oculta
// porque el drawer del header cumple esa función.
export default function BarraLateralSigd() {
  const { isAuthenticated, rol } = useSession();
  const [colapsada, setColapsada] = useState<boolean>(leerColapsoInicial);
  const secciones = seccionesVisiblesPara(rol, isAuthenticated);

  const alternar = () => {
    setColapsada((prev) => {
      const nuevo = !prev;
      try {
        window.localStorage.setItem(CLAVE_COLAPSO, String(nuevo));
      } catch {
        // Sin almacenamiento: el colapso solo dura la sesión.
      }
      return nuevo;
    });
  };

  return (
    <aside
      aria-label="Barra lateral de módulos SIGD"
      className={`sticky top-24 hidden max-h-[calc(100vh-7.5rem)] shrink-0 flex-col overflow-y-auto rounded-3xl border border-white/40 bg-white/70 shadow-xl shadow-slate-900/5 backdrop-blur-xl transition-all duration-300 lg:flex ${colapsada ? "w-[4.75rem]" : "w-64"}`}
    >
      <div className="flex items-center gap-2 p-3">
        {!colapsada && (
          <p className="min-w-0 flex-1 truncate px-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400">
            Mis módulos · {isAuthenticated ? rol : "Invitado"}
          </p>
        )}
        <button
          type="button"
          onClick={alternar}
          aria-expanded={!colapsada}
          aria-label={colapsada ? "Expandir barra lateral" : "Colapsar barra lateral"}
          title={colapsada ? "Expandir" : "Colapsar"}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-[#006EC7] hover:text-[#006EC7] active:scale-90"
        >
          {colapsada ? <ChevronsRight size={17} /> : <ChevronsLeft size={17} />}
        </button>
      </div>

      <nav aria-label="Módulos por usuario" className="flex-1 space-y-4 px-3 pb-3">
        <NavLink
          to="/"
          end
          title="Inicio"
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-bold transition hover:translate-x-0.5 ${isActive ? "bg-gradient-to-r from-[#006EC7] to-cyan-500 text-white shadow-md shadow-blue-900/20" : "text-slate-600 hover:bg-[#eef7ff] hover:text-[#0a4a83]"} ${colapsada ? "justify-center px-0" : ""}`
          }
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#006EC7] to-cyan-500 text-white shadow">
            <Home size={16} strokeWidth={2.25} />
          </span>
          {!colapsada && <span className="min-w-0 flex-1 truncate">Inicio</span>}
        </NavLink>

        {secciones.map((seccion, si) => (
          <div key={seccion.id}>
            {!colapsada ? (
              <p className="mb-1.5 flex items-center gap-2 px-2 text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400">
                <span className="font-display grid h-5 w-5 place-items-center rounded-md bg-[#006EC7]/10 text-[10px] text-[#006EC7]">
                  {si + 1}
                </span>
                <span className="truncate">{seccion.titulo}</span>
              </p>
            ) : (
              <div aria-hidden="true" className="mx-auto mb-1.5 h-px w-8 bg-slate-200" />
            )}
            <div className="grid gap-1">
              {seccion.accesos.map((acceso) => {
                const Icono = acceso.icono;
                return (
                  <NavLink
                    key={acceso.to}
                    to={acceso.to}
                    title={colapsada ? acceso.etiqueta : undefined}
                    className={({ isActive }) =>
                      `group flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-semibold transition hover:translate-x-0.5 ${isActive ? "bg-[#006EC7] text-white shadow-md shadow-blue-900/20" : "text-slate-600 hover:bg-[#eef7ff] hover:text-[#0a4a83]"} ${colapsada ? "justify-center px-0" : ""}`
                    }
                  >
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${acceso.acento} text-white shadow transition duration-300 group-hover:scale-110`}
                    >
                      <Icono size={16} strokeWidth={2.25} />
                    </span>
                    {!colapsada && (
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{acceso.etiqueta}</span>
                        <span className="block truncate text-[11px] font-medium opacity-60">
                          {acceso.descripcion}
                        </span>
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {!colapsada && (
        <p className="border-t border-slate-200/70 px-5 py-3 text-[10px] font-medium leading-4 text-slate-400">
          Solo ves los módulos permitidos para tu rol y tus permisos.
        </p>
      )}
    </aside>
  );
}
