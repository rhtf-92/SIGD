/** Modelos de presentación. No sustituyen DTO del servidor. */
export type EstadoRecurso<T> =
  | { estado: "cargando" }
  | { estado: "vacio" }
  | { estado: "error"; mensaje: string }
  | { estado: "listo"; datos: T };

export interface SerieDocumental {
  readonly tipo: "serie";
  readonly id: string;
  readonly nombre: string;
  readonly codigo: string;
  readonly deshabilitada?: boolean;
}

export interface SeccionOrganica {
  readonly tipo: "seccion";
  readonly id: string;
  readonly nombre: string;
  readonly series: readonly SerieDocumental[];
}

export interface FondoDocumental {
  readonly tipo: "fondo";
  readonly id: string;
  readonly nombre: "IESTP_SUIZA";
  readonly secciones: readonly SeccionOrganica[];
}

export type NodoCcd = FondoDocumental | SeccionOrganica | SerieDocumental;

export interface RutaCcdSeleccionada {
  readonly fondo: FondoDocumental;
  readonly seccion: SeccionOrganica;
  readonly serie: SerieDocumental;
}

export interface CcdTreeSelectorProps {
  recurso: EstadoRecurso<readonly FondoDocumental[]>;
  seleccion: RutaCcdSeleccionada | null;
  onSeleccionar: (ruta: RutaCcdSeleccionada | null) => void;
  disabled?: boolean;
  permitirLimpiar?: boolean;
}

export interface FolioDocumental {
  readonly numero: number;
  /** Página dentro del documento, desde 1. La numeración del folio es global. */
  readonly pagina: number;
  /** Imagen de una sola página; nunca un PDF con navegación independiente. */
  readonly urlImagen?: string;
}

export interface DocumentoExpediente {
  readonly id: string;
  readonly nombre: string;
  readonly folios: readonly FolioDocumental[];
  readonly urlOriginal?: string;
}

export interface FoliadoDocumentoViewerProps {
  recurso: EstadoRecurso<readonly DocumentoExpediente[]>;
  /** Orígenes HTTPS de almacenamiento autorizados por la integración. */
  origenesPermitidos?: readonly string[];
}
