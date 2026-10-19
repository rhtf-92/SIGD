import { ArrowRight, Calendar, ClipboardList, Database, Lock, ShieldCheck, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

import AdminPageHeader from "../../components/administracion/AdminPageHeader";

const modulos = [
  {
    titulo: "Usuarios",
    codigo: "M05 · Cuentas",
    descripcion:
      "Administra cuentas existentes, estado, área, cargo y rol asignado.",
    ruta: "/administracion/usuarios",
    icono: Users,
  },
  {
    titulo: "Roles y Permisos",
    codigo: "M05 · Accesos",
    descripcion:
      "Define qué puede ver y hacer cada rol dentro de los módulos del SIGD.",
    ruta: "/administracion/roles-permisos",
    icono: ShieldCheck,
  },
  {
    titulo: "Auditoría",
    codigo: "M05 · Trazabilidad",
    descripcion:
      "Consulta acciones de usuarios, accesos y eventos relevantes del sistema.",
    ruta: "/administracion/auditoria",
    icono: ClipboardList,
  },
  {
    titulo: "Tablas Maestras",
    codigo: "M05 · Catálogos",
    descripcion:
      "Configura sedes, áreas, organigrama y tipos documentales institucionales.",
    ruta: "/administracion/tablas-maestras",
    icono: Database,
  },
  {
    titulo: "Calendario Laboral",
    codigo: "M05 · Horario",
    descripcion:
      "Configura días hábiles, horario, corte LPAG y feriados de Ucayali.",
    ruta: "/administracion/calendario-laboral",
    icono: Calendar,
  },
  {
    titulo: "Seguridad",
    codigo: "M05 · Políticas",
    descripcion:
      "Gestiona bloqueos, intentos fallidos y políticas básicas de acceso.",
    ruta: "/administracion/seguridad",
    icono: Lock,
  },
];

export default function AdministracionPage() {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen bg-sigd-surface text-sigd-text">
      <AdminPageHeader
        title="Panel de Administración"
        description="Administración, Seguridad y Auditoría: configuración y control administrativo del sistema."
      />

      <section className="mx-auto max-w-7xl px-6 py-8">
        <p className="mb-6 max-w-2xl text-sm text-sigd-muted">
          Selecciona una opción para administrar el SIGD.
        </p>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {modulos.map((modulo) => {
            const Icono = modulo.icono;
            return (
              <article key={modulo.titulo} className="module-card cat-doc">
                <div className="flex items-start justify-between gap-3">
                  <span className="module-icon">
                    <Icono className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <span className="module-code">{modulo.codigo}</span>
                </div>

                <h3 className="mt-4 text-lg font-bold text-sigd-text">
                  {modulo.titulo}
                </h3>
                <p className="mt-1.5 min-h-12 flex-1 text-sm leading-6 text-sigd-muted">
                  {modulo.descripcion}
                </p>

                <button
                  type="button"
                  onClick={() => navigate(modulo.ruta)}
                  aria-label={`Administrar ${modulo.titulo}`}
                  className="module-cta mt-5 self-start focus-ring"
                >
                  Administrar
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
