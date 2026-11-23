/* Indicador visual de campanilla de notificaciones en tiempo real (ENT-M01-05).
   Muestra el conteo real de "no leídos" (reutilizando useCasilla, ya conectado
   al backend) y aplica una animación de pulso cada vez que useCasillaNotifications
   detecta un evento SSE nuevo. */

import { useEffect, useState } from "react";
import { useCasilla } from "../../hooks/useCasilla";
import { useCasillaNotifications } from "../../hooks/useCasillaNotifications";

export function CasillaBadgeRealtime() {
  const { stats, isLoadingStats } = useCasilla();
  const { sseConectado, notificacionesRecibidas } = useCasillaNotifications();
  const [pulsando, setPulsando] = useState(false);

  useEffect(() => {
    if (notificacionesRecibidas === 0) return;
    setPulsando(true);
    const temporizador = window.setTimeout(() => setPulsando(false), 1000);
    return () => window.clearTimeout(temporizador);
  }, [notificacionesRecibidas]);

  const noLeidas = stats.noLeidos;

  const mensajeAccesible = isLoadingStats
    ? "Cargando notificaciones de la casilla electrónica"
    : noLeidas > 0
      ? `${noLeidas} notificaciones sin leer en su casilla electrónica`
      : "No tiene notificaciones pendientes en su casilla electrónica";

  return (
    <div
      className="relative inline-flex items-center justify-center h-11 w-11 rounded-xl border border-slate-200 bg-white shadow-xs text-[#0073E6] hover:bg-slate-50 transition cursor-default"
      role="status"
      aria-live="polite"
      title={sseConectado ? "Conectado en tiempo real (SSE CoreLink)" : "Actualizando periódicamente"}
    >
      <span className="sr-only">🔔</span>
      {/* Gráfico/ícono de sobre con insignia roja */}
      <svg
        className={`h-6 w-6 text-[#0073E6] ${pulsando ? "animate-pulse" : ""}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.8}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
      </svg>
      {/* Insignia roja con número */}
      <span
        className={`absolute -top-1.5 -right-1.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[#EF4444] px-1 text-[11px] font-bold text-white shadow-xs ${
          pulsando ? "animate-bounce" : ""
        }`}
      >
        {noLeidas > 0 ? (noLeidas > 99 ? "99+" : noLeidas) : "1"}
      </span>
      <span
        className={`absolute bottom-0.5 right-0.5 inline-block h-2.5 w-2.5 rounded-full ring-2 ring-white ${
          sseConectado ? "bg-emerald-500 shadow-xs shadow-emerald-400" : "bg-slate-300"
        }`}
        title={sseConectado ? "SSE en línea" : "SSE reconectando"}
      />
      <span className="sr-only">
        {mensajeAccesible}
        {!sseConectado && " (actualizando periódicamente)"}
      </span>
    </div>
  );
}
