import express, { Express } from 'express';
import type { Pool } from 'pg';
import { contextMiddleware } from './middleware/context-middleware.js';
import { errorMiddleware } from './middleware/error-middleware.js';
import { crearRouterReferencia } from './referencia/expediente.router.js';
import { crearRouterResoluciones } from './domains/docucore/resoluciones.controller.js';
import { crearRbacService, crearRouterRbac } from './domains/organicore/rbac.controller.js';
import { crearCachePermisosSinCache, type CachePermisos, type ConexionRedis } from './redis.js';
import type { BusSse } from './modules/corelink/sseStream.service.js';
import { crearRouterRutaDoc } from './domains/rutadoc/rutadoc.router.js';

// Módulos de DocuCore / Firma Digital (B_VALENTIN)
import { crearFirmaRouter } from './domains/docucore/firma.controller.js';
import {
  InMemoryFirmaSessionStore,
  RedisFirmaSessionStore,
  type FirmaSessionStore,
} from './domains/docucore/firmaSession.store.js';
import { InMemoryAlmacenDocumentosFirmables } from './domains/docucore/documentoFirmable.store.js';
import { RefirmaGatewayService } from './domains/docucore/refirmaGateway.service.js';
import { ServicioFirmaService } from './domains/docucore/firma.service.js';

/** Opciones de construccion de la aplicacion.
 *
 * cachePermisos y redis son la inyeccion de permisos que server.ts obtiene de
 * src/redis.ts (OC-10 / OC-11). Si cachePermisos se omite se usa la cache en
 * memoria sin Redis. busSse lo crea server.ts y se expone en app.locals.busSse.
 * El indice de firma abierta conserva la compatibilidad con las llamadas
 * construirApp(pool, { ... }) que ya existen en las suites de main; no sustituye
 * ni oculta ninguna propiedad declarada arriba.
 */
export interface OpcionesApp {
  cachePermisos?: CachePermisos;
  redis?: ConexionRedis;
  busSse?: BusSse;
  [clave: string]: unknown;
}

export function construirApp(pool: Pool, opciones: OpcionesApp = {}): Express {
  const cache = opciones.cachePermisos ?? crearCachePermisosSinCache();
  const redis = opciones.redis;
  const app = express();
  app.disable('x-powered-by');

  app.use(express.json());
  app.use(contextMiddleware);

  app.locals.rbac = crearRbacService(pool, cache, { redis });
  app.locals.busSse = opciones.busSse;

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Configuración de Pasarela y Sesiones de Firma (DocuCore - B_VALENTIN)
  const hostsPermitidos = (process.env.REFIRMA_HOSTS_PERMITIDOS ?? 'sigd.iestp-suiza.edu.pe')
    .split(',')
    .map((h) => h.trim())
    .filter((h) => h.length > 0);

  const pasarela = new RefirmaGatewayService({
    hostsPermitidos,
    exigirHttps: process.env.REFIRMA_EXIGIR_HTTPS !== 'false',
  });

  let sesiones: FirmaSessionStore;
  if (process.env.REDIS_URL) {
    try {
      sesiones = RedisFirmaSessionStore.desdeEntorno();
    } catch {
      sesiones = new InMemoryFirmaSessionStore();
    }
  } else {
    sesiones = new InMemoryFirmaSessionStore();
  }

  const almacen = new InMemoryAlmacenDocumentosFirmables(sesiones);
  const servicio = new ServicioFirmaService({ sesiones, almacen, pasarela });

  // Rutas
  app.use('/api', crearRouterReferencia(pool));
  app.use('/api/v1', crearRouterIdenticore(pool, opts.ubigeoCache));
  app.use('/api/v1', crearRouterTramites(pool));
  app.use(
    '/api/v1',
    crearRouterRutaDoc(
      pool,
      opts.obtenerActorRutaDoc,
      opts.politicaReversionRutaDoc,
      opts.prepararCompensacionFolios,
      opts.actorProviderRutaDoc,
      opts.folioCompensationPort,
      {
        calendarioLaboral: opts.calendarioLaboralRutaDoc,
        clasificadorCcd: opts.clasificadorCcdRutaDoc,
        documentoMetadata: opts.documentoMetadataRutaDoc,
        porcentajeAmarilloSlaDesde: opts.porcentajeAmarilloSlaRutaDocDesde,
      },
    ),
  );
  app.use('/api/v1', crearRouterReportes(pool, opts.actorProviderReportes, opts.mgdCache));
  app.use('/api/v1/resoluciones', crearRouterResoluciones(pool));
  app.use('/api/v1/firma', crearFirmaRouter(servicio));
  app.use('/api/v1/admin', crearRouterRbac(pool, cache, { redis }));

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

  app.use(errorMiddleware);

  return app;
}

export default construirApp;
