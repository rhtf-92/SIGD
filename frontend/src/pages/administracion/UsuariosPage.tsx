import { useState } from "react";
import {
  Users,
  UserCheck,
  UserX,
  ShieldAlert,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Search,
} from "lucide-react";

import AdminPageHeader from "../../components/administracion/AdminPageHeader";
import UserEditModal from "../../components/administracion/UserEditModal";
import GlassCard from "../../components/administracion/common/GlassCard";
import KpiCard from "../../components/administracion/common/KpiCard";
import StatusBadge from "../../components/administracion/common/StatusBadge";
import SearchInput from "../../components/administracion/common/SearchInput";
import FilterSelect from "../../components/administracion/common/FilterSelect";
import { PrimaryButton, SecondaryButton } from "../../components/administracion/common/Buttons";
import { EmptyState } from "../../components/administracion/common/StateViews";

import {
  CATALOGO_AREAS,
  CATALOGO_ROLES_USUARIOS,
  CATALOGO_SEDES,
  useUsuariosAdmin,
} from "../../hooks/useUsuariosAdmin";
import type { ApiHttpError } from "../../types/api";
import type { EstadoUsuario } from "../../types/usuarioAdmin";

export default function UsuariosPage() {
  const [mensaje, setMensaje] = useState("");
  const [errorServidor, setErrorServidor] = useState("");

  const {
    usuarios,
    totalUsuarios,
    busqueda,
    setBusqueda,
    area,
    setArea,
    sede,
    setSede,
    rol,
    setRol,
    estado,
    setEstado,
    usuarioEditando,
    setUsuarioEditando,
    actualizarUsuario,
    conmutarEstado,
    isLoading,
    isFetching,
    error,
    guardarPendiente,
  } = useUsuariosAdmin();

  // Metrics calculations
  const totalActivos = usuarios.filter((u) => u.estado === "Activo").length;
  const totalInactivos = usuarios.filter((u) => u.estado === "Inactivo").length;
  const totalBloqueados = usuarios.filter((u) => u.estado === "Bloqueado").length;

  async function guardar(usuarioActualizado: Parameters<typeof actualizarUsuario>[0]) {
    setErrorServidor("");
    try {
      await actualizarUsuario(usuarioActualizado);
      setUsuarioEditando(null);
      setMensaje("Los cambios fueron registrados correctamente en el directorio institucional.");
    } catch (err) {
      setMensaje("");
      setErrorServidor(
        "No se pudo guardar la modificación. Revise los campos marcados e intente nuevamente.",
      );
      throw err;
    }
  }

  async function alternarEstado(id: number) {
    setErrorServidor("");
    try {
      await conmutarEstado(id);
      setMensaje("El estado operativo del usuario fue conmutado correctamente.");
    } catch {
      setMensaje("");
      setErrorServidor("No se pudo conmutar el estado del usuario.");
    }
  }

  return (
    <div className="min-h-full">
      <AdminPageHeader
        title="Gestión de Usuarios"
        description="Administración de cuentas institucionales, asignación de áreas, sedes, cargos, roles y estados operativos."
        icon={Users}
        badge="Directorio de Personal"
      />

      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* KPI Metrics */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Total Cuentas"
            value={totalUsuarios}
            subtitle="Registradas en el sistema"
            icon={Users}
            badge={{ text: "Directorio", variant: "neutral" }}
            color="blue"
          />
          <KpiCard
            title="Usuarios Activos"
            value={totalActivos}
            subtitle="Con acceso vigente"
            icon={UserCheck}
            badge={{ text: "Operativos", variant: "positive" }}
            color="emerald"
          />
          <KpiCard
            title="Cuentas Inactivas"
            value={totalInactivos}
            subtitle="En pausa operativa"
            icon={UserX}
            badge={{ text: "Pausa", variant: "warning" }}
            color="gold"
          />
          <KpiCard
            title="Cuentas Bloqueadas"
            value={totalBloqueados}
            subtitle="Por políticas o intentos"
            icon={ShieldAlert}
            badge={{ text: "Alerta", variant: "danger" }}
            color="rose"
          />
        </div>

        {/* Feedback Banners */}
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

        {errorServidor && (
          <div
            role="alert"
            aria-live="assertive"
            className="flex items-center gap-2.5 rounded-2xl border border-rose-500/30 bg-rose-950/40 px-4 py-3 text-sm font-medium text-rose-300 backdrop-blur-md shadow-lg shadow-rose-950/40"
          >
            <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0" />
            <span>{errorServidor}</span>
          </div>
        )}

        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="flex items-center gap-2.5 rounded-2xl border border-rose-500/30 bg-rose-950/40 px-4 py-3 text-sm font-medium text-rose-300 backdrop-blur-md shadow-lg shadow-rose-950/40"
          >
            <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0" />
            <span>No fue posible consultar el directorio institucional. Intente nuevamente.</span>
          </div>
        )}

        {/* Filters Panel */}
        <GlassCard>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white tracking-wide">
                  Búsqueda y Filtros del Directorio
                </h3>
              </div>
              {isFetching && !isLoading && (
                <span className="flex items-center gap-1.5 text-xs text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 px-2.5 py-0.5 rounded-full">
                  <RefreshCw className="h-3 w-3 animate-spin text-cyan-400" />
                  <span>Sincronizando...</span>
                </span>
              )}
            </div>

            <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <label htmlFor="busqueda" className="mb-1.5 block text-xs font-semibold tracking-wider uppercase text-slate-400">
                  Buscar usuario
                </label>
                <SearchInput
                  id="busqueda"
                  value={busqueda}
                  onChange={setBusqueda}
                  placeholder="Nombre, DNI, correo o área"
                />
              </div>

              <div>
                <FilterSelect
                  id="area"
                  label="Unidad Orgánica"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                >
                  <option value="" className="bg-slate-900 text-slate-300">Todas las áreas</option>
                  {CATALOGO_AREAS.map((item) => (
                    <option key={item} value={item} className="bg-slate-900 text-white">
                      {item}
                    </option>
                  ))}
                </FilterSelect>
              </div>

              <div>
                <FilterSelect
                  id="sede"
                  label="Sede"
                  value={sede}
                  onChange={(e) => setSede(e.target.value)}
                >
                  <option value="" className="bg-slate-900 text-slate-300">Todas las sedes</option>
                  {CATALOGO_SEDES.map((item) => (
                    <option key={item} value={item} className="bg-slate-900 text-white">
                      {item}
                    </option>
                  ))}
                </FilterSelect>
              </div>

              <div>
                <FilterSelect
                  id="rol"
                  label="Rol Asignado"
                  value={rol}
                  onChange={(e) => setRol(e.target.value)}
                >
                  <option value="" className="bg-slate-900 text-slate-300">Todos los roles</option>
                  {CATALOGO_ROLES_USUARIOS.map((item) => (
                    <option key={item} value={item} className="bg-slate-900 text-white">
                      {item}
                    </option>
                  ))}
                </FilterSelect>
              </div>

              <div>
                <FilterSelect
                  id="estado"
                  label="Estado"
                  value={estado}
                  onChange={(e) => setEstado(e.target.value as EstadoUsuario | "Todos")}
                >
                  <option value="Todos" className="bg-slate-900 text-slate-300">Todos los estados</option>
                  <option value="Activo" className="bg-slate-900 text-emerald-300">Activo</option>
                  <option value="Inactivo" className="bg-slate-900 text-slate-300">Inactivo</option>
                  <option value="Bloqueado" className="bg-slate-900 text-rose-300">Bloqueado</option>
                </FilterSelect>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Directory Table */}
        <div className="overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-800/80 px-6 py-4 gap-2">
            <div>
              <h3 className="font-bold text-white text-base tracking-tight">
                Directorio Institucional
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {usuarios.length} resultado{usuarios.length === 1 ? "" : "s"} visible{usuarios.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left">
              <thead className="border-b border-slate-800/80 bg-slate-950/60 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-6 py-3.5">Usuario / Identidad</th>
                  <th className="px-6 py-3.5">DNI</th>
                  <th className="px-6 py-3.5">Área / Sede</th>
                  <th className="px-6 py-3.5">Cargo</th>
                  <th className="px-6 py-3.5">Rol</th>
                  <th className="px-6 py-3.5">Estado</th>
                  <th className="px-6 py-3.5">Último Acceso</th>
                  <th className="px-6 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800/60" aria-busy={isLoading}>
                {isLoading && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center">
                      <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
                        <RefreshCw className="h-8 w-8 animate-spin text-cyan-400" />
                        <p className="text-sm font-semibold text-slate-300">
                          Consultando directorio institucional de usuarios...
                        </p>
                      </div>
                    </td>
                  </tr>
                )}

                {!isLoading && usuarios.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center">
                      <EmptyState
                        title="No se encontraron usuarios institucionales"
                        description="Ajuste los filtros o términos de búsqueda para encontrar los resultados deseados."
                      />
                    </td>
                  </tr>
                )}

                {!isLoading &&
                  usuarios.map((usuario) => {
                    const iniciales = usuario.nombre
                      .split(" ")
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join("");

                    return (
                      <tr
                        key={usuario.id}
                        className="hover:bg-slate-800/40 transition-colors group"
                      >
                        {/* Usuario / Identidad */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-700/80 to-cyan-600/80 text-white font-bold text-xs shadow-sm border border-cyan-400/20">
                              {iniciales || "U"}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-white group-hover:text-cyan-200 transition-colors">
                                {usuario.nombre}
                              </p>
                              <p className="text-xs text-slate-400 truncate">
                                {usuario.correo}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* DNI */}
                        <td className="px-6 py-4 font-mono text-sm text-slate-300">
                          {usuario.dni}
                        </td>

                        {/* Área / Sede */}
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-slate-200">
                            {usuario.area}
                          </p>
                          <p className="text-xs text-slate-400">{usuario.sede}</p>
                        </td>

                        {/* Cargo */}
                        <td className="px-6 py-4 text-sm text-slate-300">
                          {usuario.cargo}
                        </td>

                        {/* Rol */}
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-300">
                            {usuario.rol}
                          </span>
                        </td>

                        {/* Estado */}
                        <td className="px-6 py-4">
                          <StatusBadge status={usuario.estado} />
                        </td>

                        {/* Último Acceso */}
                        <td className="px-6 py-4 font-mono text-xs text-slate-400">
                          {usuario.ultimoAcceso}
                        </td>

                        {/* Acciones */}
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <PrimaryButton
                              size="sm"
                              onClick={() => {
                                setMensaje("");
                                setErrorServidor("");
                                setUsuarioEditando({ ...usuario });
                              }}
                              className="text-xs"
                            >
                              Administrar
                            </PrimaryButton>

                            <SecondaryButton
                              size="sm"
                              onClick={() => void alternarEstado(usuario.id)}
                              disabled={guardarPendiente}
                              title="Conmutar estado operativo (Activo → Inactivo → Bloqueado)"
                              className="text-xs"
                            >
                              Conmutar
                            </SecondaryButton>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Modal de Edición de Usuario */}
      {usuarioEditando && (
        <UserEditModal
          usuario={usuarioEditando}
          areas={CATALOGO_AREAS}
          sedes={CATALOGO_SEDES}
          roles={CATALOGO_ROLES_USUARIOS}
          onClose={() => {
            setMensaje("");
            setUsuarioEditando(null);
          }}
          onSave={guardar}
          onServerError={(err: ApiHttpError) => {
            if (err?.correlationId) {
              setErrorServidor(
                `Operación rechazada por el servidor. Código de correlación: ${err.correlationId}.`,
              );
            }
          }}
        />
      )}
    </div>
  );
}
