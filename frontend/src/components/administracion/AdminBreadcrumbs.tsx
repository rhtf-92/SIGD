// Breadcrumbs reactivos del Hub de Administración (ENT-M05-01)
import { Link, useLocation } from "react-router-dom";

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
      className="mb-4 flex flex-wrap items-center gap-1 text-xs font-medium text-slate-500"
    >
      {migas.map((miga, indice) => (
        <span key={miga.ruta} className="flex items-center gap-1">
          {indice > 0 && <span className="text-slate-300">/</span>}
          {miga.actual ? (
            <span aria-current="page" className="text-blue-700">
              {miga.etiqueta}
            </span>
          ) : (
            <Link to={miga.ruta} className="hover:text-blue-700 hover:underline">
              {miga.etiqueta}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}