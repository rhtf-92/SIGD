import { type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { UnauthorizedError } from '../../shared/domain/errors/index.js';
import { CalificarRequisitoSchema, ObservarRequisitoSchema } from './dto/calificacion.dto.js';
import { CalificacionAdministrativaService } from './calificacion.service.js';
import type { ActorProviderRutaDoc } from './rutadoc.actor-provider.js';

export function crearControladorCalificacion(servicio: CalificacionAdministrativaService, proveedorActor: ActorProviderRutaDoc) {
  return {
    listar: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const idParse = z.string().uuid().safeParse(req.params.id);
        if (!idParse.success) {
          return res.json([]);
        }
        res.json(await servicio.listarRequisitos(idParse.data));
      } catch (err) {
        console.warn('[Calificacion] Fallback en listar requisitos:', (err as Error).message);
        res.json([]);
      }
    },
    calificar: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const actor = await proveedorActor.obtenerActor(req);
        if (!actor) throw new UnauthorizedError();
        const id = z.string().uuid().parse(req.params.id);
        const reqId = z.string().uuid().parse(req.params.reqId);
        const datos = CalificarRequisitoSchema.parse(req.body);
        await servicio.calificarRequisito(id, reqId, datos, actor);
        res.status(204).send();
      } catch (err) { next(err); }
    },
    observar: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const actor = await proveedorActor.obtenerActor(req);
        if (!actor) throw new UnauthorizedError();
        const id = z.string().uuid().parse(req.params.id);
        const datos = ObservarRequisitoSchema.parse(req.body);
        await servicio.registrarObservacionAdministrativa(id, datos, actor);
        res.status(201).send();
      } catch (err) { next(err); }
    },
    declararConformidad: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const actor = await proveedorActor.obtenerActor(req);
        if (!actor) throw new UnauthorizedError();
        const id = z.string().uuid().parse(req.params.id);
        const resultado = await servicio.declararConformidad(id, actor);
        res.status(200).json(resultado);
      } catch (err) { next(err); }
    }
  };
}
