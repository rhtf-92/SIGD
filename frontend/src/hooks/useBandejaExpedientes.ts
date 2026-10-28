import { useQuery } from "@tanstack/react-query";

import { apiClient } from "../api/client";
import { EXPEDIENTES_FIXTURE } from "../data/expedientesFixtures";
import { ApiHttpError } from "../types/api";
import type { EstadoFlujoExpediente, ExpedienteSGD } from "../types/expediente";

/** Retardo de red simulado en modo mock, conforme al estándar de la arquitectura (300 ms). */
const RETARDO_MOCK_MS = 300;

const usarMocks = import.meta.env.VITE_ENABLE_MOCKS === "true";

/**
 * ¿La sesión actual es una sesión local/demo creada por el fallback del LoginPage
 * (token `demo-jwt-…`) y no un JWT real del backend?
 * Esas sesiones no pueden autenticar los endpoints que exigen un actor
 * (p. ej. GET /api/v1/expedientes de RutaDoc responde 401).
 */
function esSesionLocalDemo(): boolean {
  try {
    const token = window.localStorage.getItem("sigd_token") ?? "";
    return !token || token.startsWith("demo-jwt-");
  } catch {
    return false;
  }
}

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
  try {
    const { data } = await apiClient.get<ExpedienteSGD[]>("/api/v1/expedientes");
    return data;
  } catch (error) {
    // GET /api/v1/expedientes exige un actor autenticado (RutaDoc). Si la sesión es
    // local/demo no hay JWT real, el backend responde 401 y la bandeja se degrada a
    // los fixtures locales para seguir siendo operativa sin perder el rol de sesión.
    const errorHttp = error instanceof ApiHttpError ? error.status : 0;
    if ((errorHttp === 401 || errorHttp === 403) && esSesionLocalDemo()) {
      return EXPEDIENTES_FIXTURE;
    }
    throw error;
  }
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
