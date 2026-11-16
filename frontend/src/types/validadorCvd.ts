import type { TipoActoAdministrativo } from "./firmaDigital";

export interface FirmanteValidacion {
  nombre: string;
  cargo: string | null;
  fechaFirma: string;
  entidadCertificadora: string | null;
}

export interface DocumentoValidacionCvd {
  numeroDocumento: string | null;
  tipo: TipoActoAdministrativo | null;
  asunto: string | null;
  fechaEmision: string | null;
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
