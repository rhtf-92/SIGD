import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/api/client";

export type AreaBottleneckRisk = "bajo" | "medio" | "alto";

export interface AreaBottleneckRecord {
  id: string;
  areaId?: string | number;
  areaNombre?: string;
  nombreArea?: string;
  dependencia?: string;
  area?: string;
  expedientesEstancados?: number;
  expedientes?: number;
  totalExpedientes?: number;
  diasRetencion?: number;
  diasEstancados?: number;
  dias?: number;
  riesgo?: AreaBottleneckRisk | string;
  nivelRiesgo?: AreaBottleneckRisk | string;
  estado?: string;
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function toString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return undefined;
}

export function normalizeAreaRisk(
  value: AreaBottleneckRisk | string | null | undefined,
): AreaBottleneckRisk {
  const normalized = value?.toString().trim().toLowerCase();

  if (normalized === "alto" || normalized === "critico" || normalized === "crítico") {
    return "alto";
  }

  if (normalized === "medio" || normalized === "warning" || normalized === "advertencia") {
    return "medio";
  }

  return "bajo";
}

export function normalizeAreaBottleneckRecord(
  value: unknown,
): AreaBottleneckRecord | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const areaName =
    toString(record.areaNombre) ??
    toString(record.nombreArea) ??
    toString(record.dependencia) ??
    toString(record.area) ??
    "Área sin nombre";

  const expedientes =
    toNumber(record.expedientesEstancados) ||
    toNumber(record.expedientes) ||
    toNumber(record.totalExpedientes) ||
    toNumber(record.cantidadExpedientes);

  const diasRetencion =
    toNumber(record.diasRetencion) ||
    toNumber(record.diasEstancados) ||
    toNumber(record.dias);

  const areaId =
    typeof record.areaId === "number"
      ? record.areaId
      : typeof record.areaId === "string"
        ? record.areaId
        : undefined;

  return {
    id:
      toString(record.id) ??
      toString(record.areaId) ??
      `${areaName}-${expedientes}-${diasRetencion}`,
    areaId,
    areaNombre: areaName,
    nombreArea: areaName,
    dependencia: toString(record.dependencia) ?? areaName,
    area: areaName,
    expedientesEstancados: expedientes,
    expedientes,
    totalExpedientes: expedientes,
    diasRetencion: diasRetencion,
    diasEstancados: diasRetencion,
    dias: diasRetencion,
    riesgo: normalizeAreaRisk(
      (record.riesgo as AreaBottleneckRisk | string | undefined) ??
        (record.nivelRiesgo as AreaBottleneckRisk | string | undefined),
    ),
    nivelRiesgo: normalizeAreaRisk(
      (record.riesgo as AreaBottleneckRisk | string | undefined) ??
        (record.nivelRiesgo as AreaBottleneckRisk | string | undefined),
    ),
    estado: toString(record.estado) ?? "sin_estado",
  };
}

export function useAreaBottlenecks() {
  return useQuery({
    queryKey: ["area-bottlenecks", "diasLimite=5"],
    queryFn: async () => {
      const response = await apiClient.get<unknown>(
        "/api/v1/reportes/dashboard/cuellos-botella",
        {
          params: { diasLimite: 5 },
        },
      );

      const payload = response.data as unknown;
      let items: unknown[] = [];

      if (Array.isArray(payload)) {
        items = payload;
      } else if (typeof payload === "object" && payload !== null) {
        const maybeData = (payload as { data?: unknown }).data;
        if (Array.isArray(maybeData)) {
          items = maybeData;
        }
      }

      const normalized = items
        .map(normalizeAreaBottleneckRecord)
        .filter((item): item is AreaBottleneckRecord => item !== null);

      return normalized;
    },
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}
