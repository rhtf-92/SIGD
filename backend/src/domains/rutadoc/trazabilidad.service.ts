import { ForbiddenError, NotFoundError } from '../../shared/domain/errors/index.js';
import type { ActorRutaDoc } from './rutadoc.types.js';
import type { ActuacionTrazabilidad, RepositorioTrazabilidadRutaDoc } from './trazabilidad.types.js';

export class ServicioTrazabilidadRutaDoc {
  constructor(private readonly repositorio: RepositorioTrazabilidadRutaDoc) {}

  async obtener(idExpediente: string, actor: ActorRutaDoc): Promise<{
    expedienteId: string; actuaciones: readonly ActuacionTrazabilidad[];
  }> {
    if (!actor.puedeVerExpediente || !await actor.puedeVerExpediente(idExpediente)) throw new ForbiddenError();
    // Autorizar antes de consultar existencia evita distinguir un expediente
    // ajeno de un identificador inexistente. Los errores del repositorio se
    // propagan sin convertirlos en una denegación de acceso.
    if (!await this.repositorio.existeExpediente(idExpediente)) throw new NotFoundError({ detail: 'El expediente no existe.' });
    const historial = await this.repositorio.listar(idExpediente);
    const actuaciones = historial.map((actuacion, indice) => {
      const siguiente = historial[indice + 1];
      const duracionMs = siguiente ? Date.parse(siguiente.fechaHora) - Date.parse(actuacion.fechaHora) : null;
      return { ...actuacion,
        duracionMs, duracionMinutos: duracionMs === null ? null : duracionMs / 60_000 };
    });
    // La actuación abierta no tiene duración de ciclo cerrada; no se extiende a “ahora”.
    return { expedienteId: idExpediente, actuaciones };
  }
}
