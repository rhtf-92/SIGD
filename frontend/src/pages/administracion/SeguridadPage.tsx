import { useState } from "react";
import {
  Lock,
  Shield,
  ShieldAlert,
  Clock,
  CheckCircle,
  AlertTriangle,
  UserCheck,
  Save,
  KeyRound,
  X,
  History,
} from "lucide-react";

import AdminPageHeader from "../../components/administracion/AdminPageHeader";
import GlassCard from "../../components/administracion/common/GlassCard";
import KpiCard from "../../components/administracion/common/KpiCard";
import StatusBadge from "../../components/administracion/common/StatusBadge";
import { PrimaryButton, SecondaryButton } from "../../components/administracion/common/Buttons";
import { useSeguridadPolicies } from "../../hooks/useSeguridadPolicies";

export default function SeguridadPage() {
  const {
    maxIntentos,
    setMaxIntentos,
    minutosBloqueo,
    setMinutosBloqueo,
    minutosSesion,
    setMinutosSesion,
    cuentasBloqueadas,
    desbloquearCuenta,
    intentosFallidos,
    intentosIniciales,
    guardarPoliticas,
    mensaje,
    setMensaje,
  } = useSeguridadPolicies();

  const [cuentaEnDesbloqueo, setCuentaEnDesbloqueo] = useState<number | null>(
    null,
  );
  const [justificacion, setJustificacion] = useState("");

  const cuentaSeleccionada = cuentasBloqueadas.find(
    (c) => c.id === cuentaEnDesbloqueo,
  );

  return (
    <div className="min-h-full">
      <AdminPageHeader
        title="Seguridad"
        description="Políticas de acceso, control de intentos fallidos de autenticación y supervisión forense de cuentas bloqueadas."
        icon={Lock}
        badge="Protección y Accesos"
      />

      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* 3 Top KPIs */}
        <div className="grid gap-4 sm:grid-cols-3">
          <KpiCard
            title="Cuentas Bloqueadas"
            value={cuentasBloqueadas.length}
            subtitle="Acceso temporalmente revocado"
            icon={ShieldAlert}
            badge={{
              text: cuentasBloqueadas.length > 0 ? "Atención" : "Limpio",
              variant: cuentasBloqueadas.length > 0 ? "danger" : "positive",
            }}
            color="rose"
          />
          <KpiCard
            title="Intentos Fallidos"
            value={intentosFallidos}
            subtitle="En el ciclo de monitoreo"
            icon={AlertTriangle}
            badge={{ text: "Monitoreo", variant: "warning" }}
            color="gold"
          />
          <KpiCard
            title="Tiempo de Sesión"
            value={`${minutosSesion} min`}
            subtitle="Expiración de tokens JWT"
            icon={Clock}
            badge={{ text: "Configurado", variant: "neutral" }}
            color="cyan"
          />
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
          {/* Left Column: Políticas de Acceso */}
          <GlassCard glow="cyan">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-5">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-cyan-400" />
                  <span>Políticas Globales de Acceso</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Reglas de defensa contra ataques por fuerza bruta y gestión de tokens.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold tracking-wider uppercase text-slate-400">
                  Máximo de intentos fallidos permitidos
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    value={maxIntentos}
                    onChange={(event) => setMaxIntentos(Number(event.target.value))}
                    className="w-full rounded-xl border border-slate-700/80 bg-slate-950/60 px-3.5 py-2.5 font-mono text-sm text-slate-100 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                  />
                  <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                    intentos
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Tras este límite, la cuenta queda bloqueada automáticamente.
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold tracking-wider uppercase text-slate-400">
                  Duración de suspensión (minutos)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    value={minutosBloqueo}
                    onChange={(event) =>
                      setMinutosBloqueo(Number(event.target.value))
                    }
                    className="w-full rounded-xl border border-slate-700/80 bg-slate-950/60 px-3.5 py-2.5 font-mono text-sm text-slate-100 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                  />
                  <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                    minutos
                  </span>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold tracking-wider uppercase text-slate-400">
                  Tiempo de validez de sesión (minutos)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={5}
                    value={minutosSesion}
                    onChange={(event) =>
                      setMinutosSesion(Number(event.target.value))
                    }
                    className="w-full rounded-xl border border-slate-700/80 bg-slate-950/60 px-3.5 py-2.5 font-mono text-sm text-slate-100 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                  />
                  <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                    minutos
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <PrimaryButton
                  onClick={guardarPoliticas}
                  icon={Save}
                  size="md"
                >
                  Guardar políticas
                </PrimaryButton>
              </div>
            </div>
          </GlassCard>

          {/* Right Column: Cuentas Bloqueadas */}
          <GlassCard glow="rose">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-5">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-rose-400" />
                  <span>Cuentas con Bloqueo Activo</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  El desbloqueo exige justificación forense obligatoria.
                </p>
              </div>
              <span className="font-mono text-xs text-rose-400">
                {cuentasBloqueadas.length} bloqueos
              </span>
            </div>

            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              {cuentasBloqueadas.length === 0 ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-5 text-center">
                  <CheckCircle className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-emerald-300">
                    Sin cuentas bloqueadas
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Todas las cuentas institucionales se encuentran en estado normal.
                  </p>
                </div>
              ) : (
                cuentasBloqueadas.map((cuenta) => (
                  <div
                    key={cuenta.id}
                    className="rounded-xl border border-rose-500/30 bg-slate-900/60 p-4 transition hover:bg-slate-850"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.8)]" />
                          <p className="font-bold text-sm text-white">
                            {cuenta.usuario}
                          </p>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {cuenta.correo}
                        </p>
                        <p className="mt-2 text-xs font-medium text-rose-300 bg-rose-950/40 border border-rose-500/20 px-2.5 py-1 rounded-lg">
                          Motivo: {cuenta.motivo}
                        </p>
                        <p className="mt-1.5 font-mono text-[11px] text-slate-500">
                          Bloqueado el: {cuenta.fecha}
                        </p>
                      </div>

                      <PrimaryButton
                        size="sm"
                        onClick={() => {
                          setMensaje("");
                          setJustificacion("");
                          setCuentaEnDesbloqueo(cuenta.id);
                        }}
                        className="self-start text-xs bg-gradient-to-r from-blue-600 to-cyan-600"
                      >
                        Desbloquear
                      </PrimaryButton>
                    </div>
                  </div>
                ))
              )}
            </div>
          </GlassCard>
        </div>

        {/* Últimos Intentos de Acceso Table */}
        <div className="overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl shadow-xl">
          <div className="border-b border-slate-800/80 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-cyan-400" />
              <h3 className="font-bold text-white text-base tracking-tight">
                Bitácora de Últimos Intentos de Autenticación
              </h3>
            </div>
            <span className="font-mono text-xs text-slate-400">
              {intentosIniciales.length} eventos registrados
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left">
              <thead className="border-b border-slate-800/80 bg-slate-950/60 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-6 py-3.5">Fecha y Hora</th>
                  <th className="px-6 py-3.5">Identificador / Usuario</th>
                  <th className="px-6 py-3.5">IP de Conexión</th>
                  <th className="px-6 py-3.5 text-right">Resultado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {intentosIniciales.map((intento) => (
                  <tr
                    key={intento.id}
                    className="hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="px-6 py-3.5 font-mono text-xs text-slate-300">
                      {intento.fecha}
                    </td>
                    <td className="px-6 py-3.5 text-sm font-semibold text-white">
                      {intento.usuario}
                    </td>
                    <td className="px-6 py-3.5 font-mono text-xs text-slate-400">
                      {intento.ip}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <StatusBadge status={intento.resultado} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Modal de Desbloqueo Supervisado */}
      {cuentaEnDesbloqueo !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl border border-cyan-500/30 bg-slate-900/95 p-6 shadow-2xl backdrop-blur-2xl text-slate-100">
            <div className="flex items-start justify-between border-b border-slate-800 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/15 border border-cyan-400/30 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
                  <UserCheck className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight">
                    Desbloqueo Supervisado
                  </h3>
                  <p className="text-xs text-slate-400">
                    Cuenta: {cuentaSeleccionada?.usuario} ({cuentaSeleccionada?.correo})
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCuentaEnDesbloqueo(null)}
                className="rounded-xl border border-slate-800 bg-slate-800/60 p-2 text-slate-400 hover:text-white transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-xl border border-amber-500/30 bg-amber-950/30 p-3 text-xs text-amber-300 mb-4 flex items-start gap-2.5">
              <Shield className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
              <span>
                Esta acción restablece el acceso y queda asentada en la bitácora inmutable de auditoría forense (WORM).
              </span>
            </div>

            <label className="mb-1.5 block text-xs font-semibold tracking-wider uppercase text-slate-400">
              Justificación forense obligatoria *
            </label>
            <textarea
              value={justificacion}
              onChange={(event) => setJustificacion(event.target.value)}
              placeholder="Indique el motivo o ticket de solicitud del desbloqueo (ej. Solicitud presencial verificada con DNI)..."
              rows={4}
              className="w-full rounded-xl border border-slate-700/80 bg-slate-950/60 p-3 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
            />

            <div className="mt-5 flex justify-end gap-3 border-t border-slate-800 pt-4">
              <SecondaryButton
                onClick={() => setCuentaEnDesbloqueo(null)}
              >
                Cancelar
              </SecondaryButton>
              <PrimaryButton
                disabled={!justificacion.trim()}
                onClick={() => {
                  desbloquearCuenta(cuentaEnDesbloqueo, justificacion);
                  setCuentaEnDesbloqueo(null);
                }}
              >
                Confirmar desbloqueo
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}