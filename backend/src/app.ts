import express, { Express } from 'express';
import type { Pool } from 'pg';
import { contextMiddleware } from './middleware/context-middleware.js';
import { errorMiddleware } from './middleware/error-middleware.js';
import { crearRouterReferencia } from './referencia/expediente.router.js';
import { crearRbacService, crearRouterRbac } from './domains/organicore/rbac.controller.js';
import { crearCachePermisosSinCache, type CachePermisos, type ConexionRedis } from './redis.js';

export function construirApp(
  pool: Pool,
  cache: CachePermisos = crearCachePermisosSinCache(),
  redis?: ConexionRedis,
): Express {
  const app = express();
  app.disable('x-powered-by');

  app.use(express.json());
  app.use(contextMiddleware);

  app.locals.rbac = crearRbacService(pool, cache, { redis });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api', crearRouterReferencia(pool));
  app.use('/api/v1/admin', crearRouterRbac(pool, cache, { redis }));

  app.use(errorMiddleware);

  return app;
}

export default construirApp;
