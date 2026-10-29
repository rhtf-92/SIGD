import { Link, useNavigate } from "react-router-dom";
import {
  filtrarModulosPorRol,
  useSesion,
} from "../config/accesoModulos";
import { useAuthStore } from "../stores/authStore";

export default function DashboardHomePage() {
  const { rol, autenticado } = useSesion();
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const secciones = filtrarModulosPorRol(rol, autenticado);
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 py-12 text-slate-900">
      <div className="text-center space-y-2 max-w-2xl">
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">
          IESTP &quot;Suiza&quot; — Pucallpa
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          SIGD
        </h1>
        <p className="text-lg font-medium text-slate-700">
          Sistema Integral de Gestión Documentaria
        </p>
        <p className="text-sm text-slate-500">
          Plataforma Institucional y Notificación Electrónica con Validez Legal
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs font-semibold">
          {autenticado && rol ? (
            <>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">
                Sesión activa: {rol} · {secciones.length} módulo{secciones.length === 1 ? "" : "s"} asignado{secciones.length === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                onClick={() => {
                  logout();
                  navigate("/login");
                }}
                className="rounded-full border border-slate-300 bg-white px-3 py-1 text-slate-700 hover:bg-slate-100"
              >
                Cerrar sesión
              </button>
            </>
          ) : (
            <>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">
                Sin sesión: solo módulos públicos
              </span>
              <Link
                to="/login"
                className="rounded-full bg-blue-700 px-3 py-1 text-white hover:bg-blue-800"
              >
                Iniciar sesión para ver tus módulos
              </Link>
            </>
          )}
        </div>
        {autenticado && rol && (
          <p className="mt-3 text-xs font-medium text-slate-500">
            Mostrando únicamente los módulos correspondientes a su rol (<span className="font-bold">{rol}</span>),
            según la base de datos institucional SIGD.
          </p>
        )}
      </div>

      <div className="mt-10 grid w-full max-w-4xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {secciones.map((seccion) => (
          <Link
            key={seccion.ruta}
            to={seccion.ruta}
            className={`group rounded-xl border p-6 shadow-sm transition duration-200 ease-out hover:shadow-md motion-safe:hover:-translate-y-1 motion-reduce:transition-none ${
              seccion.destacado
                ? "border-blue-300 bg-blue-50/50 hover:border-blue-400"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            {seccion.subtitulo && (
              <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">
                {seccion.subtitulo}
              </span>
            )}
            <h2 className="mt-1 text-lg font-bold text-slate-900 group-hover:text-blue-700">
              {seccion.titulo}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {seccion.descripcion}
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
}