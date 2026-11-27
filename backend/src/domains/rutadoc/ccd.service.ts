import type { ClasificadorCcdPort, NodoCcd } from './ccd.types.js';

export const SERIES_CCD_RUTADOC = Object.freeze([
  Object.freeze({ codigo: 'CCD-DG-RES', seccion: 'DIRECCION_GENERAL', nombre: 'Resoluciones Directorales' }),
  Object.freeze({ codigo: 'CCD-SA-ACTA', seccion: 'SECRETARIA_ACADEMICA', nombre: 'Actas de Evaluación y Certificados' }),
  Object.freeze({ codigo: 'CCD-SA-TIT', seccion: 'SECRETARIA_ACADEMICA', nombre: 'Expedientes de Titulación Profesional' }),
]);

export const catalogoCcdInicialRutaDoc: readonly NodoCcd[] = Object.freeze(
  SERIES_CCD_RUTADOC.map((serie) => Object.freeze({
    id: serie.codigo,
    codigo: serie.codigo,
    nombre: serie.nombre,
    tipo: 'SERIE' as const,
    seccion: serie.seccion,
    hijos: Object.freeze([]),
  })),
);

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
