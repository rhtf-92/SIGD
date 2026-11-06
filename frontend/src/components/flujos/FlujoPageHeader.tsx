import { Link, useLocation, useNavigate } from "react-router-dom";

interface FlujoPageHeaderProps {
  faseTag?: string;
  title: string;
  breadcrumbLabel?: string;
  description: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}

const MODULOS_FLUJO = [
  {
    ruta: "/flujo-validez-legal",
    titulo: "Centro de Validez Legal",
    icono: (
      <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    ruta: "/flujos/titulacion",
    titulo: "Workflow Titulación",
    icono: (
      <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
      </svg>
    ),
  },
  {
    ruta: "/flujos/proyector-resoluciones",
    titulo: "Proyector Resoluciones",
    icono: (
      <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  {
    ruta: "/flujo-validez-legal/firma",
    titulo: "Pasarela de Firma (Refirma)",
    icono: (
      <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    ),
  },
  {
    ruta: "/flujo-validez-legal/visor-cvd",
    titulo: "Visor Documental CVD",
    icono: (
      <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    ruta: "/validador-cvd",
    titulo: "Validador Público CVD",
    icono: (
      <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
];

export default function FlujoPageHeader({
  faseTag,
  title,
  breadcrumbLabel,
  description,
  action,
  children,
}: FlujoPageHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const esHub = location.pathname === "/flujo-validez-legal" || title === "Centro de Coordinación Documental";

  return (
    <header className="border-b border-slate-200 bg-white shadow-xs print:hidden">
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-4 sm:py-5">
        {/* Migajas de pan canónicas */}
        <nav
          aria-label="Migajas de pan de validez legal"
          className="mb-3 flex flex-wrap items-center gap-1.5 text-xs font-medium text-slate-500"
        >
          <Link to="/" className="hover:text-blue-700 hover:underline transition-colors">
            Inicio
          </Link>
          <span className="text-slate-300">/</span>
          {esHub ? (
            <span aria-current="page" className="font-semibold text-blue-700">
              Flujo de Validez Legal
            </span>
          ) : (
            <>
              <Link to="/flujo-validez-legal" className="hover:text-blue-700 hover:underline transition-colors">
                Flujo de Validez Legal
              </Link>
              <span className="text-slate-300">/</span>
              <span aria-current="page" className="font-semibold text-blue-700">
                {breadcrumbLabel || title}
              </span>
            </>
          )}
        </nav>

        {/* Botones de navegación y retorno contextual */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {!esHub ? (
              <>
                <button
                  type="button"
                  onClick={() => navigate("/flujo-validez-legal")}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-slate-700 shadow-xs transition hover:bg-slate-100 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  title="Volver al Centro de Validez Legal"
                >
                  <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  <span>Volver al módulo</span>
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

        {/* Título y descripción */}
        <div>
          {faseTag && (
            <p className="text-xs sm:text-sm font-bold text-blue-700 uppercase tracking-wide">
              {faseTag}
            </p>
          )}
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 leading-relaxed max-w-4xl">{description}</p>
        </div>

        {children && <div className="mt-3">{children}</div>}

        {/* Botones de navegación intermodular entre componentes de validez legal */}
        {!esHub && (
          <nav
            aria-label="Navegación entre componentes de validez legal"
            className="flex items-center gap-2 overflow-x-scroll pt-3 pb-1 mt-4 border-t border-slate-100 scrollbar-none"
          >
            {MODULOS_FLUJO.map((modulo) => {
              const esActivo = location.pathname === modulo.ruta;
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
