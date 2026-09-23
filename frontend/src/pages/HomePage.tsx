import { Link } from "react-router-dom";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 text-slate-900">
      <h1 className="text-4xl font-bold tracking-tight">SIGD</h1>
      <p className="text-lg text-slate-600">
        Sistema Integral de Gestión Documentaria — Instituto Suiza
      </p>

      <nav
        aria-label="Accesos rápidos"
        className="mt-4 flex flex-wrap justify-center gap-3"
      >
        <Link
          to="/flujo-validez-legal"
          className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800"
        >
          Módulo 04 · Flujo y Validez Legal
        </Link>
        <Link
          to="/administracion"
          className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          Administración
        </Link>
      </nav>
    </main>
  );
}