import AdminPageHeader from "../../components/administracion/AdminPageHeader";
import RolePermissionMatrix from "../../components/administracion/RolePermissionMatrix";
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

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <AdminPageHeader
        title="Roles y Permisos"
        description="Control de acceso por rol, acción y alcance institucional (RBAC)."
      />

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-4 text-lg font-bold">Roles del sistema</h2>

            <div className="space-y-3">
              {roles.map((rol) => (
                <button
                  key={rol.id}
                  type="button"
                  onClick={() => {
                    setRolSeleccionado(rol.id);
                    setMensaje("");
                  }}
                  className={`w-full rounded-xl border p-4 text-left transition ${
                    rolSeleccionado === rol.id
                      ? "border-blue-600 bg-blue-50"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-bold">{rol.nombre}</p>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                      {rol.usuarios}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    {rol.descripcion}
                  </p>
                </button>
              ))}
            </div>
          </aside>

          <div className="space-y-6">
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase text-blue-700">
                    Rol seleccionado
                  </p>
                  <h2 className="mt-1 text-2xl font-bold">{rolActual.nombre}</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    {rolActual.descripcion}
                  </p>
                </div>

                <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm">
                  <span className="font-semibold">Alcance:</span>{" "}
                  {rolActual.alcance}
                </div>
              </div>
            </section>

            {mensaje && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {mensaje}
              </div>
            )}

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-6 py-4">
                <h3 className="font-bold">Matriz de permisos</h3>
                <p className="mt-1 text-xs text-slate-500">
                  La validación definitiva deberá aplicarse también en backend y
                  base de datos (payload PUT /api/v1/roles/:id/permisos).
                </p>
              </div>

              <RolePermissionMatrix
                permisos={permisosRolActual}
                onAlternar={alternarPermiso}
              />

              <div className="flex justify-end p-5">
                <button
                  type="button"
                  onClick={guardarPermisos}
                  className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
                >
                  Guardar permisos
                </button>
              </div>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}