// Breadcrumbs reactivos del Hub de Administración (ENT-M05-01)
import { Link, useLocation } from "react-router-dom";
import { Home, ChevronRight } from "lucide-react";

export const ETIQUETAS_ADMIN: Record<string, string> = {
  administracion: "Panel de Administración",
  usuarios: "Usuarios",
  "roles-permisos": "Roles y Permisos",
  auditoria: "Auditoría",
  "tablas-maestras": "Tablas Maestras",
  "calendario-laboral": "Calendario Laboral",
  seguridad: "Seguridad",
};

interface Miga {
  etiqueta: string;
  ruta: string;
  actual: boolean;
}

export default function AdminBreadcrumbs() {
  const location = useLocation();

  const segmentos = location.pathname.split("/").filter(Boolean);

  const migas: Miga[] =
    segmentos.length === 0
      ? [{ etiqueta: "Panel de Administración", ruta: "/administracion", actual: true }]
      : segmentos.map((segmento, indice) => {
          const camino = segmentos.slice(0, indice + 1).join("/");
          const etiqueta =
            ETIQUETAS_ADMIN[segmento] ??
            segmento.charAt(0).toUpperCase() + segmento.slice(1);
          return {
            etiqueta,
            ruta: `/${camino}`,
            actual: indice === segmentos.length - 1,
          };
        });

  if (migas.length === 0) return null;

  return (
    <nav
      aria-label="Migajas de pan de administración"
      className="mb-4 flex flex-wrap items-center gap-1.5 text-xs font-medium text-slate-400"
    >
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-slate-400 hover:text-cyan-300 transition-colors"
        title="Ir al Portal Institucional"
      >
        <Home className="h-3.5 w-3.5" />
        <span className="sr-only">Inicio</span>
      </Link>

      {migas.map((miga) => (
        <span key={miga.ruta} className="flex items-center gap-1.5">
          <ChevronRight className="h-3 w-3 text-slate-600" aria-hidden="true" />
          {miga.actual ? (
            <span
              aria-current="page"
              className="text-cyan-300 font-semibold drop-shadow-[0_0_6px_rgba(6,182,212,0.4)]"
            >
              {miga.etiqueta}
            </span>
          ) : (
            <Link
              to={miga.ruta}
              className="hover:text-cyan-300 hover:underline transition-colors"
            >
              {miga.etiqueta}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}