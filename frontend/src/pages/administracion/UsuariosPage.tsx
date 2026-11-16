import { useState } from "react";
import { Link } from "react-router-dom";

import AdminPageHeader from "../../components/administracion/AdminPageHeader";
import UserEditModal from "../../components/administracion/UserEditModal";
import CrearUsuarioModal from "../../components/administracion/CrearUsuarioModal";
import { useUsuariosAdmin } from "../../hooks/useUsuariosAdmin";
import { ApiHttpError } from "../../types/api";
import type { EstadoUsuario, UpdateUsuarioDTO } from "../../types/usuarioAdmin";

function estiloEstado(estado: EstadoUsuario) {
  if (estado === "Activo") {
    return {
      badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
      dot: "bg-emerald-500",
    };
  }
  if (estado === "Bloqueado") {
    return {
      badge: "bg-red-50 text-red-700 border-red-200",
      dot: "bg-red-500",
    };
  }
  return {
    badge: "bg-slate-100 text-slate-600 border-slate-200",
    dot: "bg-slate-400",
  };
}

function obtenerIniciales(nombre: string): string {
  if (!nombre) return "U";
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

function colorAvatar(nombre: string): string {
  const paletas = [
    "bg-blue-100 text-blue-700 border-blue-200",
    "bg-indigo-100 text-indigo-700 border-indigo-200",
    "bg-sky-100 text-sky-700 border-sky-200",
    "bg-emerald-100 text-emerald-700 border-emerald-200",
  ];
  let hash = 0;
  for (let i = 0; i < nombre.length; i++) hash = nombre.charCodeAt(i) + ((hash << 5) - hash);
  return paletas[Math.abs(hash) % paletas.length];
}

function mensajeErrorConsulta(error: unknown): string {
  if (error instanceof ApiHttpError && error.status === 401) {
    return "La sesión no es válida o ha vencido. Inicie sesión nuevamente para consultar el directorio.";
  }
  if (error instanceof ApiHttpError && error.status === 403) {
    return "Su cuenta no tiene el permiso institucional para consultar el directorio de usuarios.";
  }
  return "No fue posible consultar el directorio institucional. Intente nuevamente.";
}

export default function UsuariosPage() {
  const [mensaje, setMensaje] = useState("");
  const [errorServidor, setErrorServidor] = useState("");
  const [crearAbierto, setCrearAbierto] = useState(false);
  const [detallePendiente, setDetallePendiente] = useState("");

  const {
    usuarios,
    totalUsuarios,
    busqueda,
    setBusqueda,
    area,
    setArea,
    rol,
    setRol,
    estado,
    setEstado,
    usuarioEditando,
    setUsuarioEditando,
    actualizarUsuario,
    crearUsuario,
    restablecerCredenciales,
    asignarRol,
    revocarRol,
    consultarUsuario,
    conmutarEstado,
    isLoading,
    isFetching,
    error,
    guardarPendiente,
    crearPendiente,
    estadoPendiente,
    catalogos,
    paginacion,
    pagina,
    setPagina,
  } = useUsuariosAdmin();

  function limpiarFiltros() {
    setBusqueda("");
    setArea("");
    setRol("");
    setEstado("Todos");
    setPagina(1);
  }

  const hayFiltrosActivos = busqueda !== "" || area !== "" || rol !== "" || estado !== "Todos";

  async function guardar(cambios: UpdateUsuarioDTO) {
    if (!usuarioEditando) throw new Error("Seleccione una cuenta del directorio.");
    setErrorServidor("");
    try {
      await actualizarUsuario(usuarioEditando.id, cambios);
      setUsuarioEditando(null);
      setMensaje("Los cambios fueron registrados correctamente.");
    } catch (err) {
      setMensaje("");
      setErrorServidor(
        "No se pudo guardar la modificación. Revise los campos marcados e intente nuevamente.",
      );
      throw err;
    }
  }

  async function alternarEstado(id: string) {
    setErrorServidor("");
    try {
      await conmutarEstado(id);
      setMensaje("El estado operativo fue actualizado.");
    } catch (err: unknown) {
      setMensaje("");
      const motivo = (err as any)?.response?.data?.message || (err as Error)?.message || "No se pudo conmutar el estado del usuario.";
      setErrorServidor(motivo);
    }
  }

  async function abrirDetalle(id: string) {
    setErrorServidor("");
    setDetallePendiente(id);
    try {
      setUsuarioEditando(await consultarUsuario(id));
    } catch {
      setErrorServidor("No fue posible consultar los datos actualizados de la cuenta.");
    } finally {
      setDetallePendiente("");
    }
  }

  async function registrarUsuario(
    datos: Parameters<typeof crearUsuario>[0],
    rolesSeleccionados: string[] = [],
  ) {
    setErrorServidor("");
    setMensaje("");
    try {
      const creado = await crearUsuario(datos);
      const rolesExitosos: string[] = [];
      const rolesFallidos: string[] = [];

      for (const rolId of rolesSeleccionados) {
        try {
          await asignarRol(creado.id, rolId);
          rolesExitosos.push(rolId);
        } catch (err) {
          console.error(`Error al asignar rol ${rolId} a usuario ${creado.id}:`, err);
          rolesFallidos.push(rolId);
        }
      }

      setCrearAbierto(false);

      if (rolesFallidos.length > 0) {
        setErrorServidor(
          `La cuenta ${creado.nombre} fue registrada (INACTIVA), pero falló la asignación de ${rolesFallidos.length} rol(es). Ingrese a "Administrar usuario" para completar la asignación.`,
        );
      } else if (rolesExitosos.length > 0) {
        setMensaje(
          `La cuenta institucional ${creado.nombre} fue registrada exitosamente con ${rolesExitosos.length} rol(es) asignado(s). La cuenta permanece INACTIVA hasta su autorización.`,
        );
      } else {
        setMensaje(`La cuenta ${creado.nombre} fue registrada correctamente.`);
      }
      return { creado, rolesExitosos, rolesFallidos };
    } catch (cause) {
      setMensaje("");
      setErrorServidor(cause instanceof Error ? cause.message : "No se pudo registrar la cuenta.");
      throw cause;
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900 pb-16">
      <AdminPageHeader
        title="Gestión de Usuarios"
        description="Administración del personal interno que accede al SIGD."
      />

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* Barra superior de acciones y navegación institucional */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-700 border border-blue-200/60">
              IESTP Público «Suiza» · Directorio Oficial
            </span>
            <p className="mt-2 text-sm text-slate-600">
              {error
                ? "No se pudo verificar el total del directorio porque falló la consulta."
                : `Directorio institucional de ${totalUsuarios} cuentas registradas.`}
              {!error && " Búsqueda en tiempo real y filtros por área, rol y estado."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/administracion/roles-permisos"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 hover:text-blue-700"
              title="Ir al módulo independiente de Roles y Permisos"
            >
              <svg
                className="h-4 w-4 text-slate-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
              Roles y Permisos
            </Link>

            <button
              type="button"
              onClick={() => {
                setMensaje("");
                setErrorServidor("");
                setCrearAbierto(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
              </svg>
              + NUEVO USUARIO
            </button>
          </div>
        </div>

        {/* Indicador de consulta en segundo plano */}
        {isFetching && !isLoading && (
          <div
            role="status"
            aria-live="polite"
            className="mb-4 inline-flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-4 py-2 text-xs font-semibold text-blue-700"
          >
            <svg className="h-3.5 w-3.5 animate-spin text-blue-600" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Consultando directorio institucional...
          </div>
        )}

        {/* Mensaje de confirmación */}
        {mensaje && (
          <div
            role="status"
            aria-live="polite"
            className="mb-5 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3.5 text-sm text-emerald-800 shadow-xs"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-200 text-emerald-800 font-bold text-xs">
                ✓
              </span>
              <span>{mensaje}</span>
            </div>
            <button
              type="button"
              onClick={() => setMensaje("")}
              className="text-emerald-600 hover:text-emerald-900 text-lg font-bold"
              aria-label="Cerrar mensaje"
            >
              &times;
            </button>
          </div>
        )}

        {/* Alerta de error de servidor */}
        {errorServidor && (
          <div
            role="alert"
            aria-live="assertive"
            className="mb-5 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-5 py-3.5 text-sm text-red-800 shadow-xs"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-200 text-red-800 font-bold text-xs">
                !
              </span>
              <span>{errorServidor}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorServidor("")}
              className="text-red-600 hover:text-red-900 text-lg font-bold"
              aria-label="Cerrar mensaje de error"
            >
              &times;
            </button>
          </div>
        )}

        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-xs"
          >
            {mensajeErrorConsulta(error)}
          </div>
        )}

        {/* Tarjeta de Filtros de Búsqueda */}
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <svg className="h-4 w-4 text-blue-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filtros del Directorio
            </h3>
            {hayFiltrosActivos && (
              <button
                type="button"
                onClick={limpiarFiltros}
                className="text-xs font-semibold text-blue-700 hover:text-blue-900 hover:underline"
              >
                Limpiar filtros
              </button>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor="busqueda" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">
                Buscar usuario
              </label>
              <div className="relative">
                <input
                  id="busqueda"
                  value={busqueda}
                  onChange={event => setBusqueda(event.target.value)}
                  placeholder="Nombre, DNI o correo"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div>
              <label htmlFor="area" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">
                Unidad orgánica
              </label>
              <select
                id="area"
                value={area}
                onChange={event => setArea(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Todas</option>
                {catalogos.areas.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="rol" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">
                Rol asignado
              </label>
              <select
                id="rol"
                value={rol}
                onChange={event => setRol(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Todos</option>
                {catalogos.roles.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="estado" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">
                Estado
              </label>
              <select
                id="estado"
                value={estado}
                onChange={event => setEstado(event.target.value as EstadoUsuario | "Todos")}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="Todos">Todos</option>
                <option value="Activo">Activo</option>
                <option value="Inactivo">Inactivo</option>
              </select>
            </div>
          </div>
        </section>

        {/* Tabla del Directorio Institucional */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/50 px-6 py-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Usuarios registrados</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                {error
                  ? "Cantidad no disponible por error de consulta."
                  : `${usuarios.length} resultado${usuarios.length === 1 ? "" : "s"}`}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left">
              <thead className="border-b border-slate-200 bg-slate-50/75 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                <tr>
                  <th className="px-6 py-3.5">Usuario</th>
                  <th className="px-6 py-3.5">DNI</th>
                  <th className="px-6 py-3.5">Área</th>
                  <th className="px-6 py-3.5">Cargo</th>
                  <th className="px-6 py-3.5">Rol</th>
                  <th className="px-6 py-3.5">Estado</th>
                  <th className="px-6 py-3.5">Último acceso</th>
                  <th className="px-6 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100" aria-busy={isLoading}>
                {isLoading && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center">
                      <span className="sr-only">Cargando directorio institucional de usuarios...</span>
                      <div className="mx-auto w-full max-w-md space-y-2.5" aria-hidden="true">
                        {[0, 1, 2, 3].map(fila => (
                          <div key={fila} className="h-10 animate-pulse rounded-lg bg-slate-200/80" />
                        ))}
                      </div>
                    </td>
                  </tr>
                )}

                {!isLoading && !error && usuarios.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center">
                      <div className="mx-auto max-w-md rounded-xl bg-blue-50/80 p-6 text-blue-700 border border-blue-100">
                        <svg className="mx-auto h-8 w-8 text-blue-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                        <p className="font-bold text-sm">No se registran usuarios institucionales</p>
                        <p className="mt-1 text-xs text-blue-600">
                          Ajuste los filtros o consulte nuevamente para obtener resultados.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}

                {!isLoading &&
                  usuarios.map(u => {
                    const estilo = estiloEstado(u.estado);
                    const usernameVisual = u.username || (u.correo ? u.correo.split("@")[0] : "usuario");
                    return (
                      <tr key={u.id} className="transition-colors hover:bg-slate-50/80">
                        {/* Columna Usuario con Avatar */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${colorAvatar(
                                u.nombre,
                              )}`}
                              aria-hidden="true"
                            >
                              {obtenerIniciales(u.nombre)}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900">{u.nombre}</p>
                              <p className="text-xs font-mono text-slate-500">
                                @{usernameVisual} · {u.correo}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Columna DNI */}
                        <td className="px-6 py-4">
                          <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                            {u.dni}
                          </span>
                        </td>

                        {/* Columna Área */}
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-slate-800">{u.area || "—"}</p>
                        </td>

                        {/* Columna Cargo */}
                        <td className="px-6 py-4 text-sm text-slate-600">{u.cargo || "—"}</td>

                        {/* Columna Rol */}
                        <td className="px-6 py-4">
                          {(!u.rol || u.roles.filter(r => r.activo !== false).length === 0) ? (
                            <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200/50">
                              Pendiente de rol
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200/50">
                              {u.rol}
                            </span>
                          )}
                        </td>

                        {/* Columna Estado */}
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border ${estilo.badge}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${estilo.dot}`} aria-hidden="true"></span>
                            {u.estado}
                          </span>
                        </td>

                        {/* Columna Último Acceso */}
                        <td className="px-6 py-4 text-xs text-slate-500">
                          {u.ultimoAcceso ? new Date(u.ultimoAcceso).toLocaleString("es-PE") : "—"}
                        </td>

                        {/* Columna Acciones */}
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setMensaje("");
                                void abrirDetalle(u.id);
                              }}
                              disabled={detallePendiente === u.id}
                              className="rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-bold text-blue-700 shadow-2xs transition hover:bg-blue-50 disabled:opacity-50"
                            >
                              {detallePendiente === u.id ? "Consultando…" : "Administrar"}
                            </button>
                            <button
                              type="button"
                              onClick={() => void alternarEstado(u.id)}
                              disabled={guardarPendiente || estadoPendiente}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-2xs transition hover:bg-slate-100 disabled:opacity-50"
                              title="Alternar entre Activo e Inactivo"
                            >
                              Conmutar estado
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Paginación */}
        {paginacion && (
          <nav
            aria-label="Paginación de usuarios"
            className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-sm text-slate-700"
          >
            <div className="text-xs text-slate-500">
              Mostrando página <span className="font-bold text-slate-700">{pagina}</span> de{" "}
              <span className="font-bold text-slate-700">{Math.max(1, paginacion.totalPaginas)}</span> (
              {paginacion.total} registros en total)
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isFetching || pagina <= 1}
                onClick={() => setPagina(pagina - 1)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold shadow-xs transition hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={isFetching || pagina >= paginacion.totalPaginas}
                onClick={() => setPagina(pagina + 1)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold shadow-xs transition hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white"
              >
                Siguiente
              </button>
            </div>
          </nav>
        )}
      </section>

      {/* Modal de edición */}
      {usuarioEditando && (
        <UserEditModal
          usuario={usuarioEditando}
          areas={catalogos.areas}
          cargos={catalogos.cargos}
          roles={catalogos.roles}
          onClose={() => {
            setMensaje("");
            setUsuarioEditando(null);
          }}
          onSave={guardar}
          onResetPassword={password => restablecerCredenciales(usuarioEditando.id, password)}
          onAsignarRol={async rolId => {
            if (!usuarioEditando) return;
            const act = await asignarRol(usuarioEditando.id, rolId);
            setUsuarioEditando(act);
            setMensaje("Rol institucional asignado exitosamente.");
          }}
          onRevocarRol={async usuarioRolId => {
            if (!usuarioEditando) return;
            const act = await revocarRol(usuarioEditando.id, usuarioRolId);
            setUsuarioEditando(act);
            setMensaje("Asignación de rol revocada exitosamente.");
          }}
          onServerError={(err: ApiHttpError) => {
            if (err?.correlationId) {
              setErrorServidor(
                `Operación rechazada por el servidor. Código de correlación: ${err.correlationId}.`,
              );
            }
          }}
        />
      )}

      {/* Modal de nuevo usuario institucional */}
      {crearAbierto && (
        <CrearUsuarioModal
          areas={catalogos.areas}
          cargos={catalogos.cargos}
          roles={catalogos.roles}
          tiposDocumento={catalogos.tiposDocumento}
          pending={crearPendiente}
          onClose={() => setCrearAbierto(false)}
          onSave={registrarUsuario}
        />
      )}
    </main>
  );
}
