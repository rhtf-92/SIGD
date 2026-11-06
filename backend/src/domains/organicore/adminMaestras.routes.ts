/**
 * Rutas de administración de OrganiCore bajo `/api/v1/admin`.
 *
 * Mapea los endpoints canónicos del plan maestro:
 *   #47  GET    /api/v1/admin/tablas-maestras
 *   #48  GET    /api/v1/admin/calendario-laboral
 *   #49  POST   /api/v1/admin/calendario-laboral/feriado-excepcional
 *        GET    /api/v1/admin/tipos-documento
 *        POST   /api/v1/admin/tipos-documento
 *        GET    /api/v1/admin/tipos-documento/:id
 *        PUT    /api/v1/admin/tipos-documento/:id
 *        PATCH  /api/v1/admin/tipos-documento/:id/estado
 *        DELETE /api/v1/admin/tipos-documento/:id
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import { CalendarioService } from './calendario.service.js';
import { TablasMaestrasService } from './tablasMaestras.service.js';
import {
  TiposDocumentoService,
  tipoDocumentoInputSchema,
  tipoDocumentoActualizarSchema,
  tipoDocumentoEstadoSchema,
} from './tiposDocumento.service.js';
import {
  listarCalendario,
  listarTablasMaestras,
  registrarFeriadoExcepcional,
  type DependenciasController,
} from './adminMaestras.controller.js';

export function crearRouterAdminMaestras(pool: Pool): Router {
  const router = Router();
  const deps: DependenciasController = {
    calendario: new CalendarioService(pool),
    tablasMaestras: new TablasMaestrasService(pool),
  };

  const tiposDocService = new TiposDocumentoService(pool);

  router.get('/tablas-maestras', listarTablasMaestras(deps));
  router.get('/calendario-laboral', listarCalendario(deps));
  router.post('/calendario-laboral/feriado-excepcional', registrarFeriadoExcepcional(deps));

  // --- CRUD Tipos de Documento (/api/v1/admin/tipos-documento) ---

  router.get('/tipos-documento', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const soloVigentes = req.query.vigentes === 'true';
      const items = await tiposDocService.listar(soloVigentes);
      res.status(200).json(items);
    } catch (error) {
      next(error);
    }
  });

  router.get('/tipos-documento/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = z.object({ id: z.string().uuid('ID inválido: debe ser UUID') }).parse(req.params);
      const item = await tiposDocService.obtenerPorId(id);
      res.status(200).json(item);
    } catch (error) {
      next(error);
    }
  });

  router.post('/tipos-documento', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const datos = tipoDocumentoInputSchema.parse(req.body);
      const creado = await tiposDocService.crear(datos);
      res.status(201).json({
        ...creado,
        mensaje: 'Tipo documental registrado exitosamente',
      });
    } catch (error) {
      next(error);
    }
  });

  router.put('/tipos-documento/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = z.object({ id: z.string().uuid('ID inválido: debe ser UUID') }).parse(req.params);
      const datos = tipoDocumentoActualizarSchema.parse(req.body);
      const actualizado = await tiposDocService.actualizar(id, datos);
      res.status(200).json({
        ...actualizado,
        mensaje: 'Tipo documental actualizado exitosamente',
      });
    } catch (error) {
      next(error);
    }
  });

  router.patch('/tipos-documento/:id/estado', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = z.object({ id: z.string().uuid('ID inválido: debe ser UUID') }).parse(req.params);
      const { vigente } = tipoDocumentoEstadoSchema.parse(req.body || {});
      const actualizado = await tiposDocService.alternarEstado(id, vigente);
      res.status(200).json({
        ...actualizado,
        mensaje: `Tipo documental ${actualizado.vigente ? 'activado' : 'desactivado'} exitosamente`,
      });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/tipos-documento/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = z.object({ id: z.string().uuid('ID inválido: debe ser UUID') }).parse(req.params);
      const resultado = await tiposDocService.eliminar(id);
      res.status(200).json(resultado);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export default crearRouterAdminMaestras;
