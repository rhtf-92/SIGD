/**
 * Módulo: Capa de Servicio para Casilla Electrónica y Acuse Legal (ENT-M01-05)
 * Centraliza las llamadas HTTP reales, sin mocks ni datos en memoria.
 * NOTA: al momento de esta implementación, el endpoint GET /api/v1/casilla/notificaciones
 * todavía no está registrado como ruta Express en la rama de backend B_JAIR
 * (CasillaService/CasillaController existen pero no hay casilla.routes.ts).
 * Las llamadas quedan correctas contra el contrato documentado y funcionarán
 * automáticamente en cuanto el equipo de backend conecte la ruta.
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
    await apiClient.patch(
      CASILLA_ENDPOINTS.MARCAR_LEIDO(id),
    );
    // El PATCH devuelve un comprobante de lectura, no el DTO del modal.
    return casillaService.getNotificacionById(id);
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

  /** Descarga el PDF autorizado por el backend, sin generar un documento sustituto. */
  async descargarDocumento(notificacion: Notificacion): Promise<void> {
    await descargarPdf(
      CASILLA_ENDPOINTS.DESCARGAR_DOCUMENTO(notificacion.id),
      notificacion.actoAdministrativo.nombreArchivoPdf || "acto_notificado.pdf",
    );
  },

  async descargarAcuse(acuse: AcuseNotificacion): Promise<void> {
    await descargarPdf(
      CASILLA_ENDPOINTS.DESCARGAR_ACUSE(acuse.idNotificacion),
      `ACUSE_LEGAL_${acuse.idAcuse}.pdf`,
    );
  },
};

async function descargarPdf(endpoint: string, nombreArchivo: string): Promise<void> {
  const respuesta = await apiClient.get<{ downloadUrl: string }>(endpoint);
  let downloadUrl = respuesta.data?.downloadUrl;
  // Las rutas de Casilla pueden remitir al endpoint protegido de Storage.
  // Sólo esa ruta recibe el JWT del cliente HTTP; nunca se envía a S3.
  if (typeof downloadUrl === "string" && downloadUrl.startsWith("/api/v1/storage/download/")) {
    const descarga = await apiClient.get<{ downloadUrl: string }>(downloadUrl);
    downloadUrl = descarga.data?.downloadUrl;
  }
  let url: URL;
  try {
    url = new URL(downloadUrl);
  } catch {
    throw new Error("El servidor no proporcionó una URL de descarga válida.");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("El servidor no proporcionó una URL de descarga válida.");
  }
  const archivo = await fetch(url.href, { credentials: "omit" });
  if (!archivo.ok) throw new Error("No se pudo obtener el archivo del almacenamiento.");
  const bytes = await archivo.arrayBuffer();
  const firmaPdf = new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 5));
  if (String.fromCharCode(...firmaPdf) !== "%PDF-") {
    throw new Error("El almacenamiento no devolvió un documento PDF.");
  }
  const blobUrl = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  try {
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = nombreArchivo;
    link.click();
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}
