import { useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";
import {
  Users,
  ShieldCheck,
  ClipboardList,
  Database,
  Calendar,
  Lock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const ADMIN_ROUTES = [
  {
    titulo: "Usuarios",
    ruta: "/administracion/usuarios",
    icono: Users,
    descripcion: "Gestión de cuentas y asignación de roles",
  },
  {
    titulo: "Roles y Permisos",
    ruta: "/administracion/roles-permisos",
    icono: ShieldCheck,
    descripcion: "Matriz de permisos por rol",
  },
  {
    titulo: "Auditoría",
    ruta: "/administracion/auditoria",
    icono: ClipboardList,
    descripcion: "Bitácora y trazabilidad de eventos",
  },
  {
    titulo: "Tablas Maestras",
    ruta: "/administracion/tablas-maestras",
    icono: Database,
    descripcion: "Catálogos paramétricos institucionales",
  },
  {
    titulo: "Calendario Laboral",
    ruta: "/administracion/calendario-laboral",
    icono: Calendar,
    descripcion: "Feriados, días hábiles y horario de corte",
  },
  {
    titulo: "Seguridad",
    ruta: "/administracion/seguridad",
    icono: Lock,
    descripcion: "Políticas y bloqueos de acceso",
  },
];

export default function AdminSidebarNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const [colapsado, setColapsado] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("adminSidebarColapsado") === "true";
  });

  const toggleColapsado = () => {
    setColapsado((estadoActual) => {
      const siguiente = !estadoActual;
      if (typeof window !== "undefined") {
        window.localStorage.setItem("adminSidebarColapsado", String(siguiente));
      }
      return siguiente;
    });
  };

  return (
    <nav
      className={`flex flex-col border-r border-sigd-line bg-white shadow-sm transition-[width] duration-200 ease-out ${
        colapsado ? "w-16" : "w-72"
      }`}
      aria-label="Navegación lateral de administración"
    >
      <div className="flex items-center justify-between gap-2 border-b border-sigd-line px-4 py-4">
        {!colapsado && (
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sigd-blue text-sm font-black text-white"
              aria-hidden="true"
            >
              S
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-bold text-sigd-text">
                Administración
              </h2>
              <p className="truncate text-xs text-sigd-muted">
                Panel de configuración
              </p>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={toggleColapsado}
          className="ml-auto inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-sigd-line-strong bg-white text-sigd-muted transition hover:border-sigd-blue hover:text-sigd-blue focus-ring"
          aria-label={colapsado ? "Expandir menú lateral" : "Colapsar menú lateral"}
          aria-expanded={!colapsado}
        >
          {colapsado ? (
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>

      <ul className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 py-3">
        {ADMIN_ROUTES.map((rutaItem) => {
          const Icono = rutaItem.icono;
          const esActiva = location.pathname === rutaItem.ruta;

          return (
            <li key={rutaItem.ruta}>
              <button
                type="button"
                onClick={() => navigate(rutaItem.ruta)}
                className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition focus-ring ${
                  esActiva
                    ? "bg-sigd-blue/10 text-sigd-blue-deep"
                    : "text-slate-700 hover:bg-sigd-surface-muted"
                }`}
                aria-current={esActiva ? "page" : undefined}
                title={colapsado ? rutaItem.titulo : undefined}
              >
                {esActiva && (
                  <span
                    className="absolute left-0 top-2 bottom-2 w-1 rounded-full bg-sigd-blue"
                    aria-hidden="true"
                  />
                )}
                <Icono
                  className={`h-5 w-5 shrink-0 ${
                    esActiva
                      ? "text-sigd-blue-deep"
                      : "text-sigd-muted group-hover:text-sigd-blue"
                  }`}
                  aria-hidden="true"
                />
                {!colapsado && (
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-semibold">
                      {rutaItem.titulo}
                    </span>
                    <span className="truncate text-xs text-sigd-muted">
                      {rutaItem.descripcion}
                    </span>
                  </div>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
