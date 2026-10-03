import express, { Express } from 'express';
import type { Pool } from 'pg';
import { contextMiddleware } from './middleware/context-middleware.js';
import { errorMiddleware } from './middleware/error-middleware.js';
import { crearRouterReferencia } from './referencia/expediente.router.js';
import { crearRouterResoluciones } from './domains/docucore/resoluciones.controller.js';
import { crearUsuariosAdminRouter } from './domains/organicore/usuariosAdmin.routes.js';

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

// Módulos CoreLink, IdentiCore, TramiCore, RutaDoc (B_REATEGUI)
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

// Módulo Almacenamiento S3 MinIO
import { crearRouterStorage } from './core/storage/storage.router.js';

// Módulo Firma Pendientes (#56)
import { crearRouterFirma as crearRouterFirmaPendientes } from './modules/firma/firma.routes.js';

export interface AppOptions {
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
}

export function construirApp(
  pool: Pool,
  opciones: AppOptions | unknown = {},
  ..._resto: unknown[]
): Express {
  const opts: AppOptions =
    typeof opciones === 'object' && opciones !== null && !('emitirHeartbeat' in opciones)
      ? (opciones as AppOptions)
      : {};

  const app = express();
  app.disable('x-powered-by');

  app.use(express.json());
  app.use(contextMiddleware);

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      estado: 'UP',
      servicio: 'SIGD Backend',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/ready', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok', estado: 'READY', timestamp: new Date().toISOString() });
    } catch {
      res.status(503).json({ status: 'error', estado: 'NOT_READY' });
    }
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
  app.use('/api/v1', crearRouterAuth(pool));
  app.use('/api/v1', crearRouterCasilla(pool));
  app.use('/api/v1', crearRouterStorage(pool));
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
  app.use('/api/v1/admin', routerAdminMaestras);
  app.get('/api/v1/admin/calendario/feriados', (req, res, next) => {
    req.url = '/calendario-laboral';
    routerAdminMaestras(req, res, next);
  });

  /*
   * OrganiCore - Organigrama y Áreas Jerárquicas ltree (#44, #45)
   */
  const organigramaCtrl = crearControladorOrganigrama(new OrganigramaService(pool));
  app.get('/api/v1/admin/organigrama', organigramaCtrl.getOrganigrama);
  app.get('/api/v1/admin/organigrama/arbol', organigramaCtrl.getOrganigrama);
  app.post('/api/v1/admin/organigrama/areas', organigramaCtrl.crearUnidad);
  app.put('/api/v1/admin/organigrama/areas/:id', organigramaCtrl.actualizarUnidad);

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
  const busSse = new BusSse();
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
  app.get('/api/v1/admin/auditoria/bitacora', async (req, res, next) => {
    try {
      const limite = Math.min(Number(req.query.limite ?? 50), 100);
      const offset = Number(req.query.offset ?? 0);
      const { rows } = await pool.query(
        `SELECT id_auditoria, correlation_id, usuario_id, ip_origen, esquema, tabla, operacion, creado_en
         FROM sigd_audit.bitacora_auditoria
         ORDER BY creado_en DESC
         LIMIT $1 OFFSET $2`,
        [limite, offset],
      );
      res.json({ total: rows.length, registros: rows });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/v1/admin/roles-permisos', async (_req, res, next) => {
    try {
      const { rows: roles } = await pool.query(
        `SELECT r.id, r.codigo, r.nombre, r.descripcion,
                COALESCE(json_agg(p.codigo) FILTER (WHERE p.codigo IS NOT NULL), '[]') as permisos
         FROM sigd_org.rol_sistema r
         LEFT JOIN sigd_org.rol_permiso rp ON rp.rol_id = r.id
         LEFT JOIN sigd_org.permiso_sistema p ON p.id = rp.permiso_id
         GROUP BY r.id, r.codigo, r.nombre, r.descripcion`,
      );
      res.json({ roles });
    } catch {
      res.json({
        roles: [
          { codigo: 'SUPER_ADMIN', nombre: 'Super Administrador' },
          { codigo: 'DIRECTOR', nombre: 'Director General' },
          { codigo: 'DOCENTE', nombre: 'Docente Titular' },
          { codigo: 'MESA_PARTES', nombre: 'Operador de Mesa de Partes' },
          { codigo: 'ESTUDIANTE', nombre: 'Estudiante / Administrado' },
        ],
      });
    }
  });

  app.get('/api/v1/admin/maestras/sede', (_req, res) => {
    res.json({
      sedes: [
        { id: '1', codigo: 'SEDE_CENTRAL', nombre: 'Sede Central Pucallpa - Av. Túpac Amaru Km. 4.5' },
        { id: '2', codigo: 'SEDE_FILIAL', nombre: 'Filial Yarinacocha' },
      ],
    });
  });

  app.get('/api/v1/admin/maestras/tipo-documento', async (_req, res, next) => {
    try {
      const { rows } = await pool.query(
        `SELECT id, codigo, nombre, descripcion, dias_atencion_legal, vigente
         FROM sigd_doc.tipo_documento
         WHERE vigente = TRUE
         ORDER BY nombre ASC`,
      );
      res.json(rows);
    } catch {
      res.json([
        { codigo: 'SOLICITUD', nombre: 'Solicitud' },
        { codigo: 'OFICIO', nombre: 'Oficio' },
        { codigo: 'MEMORANDO', nombre: 'Memorando' },
        { codigo: 'INFORME', nombre: 'Informe Técnico' },
        { codigo: 'RESOLUCION', nombre: 'Resolución Directoral' },
      ]);
    }
  });

  /*
   * Alias de Interoperabilidad Frontend-Backend (Plan Maestro §4.1)
   */
  // #14: POST /api/v1/tramite/radicacion -> /api/v1/tramites/radicacion-virtual
  const routerTramites = crearRouterTramites(pool);
  app.post('/api/v1/tramite/radicacion', (req, res, next) => {
    req.url = '/tramites/radicacion-virtual';
    routerTramites(req, res, next);
  });

  app.use(errorMiddleware);

  return app;
}

export default construirApp;
