import express, { Express } from 'express';
import type { Pool } from 'pg';
import { contextMiddleware } from './middleware/context-middleware.js';
import { errorMiddleware } from './middleware/error-middleware.js';
import { crearRouterReferencia } from './referencia/expediente.router.js';

export function construirApp(pool: Pool): Express {
  const app = express();
  app.disable('x-powered-by');

  app.use(express.json());
  app.use(contextMiddleware);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api', crearRouterReferencia(pool));

  app.use(errorMiddleware);

  return app;
}