import { useCallback, useEffect, useState } from "react";

import { apiClient } from "../api/client";
import type {
  AreaCuelloBotellaDTO,
  DashboardKpiResumenDTO,
} from "../types/dashboardEjecutivo";

export interface UseDashboardMetricsOptions {
  fechaInicio?: string;
  fechaFin?: string;
  diasLimite?: number;
}

export interface UseDashboardMetricsResult {
  summary: DashboardKpiResumenDTO | null;
  bottlenecks: AreaCuelloBotellaDTO[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const DEFAULT_DIAS_LIMITE = 5;

function normalizeAxiosError(error: unknown): string {
  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: string }).message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  return "No se pudieron cargar las métricas del dashboard.";
}

export function useDashboardMetrics({
  fechaInicio,
  fechaFin,
  diasLimite = DEFAULT_DIAS_LIMITE,
}: UseDashboardMetricsOptions = {}): UseDashboardMetricsResult {
  const [summary, setSummary] = useState<DashboardKpiResumenDTO | null>(null);
  const [bottlenecks, setBottlenecks] = useState<AreaCuelloBotellaDTO[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    const paramsResumen: Record<string, string> = {};

    if (fechaInicio) {
      paramsResumen.fechaInicio = fechaInicio;
    }

    if (fechaFin) {
      paramsResumen.fechaFin = fechaFin;
    }

    try {
      const [resumenResponse, cuellosResponse] = await Promise.allSettled([
        apiClient.get<DashboardKpiResumenDTO>(
          "/api/v1/reportes/dashboard/resumen",
          { params: paramsResumen },
        ),
        apiClient.get<AreaCuelloBotellaDTO[]>(
          "/api/v1/reportes/dashboard/cuellos-botella",
          { params: { diasLimite } },
        ),
      ]);

      if (resumenResponse.status === "fulfilled") {
        setSummary(resumenResponse.value.data);
      }

      if (cuellosResponse.status === "fulfilled") {
        setBottlenecks(cuellosResponse.value.data);
      }

      const hasError =
        resumenResponse.status === "rejected" ||
        cuellosResponse.status === "rejected";

      if (hasError) {
        const reason = [
          resumenResponse.status === "rejected"
            ? normalizeAxiosError(resumenResponse.reason)
            : null,
          cuellosResponse.status === "rejected"
            ? normalizeAxiosError(cuellosResponse.reason)
            : null,
        ]
          .filter((message): message is string => Boolean(message))
          .join(" | ");

        setError(reason || "No se pudieron cargar las métricas del dashboard.");
      }
    } catch (caughtError) {
      setError(normalizeAxiosError(caughtError));
    } finally {
      setLoading(false);
    }
  }, [diasLimite, fechaFin, fechaInicio]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    summary,
    bottlenecks,
    loading,
    error,
    refetch,
  };
}
