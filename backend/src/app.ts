import express, { Express } from 'express';
import type { Pool } from 'pg';
import { contextMiddleware } from './middleware/context-middleware.js';
import { errorMiddleware } from './middleware/error-middleware.js';
import { crearRouterReferencia } from './referencia/expediente.router.js';
import { crearRouterRutaDoc } from './domains/rutadoc/rutadoc.router.js';
import type { ObtenerActorRutaDoc } from './domains/rutadoc/rutadoc.controller.js';
import type { FolioCompensationPort, PoliticaReversionRutaDoc, PrepararCompensacionFolios } from './domains/rutadoc/rutadoc.reversion.types.js';
import type { ActorProviderRutaDoc } from './domains/rutadoc/rutadoc.actor-provider.js';
import { crearRouterAdminMaestras } from './domains/organicore/adminMaestras.routes.js';

export function construirApp(pool: Pool, opciones: {
  obtenerActorRutaDoc?: ObtenerActorRutaDoc;
  actorProviderRutaDoc?: ActorProviderRutaDoc;
  politicaReversionRutaDoc?: PoliticaReversionRutaDoc;
  prepararCompensacionFolios?: PrepararCompensacionFolios;
  folioCompensationPort?: FolioCompensationPort;
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
    opciones.politicaReversionRutaDoc, opciones.prepararCompensacionFolios,
    opciones.actorProviderRutaDoc, opciones.folioCompensationPort));

  // Superficie canónica /api/v1 del plan maestro (OrganiCore, B_HECTOR).
  // Se monta después de `/api/v1` porque `crearRouterRutaDoc` sólo declara rutas
  // específicas de expedientes (sin comodín), de modo que las peticiones de
  // /api/v1/admin la atraviesan sin ser atendidas y llegan a este router.
  app.use('/api/v1/admin', crearRouterAdminMaestras(pool));

  app.use(errorMiddleware);

  return app;
}

export default construirApp;
