import { useNavigate } from "react-router-dom";
import {
  Users,
  ShieldCheck,
  ClipboardList,
  Database,
  Calendar,
  Lock,
  ArrowRight,
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
      border: "border-blue-500/30 hover:border-blue-400/60",
      iconBg: "bg-blue-500/15 border-blue-400/30 text-blue-400",
      glow: "hover:shadow-[0_10px_30px_rgba(37,99,235,0.2)]",
      tagColor: "bg-blue-500/15 text-blue-300 border-blue-500/30",
      accentGrad: "from-blue-600/20 via-sky-500/10 to-transparent",
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
      border: "border-purple-500/30 hover:border-purple-400/60",
      iconBg: "bg-purple-500/15 border-purple-400/30 text-purple-400",
      glow: "hover:shadow-[0_10px_30px_rgba(168,85,247,0.2)]",
      tagColor: "bg-purple-500/15 text-purple-300 border-purple-500/30",
      accentGrad: "from-purple-600/20 via-indigo-500/10 to-transparent",
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
      border: "border-cyan-500/30 hover:border-cyan-400/60",
      iconBg: "bg-cyan-500/15 border-cyan-400/30 text-cyan-400",
      glow: "hover:shadow-[0_10px_30px_rgba(6,182,212,0.2)]",
      tagColor: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
      accentGrad: "from-cyan-600/20 via-teal-500/10 to-transparent",
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
      border: "border-amber-500/30 hover:border-amber-400/60",
      iconBg: "bg-amber-500/15 border-amber-400/30 text-amber-400",
      glow: "hover:shadow-[0_10px_30px_rgba(245,158,11,0.2)]",
      tagColor: "bg-amber-500/15 text-amber-300 border-amber-500/30",
      accentGrad: "from-amber-600/20 via-orange-500/10 to-transparent",
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
      border: "border-emerald-500/30 hover:border-emerald-400/60",
      iconBg: "bg-emerald-500/15 border-emerald-400/30 text-emerald-400",
      glow: "hover:shadow-[0_10px_30px_rgba(16,185,129,0.2)]",
      tagColor: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
      accentGrad: "from-emerald-600/20 via-teal-500/10 to-transparent",
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
      border: "border-rose-500/30 hover:border-rose-400/60",
      iconBg: "bg-rose-500/15 border-rose-400/30 text-rose-400",
      glow: "hover:shadow-[0_10px_30px_rgba(244,63,94,0.2)]",
      tagColor: "bg-rose-500/15 text-rose-300 border-rose-500/30",
      accentGrad: "from-rose-600/20 via-pink-500/10 to-transparent",
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

      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Banner de Bienvenida Institucional */}
        <div className="relative overflow-hidden rounded-2xl border border-cyan-500/25 bg-gradient-to-r from-blue-950/70 via-slate-900/90 to-slate-950/80 p-6 sm:p-8 backdrop-blur-2xl shadow-2xl">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/15 px-3 py-1 text-xs font-bold text-cyan-300">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Gestión Centralizada y Seguridad Institucional</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                Bienvenido al Panel de Control SIGD
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                Selecciona una opción para administrar el SIGD. Configuración de parámetros normativos,
                matriz de control de accesos (RBAC), catálogo de tablas maestras y bitácora de auditoría forense WORM.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate("/administracion/usuarios")}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-lg shadow-cyan-500/25 transition cursor-pointer"
              >
                <Users className="h-4 w-4" />
                <span>Directorio Personal</span>
              </button>
            </div>
          </div>
        </div>

        {/* 4 Indicadores Rápidos */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
              <h3 className="text-lg font-bold text-white tracking-tight">
                Módulos de Configuración y Control
              </h3>
              <p className="text-xs text-slate-400">
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
                  className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border ${modulo.colorScheme.border} bg-slate-900/60 p-6 backdrop-blur-xl shadow-lg ${modulo.colorScheme.glow} transition-all duration-300 hover:-translate-y-1`}
                >
                  {/* Subtle top corner gradient */}
                  <div
                    className={`absolute -top-12 -right-12 h-32 w-32 rounded-full bg-gradient-to-br ${modulo.colorScheme.accentGrad} blur-2xl pointer-events-none group-hover:scale-150 transition-transform duration-500`}
                  />

                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-xl border backdrop-blur-md ${modulo.colorScheme.iconBg} shadow-inner transition-transform duration-300 group-hover:scale-110`}
                      >
                        <Icono className="h-6 w-6 drop-shadow-[0_0_8px_currentColor]" />
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${modulo.colorScheme.tagColor}`}
                      >
                        {modulo.tag}
                      </span>
                    </div>

                    <h4 className="text-lg font-bold tracking-tight text-white group-hover:text-cyan-200 transition-colors">
                      {modulo.titulo}
                    </h4>
                    <p className="mt-2 text-xs sm:text-sm text-slate-400 leading-relaxed min-h-[3rem]">
                      {modulo.descripcion}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-500 group-hover:text-slate-400">
                      Acceso Autorizado
                    </span>

                    <button
                      type="button"
                      onClick={() => navigate(modulo.ruta)}
                      aria-label={`Administrar ${modulo.titulo}`}
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:shadow-cyan-500/30 transition-all duration-200 group-hover:gap-2.5 cursor-pointer"
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