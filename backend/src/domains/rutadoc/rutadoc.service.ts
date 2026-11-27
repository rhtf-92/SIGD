import { ForbiddenError, NotFoundError, ValidationError } from '../../shared/domain/errors/index.js';
import { ESTADOS_POR_PESTANA, type ActorRutaDoc, type ContadoresRutaDoc, type FiltrosRutaDoc, type ResultadoBandeja } from './rutadoc.types.js';
import { ESTADOS_RUTADOC } from './rutadoc.fsm.js';
import { codificarCursor, decodificarCursor } from './rutadoc.cursor.js';
import type { RepositorioRutaDoc } from './rutadoc.repository.js';

const ROLES_BANDEJA = new Set(['DOCENTE', 'DIRECTOR', 'MESA_PARTES', 'SUPER_ADMIN']);

export class ServicioRutaDoc {
  constructor(private readonly repositorio: RepositorioRutaDoc) {}

  async listar(filtros: FiltrosRutaDoc, actor: ActorRutaDoc): Promise<ResultadoBandeja> {
    if (!actor.roles.some((rol) => ROLES_BANDEJA.has(rol))) throw new ForbiddenError();
    const esAdministrador = actor.roles.includes('SUPER_ADMIN');
    if (!esAdministrador && !actor.unidadOrganicaId) {
      throw new ForbiddenError({ detail: 'El perfil del usuario no tiene un área asignada.' });
    }
    const filtrosDeArea = esAdministrador
      ? filtros
      : { ...filtros, areaId: actor.unidadOrganicaId! };
    const estadosDePestana = filtrosDeArea.pestana === 'TODOS'
      ? ESTADOS_RUTADOC
      : ESTADOS_POR_PESTANA[filtrosDeArea.pestana];
    const estados = filtrosDeArea.estadosActuales ?? estadosDePestana;
    const estadosPermitidos = new Set<string>(estadosDePestana);
    if (estados.some((estado) => !estadosPermitidos.has(estado))) {
      throw new ValidationError({ invalidParams: [{
        name: 'estadosActuales',
        reason: 'Los estados solicitados no pertenecen a la pestaña indicada.',
      }] });
    }
    const posicion = filtrosDeArea.cursor ? decodificarCursor(filtrosDeArea.cursor, filtrosDeArea) : null;
    const resultado = await this.repositorio.listar(
      filtrosDeArea,
      estados,
      posicion,
    );
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
      }, filtrosDeArea) : null,
      tieneMas,
      contadores,
      conteosEstado: resultado.porEstado,
    };
  }

  async obtener(idExpediente: string, actor: ActorRutaDoc) {
    const expediente = await this.repositorio.obtener(idExpediente);
    if (!expediente) throw new NotFoundError({ detail: 'El expediente no existe.' });
    const esAdministrador = actor.roles.includes('SUPER_ADMIN');
    if (!esAdministrador && (!actor.unidadOrganicaId || expediente.areaActualId !== actor.unidadOrganicaId)) {
      throw new ForbiddenError();
    }
    if (!actor.puedeVerExpediente || !await actor.puedeVerExpediente(idExpediente)) {
      throw new ForbiddenError();
    }
    return expediente;
  }
}
