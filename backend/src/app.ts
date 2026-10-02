import express, { Express } from 'express';
import type { Pool } from 'pg';

import { contextMiddleware } from './middleware/context-middleware.js';
import { errorMiddleware } from './middleware/error-middleware.js';
import { crearRouterReferencia } from './referencia/expediente.router.js';

import { crearUsuariosAdminRouter } from './domains/organicore/usuariosAdmin.routes.js';

export function construirApp(pool: Pool): Express {
  const app = express();

  app.disable('x-powered-by');

  app.use(express.json());

  app.use(contextMiddleware);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  /**
   * Rutas existentes del proyecto.
   */
  app.use('/api', crearRouterReferencia(pool));

  /**
   * OrganiCore - Administración de usuarios.
   *
   * GET  /api/v1/admin/usuarios
   * POST /api/v1/admin/usuarios
   * PUT  /api/v1/admin/usuarios/:id
   */
  app.use(
    '/api/v1/admin/usuarios',
    crearUsuariosAdminRouter(pool),
  );

  /**
   * Middleware global de errores.
   * Debe permanecer al final.
   */
  app.use(errorMiddleware);

  return app;
}

export default construirApp;