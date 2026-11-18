export type TipoNodoCcd = 'SERIE' | 'SUBSERIE';

export interface NodoCcd {
  id: string;
  codigo: string;
  nombre: string;
  tipo: TipoNodoCcd;
  hijos: readonly NodoCcd[];
}

export interface ClasificadorCcdPort {
  obtenerArbol(): Promise<readonly NodoCcd[]>;
}
