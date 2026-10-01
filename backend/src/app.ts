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
import type { CacheDistribuida } from './domains/identicore/ubigeo.service.js';
import type { ObtenerActorRutaDoc } from './domains/rutadoc/rutadoc.controller.js';
import type { ActorProviderRutaDoc } from './domains/rutadoc/rutadoc.actor-provider.js';
import type {
  FolioCompensationPort,
  PoliticaReversionRutaDoc,
  PrepararCompensacionFolios,
} from './domains/rutadoc/rutadoc.reversion.types.js';
import type { CalendarioLaboralPort } from './domains/rutadoc/sla.types.js';
import type { ClasificadorCcdPort } from './domains/rutadoc/ccd.types.js';
import type { DocumentoMetadataPort } from './domains/rutadoc/foliacion.types.js';

/**
 * Second-argument shape accepted for compatibility with the branches that mount
 * their own routers. CoreLink only wires the SSE bus, so these ports are accepted
 * and ignored here; they are typed (not `any`) so foreign call sites keep
 * contextual typing and `tsc` stays clean across merges.
 */
interface OpcionesConstructores {
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
  opciones: BusSse | OpcionesConstructores = new BusSse(),
): Express {
  const busSse = opciones instanceof BusSse ? opciones : new BusSse();
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
