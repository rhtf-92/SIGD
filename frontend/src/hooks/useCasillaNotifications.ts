/* Hook de notificaciones en tiempo real de Casilla Electrónica (ENT-M01-05).
   Se suscribe al stream SSE real del backend (/api/v1/realtime/stream) y sincroniza
   la caché de TanStack Query que ya usa useCasilla.ts (CASILLA_QUERY_KEYS), para que
   la bandeja y el conteo se actualicen sin recargar la página.
   Escucha dos nombres de evento por compatibilidad: "casilla_notificacion" (el nombre
   real que emite el código de B_AREVALO) y "NOTIFICACION_DEPOSITADA" (el nombre que
   usa la documentación del plan maestro), para no depender de cuál de los dos
   termine siendo el definitivo. */

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CASILLA_QUERY_KEYS } from "./useCasilla";
import { env } from "../config/env";

const NOMBRES_EVENTO_NOTIFICACION = ["casilla_notificacion", "NOTIFICACION_DEPOSITADA"] as const;

export function useCasillaNotifications() {
  const queryClient = useQueryClient();
  const [sseConectado, setSseConectado] = useState(false);
  const [notificacionesRecibidas, setNotificacionesRecibidas] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const token =
      (typeof localStorage !== "undefined" &&
        (localStorage.getItem("sigd_token") || localStorage.getItem("token"))) ||
      undefined;

    const baseUrl = env.apiBaseUrl.replace(/\/+$/, '');
    const rutaStream = baseUrl.endsWith('/v1')
      ? `${baseUrl}/realtime/stream`
      : `${baseUrl}/api/v1/realtime/stream`;
    const streamUrl = new URL(
      rutaStream,
      typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
    );
    streamUrl.searchParams.set("canales", "casilla");
    if (token) {
      streamUrl.searchParams.set("token", token);
    }

    const eventSource = new EventSource(streamUrl.toString());
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => setSseConectado(true);
    eventSource.onerror = () => setSseConectado(false);

    const manejarNotificacion = () => {
      setNotificacionesRecibidas((actual) => actual + 1);
      void queryClient.invalidateQueries({ queryKey: CASILLA_QUERY_KEYS.all });
    };

    for (const nombreEvento of NOMBRES_EVENTO_NOTIFICACION) {
      eventSource.addEventListener(nombreEvento, manejarNotificacion);
    }

    return () => {
      for (const nombreEvento of NOMBRES_EVENTO_NOTIFICACION) {
        eventSource.removeEventListener(nombreEvento, manejarNotificacion);
      }
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [queryClient]);

  return {
    sseConectado,
    notificacionesRecibidas,
  };
}