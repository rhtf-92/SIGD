import { ForbiddenError, NotFoundError } from '../../shared/domain/errors/index.js';
import { ESTADOS_POR_PESTANA, type ActorRutaDoc, type ContadoresRutaDoc, type FiltrosRutaDoc, type ResultadoBandeja } from './rutadoc.types.js';
import { codificarCursor, decodificarCursor } from './rutadoc.cursor.js';
import type { RepositorioRutaDoc } from './rutadoc.repository.js';

const ROLES_BANDEJA = new Set(['DOCENTE', 'DIRECTOR', 'MESA_PARTES', 'SUPER_ADMIN']);

export class ServicioRutaDoc {
  constructor(private readonly repositorio: RepositorioRutaDoc) {}

  async listar(filtros: FiltrosRutaDoc, actor: ActorRutaDoc): Promise<ResultadoBandeja> {
    if (!actor.roles.some((rol) => ROLES_BANDEJA.has(rol))) throw new ForbiddenError();
    const posicion = filtros.cursor ? decodificarCursor(filtros.cursor, filtros) : null;
    const resultado = await this.repositorio.listar(filtros, ESTADOS_POR_PESTANA[filtros.pestana], posicion);
    const tieneMas = resultado.elementos.length > filtros.limite;
    const elementos = resultado.elementos.slice(0, filtros.limite);
    const ultimo = elementos.at(-1);
    const contadores = Object.fromEntries(Object.entries(ESTADOS_POR_PESTANA).map(
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
