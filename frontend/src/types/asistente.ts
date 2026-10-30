/**
 * Módulo: Asistente Virtual Institucional (AsistenteCore)
 * Sistema Integral de Gestión Documentaria (SIGD) - IESTP "Suiza"
 * Contratos del cliente del asistente virtual (contrato REST /api/v1/asistente).
 */

export type RolMensajeAsistente = "usuario" | "asistente";

export interface EnlaceAsistente {
  etiqueta: string;
  ruta: string;
  descripcion?: string;
}

export interface MensajeAsistente {
  id: string;
  rol: RolMensajeAsistente;
  texto: string;
  fuentes?: string[];
  sugerencias?: string[];
  enlaces?: EnlaceAsistente[];
  fecha: string;
}

export interface ConsultaAsistenteRequest {
  mensaje: string;
  sesionId?: string;
  contexto?: Record<string, unknown>;
}

export interface ConsultaAsistenteResponse {
  respuesta: string;
  intencion: string;
  confianza: number;
  fuentes: string[];
  sugerencias: string[];
  enlaces?: EnlaceAsistente[];
  motor: string;
  correlationId: string;
}

export interface SugerenciasAsistenteResponse {
  sugerencias: string[];
}

export interface EstadoAsistenteResponse {
  estado: "UP" | "DOWN";
  motor: string;
  version: string;
  normativa: string[];
}
