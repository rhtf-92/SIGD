import { useNavigate } from "react-router-dom";

import AdminPageHeader from "../../components/administracion/AdminPageHeader";
import { PERMISOS, esSuperAdmin, tienePermiso } from "../../auth/permissions";
import { useAuthStore } from "../../stores/authStore";

const modulos = [
  {
    titulo: "Usuarios",
    descripcion:
      "Administra cuentas existentes, estado, área, cargo y rol asignado.",
    ruta: "/administracion/usuarios",
    permiso: PERMISOS.USUARIOS_LEER,
    icono: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 21v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 4v2" />
      </>
    ),
  },
  {
    titulo: "Roles y Permisos",
    descripcion:
      "Define qué puede ver y hacer cada rol dentro de los módulos del SIGD.",
    ruta: "/administracion/roles-permisos",
    permiso: PERMISOS.ROLES_LEER,
    icono: (
      <>
        <path d="m12 3-9 4v5c0 5 9 10 9 10s9-5 9-10V7l-9-4Z" />
        <path d="m8 12 3 3 5-5" />
      </>
    ),
  },
  {
    titulo: "Auditoría",
    descripcion:
      "Consulta acciones de usuarios, accesos y eventos relevantes del sistema.",
    ruta: "/administracion/auditoria",
    permiso: PERMISOS.AUDITORIA_LEER,
    icono: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h5M14 2v6h6l-6-6ZM20 8v3M8 7h2M8 11h3" />
        <circle cx="16" cy="16" r="4" />
        <path d="m19 19 3 3" />
      </>
    ),
  },
  {
    titulo: "Tablas Maestras",
    descripcion:
      "Configura sedes, áreas, organigrama y tipos documentales institucionales.",
    ruta: "/administracion/tablas-maestras",
    permiso: PERMISOS.MAESTRAS_LEER,
    icono: (
      <>
        <ellipse cx="12" cy="5" rx="8" ry="3" />
        <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
      </>
    ),
  },
  {
    titulo: "Calendario Laboral",
    descripcion:
      "Configura días hábiles, horario, corte LPAG y feriados de Ucayali.",
    ruta: "/administracion/calendario-laboral",
    permiso: PERMISOS.CALENDARIO_LEER,
    icono: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M8 3v4m8-4v4M3 11h18M7 15h2m3 0h2m3 0h1M7 18h2m3 0h2" />
      </>
    ),
  },
  {
    titulo: "Organigrama",
    descripcion: "Consulta la estructura orgánica institucional y sus dependencias.",
    ruta: "/administracion/organigrama",
    permiso: PERMISOS.ORGANIGRAMA_LEER,
    icono: (
      <>
        <circle cx="12" cy="5" r="2" />
        <circle cx="6" cy="19" r="2" />
        <circle cx="18" cy="19" r="2" />
        <path d="M12 7v5m0 0H6v5m6-5h6v5" />
      </>
    ),
  },
  {
    titulo: "Seguridad",
    descripcion:
      "Gestiona bloqueos, intentos fallidos y políticas básicas de acceso.",
    ruta: "/administracion/seguridad",
    soloSuperAdmin: true,
    icono: (
      <>
        <rect x="4" y="10" width="16" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3M12 15v2" />
      </>
    ),
  },
];

export default function AdministracionPage() {
  const navigate = useNavigate();
  const usuario = useAuthStore((state) => state.usuario);
  const permisos = usuario?.permisos ?? [];
  const modulosVisibles = modulos.filter((modulo) => {
    if ("soloSuperAdmin" in modulo && modulo.soloSuperAdmin) return esSuperAdmin(usuario?.rol);
    if (!("permiso" in modulo)) return false;
    return typeof modulo.permiso === "string" && tienePermiso(permisos, modulo.permiso);
  });

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <AdminPageHeader
        title="Panel de Administración"
        description="Administración, Seguridad y Auditoría: configuración y control administrativo del sistema."
      />

      <section className="mx-auto max-w-7xl px-6 py-8">
        <p className="mb-7 text-sm text-slate-600">
          Selecciona una opción para administrar el SIGD.
        </p>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {modulosVisibles.map((modulo) => (
            <article
              key={modulo.titulo}
              className="group rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition duration-200 ease-out hover:shadow-md motion-safe:hover:-translate-y-1 motion-reduce:transition-none"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#006ec7]">
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
                    className="h-6 w-6 transition-transform duration-200 ease-out motion-safe:group-hover:scale-105 motion-reduce:transition-none"
                  >
                    {modulo.icono}
                  </svg>
                </span>
                <h3 className="text-lg font-bold">{modulo.titulo}</h3>
              </div>
              <p className="mt-2 min-h-12 text-sm leading-6 text-slate-600">
                {modulo.descripcion}
              </p>

              <button
                type="button"
                onClick={() => navigate(modulo.ruta)}
                className="mt-5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
              >
                Administrar
              </button>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
