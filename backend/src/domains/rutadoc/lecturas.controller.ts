import type { RequestHandler, Request } from 'express';
import { ForbiddenError, NotFoundError, UnauthorizedError } from '../../shared/domain/errors/index.js';
import { ValidationError } from '../../shared/domain/errors/validation-error.js';
import type { ActorProviderRutaDoc } from './rutadoc.actor-provider.js';
import type { ServicioCcdRutaDoc } from './ccd.service.js';
import type { ServicioFoliacionRutaDoc } from './foliacion.service.js';
import type { ServicioSlaRutaDoc } from './sla.service.js';
import type { ServicioTrazabilidadRutaDoc } from './trazabilidad.service.js';
import type { ActorRutaDoc } from './rutadoc.types.js';
import { esIdExpediente } from './rutadoc.cursor.js';

const ROLES_CCD = new Set(['DOCENTE', 'DIRECTOR', 'MESA_PARTES', 'SUPER_ADMIN']);

export function crearControladorLecturasRutaDoc(
  actorProvider: ActorProviderRutaDoc,
  servicios: { trazabilidad: ServicioTrazabilidadRutaDoc; foliacion: ServicioFoliacionRutaDoc;
    sla: ServicioSlaRutaDoc; ccd: ServicioCcdRutaDoc },
): { trazabilidad: RequestHandler; foliacion: RequestHandler; sla: RequestHandler; ccd: RequestHandler } {
  const actorAutenticado = async (req: Request): Promise<ActorRutaDoc> => {
    const actor = await actorProvider.obtenerActor(req);
    if (!actor) throw new UnauthorizedError();
    return actor;
  };
  const idValido = (id: string): string => {
    if (!esIdExpediente(id)) throw new ValidationError({ invalidParams: [{
      name: 'id', reason: 'Debe ser un identificador BIGINT positivo válido.',
    }] });
    return id;
  };
  const idDeRuta = (valor: string | string[] | undefined): string => {
    if (typeof valor !== 'string') throw new ValidationError({ invalidParams: [{
      name: 'id', reason: 'Debe indicar un único identificador BIGINT positivo.',
    }] });
    return idValido(valor);
  };
  const accesoCcd = (actor: ActorRutaDoc) => {
    if (!actor.roles.some((rol) => ROLES_CCD.has(rol))) throw new ForbiddenError();
  };

  return {
    trazabilidad: async (req, res) => {
      const actor = await actorAutenticado(req);
      res.json(await servicios.trazabilidad.obtener(idDeRuta(req.params.id), actor));
    },
    foliacion: async (req, res) => {
      const actor = await actorAutenticado(req);
      res.json(await servicios.foliacion.obtener(idDeRuta(req.params.id), actor));
    },
    sla: async (req, res) => {
      const actor = await actorAutenticado(req);
      const id = idDeRuta(req.params.id);
      // Obtener valida existencia antes de evaluar permisos, evitando que un 404 se convierta en 403.
      const puedeVer = actor.puedeVerExpediente && await actor.puedeVerExpediente(id);
      if (!puedeVer) {
        const fechaInicio = await servicios.sla.fechaInicio(id);
        if (!fechaInicio) throw new NotFoundError({ detail: 'El expediente no existe.' });
        throw new ForbiddenError();
      }
      res.json(await servicios.sla.obtener(id));
    },
    ccd: async (req, res) => {
      const actor = await actorAutenticado(req);
      accesoCcd(actor);
      res.json({ elementos: await servicios.ccd.obtenerArbol() });
    },
  };
}
