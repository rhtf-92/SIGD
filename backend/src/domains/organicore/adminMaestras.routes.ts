import { Router } from 'express';
import type { Pool } from 'pg';
import { CalendarioService } from './calendario.service.js';
import { TablasMaestrasService } from './tablasMaestras.service.js';
import {
  listarCalendario,
  listarTablasMaestras,
  registrarFeriadoExcepcional,
  type DependenciasController,
} from './adminMaestras.controller.js';
import { resolverIdentidad } from '../../core/auth/auth.guard.js';
import { AppError } from '../../shared/domain/errors/index.js';

function exigirAdmin(req: import('express').Request): void {
  const identidad = resolverIdentidad(req);
  const roles = identidad.roles ?? [];
  const permitido = roles.some((r) => r === 'ADMIN' || r === 'SUPER_ADMIN' || r === 'ADMINISTRADOR');
  if (!permitido) {
    throw new AppError({ status: 403, code: 'FORBIDDEN', message: 'No autorizado.' });
  }
}

export function crearRouterAdminMaestras(pool: Pool): Router {
  const router = Router();
  const deps: DependenciasController = {
    calendario: new CalendarioService(pool),
    tablasMaestras: new TablasMaestrasService(pool),
  };

  router.get('/tablas-maestras', (req, res, next) => {
    try {
      exigirAdmin(req);
      return (listarTablasMaestras(deps) as any)(req, res, next);
    } catch (error) {
      return next(error);
    }
  });
  router.get('/calendario-laboral', (req, res, next) => {
    try {
      exigirAdmin(req);
      return (listarCalendario(deps) as any)(req, res, next);
    } catch (error) {
      return next(error);
    }
  });
  router.post('/calendario-laboral/feriado-excepcional', (req, res, next) => {
    try {
      exigirAdmin(req);
      return (registrarFeriadoExcepcional(deps) as any)(req, res, next);
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

export default crearRouterAdminMaestras;
