import { useNavigate } from "react-router-dom";

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 px-4 text-center text-slate-900">
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">
          IESTP "Suiza" — Pucallpa
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
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => navigate("/casilla")}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-6 py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-blue-800 hover:shadow-lg"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
          Casilla Electrónica Ciudadana (ENT-M01-03)
        </button>

        <button
          type="button"
          onClick={() => navigate("/administracion")}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-100"
        >
          Panel de Administración
        </button>
      </div>
    </main>
  );
}
