import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  ClipboardList,
  Database,
  Calendar,
  Lock,
  ChevronLeft,
  ChevronRight,
  X,
  Sparkles,
} from "lucide-react";

export const ADMIN_NAV_ITEMS = [
  {
    titulo: "Inicio",
    ruta: "/administracion",
    icono: LayoutDashboard,
    descripcion: "Resumen y acceso a módulos",
    exact: true,
  },
  {
    titulo: "Usuarios",
    ruta: "/administracion/usuarios",
    icono: Users,
    descripcion: "Directorio institucional y cuentas",
  },
  {
    titulo: "Roles y Permisos",
    ruta: "/administracion/roles-permisos",
    icono: ShieldCheck,
    descripcion: "Matriz de privilegios RBAC",
  },
  {
    titulo: "Auditoría",
    ruta: "/administracion/auditoria",
    icono: ClipboardList,
    descripcion: "Trazabilidad inmutable WORM",
  },
  {
    titulo: "Tablas Maestras",
    ruta: "/administracion/tablas-maestras",
    icono: Database,
    descripcion: "Catálogos y organigrama",
  },
  {
    titulo: "Calendario Laboral",
    ruta: "/administracion/calendario-laboral",
    icono: Calendar,
    descripcion: "Feriados y corte de recepción",
  },
  {
    titulo: "Seguridad",
    ruta: "/administracion/seguridad",
    icono: Lock,
    descripcion: "Políticas de acceso y bloqueos",
  },
];

interface AdminSidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export default function AdminSidebar({
  mobileOpen = false,
  onCloseMobile,
}: AdminSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [colapsado, setColapsado] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const guardado = window.localStorage.getItem("adminSidebarColapsado");
      if (guardado) {
        setColapsado(guardado === "true");
      }
    }
  }, []);

  const toggleColapsado = () => {
    setColapsado((prev) => {
      const nuevo = !prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem("adminSidebarColapsado", String(nuevo));
      }
      return nuevo;
    });
  };

  const handleNavClick = (ruta: string) => {
    navigate(ruta);
    onCloseMobile?.();
  };

  const checkIsActive = (item: (typeof ADMIN_NAV_ITEMS)[0]) => {
    if (item.exact) {
      return location.pathname === "/administracion" || location.pathname === "/administracion/";
    }
    return location.pathname.startsWith(item.ruta);
  };

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between">
      {/* Top Header / Brand */}
      <div>
        <div className="flex items-center justify-between border-b border-slate-800/80 px-4 py-4">
          {!colapsado && (
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-xs font-bold tracking-wider uppercase text-white">
                  Navegación Admin
                </h2>
                <p className="text-[10px] text-slate-400">SIGD SUIZA v6.5</p>
              </div>
            </div>
          )}

          {/* Desktop collapse toggle */}
          <button
            type="button"
            onClick={toggleColapsado}
            className={`hidden lg:inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/80 text-slate-400 hover:text-white hover:border-cyan-500/40 transition cursor-pointer ${
              colapsado ? "mx-auto" : "ml-auto"
            }`}
            aria-label={colapsado ? "Expandir menú lateral" : "Colapsar menú lateral"}
            title={colapsado ? "Expandir menú" : "Colapsar menú"}
          >
            {colapsado ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>

          {/* Mobile close button */}
          <button
            type="button"
            onClick={onCloseMobile}
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/80 text-slate-400 hover:text-white lg:hidden transition"
            aria-label="Cerrar navegación"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation List */}
        <ul className="flex flex-col gap-1.5 p-3">
          {ADMIN_NAV_ITEMS.map((item) => {
            const Icono = item.icono;
            const esActiva = checkIsActive(item);

            return (
              <li key={item.ruta}>
                <button
                  type="button"
                  onClick={() => handleNavClick(item.ruta)}
                  className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-all duration-200 cursor-pointer ${
                    esActiva
                      ? "bg-gradient-to-r from-blue-600/25 via-cyan-500/15 to-transparent text-white border-l-4 border-cyan-400 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]"
                      : "text-slate-400 hover:bg-slate-900/60 hover:text-cyan-200"
                  }`}
                  aria-current={esActiva ? "page" : undefined}
                  title={colapsado ? item.titulo : undefined}
                >
                  <Icono
                    className={`h-5 w-5 shrink-0 transition-colors ${
                      esActiva
                        ? "text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]"
                        : "text-slate-500 group-hover:text-cyan-300"
                    }`}
                    aria-hidden="true"
                  />

                  {!colapsado && (
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-xs sm:text-sm font-semibold tracking-wide">
                        {item.titulo}
                      </span>
                      <span className="truncate text-[11px] text-slate-500 group-hover:text-slate-400">
                        {item.descripcion}
                      </span>
                    </div>
                  )}

                  {/* Active indicator dot if collapsed */}
                  {colapsado && esActiva && (
                    <span className="absolute right-2 h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.8)]" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Footer in Sidebar */}
      {!colapsado && (
        <div className="border-t border-slate-800/80 p-4">
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3">
            <p className="text-[11px] font-bold text-slate-300">
              Instituto Suiza
            </p>
            <p className="text-[10px] text-slate-500">
              Ucayali, Perú • Ley 27444
            </p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 border-r border-slate-800/80 bg-slate-950/70 backdrop-blur-2xl transition-all duration-300 ease-in-out ${
          colapsado ? "w-20" : "w-72"
        }`}
        aria-label="Navegación lateral de administración"
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 flex lg:hidden bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={onCloseMobile}
        >
          <div
            className="relative flex w-72 max-w-[80vw] flex-col border-r border-cyan-500/30 bg-slate-950 shadow-2xl animate-in slide-in-from-left duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
