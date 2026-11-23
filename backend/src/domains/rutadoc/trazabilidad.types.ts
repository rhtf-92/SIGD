import type { EstadoRutaDoc } from './rutadoc.fsm.js';

export type TipoActuacionTrazabilidad =
  | 'NORMAL'
  | 'COMPENSATORIA'
  | 'ACUSE_DIGITAL'
  | 'REGISTRAL'
  | 'FINANCIERO'
  | 'CALCULO_PLAZO'
  | 'HABILITACION'
  | 'EVALUACION_ACADEMICA'
  | 'DICTAMEN'
  | 'PROYECCION_RESOLUTIVA'
  | 'FIRMA_DIGITAL'
  | 'NOTIFICACION'
  | 'CIERRE'
  | 'CUSTODIA';

export interface ActuacionTrazabilidad {
  movimientoId: string;
  secuencia: string;
  fechaHora: string;
  estadoAnterior: EstadoRutaDoc | string;
  evento: string;
  estadoNuevo: EstadoRutaDoc | string;
  usuarioOperadorId: string;
  areaAnteriorId: string | null;
  areaDestinoId: string | null;
  remitente: string | null;
  destinatario: string | null;
  proveido: unknown | null;
  datosAsociados: Record<string, unknown>;
  duracionMs: number | null;
  duracionMinutos: number | null;
  tipoActuacion: TipoActuacionTrazabilidad;
  origen?: string;
  unidadOrganica?: string | null;
  rol?: string | null;
}

export interface RepositorioTrazabilidadRutaDoc {
  existeExpediente(idExpediente: string): Promise<boolean>;
  listar(idExpediente: string): Promise<readonly Omit<ActuacionTrazabilidad,
    'duracionMs' | 'duracionMinutos'>[]>;
}
