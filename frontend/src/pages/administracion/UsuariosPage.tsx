import AdminPageHeader from "../../components/administracion/AdminPageHeader";
import {
  CATALOGO_AREAS,
  CATALOGO_ROLES_USUARIOS,
  CATALOGO_SEDES,
  useUsuariosAdmin,
} from "../../hooks/useUsuariosAdmin";
import type { EstadoUsuario } from "../../types/usuarioAdmin";

function estiloEstado(estado: EstadoUsuario) {
  if (estado === "Activo") return "bg-emerald-100 text-emerald-700";
  if (estado === "Bloqueado") return "bg-red-100 text-red-700";
  return "bg-slate-200 text-slate-700";
}

export default function UsuariosPage() {
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
    isLoading,
    isFetching,
    error,
  } = useUsuariosAdmin();

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <AdminPageHeader
        title="Directorio de Usuarios (Solo Lectura)"
        description="Consulta oficial del directorio institucional de cuentas, unidades orgánicas, cargos y roles."
      />

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm text-slate-600">
              Directorio institucional de {totalUsuarios} cuentas registradas.
              Búsqueda en tiempo real y filtro por estado operativo (Solo lectura).
            </p>
            <p className="mt-1 text-xs text-slate-500">
              La creación y modificación de usuarios institucionales se gestiona exclusivamente a través de los procedimientos administrativos y control de personal.
            </p>
          </div>
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
              <label htmlFor="sede" className="mb-2 block text-sm font-semibold text-slate-500">
                Sede (No filtrable)
              </label>
              <select
                id="sede"
                value={sede}
                onChange={(event) => setSede(event.target.value)}
                disabled
                title="El directorio institucional no aplica filtro por sede"
                className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-500 cursor-not-allowed"
              >
                <option value="">Todas las sedes</option>
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
            <table className="w-full min-w-[1000px] text-left">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-6 py-3">Usuario</th>
                  <th className="px-6 py-3">DNI</th>
                  <th className="px-6 py-3">Área</th>
                  <th className="px-6 py-3">Cargo</th>
                  <th className="px-6 py-3">Rol</th>
                  <th className="px-6 py-3">Estado</th>
                  <th className="px-6 py-3">Último acceso</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100" aria-busy={isLoading}>
                {isLoading && (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center">
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
                    <td colSpan={7} className="px-6 py-10 text-center">
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
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}
