import { Link } from "react-router-dom";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 text-slate-900 px-4 text-center">
      <h1 className="text-4xl font-bold tracking-tight text-[#006EC7]">SIGD</h1>
      <p className="text-lg text-slate-700">
        Sistema Integral de Gestión Documentaria — Instituto Suiza
      </p>
      <p className="text-sm text-slate-500">
        Estructura preliminar del frontend
      </p>

      <div className="mt-4 flex flex-wrap gap-3 justify-center">
        <Link
          to="/tramite"
          className="rounded-lg bg-[#006EC7] px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 transition"
        >
          Mesa de Partes Virtual / Wizard de Tramitación →
        </Link>
        <Link
          to="/administracion"
          className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition"
        >
          Panel de Administración
        </Link>
      </div>
    </main>
  );
}
