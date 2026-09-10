import { useMemo } from "react";

import AdminPageHeader from "../../components/administracion/AdminPageHeader";
import RolePermissionMatrix from "../../components/administracion/RolePermissionMatrix";
import useRbacConfig from "../../hooks/useRbacConfig";

export default function RolesPermisosPage() {
  const {
    roles,
    permisos,
    selectedRole,
    selectedRoleId,
    loading,
    saving,
    saved,
    hasUnsavedChanges,
    error,
    selectRole,
    updatePermiso,
    savePermisos,
    discardChanges,
  } = useRbacConfig();

  const esSuperAdmin = selectedRoleId === "SUPER_ADMIN";

  const mensajes = useMemo(() => {
    const array: Array<{ tipo: string; texto: string }> = [];
    if (error) {
      array.push({ tipo: "error", texto: error });
    }
    if (saved) {
      array.push({ tipo: "exito", texto: "Permisos guardados correctamente." });
    }
    if (hasUnsavedChanges && !saved) {
      array.push({ tipo: "advertencia", texto: "Tienes cambios sin guardar." });
    }
    if (saving) {
      array.push({ tipo: "info", texto: "Guardando permisos..." });
    }
    return array;
  }, [error, saved, hasUnsavedChanges, saving]);

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <AdminPageHeader
        title="Roles y Permisos"
        description="Control de acceso por rol, acción y alcance institucional."
      />

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-4 text-lg font-bold">Roles del sistema</h2>

            <div className="space-y-3">
              {loading ? (
                <p className="text-sm text-slate-500">Cargando roles...</p>
              ) : (
                roles.map((rol) => (
                  <button
                    key={rol.id}
                    type="button"
                    onClick={() => {
                      selectRole(rol.id);
                    }}
                    className={`w-full rounded-xl border p-4 text-left transition ${
                      selectedRoleId === rol.id
                        ? "border-blue-600 bg-blue-50"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-bold">{rol.nombre}</p>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                        {rol.permisos.length}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      {rol.descripcion}
                    </p>
                  </button>
                ))
              )}
            </div>
          </aside>

          <div className="space-y-6">
            {/* Información del rol seleccionado */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase text-blue-700">
                    Rol seleccionado
                  </p>
                  {selectedRole ? (
                    <>
                      <h2 className="mt-1 text-2xl font-bold">{selectedRole.nombre}</h2>
                      <p className="mt-2 text-sm text-slate-600">{selectedRole.descripcion}</p>
                    </>
                  ) : (
                    <p className="text-sm text-slate-500">
                      Selecciona un rol para ver sus permisos.
                    </p>
                  )}
                </div>
                {selectedRole ? (
                  <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm">
                    <span className="font-semibold">Alcance:</span> {selectedRole.alcance}
                  </div>
                ) : null}
              </div>
            </div>

            {/* Mensajes de estado */}
            {mensajes.map((mensaje, indice) => (
              <div
                key={indice}
                className={`rounded-lg border px-4 py-3 text-sm ${getEstiloMensaje(mensaje.tipo)}`}
              >
                {mensaje.texto}
              </div>
            ))}

            {/* Matriz de permisos */}
            <RolePermissionMatrix
              permisos={permisos}
              onTogglePermiso={updatePermiso}
              esSuperAdmin={esSuperAdmin}
              loading={loading}
            />

            {/* Botones de acción */}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={discardChanges}
                disabled={!hasUnsavedChanges}
                className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-40"
              >
                Descartar cambios
              </button>
              <button
                type="button"
                onClick={() => void savePermisos()}
                disabled={!hasUnsavedChanges || saving || esSuperAdmin}
                className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-40"
              >
                {saving ? "Guardando..." : "Guardar permisos"}
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function getEstiloMensaje(
  tipo: string,
): string {
  switch (tipo) {
    case "exito":
      return "rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700";
    case "error":
      return "rounded-lg border border-red-200 bg-red-50 text-red-700";
    case "advertencia":
      return "rounded-lg border border-amber-200 bg-amber-50 text-amber-700";
    case "info":
      return "rounded-lg border border-blue-200 bg-blue-50 text-blue-700";
    default:
      return "rounded-lg border border-slate-200 bg-slate-50 text-slate-700";
  }
}