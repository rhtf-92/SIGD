import { useQuery } from "@tanstack/react-query";

import { apiClient } from "../api/client";
import { EXPEDIENTES_FIXTURE } from "../data/expedientesFixtures";
import type { EstadoFlujoExpediente, ExpedienteSGD } from "../types/expediente";

/** Retardo de red simulado en modo mock, conforme al estándar de la arquitectura (300 ms). */
const RETARDO_MOCK_MS = 300;

const usarMocks = import.meta.env.VITE_ENABLE_MOCKS === "true";

export interface FiltrosBandejaExpedientes {
  /** Pestaña activa. `undefined` trae todos los expedientes (usado para calcular contadores). */
  estado?: EstadoFlujoExpediente;
  /** Búsqueda libre por CUT, solicitante o asunto. */
  busqueda?: string;
}

async function obtenerExpedientesMock(): Promise<ExpedienteSGD[]> {
  await new Promise((resolve) => setTimeout(resolve, RETARDO_MOCK_MS));
  return EXPEDIENTES_FIXTURE;
}

async function obtenerExpedientesApi(): Promise<ExpedienteSGD[]> {
  const { data } = await apiClient.get<ExpedienteSGD[]>("/v1/expedientes");
  return data;
}

function aplicarFiltros(
  expedientes: ExpedienteSGD[],
  filtros: FiltrosBandejaExpedientes,
): ExpedienteSGD[] {
  let resultado = expedientes;

  if (filtros.estado) {
    resultado = resultado.filter((exp) => exp.estadoFlujo === filtros.estado);
  }

  if (filtros.busqueda && filtros.busqueda.trim().length > 0) {
    const termino = filtros.busqueda.trim().toLowerCase();
    resultado = resultado.filter(
      (exp) =>
        exp.codigoExpediente.toLowerCase().includes(termino) ||
        exp.asunto.toLowerCase().includes(termino) ||
        exp.solicitante.nombreOrazonSocial.toLowerCase().includes(termino),
    );
  }

  return resultado;
}

/**
 * Trae la lista completa de expedientes (sin filtrar) para poder calcular los
 * contadores de las 6 pestañas de la Bandeja Operativa en un único fetch.
 */
export function useExpedientesBase() {
  return useQuery({
    queryKey: ["expedientes", "base"],
    queryFn: usarMocks ? obtenerExpedientesMock : obtenerExpedientesApi,
    staleTime: 30_000,
  });
}

/**
 * Hook principal de la Bandeja Operativa (ENT-M03-01).
 * Aplica los filtros de pestaña y búsqueda sobre los datos ya cacheados por TanStack Query.
 */
export function useBandejaExpedientes(filtros: FiltrosBandejaExpedientes) {
  const { data, ...resto } = useExpedientesBase();

  const expedientesFiltrados = data ? aplicarFiltros(data, filtros) : undefined;

  return { data: expedientesFiltrados, ...resto };
}
