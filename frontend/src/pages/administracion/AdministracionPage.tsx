import { useNavigate } from "react-router-dom";

import AdminPageHeader from "../../components/administracion/AdminPageHeader";

const modulos = [
  {
    titulo: "Usuarios",
    descripcion:
      "Administra cuentas existentes, estado, área, cargo y rol asignado.",
    ruta: "/administracion/usuarios",
    icono: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 21v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 4v2" />
      </>
    ),
    acento: "from-[#006ec7] to-[#00539b]",
  },
  {
    titulo: "Roles y Permisos",
    descripcion:
      "Define qué puede ver y hacer cada rol dentro de los módulos del SIGD.",
    ruta: "/administracion/roles-permisos",
    icono: (
      <>
        <path d="m12 3-9 4v5c0 5 9 10 9 10s9-5 9-10V7l-9-4Z" />
        <path d="m8 12 3 3 5-5" />
      </>
    ),
    acento: "from-indigo-500 to-[#00539b]",
  },
  {
    titulo: "Auditoría",
    descripcion:
      "Consulta acciones de usuarios, accesos y eventos relevantes del sistema.",
    ruta: "/administracion/auditoria",
    icono: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h5M14 2v6h6l-6-6ZM20 8v3M8 7h2M8 11h3" />
        <circle cx="16" cy="16" r="4" />
        <path d="m19 19 3 3" />
      </>
    ),
    acento: "from-[#38bdf8] to-[#00539b]",
  },
  {
    titulo: "Tablas Maestras",
    descripcion:
      "Configura sedes, áreas, organigrama y tipos documentales institucionales.",
    ruta: "/administracion/tablas-maestras",
    icono: (
      <>
        <ellipse cx="12" cy="5" rx="8" ry="3" />
        <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
      </>
    ),
    acento: "from-[#38bdf8] to-[#00539b]",
  },
  {
    titulo: "Calendario Laboral",
    descripcion:
      "Configura días hábiles, horario, corte LPAG y feriados de Ucayali.",
    ruta: "/administracion/calendario-laboral",
    icono: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M8 3v4m8-4v4M3 11h18M7 15h2m3 0h2m3 0h1M7 18h2m3 0h2" />
      </>
    ),
    acento: "from-[#00539b] to-indigo-700",
  },
  {
    titulo: "Seguridad",
    descripcion:
      "Gestiona bloqueos, intentos fallidos y políticas básicas de acceso.",
    ruta: "/administracion/seguridad",
    icono: (
      <>
        <rect x="4" y="10" width="16" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3M12 15v2" />
      </>
    ),
    acento: "from-[#0b3e6b] to-[#006ec7]",
  },
];

export default function AdministracionPage() {
  const navigate = useNavigate();

  return (
    <main className="sigd-fade-in admin-dark min-h-screen bg-transparent text-[#0b2a4a]">
      <AdminPageHeader
        title="Panel de Administración"
        description="Administración, Seguridad y Auditoría: configuración y control administrativo del sistema."
      />

      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {modulos.map((modulo) => (
            <article
              key={modulo.titulo}
              className="group relative overflow-hidden rounded-2xl border border-[#d7e9f7] bg-white p-6 shadow-sm transition-all duration-300 ease-out hover:-translate-y-1 hover:border-[#8cc8f0] hover:shadow-xl motion-reduce:transition-none"
            >
              <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-[#e8f4ff] opacity-80" />

              <div className="relative flex items-center gap-4">
                <span
                  className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${modulo.acento} text-white shadow-md transition-transform duration-300 ease-out motion-safe:group-hover:scale-105 motion-reduce:transition-none`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.75}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    focusable="false"
                    className="h-6 w-6"
                  >
                    {modulo.icono}
                  </svg>
                </span>
                <h3 className="text-lg font-bold text-[#0b2a4a]">
                  {modulo.titulo}
                </h3>
              </div>

              <p className="relative mt-3 min-h-12 text-sm leading-6 text-[#4b6b85]">
                {modulo.descripcion}
              </p>

              <button
                type="button"
                onClick={() => navigate(modulo.ruta)}
                aria-label={`Administrar ${modulo.titulo}`}
                className="relative mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#006ec7] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-300 ease-out hover:bg-[#00539b]"
              >
                Administrar
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                >
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </button>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
