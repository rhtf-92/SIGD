import { NavLink } from "react-router-dom";

const ENLACES_MODULOS = [
  { ruta: "/", etiqueta: "Inicio" },
  { ruta: "/administracion", etiqueta: "Administración" },
  { ruta: "/flujo-validez-legal", etiqueta: "Flujo y Validez Legal" },
  { ruta: "/validador-cvd", etiqueta: "Validador CVD" },
];

export default function HeaderInstitucional() {
  return (
    <header>
      <div className="header-sigd">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/15 text-base font-black">
              IS
            </span>
            <div>
              <p className="text-sm font-black leading-tight">
                IESTP SUIZA — Instituto Superior Tecnológico
              </p>
              <p className="text-[0.65rem] font-semibold tracking-[0.18em] text-white/80 uppercase">
                Sistema Integral de Gestión Documentaria
              </p>
            </div>
          </div>

          <span className="hidden rounded-full border border-white/25 px-3 py-1 text-[0.65rem] font-bold tracking-[0.16em] uppercase md:inline-block">
            Campus Digital · Expedientes Electrónicos
          </span>
        </div>
      </div>

      <div className="header-bar" aria-hidden="true" />

      <nav
        aria-label="Módulos del sistema"
        className="border-b border-slate-200 bg-white"
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-1 px-4 py-2 sm:px-6 lg:px-8">
          {ENLACES_MODULOS.map((enlace) => (
            <NavLink
              key={enlace.ruta}
              to={enlace.ruta}
              end={enlace.ruta === "/"}
              className={({ isActive }) =>
                `rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  isActive
                    ? "bg-blue-700 text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`
              }
            >
              {enlace.etiqueta}
            </NavLink>
          ))}
        </div>
      </nav>
    </header>
  );
}