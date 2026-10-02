import AdminPageHeader from "../../components/administracion/AdminPageHeader";
import UserEditModal from "../../components/administracion/UserEditModal";
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
    estado,
    setEstado,
    usuarioEditando,
    setUsuarioEditando,
    actualizarUsuario,
    conmutarEstado,
    mensaje,
    setMensaje,
  } = useUsuariosAdmin();

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
          <span className="rounded-lg bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-700">
            Datos de demostración hasta integrar GET /api/v1/usuarios
          </span>
        </div>

        {mensaje && (
          <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {mensaje}
          </div>
        )}

        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
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

              <tbody className="divide-y divide-slate-100">
                {usuarios.map((usuario) => (
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
                            setUsuarioEditando({ ...usuario });
                          }}
                          className="rounded-lg border border-blue-300 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                        >
                          Administrar
                        </button>
                        <button
                          type="button"
                          onClick={() => conmutarEstado(usuario.id)}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
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
          onSave={actualizarUsuario}
        />
      )}
    </main>
  );
}