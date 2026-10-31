import {
  ClipboardList,
  Shield,
  Download,
  Search,
  CheckCircle2,
  AlertCircle,
  FileWarning,
} from "lucide-react";

import AdminPageHeader from "../../components/administracion/AdminPageHeader";
import AuditDetailDrawer from "../../components/administracion/AuditDetailDrawer";
import GlassCard from "../../components/administracion/common/GlassCard";
import KpiCard from "../../components/administracion/common/KpiCard";
import StatusBadge from "../../components/administracion/common/StatusBadge";
import SearchInput from "../../components/administracion/common/SearchInput";
import FilterSelect from "../../components/administracion/common/FilterSelect";
import { PrimaryButton, SecondaryButton } from "../../components/administracion/common/Buttons";
import { EmptyState } from "../../components/administracion/common/StateViews";
import { useAuditLogs } from "../../hooks/useAuditLogs";

export default function AuditoriaPage() {
  const {
    filtrados,
    resumen,
    busqueda,
    setBusqueda,
    modulo,
    setModulo,
    resultado,
    setResultado,
    seleccionado,
    setSeleccionado,
    exportarCsv,
  } = useAuditLogs();

  return (
    <div className="min-h-full">
      <AdminPageHeader
        title="Logs de Auditoría"
        description="Trazabilidad inmutable (WORM), acciones de usuarios, eventos del sistema y correlación técnica X-Correlation-ID."
        icon={ClipboardList}
        badge="Bitácora Forense"
        action={
          <SecondaryButton
            onClick={exportarCsv}
            icon={Download}
            size="sm"
          >
            Exportar CSV
          </SecondaryButton>
        }
      />

      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* WORM Inmutability Info Banner */}
        <div className="relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-blue-950/70 via-slate-900/80 to-slate-950/80 p-5 backdrop-blur-xl shadow-lg">
          <div className="flex items-start gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 border border-cyan-400/30 text-cyan-400">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">
                Principio de Inmutabilidad WORM (Write Once, Read Many)
              </h3>
              <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                Los registros de auditoría institucional son estrictamente de solo lectura y no pueden ser alterados ni eliminados.
                El almacenamiento garantiza trazabilidad legal encadenada conforme al marco del TUO de la Ley N° 27444.
              </p>
            </div>
          </div>
        </div>

        {/* 3 Metric Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <KpiCard
            title="Eventos Exitosos"
            value={resumen.exitosos}
            subtitle="Operaciones completadas"
            icon={CheckCircle2}
            badge={{ text: "Normal", variant: "positive" }}
            color="emerald"
          />
          <KpiCard
            title="Acciones Denegadas"
            value={resumen.denegados}
            subtitle="Respuestas HTTP 403 (RBAC)"
            icon={AlertCircle}
            badge={{ text: "Restricción", variant: "warning" }}
            color="gold"
          />
          <KpiCard
            title="Errores de Sistema"
            value={resumen.errores}
            subtitle="Notificaciones RFC 7807"
            icon={FileWarning}
            badge={{ text: "Atención", variant: "danger" }}
            color="rose"
          />
        </div>

        {/* Filters Bar */}
        <GlassCard>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white tracking-wide">
                  Filtros de Búsqueda Forense
                </h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {filtrados.length} evento{filtrados.length === 1 ? "" : "s"} encontrado{filtrados.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-[1fr_220px_220px_auto] items-end">
              <div>
                <label className="mb-1.5 block text-xs font-semibold tracking-wider uppercase text-slate-400">
                  Buscar evento
                </label>
                <SearchInput
                  value={busqueda}
                  onChange={setBusqueda}
                  placeholder="Usuario, acción, expediente, ID o X-Correlation-ID"
                />
              </div>

              <div>
                <FilterSelect
                  label="Módulo"
                  value={modulo}
                  onChange={(event) => setModulo(event.target.value)}
                >
                  <option value="Todos" className="bg-slate-900 text-slate-300">Todos los módulos</option>
                  <option value="Expedientes" className="bg-slate-900 text-white">Expedientes</option>
                  <option value="Documentos" className="bg-slate-900 text-white">Documentos</option>
                  <option value="Autenticación" className="bg-slate-900 text-white">Autenticación</option>
                  <option value="Seguridad" className="bg-slate-900 text-white">Seguridad</option>
                  <option value="Administración" className="bg-slate-900 text-white">Administración</option>
                </FilterSelect>
              </div>

              <div>
                <FilterSelect
                  label="Resultado"
                  value={resultado}
                  onChange={(event) =>
                    setResultado(
                      event.target.value as "Exitoso" | "Denegado" | "Error" | "Todos",
                    )
                  }
                >
                  <option value="Todos" className="bg-slate-900 text-slate-300">Todos los resultados</option>
                  <option value="Exitoso" className="bg-slate-900 text-emerald-300">Exitoso</option>
                  <option value="Denegado" className="bg-slate-900 text-amber-300">Denegado</option>
                  <option value="Error" className="bg-slate-900 text-rose-300">Error</option>
                </FilterSelect>
              </div>

              <div className="sm:col-span-2 lg:col-span-1">
                <PrimaryButton
                  onClick={exportarCsv}
                  icon={Download}
                  className="w-full text-xs"
                >
                  Exportar
                </PrimaryButton>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Audit Logs Table */}
        <div className="overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl shadow-xl">
          <div className="border-b border-slate-800/80 px-6 py-4 flex items-center justify-between">
            <h3 className="font-bold text-white text-base tracking-tight">
              Registro Histórico de Auditoría
            </h3>
            <span className="font-mono text-xs text-cyan-400">
              {filtrados.length} registro{filtrados.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1250px] text-left">
              <thead className="border-b border-slate-800/80 bg-slate-950/60 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-5 py-3.5">ID / Fecha y Hora</th>
                  <th className="px-5 py-3.5">Usuario / Rol</th>
                  <th className="px-5 py-3.5">Área</th>
                  <th className="px-5 py-3.5">Acción</th>
                  <th className="px-5 py-3.5">Módulo</th>
                  <th className="px-5 py-3.5">Recurso / CUT</th>
                  <th className="px-5 py-3.5">Resultado</th>
                  <th className="px-5 py-3.5">IP de Origen</th>
                  <th className="px-5 py-3.5 text-right">Detalle</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800/60">
                {filtrados.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center">
                      <EmptyState
                        title="No se encontraron eventos de auditoría"
                        description="Pruebe cambiando los filtros de búsqueda o consulte nuevamente."
                      />
                    </td>
                  </tr>
                ) : (
                  filtrados.map((registro) => (
                    <tr
                      key={registro.id}
                      className="hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* ID / Fecha */}
                      <td className="px-5 py-3.5">
                        <p className="font-mono text-xs font-bold text-cyan-300">
                          #{registro.id}
                        </p>
                        <p className="text-[11px] text-slate-400">{registro.fecha}</p>
                      </td>

                      {/* Usuario / Rol */}
                      <td className="px-5 py-3.5">
                        <p className="text-sm font-semibold text-white group-hover:text-cyan-200 transition-colors">
                          {registro.usuario}
                        </p>
                        <p className="text-[11px] text-slate-400">{registro.rol}</p>
                      </td>

                      {/* Área */}
                      <td className="px-5 py-3.5 text-xs text-slate-300">
                        {registro.area}
                      </td>

                      {/* Acción */}
                      <td className="px-5 py-3.5 text-xs font-medium text-slate-200">
                        {registro.accion}
                      </td>

                      {/* Módulo */}
                      <td className="px-5 py-3.5 text-xs text-slate-400">
                        <span className="rounded-md bg-slate-800 px-2 py-0.5 border border-slate-700/60">
                          {registro.modulo}
                        </span>
                      </td>

                      {/* Recurso / CUT */}
                      <td className="px-5 py-3.5 font-mono text-xs font-semibold text-cyan-300">
                        {registro.registro}
                      </td>

                      {/* Resultado */}
                      <td className="px-5 py-3.5">
                        <StatusBadge status={registro.resultado} size="sm" />
                      </td>

                      {/* IP */}
                      <td className="px-5 py-3.5 font-mono text-xs text-slate-400">
                        {registro.ip}
                      </td>

                      {/* Detalle */}
                      <td className="px-5 py-3.5 text-right">
                        <SecondaryButton
                          size="sm"
                          onClick={() => setSeleccionado(registro)}
                          className="text-xs"
                        >
                          Ver
                        </SecondaryButton>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Slide-over Drawer de Detalle Forense */}
      <AuditDetailDrawer
        registro={seleccionado}
        onClose={() => setSeleccionado(null)}
      />
    </div>
  );
}