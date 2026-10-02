/**
 * Módulo: Hook personalizado useCasilla (ENT-M01-03)
 * Administra el estado de la Casilla Electrónica, filtros reactivos, paginación,
 * apertura de modal de detalle y mutaciones seguras de Acuse Legal.
 */

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { casillaService } from "../services/casillaService";
import type {
  EstadoNotificacion,
  FiltrosCasilla,
  Notificacion,
  TipoNotificacion,
} from "../types/casilla";

export const CASILLA_QUERY_KEYS = {
  all: ["casilla"] as const,
  list: (filtros: FiltrosCasilla) => ["casilla", "list", filtros] as const,
  detail: (id: string) => ["casilla", "detail", id] as const,
  stats: ["casilla", "stats"] as const,
};

const FILTROS_INICIALES: FiltrosCasilla = {
  tipo: "TODOS",
  estado: "TODOS",
  fechaInicio: "",
  fechaFin: "",
  busqueda: "",
  page: 1,
  limit: 5,
};

export function useCasilla() {
  const queryClient = useQueryClient();

  // Estado de filtros y paginación
  const [filtros, setFiltros] = useState<FiltrosCasilla>(FILTROS_INICIALES);

  // Estado del modal de detalle
  const [selectedNotificacion, setSelectedNotificacion] =
    useState<Notificacion | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Query: Listado paginado de notificaciones
  const notificacionesQuery = useQuery({
    queryKey: CASILLA_QUERY_KEYS.list(filtros),
    queryFn: () => casillaService.getNotificaciones(filtros),
  });

  // Query: Estadísticas y contadores
  const statsQuery = useQuery({
    queryKey: CASILLA_QUERY_KEYS.stats,
    queryFn: () => casillaService.getEstadisticas(),
  });

  // Mutation: Marcar como leído
  const marcarLeidoMutation = useMutation({
    mutationFn: (id: string) => casillaService.marcarComoLeido(id),
    onSuccess: (notificacionActualizada) => {
      // Actualizar la notificación en el modal si está abierta
      setSelectedNotificacion((prev) =>
        prev && prev.id === notificacionActualizada.id
          ? notificacionActualizada
          : prev,
      );

      // Invalidar listas y estadísticas para sincronizar UI
      queryClient.invalidateQueries({ queryKey: CASILLA_QUERY_KEYS.all });
    },
  });

  // Mutation: Generar acuse digital legal
  const generarAcuseMutation = useMutation({
    mutationFn: (notificacionId: string) =>
      casillaService.generarAcuseLegal(notificacionId),
    onSuccess: (resultado) => {
      // Actualizar la notificación activa con el acuse generado
      setSelectedNotificacion(resultado.notificacionActualizada);

      // Sincronizar listas y contadores en caché
      queryClient.invalidateQueries({ queryKey: CASILLA_QUERY_KEYS.all });
    },
  });

  // Handlers para actualizar filtros
  const handleSetTipo = useCallback((tipo: TipoNotificacion | "TODOS") => {
    setFiltros((prev) => ({ ...prev, tipo, page: 1 }));
  }, []);

  const handleSetEstado = useCallback((estado: EstadoNotificacion | "TODOS") => {
    setFiltros((prev) => ({ ...prev, estado, page: 1 }));
  }, []);

  const handleSetFechaInicio = useCallback((fechaInicio: string) => {
    setFiltros((prev) => ({ ...prev, fechaInicio, page: 1 }));
  }, []);

  const handleSetFechaFin = useCallback((fechaFin: string) => {
    setFiltros((prev) => ({ ...prev, fechaFin, page: 1 }));
  }, []);

  const handleSetBusqueda = useCallback((busqueda: string) => {
    setFiltros((prev) => ({ ...prev, busqueda, page: 1 }));
  }, []);

  const handleSetPage = useCallback((page: number) => {
    setFiltros((prev) => ({ ...prev, page }));
  }, []);

  const handleSetLimit = useCallback((limit: number) => {
    setFiltros((prev) => ({ ...prev, limit, page: 1 }));
  }, []);

  const handleResetFiltros = useCallback(() => {
    setFiltros(FILTROS_INICIALES);
  }, []);

  // Abrir modal de detalle
  const handleOpenDetalle = useCallback(
    (notificacion: Notificacion) => {
      setSelectedNotificacion(notificacion);
      setIsModalOpen(true);

      // Si la notificación aún no ha sido leída, marcarla automáticamente
      if (notificacion.estado === "NO_LEIDO") {
        marcarLeidoMutation.mutate(notificacion.id);
      }
    },
    [marcarLeidoMutation],
  );

  // Cerrar modal de detalle
  const handleCloseDetalle = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  // Determinar si hay filtros activos diferentes a los valores iniciales
  const hasActiveFilters = useMemo(() => {
    return (
      filtros.tipo !== "TODOS" ||
      filtros.estado !== "TODOS" ||
      Boolean(filtros.fechaInicio) ||
      Boolean(filtros.fechaFin) ||
      Boolean(filtros.busqueda?.trim())
    );
  }, [filtros]);

  return {
    // Estado de filtros
    filtros,
    hasActiveFilters,
    setTipo: handleSetTipo,
    setEstado: handleSetEstado,
    setFechaInicio: handleSetFechaInicio,
    setFechaFin: handleSetFechaFin,
    setBusqueda: handleSetBusqueda,
    setPage: handleSetPage,
    setLimit: handleSetLimit,
    resetFiltros: handleResetFiltros,

    // Datos y estados asíncronos de la lista
    notificaciones: notificacionesQuery.data?.data ?? [],
    meta: notificacionesQuery.data?.meta ?? {
      currentPage: 1,
      totalPages: 1,
      totalItems: 0,
      itemsPerPage: 5,
      hasNextPage: false,
      hasPreviousPage: false,
    },
    isLoading: notificacionesQuery.isLoading,
    isError: notificacionesQuery.isError,
    error: notificacionesQuery.error,
    refetch: notificacionesQuery.refetch,

    // Estadísticas
    stats: statsQuery.data ?? {
      total: 0,
      noLeidos: 0,
      leidos: 0,
      notificados: 0,
      urgentes: 0,
    },
    isLoadingStats: statsQuery.isLoading,

    // Modal de Detalle
    isModalOpen,
    selectedNotificacion,
    openDetalle: handleOpenDetalle,
    closeDetalle: handleCloseDetalle,

    // Mutación de Acuse Legal
    generarAcuse: generarAcuseMutation.mutate,
    isGenerandoAcuse: generarAcuseMutation.isPending,
    generarAcuseError: generarAcuseMutation.error,
    generarAcuseSuccess: generarAcuseMutation.isSuccess,
  };
}
