import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import type { ActuacionRutaDoc } from "../types/trazabilidadExpediente";

export function useExpedienteTimeline(expedienteId: string | undefined) {
  return useQuery({
    queryKey: ["expedientes", expedienteId, "timeline"],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<{ expedienteId: string; actuaciones: ActuacionRutaDoc[] }>(
        `/api/v1/expedientes/${encodeURIComponent(expedienteId!)}/trazabilidad`, { signal },
      );
      return data.actuaciones;
    },
    enabled: Boolean(expedienteId),
    staleTime: 0,
    retry: false,
    // El productor ordena por secuencia, fecha e identificador. Se conserva ese orden.
  });
}
