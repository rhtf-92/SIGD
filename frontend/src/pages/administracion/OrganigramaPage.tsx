import { useCallback, useEffect, useState } from "react";

import AdminPageHeader from "../../components/administracion/AdminPageHeader";
import OrganigramaTreeView from "../../components/administracion/OrganigramaTreeView";
import { apiClient } from "../../api/client";
import type { AreaOrganica } from "../../types/tablasMaestras";

interface NodoAreaApi {
  id: string;
  codigo: string;
  nombre: string;
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
      detalle: "Unidad orgánica institucional",
      estado: nodo.vigente ? "Activo" as const : "Inactivo" as const,
    },
    ...aAreas(nodo.children ?? []),
  ]);
}

export default function OrganigramaPage() {
  const [areas, setAreas] = useState<AreaOrganica[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <AdminPageHeader
        title="Organigrama institucional"
        description="Consulta la estructura orgánica y sus dependencias vigentes."
      />
      <section className="mx-auto max-w-7xl px-6 py-8">
        {isLoading && <p role="status" className="rounded-lg bg-white p-4">Cargando organigrama…</p>}
        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
            <button type="button" onClick={() => void cargar()} className="ml-3 font-semibold underline">Reintentar</button>
          </div>
        )}
        {!isLoading && !error && areas.length === 0 && (
          <p className="rounded-lg bg-white p-6 text-sm text-slate-600">No hay unidades orgánicas disponibles.</p>
        )}
        {!isLoading && !error && areas.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <OrganigramaTreeView areas={areas} />
          </div>
        )}
      </section>
    </main>
  );
}
