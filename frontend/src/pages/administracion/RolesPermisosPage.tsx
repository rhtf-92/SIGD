import {
  ShieldCheck,
  Shield,
  Users,
  CheckCircle,
  Save,
  Info,
} from "lucide-react";
import AdminPageHeader from "../../components/administracion/AdminPageHeader";
import RolePermissionMatrix from "../../components/administracion/RolePermissionMatrix";
import GlassCard from "../../components/administracion/common/GlassCard";
import KpiCard from "../../components/administracion/common/KpiCard";
import { PrimaryButton } from "../../components/administracion/common/Buttons";
import { useRbacConfig } from "../../hooks/useRbacConfig";

export default function RolesPermisosPage() {
  const {
    roles,
    rolSeleccionado,
    setRolSeleccionado,
    rolActual,
    permisosRolActual,
    alternarPermiso,
    guardarPermisos,
    mensaje,
    setMensaje,
  } = useRbacConfig();

  const totalUsuariosAsignados = roles.reduce(
    (acc, rol) => acc + (rol.usuarios || 0),
    0,
  );

  return (
    <div className="min-h-full">
      <AdminPageHeader
        title="Roles y Permisos"
        description="Control de acceso basado en roles institucionales (RBAC), alcance administrativo y privilegios por módulo."
        icon={ShieldCheck}
        badge="Control RBAC"
      />

      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Top KPIs */}
        <div className="grid gap-4 sm:grid-cols-3">
          <KpiCard
            title="Roles Configurados"
            value={roles.length}
            subtitle="Perfiles institucionales"
            icon={Shield}
            badge={{ text: "RBAC Activo", variant: "positive" }}
            color="purple"
          />
          <KpiCard
            title="Usuarios Asignados"
            value={totalUsuariosAsignados}
            subtitle="Con perfiles vinculados"
            icon={Users}
            badge={{ text: "Cobertura 100%", variant: "neutral" }}
            color="blue"
          />
          <KpiCard
            title="Rol en Edición"
            value={rolActual.nombre}
            subtitle={`Alcance: ${rolActual.alcance}`}
            icon={ShieldCheck}
            badge={{ text: "Seleccionado", variant: "warning" }}
            color="cyan"
          />
        </div>

        {/* Feedback Banner */}
        {mensaje && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-950/40 px-4 py-3 text-sm font-medium text-emerald-300 backdrop-blur-md shadow-lg shadow-emerald-950/40"
          >
            <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
            <span>{mensaje}</span>
          </div>
        )}

        {/* 2-Column Content */}
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          {/* Left Column: Roles list */}
          <aside className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-bold tracking-wider uppercase text-slate-400">
                Roles del Ecosistema
              </h2>
              <span className="text-[11px] font-mono text-cyan-400">
                {roles.length} perfiles
              </span>
            </div>

            <div className="space-y-2.5">
              {roles.map((rol) => {
                const esSeleccionado = rolSeleccionado === rol.id;
                return (
                  <button
                    key={rol.id}
                    type="button"
                    onClick={() => {
                      setRolSeleccionado(rol.id);
                      setMensaje("");
                    }}
                    className={`w-full rounded-2xl border p-4 text-left transition-all duration-200 cursor-pointer ${
                      esSeleccionado
                        ? "border-cyan-400/60 bg-gradient-to-r from-blue-900/40 via-cyan-950/30 to-slate-900/60 shadow-[0_0_20px_rgba(6,182,212,0.15)] text-white"
                        : "border-slate-800/80 bg-slate-900/60 hover:bg-slate-800/50 hover:border-slate-700 text-slate-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            esSeleccionado
                              ? "bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]"
                              : "bg-slate-600"
                          }`}
                        />
                        <p className="font-bold text-sm tracking-tight">
                          {rol.nombre}
                        </p>
                      </div>
                      <span className="rounded-full border border-slate-700/80 bg-slate-800/80 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-300">
                        {rol.usuarios} usuarios
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-slate-400">
                      {rol.descripcion}
                    </p>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Right Column: Role Details & Matrix */}
          <div className="space-y-6">
            {/* Selected Role Card */}
            <GlassCard>
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-cyan-400">
                      Configuración RBAC
                    </span>
                    <span className="text-slate-600">•</span>
                    <span className="text-xs text-slate-400">ID: {rolActual.id}</span>
                  </div>
                  <h3 className="mt-1 text-2xl font-bold tracking-tight text-white">
                    {rolActual.nombre}
                  </h3>
                  <p className="mt-1.5 text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                    {rolActual.descripcion}
                  </p>
                </div>

                <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/30 px-3.5 py-2 text-xs font-semibold text-cyan-300">
                  <span className="text-slate-400 font-normal">Alcance:</span>{" "}
                  {rolActual.alcance}
                </div>
              </div>
            </GlassCard>

            {/* Permission Matrix */}
            <div className="overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800/80 px-6 py-4">
                <div>
                  <h3 className="font-bold text-white text-base tracking-tight">
                    Matriz de Permisos por Módulo
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Configure las operaciones permitidas (Ver, Crear, Editar, Derivar, Archivar, Eliminar, Exportar).
                  </p>
                </div>
              </div>

              <RolePermissionMatrix
                permisos={permisosRolActual}
                onAlternar={alternarPermiso}
              />

              <div className="flex items-center justify-between border-t border-slate-800/80 bg-slate-950/40 p-4 sm:p-5">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Info className="h-4 w-4 text-cyan-400" />
                  <span>Los cambios se guardan localmente para este rol.</span>
                </div>

                <PrimaryButton
                  onClick={guardarPermisos}
                  icon={Save}
                  size="md"
                >
                  Guardar permisos
                </PrimaryButton>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}