import { useState } from "react";

import AdminPageHeader from "../../components/administracion/AdminPageHeader";
import UserEditModal from "../../components/administracion/UserEditModal";
import {
  CATALOGO_AREAS,
  CATALOGO_ROLES_USUARIOS,
  CATALOGO_SEDES,
  useUsuariosAdmin,
} from "../../hooks/useUsuariosAdmin";
import type { ApiHttpError } from "../../types/api";
import type { EstadoUsuario } from "../../types/usuarioAdmin";

function estiloEstado(estado: EstadoUsuario) {
  if (estado === "Activo") return "bg-emerald-100 text-emerald-700";
  if (estado === "Bloqueado") return "bg-red-100 text-red-700";
  return "bg-slate-200 text-slate-700";
}

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

  async function guardar(usuarioActualizado: Parameters<typeof actualizarUsuario>[0]) {
    setErrorServidor("");
    try {
      await actualizarUsuario(usuarioActualizado);
      setUsuarioEditando(null);
      setMensaje("Los cambios fueron registrados correctamente.");
    } catch (error) {
      // El error se propaga para que el modal mapee los `invalidParams` de
      // RFC 7807 al campo infractor; aquí solo se informa el fallo global.
      setMensaje("");
      setErrorServidor(
        "No se pudo guardar la modificación. Revise los campos marcados e intente nuevamente.",
      );
      throw error;
    }
  }

  async function alternarEstado(id: number) {
    setErrorServidor("");
    try {
      await conmutarEstado(id);
      setMensaje("El estado operativo fue actualizado.");
    } catch {
      setMensaje("");
      setErrorServidor("No se pudo conmutar el estado del usuario.");
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <AdminPageHeader
        title="Gestión de Usuarios"
        description="Administración de cuentas, áreas, cargos, roles y estados."
      />

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <p className="text-sm text-slate-600">
            Directorio institucional de {totalUsuarios} cuentas registradas.
            Búsqueda en tiempo real y filtro por estado operativo.
          </p>
          {isFetching && !isLoading && (
            <span
              role="status"
              aria-live="polite"
              className="rounded-lg bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-700"
            >
              Consultando directorio institucional...
            </span>
          )}
        </div>

        {mensaje && (
          <div
            role="status"
            aria-live="polite"
            className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
          >
            {mensaje}
          </div>
        )}

        {errorServidor && (
          <div
            role="alert"
            aria-live="assertive"
            className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {errorServidor}
          </div>
        )}

        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            No fue posible consultar el directorio institucional. Intente nuevamente.
          </div>
        )}

        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <div>
              <label htmlFor="busqueda" className="mb-2 block text-sm font-semibold">
                Buscar usuario
              </label>
              <input
                id="busqueda"
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                placeholder="Nombre, DNI, correo o área"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label htmlFor="area" className="mb-2 block text-sm font-semibold">
                Unidad orgánica
              </label>
              <select
                id="area"
                value={area}
                onChange={(event) => setArea(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              >
                <option value="">Todas</option>
                {CATALOGO_AREAS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="sede" className="mb-2 block text-sm font-semibold">
                Sede
              </label>
              <select
                id="sede"
                value={sede}
                onChange={(event) => setSede(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              >
                <option value="">Todas</option>
                {CATALOGO_SEDES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="rol" className="mb-2 block text-sm font-semibold">
                Rol asignado
              </label>
              <select
                id="rol"
                value={rol}
                onChange={(event) => setRol(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              >
                <option value="">Todos</option>
                {CATALOGO_ROLES_USUARIOS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="estado" className="mb-2 block text-sm font-semibold">
                Estado
              </label>
              <select
                id="estado"
                value={estado}
                onChange={(event) =>
                  setEstado(event.target.value as EstadoUsuario | "Todos")
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              >
                <option value="Todos">Todos</option>
                <option value="Activo">Activo</option>
                <option value="Inactivo">Inactivo</option>
                <option value="Bloqueado">Bloqueado</option>
              </select>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h3 className="font-bold">Usuarios registrados</h3>
            <p className="mt-1 text-xs text-slate-500">
              {usuarios.length} resultado
              {usuarios.length === 1 ? "" : "s"}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-left">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-6 py-3">Usuario</th>
                  <th className="px-6 py-3">DNI</th>
                  <th className="px-6 py-3">Área</th>
                  <th className="px-6 py-3">Cargo</th>
                  <th className="px-6 py-3">Rol</th>
                  <th className="px-6 py-3">Estado</th>
                  <th className="px-6 py-3">Último acceso</th>
                  <th className="px-6 py-3">Acciones</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100" aria-busy={isLoading}>
                {isLoading && (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center">
                      <span className="sr-only">
                        Cargando directorio institucional de usuarios...
                      </span>
                      <div className="mx-auto w-full max-w-md space-y-2" aria-hidden="true">
                        {[0, 1, 2].map((fila) => (
                          <div
                            key={fila}
                            className="h-10 animate-pulse rounded-lg bg-slate-200"
                          />
                        ))}
                      </div>
                    </td>
                  </tr>
                )}

                {!isLoading && usuarios.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center">
                      <div className="rounded-lg bg-blue-50 px-6 py-8 text-blue-600">
                        <p className="font-semibold">
                          No se registran usuarios institucionales
                        </p>
                        <p className="mt-1 text-sm">
                          Ajuste los filtros o consulte nuevamente para obtener
                          resultados.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}

                {!isLoading &&
                  usuarios.map((usuario) => (
                    <tr key={usuario.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <p className="text-sm font-semibold">{usuario.nombre}</p>
                        <p className="text-xs text-slate-500">{usuario.correo}</p>
                      </td>
                      <td className="px-6 py-4 text-sm">{usuario.dni}</td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium">{usuario.area}</p>
                        <p className="text-xs text-slate-500">{usuario.sede}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {usuario.cargo}
                      </td>
                      <td className="px-6 py-4 text-sm">{usuario.rol}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${estiloEstado(
                            usuario.estado,
                          )}`}
                        >
                          {usuario.estado}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {usuario.ultimoAcceso}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setMensaje("");
                              setErrorServidor("");
                              setUsuarioEditando({ ...usuario });
                            }}
                            className="rounded-lg border border-blue-300 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                          >
                            Administrar
                          </button>
                          <button
                            type="button"
                            onClick={() => void alternarEstado(usuario.id)}
                            disabled={guardarPendiente}
                            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-60"
                            title="Conmutar estado (Activo → Inactivo → Bloqueado)"
                          >
                            Conmutar estado
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>

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
    </main>
  );
}
