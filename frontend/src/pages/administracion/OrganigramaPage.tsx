import { useCallback, useEffect, useState } from "react";

import AdminPageHeader from "../../components/administracion/AdminPageHeader";
import OrganigramaTreeView from "../../components/administracion/OrganigramaTreeView";
import { apiClient } from "../../api/client";
import { PERMISOS, tienePermiso } from "../../auth/permissions";
import { useAuthStore } from "../../stores/authStore";
import type { ApiHttpError } from "../../types/api";
import type { AreaOrganica } from "../../types/tablasMaestras";

interface NodoAreaApi {
  id: string;
  codigo: string;
  nombre: string;
  padreId?: string | null;
  path: string;
  vigente: boolean;
  children?: NodoAreaApi[];
}

function aAreas(nodos: NodoAreaApi[]): AreaOrganica[] {
  return nodos.flatMap((nodo) => [
    {
      id: nodo.id,
      codigo: nodo.codigo,
      nombre: nodo.nombre,
      ruta: nodo.path,
      padreId: nodo.padreId ?? null,
      detalle: "Unidad orgánica institucional",
      estado: nodo.vigente ? "Activo" as const : "Inactivo" as const,
    },
    ...aAreas(nodo.children ?? []),
  ]);
}

export default function OrganigramaPage() {
  const permisos = useAuthStore((state) => state.usuario?.permisos);
  const puedeGestionar = tienePermiso(permisos, PERMISOS.ORGANIGRAMA_GESTIONAR);

  const [areas, setAreas] = useState<AreaOrganica[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [padreId, setPadreId] = useState("");

  const cargar = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get<NodoAreaApi[]>("/api/v1/admin/organigrama");
      setAreas(aAreas(data));
    } catch {
      setError("No se pudo cargar el organigrama con los permisos actuales.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let activo = true;

    apiClient.get<NodoAreaApi[]>("/api/v1/admin/organigrama")
      .then(({ data }) => {
        if (activo) setAreas(aAreas(data));
      })
      .catch(() => {
        if (activo) setError("No se pudo cargar el organigrama con los permisos actuales.");
      })
      .finally(() => {
        if (activo) setIsLoading(false);
      });

    return () => {
      activo = false;
    };
  }, []);

  function cancelar() {
    setMostrarFormulario(false);
    setEditandoId(null);
    setCodigo("");
    setNombre("");
    setPadreId("");
  }

  function iniciarEdicion(area: AreaOrganica) {
    setEditandoId(area.id);
    setCodigo(area.codigo);
    setNombre(area.nombre);
    setPadreId(area.padreId ?? "");
    setMostrarFormulario(true);
    setMensaje("");
    setError(null);
  }

  async function guardarUnidad() {
    if (!nombre.trim() || (!editandoId && !codigo.trim())) {
      setError("Complete el código y nombre de la unidad orgánica.");
      return;
    }
    setIsSaving(true);
    setError(null);
    setMensaje("");
    try {
      if (editandoId) {
        await apiClient.put(`/api/v1/admin/organigrama/areas/${editandoId}`, {
          nombre: nombre.trim(),
          padreId: padreId || null,
        });
        setMensaje("Unidad orgánica actualizada correctamente.");
      } else {
        await apiClient.post("/api/v1/admin/organigrama/areas", {
          codigo: codigo.trim().toUpperCase(),
          nombre: nombre.trim(),
          padreId: padreId || null,
        });
        setMensaje("Unidad orgánica creada correctamente.");
      }
      cancelar();
      await cargar();
    } catch (causa) {
      const http = causa as ApiHttpError | undefined;
      setError(http?.problemDetails?.detail || (causa instanceof Error ? causa.message : "No se pudo guardar la unidad orgánica."));
    } finally {
      setIsSaving(false);
    }
  }

  async function cambiarVigencia(area: AreaOrganica) {
    setIsSaving(true);
    setError(null);
    setMensaje("");
    try {
      const vigente = area.estado !== "Activo";
      await apiClient.put(`/api/v1/admin/organigrama/areas/${area.id}`, { vigente });
      setMensaje(`Unidad ${area.codigo} ${vigente ? "activada" : "inactivada"} correctamente.`);
      await cargar();
    } catch (causa) {
      const http = causa as ApiHttpError | undefined;
      setError(http?.problemDetails?.detail || (causa instanceof Error ? causa.message : "No se pudo cambiar el estado de la unidad."));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <AdminPageHeader
        title="Organigrama institucional"
        description="Consulta y administración de la estructura orgánica y sus dependencias vigentes."
      />
      <section className="mx-auto max-w-7xl px-6 py-8">
        {mensaje && (
          <div role="status" className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            {mensaje}
          </div>
        )}
        {isLoading && <p role="status" className="mb-5 rounded-lg bg-white p-4">Cargando organigrama…</p>}
        {error && (
          <div role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
            <button type="button" onClick={() => void cargar()} className="ml-3 font-semibold underline">Reintentar</button>
          </div>
        )}

        {puedeGestionar && (
          <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold">Gestión de unidades orgánicas</h2>
                <p className="text-xs text-slate-500">Cree o reorganice dependencias preservando la jerarquía ltree.</p>
              </div>
              <button
                type="button"
                onClick={() => (mostrarFormulario ? cancelar() : setMostrarFormulario(true))}
                className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
              >
                {mostrarFormulario ? "Cancelar" : "+ Nueva unidad orgánica"}
              </button>
            </div>

            {mostrarFormulario && (
              <div className="mt-4 grid gap-4 border-t border-slate-200 pt-4 md:grid-cols-3">
                <div>
                  <label htmlFor="org-codigo" className="mb-1 block text-sm font-semibold">Código</label>
                  <input
                    id="org-codigo"
                    value={codigo}
                    disabled={Boolean(editandoId)}
                    onChange={(event) => setCodigo(event.target.value.toUpperCase())}
                    placeholder="Ej. OFIC_TI"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label htmlFor="org-nombre" className="mb-1 block text-sm font-semibold">Nombre</label>
                  <input
                    id="org-nombre"
                    value={nombre}
                    onChange={(event) => setNombre(event.target.value)}
                    placeholder="Oficina de Tecnologías"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="org-padre" className="mb-1 block text-sm font-semibold">Depende de</label>
                  <select
                    id="org-padre"
                    value={padreId}
                    onChange={(event) => setPadreId(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">Nivel raíz</option>
                    {areas.filter((a) => a.id !== editandoId && a.estado === "Activo").map((a) => (
                      <option key={a.id} value={a.id}>{a.codigo} — {a.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end gap-2 md:col-span-3">
                  <button type="button" onClick={cancelar} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => void guardarUnidad()}
                    className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
                  >
                    {editandoId ? "Guardar cambios" : "Crear unidad"}
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {!isLoading && !error && areas.length === 0 && (
          <p className="rounded-lg bg-white p-6 text-sm text-slate-600">No hay unidades orgánicas disponibles.</p>
        )}
        {!isLoading && areas.length > 0 && (
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <OrganigramaTreeView areas={areas} />
            </div>
            {puedeGestionar && (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-6 py-4">
                  <h2 className="font-bold">Listado de unidades</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-6 py-3">Código</th>
                        <th className="px-6 py-3">Nombre</th>
                        <th className="px-6 py-3">Ruta jerárquica</th>
                        <th className="px-6 py-3">Estado</th>
                        <th className="px-6 py-3">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {areas.map((area) => (
                        <tr key={area.id}>
                          <td className="px-6 py-3 text-sm font-semibold">{area.codigo}</td>
                          <td className="px-6 py-3 text-sm">{area.nombre}</td>
                          <td className="px-6 py-3 font-mono text-xs text-slate-600">{area.ruta}</td>
                          <td className="px-6 py-3 text-xs font-semibold">{area.estado}</td>
                          <td className="px-6 py-3">
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => iniciarEdicion(area)}
                              className="mr-2 rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => void cambiarVigencia(area)}
                              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-100"
                            >
                              {area.estado === "Activo" ? "Inactivar" : "Activar"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
