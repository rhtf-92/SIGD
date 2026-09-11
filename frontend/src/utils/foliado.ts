export type ProblemaFoliado =
  | "VACIO"
  | "FORMATO"
  | "ENTERO_POSITIVO"
  | "DUPLICADO"
  | "INICIO"
  | "SALTO";

export type ResultadoFoliado =
  | { valido: true; total: number }
  | { valido: false; codigo: ProblemaFoliado; indice: number; mensaje: string };

/** Valida sin ordenar, convertir cadenas ni corregir el registro documental. */
export function validarFoliado(valores: readonly unknown[]): ResultadoFoliado {
  if (valores.length === 0) {
    return { valido: false, codigo: "VACIO", indice: 0, mensaje: "No hay folios registrados." };
  }
  const vistos = new Set<number>();
  for (const [indice, valor] of valores.entries()) {
    if (typeof valor !== "number") {
      return { valido: false, codigo: "FORMATO", indice, mensaje: "El folio debe ser numérico, sin letras, sufijos ni adiciones bis." };
    }
    if (!Number.isSafeInteger(valor) || valor <= 0) {
      return { valido: false, codigo: "ENTERO_POSITIVO", indice, mensaje: "Cada folio debe ser un entero positivo seguro." };
    }
    if (vistos.has(valor)) {
      return { valido: false, codigo: "DUPLICADO", indice, mensaje: "La foliación contiene números repetidos." };
    }
    if (indice === 0 && valor !== 1) {
      return { valido: false, codigo: "INICIO", indice, mensaje: "La foliación debe comenzar en F. 1." };
    }
    if (valor !== indice + 1) {
      return { valido: false, codigo: "SALTO", indice, mensaje: `La foliación debe continuar con F. ${indice + 1}, sin saltos ni cambios de orden.` };
    }
    vistos.add(valor);
  }
  return { valido: true, total: valores.length };
}

/** Solo origen propio o almacenamiento HTTPS expresamente autorizado. */
export function validarUrlDocumento(
  valor: string,
  origenActual: string,
  origenesPermitidos: readonly string[] = [],
): string | null {
  if (!valor.trim() || [...valor].some((caracter) => caracter.charCodeAt(0) <= 32 || caracter === "\\") || valor.startsWith("//")) return null;
  try {
    const url = new URL(valor, origenActual);
    if (url.username || url.password) return null;
    const mismoOrigen = url.origin === origenActual;
    if (url.protocol !== "https:" && !(mismoOrigen && url.protocol === "http:")) return null;
    if (!mismoOrigen && !origenesPermitidos.includes(url.origin)) return null;
    return url.href;
  } catch {
    return null;
  }
}
