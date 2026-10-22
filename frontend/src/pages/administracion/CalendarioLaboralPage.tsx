import {
  Calendar,
  Clock,
  CheckCircle,
  AlertTriangle,
  Save,
  Plus,
  Trash2,
  Globe,
  Sun,
  ShieldCheck,
} from "lucide-react";

import AdminPageHeader from "../../components/administracion/AdminPageHeader";
import GlassCard from "../../components/administracion/common/GlassCard";
import { PrimaryButton } from "../../components/administracion/common/Buttons";
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

  const esHoraCorteNormativa = horaCorteRecepcion === HORA_CORTE_LPAG;

  return (
    <div className="min-h-full">
      <AdminPageHeader
        title="Calendario Laboral"
        description="Configuración de jornada institucional, corte de recepción LPAG y feriados regionales de Ucayali."
        icon={Calendar}
        badge="Cómputo de Plazos"
      />

      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Normative Notice LPAG Banner */}
        <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-950/40 via-slate-900/80 to-slate-950/80 p-5 backdrop-blur-xl shadow-lg">
          <div className="flex items-start gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-400/30 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-wide">
                  Hora de Corte Normativa: {HORA_CORTE_LPAG} hrs
                </h3>
                <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                  Art. 138 TUO Ley N° 27444
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-300 leading-relaxed max-w-4xl">
                Los documentos ingresados después de las <strong>16:30 hrs</strong> (o en día inhábil) se consideran legalmente recibidos a las <strong>08:00 hrs</strong> del siguiente día hábil institucional para el cómputo de plazos administrativos.
              </p>
            </div>
          </div>
        </div>

        {/* Feedback Message */}
        {mensaje && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-950/40 px-4 py-3 text-sm font-medium text-emerald-300 backdrop-blur-md shadow-lg shadow-emerald-950/40"
          >
            <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
            <span>{mensaje}</span>
          </div>
        )}

        {/* 2-Column Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left Column: Jornada Laboral */}
          <GlassCard glow="blue">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-5">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                  <Sun className="h-4 w-4 text-cyan-400" />
                  <span>Jornada y Días Laborables</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Configure los días de atención y rango horario de la institución.
                </p>
              </div>
            </div>

            {/* Días de la Semana */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Días de Operación
              </p>
              {dias.map((dia, indice) => (
                <label
                  key={dia.nombre}
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 cursor-pointer transition-all duration-200 ${
                    dia.activo
                      ? "border-cyan-500/30 bg-cyan-950/20 text-white"
                      : "border-slate-800/80 bg-slate-900/40 text-slate-400"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        dia.activo
                          ? "bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]"
                          : "bg-slate-600"
                      }`}
                    />
                    <span className="text-sm font-semibold">{dia.nombre}</span>
                  </div>

                  <input
                    type="checkbox"
                    checked={dia.activo}
                    onChange={() => alternarDia(indice)}
                    className="h-4 w-4 rounded-md border-slate-700 bg-slate-900 text-cyan-500 accent-cyan-500 focus:ring-2 focus:ring-cyan-500/20 cursor-pointer"
                  />
                </label>
              ))}
            </div>

            {/* Horarios */}
            <div className="mt-6 pt-5 border-t border-slate-800/80">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                Parámetros Horarios
              </p>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold tracking-wider uppercase text-slate-400">
                    Hora de Inicio
                  </label>
                  <input
                    type="time"
                    value={horaInicio}
                    onChange={(event) => setHoraInicio(event.target.value)}
                    className="w-full rounded-xl border border-slate-700/80 bg-slate-950/60 px-3 py-2.5 font-mono text-sm text-slate-100 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold tracking-wider uppercase text-slate-400">
                    Hora de Fin
                  </label>
                  <input
                    type="time"
                    value={horaFin}
                    onChange={(event) => setHoraFin(event.target.value)}
                    className="w-full rounded-xl border border-slate-700/80 bg-slate-950/60 px-3 py-2.5 font-mono text-sm text-slate-100 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold tracking-wider uppercase text-slate-400">
                    Corte Recepción
                  </label>
                  <input
                    type="time"
                    value={horaCorteRecepcion}
                    onChange={(event) => {
                      setHoraCorteRecepcion(event.target.value);
                      setMensaje("");
                    }}
                    className={`w-full rounded-xl border px-3 py-2.5 font-mono text-sm focus:outline-none focus:ring-2 ${
                      esHoraCorteNormativa
                        ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-300 focus:ring-emerald-500/20"
                        : "border-amber-500/40 bg-amber-950/30 text-amber-300 focus:ring-amber-500/20"
                    }`}
                  />
                </div>
              </div>

              {!esHoraCorteNormativa && (
                <div className="mt-2.5 flex items-center justify-between">
                  <span className="text-[11px] text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    <span>Difiere del corte normativo</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setHoraCorteRecepcion(HORA_CORTE_LPAG)}
                    className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 hover:underline cursor-pointer"
                  >
                    Restaurar corte normativo {HORA_CORTE_LPAG} hrs
                  </button>
                </div>
              )}
            </div>

            {/* Zona Horaria */}
            <div className="mt-5">
              <label className="mb-1.5 block text-xs font-semibold tracking-wider uppercase text-slate-400 flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-cyan-400" />
                <span>Zona Horaria Oficial</span>
              </label>
              <select
                value={zonaHoraria}
                onChange={(event) => setZonaHoraria(event.target.value)}
                className="w-full rounded-xl border border-slate-700/80 bg-slate-950/60 px-3.5 py-2.5 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
              >
                <option value="America/Lima" className="bg-slate-900 text-white">
                  America/Lima (UTC-05:00) — Hora Oficial de Perú
                </option>
                <option value="UTC" className="bg-slate-900 text-white">
                  UTC (Tiempo Universal Coordinado)
                </option>
              </select>
            </div>
          </GlassCard>

          {/* Right Column: Feriados y Días No Laborables */}
          <GlassCard glow="cyan">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-5">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-cyan-400" />
                  <span>Feriados y Días No Laborables</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Feriados nacionales (D. Leg. N° 713) y festividades de Ucayali.
                </p>
              </div>
              <span className="font-mono text-xs text-cyan-400">
                {feriados.length} feriados
              </span>
            </div>

            {/* Add Holiday Form */}
            <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3.5 mb-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400 mb-2.5 flex items-center gap-1">
                <Plus className="h-3.5 w-3.5" />
                <span>Registrar Nuevo Feriado</span>
              </p>

              <div className="grid gap-2.5 sm:grid-cols-[160px_1fr_auto]">
                <input
                  type="date"
                  value={fechaNueva}
                  onChange={(event) => setFechaNueva(event.target.value)}
                  className="rounded-xl border border-slate-700/80 bg-slate-900/80 px-3 py-2 text-xs font-mono text-slate-100 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                />
                <input
                  value={nombreNuevo}
                  onChange={(event) => setNombreNuevo(event.target.value)}
                  placeholder="Descripción (ej. San Juan, Aniversario)"
                  className="rounded-xl border border-slate-700/80 bg-slate-900/80 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                />
                <PrimaryButton
                  size="sm"
                  onClick={agregarFeriado}
                  icon={Plus}
                >
                  Agregar
                </PrimaryButton>
              </div>
            </div>

            {/* List of Holidays */}
            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {feriados.map((feriado) => (
                <div
                  key={feriado.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-800/80 bg-slate-900/60 p-3 hover:bg-slate-850 hover:border-slate-700 transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-mono text-xs">
                      {feriado.fecha.split("-")[2] || "01"}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {feriado.nombre}
                      </p>
                      <p className="font-mono text-xs text-slate-400">
                        {feriado.fecha}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => quitarFeriado(feriado.id)}
                    aria-label={`Quitar feriado ${feriado.nombre}`}
                    className="rounded-lg border border-slate-800 bg-slate-800/60 p-2 text-slate-400 hover:text-rose-400 hover:border-rose-500/30 transition cursor-pointer"
                    title="Quitar feriado"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* Action Bar */}
        <div className="flex items-center justify-between rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-xl">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>Los plazos de trámites y alertas SLA se calcularán conforme a estos parámetros.</span>
          </div>

          <PrimaryButton
            onClick={guardarConfiguracion}
            icon={Save}
            size="md"
          >
            Guardar calendario
          </PrimaryButton>
        </div>
      </section>
    </div>
  );
}