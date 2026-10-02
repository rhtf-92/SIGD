export interface NodoCatalogoCcd { id: string; codigo: string; nombre: string; tipo: "SERIE" | "SUBSERIE"; hijos: NodoCatalogoCcd[] }
export interface RangoServidor { idDocumento: string; nombre: string | null; folioInicio: number; folioFin: number; cantidadFolios: number }
export function rutaApi(base: string, ruta: string): string {
  const url = new URL(base, window.location.origin);
  url.pathname = url.pathname.replace(/\/api(?:\/v1)?\/?$/, "").replace(/\/$/, "") + "/api/v1/" + ruta;
  url.search = ""; url.hash = "";
  return url.href;
}
async function consultar(base: string, ruta: string, signal: AbortSignal): Promise<unknown> {
  const token = localStorage.getItem("sigd_token") || localStorage.getItem("token") || sessionStorage.getItem("sigd_token") || sessionStorage.getItem("token");
  const respuesta = await fetch(rutaApi(base, ruta), { signal, credentials: "same-origin", headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!respuesta.ok) throw new Error(respuesta.status === 401 ? "Debe iniciar sesión para consultar estos datos." : respuesta.status === 403 ? "Su cuenta no tiene permiso para consultar estos datos." : respuesta.status === 404 ? "El servidor no tiene disponible este recurso. Revise el montaje de las rutas." : "No se pudo consultar el servidor.");
  return respuesta.json();
}
function objeto(x: unknown): Record<string, unknown> {
  if (!x || typeof x !== "object" || Array.isArray(x)) throw new Error("Respuesta del servidor no válida.");
  return x as Record<string, unknown>;
}
export function leerCatalogo(valor: unknown): NodoCatalogoCcd[] {
  const elementos = objeto(valor).elementos;
  const ids = new Set<string>(); let cuenta = 0;
  function nivel(valor: unknown, profundidad: number): NodoCatalogoCcd[] {
    if (!Array.isArray(valor) || profundidad > 10) throw new Error("Catálogo CCD no válido.");
    return valor.map(x => {
      const n = objeto(x);
      if (++cuenta > 10000 || typeof n.id !== "string" || !n.id || ids.has(n.id) || typeof n.codigo !== "string" || !n.codigo || typeof n.nombre !== "string" || !n.nombre || (n.tipo !== "SERIE" && n.tipo !== "SUBSERIE")) throw new Error("Nodo CCD no válido.");
      ids.add(n.id);
      return { id: n.id, codigo: n.codigo, nombre: n.nombre, tipo: n.tipo, hijos: nivel(n.hijos, profundidad + 1) };
    });
  }
  return nivel(elementos, 0);
}
export function leerRangos(valor: unknown): RangoServidor[] {
  if (!Array.isArray(valor)) throw new Error("Foliación del servidor no válida.");
  let esperado = 1; const ids = new Set<string>();
  return valor.map(x => {
    const n = objeto(x);
    if (typeof n.idDocumento !== "string" || !n.idDocumento || ids.has(n.idDocumento) || (n.nombre !== null && typeof n.nombre !== "string") || typeof n.folioInicio !== "number" || typeof n.folioFin !== "number" || typeof n.cantidadFolios !== "number" || !Number.isSafeInteger(n.folioInicio) || !Number.isSafeInteger(n.folioFin) || !Number.isSafeInteger(n.cantidadFolios) || n.folioInicio !== esperado || n.folioFin < n.folioInicio || n.cantidadFolios !== n.folioFin - n.folioInicio + 1 || n.folioFin > 100000) throw new Error("El servidor devolvió folios incongruentes o un expediente demasiado grande para el visor.");
    ids.add(n.idDocumento); esperado = n.folioFin + 1;
    return { idDocumento: n.idDocumento, nombre: n.nombre, folioInicio: n.folioInicio, folioFin: n.folioFin, cantidadFolios: n.cantidadFolios };
  });
}
export async function obtenerCatalogo(base: string, signal: AbortSignal) { return leerCatalogo(await consultar(base, "expedientes/clasificador-ccd", signal)); }
export async function obtenerFoliacion(base: string, id: string, signal: AbortSignal) {
  if (!/^[1-9]\d*$/.test(id) || BigInt(id) > 9223372036854775807n) throw new Error("Indique un identificador numérico de expediente válido.");
  return leerRangos(await consultar(base, `expedientes/${encodeURIComponent(id)}/foliacion`, signal));
}
