export interface MetadataDocumento {
  checksumSha256: string | null;
  nombre?: string | null;
  tipo?: string | null;
}

export interface DocumentoMetadataPort {
  obtenerMetadataDocumento(documentoId: string): Promise<MetadataDocumento>;
}

export interface FolioExpediente {
  idDocumento: string;
  nombre: string | null;
  tipo: string | null;
  folioInicio: number;
  folioFin: number;
  cantidadFolios: number;
  rango: string;
  checksumSha256: string | null;
}

export interface RepositorioFoliacionRutaDoc {
  existeExpediente(idExpediente: string): Promise<boolean>;
  listar(idExpediente: string): Promise<readonly Omit<FolioExpediente,
    'nombre' | 'tipo' | 'rango' | 'checksumSha256'>[]>;
}
