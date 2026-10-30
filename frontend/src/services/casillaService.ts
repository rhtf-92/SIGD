/**
 * Módulo: Capa de Servicio para Casilla Electrónica y Acuse Legal (ENT-M01-05)
 * Centraliza las llamadas HTTP reales, sin mocks ni datos en memoria.
 * Consume los endpoints de Casilla protegidos por JWT.
 */

import { apiClient } from "../api/client";
import type {
  AcuseNotificacion,
  EstadisticasCasilla,
  FiltrosCasilla,
  GenerarAcuseRequest,
  GenerarAcuseResponse,
  Notificacion,
  NotificacionesResponse,
} from "../types/casilla";

// ===========================================================================
// CONSTANTES DE ENDPOINTS (Fácilmente editables según documentación del backend)
// ===========================================================================
export const CASILLA_ENDPOINTS = {
  /**
   * GET /api/v1/casilla/notificaciones
   * Query params: page, limit, tipo, estado, fechaInicio, fechaFin, busqueda
   */
  LISTAR_NOTIFICACIONES: "/api/v1/casilla/notificaciones",

  /**
   * GET /api/v1/casilla/notificaciones/:id
   * Obtiene el detalle completo del acto administrativo y notificación
   */
  DETALLE_NOTIFICACION: (id: string) => `/api/v1/casilla/notificaciones/${id}`,

  /**
   * PATCH /api/v1/casilla/notificaciones/:id/lectura
   * Registra el primer acceso/lectura del administrado
   */
  MARCAR_LEIDO: (id: string) => `/api/v1/casilla/notificaciones/${id}/lectura`,

  /**
   * POST /api/v1/casilla/notificaciones/:id/acuse
   * Solicita al backend la generación inmutable del acuse digital legal
   * Body: { confirmacionAdministrado: boolean }
   * Response: { success: boolean, data: AcuseNotificacion (con timestamp ISO-8601 y hash SHA-256) }
   */
  GENERAR_ACUSE: (id: string) => `/api/v1/casilla/notificaciones/${id}/acuse`,

  /**
   * GET /api/v1/casilla/estadisticas
   * Retorna métricas de la casilla (no leídos, notificados, etc.)
   */
  ESTADISTICAS: "/api/v1/casilla/estadisticas",

  /**
   * GET /api/v1/casilla/notificaciones/:id/documento/descargar
   * Descarga el acto administrativo en PDF
   */
  DESCARGAR_DOCUMENTO: (id: string) =>
    `/api/v1/casilla/notificaciones/${id}/documento/descargar`,

  /**
   * GET /api/v1/casilla/notificaciones/:id/acuse/descargar
   * Descarga la cédula oficial de acuse de recibo en PDF
   */
  DESCARGAR_ACUSE: (id: string) =>
    `/api/v1/casilla/notificaciones/${id}/acuse/descargar`,
} as const;

// ===========================================================================
// SERVICIO DE CASILLA ELECTRÓNICA
// ===========================================================================
export const casillaService = {
  /**
   * Obtiene el listado paginado de notificaciones aplicando filtros de tipo, fecha y estado
   */
  async getNotificaciones(
    filtros: FiltrosCasilla,
  ): Promise<NotificacionesResponse> {
    const response = await apiClient.get<NotificacionesResponse>(
      CASILLA_ENDPOINTS.LISTAR_NOTIFICACIONES,
      {
        params: {
          page: filtros.page,
          limit: filtros.limit,
          tipo: filtros.tipo !== "TODOS" ? filtros.tipo : undefined,
          estado: filtros.estado !== "TODOS" && filtros.estado !== undefined
            ? filtros.estado
            : undefined,
          fechaInicio: filtros.fechaInicio || undefined,
          fechaFin: filtros.fechaFin || undefined,
          busqueda: filtros.busqueda || undefined,
        },
      },
    );
    return response.data;
  },

  /**
   * Obtiene una notificación por su identificador
   */
  async getNotificacionById(id: string): Promise<Notificacion> {
    const response = await apiClient.get<Notificacion>(
      CASILLA_ENDPOINTS.DETALLE_NOTIFICACION(id),
    );
    return response.data;
  },

  /**
   * Marca una notificación como LEÍDA tras su apertura en el modal
   */
  async marcarComoLeido(id: string): Promise<Notificacion> {
    const response = await apiClient.patch<Notificacion>(
      CASILLA_ENDPOINTS.MARCAR_LEIDO(id),
    );
    return response.data;
  },

  /**
   * Genera el Acuse Digital Legal (Fecha cierta ISO-8601 + Hash SHA-256 + CVD)
   * ¡IMPORTANTE!: Los valores criptográficos y de tiempo son provistos por el servidor.
   * El cliente solo los solicita formalmente y los visualiza.
   */
  async generarAcuseLegal(
    notificacionId: string,
    payload?: Partial<GenerarAcuseRequest>,
  ): Promise<GenerarAcuseResponse> {
    const response = await apiClient.post<GenerarAcuseResponse>(
      CASILLA_ENDPOINTS.GENERAR_ACUSE(notificacionId),
      {
        notificacionId,
        confirmacionAdministrado: true,
        metadataCliente: {
          navegador: navigator.userAgent,
          zonaHoraria: Intl.DateTimeFormat().resolvedOptions().timeZone,
          ...payload?.metadataCliente,
        },
      },
    );
    return response.data;
  },

  /**
   * Obtiene estadísticas de la casilla del usuario
   */
  async getEstadisticas(): Promise<EstadisticasCasilla> {
    const response = await apiClient.get<EstadisticasCasilla>(
      CASILLA_ENDPOINTS.ESTADISTICAS,
    );
    return response.data;
  },

  async descargarDocumento(notificacion: Notificacion): Promise<void> {
    const { data } = await apiClient.get<{ downloadUrl: string }>(
      CASILLA_ENDPOINTS.DESCARGAR_DOCUMENTO(notificacion.id),
    );
    const link = document.createElement("a");
    link.href = data.downloadUrl;
    link.rel = "noopener noreferrer";
    link.click();
  },

  async descargarAcuse(acuse: AcuseNotificacion): Promise<void> {
    const { data } = await apiClient.get<{ downloadUrl: string }>(
      CASILLA_ENDPOINTS.DESCARGAR_ACUSE(acuse.idNotificacion),
    );
    const link = document.createElement("a");
    link.href = data.downloadUrl;
    link.rel = "noopener noreferrer";
    link.click();
  },
};
