import { useState } from "react";

import AdminPageHeader from "../../components/administracion/AdminPageHeader";

interface DiaLaboral {
  nombre: string;
  activo: boolean;
}

interface Feriado {
  id: number;
  fecha: string;
  nombre: string;
}

const diasIniciales: DiaLaboral[] = [
  { nombre: "Lunes", activo: true },
  { nombre: "Martes", activo: true },
  { nombre: "Miércoles", activo: true },
  { nombre: "Jueves", activo: true },
  { nombre: "Viernes", activo: true },
  { nombre: "Sábado", activo: false },
  { nombre: "Domingo", activo: false },
];

const feriadosIniciales: Feriado[] = [
  { id: 1, fecha: "2026-07-28", nombre: "Fiestas Patrias" },
  { id: 2, fecha: "2026-07-29", nombre: "Fiestas Patrias" },
  { id: 3, fecha: "2026-08-30", nombre: "Santa Rosa de Lima" },
];

export default function CalendarioLaboralPage() {
  const [dias, setDias] = useState(diasIniciales);
  const [horaInicio, setHoraInicio] = useState("08:00");
  const [horaFin, setHoraFin] = useState("17:00");
  const [zonaHoraria, setZonaHoraria] = useState("America/Lima");
  const [feriados, setFeriados] = useState(feriadosIniciales);
  const [fechaNueva, setFechaNueva] = useState("");
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [mensaje, setMensaje] = useState("");

  function alternarDia(indice: number) {
    setMensaje("");
    setDias((actuales) =>
      actuales.map((dia, posicion) =>
        posicion === indice ? { ...dia, activo: !dia.activo } : dia,
      ),
    );
  }

  function agregarFeriado() {
    if (!fechaNueva || !nombreNuevo.trim()) return;

    setFeriados((actuales) => [
      ...actuales,
      {
        id: Math.max(0, ...actuales.map((feriado) => feriado.id)) + 1,
        fecha: fechaNueva,
        nombre: nombreNuevo.trim(),
      },
    ]);
    setFechaNueva("");
    setNombreNuevo("");
    setMensaje("");
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <AdminPageHeader
        title="Calendario Laboral"
        description="Configuración de días hábiles, horario y excepciones para el cálculo de plazos."
      />

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          La mesa de partes digital puede recibir documentos las 24 horas. Los
          plazos administrativos se calcularán con el calendario laboral configurado.
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

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
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
                <option value="America/Lima">America/Lima</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold">Feriados y días no laborables</h2>

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

            <div className="mt-5 space-y-3">
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
                    onClick={() =>
                      setFeriados((actuales) =>
                        actuales.filter((item) => item.id !== feriado.id),
                      )
                    }
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
            onClick={() =>
              setMensaje(
                `Configuración preparada: ${horaInicio}-${horaFin}, zona ${zonaHoraria}. Falta persistencia del backend.`,
              )
            }
            className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
          >
            Guardar calendario
          </button>
        </div>
      </section>
    </main>
  );
}
