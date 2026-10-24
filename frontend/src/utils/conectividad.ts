// Verificación de conectividad real del navegador.
// `navigator.onLine` solo indica que existe una interfaz de red activa
// (puede estar conectada a un punto de acceso sin salida a internet), por
// eso se confirma con una sonda HTTP real contra el propio origen.

const TIMEOUT_SONDA_MS = 4000;

/**
 * Indica si el navegador puede resolver peticiones contra la red.
 * Ante cualquier duda (sin `fetch`, sin `location`, entorno de pruebas)
 * se devuelve el valor de `navigator.onLine`.
 */
export async function hayConectividadReal(): Promise<boolean> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return false;
  if (typeof fetch !== "function" || typeof window === "undefined") {
    return typeof navigator === "undefined" ? true : navigator.onLine;
  }

  const origen = window.location?.origin;
  if (!origen) return typeof navigator === "undefined" ? true : navigator.onLine;

  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIMEOUT_SONDA_MS);

  try {
    // `no-cors` evita depender de las cabeceras CORS del servidor: sólo
    // interesa saber si la pila de red consigue salir a internet.
    await fetch(`${origen}/?__sigd_sonda=${Date.now()}`, {
      method: "GET",
      mode: "no-cors",
      cache: "no-store",
      signal: controlador.signal,
    });
    return true;
  } catch {
    // Abort (timeout) o error de red: no hay salida a internet.
    return false;
  } finally {
    clearTimeout(temporizador);
  }
}
