import { Link } from "react-router-dom";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 text-slate-900">
      <h1 className="text-4xl font-bold tracking-tight">SIGD</h1>
      <p className="text-lg text-slate-600">
        Sistema Integral de Gestión Documentaria — Instituto Suiza
      </p>
      <p className="text-sm text-slate-500">
        Estructura preliminar del frontend
      </p>
      <Link
        to="/tramites/nuevo"
        className="mt-4 rounded-md bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
      >
        Registrar trámite
      </Link>
    </main>
  );
}
