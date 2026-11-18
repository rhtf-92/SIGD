import type { ClasificadorCcdPort, NodoCcd } from './ccd.types.js';

/** Seed mínimo RutaDoc hasta que se publique el CCD institucional canónico. */
export const catalogoCcdInicialRutaDoc: readonly NodoCcd[] = Object.freeze([
  Object.freeze({
    id: 'rutadoc-serie-demo-01',
    codigo: 'DEMO-01',
    nombre: 'Serie de ejemplo (no oficial)',
    tipo: 'SERIE' as const,
    hijos: Object.freeze([
      Object.freeze({
        id: 'rutadoc-subserie-demo-01-01',
        codigo: 'DEMO-01.01',
        nombre: 'Subserie de ejemplo (no oficial)',
        tipo: 'SUBSERIE' as const,
        hijos: Object.freeze([]),
      }),
    ]),
  }),
]);

/** Implementación autónoma sustituible por el port del catálogo institucional. */
export const clasificadorCcdPredeterminadoRutaDoc: ClasificadorCcdPort = Object.freeze({
  obtenerArbol: async () => catalogoCcdInicialRutaDoc,
});

export class ServicioCcdRutaDoc {
  constructor(private readonly clasificador: ClasificadorCcdPort = clasificadorCcdPredeterminadoRutaDoc) {}

  async obtenerArbol(): Promise<readonly NodoCcd[]> {
    const nodos = await this.clasificador.obtenerArbol();
    const ordenar = (nivel: readonly NodoCcd[]): NodoCcd[] => [...nivel]
      .sort((a, b) => a.codigo < b.codigo ? -1 : a.codigo > b.codigo ? 1 : 0)
      .map((nodo) => ({ ...nodo, hijos: ordenar(nodo.hijos) }));
    return ordenar(nodos);
  }
}
