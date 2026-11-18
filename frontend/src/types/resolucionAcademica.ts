/**
 * Contratos de datos para el Proyector de Resoluciones Directorales (ENT-M04-02).
 * Formato oficial institucional del IESTP "Suiza" (Pucallpa, Ucayali).
 */

export type TipoResolucion =
  | "TITULACION"
  | "GRADO_ACADEMICO"
  | "RECTIFICACION_NOTA"
  | "CONVALIDACION"
  | "DISPOSICION_GENERAL";

export type EstadoResolucion =
  | "BORRADOR"
  | "EN_REVISION"
  | "APROBADO_PARA_FIRMA"
  | "FIRMADO_DIGITALMENTE";

export interface ArticuloResolucion {
  id: string;
  numero: number;
  texto: string;
}

export interface ResolucionDirectoral {
  id: string;
  numeroResolucion: string; // Ej: "RD N.° 0412-2026-DG-IESTP-SUIZA"
  anio: number;
  tipo: TipoResolucion;
  asunto: string;
  unidadOrganica: string; // Ej: "Dirección General"
  fechaEmision: string; // ISO 8601
  expedienteRelacionado?: string; // CUT del expediente (ej. EXP-2026-000412)
  administradoNombre: string;
  administradoDocumento: string;
  programaEstudios: string; // Ej: "Desarrollo de Sistemas de Información"
  visto: string;
  considerandos: string[];
  articulos: ArticuloResolucion[];
  firmanteCargo: string;
  firmanteNombre: string;
  estado: EstadoResolucion;
  hashBorradorSha256?: string;
}

export interface PlantillaResolucion {
  id: string;
  nombre: string;
  tipo: TipoResolucion;
  vistoBase: string;
  considerandosBase: string[];
  articulosBase: string[];
}
