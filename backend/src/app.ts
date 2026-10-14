import { cuentaActual } from './core/auth/cuenta-actual.js';
import express, { Express } from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
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

import { corsMiddleware } from './middleware/cors.middleware.js';
import { verificarTokenAcceso } from './core/auth/jwt.service.js';
import { crearRouterSalud } from './controllers/health.controller.js';
import { crearRouterWorkflowAcademico } from './domains/docucore/workflowAcademico.router.js';
import { ForbiddenError, NotFoundError, ValidationError } from './shared/domain/errors/index.js';
import { autenticarJwt, autorizarPermisos, PERMISOS_RBAC } from './core/auth/auth.guard.js';

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

  app.use(helmet());
  app.use(corsMiddleware);
  app.use((req, _res, next) => {
    if (process.env.NODE_ENV !== 'test') {
      delete req.headers['x-auth'];
      delete req.headers['x-rol'];
      delete req.headers['x-usuario-id'];
    }
    next();
  });
  app.use(express.json());
  app.use(contextMiddleware);
  app.use(
    '/api/v1/admin',
    autenticarJwt,
    autorizarPermisos(PERMISOS_RBAC.ADMIN_ACCESO),
  );

  const loginRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
  });
  const refreshRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
  });
  const registroCiudadanoRateLimit = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/v1/auth/login', loginRateLimit);
  app.use('/api/v1/auth/refresh', refreshRateLimit);
  app.use('/api/v1/auth/registro-ciudadano', registroCiudadanoRateLimit);

  app.use(crearRouterSalud(pool));

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
  const jwtActorProvider: ActorProviderRutaDoc = {
    obtenerActor: async (req) => {
      const cuenta = await cuentaActual(pool, req);
      return { id: cuenta.id_usuario, roles: cuenta.roles, unidadOrganicaId: cuenta.area_id,
        puedeVerExpediente: async (id: string) => {
          const {rows} = await pool.query('SELECT solicitante_id,area_destino_id FROM sigd_tra.expediente WHERE expediente_id=$1',[id]);
          return Boolean(rows[0] && (rows[0].solicitante_id===cuenta.id_persona || cuenta.permisos.includes('EXPEDIENTE_LEER')));
        }
      };
    },
  };

  const actorProviderRutaDocEfectivo =
    opts.actorProviderRutaDoc ??
    (opts.obtenerActorRutaDoc ? { obtenerActor: opts.obtenerActorRutaDoc } : jwtActorProvider);
  const actorProviderReportesEfectivo =
    opts.actorProviderReportes ?? opts.actorProviderRutaDoc ?? jwtActorProvider;

  if (process.env.NODE_ENV === 'test') {
    app.use('/api', crearRouterReferencia(pool));
  }
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
      actorProviderRutaDocEfectivo,
      opts.folioCompensationPort,
      {
        calendarioLaboral: opts.calendarioLaboralRutaDoc,
        clasificadorCcd: opts.clasificadorCcdRutaDoc,
        documentoMetadata: opts.documentoMetadataRutaDoc,
        porcentajeAmarilloSlaDesde: opts.porcentajeAmarilloSlaRutaDocDesde,
      },
    ),
  );
  app.use('/api/v1', crearRouterReportes(pool, actorProviderReportesEfectivo, opts.mgdCache));
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
  app.use(
    '/api/v1/usuarios',
    autenticarJwt,
    autorizarPermisos(PERMISOS_RBAC.USUARIOS_LEER),
    usuariosAdminRouter,
  );

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
  app.get(
    '/api/v1/admin/organigrama',
    autorizarPermisos(PERMISOS_RBAC.ORGANIGRAMA_LEER),
    organigramaCtrl.getOrganigrama,
  );
  app.get(
    '/api/v1/admin/organigrama/arbol',
    autorizarPermisos(PERMISOS_RBAC.ORGANIGRAMA_LEER),
    organigramaCtrl.getOrganigrama,
  );
  app.post(
    '/api/v1/admin/organigrama/areas',
    autorizarPermisos(PERMISOS_RBAC.ORGANIGRAMA_GESTIONAR),
    organigramaCtrl.crearUnidad,
  );
  app.put(
    '/api/v1/admin/organigrama/areas/:id',
    autorizarPermisos(PERMISOS_RBAC.ORGANIGRAMA_GESTIONAR),
    organigramaCtrl.actualizarUnidad,
  );

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
  app.use('/api/v1/flujos/titulacion', crearRouterWorkflowAcademico(pool));
  app.get('/api/v1/firmas/cola-firmantes', (req, res, next) => {
    req.url = '/pendientes';
    routerFirmaPendientes(req, res, next);
  });

  /*
   * OrganiCore / CoreLink - Auditoría Bitácora WORM (#46), Roles RBAC (#45) y Maestras
   */
  app.get(
    '/api/v1/admin/auditoria/bitacora',
    autorizarPermisos(PERMISOS_RBAC.AUDITORIA_LEER),
    async (req, res, next) => {
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
    },
  );

  app.get(
    '/api/v1/admin/roles-permisos',
    autorizarPermisos(PERMISOS_RBAC.ROLES_LEER),
    async (_req, res, next) => {
      try {
        const { rows: roles } = await pool.query(
          `SELECT r.rol_id AS id, r.codigo, r.nombre, r.descripcion,
                  COALESCE(json_agg(p.codigo) FILTER (WHERE p.codigo IS NOT NULL), '[]') as permisos
           FROM sigd_org.rol_sistema r
           LEFT JOIN sigd_org.rol_permiso rp ON rp.rol_id = r.rol_id
           LEFT JOIN sigd_org.permiso_sistema p ON p.permiso_id = rp.permiso_id
           WHERE r.vigente = TRUE
           GROUP BY r.rol_id, r.codigo, r.nombre, r.descripcion
           ORDER BY r.codigo`,
        );
        res.json({ roles });
      } catch (error) {
        next(error);
      }
    },
  );

  app.put('/api/v1/admin/roles/:codigo/permisos', async (req, res, next) => {
    const cliente = await pool.connect();
    try {
      const actor = await cuentaActual(pool, req);
      if (!actor.roles.includes('SUPER_ADMIN') && !actor.permisos.includes('ADMIN_USUARIOS')) {
        throw new ForbiddenError({ message: 'Se requiere el permiso ADMIN_USUARIOS.' });
      }
      if (!Array.isArray(req.body?.permisos) ||
          req.body.permisos.some((permiso: unknown) => typeof permiso !== 'string')) {
        throw new ValidationError({
          invalidParams: [{ name: 'permisos', reason: 'Debe ser un arreglo de códigos de permiso.' }],
        });
      }
      const alias: Record<string, string[]> = {
        SUPER_ADMIN: ['ADMINISTRADOR'],
        DOCENTE: ['SECRETARIO', 'ESPECIALISTA'],
        ESTUDIANTE: ['CIUDADANO'],
      };
      const codigosRol = alias[String(req.params.codigo)] ?? [String(req.params.codigo)];
      const permisos = [...new Set(req.body.permisos as string[])];
      await cliente.query('BEGIN');
      const roles = await cliente.query<{ rol_id: string; codigo: string }>(
        'SELECT rol_id, codigo FROM sigd_org.rol_sistema WHERE codigo = ANY($1::text[]) AND vigente=TRUE FOR UPDATE',
        [codigosRol],
      );
      if (roles.rows.length !== codigosRol.length) {
        throw new NotFoundError({ message: `Rol ${String(req.params.codigo)} no encontrado.` });
      }
      const encontrados = permisos.length === 0 ? { rows: [] as Array<{ permiso_id: string; codigo: string }> } :
        await cliente.query<{ permiso_id: string; codigo: string }>(
          'SELECT permiso_id, codigo FROM sigd_org.permiso_sistema WHERE codigo = ANY($1::text[])', [permisos],
        );
      if (encontrados.rows.length !== permisos.length) {
        throw new ValidationError({
          invalidParams: [{ name: 'permisos', reason: 'Contiene uno o más códigos inexistentes.' }],
        });
      }
      const idsRol = roles.rows.map((rol) => rol.rol_id);
      await cliente.query('DELETE FROM sigd_org.rol_permiso WHERE rol_id = ANY($1::uuid[])', [idsRol]);
      for (const rolId of idsRol) {
        for (const permiso of encontrados.rows) {
          await cliente.query(
            'INSERT INTO sigd_org.rol_permiso(rol_id, permiso_id) VALUES($1,$2)',
            [rolId, permiso.permiso_id],
          );
        }
      }
      await cliente.query('COMMIT');
      res.json({ codigo: String(req.params.codigo), rolesActualizados: roles.rows.map((rol) => rol.codigo), permisos });
    } catch (error) {
      await cliente.query('ROLLBACK').catch(() => undefined);
      next(error);
    } finally { cliente.release(); }
  });
  app.get(
    '/api/v1/admin/maestras/sede',
    autorizarPermisos(PERMISOS_RBAC.MAESTRAS_LEER),
    (_req, res) => {
      res.json({
        sedes: [
          { id: '1', codigo: 'SEDE_CENTRAL', nombre: 'Sede Central Pucallpa - Av. Túpac Amaru Km. 4.5' },
          { id: '2', codigo: 'SEDE_FILIAL', nombre: 'Filial Yarinacocha' },
        ],
      });
    },
  );

  app.get(
    '/api/v1/admin/maestras/tipo-documento',
    autorizarPermisos(PERMISOS_RBAC.MAESTRAS_LEER),
    async (_req, res, next) => {
      try {
        const { rows } = await pool.query(
          `SELECT id, codigo, nombre, descripcion, dias_atencion_legal, vigente
           FROM sigd_doc.tipo_documento
           WHERE vigente = TRUE
           ORDER BY nombre ASC`,
        );
        res.json(rows);
      } catch (error) {
        next(error);
      }
    },
  );

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
