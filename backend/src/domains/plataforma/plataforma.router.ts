/**
 * Rutas de Administración de Plataforma SaaS (Platform RBAC)
 * SIGD · IESTP «Suiza» · B_JACOBO
 *
 * Endpoints:
 * GET    /api/v1/plataforma/instituciones
 * POST   /api/v1/plataforma/instituciones
 * PATCH  /api/v1/plataforma/instituciones/:id/estado
 * GET    /api/v1/plataforma/super-admins
 * POST   /api/v1/plataforma/super-admins/asignar
 * POST   /api/v1/plataforma/super-admins/revocar
 * GET    /api/v1/plataforma/auditoria
 */

import { Router, type RequestHandler } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import { extraerTokenBearer, verificarTokenAcceso } from '../../core/auth/jwt.service.js';
import { esSuperAdmin } from '../../core/auth/auth.guard.js';
import { ForbiddenError, UnauthorizedError } from '../../shared/domain/errors/index.js';
import { setUsuarioId } from '../../shared/request-context/request-context.js';
import { PlataformaService } from './plataforma.service.js';
import { PlataformaController } from './plataforma.controller.js';

export function exigirSuperAdmin(pool: Pool): RequestHandler {
  return async (req, res, next) => {
    try {
      const token = extraerTokenBearer(req.get('authorization'));
      if (!token) throw new UnauthorizedError();

      const claims = verificarTokenAcceso(token);
      const sub = claims.sub;
      if (!z.string().uuid().safeParse(sub).success) throw new UnauthorizedError();

      const autorizado = await esSuperAdmin(pool, sub);
      if (!autorizado) {
        throw new ForbiddenError({
          message: 'PLATFORM_RBAC_FORBIDDEN: Se requieren facultades vigentes de SUPER_ADMIN de plataforma.',
        });
      }

      res.locals.actorSuperAdmin = sub;
      setUsuarioId(sub);
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function crearRouterPlataforma(pool: Pool): Router {
  const router = Router();
  const service = new PlataformaService(pool);
  const ctrl = new PlataformaController(service);

  // Todos los endpoints de plataforma exigen Platform RBAC (SUPER_ADMIN)
  router.use('/plataforma', exigirSuperAdmin(pool));

  router.get('/plataforma/instituciones', ctrl.listarInstituciones);
  router.post('/plataforma/instituciones', ctrl.crearInstitucion);
  router.patch('/plataforma/instituciones/:id/estado', ctrl.actualizarEstadoInstitucion);

  router.get('/plataforma/super-admins', ctrl.listarSuperAdmins);
  router.post('/plataforma/super-admins/asignar', ctrl.asignarRolPlataforma);
  router.post('/plataforma/super-admins/revocar', ctrl.revocarRolPlataforma);

  router.get('/plataforma/auditoria', ctrl.listarAuditoria);

  return router;
}

export default crearRouterPlataforma;
