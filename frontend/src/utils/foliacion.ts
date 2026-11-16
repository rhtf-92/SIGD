/**
 * Calcula la foliación correlativa ininterrumpida de documentos en frontend.
 * Réplica idéntica y determinista de backend/src/domains/tramicore/pdfFoliacion.ts
 * 
 * Regla:
 * - Doc 1 (2 págs) -> Folios 1 al 2
 * - Doc 2 (1 pág)  -> Folio 3
 * - Doc 3 (3 págs) -> Folios 4 al 6
 * - Doc 4 (4 págs) -> Folios 7 al 10
 * Total = 10 folios.
 */
export function calcularFoliacionFront<T extends { paginas?: number }>(
  documentos: T[],
  folioBase = 1,
): { documentosFoliados: Array<T & { paginas: number; folioInicio: number; folioFin: number }>; totalFolios: number } {
  let actual = Math.max(1, folioBase);
  let totalFolios = 0;

  const documentosFoliados = documentos.map((doc) => {
    const pags = Math.max(1, doc.paginas ?? 1);
    const folioInicio = actual;
    const folioFin = actual + pags - 1;
    actual = folioFin + 1;
    totalFolios += pags;
    return {
      ...doc,
      paginas: pags,
      folioInicio,
      folioFin,
    };
  });

  return { documentosFoliados, totalFolios };
}
