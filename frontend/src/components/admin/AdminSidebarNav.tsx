import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
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

  return (
    <nav
      className={`flex h-full flex-col border-r border-slate-200 bg-white shadow-sm transition-all duration-200 ease-out ${
        colapsado ? "w-16" : "w-72"
      }`}
      aria-label="Navegación lateral de administración"
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
        {!colapsado && (
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Administración
            </h2>
            <p className="text-xs text-slate-500">Panel de configuración</p>
          </div>
        )}
        <button
          type="button"
          onClick={toggleColapsado}
          className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
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
                className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${
                  esActiva
                    ? "bg-blue-50 text-blue-700 shadow-sm"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
                aria-current={esActiva ? "page" : undefined}
                title={colapsado ? rutaItem.titulo : undefined}
              >
                <Icono
                  className={`h-5 w-5 shrink-0 ${
                    esActiva ? "text-blue-700" : "text-slate-500"
                  }`}
                  aria-hidden="true"
                />
                {!colapsado && (
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-semibold">
                      {rutaItem.titulo}
                    </span>
                    <span className="truncate text-xs text-slate-500">
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
