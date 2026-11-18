import type { CategoriaTupa } from '../data/tupaSuiza2026CatalogoCompleto';

export type TipoFormularioTupa =
  | 'DOCUMENTARIO'
  | 'ACADEMICO'
  | 'SERVICIO'
  | 'VENTA_BIEN'
  | 'ALQUILER'
  | 'ACTUACION_INTERNA'
  | 'OTRO';

export interface CampoEspecialConfig {
  nombre: string;
  etiqueta: string;
  tipo: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'checkbox';
  obligatorio: boolean;
  opciones?: readonly string[];
  placeholder?: string;
  valorPorDefecto?: unknown;
  ayuda?: string;
}

export interface TupaFormDefinition {
  codigoRef: string;
  denominacion: string;
  categoria: CategoriaTupa;
  tipoFormulario: TipoFormularioTupa;
  campos: CampoEspecialConfig[];
  requisitos: readonly string[];
  monto: number;
  montoTexto: string;
  unidadCobro: string;
  generaExpediente: boolean;
  flujoDestino: string;
  plazo: string;
  unidadResponsable: string;
  baseLegal: string | null;
  bloqueadoParaCiudadano: boolean;
  observacion: string;
}

export interface SolicitudAccesoTupa {
  idSolicitud: string;
  idPersona: string;
  correo: string;
  motivo: string;
  fechaSolicitud: string;
  estado: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA' | 'EXPIRADA';
  fechaResolucion?: string | null;
  resueltoPor?: string | null;
  observacionResolucion?: string | null;
}

export interface SolicitudDinamicaPayload {
  codigoSolicitud?: string;
  tipoFormulario: TipoFormularioTupa;
  codigoTupa: string;
  denominacion: string;
  montoTotal: number;
  datosFormulario: Record<string, unknown>;
  telefono?: string;
  observacion?: string;
}
