import { useQuery } from "@tanstack/react-query";

import { apiClient } from "../api/client";
import { BITACORA_FIXTURE } from "../data/expedientesFixtures";
import type { BitacoraEventoExpediente } from "../types/trazabilidadExpediente";

const RETARDO_MOCK_MS = 300;

const usarMocks = import.meta.env.VITE_ENABLE_MOCKS === "true";

async function obtenerTimelineMock(
  expedienteId: string,
): Promise<BitacoraEventoExpediente[]> {
  await new Promise((resolve) => setTimeout(resolve, RETARDO_MOCK_MS));
  return BITACORA_FIXTURE[expedienteId] ?? [];
}

async function obtenerTimelineApi(
  expedienteId: string,
): Promise<BitacoraEventoExpediente[]> {
  const { data } = await apiClient.get<BitacoraEventoExpediente[]>(
    `/v1/expedientes/${expedienteId}/bitacora`,
  );
  return data;
}

/**
 * Trae la bitácora inmutable (Timeline) de un expediente específico, ordenada
 * cronológicamente. Modo de solo lectura: no expone ninguna mutación.
 */
export function useExpedienteTimeline(expedienteId: string | undefined) {
  return useQuery({
    queryKey: ["expedientes", expedienteId, "timeline"],
    queryFn: () =>
      expedienteId
        ? usarMocks
          ? obtenerTimelineMock(expedienteId)
          : obtenerTimelineApi(expedienteId)
        : Promise.resolve([]),
    enabled: Boolean(expedienteId),
    staleTime: 30_000,
    select: (eventos) =>
      [...eventos].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      ),
  });
}
