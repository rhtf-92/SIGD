import { Link, useLocation, useNavigate } from "react-router-dom";

import AdminBreadcrumbs from "./AdminBreadcrumbs";

interface AdminPageHeaderProps {
  title: string;
  description: string;
  action?: React.ReactNode;
}

const MODULOS_ADMINISTRATIVOS = [
  {
    ruta: "/administracion",
    titulo: "Panel Principal",
    icono: (
      <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  },
  {
    ruta: "/administracion/usuarios",
    titulo: "Usuarios",
    icono: (
      <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    ruta: "/administracion/roles-permisos",
    titulo: "Roles y Permisos",
    icono: (
      <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    ruta: "/administracion/tablas-maestras",
    titulo: "Tablas Maestras",
    icono: (
      <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
      </svg>
    ),
  },
  {
    ruta: "/administracion/calendario-laboral",
    titulo: "Calendario Laboral",
    icono: (
      <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    ruta: "/administracion/seguridad",
    titulo: "Seguridad",
    icono: (
      <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
  },
  {
    ruta: "/administracion/auditoria",
    titulo: "Auditoría",
    icono: (
      <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
];

export default function AdminPageHeader({
  title,
  description,
  action,
}: AdminPageHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const esHubPrincipal = title === "Panel de Administración";
  const esSubpagina = !esHubPrincipal;

  return (
    <header className="border-b border-slate-200 bg-white shadow-xs">
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-4 sm:py-5">
        {/* Migajas de pan interactivas */}
        <AdminBreadcrumbs />

        {/* Botones de navegación y retorno contextual */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {esSubpagina ? (
              <>
                <button
                  type="button"
                  onClick={() => navigate("/administracion")}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-slate-700 shadow-xs transition hover:bg-slate-100 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  title="Volver al Panel Principal de Administración"
                >
                  <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  <span>Volver al Panel de Administración</span>
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/")}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none"
                  title="Volver a la portada de inicio"
                >
                  <svg className="h-3.5 w-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  <span>Volver al inicio</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => navigate("/")}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-slate-700 shadow-xs transition hover:bg-slate-100 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                title="Volver a la portada de inicio"
              >
                <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>Volver al inicio</span>
              </button>
            )}
          </div>

          {action && <div className="flex items-center">{action}</div>}
        </div>

        {/* Título y descripción de la sección */}
        <div className="mb-4">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{title}</h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">{description}</p>
        </div>

        {/* Botones de navegación intermodular entre páginas administrativas (en subpáginas) */}
        {esSubpagina && (
          <nav
            aria-label="Navegación entre páginas administrativas"
            className="flex items-center gap-2 overflow-x-auto pt-3 pb-1 border-t border-slate-100 scrollbar-none"
          >
            {MODULOS_ADMINISTRATIVOS.map((modulo) => {
              const esActivo =
                location.pathname === modulo.ruta ||
                (modulo.ruta !== "/administracion" &&
                  location.pathname.startsWith(modulo.ruta));
              return (
                <Link
                  key={modulo.ruta}
                  to={modulo.ruta}
                  aria-current={esActivo ? "page" : undefined}
                  className={`inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs sm:text-sm font-semibold transition-all ${
                    esActivo
                      ? "bg-blue-700 text-white shadow-sm ring-1 ring-blue-700"
                      : "bg-slate-50 text-slate-700 border border-slate-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200"
                  }`}
                >
                  {modulo.icono}
                  <span>{modulo.titulo}</span>
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </header>
  );
}
