import type { TipoActoAdministrativo } from "./firmaDigital";

export interface FirmanteValidacion {
  nombre: string;
  cargo: string;
  fechaFirma: string;
  entidadCertificadora: string;
}

export interface DocumentoValidacionCvd {
  numeroDocumento: string;
  tipo: TipoActoAdministrativo;
  asunto: string;
  fechaEmision: string;
  firmantes: FirmanteValidacion[];
  hashIntegridadSha256: string;
  urlDescargaAutentica: string;
}

export interface ValidacionCVDResult {
  esValido: boolean;
  cvd: string;
  documento: DocumentoValidacionCvd | null;
  selloTiempoTsa: string | null;
  mensajeSeguridad: string;
}

export interface ErrorValidacionCvd {
  titulo: string;
  detalle: string;
  codigoEstado: number;
}