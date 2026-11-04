import { useState } from "react";

import AdminPageHeader from "../../components/administracion/AdminPageHeader";
import RolePermissionMatrix from "../../components/administracion/RolePermissionMatrix";
import { useRbacConfig } from "../../hooks/useRbacConfig";
import { apiClient } from "../../api/client";

export default function RolesPermisosPage() {
  const [mensajeServidor, setMensajeServidor] = useState<{
    texto: string;
    tipo: "exito" | "error";
  } | null>(null);

  const {
    roles,
    rolSeleccionado,
    setRolSeleccionado,
    rolActual,
    permisos,
    permisosRolActual,
    alternarPermiso,
    mensaje,
    setMensaje,
  } = useRbacConfig();

  const guardarEnServidor = async () => {
    setMensaje("");
    setMensajeServidor(null);

    try {
      // Convierte la matriz completa al contrato del backend:
      // { roles: [{ codigo, permisos: string[] }] } con solo los permisos activos (true).
      const payload = {
        roles: Object.entries(permisos).map(([codigo, filas]) => ({
          codigo,
          permisos: filas.flatMap((fila) =>
            Object.entries(fila)
              .filter(([clave, activo]) => activo && clave !== "modulo")
              .map(([clave]) => clave),
          ),
        })),
      };

      await apiClient.put("/api/v1/admin/roles-permisos", payload);
      setMensajeServidor({
        texto:
          "Matriz de permisos RBAC actualizada correctamente en el servidor.",
        tipo: "exito",
      });
    } catch (error: unknown) {
      const detalle = error instanceof Error ? error.message : "Error desconocido";
      setMensajeServidor({
        texto: `Error al guardar los cambios: ${detalle}`,
        tipo: "error",
      });
    }
  };

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

            {mensajeServidor && (
              <div
                className={`rounded-lg border px-4 py-3 text-sm ${
                  mensajeServidor.tipo === "exito"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-rose-200 bg-rose-50 text-rose-700"
                }`}
              >
                {mensajeServidor.texto}
              </div>
            )}

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-6 py-4">
                <h3 className="font-bold">Matriz de permisos</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Los cambios se envían al endpoint
                  <code className="text-blue-600">PUT /api/v1/admin/roles-permisos</code>
                  y se persisten en la base de datos.
                </p>
              </div>

              <RolePermissionMatrix
                permisos={permisosRolActual}
                onAlternar={alternarPermiso}
              />

              <div className="flex justify-end p-5">
                <button
                  type="button"
                  onClick={guardarEnServidor}
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
