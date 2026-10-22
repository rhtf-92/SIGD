import {
  Database,
  Plus,
  CheckCircle,
  Building2,
  FolderTree,
  FileText,
} from "lucide-react";

import AdminPageHeader from "../../components/administracion/AdminPageHeader";
import OrganigramaTreeView from "../../components/administracion/OrganigramaTreeView";
import GlassCard from "../../components/administracion/common/GlassCard";
import StatusBadge from "../../components/administracion/common/StatusBadge";
import SearchInput from "../../components/administracion/common/SearchInput";
import { PrimaryButton, SecondaryButton } from "../../components/administracion/common/Buttons";
import { EmptyState } from "../../components/administracion/common/StateViews";
import { useTablasMaestras } from "../../hooks/useTablasMaestras";

const ICONS_CATEGORIAS: Record<string, typeof Database> = {
  Sedes: Building2,
  Áreas: FolderTree,
  "Tipos Documentales": FileText,
};

export default function TablasMaestrasPage() {
  const {
    tipos,
    registros,
    areasOrganicas,
    tipoActivo,
    cambiarTipo,
    busqueda,
    setBusqueda,
    mostrarFormulario,
    setMostrarFormulario,
    codigo,
    setCodigo,
    nombre,
    setNombre,
    detalle,
    setDetalle,
    mensaje,
    setMensaje,
    crearRegistro,
    alternarEstado,
  } = useTablasMaestras();

  return (
    <div className="min-h-full">
      <AdminPageHeader
        title="Tablas Maestras"
        description="Configuración de catálogos paramétricos institucionales: sedes, organigrama jerárquico y tipos documentales oficiales."
        icon={Database}
        badge="Catálogos Base"
      />

      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Feedback Message */}
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

        {/* Categories Tab Selector */}
        <div className="flex flex-wrap gap-2.5">
          {tipos.map((tipo) => {
            const esActivo = tipoActivo === tipo;
            const Icono = ICONS_CATEGORIAS[tipo] ?? Database;
            return (
              <button
                key={tipo}
                type="button"
                onClick={() => cambiarTipo(tipo)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer ${
                  esActivo
                    ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-cyan-500/20 border border-cyan-400/40"
                    : "border border-slate-800 bg-slate-900/60 text-slate-300 hover:bg-slate-800/80 hover:border-slate-700 hover:text-white"
                }`}
              >
                <Icono className={`h-4 w-4 ${esActivo ? "text-cyan-200" : "text-slate-400"}`} />
                <span>{tipo}</span>
              </button>
            );
          })}
        </div>

        {/* Organigrama Tree View (Only when "Áreas" is active) */}
        {tipoActivo === "Áreas" && (
          <GlassCard glow="cyan">
            <div className="mb-4 flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  Organigrama Jerárquico Institucional
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Modelo Materialized Path (formato{" "}
                  <code className="rounded-md border border-cyan-500/30 bg-cyan-950/40 px-1.5 py-0.5 font-mono text-[11px] font-bold text-cyan-300">
                    01.03.02
                  </code>
                  ). Permite navegabilidad y herencia de unidades orgánicas.
                </p>
              </div>
            </div>

            <div className="mt-4">
              <OrganigramaTreeView areas={areasOrganicas} />
            </div>
          </GlassCard>
        )}

        {/* Filter and Add Section */}
        <GlassCard>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="w-full sm:max-w-md">
                <label className="mb-1.5 block text-xs font-semibold tracking-wider uppercase text-slate-400">
                  Buscar en {tipoActivo.toLowerCase()}
                </label>
                <SearchInput
                  value={busqueda}
                  onChange={setBusqueda}
                  placeholder="Código, nombre o detalle..."
                />
              </div>

              <div className="self-end sm:self-auto">
                <PrimaryButton
                  onClick={() => setMostrarFormulario((actual) => !actual)}
                  icon={Plus}
                >
                  {mostrarFormulario ? "Ocultar formulario" : "Nuevo registro"}
                </PrimaryButton>
              </div>
            </div>

            {/* Inline Creation Form */}
            {mostrarFormulario && (
              <div className="mt-2 rounded-xl border border-cyan-500/30 bg-slate-950/60 p-4 backdrop-blur-md animate-in fade-in duration-200">
                <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-cyan-400">
                  Agregar nuevo registro a {tipoActivo}
                </h4>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold tracking-wider uppercase text-slate-400">
                      Código
                    </label>
                    <input
                      value={codigo}
                      onChange={(event) => setCodigo(event.target.value)}
                      placeholder="Ej. ARE-007 o SED-03"
                      className="w-full rounded-xl border border-slate-700/80 bg-slate-900/80 px-3.5 py-2.5 font-mono text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold tracking-wider uppercase text-slate-400">
                      Nombre
                    </label>
                    <input
                      value={nombre}
                      onChange={(event) => setNombre(event.target.value)}
                      placeholder="Nombre oficial del registro"
                      className="w-full rounded-xl border border-slate-700/80 bg-slate-900/80 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold tracking-wider uppercase text-slate-400">
                      Detalle / Jerarquía
                    </label>
                    <input
                      value={detalle}
                      onChange={(event) => setDetalle(event.target.value)}
                      placeholder="Dependencia o descripción técnica"
                      className="w-full rounded-xl border border-slate-700/80 bg-slate-900/80 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                    />
                  </div>

                  <div className="flex gap-2 sm:col-span-3 sm:justify-end border-t border-slate-800/80 pt-3">
                    <SecondaryButton
                      size="sm"
                      onClick={() => setMostrarFormulario(false)}
                    >
                      Cancelar
                    </SecondaryButton>
                    <PrimaryButton
                      size="sm"
                      onClick={crearRegistro}
                    >
                      Guardar registro
                    </PrimaryButton>
                  </div>
                </div>
              </div>
            )}
          </div>
        </GlassCard>

        {/* Records Table */}
        <div className="overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl shadow-xl">
          <div className="border-b border-slate-800/80 px-6 py-4 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-white text-base tracking-tight">
                Registros de {tipoActivo}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Se utiliza inactivación (borrado lógico) para preservar la trazabilidad histórica.
              </p>
            </div>
            <span className="font-mono text-xs text-cyan-400">
              {registros.length} registros
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[750px] text-left">
              <thead className="border-b border-slate-800/80 bg-slate-950/60 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-6 py-3.5">Código</th>
                  <th className="px-6 py-3.5">Nombre</th>
                  <th className="px-6 py-3.5">Detalle / Jerarquía</th>
                  <th className="px-6 py-3.5">Estado</th>
                  <th className="px-6 py-3.5 text-right">Acción</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800/60">
                {registros.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <EmptyState
                        title={`No se encontraron registros en ${tipoActivo}`}
                        description="Intente modificar los filtros de búsqueda o añada un nuevo registro."
                      />
                    </td>
                  </tr>
                ) : (
                  registros.map((registro) => (
                    <tr
                      key={registro.id}
                      className="hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* Código */}
                      <td className="px-6 py-3.5 font-mono text-xs font-bold text-cyan-300">
                        {registro.codigo}
                      </td>

                      {/* Nombre */}
                      <td className="px-6 py-3.5 text-sm font-semibold text-white group-hover:text-cyan-200 transition-colors">
                        {registro.nombre}
                      </td>

                      {/* Detalle */}
                      <td className="px-6 py-3.5 text-xs text-slate-300">
                        {registro.detalle}
                      </td>

                      {/* Estado */}
                      <td className="px-6 py-3.5">
                        <StatusBadge status={registro.estado} size="sm" />
                      </td>

                      {/* Acción */}
                      <td className="px-6 py-3.5 text-right">
                        <SecondaryButton
                          size="sm"
                          onClick={() => {
                            setMensaje("");
                            alternarEstado(registro.id);
                          }}
                          className="text-xs"
                        >
                          {registro.estado === "Activo" ? "Inactivar" : "Activar"}
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
    </div>
  );
}