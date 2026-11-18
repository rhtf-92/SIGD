import AdminPageHeader from "../../components/administracion/AdminPageHeader";
import { useCalendarioLaboral } from "../../hooks/useCalendarioLaboral";

export default function CalendarioLaboralPage() {
  const { feriados, cargando, error, cargarFeriados } = useCalendarioLaboral();

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <AdminPageHeader
        title="Calendario Laboral"
        description="Feriados registrados en el calendario laboral."
      />

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div
          className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
          role="status"
        >
          Edicion del calendario en proceso: por ahora solo se muestra el
          calendario registrado.
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">Feriados y días no laborables</h2>

          {cargando ? (
            <p className="mt-5 text-sm text-slate-600" role="status">
              Cargando calendario laboral...
            </p>
          ) : error ? (
            <div className="mt-5" role="alert">
              <p className="text-sm text-red-700">{error}</p>
              <button
                type="button"
                onClick={() => void cargarFeriados()}
                className="mt-3 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-100"
              >
                Reintentar
              </button>
            </div>
          ) : feriados.length === 0 ? (
            <p className="mt-5 text-sm text-slate-600">
              No hay feriados registrados en el calendario laboral.
            </p>
          ) : (
            <div className="mt-5 max-h-96 space-y-3 overflow-y-auto pr-1">
              {feriados.map((feriado) => (
                <div
                  key={`${feriado.fecha}-${feriado.nombre}`}
                  className="rounded-lg border border-slate-200 px-4 py-3"
                >
                  <p className="text-sm font-semibold">{feriado.nombre}</p>
                  <p className="text-xs text-slate-500">{feriado.fecha}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
