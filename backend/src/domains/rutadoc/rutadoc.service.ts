import { ForbiddenError, NotFoundError } from '../../shared/domain/errors/index.js';
import { ESTADOS_POR_PESTANA, type ActorRutaDoc, type ContadoresRutaDoc, type FiltrosRutaDoc, type ResultadoBandeja } from './rutadoc.types.js';
import { codificarCursor, decodificarCursor } from './rutadoc.cursor.js';
import type { RepositorioRutaDoc } from './rutadoc.repository.js';

export class ServicioRutaDoc {
  constructor(private readonly repositorio: RepositorioRutaDoc) {}

  async listar(filtros: FiltrosRutaDoc, actor: ActorRutaDoc): Promise<ResultadoBandeja> {
    if (!actor.obtenerAlcanceBandeja) throw new ForbiddenError();
    const alcance = await actor.obtenerAlcanceBandeja();
    if (!alcance || (!alcance.accesoGlobal && !alcance.solicitanteId)) throw new ForbiddenError();

    // Protección estricta de ámbito institucional:
    // Si el actor no tiene acceso GLOBAL y cuenta con un área institucional asignada,
    // su consulta queda fijada a su área. Cualquier intento de cambiarla por otra área es rechazado.
    if (!alcance.accesoGlobal && (actor.unidadOrganicaId || alcance.esOperadorArea)) {
      if (filtros.areaId && actor.unidadOrganicaId && filtros.areaId !== actor.unidadOrganicaId) {
        throw new ForbiddenError({ detail: 'No está autorizado para consultar expedientes de otra área institucional.' });
      }
      if (actor.unidadOrganicaId) {
        filtros.areaId = actor.unidadOrganicaId;
      }
    }

    const posicion = filtros.cursor ? decodificarCursor(filtros.cursor, filtros) : null;
    const resultado = await this.repositorio.listar(filtros, ESTADOS_POR_PESTANA[filtros.pestana], posicion, alcance);
    const tieneMas = resultado.elementos.length > filtros.limite;
    const elementos = resultado.elementos.slice(0, filtros.limite);
    const ultimo = elementos.at(-1);
    const contadores = resultado.porPestana ?? Object.fromEntries(Object.entries(ESTADOS_POR_PESTANA).map(
      ([pestana, estados]) => [pestana, estados.reduce(
        (total, estado) => total + (resultado.porEstado[estado] ?? 0), 0)],
    )) as ContadoresRutaDoc;
    return {
      elementos,
      siguienteCursor: tieneMas && ultimo ? codificarCursor({
        fechaRadicacion: ultimo.fechaRadicacion,
        idExpediente: ultimo.idExpediente,
      }, filtros) : null,
      tieneMas,
      contadores,
    };
  }

  async obtener(idExpediente: string, actor: ActorRutaDoc) {
    if (!actor.puedeVerExpediente || !await actor.puedeVerExpediente(idExpediente)) {
      throw new ForbiddenError();
    }
    const expediente = await this.repositorio.obtener(idExpediente);
    if (!expediente) throw new NotFoundError({ detail: 'El expediente no existe.' });
    return expediente;
  }
}
