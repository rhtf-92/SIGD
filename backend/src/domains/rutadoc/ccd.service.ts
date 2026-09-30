import { AppError } from '../../shared/domain/errors/app-error.js';
import type { ClasificadorCcdPort, NodoCcd } from './ccd.types.js';

export const clasificadorCcdNoConfigurado: ClasificadorCcdPort = Object.freeze({
  obtenerArbol: async () => {
    throw new AppError({ status: 503, code: 'CCD_NO_DISPONIBLE',
      message: 'El catálogo institucional CCD no tiene un contrato conectado.' });
  },
});

export class ServicioCcdRutaDoc {
  constructor(private readonly clasificador: ClasificadorCcdPort = clasificadorCcdNoConfigurado) {}

  async obtenerArbol(): Promise<readonly NodoCcd[]> {
    const nodos = await this.clasificador.obtenerArbol();
    const ordenar = (nivel: readonly NodoCcd[]): NodoCcd[] => [...nivel]
      .sort((a, b) => a.codigo < b.codigo ? -1 : a.codigo > b.codigo ? 1 : 0)
      .map((nodo) => ({ ...nodo, hijos: ordenar(nodo.hijos) }));
    return ordenar(nodos);
  }
}
