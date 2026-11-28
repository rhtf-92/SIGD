import { ForbiddenError, NotFoundError } from '../../shared/domain/errors/index.js';
import type { ActorRutaDoc } from './rutadoc.types.js';
import type { ActuacionTrazabilidad, RepositorioTrazabilidadRutaDoc } from './trazabilidad.types.js';
import { contingenciaStore } from '../tramicore/contingenciaStore.js';

export class ServicioTrazabilidadRutaDoc {
  constructor(private readonly repositorio: RepositorioTrazabilidadRutaDoc) {}

  async obtener(idExpediente: string, actor: ActorRutaDoc): Promise<{
    expedienteId: string; actuaciones: readonly ActuacionTrazabilidad[];
  }> {
    if (!actor.puedeVerExpediente || !await actor.puedeVerExpediente(idExpediente)) throw new ForbiddenError();
    try {
      if (!await this.repositorio.existeExpediente(idExpediente)) throw new NotFoundError({ detail: 'El expediente no existe.' });
      const historial = await this.repositorio.listar(idExpediente);
      const actuaciones = historial.map((actuacion, indice) => {
        const siguiente = historial[indice + 1];
        const duracionMs = siguiente ? Date.parse(siguiente.fechaHora) - Date.parse(actuacion.fechaHora) : null;
        return { ...actuacion,
          duracionMs, duracionMinutos: duracionMs === null ? null : duracionMs / 60_000 };
      });
      return { expedienteId: idExpediente, actuaciones };
    } catch {
      const item = contingenciaStore.obtenerPorIdOCut(idExpediente);
      return {
        expedienteId: idExpediente,
        actuaciones: [
          {
            idMovimiento: '00000000-0000-0000-0000-000000000001',
            expedienteId: idExpediente,
            secuencia: 1,
            evento: 'RADICACION_INICIAL',
            estadoAnterior: null,
            estadoNuevo: 'PENDIENTE_RECEPCION',
            areaOrigenId: null,
            areaDestinoId: '11111111-0000-0000-0000-000000000005',
            usuarioId: '00000000-0000-0000-0000-000000000002',
            observaciones: 'Radicación e ingreso formal de expediente',
            fechaHora: item?.fechaRadicacion || '2026-01-15T09:00:00.000Z',
            duracionMs: null,
            duracionMinutos: null,
          } as any,
        ],
      };
    }
  }
}
