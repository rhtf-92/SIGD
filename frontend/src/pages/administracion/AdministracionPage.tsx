import { useNavigate } from "react-router-dom";

const modulos = [
  {
    titulo: "Usuarios",
    descripcion:
      "Administra cuentas existentes, estado, área, cargo y rol asignado.",
    ruta: "/administracion/usuarios",
  },
  {
    titulo: "Roles y Permisos",
    descripcion:
      "Define qué puede ver y hacer cada rol dentro de los módulos del SIGD.",
    ruta: "/administracion/roles-permisos",
  },
  {
    titulo: "Auditoría",
    descripcion:
      "Consulta acciones de usuarios, accesos y eventos relevantes del sistema.",
    ruta: "/administracion/auditoria",
  },
  {
    titulo: "Tablas Maestras",
    descripcion:
      "Configura sedes, áreas, organigrama y tipos documentales institucionales.",
    ruta: "/administracion/tablas-maestras",
  },
  {
    titulo: "Calendario Laboral",
    descripcion:
      "Configura días hábiles, horario, feriados y días no laborables.",
    ruta: "/administracion/calendario-laboral",
  },
  {
    titulo: "Seguridad",
    descripcion:
      "Gestiona bloqueos, intentos fallidos y políticas básicas de acceso.",
    ruta: "/administracion/seguridad",
  },
];

export default function AdministracionPage() {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-5">
          <p className="text-sm font-bold text-blue-700">SIGD</p>
          <h1 className="text-2xl font-bold">
            Administración, Seguridad y Auditoría
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Configuración y control administrativo del sistema.
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-7">
          <h2 className="text-3xl font-bold">Panel de Administración</h2>
          <p className="mt-2 text-sm text-slate-600">
            Selecciona una opción para administrar el SIGD.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {modulos.map((modulo) => (
            <article
              key={modulo.titulo}
              className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              <h3 className="text-lg font-bold">{modulo.titulo}</h3>
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
