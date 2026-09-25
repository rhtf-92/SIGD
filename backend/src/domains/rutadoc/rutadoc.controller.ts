import type { Request, RequestHandler } from 'express';
import { UnauthorizedError } from '../../shared/domain/errors/index.js';
import { filtrosSchema, idSchema } from './rutadoc.schemas.js';
import type { ActorRutaDoc } from './rutadoc.types.js';
import type { ServicioRutaDoc } from './rutadoc.service.js';

/** El proveedor debe derivar el actor de una sesión/token verificado, nunca de headers libres. */
export type ObtenerActorRutaDoc = (req: Request) => ActorRutaDoc | null | Promise<ActorRutaDoc | null>;

export function crearControladorRutaDoc(servicio: ServicioRutaDoc, obtenerActor: ObtenerActorRutaDoc): {
  listar: RequestHandler;
  obtener: RequestHandler;
} {
  const actorAutenticado = async (req: Request): Promise<ActorRutaDoc> => {
    const actor = await obtenerActor(req);
    if (!actor) throw new UnauthorizedError();
    return actor;
  };

  return {
    listar: async (req, res) => {
      const actor = await actorAutenticado(req);
      const filtros = filtrosSchema.parse(req.query);
      res.json(await servicio.listar(filtros, actor));
    },
    obtener: async (req, res) => {
      const actor = await actorAutenticado(req);
      const id = idSchema.parse(req.params.id);
      res.json(await servicio.obtener(id, actor));
    },
  };
}
