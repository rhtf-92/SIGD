import { useNavigate } from "react-router-dom";
import {
  Users,
  ShieldCheck,
  ClipboardList,
  Sparkles,
  Clock,
  Layers,
} from "lucide-react";
import AdminPageHeader from "../../components/administracion/AdminPageHeader";
import KpiCard from "../../components/administracion/common/KpiCard";

const modulos = [
  {
    titulo: "Usuarios",
    descripcion:
      "Administra cuentas existentes, estado, área, cargo y rol asignado.",
    ruta: "/administracion/usuarios",
    icono: Users,
    colorScheme: {
      border: "border-blue-100 hover:border-blue-300",
      iconBg: "bg-blue-50 border-blue-100 text-blue-700",
      glow: "hover:shadow-lg",
      tagColor: "bg-blue-50 text-blue-700 border-blue-100",
      accentGrad: "from-blue-100/80 via-sky-50/60 to-transparent",
    },
    tag: "Directorio",
  },
  {
    titulo: "Roles y Permisos",
    descripcion:
      "Define qué puede ver y hacer cada rol dentro de los módulos del SIGD.",
    ruta: "/administracion/roles-permisos",
    icono: ShieldCheck,
    colorScheme: {
      border: "border-purple-100 hover:border-purple-300",
      iconBg: "bg-purple-50 border-purple-100 text-purple-700",
      glow: "hover:shadow-lg",
      tagColor: "bg-purple-50 text-purple-700 border-purple-100",
      accentGrad: "from-purple-100/80 via-indigo-50/60 to-transparent",
    },
    tag: "RBAC",
  },
  {
    titulo: "Auditoría",
    descripcion:
      "Consulta acciones de usuarios, accesos y eventos relevantes del sistema.",
    ruta: "/administracion/auditoria",
    icono: ClipboardList,
    colorScheme: {
      border: "border-cyan-100 hover:border-cyan-300",
      iconBg: "bg-cyan-50 border-cyan-100 text-cyan-700",
      glow: "hover:shadow-lg",
      tagColor: "bg-cyan-50 text-cyan-700 border-cyan-100",
      accentGrad: "from-cyan-100/80 via-teal-50/60 to-transparent",
    },
    tag: "WORM Forense",
  },
  {
    titulo: "Tablas Maestras",
    descripcion:
      "Configura sedes, áreas, organigrama y tipos documentales institucionales.",
    ruta: "/administracion/tablas-maestras",
    icono: Database,
    colorScheme: {
      border: "border-amber-100 hover:border-amber-300",
      iconBg: "bg-amber-50 border-amber-100 text-amber-700",
      glow: "hover:shadow-lg",
      tagColor: "bg-amber-50 text-amber-700 border-amber-100",
      accentGrad: "from-amber-100/80 via-orange-50/60 to-transparent",
    },
    tag: "Catálogos",
  },
  {
    titulo: "Calendario Laboral",
    descripcion:
      "Configura días hábiles, horario, corte LPAG y feriados de Ucayali.",
    ruta: "/administracion/calendario-laboral",
    icono: Calendar,
    colorScheme: {
      border: "border-emerald-100 hover:border-emerald-300",
      iconBg: "bg-emerald-50 border-emerald-100 text-emerald-700",
      glow: "hover:shadow-lg",
      tagColor: "bg-emerald-50 text-emerald-700 border-emerald-100",
      accentGrad: "from-emerald-100/80 via-teal-50/60 to-transparent",
    },
    tag: "LPAG 16:30",
  },
  {
    titulo: "Seguridad",
    descripcion:
      "Gestiona bloqueos, intentos fallidos y políticas básicas de acceso.",
    ruta: "/administracion/seguridad",
    icono: Lock,
    colorScheme: {
      border: "border-rose-100 hover:border-rose-300",
      iconBg: "bg-rose-50 border-rose-100 text-rose-700",
      glow: "hover:shadow-lg",
      tagColor: "bg-rose-50 text-rose-700 border-rose-100",
      accentGrad: "from-rose-100/80 via-pink-50/60 to-transparent",
    },
    tag: "Protección",
  },
];

export default function AdministracionPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-full">
      <AdminPageHeader
        title="Panel de Administración"
        description="Administración, Seguridad y Auditoría: configuración y control administrativo del sistema."
        icon={Layers}
        badge="Hub Central"
      />

      <section className="mx-auto w-[88%] max-w-[1500px] space-y-3.5 py-3.5">
        {/* Banner de Bienvenida Institucional */}
        <div className="relative overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-cyan-50 p-6 shadow-sm sm:p-8">
          <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-blue-700 to-cyan-600" />
          <div className="absolute -right-10 -top-16 h-64 w-64 rounded-full bg-blue-100/70 blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white px-3 py-1 text-xs font-bold text-blue-800">
                <Sparkles className="h-3.5 w-3.5 text-blue-700" />
                <span>Gestión Centralizada y Seguridad Institucional</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                Bienvenido al Panel de Control SIGD
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
                Selecciona una opción para administrar el SIGD. Configuración de parámetros normativos,
                matriz de control de accesos (RBAC), catálogo de tablas maestras y bitácora de auditoría forense WORM.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate("/administracion/usuarios")}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md shadow-blue-900/10 transition hover:bg-blue-800 cursor-pointer"
              >
                <Users className="h-4 w-4" />
                <span>Directorio Personal</span>
              </button>
            </div>
          </div>
        </div>

        {/* 4 Indicadores Rápidos */}
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            title="Directorio Activo"
            value="12 Cuentas"
            subtitle="Personal institucional"
            icon={Users}
            badge={{ text: "Operativo", variant: "positive" }}
            color="blue"
          />
          <KpiCard
            title="Matriz de Acceso"
            value="6 Roles"
            subtitle="Permisos RBAC por módulo"
            icon={ShieldCheck}
            badge={{ text: "Definido", variant: "neutral" }}
            color="purple"
          />
          <KpiCard
            title="Auditoría WORM"
            value="Inmutable"
            subtitle="Trazabilidad RFC 7807"
            icon={ClipboardList}
            badge={{ text: "100% Blindado", variant: "positive" }}
            color="cyan"
          />
          <KpiCard
            title="Corte Normativo"
            value="16:30 hrs"
            subtitle="TUO Ley N° 27444"
            icon={Clock}
            badge={{ text: "Vigente", variant: "warning" }}
            color="gold"
          />
        </div>

        {/* Cuadrícula de 6 Módulos Administrativos */}
        <div>
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                Módulos de Configuración y Control
              </h3>
              <p className="text-xs text-slate-600">
                Selecciona una opción para administrar el SIGD.
              </p>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {modulos.map((modulo) => {
              const Icono = modulo.icono;
              return (
                <article
                  key={modulo.titulo}
                  className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border ${modulo.colorScheme.border} bg-white p-6 shadow-sm ${modulo.colorScheme.glow} transition-all duration-300 hover:-translate-y-1`}
                >
                  {/* Subtle top corner gradient */}
                  <div
                    className={`absolute -top-12 -right-12 h-32 w-32 rounded-full bg-gradient-to-br ${modulo.colorScheme.accentGrad} blur-2xl pointer-events-none group-hover:scale-150 transition-transform duration-500`}
                  />

                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-xl border ${modulo.colorScheme.iconBg} transition-transform duration-300 group-hover:scale-110`}
                      >
                        <Icono className="h-6 w-6" />
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${modulo.colorScheme.tagColor}`}
                      >
                        {modulo.tag}
                      </span>
                    </div>

                    <h4 className="text-lg font-bold tracking-tight text-slate-900 group-hover:text-blue-800 transition-colors">
                      {modulo.titulo}
                    </h4>
                    <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed min-h-[3rem]">
                      {modulo.descripcion}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-500 group-hover:text-slate-600">
                      Acceso Autorizado
                    </span>

                    <button
                      type="button"
                      onClick={() => navigate(modulo.ruta)}
                      aria-label={`Administrar ${modulo.titulo}`}
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all duration-200 hover:bg-blue-800 group-hover:gap-2.5 cursor-pointer"
                    >
                      <span>Administrar</span>
                      <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}