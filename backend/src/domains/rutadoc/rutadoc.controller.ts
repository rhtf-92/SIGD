import type { Request, RequestHandler } from 'express';
import { UnauthorizedError } from '../../shared/domain/errors/index.js';
import { ValidationError } from '../../shared/domain/errors/validation-error.js';
import { z } from 'zod';
import { filtrosSchema, idSchema } from './rutadoc.schemas.js';
import { reversionSchema } from './rutadoc.reversion.schemas.js';
import type { ServicioReversionRutaDoc } from './rutadoc.reversion.service.js';
import { getRequestContext } from '../../shared/request-context/request-context.js';
import type { ActorRutaDoc } from './rutadoc.types.js';
import type { ActorProviderRutaDoc } from './rutadoc.actor-provider.js';
import type { ServicioRutaDoc } from './rutadoc.service.js';

/** El proveedor debe derivar el actor de una sesión/token verificado, nunca de headers libres. */
export type ObtenerActorRutaDoc = (req: Request) => ActorRutaDoc | null | Promise<ActorRutaDoc | null>;

export function crearControladorRutaDoc(servicio: ServicioRutaDoc, reversion: ServicioReversionRutaDoc,
  actorProvider: ActorProviderRutaDoc): {
  listar: RequestHandler;
  obtener: RequestHandler;
  revertir: RequestHandler;
} {
  const actorAutenticado = async (req: Request): Promise<ActorRutaDoc> => {
    const actor = await actorProvider.obtenerActor(req);
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
    revertir: async (req, res) => {
      const actor = await actorAutenticado(req);
      const id = idSchema.parse(req.params.id);
      const comando = reversionSchema.parse(req.body);
      const correlationId = getRequestContext()?.correlation_id;
      if (!correlationId || !z.string().uuid().safeParse(correlationId).success) {
        throw new ValidationError({ invalidParams: [{ name: 'x-correlation-id',
          reason: 'Debe ser un UUID para el outbox transaccional.' }] });
      }
      res.json(await reversion.revertir(id, comando, actor, correlationId));
    },
  };
}
