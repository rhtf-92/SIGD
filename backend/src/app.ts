import express, { Express } from 'express';
import type { Pool } from 'pg';

import { contextMiddleware } from './middleware/context-middleware.js';
import { errorMiddleware } from './middleware/error-middleware.js';

import { crearRouterIdenticore } from './domains/identicore/identicore.router.js';
import type { CacheDistribuida } from './domains/identicore/ubigeo.service.js';

import { crearRouterRutaDoc } from './domains/rutadoc/rutadoc.router.js';
import type { ObtenerActorRutaDoc } from './domains/rutadoc/rutadoc.controller.js';
import type {
  FolioCompensationPort,
  PoliticaReversionRutaDoc,
  PrepararCompensacionFolios,
} from './domains/rutadoc/rutadoc.reversion.types.js';
import type { ActorProviderRutaDoc } from './domains/rutadoc/rutadoc.actor-provider.js';
import type { CalendarioLaboralPort } from './domains/rutadoc/sla.types.js';
import type { ClasificadorCcdPort } from './domains/rutadoc/ccd.types.js';
import type { DocumentoMetadataPort } from './domains/rutadoc/foliacion.types.js';

import { crearRouterReferencia } from './referencia/expediente.router.js';
import { crearRouterTramites } from './domains/tramicore/tramites.controller.js';

import { crearUsuariosAdminRouter } from './domains/organicore/usuariosAdmin.routes.js';

export interface AppOptions {
  ubigeoCache?: CacheDistribuida;
  obtenerActorRutaDoc?: ObtenerActorRutaDoc;
  actorProviderRutaDoc?: ActorProviderRutaDoc;
  politicaReversionRutaDoc?: PoliticaReversionRutaDoc;
  prepararCompensacionFolios?: PrepararCompensacionFolios;
  folioCompensationPort?: FolioCompensationPort;
  calendarioLaboralRutaDoc?: CalendarioLaboralPort;
  clasificadorCcdRutaDoc?: ClasificadorCcdPort;
  documentoMetadataRutaDoc?: DocumentoMetadataPort;
  porcentajeAmarilloSlaRutaDocDesde?: number;
}

export function construirApp(
  pool: Pool,
  opciones: AppOptions = {},
): Express {
  const app = express();

  app.disable('x-powered-by');

  app.use(express.json());
  app.use(contextMiddleware);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  /*
   * IdentiCore
   */
  app.use(
    '/api/v1',
    crearRouterIdenticore(
      pool,
      opciones.ubigeoCache,
    ),
  );

  /*
   * TramiCore
   */
  app.use(
    '/api/v1',
    crearRouterTramites(pool),
  );

  /*
   * Router de referencia existente
   */
  app.use(
    '/api',
    crearRouterReferencia(pool),
  );

  /*
   * RutaDoc
   */
  app.use(
    '/api/v1',
    crearRouterRutaDoc(
      pool,
      opciones.obtenerActorRutaDoc,
      opciones.politicaReversionRutaDoc,
      opciones.prepararCompensacionFolios,
      opciones.actorProviderRutaDoc,
      opciones.folioCompensationPort,
      {
        calendarioLaboral:
          opciones.calendarioLaboralRutaDoc,

        clasificadorCcd:
          opciones.clasificadorCcdRutaDoc,

        documentoMetadata:
          opciones.documentoMetadataRutaDoc,

        porcentajeAmarilloSlaDesde:
          opciones.porcentajeAmarilloSlaRutaDocDesde,
      },
    ),
  );

  /*
   * OrganiCore - Administración de usuarios
   *
   * GET  /api/v1/admin/usuarios
   * POST /api/v1/admin/usuarios
   * PUT  /api/v1/admin/usuarios/:id
   */
  app.use(
    '/api/v1/admin/usuarios',
    crearUsuariosAdminRouter(pool),
  );

  /*
   * Middleware global de errores.
   * Siempre debe permanecer al final.
   */
  app.use(errorMiddleware);

  return app;
}

export default construirApp;