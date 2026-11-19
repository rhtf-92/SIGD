export type ClasificacionAdjunto = 'EXPEDIENTE' | 'ANEXO';

export interface RequisitoDocumental {
  id: string;
  codigo: string;
  nombre: string;
  descripcion?: string;
  obligatorio: boolean;
  clasificacion: ClasificacionAdjunto;
  formatosAdmitidos?: readonly string[];
  observaciones?: string;
  fuente?: string;
  estadoValidacion?: string;
  versionTupa?: string;
  tipos: Array<{ id: string; codigo: string; nombre: string; condicion: string | null }>;
}

export interface DocumentacionTramite {
  id: string;
  codigo: string;
  codigoVisible?: string;
  numeroVisible?: string;
  denominacion: string;
  condicionFinanciera: 'GRATUITO' | 'SUJETO_PAGO' | 'PENDIENTE_VALIDACION';
  tarifa: { id?: string; importe: string; moneda: string; concepto: string; fuente?: string } | null;
  estadoValidacion?: string;
  sinAnexosEspecificos?: boolean;
  observacionInstitucional?: string;
  unidadRecepcion?: string;
  unidadResponsable?: string;
  autoridadResolutiva?: string;
  plazoDias?: number | null;
  silencioAdministrativo?: string | null;
  versionTupa?: string;
  requisitos: RequisitoDocumental[];
  anexos: RequisitoDocumental[];
  nota: string;
}
