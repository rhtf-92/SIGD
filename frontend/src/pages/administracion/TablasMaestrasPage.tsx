import {
  Activity,
  ArrowRightLeft,
  Building2,
  CheckCircle2,
  FileText,
  Info,
  Layers,
  Network,
  Plus,
  Search,
  ShieldCheck,
} from "lucide-react";

import AdminPageHeader from "../../components/administracion/AdminPageHeader";
import OrganigramaTreeView from "../../components/administracion/OrganigramaTreeView";
import { useTablasMaestras } from "../../hooks/useTablasMaestras";
import type { TipoTabla } from "../../types/tablasMaestras";

const ICONOS_TIPO: Record<TipoTabla, React.ReactNode> = {
  "Tipos documentales": <FileText className="h-4 w-4" />,
  "Áreas y Organigrama": <Network className="h-4 w-4" />,
  "Estados de trámite (FSM)": <Layers className="h-4 w-4" />,
  "Acciones de trazabilidad": <Activity className="h-4 w-4" />,
  "Transiciones de flujo": <ArrowRightLeft className="h-4 w-4" />,
};

const DESCRIPCIONES_TIPO: Record<TipoTabla, string> = {
  "Tipos documentales":
    "Catálogo oficial de documentos habilitados para sustentar actos administrativos, trámites del TUPA y recaudos procesales con requisitos de firma digital.",
  "Áreas y Organigrama":
    "Estructura orgánica institucional bajo el estándar Materialized Path (ltree). Define las dependencias de derivación y despacho.",
  "Estados de trámite (FSM)":
    "Máquina de estados finita del ciclo de vida del expediente. Garantiza la trazabilidad desde la radicación hasta el archivo definitivo.",
  "Acciones de trazabilidad":
    "Eventos procesales autorizados que modifican el estado de un trámite y generan hitos auditables e inmutables con sellado de tiempo.",
  "Transiciones de flujo":
    "Reglas de navegación procesal que impiden saltos de estado indebidos y validan el flujo normativo de atención documental.",
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
    exigeFirma,
    setExigeFirma,
    tamanoMb,
    setTamanoMb,
    mensaje,
    setMensaje,
    crearRegistro,
    alternarEstado,
  } = useTablasMaestras();

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <AdminPageHeader
        title="Tablas Maestras y Trazabilidad"
        description="Gestión de catálogos paramétricos, tipos documentales y máquina de estados para la trazabilidad integral de trámites."
      />

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        {/* Banner Informativo: Entidad Unisede (Ucayali) */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50/80 p-4 shadow-sm text-sm text-blue-900">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2 text-blue-700 shrink-0">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-blue-950">
                Entidad Unisede Institucional — Región Ucayali
              </p>
              <p className="text-xs text-blue-800/90 mt-0.5">
                Instituto de Educación Superior Tecnológico Público &quot;Suiza&quot; opera con <strong>Sede Central Única</strong> (Av. Centenario Km 3.5, Pucallpa, Coronel Portillo). No requiere configuración multisede; todos los expedientes, resoluciones y trámites se unifican institucionalmente.
              </p>
            </div>
          </div>
          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-blue-200/80 px-2.5 py-1 text-xs font-semibold text-blue-900">
            <ShieldCheck className="h-3.5 w-3.5 text-blue-700" /> Sede Única Activa
          </span>
        </div>

        {/* Notificación de Éxito / Acción */}
        {mensaje && (
          <div
            role="status"
            className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 shadow-sm"
          >
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <span>{mensaje}</span>
          </div>
        )}

        {/* Pestañas de Selección de Catálogo */}
        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
          {tipos.map((tipo) => {
            const esActivo = tipoActivo === tipo;
            return (
              <button
                key={tipo}
                type="button"
                onClick={() => cambiarTipo(tipo)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all shadow-sm ${
                  esActivo
                    ? "bg-blue-700 text-white shadow-blue-200 ring-2 ring-blue-600 ring-offset-1"
                    : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {ICONOS_TIPO[tipo]}
                {tipo}
              </button>
            );
          })}
        </div>

        {/* Vista Jerárquica de Organigrama (cuando se visualiza Áreas) */}
        {tipoActivo === "Áreas y Organigrama" && (
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-800">Organigrama Institucional Jerárquico</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Modelo de estructura por ruta jerárquica Materialized Path (formato{" "}
                  <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs text-blue-800">
                    01.03.02
                  </code>
                  ). Determina las dependencias de despacho y pases de derivación.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                {areasOrganicas.length} Unidades Activas
              </span>
            </div>
            <div className="mt-4">
              <OrganigramaTreeView areas={areasOrganicas} />
            </div>
          </section>
        )}

        {/* Barra de Búsqueda y Creación */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="w-full md:max-w-xl">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Buscar en {tipoActivo.toLowerCase()}
                </label>
                <span className="text-xs text-slate-400">
                  {registros.length} registros encontrados
                </span>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  value={busqueda}
                  onChange={(event) => setBusqueda(event.target.value)}
                  placeholder="Buscar por código, nombre o detalle..."
                  className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setMostrarFormulario((actual) => !actual)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-800 transition"
            >
              <Plus className="h-4 w-4" />
              {mostrarFormulario ? "Ocultar formulario" : "Nuevo registro"}
            </button>
          </div>

          {/* Formulario de Alta de Nuevo Registro Paramétrico */}
          {mostrarFormulario && (
            <div className="mt-5 border-t border-slate-200 pt-5 space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">Código</label>
                  <input
                    value={codigo}
                    onChange={(event) => setCodigo(event.target.value)}
                    placeholder="Ej. ACT_COMP, RES_REC"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">Denominación</label>
                  <input
                    value={nombre}
                    onChange={(event) => setNombre(event.target.value)}
                    placeholder="Nombre oficial del registro"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">Detalle / Propósito</label>
                  <input
                    value={detalle}
                    onChange={(event) => setDetalle(event.target.value)}
                    placeholder="Descripción funcional en el flujo"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
              </div>

              {/* Campos específicos si es Tipo Documental */}
              {tipoActivo === "Tipos documentales" && (
                <div className="grid gap-4 sm:grid-cols-2 rounded-lg bg-slate-50 p-3 border border-slate-200 text-xs">
                  <label className="flex items-center gap-2 font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={exigeFirma}
                      onChange={(e) => setExigeFirma(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 accent-blue-600"
                    />
                    Exige firma digital institucional obligatoria
                  </label>
                  <label className="flex items-center gap-2 font-medium text-slate-700">
                    <span>Tamaño máximo permitido (MB):</span>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={tamanoMb}
                      onChange={(e) => setTamanoMb(Number(e.target.value) || 25)}
                      className="w-20 rounded border border-slate-300 px-2 py-1 text-xs"
                    />
                  </label>
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setMostrarFormulario(false)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={crearRegistro}
                  className="rounded-lg bg-blue-700 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-800 shadow-sm"
                >
                  Guardar registro
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Tabla Detallada del Catálogo Activo */}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4 bg-slate-50/50 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-800 text-sm">{tipoActivo}</h3>
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-800">
                  {registros.length} ítems
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {DESCRIPCIONES_TIPO[tipoActivo]}
              </p>
            </div>
            <div className="text-[11px] text-slate-500 flex items-center gap-1">
              <Info className="h-3.5 w-3.5 text-slate-400" />
              Borrado lógico: Inactivar preserva la trazabilidad histórica de trámites pasados.
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Código</th>
                  <th className="px-6 py-3">Denominación</th>
                  {tipoActivo === "Tipos documentales" && (
                    <th className="px-6 py-3">Firma Digital / Tamaño</th>
                  )}
                  {tipoActivo === "Estados de trámite (FSM)" && (
                    <th className="px-6 py-3">Fase / Tipo Estado</th>
                  )}
                  {tipoActivo === "Transiciones de flujo" && (
                    <th className="px-6 py-3">Evento Disparador</th>
                  )}
                  <th className="px-6 py-3">Detalle / Trazabilidad</th>
                  <th className="px-6 py-3">Estado</th>
                  <th className="px-6 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {registros.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                      No se encontraron registros coincidentes con el criterio de búsqueda.
                    </td>
                  </tr>
                ) : (
                  registros.map((registro) => {
                    const esActivo = registro.estado === "Activo";
                    return (
                      <tr key={registro.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-3.5 font-mono font-bold text-slate-800">
                          {registro.codigo}
                        </td>
                        <td className="px-6 py-3.5 font-semibold text-slate-900">
                          {registro.nombre}
                        </td>

                        {/* Columnas contextuales por tipo de catálogo */}
                        {tipoActivo === "Tipos documentales" && (
                          <td className="px-6 py-3.5">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                  registro.exigeFirma
                                    ? "bg-purple-100 text-purple-800"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {registro.exigeFirma ? "Exige Firma" : "Sin Firma"}
                              </span>
                              <span className="text-[11px] text-slate-500">
                                {registro.tamanoMaximoMb ?? 25} MB
                              </span>
                            </div>
                          </td>
                        )}

                        {tipoActivo === "Estados de trámite (FSM)" && (
                          <td className="px-6 py-3.5">
                            <div className="flex items-center gap-1.5">
                              <span className="rounded bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
                                {registro.faseProcesal ?? "General"}
                              </span>
                              {registro.esTerminal && (
                                <span className="rounded bg-rose-100 px-1.5 py-0.5 font-bold text-rose-800 text-[10px]">
                                  Terminal
                                </span>
                              )}
                            </div>
                          </td>
                        )}

                        {tipoActivo === "Transiciones de flujo" && (
                          <td className="px-6 py-3.5 font-mono font-bold text-blue-700">
                            {registro.eventoTransicion ?? "-"}
                          </td>
                        )}

                        <td className="px-6 py-3.5 text-slate-600 max-w-md">
                          {registro.detalle}
                        </td>

                        <td className="px-6 py-3.5">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                              esActivo
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {registro.estado}
                          </span>
                        </td>

                        <td className="px-6 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setMensaje("");
                              alternarEstado(registro.id);
                            }}
                            className={`rounded-lg border px-3 py-1 text-xs font-semibold transition ${
                              esActivo
                                ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                                : "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                            }`}
                          >
                            {esActivo ? "Inactivar" : "Activar"}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}
