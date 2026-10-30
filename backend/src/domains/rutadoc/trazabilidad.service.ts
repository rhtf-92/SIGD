import { ForbiddenError, NotFoundError } from '../../shared/domain/errors/index.js';
import type { ActorRutaDoc } from './rutadoc.types.js';
import type { ActuacionTrazabilidad, EventoTrazabilidad, RepositorioTrazabilidadRutaDoc } from './trazabilidad.types.js';

const titulosMovimiento: Record<string, string> = {
  RECEPCION: 'Solicitud recibida',
  INICIAR_CALIFICACION: 'Calificación iniciada',
  OBSERVACION: 'Expediente observado',
  CORRECCION: 'Subsanación presentada',
  INICIAR_REVISION: 'Revisión iniciada',
  DERIVACION: 'Expediente derivado',
  ENVIAR_A_FIRMA: 'Pase a validación y firma',
  FIRMA: 'Expediente atendido y resuelto',
  CIERRE: 'Expediente archivado formalmente',
  ARCHIVAR: 'Expediente archivado',
};

function eventoDeMovimiento(actuacion: Omit<ActuacionTrazabilidad, 'duracionMs' | 'duracionMinutos'>): EventoTrazabilidad {
  const destino = actuacion.areaDestinoNombre?.trim();
  return {
    id: `MOVIMIENTO:${actuacion.movimientoId}`,
    tipo: 'MOVIMIENTO',
    fechaHora: actuacion.fechaHora,
    titulo: actuacion.evento === 'DERIVACION' && destino
      ? `Derivado a ${destino}`
      : actuacion.evento === 'RECEPCION' && destino
        ? `Recibido por ${destino}`
        : titulosMovimiento[actuacion.evento] ?? 'Actuación administrativa registrada',
    detalle: null,
  };
}

export class ServicioTrazabilidadRutaDoc {
  constructor(private readonly repositorio: RepositorioTrazabilidadRutaDoc) {}

  async obtener(idExpediente: string, actor: ActorRutaDoc): Promise<{
    expedienteId: string; actuaciones: readonly ActuacionTrazabilidad[]; eventos?: readonly EventoTrazabilidad[];
  }> {
    if (!await this.repositorio.existeExpediente(idExpediente)) throw new NotFoundError({ detail: 'El expediente no existe.' });
    if (!actor.puedeVerExpediente || !await actor.puedeVerExpediente(idExpediente)) throw new ForbiddenError();
    const historial = await this.repositorio.listar(idExpediente);
    const eventosOrigen = this.repositorio.listarEventosOrigen
      ? await this.repositorio.listarEventosOrigen(idExpediente) : null;
    const actuaciones = historial.map((actuacion, indice) => {
      const siguiente = historial[indice + 1];
      const duracionMs = siguiente ? Date.parse(siguiente.fechaHora) - Date.parse(actuacion.fechaHora) : null;
      return { ...actuacion,
        duracionMs, duracionMinutos: duracionMs === null ? null : duracionMs / 60_000 };
    });
    // La actuación abierta no tiene duración de ciclo cerrada; no se extiende a “ahora”.
    if (eventosOrigen === null) return { expedienteId: idExpediente, actuaciones };
    const eventosUnicos = new Map<string, EventoTrazabilidad>();
    for (const evento of [...eventosOrigen, ...historial.map(eventoDeMovimiento)]) {
      eventosUnicos.set(evento.id, evento);
    }
    const prioridad: Record<EventoTrazabilidad['tipo'], number> = {
      RADICACION: 0, ORDEN_PAGO: 1, PAGO_CONFIRMADO: 2, MOVIMIENTO: 3,
    };
    const secuenciaMovimiento = new Map(historial.map((item) =>
      [`MOVIMIENTO:${item.movimientoId}`, BigInt(item.secuencia)]));
    const compararSecuencia = (a: EventoTrazabilidad, b: EventoTrazabilidad): number => {
      if (a.tipo !== 'MOVIMIENTO' || b.tipo !== 'MOVIMIENTO') return 0;
      const primera = secuenciaMovimiento.get(a.id) ?? 0n;
      const segunda = secuenciaMovimiento.get(b.id) ?? 0n;
      return primera < segunda ? -1 : primera > segunda ? 1 : 0;
    };
    const eventos = [...eventosUnicos.values()].sort((a, b) =>
      Date.parse(a.fechaHora) - Date.parse(b.fechaHora)
      || prioridad[a.tipo] - prioridad[b.tipo]
      || compararSecuencia(a, b)
      || a.id.localeCompare(b.id));
    const esCiudadano = actor.roles.includes('CIUDADANO') &&
      !actor.roles.some((rol) => rol !== 'CIUDADANO');
    return { expedienteId: idExpediente, actuaciones: esCiudadano ? [] : actuaciones, eventos };
  }
}
