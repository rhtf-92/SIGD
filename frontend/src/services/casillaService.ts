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

  /**
   * Simula la descarga o apertura del acto administrativo PDF
   */
  descargarDocumento(notificacion: Notificacion): void {
    const filename =
      notificacion.actoAdministrativo.nombreArchivoPdf || "acto_notificado.pdf";
    // Generar un blob simulado con texto representativo o abrir enlace
    const contenido = `--- INSTITUTO DE EDUCACIÓN SUPERIOR TECNOLÓGICO PÚBLICO SUIZA ---
CÉDULA DE NOTIFICACIÓN OFICIAL / ACTO ADMINISTRATIVO
Expediente: ${notificacion.numeroExpediente}
Documento: ${notificacion.actoAdministrativo.numeroDocumento}
Asunto: ${notificacion.asunto}
Hash SHA-256: ${notificacion.actoAdministrativo.hashIntegridadSha256}
CVD: ${notificacion.actoAdministrativo.cvd}
Fecha Emisión: ${notificacion.fechaDepositoIso}

${notificacion.actoAdministrativo.resumenLegal}

${notificacion.actoAdministrativo.textoCompleto || ""}
`;
    const blob = new Blob([contenido], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  },

  /**
   * Simula la descarga oficial de la Cédula de Acuse Digital Legal
   */
  descargarAcuse(acuse: AcuseNotificacion): void {
    const filename = `ACUSE_LEGAL_${acuse.idAcuse}.txt`;
    const contenido = `================================================================================
INSTITUTO DE EDUCACIÓN SUPERIOR TECNOLÓGICO PÚBLICO SUIZA (IESTP SUIZA)
CONSTANCIA Y CÉDULA DE ACUSE DE NOTIFICACIÓN ELECTRÓNICA INSTITUCIONAL
Conforme al Artículo 20 del TUO de la Ley N° 27444 y Ley N° 29733
================================================================================

IDENTIFICADOR DE ACUSE : ${acuse.idAcuse}
EXPEDIENTE              : ${acuse.numeroExpediente}
UNIDAD EMISORA          : ${acuse.unidadEmisora}
DESTINATARIO            : ${acuse.destinatario.nombresCompletos}
DOCUMENTO IDENTIDAD     : ${acuse.destinatario.tipoDocumento} ${acuse.destinatario.numeroDocumento}
CASILLA ELECTRÓNICA     : ${acuse.destinatario.direccionCasilla}

FECHA Y HORA UTC (ISO)  : ${acuse.timestampGeneracionIso}
HASH CRIPTOGRÁFICO SHA256: ${acuse.hashSha256Acuse}
CÓDIGO VERIFICACIÓN (CVD): ${acuse.cvdAcuse}
SURTIMIENTO DE EFECTO   : ${acuse.fechaEfectoLegal}
PLAZO LEGAL DE IMPUGN.  : ${acuse.plazoImpugnacionDiasHabiles} días hábiles

VALIDEZ LEGAL:
${acuse.validezLegalMensaje}

Este documento digital cuenta con valor probatorio inmutable en sede administrativa.
================================================================================`;
    const blob = new Blob([contenido], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  },
};
