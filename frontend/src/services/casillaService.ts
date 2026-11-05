/**
 * Módulo: Capa de Servicio para Casilla Electrónica y Acuse Legal (ENT-M01-05)
 * Centraliza las llamadas HTTP reales, sin mocks ni datos en memoria.
 * Consume los endpoints autenticados de Casilla y sus descargas reales.
 */

import { apiClient } from "../api/client";
import { env } from "../config/env";
import type {
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
   * Solicita al backend el registro idempotente del acuse
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
   * Descarga el PDF generado a partir del registro del acuse
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
   * Registra el acuse y muestra fecha/hora y hash provistos por el servidor.
   * El hash del registro no acredita por sí solo la firma de un PDF.
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

  /** Solicita al backend una URL temporal tras validar la propiedad del documento. */
  async descargarDocumento(notificacionId: string): Promise<void> {
    const { data } = await apiClient.get<{ downloadUrl: string }>(
      CASILLA_ENDPOINTS.DESCARGAR_DOCUMENTO(notificacionId),
    );
    if (!data.downloadUrl) throw new Error("El servidor no devolvió el enlace del documento.");
    const { data: firmado } = await apiClient.get<{ downloadUrl: string }>(data.downloadUrl);
    if (!firmado.downloadUrl) throw new Error("El servidor no devolvió el enlace temporal de descarga.");
    window.location.assign(new URL(firmado.downloadUrl, env.apiBaseUrl).toString());
  },

  /** Descarga el PDF de acuse generado y servido por el backend. */
  async descargarAcuse(notificacionId: string): Promise<void> {
    const response = await apiClient.get<Blob>(CASILLA_ENDPOINTS.DESCARGAR_ACUSE(notificacionId), {
      responseType: "blob",
    });
    const blob = response.data;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ACUSE_${notificacionId}.pdf`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  },
};
