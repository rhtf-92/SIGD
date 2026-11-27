import { useState } from "react";
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
  const [colapsado, setColapsado] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("adminSidebarColapsado") === "true";
  });

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
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
          {!colapsado && (
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 border border-blue-100 text-blue-700">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-xs font-bold tracking-wider uppercase text-slate-800">
                  Navegación Admin
                </h2>
                <p className="text-[10px] text-slate-500">SIGD SUIZA v6.5</p>
              </div>
            </div>
          )}

          {/* Desktop collapse toggle */}
          <button
            type="button"
            onClick={toggleColapsado}
            className={`hidden lg:inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-blue-800 hover:border-blue-300 transition cursor-pointer ${
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
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-blue-800 lg:hidden transition"
            aria-label="Cerrar navegación"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation List */}
        <ul className="flex max-h-[calc(100vh-9rem)] flex-col gap-1 overflow-y-auto p-2">
          {ADMIN_NAV_ITEMS.map((item) => {
            const Icono = item.icono;
            const esActiva = checkIsActive(item);

            return (
              <li key={item.ruta}>
                <button
                  type="button"
                  onClick={() => handleNavClick(item.ruta)}
                  className={`group relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-all duration-200 cursor-pointer ${
                    esActiva
                      ? "bg-blue-50 text-blue-800 border-l-4 border-blue-700 shadow-sm"
                      : "text-slate-600 hover:bg-slate-50 hover:text-blue-800"
                  }`}
                  aria-current={esActiva ? "page" : undefined}
                  title={colapsado ? item.titulo : undefined}
                >
                  <Icono
                    className={`h-4 w-4 shrink-0 transition-colors ${
                      esActiva
                        ? "text-blue-700"
                        : "text-slate-400 group-hover:text-blue-700"
                    }`}
                    aria-hidden="true"
                  />

                  {!colapsado && (
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-xs sm:text-sm font-semibold tracking-wide">
                        {item.titulo}
                      </span>
                      <span className="truncate text-[11px] text-slate-500 group-hover:text-slate-600">
                        {item.descripcion}
                      </span>
                    </div>
                  )}

                  {/* Active indicator dot if collapsed */}
                  {colapsado && esActiva && (
                    <span className="absolute right-2 h-1.5 w-1.5 rounded-full bg-blue-700" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Footer in Sidebar */}
      {!colapsado && (
        <div className="border-t border-slate-200 p-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] font-bold text-slate-700">
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
        className={`hidden lg:flex flex-col shrink-0 border-r border-slate-200 bg-white transition-all duration-300 ease-in-out ${
          colapsado ? "w-20" : "w-72"
        }`}
        aria-label="Navegación lateral de administración"
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 flex lg:hidden bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={onCloseMobile}
        >
          <div
            className="relative flex w-72 max-w-[80vw] flex-col border-r border-slate-200 bg-white shadow-2xl animate-in slide-in-from-left duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
