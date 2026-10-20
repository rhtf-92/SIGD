/**
 * Módulo: Capa de Servicio del Asistente Virtual Institucional (AsistenteCore)
 * Centraliza las llamadas HTTP al contrato REST /api/v1/asistente.
 */

import { apiClient } from "../api/client";
import type {
  ConsultaAsistenteRequest,
  ConsultaAsistenteResponse,
  EstadoAsistenteResponse,
  SugerenciasAsistenteResponse,
} from "../types/asistente";

export const ASISTENTE_ENDPOINTS = {
  CONSULTA: "/api/v1/asistente/consulta",
  SUGERENCIAS: "/api/v1/asistente/sugerencias",
  ESTADO: "/api/v1/asistente/estado",
} as const;

export const asistenteService = {
  async consultar(
    payload: ConsultaAsistenteRequest,
  ): Promise<ConsultaAsistenteResponse> {
    const response = await apiClient.post<ConsultaAsistenteResponse>(
      ASISTENTE_ENDPOINTS.CONSULTA,
      payload,
    );
    return response.data;
  },

  async obtenerSugerencias(): Promise<SugerenciasAsistenteResponse> {
    const response = await apiClient.get<SugerenciasAsistenteResponse>(
      ASISTENTE_ENDPOINTS.SUGERENCIAS,
    );
    return response.data;
  },

  async obtenerEstado(): Promise<EstadoAsistenteResponse> {
    const response = await apiClient.get<EstadoAsistenteResponse>(
      ASISTENTE_ENDPOINTS.ESTADO,
    );
    return response.data;
  },
};
