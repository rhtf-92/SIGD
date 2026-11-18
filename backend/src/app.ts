import express, { Express } from 'express';
import type { Pool } from 'pg';
import { contextMiddleware } from './middleware/context-middleware.js';
import { errorMiddleware } from './middleware/error-middleware.js';
import { crearRouterReferencia } from './referencia/expediente.router.js';
import { crearRouterResoluciones } from './domains/docucore/resoluciones.controller.js';
import { crearUsuariosAdminRouter } from './domains/organicore/usuariosAdmin.routes.js';

// Módulos de DocuCore / Firma Digital (B_VALENTIN)
import { crearFirmaRouter } from './domains/docucore/firma.controller.js';
import { crearRouterDnieFirma } from './domains/docucore/dnieFirma.router.js';
import {
  InMemoryFirmaSessionStore,
  RedisFirmaSessionStore,
  type FirmaSessionStore,
} from './domains/docucore/firmaSession.store.js';
import { InMemoryAlmacenDocumentosFirmables } from './domains/docucore/documentoFirmable.store.js';
import { RefirmaGatewayService } from './domains/docucore/refirmaGateway.service.js';
import { ServicioFirmaService } from './domains/docucore/firma.service.js';

// Módulos CoreLink, IdentiCore, TramiCore, RutaDoc (B_REATEGUI)
import { crearRouterIdenticore } from './domains/identicore/identicore.router.js';
import type { CacheDistribuida } from './domains/identicore/ubigeo.service.js';
import { crearRouterRutaDoc } from './domains/rutadoc/rutadoc.router.js';
import { EnrutabilidadService } from './domains/rutadoc/enrutabilidad.service.js';
import type { ObtenerActorRutaDoc } from './domains/rutadoc/rutadoc.controller.js';
import type {
  FolioCompensationPort,
  PoliticaReversionRutaDoc,
  PrepararCompensacionFolios,
} from './domains/rutadoc/rutadoc.reversion.types.js';
import { crearJwtActorProvider, type ActorProviderRutaDoc } from './domains/rutadoc/rutadoc.actor-provider.js';
import type { CalendarioLaboralPort } from './domains/rutadoc/sla.types.js';
import type { ClasificadorCcdPort } from './domains/rutadoc/ccd.types.js';
import type { DocumentoMetadataPort } from './domains/rutadoc/foliacion.types.js';
import { crearRouterTramites } from './domains/tramicore/tramites.controller.js';
import { crearRouterReportes } from './domains/corelink/reportes.router.js';

// Módulos OrganiCore Maestras, Calendario y Organigrama
import { crearRouterAdminMaestras } from './domains/organicore/adminMaestras.routes.js';
import { OrganigramaService } from './domains/organicore/organigrama.service.js';
import { crearControladorOrganigrama } from './domains/organicore/organigrama.controller.js';

// Módulos DocuCore Router y Validador CVD
import { crearRouterDocuCore } from './domains/docucore/docucore.router.js';
import { crearVerificadorCvd } from './domains/docucore/validadorCvd.controller.js';

// Streaming SSE CoreLink
import { BusSse } from './modules/corelink/sseStream.service.js';
import { crearRouterRealtime } from './modules/corelink/realtime.routes.js';

// Módulos IdentiCore Auth y Casilla
import { crearRouterAuth } from './domains/identicore/auth.router.js';
import { crearRouterCasilla } from './domains/identicore/casilla.router.js';
import { crearRouterVinculosInstitucionales } from './domains/identicore/vinculoInstitucional.router.js';
import { crearRouterOrganizacion } from './domains/organicore/organizacion.router.js';
import { crearRouterAutorizacion } from './core/auth/authorization.router.js';
import { AuthorizationService } from './core/auth/authorization.service.js';
import { crearRouterTesoreria } from './domains/tesoreria/tesoreria.router.js';
import { crearRouterCheckoutDemo } from './domains/tesoreria/providers/demo-qr.checkout.js';

// Módulo Almacenamiento S3 MinIO
import { crearRouterStorage } from './core/storage/storage.router.js';
import type { S3Client } from '@aws-sdk/client-s3';

// Módulo Firma Pendientes (#56)
import { crearRouterFirma as crearRouterFirmaPendientes } from './modules/firma/firma.routes.js';

import { corsMiddleware } from './middleware/cors.middleware.js';
import { securityHeadersMiddleware } from './middleware/security-headers.middleware.js';
import { responseTimeMiddleware } from './middleware/observability.middleware.js';
import { obtenerMetricasPool } from './database.js';
import { extraerTokenBearer, verificarTokenAcceso } from './core/auth/jwt.service.js';
import { UnauthorizedError, ForbiddenError } from './shared/domain/errors/index.js';

export const ROLES_ADMIN_PERMITIDOS = ['ADMINISTRADOR', 'SUPERADMINISTRADOR'] as const;
export const ROLES_SUPERADMIN_PERMITIDOS = ['SUPERADMINISTRADOR'] as const;
const ROLES_INSTITUCIONALES = ['ADMINISTRADOR', 'SUPERADMINISTRADOR', 'DIRECTOR', 'SECRETARIO', 'ESPECIALISTA', 'MESA_PARTES', 'TESORERIA'] as const;

export function requireInstitutionalRole(req: express.Request, _res: express.Response, next: express.NextFunction): void {
  const token = extraerTokenBearer(req.get('authorization'));
  if (!token) throw new UnauthorizedError({ detail: 'Debe autenticarse para consultar las unidades institucionales.' });
  const claims = verificarTokenAcceso(token);
  if (!claims.roles?.some((rol) => (ROLES_INSTITUCIONALES as readonly string[]).includes(rol.toUpperCase()))) {
    throw new ForbiddenError({ detail: 'Se requiere un rol institucional vigente.' });
  }
  next();
}

/**
 * Middleware de guarda de administración institucional (H-08 / N-01 / Fase C2).
 * Exige Bearer Token válido con rol canónico ADMINISTRADOR o SUPERADMINISTRADOR.
 */
export function requireAdminRole(req: express.Request, _res: express.Response, next: express.NextFunction): void {
  const token = extraerTokenBearer(req.get('authorization'));
  if (!token) {
    throw new UnauthorizedError({
      detail: 'Debe autenticarse con Authorization: Bearer <jwt> para acceder a recursos administrativos.',
    });
  }

  const claims = verificarTokenAcceso(token);

  const tieneRol = claims.roles?.some((r) =>
    (ROLES_ADMIN_PERMITIDOS as readonly string[]).includes(r.toUpperCase()),
  );

  if (!tieneRol) {
    throw new ForbiddenError({
      message: 'Acceso denegado.',
      detail: 'Se requiere rol administrativo (ADMINISTRADOR o SUPERADMINISTRADOR) para esta operación.',
    });
  }

  next();
}

/**
 * Middleware de guarda de superadministración técnica de gobierno (Fase C2).
 * Exige Bearer Token válido exclusivamente con rol canónico SUPERADMINISTRADOR.
 */
export function requireSuperAdminRole(req: express.Request, _res: express.Response, next: express.NextFunction): void {
  const token = extraerTokenBearer(req.get('authorization'));
  if (!token) {
    throw new UnauthorizedError({
      detail: 'Debe autenticarse con Authorization: Bearer <jwt> para acceder a recursos de superadministración.',
    });
  }

  const claims = verificarTokenAcceso(token);

  const tieneRol = claims.roles?.some((r) =>
    (ROLES_SUPERADMIN_PERMITIDOS as readonly string[]).includes(r.toUpperCase()),
  );

  if (!tieneRol) {
    throw new ForbiddenError({
      message: 'Acceso denegado.',
      detail: 'Se requiere rol SUPERADMINISTRADOR para esta operación técnica.',
    });
  }

  next();
}

export interface AppOptions {
  busSse?: BusSse;
  ubigeoCache?: CacheDistribuida;
  mgdCache?: CacheDistribuida;
  obtenerActorRutaDoc?: ObtenerActorRutaDoc;
  actorProviderRutaDoc?: ActorProviderRutaDoc;
  politicaReversionRutaDoc?: PoliticaReversionRutaDoc;
  prepararCompensacionFolios?: PrepararCompensacionFolios;
  folioCompensationPort?: FolioCompensationPort;
  calendarioLaboralRutaDoc?: CalendarioLaboralPort;
  clasificadorCcdRutaDoc?: ClasificadorCcdPort;
  documentoMetadataRutaDoc?: DocumentoMetadataPort;
  porcentajeAmarilloSlaRutaDocDesde?: number;
  /** Proveedor de identidad de la analítica ejecutiva; sin él, falla cerrado. */
  actorProviderReportes?: ActorProviderRutaDoc;
  s3Client?: S3Client;
}

export function construirApp(
  pool: Pool,
  opciones: AppOptions | unknown = {},
  ..._resto: unknown[]
): Express {
  let busSse: BusSse;
  let opts: AppOptions;

  if (
    opciones instanceof BusSse ||
    (typeof opciones === 'object' && opciones !== null && 'emitirHeartbeat' in opciones)
  ) {
    busSse = opciones as BusSse;
    opts = {};
  } else if (typeof opciones === 'object' && opciones !== null) {
    opts = opciones as AppOptions;
    busSse = opts.busSse ?? new BusSse();
  } else {
    opts = {};
    busSse = new BusSse();
  }

  const app = express();
  app.disable('x-powered-by');
  app.use(responseTimeMiddleware);
  app.use(securityHeadersMiddleware);

  app.use(corsMiddleware);

  // Parser con límite de 50 MB segmentado exclusivamente para rutas con ingesta de documentos / base64
  const RUTAS_INGESTA_DOCUMENTAL = ['/api/v1/tramites', '/api/v1/storage', '/api/v1/firma'];
  app.use(
    RUTAS_INGESTA_DOCUMENTAL,
    express.json({
      limit: '50mb',
      verify: (req, _res, buf) => {
        (req as unknown as { rawBody?: Buffer }).rawBody = buf;
      },
    }),
  );
  app.use(RUTAS_INGESTA_DOCUMENTAL, express.urlencoded({ extended: true, limit: '50mb' }));

  // Parser estándar con límite de 2 MB para el resto de rutas (mitigación de DoS por memoria)
  app.use(
    express.json({
      limit: '2mb',
      verify: (req, _res, buf) => {
        (req as unknown as { rawBody?: Buffer }).rawBody = buf;
      },
    }),
  );
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use(contextMiddleware);

  app.get('/health', (_req, res) => {
    const poolStats = obtenerMetricasPool(pool);
    res.json({
      status: 'ok',
      estado: 'UP',
      servicio: 'SIGD Backend',
      timestamp: new Date().toISOString(),
      pool: poolStats,
    });
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
    } catch (error) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(`REDIS_REQUIRED_IN_PRODUCTION: No se pudo inicializar RedisFirmaSessionStore: ${(error as Error).message}`);
      }
      sesiones = new InMemoryFirmaSessionStore();
    }
  } else {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('REDIS_REQUIRED_IN_PRODUCTION: REDIS_URL es obligatoria en entorno de producción para el almacenamiento distribuido de sesiones de firma (DOC-01).');
    }
    sesiones = new InMemoryFirmaSessionStore();
  }

  const almacen = new InMemoryAlmacenDocumentosFirmables(sesiones);
  const servicio = new ServicioFirmaService({ sesiones, almacen, pasarela });

  app.get('/ready', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      if (sesiones instanceof RedisFirmaSessionStore) {
        await sesiones.ping();
      }
      res.json({ status: 'ok', estado: 'READY', timestamp: new Date().toISOString() });
    } catch {
      res.status(503).json({ status: 'error', estado: 'NOT_READY' });
    }
  });

  // Rutas
  const jwtActorProvider: ActorProviderRutaDoc = crearJwtActorProvider(pool);

  const actorProviderRutaDocEfectivo =
    opts.actorProviderRutaDoc ??
    (opts.obtenerActorRutaDoc ? { obtenerActor: opts.obtenerActorRutaDoc } : jwtActorProvider);
  const actorProviderReportesEfectivo =
    opts.actorProviderReportes ?? opts.actorProviderRutaDoc ?? jwtActorProvider;

  app.use('/api', crearRouterReferencia(pool, actorProviderRutaDocEfectivo));
  app.use('/api/v1', crearRouterIdenticore(pool, opts.ubigeoCache));
  app.use('/api/v1', crearRouterVinculosInstitucionales(pool));
  const authService = new AuthorizationService(pool);
  app.use('/api/v1', crearRouterOrganizacion(pool));
  app.use('/api/v1', crearRouterAutorizacion(pool));
  app.use('/api/v1', crearRouterAuth(pool));
  app.use('/api/v1', crearRouterCasilla(pool));
  app.use('/api/v1', crearRouterTesoreria(pool));
  app.use(crearRouterCheckoutDemo(pool));
  app.use('/api/v1', crearRouterStorage(pool, opts.s3Client));
  app.use('/api/v1', crearRouterTramites(pool, undefined, opts.s3Client, authService));
  app.use(
    '/api/v1',
    crearRouterRutaDoc(
      pool,
      opts.obtenerActorRutaDoc,
      opts.politicaReversionRutaDoc,
      opts.prepararCompensacionFolios,
      actorProviderRutaDocEfectivo,
      opts.folioCompensationPort,
      {
        calendarioLaboral: opts.calendarioLaboralRutaDoc,
        clasificadorCcd: opts.clasificadorCcdRutaDoc,
        documentoMetadata: opts.documentoMetadataRutaDoc,
        porcentajeAmarilloSlaDesde: opts.porcentajeAmarilloSlaRutaDocDesde,
      },
      authService,
    ),
  );
  app.use('/api/v1', crearRouterReportes(pool, actorProviderReportesEfectivo, opts.mgdCache));
  app.use('/api/v1/resoluciones', crearRouterResoluciones(pool));
  app.use('/api/v1/firma/dnie', crearRouterDnieFirma(pool));
  app.use('/api/v1/firma', crearFirmaRouter(servicio));

  /*
   * OrganiCore - Administración de usuarios
   *
   * GET  /api/v1/admin/usuarios
   * POST /api/v1/admin/usuarios
   * PUT  /api/v1/admin/usuarios/:id
   */
  const usuariosAdminRouter = crearUsuariosAdminRouter(pool);
  app.use('/api/v1/admin/usuarios', usuariosAdminRouter);
  app.use('/api/v1/usuarios', usuariosAdminRouter);

  /*
   * OrganiCore - Tablas Maestras y Calendario Laboral (Feriados Ucayali) (#47, #48, #49)
   */
  const routerAdminMaestras = crearRouterAdminMaestras(pool);
  app.use('/api/v1/admin', requireAdminRole, routerAdminMaestras);
  app.get('/api/v1/admin/calendario/feriados', requireAdminRole, (req, res, next) => {
    req.url = '/calendario-laboral';
    routerAdminMaestras(req, res, next);
  });

  /*
   * OrganiCore - Organigrama y Áreas Jerárquicas ltree (#44, #45)
   */
  const organigramaCtrl = crearControladorOrganigrama(new OrganigramaService(pool));
  const enrutabilidadSvc = new EnrutabilidadService(pool);
  app.get('/api/v1/admin/organigrama', requireAdminRole, organigramaCtrl.getOrganigrama);
  app.get('/api/v1/admin/organigrama/arbol', requireAdminRole, organigramaCtrl.getOrganigrama);
  app.get('/api/v1/organigrama/areas-activas', requireInstitutionalRole, async (_req, res, next) => {
    try {
      const areas = await enrutabilidadSvc.listarAreasEnrutables(pool);
      // Mantiene compatibilidad total con consumidores existentes ({ id, nombre, habilitada })
      // y enriquece con el estado operativo de enrutabilidad
      res.json(
        areas.map((a) => ({
          id: a.id,
          nombre: a.nombre,
          habilitada: a.habilitada,
          enrutable: a.enrutable,
          motivo_no_enrutable: a.motivo_no_enrutable,
        })),
      );
    } catch (error) {
      next(error);
    }
  });
  app.get('/api/v1/organigrama/areas-enrutables', requireInstitutionalRole, async (_req, res, next) => {
    try {
      const areas = await enrutabilidadSvc.listarAreasEnrutables(pool);
      res.json(areas.filter((a) => a.enrutable));
    } catch (error) {
      next(error);
    }
  });
  app.post('/api/v1/admin/organigrama/areas', requireAdminRole, organigramaCtrl.crearUnidad);
  app.put('/api/v1/admin/organigrama/areas/:id', requireAdminRole, organigramaCtrl.actualizarUnidad);

  /*
   * DocuCore - Foliación continua AGN, Callback Refirma y Validador CVD/QR (#31, #35, #36)
   */
  app.use('/api', crearRouterDocuCore(pool));
  const verificadorCvd = crearVerificadorCvd(pool);
  app.get('/api/v1/validador/cvd/:codigo', (req, res, next) => {
    (req.params as Record<string, string>).cvd = req.params.codigo;
    verificadorCvd(req, res).catch(next);
  });

  /*
   * CoreLink - Streaming reactivo Server-Sent Events (SSE) (#55)
   */
  app.use('/api/v1/realtime', crearRouterRealtime(busSse));

  /*
   * DocuCore / Módulo de Firma - Cola de Pendientes para Firma (#56)
   */
  const routerFirmaPendientes = crearRouterFirmaPendientes(pool);
  app.use('/api/v1/firma', routerFirmaPendientes);
  app.use('/api/v1/firmas', routerFirmaPendientes);
  app.get('/api/v1/firmas/cola-firmantes', (req, res, next) => {
    req.url = '/pendientes';
    routerFirmaPendientes(req, res, next);
  });

  /*
   * OrganiCore / CoreLink - Auditoría Bitácora WORM (#46), Roles RBAC (#45) y Maestras
   */
  app.get('/api/v1/admin/auditoria/bitacora', requireAdminRole, async (req, res, next) => {
    try {
      const limite = Math.min(Number(req.query.limite ?? 50), 100);
      const offset = Number(req.query.offset ?? 0);
      const { rows } = await pool.query(
        `SELECT id_auditoria, correlation_id, usuario_id, ip_origen, esquema, tabla, operacion, fecha_hora
         FROM sigd_audit.bitacora_auditoria
         ORDER BY fecha_hora DESC
         LIMIT $1 OFFSET $2`,
        [limite, offset],
      );
      res.json({ total: rows.length, registros: rows });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/v1/admin/roles-permisos', requireAdminRole, async (_req, res, next) => {
    try {
      const { rows: roles } = await pool.query(
        `SELECT r.rol_id AS id, r.codigo, r.nombre, r.descripcion,
                COALESCE(json_agg(p.codigo) FILTER (WHERE p.codigo IS NOT NULL), '[]') as permisos
         FROM sigd_org.rol_sistema r
         LEFT JOIN sigd_org.rol_permiso rp ON rp.rol_id = r.rol_id
         LEFT JOIN sigd_org.permiso_sistema p ON p.permiso_id = rp.permiso_id
         GROUP BY r.rol_id, r.codigo, r.nombre, r.descripcion`,
      );
      res.json({ roles });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/v1/admin/maestras/sede', requireAdminRole, (_req, res) => {
    res.json({
      disponible: false,
      sedes: [],
      mensaje: 'Catálogo de sedes no implementado en el esquema relacional canónico.',
    });
  });

  app.get('/api/v1/admin/maestras/tipo-documento', requireAdminRole, async (_req, res, next) => {
    try {
      const { rows } = await pool.query(
        `SELECT tipo_documental_id AS id, codigo, nombre, extension, mime_type, tamano_maximo_mb, exige_firma, vigente
         FROM sigd_doc.tipo_documento
         WHERE vigente = TRUE
         ORDER BY nombre ASC`,
      );
      res.json(rows);
    } catch (err) {
      next(err);
    }
  });

  /*
   * Alias de Interoperabilidad Frontend-Backend (Plan Maestro §4.1)
   */
  // #14: POST /api/v1/tramite/radicacion -> /api/v1/tramites/radicacion-virtual
  const routerTramites = crearRouterTramites(pool, undefined, opts.s3Client, authService);
  app.post('/api/v1/tramite/radicacion', (req, res, next) => {
    req.url = '/tramites/radicacion-virtual';
    routerTramites(req, res, next);
  });

  app.use(errorMiddleware);

  return app;
}

export default construirApp;
