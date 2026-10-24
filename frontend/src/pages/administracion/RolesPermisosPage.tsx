import { useEffect, useState } from "react";

import AdminPageHeader from "../../components/administracion/AdminPageHeader";
import { apiClient } from "../../api/client";

interface RolPersistido {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  permisos: string[];
}

export default function RolesPermisosPage() {
  const [roles, setRoles] = useState<RolPersistido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    apiClient.get<{ roles: RolPersistido[] }>("/api/v1/admin/roles-permisos", { signal: controller.signal })
      .then(({ data }) => {
        if (!Array.isArray(data.roles)) throw new Error("Respuesta de roles inválida.");
        setRoles(data.roles);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "No se pudieron consultar los roles.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setCargando(false);
      });
    return () => controller.abort();
  }, []);

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <AdminPageHeader title="Roles y permisos" description="Consulta de los roles y permisos registrados en PostgreSQL." />
      <section className="mx-auto max-w-5xl space-y-4 px-6 py-8">
        {cargando && <p role="status">Cargando roles…</p>}
        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error}</p>}
        {!cargando && !error && roles.length === 0 && <p>No hay roles registrados.</p>}
        {!cargando && !error && roles.map((rol) => (
          <article key={rol.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold">{rol.nombre} <span className="text-sm font-normal text-slate-500">({rol.codigo})</span></h2>
            {rol.descripcion && <p className="mt-1 text-sm text-slate-600">{rol.descripcion}</p>}
            <p className="mt-3 text-sm">
              {rol.permisos.length > 0
                ? `Permisos asignados: ${rol.permisos.join(", ")}`
                : "Sin permisos asignados en la base de datos."}
            </p>
          </article>
        ))}
      </section>
    </main>
  );
}
