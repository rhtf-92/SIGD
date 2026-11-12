/** Minúsculas, sin tildes/diacríticos y sin espacios extremos. */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .trim();
}

/** True si `texto` contiene `consulta` ignorando tildes y mayúsculas. Consulta vacía coincide con todo. */
export function textoCoincideBusqueda(texto: string, consulta: string): boolean {
  const needle = normalizarTexto(consulta);
  if (!needle) return true;
  return normalizarTexto(texto).includes(needle);
}
