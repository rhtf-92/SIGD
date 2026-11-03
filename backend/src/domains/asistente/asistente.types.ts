/**
 * ==============================================================================
 * Módulo: Asistente Virtual Institucional del SIGD (AsistenteCore)
 * Sistema Integral de Gestión Documentaria (SIGD) - IESTP "Suiza"
 * ==============================================================================
 * Descripción:
 * Contratos y tipos canónicos del asistente virtual de atención al administrado.
 * El asistente es determinista (FAQ basado en el TUPA y la normativa vigente) y
 * su motor es enchufable: la interfaz `AsistenteMotor` permite sustituir o
 * complementar el FAQ con un motor LLM (RAG) sin tocar la capa de transporte.
 *
 * Normativa de referencia: TUO de la Ley N° 27444 (LPAG), D.S. N° 026-2016-PCM
 * (MGD), Ley N° 29733 (LPDP) y Directiva N° 001-2019-AGN.
 */

/** Pregunta del usuario hacia el asistente. */
export interface ConsultaAsistente {
  /** Texto libre del administrado (normalizado por el cliente). */
  mensaje: string;
  /** Identificador de sesión del widget (opcional, solo para trazabilidad). */
  sesionId?: string;
  /** Contexto de la vista actual (ruta, CUT, procedimiento, etc.). */
  contexto?: Record<string, unknown>;
}

/** Enlace de navegación interna que acompaña a una respuesta del asistente. */
export interface EnlaceAsistente {
  /** Texto visible del enlace. */
  etiqueta: string;
  /** Ruta interna de la SPA (p. ej. `/tramite/mesa-partes-virtual`). */
  ruta: string;
  /** Descripción breve opcional del destino. */
  descripcion?: string;
}

/** Respuesta canónica del asistente. */
export interface ResultadoAsistente {
  /** Texto de la respuesta listo para mostrar. */
  respuesta: string;
  /** Intención detectada (identificador de la entrada de conocimiento). */
  intencion: string;
  /** Nivel de confianza de la coincidencia, entre 0 y 1. */
  confianza: number;
  /** Fuentes normativas o documentales que respaldan la respuesta. */
  fuentes: string[];
  /** Sugerencias de continuación para el usuario. */
  sugerencias: string[];
  /** Enlaces internos de la SPA relacionados con la respuesta. */
  enlaces?: EnlaceAsistente[];
  /** Nombre del motor que produjo la respuesta. */
  motor: string;
}

/** Entrada de conocimiento (FAQ) que alimenta al motor determinista. */
export interface EntradaConocimiento {
  /** Identificador único de la intención. */
  id: string;
  /** Intención legible (p. ej. `requisitos_tramite`). */
  intencion: string;
  /** Palabras clave y sinónimos que disparan la intención. */
  palabrasClave: string[];
  /** Respuesta canónica con cita de fuente. */
  respuesta: string;
  /** Fuentes normativas/documentales. */
  fuentes: string[];
  /** Sugerencias de continuación. */
  sugerencias: readonly string[];
  /** Enlaces internos de la SPA relacionados con la respuesta. */
  enlaces?: EnlaceAsistente[];
}

/**
 * Puerto del motor del asistente. Diseñado para ser enchufable:
 * el FAQ es la implementación por defecto y un motor LLM (RAG) puede
 * implementar la misma interfaz y sustituirlo o complementarlo.
 */
export interface AsistenteMotor {
  /** Nombre del motor (reportado en `ResultadoAsistente.motor`). */
  readonly nombre: string;
  /** Resuelve una consulta y devuelve una respuesta fundamentada. */
  responder(mensaje: string): Promise<ResultadoAsistente>;
}

/**
 * Registro seudonimizado de consulta: no guarda texto plano, pero sus hashes
 * SHA-256 sin sal son determinísticos y no deben considerarse anónimos.
 */
export interface RegistroConsultaAsistente {
  /** Hash SHA-256 sin sal del mensaje; potencialmente vulnerable a diccionario. */
  mensajeHashSha256: string;
  /** Intención detectada. */
  intencion: string;
  /** Nivel de confianza. */
  confianza: number;
  /** Nombre del motor que atendió la consulta. */
  motor: string;
  /** Hash SHA-256 de la respuesta emitida. */
  respuestaHashSha256: string;
  /** Identificador de sesión (opcional). */
  sesionId: string | null;
}

/** Puerto de auditoría del asistente (implementación por defecto: bitácora WORM). */
export interface AsistenteAuditPort {
  registrarConsulta(registro: RegistroConsultaAsistente): Promise<void>;
}
