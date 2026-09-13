// Vista de acceso denegado (403 Forbidden) para guardianes RBAC (ENT-M05-01)
import { Link } from "react-router-dom";

export default function AccesoDenegadoPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 text-slate-900">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-5xl font-black text-red-600">403</p>
        <h1 className="mt-2 text-2xl font-bold">Acceso denegado</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Tu rol no cuenta con el permiso requerido para acceder a esta sección
          del SIGD. Verifica la matriz de permisos asignada por el
          administrador del sistema.
        </p>

        <Link
          to="/administracion"
          className="mt-6 inline-block rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
        >
          Volver al panel
        </Link>
      </section>
    </main>
  );
}