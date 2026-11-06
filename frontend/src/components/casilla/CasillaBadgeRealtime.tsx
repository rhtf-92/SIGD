/* Indicador visual de campanilla de notificaciones en tiempo real (ENT-M01-05).
   Muestra el conteo real de "no leídos" (reutilizando useCasilla, ya conectado
   al backend) y aplica una animación de pulso cada vez que useCasillaNotifications
   detecta un evento SSE nuevo. */

import { useCasilla } from "../../hooks/useCasilla";
import { useCasillaNotifications } from "../../hooks/useCasillaNotifications";

export function CasillaBadgeRealtime() {
  const { stats, isLoadingStats } = useCasilla();
  const { sseConectado, notificacionesRecibidas } = useCasillaNotifications();
  const animar = notificacionesRecibidas > 0;

  const noLeidas = stats.noLeidos;

  const mensajeAccesible = isLoadingStats
    ? "Cargando notificaciones de la casilla electrónica"
    : noLeidas > 0
      ? `${noLeidas} notificaciones sin leer en su casilla electrónica`
      : "No tiene notificaciones pendientes en su casilla electrónica";

  return (
    <div className="relative inline-flex items-center" role="status" aria-live="polite">
      <span
        key={`campana-${notificacionesRecibidas}`}
        aria-hidden="true"
        className={`text-2xl ${animar ? "animate-pulse" : ""}`}
        style={animar ? { animationIterationCount: 1 } : undefined}
      >
        🔔
      </span>
      {noLeidas > 0 && (
        <span
          className={`absolute -top-1 -right-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[#006EC7] px-1 text-xs font-bold text-white ${
            animar ? "animate-ping" : ""
          }`}
          style={animar ? { animationIterationCount: 1 } : undefined}
        >
          {noLeidas > 99 ? "99+" : noLeidas}
        </span>
      )}
      <span className="sr-only">
        {mensajeAccesible}
        {!sseConectado && " (actualizando periódicamente)"}
      </span>
    </div>
  );
}
