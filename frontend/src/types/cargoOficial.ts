/**
 * Contratos de datos para Ventanilla Presencial y Cargo de Recepción CUT (ENT-M02-05).
 */

export interface CargoOficialTramite {
  codigoExpediente: string; // EXP-YYYY-XXXXXX
  fechaRecepcionIso: string;
  fechaIngresoFormalIso: string;
  horaRecepcion: string;
  operadorVentanillaNombre: string;
  sedeInstitucional: string; // "Sede Central - Jr. Tarapacá N° 645, Pucallpa"
  solicitante: {
    tipoPersona: "NATURAL" | "JURIDICA";
    tipoDocumento: "DNI" | "RUC" | "CE";
    numeroDocumento: string;
    nombreOrazonSocial: string;
    correoElectronico: string;
    telefono: string;
  };
  asunto: string;
  documentoPrincipalTipo: string;
  cantidadFolios: number;
  hashSha256Recepcion: string;
  horaCorteAplicada: string; // "16:30"
  radicadoDiaSiguiente: boolean;
  urlSeguimiento: string;
}
