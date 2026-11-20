import { useState } from "react";

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
    crearRol,
    editarRol,
    cambiarVigenciaRol,
    mensaje,
    setMensaje,
    isLoading,
    isError,
    isLoaded,
    canEdit,
    recargar,
  } = useRbacConfig();

  const [modoModal, setModoModal] = useState<"crear" | "editar" | null>(null);
  const [codigoRol, setCodigoRol] = useState("");
  const [nombreRol, setNombreRol] = useState("");
  const [descripcionRol, setDescripcionRol] = useState("");
  const [guardandoRol, setGuardandoRol] = useState(false);

  function abrirCrearRol() {
    setCodigoRol("");
    setNombreRol("");
    setDescripcionRol("");
    setModoModal("crear");
  }

  function abrirEditarRol() {
    setCodigoRol(rolActual.id);
    setNombreRol(rolActual.nombre);
    setDescripcionRol(rolActual.descripcion);
    setModoModal("editar");
  }

  async function guardarModalRol() {
    if (!nombreRol.trim()) return;
    setGuardandoRol(true);
    const ok = modoModal === "crear"
      ? await crearRol({ codigo: codigoRol, nombre: nombreRol, descripcion: descripcionRol })
      : await editarRol(rolActual.id, { nombre: nombreRol, descripcion: descripcionRol });
    setGuardandoRol(false);
    if (ok) setModoModal(null);
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <AdminPageHeader
        title="Roles y Permisos"
        description="Control de acceso por rol, acción y alcance institucional (RBAC)."
      />

      <section className="mx-auto max-w-7xl px-6 py-8">
        {isLoading && <p role="status" className="mb-4 rounded-lg bg-white p-4">Cargando roles y permisos desde el servidor…</p>}
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold">Roles del sistema</h2>
              {canEdit && isLoaded && (
                <button
                  type="button"
                  onClick={abrirCrearRol}
                  className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800"
                >
                  + Nuevo rol
                </button>
              )}
            </div>

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
                    <div className="flex items-center gap-1.5">
                      {rol.vigente === false && (
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                          Inactivo
                        </span>
                      )}
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                        {rol.usuarios ?? "—"}
                      </span>
                    </div>
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
                    Rol seleccionado · {rolActual.id}
                  </p>
                  <h2 className="mt-1 text-2xl font-bold">{rolActual.nombre}</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    {rolActual.descripcion}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm">
                    <span className="font-semibold">Alcance:</span>{" "}
                    {rolActual.alcance}
                  </div>
                  {canEdit && isLoaded && (
                    <div className="flex flex-wrap gap-2">
                      {rolActual.id !== "DOCENTE" && (
                        <button
                          type="button"
                          onClick={abrirEditarRol}
                          className="rounded-lg border border-blue-300 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                        >
                          Editar rol
                        </button>
                      )}
                      {rolActual.id !== "SUPER_ADMIN" && rolActual.id !== "DOCENTE" && (
                        <button
                          type="button"
                          onClick={() => void cambiarVigenciaRol(rolActual.id, rolActual.vigente === false)}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          {rolActual.vigente === false ? "Activar rol" : "Desactivar rol"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {mensaje && (
              <div role={isError ? "alert" : "status"} className={`rounded-lg px-4 py-3 text-sm ${isError ? "border border-red-200 bg-red-50 text-red-700" : "border border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                {mensaje}
                {isError && <button type="button" onClick={() => void recargar()} className="ml-3 font-semibold underline">Reintentar</button>}
              </div>
            )}

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-6 py-4">
                <h3 className="font-bold">Matriz de permisos</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Los controles corresponden a permisos canónicos aplicados por
                  el backend. Las demás acciones quedan bloqueadas.
                </p>
              </div>

              <RolePermissionMatrix
                permisos={permisosRolActual}
                onAlternar={alternarPermiso}
                readOnly={!canEdit || !isLoaded || rolActual.vigente === false}
              />

              {canEdit && isLoaded ? (
                <div className="flex justify-end p-5">
                  <button
                    type="button"
                    onClick={() => void guardarPermisos()}
                    disabled={isLoading || !isLoaded || rolActual.vigente === false}
                    className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
                  >
                    Guardar permisos
                  </button>
                </div>
              ) : (
                <p className="border-t border-slate-200 px-6 py-4 text-sm text-slate-600">
                  {!isLoaded
                    ? "La matriz solo se puede modificar después de cargar los permisos vigentes del servidor."
                    : "Vista de solo lectura. Solo SUPER_ADMIN puede guardar cambios en roles."}
                </p>
              )}
            </section>
          </div>
        </div>
      </section>

      {modoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-label={modoModal === "crear" ? "Crear nuevo rol" : "Editar rol"}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-xl font-bold">{modoModal === "crear" ? "Crear rol institucional" : "Editar rol"}</h3>
            <div className="mt-4 space-y-4">
              {modoModal === "crear" && (
                <div>
                  <label htmlFor="rol-codigo" className="mb-1 block text-sm font-semibold">Código (mayúsculas y guion bajo)</label>
                  <input
                    id="rol-codigo"
                    value={codigoRol}
                    onChange={(event) => setCodigoRol(event.target.value.toUpperCase())}
                    placeholder="Ej. AUDITOR_INTERNO"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              )}
              <div>
                <label htmlFor="rol-nombre" className="mb-1 block text-sm font-semibold">Nombre del rol</label>
                <input
                  id="rol-nombre"
                  value={nombreRol}
                  onChange={(event) => setNombreRol(event.target.value)}
                  placeholder="Ej. Auditor Interno"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="rol-descripcion" className="mb-1 block text-sm font-semibold">Descripción</label>
                <textarea
                  id="rol-descripcion"
                  rows={3}
                  value={descripcionRol}
                  onChange={(event) => setDescripcionRol(event.target.value)}
                  placeholder="Responsabilidades y alcance del rol"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setModoModal(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-100">
                Cancelar
              </button>
              <button
                type="button"
                disabled={guardandoRol || !nombreRol.trim() || (modoModal === "crear" && !/^[A-Z][A-Z0-9_]{1,29}$/.test(codigoRol.trim()))}
                onClick={() => void guardarModalRol()}
                className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
              >
                {guardandoRol ? "Guardando..." : "Guardar rol"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
