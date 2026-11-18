export type TipoActoAdministrativo =
  | "RD"
  | "ACTA"
  | "CERTIFICADO"
  | "OFICIO"
  | "CONSTANCIA";

export type EstadoFirmaDocumento = "PENDIENTE" | "FIRMADO" | "OBSERVADO";

export interface DocumentoOficial {
  idDocumento: number;
  idTramite: number;
  tipoActo: TipoActoAdministrativo;
  numeroCorrelativo: string;
  anio: number;
  asunto: string;
  urlPdfOriginal: string;
  urlPdfFirmado?: string;
  hashSha256: string;
  cvd?: string;
  estadoFirma: EstadoFirmaDocumento;
  fechaGeneracion: string;
}

export type ProveedorFirma = "REFIRMA_RENIEC" | "IOFE_INDECOPI";

export interface FirmaDigitalRegistro {
  idFirma: number;
  idDocumento: number;
  firmanteDni: string;
  firmanteNombre: string;
  cargo: string;
  proveedorFirma: ProveedorFirma;
  selloTiempoTimestamp: string;
  estado: "VALIDO" | "REVOCADO" | "INVALIDO";
}

export type MecanismoFirma = "DNIE" | "TOKEN_USB" | "CERTIFICADO_SOFTWARE";

export interface RefirmaParamDTO {
  idDocumento: number;
  firmanteDni: string;
  tokenSesion: string;
  hashSha256: string;
  urlCallback: string;
  proveedor: ProveedorFirma;
}

export interface FirmadoPadesDTO {
  idDocumento: number;
  tokenSesion: string;
  archivoFirmadoBase64: string;
  selloTiempoTokenBase64: string;
}

export interface RefirmaRespuestaDTO {
  cvd: string;
  urlFirmado: string;
  timestamp: string;
}

export type EstadoGatewayRefirma =
  | "INACTIVO"
  | "PREPARANDO"
  | "CONECTANDO"
  | "ESPERANDO_PIN"
  | "SOLICITANDO_TSA"
  | "SELLANDO_CVD"
  | "COMPLETADO"
  | "ERROR"
  | "TIMEOUT";

export type PasoProcesoFirma =
  | "CONECTANDO_AGENTE"
  | "ESPERANDO_PIN"
  | "SOLICITANDO_TSA"
  | "SELLANDO_CVD";

export type EstadoFirmaLote = "PENDIENTE" | "EN_FIRMA" | "FIRMADO" | "ERROR";