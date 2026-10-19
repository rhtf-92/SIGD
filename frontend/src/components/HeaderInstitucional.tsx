import { useLocation, useNavigate } from "react-router-dom";
import { GraduationCap, Home, LogIn, Mail, Settings } from "lucide-react";

const NAV_ITEMS = [
  { etiqueta: "Inicio", ruta: "/", icono: Home },
  { etiqueta: "Casilla Electrónica", ruta: "/casilla", icono: Mail },
  { etiqueta: "Administración", ruta: "/administracion", icono: Settings },
] as const;

function esActiva(pathname: string, ruta: string) {
  if (ruta === "/") return pathname === "/";
  return pathname === ruta || pathname.startsWith(`${ruta}/`);
}

export default function HeaderInstitucional() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <header className="header-sigd sticky top-0 z-40 print:hidden">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => navigate("/")}
          aria-label="Ir al inicio del SIGD"
          className="flex min-w-0 cursor-pointer items-center gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#006ec7] to-[#003a6b] text-white ring-1 ring-white/25">
            <GraduationCap className="h-5 w-5 text-[#f9e000]" aria-hidden="true" />
          </span>

          <span className="min-w-0">
            <span className="flex items-baseline gap-2">
              <span className="text-base font-extrabold uppercase tracking-[0.16em] text-white">
                SIGD
              </span>
              <span className="hidden text-[11px] font-semibold uppercase tracking-wider text-white/60 sm:inline">
                IESTP &quot;Suiza&quot;
              </span>
            </span>
            <span className="block truncate text-[11px] font-medium text-white/70">
              Sistema Integral de Gestión Documentaria
            </span>
          </span>
        </button>

        <nav
          className="flex shrink-0 items-center gap-1"
          aria-label="Accesos institucionales"
        >
          {NAV_ITEMS.map((item) => {
            const Icono = item.icono;
            const activa = esActiva(pathname, item.ruta);
            return (
              <button
                key={item.ruta}
                type="button"
                onClick={() => navigate(item.ruta)}
                aria-label={item.etiqueta}
                aria-current={activa ? "page" : undefined}
                className={`relative inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                  activa
                    ? "bg-white/15 text-white"
                    : "text-white/75 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icono className="h-4 w-4" aria-hidden="true" />
                <span className="hidden md:inline">{item.etiqueta}</span>
                {activa && (
                  <span
                    className="absolute inset-x-2 -bottom-0.5 h-0.5 rounded-full bg-[#f9e000]"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => navigate("/login")}
            className="btn-accent ml-1 px-3 py-2 text-xs"
          >
            <LogIn className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Iniciar sesión</span>
            <span className="sr-only sm:hidden">Iniciar sesión</span>
          </button>
        </nav>
      </div>

      <div className="flex h-1.5 w-full" aria-hidden="true">
        <span className="flex-1 bg-[#006ec7]" />
        <span className="flex-1 bg-[#e6007e]" />
        <span className="flex-1 bg-[#f9e000]" />
      </div>
    </header>
  );
}
