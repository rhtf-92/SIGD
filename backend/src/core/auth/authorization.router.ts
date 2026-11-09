/**
-- =============================================================================
-- Router de Autorización y Perfiles Operativos (Fase 5D)
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
-- -----------------------------------------------------------------------------
-- Autor     : Geric (B_GERIC)
-- Marco     : Modelo Canónico de Autorización Contextual, Scopes y Segregación SIGD 2026
-- =============================================================================
*/

import { Router, type Request, type Response, type NextFunction } from 'express';
import type { Pool } from 'pg';
import { resolverIdentidad } from './auth.guard.js';
import { AuthorizationService } from './authorization.service.js';
import {
  anularAsignacionPerfilSchema,
  crearAsignacionPerfilSchema,
  finalizarAsignacionPerfilSchema,
  revocarAsignacionPerfilSchema,
} from './authorization.types.js';

export function crearRouterAutorizacion(pool: Pool): Router {
  const router = Router();
  const service = new AuthorizationService(pool);

  // 1. Catálogo maestro de perfiles operativos
  router.get('/autorizacion/perfiles', async (req: Request, res: Response, next: NextFunction) => {
    try {
      resolverIdentidad(req);
      const soloVigentes = req.query.solo_vigentes !== 'false';
      const perfiles = await service.listarCatalogoPerfiles(soloVigentes);
      res.status(200).json({ perfiles });
    } catch (error) {
      next(error);
    }
  });

  // 2. Consulta del contexto resuelto de la sesión autenticada
  router.get('/autorizacion/mi-contexto', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const identidad = resolverIdentidad(req);
      const fechaCorte = typeof req.query.fecha === 'string' ? new Date(req.query.fecha) : new Date();
      const contexto = await service.resolverContextoAutorizacion(identidad.idUsuario, fechaCorte);
      res.status(200).json({ contexto });
    } catch (error) {
      next(error);
    }
  });

  // 3. Asignación de perfil operativo a una cuenta de usuario
  router.post('/autorizacion/asignaciones', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const identidad = resolverIdentidad(req);
      await service.exigirAutorizacion({
        usuarioId: identidad.idUsuario,
        rolesDeclarados: identidad.roles,
        accion: 'CUENTA_GESTIONAR',
        recurso: { tipo: 'CUENTA', id: req.body?.idUsuario },
      });

      const parsed = crearAsignacionPerfilSchema.parse(req.body);
      const asignacion = await service.asignarPerfilOperativo(parsed, identidad.idUsuario);
      res.status(201).json({ ok: true, asignacion });
    } catch (error) {
      next(error);
    }
  });

  // 4. Detalle de una asignación de perfil
  router.get('/autorizacion/asignaciones/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      resolverIdentidad(req);
      const asignacion = await service.obtenerAsignacionPerfilPorId(String(req.params.id));
      if (!asignacion) {
        res.status(404).json({ error: 'Asignación no encontrada' });
        return;
      }
      res.status(200).json({ asignacion });
    } catch (error) {
      next(error);
    }
  });

  // 5. Finalizar asignación de perfil
  router.put('/autorizacion/asignaciones/:id/finalizar', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const identidad = resolverIdentidad(req);
      await service.exigirAutorizacion({
        usuarioId: identidad.idUsuario,
        rolesDeclarados: identidad.roles,
        accion: 'CUENTA_GESTIONAR',
      });

      const parsed = finalizarAsignacionPerfilSchema.parse(req.body);
      const asignacion = await service.finalizarAsignacionPerfil(
        String(req.params.id),
        parsed.fechaFinalizacion,
        parsed.motivoFinalizacion,
        identidad.idUsuario,
      );
      res.status(200).json({ ok: true, asignacion });
    } catch (error) {
      next(error);
    }
  });

  // 6. Revocar asignación de perfil
  router.put('/autorizacion/asignaciones/:id/revocar', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const identidad = resolverIdentidad(req);
      await service.exigirAutorizacion({
        usuarioId: identidad.idUsuario,
        rolesDeclarados: identidad.roles,
        accion: 'CUENTA_GESTIONAR',
      });

      const parsed = revocarAsignacionPerfilSchema.parse(req.body);
      const asignacion = await service.revocarAsignacionPerfil(
        String(req.params.id),
        parsed.fechaRevocacion,
        parsed.motivoRevocacion,
        identidad.idUsuario,
      );
      res.status(200).json({ ok: true, asignacion });
    } catch (error) {
      next(error);
    }
  });

  // 7. Anular asignación de perfil
  router.post('/autorizacion/asignaciones/:id/anular', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const identidad = resolverIdentidad(req);
      await service.exigirAutorizacion({
        usuarioId: identidad.idUsuario,
        rolesDeclarados: identidad.roles,
        accion: 'CUENTA_GESTIONAR',
      });

      const parsed = anularAsignacionPerfilSchema.parse(req.body);
      const asignacion = await service.anularAsignacionPerfil(
        String(req.params.id),
        identidad.idUsuario,
        parsed.motivoAnulacion,
      );
      res.status(200).json({ ok: true, asignacion });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
