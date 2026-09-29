import AdminPageHeader from "../../components/administracion/AdminPageHeader";
import {
  HORA_CORTE_LPAG,
  useCalendarioLaboral,
} from "../../hooks/useCalendarioLaboral";

export default function CalendarioLaboralPage() {
  const {
    dias,
    alternarDia,
    horaInicio,
    setHoraInicio,
    horaFin,
    setHoraFin,
    horaCorteRecepcion,
    setHoraCorteRecepcion,
    zonaHoraria,
    setZonaHoraria,
    feriados,
    agregarFeriado,
    quitarFeriado,
    fechaNueva,
    setFechaNueva,
    nombreNuevo,
    setNombreNuevo,
    guardarConfiguracion,
    mensaje,
    setMensaje,
  } = useCalendarioLaboral();

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <AdminPageHeader
        title="Calendario Laboral"
        description="Configuración de jornada, corte de recepción LPAG y feriados de Ucayali."
      />

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          <p>
            <strong>Hora de corte normativa: {HORA_CORTE_LPAG} hrs</strong>.
            Los documentos ingresados después de las 16:30 hrs (o en día
            inhábil) se consideran recibidos a las 08:00 hrs del siguiente día
            hábil (Art. 138 TUO Ley N° 27444).
          </p>
        </div>

        {mensaje && (
          <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {mensaje}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold">Jornada laboral</h2>
            <p className="mt-1 text-sm text-slate-500">
              Los valores son configurables y no están fijados por código.
            </p>

            <div className="mt-5 space-y-3">
              {dias.map((dia, indice) => (
                <label
                  key={dia.nombre}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3"
                >
                  <span className="text-sm font-semibold">{dia.nombre}</span>
                  <input
                    type="checkbox"
                    checked={dia.activo}
                    onChange={() => alternarDia(indice)}
                    className="h-4 w-4 accent-blue-700"
                  />
                </label>
              ))}
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-sm font-semibold">
                  Hora de inicio
                </label>
                <input
                  type="time"
                  value={horaInicio}
                  onChange={(event) => setHoraInicio(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold">
                  Hora de fin
                </label>
                <input
                  type="time"
                  value={horaFin}
                  onChange={(event) => setHoraFin(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold">
                  Corte de recepción
                </label>
                <input
                  type="time"
                  value={horaCorteRecepcion}
                  onChange={(event) => {
                    setHoraCorteRecepcion(event.target.value);
                    setMensaje("");
                  }}
                  className={`w-full rounded-lg border px-3 py-2.5 text-sm ${
                    horaCorteRecepcion === HORA_CORTE_LPAG
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                      : "border-red-300 bg-red-50 text-red-800"
                  }`}
                />
                {horaCorteRecepcion !== HORA_CORTE_LPAG && (
                  <button
                    type="button"
                    onClick={() => setHoraCorteRecepcion(HORA_CORTE_LPAG)}
                    className="mt-1 text-xs font-semibold text-blue-700 hover:underline"
                  >
                    Restaurar corte normativo {HORA_CORTE_LPAG} hrs
                  </button>
                )}
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-1.5 block text-sm font-semibold">
                Zona horaria
              </label>
              <select
                value={zonaHoraria}
                onChange={(event) => setZonaHoraria(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              >
                <option value="America/Lima">America/Lima (UTC-05:00)</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold">Feriados y días no laborables</h2>
            <p className="mt-1 text-sm text-slate-500">
              Feriados nacionales (D. Leg. N° 713) y regionales de Ucayali.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-[170px_1fr_auto]">
              <input
                type="date"
                value={fechaNueva}
                onChange={(event) => setFechaNueva(event.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              />
              <input
                value={nombreNuevo}
                onChange={(event) => setNombreNuevo(event.target.value)}
                placeholder="Descripción"
                className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              />
              <button
                type="button"
                onClick={agregarFeriado}
                className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
              >
                Agregar
              </button>
            </div>

            <div className="mt-5 max-h-96 space-y-3 overflow-y-auto pr-1">
              {feriados.map((feriado) => (
                <div
                  key={feriado.id}
                  className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold">{feriado.nombre}</p>
                    <p className="text-xs text-slate-500">{feriado.fecha}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => quitarFeriado(feriado.id)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-100"
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={guardarConfiguracion}
            className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
          >
            Guardar calendario
          </button>
        </div>
      </section>
    </main>
  );
}