export type EstadoTramite =
  | "BORRADOR"
  | "REGISTRADO"
  | "EN_TRAMITE"
  | "EN_REVISION"
  | "OBSERVADO"
  | "SUBSANADO"
  | "APROBADO"
  | "PARA_FIRMA"
  | "RESUELTO"
  | "ANULADO";

export type EstadoEtapaWorkflow =
  | "COMPLETADA"
  | "EN_CURSO"
  | "BLOQUEADA"
  | "OBSERVADA";

export type RolResponsableEtapa =
  | "admin"
  | "responsable"
  | "operador"
  | "consulta";

export interface RequisitoEtapa {
  idRequisito: number;
  descripcion: string;
  cumplido: boolean;
  fechaCumplimiento?: string;
}

export interface EtapaFlujoAcademico {
  idEtapa: number;
  orden: number;
  codigo: string;
  nombreEtapa: string;
  unidadOrganica: string;
  rolResponsable: RolResponsableEtapa;
  plazoSlaDias: number;
  descripcion: string;
  requisitos: RequisitoEtapa[];
  observacion?: string;
  fechaInicio?: string;
  fechaFin?: string;
}

export interface EtapaWorkflowVisual extends EtapaFlujoAcademico {
  estado: EstadoEtapaWorkflow;
}

export interface SolicitanteTramite {
  idPersona: number;
  numeroDocumento: string;
  nombres: string;
  apellidos: string;
  correoElectronico: string;
}

export interface CertificadoResolucion {
  hashSha256: string;
  cvd: string;
}

export interface WorkflowAcademico {
  idTramite: number;
  cut: string;
  codigoProcedimiento: "PROC-ACA-01";
  nombreTramite: string;
  programa: string;
  solicitante: SolicitanteTramite;
  estado: EstadoTramite;
  etapaActualId: number;
  slaDiasTotales: number;
  fechaRegistro: string;
  fechaLimiteSla: string;
  etapas: EtapaFlujoAcademico[];
  certificado?: CertificadoResolucion;
}

export const TRANSICIONES_FSM: Readonly<
  Record<EstadoTramite, readonly EstadoTramite[]>
> = {
  BORRADOR: ["REGISTRADO"],
  REGISTRADO: ["EN_TRAMITE", "ANULADO"],
  EN_TRAMITE: ["EN_REVISION"],
  EN_REVISION: ["OBSERVADO", "APROBADO", "ANULADO"],
  OBSERVADO: ["SUBSANADO", "ANULADO"],
  SUBSANADO: ["EN_REVISION"],
  APROBADO: ["EN_TRAMITE", "PARA_FIRMA"],
  PARA_FIRMA: ["RESUELTO", "ANULADO"],
  RESUELTO: [],
  ANULADO: [],
};

export const ETIQUETA_ESTADO_TRAMITE: Readonly<Record<EstadoTramite, string>> = {
  BORRADOR: "Borrador",
  REGISTRADO: "Registrado",
  EN_TRAMITE: "En trámite",
  EN_REVISION: "En revisión",
  OBSERVADO: "Observado",
  SUBSANADO: "Subsanado",
  APROBADO: "Aprobado",
  PARA_FIRMA: "Para firma",
  RESUELTO: "Resuelto",
  ANULADO: "Anulado",
};