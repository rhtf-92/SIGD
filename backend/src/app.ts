import express, { Express } from 'express';
import type { Pool } from 'pg';
import { contextMiddleware } from './middleware/context-middleware.js';
import { errorMiddleware } from './middleware/error-middleware.js';
import { crearRouterReferencia } from './referencia/expediente.router.js';
import { crearRouterRutaDoc } from './domains/rutadoc/rutadoc.router.js';
import type { ObtenerActorRutaDoc } from './domains/rutadoc/rutadoc.controller.js';
import type { PoliticaReversionRutaDoc, PrepararCompensacionFolios } from './domains/rutadoc/rutadoc.reversion.types.js';

export function construirApp(pool: Pool, opciones: {
  obtenerActorRutaDoc?: ObtenerActorRutaDoc;
  politicaReversionRutaDoc?: PoliticaReversionRutaDoc;
  prepararCompensacionFolios?: PrepararCompensacionFolios;
} = {}): Express {
  const app = express();
  app.disable('x-powered-by');

  app.use(express.json());
  app.use(contextMiddleware);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api', crearRouterReferencia(pool));
  app.use('/api/v1', crearRouterRutaDoc(pool, opciones.obtenerActorRutaDoc,
    opciones.politicaReversionRutaDoc, opciones.prepararCompensacionFolios));

  app.use(errorMiddleware);

  return app;
}

export default construirApp;
