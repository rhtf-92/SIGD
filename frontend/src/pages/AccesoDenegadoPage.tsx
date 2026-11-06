// Vista de acceso denegado (403 Forbidden) para guardianes RBAC (ENT-M05-01)
import { Link } from "react-router-dom";

export default function AccesoDenegadoPage() {
  return (
    <div className="flex-1 flex items-center justify-center bg-slate-100 px-4 py-12 text-slate-900">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 text-center shadow-sm">
        <p className="text-5xl font-black text-red-600">403</p>
        <h1 className="mt-2 text-xl sm:text-2xl font-bold">Acceso denegado</h1>
        <p className="mt-2 text-xs sm:text-sm leading-6 text-slate-500">
          Tu rol no cuenta con el permiso requerido para acceder a esta sección
          del SIGD. Verifica la matriz de permisos asignada por el
          administrador del sistema.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2">
          <Link
            to="/"
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-lg bg-blue-700 px-4 py-2 text-xs sm:text-sm font-semibold text-white transition hover:bg-blue-800"
          >
            ← Volver al inicio
          </Link>
          <Link
            to="/login"
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Iniciar sesión con otra cuenta
          </Link>
        </div>
      </section>
    </div>
  );
}