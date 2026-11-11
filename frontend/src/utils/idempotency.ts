/**
 * ==============================================================================
 * MODULO: idempotency.ts (Frontend SIGD)
 * ==============================================================================
 * Gestor de ciclo de vida de Claves de Idempotencia por Intención de Usuario.
 * Cumple con los requerimientos de la Fase 5H:
 * - Una clave UUID estable por intención de mutación (ej. click en derivar/observar/etc.).
 * - Reintentos de la misma intención conservan la misma clave de idempotencia.
 * - Nuevas intenciones generan una nueva clave independiente.
 * - Cambio de contexto operativo purga la clave activa para evitar colisiones cruzadas.
 * ==============================================================================
 */

let claveIdempotenciaActiva: string | null = null;

/**
 * Genera un identificador universal único (UUID v4) seguro para idempotencia.
 */
export function generarClaveIdempotencia(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `idemp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Establece la clave de idempotencia actualmente activa para solicitudes mutantes.
 */
export function establecerClaveIdempotenciaActiva(clave: string | null): void {
  claveIdempotenciaActiva = clave;
}

/**
 * Obtiene la clave de idempotencia activa actualmente, si existe una intención en curso.
 */
export function obtenerClaveIdempotenciaActiva(): string | null {
  return claveIdempotenciaActiva;
}

/**
 * Purga la clave de idempotencia activa. Debe ejecutarse al completar una mutación
 * o al cambiar de contexto operativo (PERSONAL <-> INSTITUCIONAL).
 */
export function limpiarClaveIdempotenciaActiva(): void {
  claveIdempotenciaActiva = null;
}
