export function calcularRangoFolios(ultimoFolio: number, paginas: number) {
  if (!Number.isSafeInteger(ultimoFolio) || ultimoFolio < 0 || !Number.isSafeInteger(paginas) || paginas <= 0 || !Number.isSafeInteger(ultimoFolio + paginas)) {
    throw new Error("El último folio debe ser un entero no negativo y las páginas un entero positivo seguro.");
  }
  return { inicio: ultimoFolio + 1, fin: ultimoFolio + paginas };
}

/** Verifica el rango de un nuevo documento sin modificar los folios consolidados. */
export function validarNuevoDocumento(ultimoFolio: number, paginas: number, inicio: number) {
  const rango = calcularRangoFolios(ultimoFolio, paginas);
  return { valido: Number.isSafeInteger(inicio) && inicio === rango.inicio, ...rango };
}
