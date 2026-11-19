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
      className="relative inline-flex items-center gap-1.5"
      role="status"
      aria-live="polite"
      title={sseConectado ? "Conectado en tiempo real (SSE CoreLink)" : "Actualizando periódicamente"}
    >
      <span aria-hidden="true" className={`text-2xl ${pulsando ? "animate-pulse" : ""}`}>
        🔔
      </span>
      {noLeidas > 0 && (
        <span
          className={`absolute -top-1 -right-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[#006EC7] px-1 text-xs font-bold text-white ${
            pulsando ? "animate-ping" : ""
          }`}
        >
          {noLeidas > 99 ? "99+" : noLeidas}
        </span>
      )}
      <span
        className={`inline-block h-2 w-2 rounded-full ${
          sseConectado ? "bg-emerald-500 shadow-xs shadow-emerald-400" : "bg-slate-400"
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
