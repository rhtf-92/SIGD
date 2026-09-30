import express, { Express } from 'express';
import type { Pool } from 'pg';
import { contextMiddleware } from './middleware/context-middleware.js';
import { errorMiddleware } from './middleware/error-middleware.js';
import { crearRouterIdenticore } from './domains/identicore/identicore.router.js';
import type { CacheDistribuida } from './domains/identicore/ubigeo.service.js';
import { crearRouterReferencia } from './referencia/expediente.router.js';
import { crearRouterTramites } from './domains/tramicore/tramites.controller.js';

export interface AppOptions {
  ubigeoCache?: CacheDistribuida;
}

export function construirApp(pool: Pool, opciones: AppOptions = {}): Express {
  const app = express();
  app.disable('x-powered-by');

  app.use(express.json());
  app.use(contextMiddleware);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/v1', crearRouterIdenticore(pool, opciones.ubigeoCache));
  app.use('/api/v1', crearRouterTramites(pool));
  app.use('/api', crearRouterReferencia(pool));

  app.use(errorMiddleware);

  return app;
}

export default construirApp;
