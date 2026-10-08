import { useNavigate } from "react-router-dom";
import { Building2, Settings, Mail } from "lucide-react";

const NAV_ITEMS = [
  { etiqueta: "Casilla Electrónica", ruta: "/casilla", icono: Mail },
  { etiqueta: "Administración", ruta: "/administracion", icono: Settings },
] as const;

export default function HeaderInstitucional() {
  const navigate = useNavigate();

  return (
    <header className="header-sigd print:hidden">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => navigate("/")}
          aria-label="Ir al inicio del SIGD"
          className="flex min-w-0 cursor-pointer items-center gap-3 rounded-md text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-[#006ec7] shadow-sm">
            <Building2 className="h-5 w-5" aria-hidden="true" />
          </span>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold uppercase tracking-wider text-white">
                SIGD SUIZA
              </span>
              <span className="rounded bg-white/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white">
                v1.0
              </span>
            </div>
            <p className="truncate text-xs font-medium text-white/85">
              Instituto de Educación Superior Tecnológico Público &quot;Suiza&quot;
            </p>
          </div>
        </button>

        <nav
          className="flex shrink-0 items-center gap-2"
          aria-label="Accesos institucionales"
        >
          {NAV_ITEMS.map((item) => {
            const Icono = item.icono;
            return (
              <button
                key={item.ruta}
                type="button"
                onClick={() => navigate(item.ruta)}
                aria-label={item.etiqueta}
                className="inline-flex items-center gap-2 rounded-md border border-white/25 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                <Icono className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">{item.etiqueta}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="flex h-1 w-full" aria-hidden="true">
        <span className="flex-1 bg-[#006ec7]" />
        <span className="flex-1 bg-[#e6007e]" />
        <span className="flex-1 bg-[#f9e000]" />
      </div>
    </header>
  );
}
