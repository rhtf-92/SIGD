import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import { ApiHttpError } from "../types/api";
import type { ExpedienteDetalleRutaDoc, PestanaRutaDoc, ResultadoBandejaRutaDoc } from "../types/expediente";

export interface FiltrosBandejaExpedientes {
  pestana: PestanaRutaDoc;
  busqueda?: string;
  areaId?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  limite?: number;
}

export function mensajeErrorExpediente(error: unknown): string {
  const status = error instanceof ApiHttpError ? error.status : undefined;
  if (status === 401) return "Inicia sesión para consultar los expedientes.";
  if (status === 403) return "No tienes permiso para consultar este recurso.";
  if (status === 404) return "No se encontró el expediente solicitado.";
  return "No se pudo completar la consulta. Intenta nuevamente.";
}

/** Cada pestaña y combinación de filtros tiene su propia secuencia de cursores. */
export function useBandejaExpedientes(filtros: FiltrosBandejaExpedientes) {
  const { pestana, areaId, fechaDesde, fechaHasta, limite = 20 } = filtros;
  const terminoBusqueda = filtros.busqueda?.trim() || undefined;
  const query = useInfiniteQuery({
    queryKey: ["expedientes", "bandeja", { pestana, terminoBusqueda, areaId, fechaDesde, fechaHasta, limite }],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => {
      const { data } = await apiClient.get<ResultadoBandejaRutaDoc>("/api/v1/expedientes", {
        params: { pestana, terminoBusqueda, areaId, fechaDesde, fechaHasta, limite, cursor: pageParam },
        signal,
      });
      return data;
    },
    getNextPageParam: (pagina) => pagina.tieneMas && pagina.siguienteCursor ? pagina.siguienteCursor : undefined,
    staleTime: 30_000,
    retry: false,
  });
  const paginas = query.data?.pages;
  const ultimo = paginas?.at(-1);
  // Un movimiento concurrente puede repetir un UUID entre páginas.
  const elementos = paginas
    ? [...new Map(paginas.flatMap(p => p.elementos).map(e => [e.idExpediente, e])).values()]
    : undefined;
  return { ...query, data: elementos, contadores: ultimo?.contadores,
    siguienteCursor: ultimo?.siguienteCursor, tieneMas: ultimo?.tieneMas ?? false };
}

/** Consulta independiente: no depende de filtros, caché o paginación de la bandeja. */
export function useExpedienteDetalle(id: string | undefined) {
  return useQuery({
    queryKey: ["expedientes", "detalle", id],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<ExpedienteDetalleRutaDoc>(
        `/api/v1/expedientes/${encodeURIComponent(id!)}`, { signal },
      );
      return data;
    },
    enabled: Boolean(id),
    staleTime: 0,
    retry: false,
  });
}
