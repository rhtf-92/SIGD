export type TipoNodoCcd = 'SERIE' | 'SUBSERIE';

export interface NodoCcd {
  id: string;
  codigo: string;
  nombre: string;
  tipo: TipoNodoCcd;
  seccion?: string;
  hijos: readonly NodoCcd[];
}

export interface ClasificadorCcdPort {
  obtenerArbol(): Promise<readonly NodoCcd[]>;
}
