import type { EstadoRutaDoc } from './rutadoc.fsm.js';

export interface ActuacionTrazabilidad {
  movimientoId: string;
  secuencia: string;
  fechaHora: string;
  estadoAnterior: EstadoRutaDoc;
  evento: string;
  estadoNuevo: EstadoRutaDoc;
  usuarioOperadorId: string;
  areaAnteriorId: string | null;
  areaDestinoId: string | null;
  remitente: string | null;
  destinatario: string | null;
  proveido: unknown | null;
  datosAsociados: Record<string, unknown>;
  duracionMs: number | null;
  duracionMinutos: number | null;
  tipoActuacion: 'NORMAL' | 'COMPENSATORIA';
  areaDestinoNombre?: string | null;
}

export interface EventoTrazabilidad {
  id: string;
  tipo: 'RADICACION' | 'ORDEN_PAGO' | 'PAGO_CONFIRMADO' | 'MOVIMIENTO';
  fechaHora: string;
  titulo: string;
  detalle: string | null;
}

export interface RepositorioTrazabilidadRutaDoc {
  existeExpediente(idExpediente: string): Promise<boolean>;
  listarEventosOrigen?(idExpediente: string): Promise<readonly EventoTrazabilidad[]>;
  listar(idExpediente: string): Promise<readonly Omit<ActuacionTrazabilidad,
    'duracionMs' | 'duracionMinutos'>[]>;
}
