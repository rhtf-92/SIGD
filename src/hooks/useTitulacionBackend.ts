/**
 * useTitulacionBackend — F_ADRIANO / ENT-M04-01 / T-FE-DOC-01.
 * Consume la FSM académica del backend (GET /api/v1/flujos/titulacion/:id)
 * con TanStack Query v5 + mutación de transiciones con invalidación
 * quirúrgica (Plan §2.2). En modo mocks/desarrollo devuelve `backendNull`
 * para que la página opere con la FSM local sin romperse.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "../api/client";
import { queryKeys } from "../api/queryKeys";
import { env } from "../config/env";
import type { WorkflowAcademico } from "../types/workflowAcademico";

const USAR_MOCKS = env.enableMocks;

export type TransicionTitulacion =
  | "tomar_revision"
  | "aprobar_etapa"
  | "observar"
  | "subsanar"
  | "reanudar"
  | "firmar"
  | "anular";

interface TransicionPayload {
  transicion: TransicionTitulacion;
  observacion?: string;
  requisitoId?: number;
  cumplido?: boolean;
}

async function fetchTitulacion(tramiteId: number | string): Promise<WorkflowAcademico> {
  const { data } = await apiClient.get<WorkflowAcademico>(
    `/api/v1/flujos/titulacion/${encodeURIComponent(String(tramiteId))}`,
  );
  return data;
}

export function useTitulacionBackend(tramiteId: number | string) {
  const queryClient = useQueryClient();

  const detalle = useQuery({
    queryKey: queryKeys.flujos.titulacion.detalle(tramiteId),
    queryFn: () => fetchTitulacion(tramiteId),
    enabled: !USAR_MOCKS,
    staleTime: 10_000,
    retry: 1,
  });

  const transicion = useMutation({
    mutationFn: async (payload: TransicionPayload) => {
      const { data } = await apiClient.post<WorkflowAcademico>(
        `/api/v1/flujos/titulacion/${encodeURIComponent(String(tramiteId))}/transiciones`,
        payload,
      );
      return data;
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.flujos.titulacion.detalle(tramiteId),
      });
    },
  });

  return {
    /** `true` cuando el backend respondió (FSM real); `false` en modo local/mocks. */
    conectado: !USAR_MOCKS && detalle.status === "success",
    workflowRemoto: detalle.data ?? null,
    cargandoRemoto: detalle.isLoading,
    errorRemoto: detalle.error,
    enviarTransicion: transicion.mutate,
    enviandoTransicion: transicion.isPending,
  };
}
