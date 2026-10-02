import type { Request, Response, RequestHandler } from 'express';
import { z } from 'zod';
import { OrganigramaService, CrearUnidadDTO, ActualizarUnidadDTO } from './organigrama.service.js';
import { DomainError } from '../../shared/domain/errors/index.js';

const crearUnidadSchema = z.object({
  sigla: z.string().min(1).max(20),
  nombre: z.string().min(1).max(255),
  padre_id: z.string().uuid().nullable(),
});

const actualizarUnidadSchema = z.object({
  nombre: z.string().min(1).max(255).optional(),
  padre_id: z.string().uuid().nullable().optional(),
});

export function crearControladorOrganigrama(servicio: OrganigramaService): {
  getOrganigrama: RequestHandler;
  crearUnidad: RequestHandler;
  actualizarUnidad: RequestHandler;
} {
  return {
    getOrganigrama: async (req, res) => {
      res.json(await servicio.obtenerOrganigrama());
    },

    crearUnidad: async (req, res) => {
      const dto = crearUnidadSchema.parse(req.body);
      res.status(201).json(await servicio.crearUnidad(dto));
    },

    actualizarUnidad: async (req, res) => {
      const id = String(req.params.id);
      if (!z.string().uuid().safeParse(id).success) {
        res.status(400).json({ error: 'ID de unidad inválido' });
        return;
      }
      const dto = actualizarUnidadSchema.parse(req.body);
      res.json(await servicio.actualizarUnidad(id, dto));
    },
  };
}
