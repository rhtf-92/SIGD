import express, { Express } from 'express';
import type { Pool } from 'pg';
import { contextMiddleware } from './middleware/context-middleware.js';
import { errorMiddleware } from './middleware/error-middleware.js';
import { crearRouterReferencia } from './referencia/expediente.router.js';
import { crearRouterSalud } from './controllers/health.controller.js';
import { crearRouterRealtime } from './modules/corelink/realtime.routes.js';
import { BusSse } from './modules/corelink/sseStream.service.js';
import { crearRouterFirma } from './modules/firma/firma.routes.js';
import { crearRouterReportes } from './modules/reportes/reportes.routes.js';
import { API_PREFIX, API_PREFIX_LEGADO, marcarRutaLegada } from './config/rutas.js';

export function construirApp(pool: Pool, busSse: BusSse = new BusSse()): Express {
  const app = express();
  app.disable('x-powered-by');

  app.use(express.json());
  app.use(contextMiddleware);

  app.use(crearRouterSalud(pool));

  const api = express.Router();
  api.use('/realtime', crearRouterRealtime(busSse));
  api.use('/firma', crearRouterFirma(pool));
  api.use('/reportes', crearRouterReportes(pool));
  api.use(crearRouterReferencia(pool));
  app.use(API_PREFIX, api);

  app.use(API_PREFIX_LEGADO, marcarRutaLegada(), crearRouterReferencia(pool));

  app.use(errorMiddleware);

  return app;
}

export default construirApp;
