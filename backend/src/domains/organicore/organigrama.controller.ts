import type { RequestHandler } from 'express';
import { z } from 'zod';

import { OrganigramaService } from './organigrama.service.js';

const uuid = z.string().uuid();
const crearUnidadSchema = z.object({
  codigo: z.string().trim().min(1).max(20).regex(/^[A-Za-z0-9._-]+$/),
  nombre: z.string().trim().min(1).max(160),
  padreId: uuid.nullable(),
}).strict();
const actualizarUnidadSchema = z.object({
  nombre: z.string().trim().min(1).max(160).optional(),
  padreId: uuid.nullable().optional(),
  vigente: z.boolean().optional(),
}).strict().refine((datos) => Object.keys(datos).length > 0, 'Debe enviar al menos un cambio.');

export function crearControladorOrganigrama(servicio: OrganigramaService): {
  getOrganigrama: RequestHandler;
  crearUnidad: RequestHandler;
  actualizarUnidad: RequestHandler;
} {
  return {
    getOrganigrama: async (_req, res, next) => {
      try { res.json(await servicio.obtenerOrganigrama()); } catch (error) { next(error); }
    },
    crearUnidad: async (req, res, next) => {
      try {
        res.status(201).json(await servicio.crearUnidad(crearUnidadSchema.parse(req.body)));
      } catch (error) { next(error); }
    },
    actualizarUnidad: async (req, res, next) => {
      try {
        const id = uuid.parse(req.params.id);
        res.json(await servicio.actualizarUnidad(id, actualizarUnidadSchema.parse(req.body)));
      } catch (error) { next(error); }
    },
  };
}
