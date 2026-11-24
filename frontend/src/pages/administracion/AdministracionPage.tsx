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
        <div className="relative overflow-hidden rounded-xl border border-cyan-500/20 bg-gradient-to-r from-blue-950/60 via-slate-900/80 to-slate-950/70 p-4 backdrop-blur-xl sm:p-5">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 h-36 w-36 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/15 px-2.5 py-0.5 text-[10px] font-bold text-cyan-300">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Gestión Centralizada y Seguridad Institucional</span>
              </div>
              <h2 className="text-lg font-black tracking-tight text-white sm:text-xl">
                Bienvenido al Panel de Control SIGD
              </h2>
              <p className="max-w-xl text-[11px] leading-relaxed text-slate-300 sm:text-xs">
                Parámetros normativos, matriz de accesos (RBAC), catálogos institucionales y bitácora forense WORM.
                Los módulos están disponibles en el menú lateral.
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate("/administracion/usuarios")}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 px-3 py-2 text-[11px] font-bold text-white shadow-lg shadow-cyan-500/20 transition hover:from-blue-500 hover:to-cyan-500 sm:text-xs"
            >
              <Users className="h-4 w-4" />
              Directorio Personal
            </button>
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
      </section>
    </div>
  );
}