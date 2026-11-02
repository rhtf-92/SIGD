import { ForbiddenError, NotFoundError } from '../../shared/domain/errors/index.js';
import { ESTADOS_POR_PESTANA, type ActorRutaDoc, type ContadoresRutaDoc, type FiltrosRutaDoc, type ResultadoBandeja } from './rutadoc.types.js';
import { codificarCursor, decodificarCursor } from './rutadoc.cursor.js';
import type { RepositorioRutaDoc } from './rutadoc.repository.js';

const ROLES_BANDEJA = new Set(['ADMINISTRADOR', 'DIRECTOR', 'ESPECIALISTA', 'SECRETARIO', 'MESA_PARTES']);

export class ServicioRutaDoc {
  constructor(private readonly repositorio: RepositorioRutaDoc) {}

  async listar(filtros: FiltrosRutaDoc, actor: ActorRutaDoc): Promise<ResultadoBandeja> {
    if (!actor.roles.some((rol) => ROLES_BANDEJA.has(rol))) throw new ForbiddenError();

    const esSupervisionGlobal = actor.roles.some((r) => ['ADMINISTRADOR', 'DIRECTOR'].includes(r));
    const filtrosEfectivos: FiltrosRutaDoc = { ...filtros };

    // Si el actor es operador de área (Especialista o Secretario) y no tiene rol de supervisión global,
    // acotar forzosamente a su unidad orgánica. Si no tiene unidad asignada o intenta consultar otra,
    // aplicar Fail-Closed con ForbiddenError para mitigar bypass de confinamiento (BOLA).
    if (!esSupervisionGlobal && actor.roles.some((r) => ['ESPECIALISTA', 'SECRETARIO'].includes(r))) {
      if (!actor.unidadOrganicaId) {
        throw new ForbiddenError({ detail: 'Operador sin unidad orgánica asignada.' });
      }
      if (filtrosEfectivos.areaId && filtrosEfectivos.areaId !== actor.unidadOrganicaId) {
        throw new ForbiddenError({ detail: 'No autorizado para consultar bandejas de otras unidades orgánicas.' });
      }
      filtrosEfectivos.areaId = actor.unidadOrganicaId;
    }

    const posicion = filtrosEfectivos.cursor ? decodificarCursor(filtrosEfectivos.cursor, filtrosEfectivos) : null;
    const resultado = await this.repositorio.listar(filtrosEfectivos, ESTADOS_POR_PESTANA[filtrosEfectivos.pestana], posicion);
    const tieneMas = resultado.elementos.length > filtrosEfectivos.limite;
    const elementos = resultado.elementos.slice(0, filtrosEfectivos.limite);
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
      }, filtrosEfectivos) : null,
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
