import { Home, LogIn } from "lucide-react";
import { NavLink } from "react-router-dom";

import { useSession } from "../hooks/useSession";
import { seccionesVisiblesPara } from "../routes/routeMeta";

// Dock inferior tipo app móvil: accesos directos a los módulos del usuario
// (rol + matriz RBAC). Reemplaza a la barra lateral; en móvil el drawer del
// header sigue disponible para el detalle de cada módulo.
export default function DockInferiorSigd() {
  const { isAuthenticated, rol } = useSession();
  const modulos = seccionesVisiblesPara(rol, isAuthenticated).flatMap(
    (seccion) => seccion.accesos,
  );

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[80] flex justify-center px-4 print:hidden">
      <nav
        aria-label="Accesos rápidos a módulos"
        className="glass pointer-events-auto flex max-w-full items-center gap-1 overflow-x-auto rounded-3xl border border-white/60 px-2.5 py-2 shadow-2xl shadow-[#0b3d7a]/20"
      >
        <NavLink
          to="/"
          end
          title="Inicio"
          className={({ isActive }) =>
            `flex min-w-[4rem] flex-col items-center gap-1 rounded-2xl px-2.5 py-1.5 transition active:scale-95 ${isActive ? "bg-[#e8eff9]" : "hover:bg-slate-100"}`
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={`grid h-9 w-9 place-items-center rounded-xl shadow transition ${isActive ? "bg-gradient-to-br from-[#005fac] to-[#0b3d7a] text-white" : "bg-slate-100 text-slate-500"}`}
              >
                <Home size={17} strokeWidth={2.25} />
              </span>
              <span
                className={`max-w-[4.5rem] truncate text-[10px] font-extrabold uppercase tracking-wide ${isActive ? "text-[#0b3d7a]" : "text-slate-400"}`}
              >
                Inicio
              </span>
            </>
          )}
        </NavLink>

        {modulos.map((modulo) => {
          const Icono = modulo.icono;
          return (
            <NavLink
              key={modulo.to}
              to={modulo.to}
              title={modulo.etiqueta}
              className={({ isActive }) =>
                `flex min-w-[4rem] flex-col items-center gap-1 rounded-2xl px-2.5 py-1.5 transition active:scale-95 ${isActive ? "bg-[#e8eff9]" : "hover:bg-slate-100"}`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`grid h-9 w-9 place-items-center rounded-xl shadow transition ${isActive ? `bg-gradient-to-br ${modulo.acento} text-white` : "bg-slate-100 text-slate-500"}`}
                  >
                    <Icono size={17} strokeWidth={2.25} />
                  </span>
                  <span
                    className={`max-w-[4.5rem] truncate text-[10px] font-extrabold uppercase tracking-wide ${isActive ? "text-[#0b3d7a]" : "text-slate-400"}`}
                  >
                    {modulo.etiqueta}
                  </span>
                </>
              )}
            </NavLink>
          );
        })}

        {!isAuthenticated && (
          <NavLink
            to="/login"
            title="Iniciar sesión"
            className={({ isActive }) =>
              `flex min-w-[4rem] flex-col items-center gap-1 rounded-2xl px-2.5 py-1.5 transition active:scale-95 ${isActive ? "bg-[#e8eff9]" : "hover:bg-slate-100"}`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`grid h-9 w-9 place-items-center rounded-xl shadow transition ${isActive ? "bg-gradient-to-br from-[#0b3d7a] to-[#005fac] text-white" : "bg-slate-100 text-slate-500"}`}
                >
                  <LogIn size={17} strokeWidth={2.25} />
                </span>
                <span
                  className={`max-w-[4.5rem] truncate text-[10px] font-extrabold uppercase tracking-wide ${isActive ? "text-[#0b3d7a]" : "text-slate-400"}`}
                >
                  Entrar
                </span>
              </>
            )}
          </NavLink>
        )}
      </nav>
    </div>
  );
}
