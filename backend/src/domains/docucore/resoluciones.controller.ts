import { Request, Response, Router } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import { getRequestContext } from '../../shared/request-context/request-context.js';
import {
  crearServicioResoluciones,
  TIPOS_RESOLUCION,
  type ServicioResoluciones,
} from './resoluciones.service.js';

// =============================================================================
// DocuCore · Controlador REST de Resoluciones Directorales
// Autor: Christian Jhoel Rodríguez Cari (B_CHRISTIAN) · Sprint 4 · T-BE-DC-03
// =============================================================================
// #32  POST   /api/v1/resoluciones/proyectar   (alta/actualización de borrador)
// #32  POST   /api/v1/resoluciones              (ruta alias frontend)
// #33  GET    /api/v1/resoluciones/proyectos/:id (consulta con render previo)
// #33  GET    /api/v1/resoluciones/:id          (ruta canónica del plan)
// =============================================================================

const esquemaProyectar = z.object({
  expedienteId: z.string().uuid(),
  tipoResolucion: z.enum(TIPOS_RESOLUCION),
  visto: z.string().min(10, 'El Visto debe tener al menos 10 caracteres.'),
  considerandos: z.array(z.string().min(10, 'Cada considerando debe tener al menos 10 caracteres.')).min(1),
  articulos: z
    .array(
      z.object({
        numero: z.number().int().positive('El número de artículo debe ser positivo.'),
        texto: z.string().min(10, 'El texto del artículo debe tener al menos 10 caracteres.'),
      }),
    )
    .min(1),
  distribucion: z.array(z.string().min(1)).min(1).optional(),
});

export function crearRouterResoluciones(pool: Pool): Router {
  const router = Router();
  const servicio: ServicioResoluciones = crearServicioResoluciones(pool);

  async function proyectar(req: Request, res: Response): Promise<void> {
    const datos = esquemaProyectar.parse(req.body);
    const contexto = getRequestContext();
    const proyecto = await servicio.proyectar({
      expedienteId: datos.expedienteId,
      tipoResolucion: datos.tipoResolucion,
      visto: datos.visto,
      considerandos: datos.considerandos,
      articulos: datos.articulos,
      distribucion: datos.distribucion,
      usuarioId: contexto?.usuario_id ?? null,
    });
    res.status(201).json({
      resolucionId: proyecto.id,
      numeroBorrador: proyecto.numero,
      correlation_id: contexto?.correlation_id,
    });
  }

  async function obtenerProyecto(req: Request, res: Response): Promise<void> {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const proyecto = await servicio.obtenerProyectoPorId(id);
    const contexto = getRequestContext();
    res.status(200).json({
      resolucionId: proyecto.id,
      numero: proyecto.numero,
      tipoResolucion: proyecto.tipoResolucion,
      expedienteId: proyecto.expedienteId,
      estado: proyecto.estado,
      visto: proyecto.visto,
      considerandos: proyecto.considerandos,
      articulos: proyecto.articulos,
      distribucion: proyecto.distribucion,
      html: proyecto.html,
      creadoEn: proyecto.creadoEn,
      correlation_id: contexto?.correlation_id,
    });
  }

  // Se registran primero las rutas específicas para no colisionar con /:id.
  router.post('/proyectar', (req, res, next) => {
    proyectar(req, res).catch(next);
  });
  router.get('/proyectos/:id', (req, res, next) => {
    obtenerProyecto(req, res).catch(next);
  });

  // Rutas alias (interop frontend y ruta canónica #33 del plan).
  router.post('/', (req, res, next) => {
    proyectar(req, res).catch(next);
  });
  router.get('/:id', (req, res, next) => {
    obtenerProyecto(req, res).catch(next);
  });

  return router;
}