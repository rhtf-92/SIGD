import { useState } from "react";

import AdminPageHeader from "../../components/administracion/AdminPageHeader";
import {
  HORA_CORTE_LPAG,
  useCalendarioLaboral,
  type TipoFeriado,
} from "../../hooks/useCalendarioLaboral";

export default function CalendarioLaboralPage() {
  const {
    anio,
    setAnio,
    dias,
    alternarDia,
    horaInicio,
    setHoraInicio,
    horaFin,
    setHoraFin,
    horaCorteRecepcion,
    zonaHoraria,
    setZonaHoraria,
    feriados,
    agregarFeriado,
    quitarFeriado,
    fechaNueva,
    setFechaNueva,
    nombreNuevo,
    setNombreNuevo,
    tipoFeriadoNuevo,
    setTipoFeriadoNuevo,
    baseLegalNueva,
    setBaseLegalNueva,
    resultadoPlazo,
    calculandoPlazo,
    consultarPlazo,
    guardarConfiguracion,
    mensaje,
    error,
    isLoading,
    isSaving,
    recargar,
  } = useCalendarioLaboral();

  const [fechaConsulta, setFechaConsulta] = useState(() => new Date().toISOString().slice(0, 10));
  const [diasPlazo, setDiasPlazo] = useState(30);
  const aniosSelector = Array.from({ length: 5 }, (_, idx) => new Date().getFullYear() - 1 + idx);

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
        {error && (
          <div role="alert" className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Error al sincronizar el calendario. {error.message}
            <button type="button" onClick={() => void recargar()} className="ml-3 font-semibold underline">Reintentar</button>
          </div>
        )}
        {isLoading && <div role="status" className="mb-6 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">Cargando calendario...</div>}
        {isSaving && <div role="status" className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">Guardando calendario...</div>}

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold">Jornada laboral</h2>
            <p className="mt-1 text-sm text-slate-500">
              La jornada y los días hábiles se guardan en el servidor. El corte LPAG permanece fijo a las 16:30.
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
                  readOnly
                  aria-readonly="true"
                  className={`w-full rounded-lg border px-3 py-2.5 text-sm ${
                    horaCorteRecepcion === HORA_CORTE_LPAG
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                      : "border-red-300 bg-red-50 text-red-800"
                  }`}
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
                <option value="America/Lima">America/Lima (UTC-05:00)</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">Feriados y días no laborables</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Feriados nacionales (D. Leg. N° 713) y regionales de Ucayali.
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold">
                Año
                <select
                  value={anio}
                  onChange={(event) => setAnio(Number(event.target.value))}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-normal"
                >
                  {aniosSelector.map((valor) => (
                    <option key={valor} value={valor}>{valor}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <input
                type="date"
                aria-label="Fecha del feriado"
                value={fechaNueva}
                onChange={(event) => setFechaNueva(event.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              />
              <select
                aria-label="Tipo de feriado"
                value={tipoFeriadoNuevo}
                onChange={(event) => setTipoFeriadoNuevo(event.target.value as TipoFeriado)}
                className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              >
                <option value="INSTITUCIONAL">Feriado Institucional</option>
                <option value="NACIONAL">Feriado Nacional</option>
                <option value="REGIONAL_UCAYALI">Feriado Regional Ucayali</option>
                <option value="DUELO_NACIONAL">Duelo Nacional</option>
              </select>
              <input
                aria-label="Descripción del feriado"
                value={nombreNuevo}
                onChange={(event) => setNombreNuevo(event.target.value)}
                placeholder="Descripción (mínimo 5 caracteres)"
                className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              />
              <input
                aria-label="Base legal"
                value={baseLegalNueva}
                onChange={(event) => setBaseLegalNueva(event.target.value)}
                placeholder="Base legal (opcional, ej. R.D. N° 015)"
                className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              />
              <div className="sm:col-span-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => void agregarFeriado()}
                  disabled={isSaving}
                  className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
                >
                  Agregar
                </button>
              </div>
            </div>

            <div className="mt-5 max-h-96 space-y-3 overflow-y-auto pr-1">
              {!isLoading && feriados.length === 0 && <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">No hay feriados activos registrados para {anio}.</p>}
              {feriados.map((feriado) => (
                <div
                  key={feriado.id}
                  className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold">{feriado.nombre}</p>
                    <p className="text-xs text-slate-500">
                      {feriado.fecha}
                      {feriado.tipoFeriado ? ` · ${feriado.tipoFeriado}` : ""}
                      {feriado.baseLegal ? ` · ${feriado.baseLegal}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void quitarFeriado(feriado.id)}
                    disabled={isSaving}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-100"
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold">Consulta de fecha y cálculo de plazos (Art. 143 LPAG)</h2>
          <p className="mt-1 text-sm text-slate-500">
            Calcula la fecha de vencimiento descontando fines de semana y feriados activos registrados en PostgreSQL.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-[200px_180px_auto] sm:items-end">
            <div>
              <label htmlFor="plazo-desde" className="mb-1 block text-sm font-semibold">Fecha de inicio</label>
              <input
                id="plazo-desde"
                type="date"
                value={fechaConsulta}
                onChange={(event) => setFechaConsulta(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="plazo-dias" className="mb-1 block text-sm font-semibold">Plazo (días hábiles)</label>
              <input
                id="plazo-dias"
                type="number"
                min={1}
                max={365}
                value={diasPlazo}
                onChange={(event) => setDiasPlazo(Number(event.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="button"
              disabled={calculandoPlazo}
              onClick={() => void consultarPlazo(fechaConsulta, diasPlazo)}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-50"
            >
              {calculandoPlazo ? "Calculando…" : "Calcular plazo hábil"}
            </button>
          </div>
          {resultadoPlazo && (
            <div className="mt-4 grid gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950 sm:grid-cols-4">
              <div>
                <p className="text-xs font-semibold uppercase text-blue-700">Inicio laborable</p>
                <p className="mt-1 font-bold">{resultadoPlazo.es_dia_laborable_inicio ? "Sí (día hábil)" : `No · Próximo: ${resultadoPlazo.primer_dia_habil}`}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-blue-700">Vencimiento ({resultadoPlazo.dias_habiles} d.h.)</p>
                <p className="mt-1 font-bold">{resultadoPlazo.fecha_vencimiento}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-blue-700">Días inhábiles en rango</p>
                <p className="mt-1 font-bold">{resultadoPlazo.dias_no_laborables.length}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-blue-700">Corte normativo LPAG</p>
                <p className="mt-1 font-bold">{resultadoPlazo.corte_lpag} hrs</p>
              </div>
            </div>
          )}
        </section>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={() => void guardarConfiguracion()}
            disabled={isSaving || isLoading}
            className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
          >
            Guardar calendario
          </button>
        </div>
      </section>
    </main>
  );
}
