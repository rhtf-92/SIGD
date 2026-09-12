import { NavLink } from "react-router-dom";

const ENLACES_MODULOS = [
  { ruta: "/", etiqueta: "Inicio" },
  { ruta: "/administracion", etiqueta: "Administración" },
];

export default function HeaderInstitucional() {
  return (
    <header>
      <div className="bg-[linear-gradient(90deg,#006ec7_0%,#005ca2_100%)] text-white shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <span className="group inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-white/15 px-3 text-base font-black ring-1 ring-white/20 ring-inset transition duration-200 ease-out hover:bg-white/20 hover:ring-white/35 motion-safe:hover:scale-[1.03] motion-reduce:transition-none">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                focusable="false"
                className="h-5 w-5 shrink-0 text-white/85 transition duration-200 ease-out group-hover:text-white motion-safe:group-hover:-translate-y-0.5 motion-reduce:transition-none"
              >
                <path d="m3 9 9-6 9 6H3Z" />
                <path d="M5 9v10m7-10v10m7-10v10M3 19h18M2 22h20" />
              </svg>
              IS
            </span>
            <div className="min-w-0">
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

      <div
        className="block h-[6px] w-full bg-[linear-gradient(90deg,#006ec7_0%,#e6007e_50%,#f9e000_100%)]"
        aria-hidden="true"
      />

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
                `rounded-lg px-4 py-2 text-sm font-semibold transition duration-200 ease-out hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 motion-safe:hover:-translate-y-0.5 motion-reduce:transition-none ${
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
