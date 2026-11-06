import crypto from 'node:crypto';
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
import { crearRouterReportes as crearRouterReportesModulares } from './modules/reportes/reportes.routes.js';

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

  app.use(corsMiddleware);
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
  const jwtActorProvider: ActorProviderRutaDoc = {
    obtenerActor: (req) => {
      const auth = req.headers.authorization;
      if (auth && auth.startsWith('Bearer ')) {
        const token = auth.slice(7).trim();
        try {
          const claims = verificarTokenAcceso(token);
          return {
            id: claims.sub,
            roles: claims.roles ?? [],
            unidadOrganicaId: null,
            puedeVerExpediente: () => true,
          };
        } catch {
          return null;
        }
      }
      return null;
    },
  };

  const actorProviderRutaDocEfectivo =
    opts.actorProviderRutaDoc ??
    (opts.obtenerActorRutaDoc ? { obtenerActor: opts.obtenerActorRutaDoc } : jwtActorProvider);
  const actorProviderReportesEfectivo =
    opts.actorProviderReportes ?? opts.actorProviderRutaDoc ?? jwtActorProvider;

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
  const routerReportesModulares = crearRouterReportesModulares(pool);
  app.use('/api/v1/reportes', routerReportesModulares);
  app.get('/api/v1/reportes/exportar/pdf', (req, res, next) => {
    req.url = '/exportar-pdf';
    routerReportesModulares(req, res, next);
  });
  app.get('/api/v1/reportes/exportar/excel', (req, res, next) => {
    req.url = '/exportar-excel';
    routerReportesModulares(req, res, next);
  });
  app.post('/api/v1/reportes/exportar/pdf', (req, res, next) => {
    req.method = 'GET';
    req.url = '/exportar-pdf';
    routerReportesModulares(req, res, next);
  });
  app.post('/api/v1/reportes/exportar/excel', (req, res, next) => {
    req.method = 'GET';
    req.url = '/exportar-excel';
    routerReportesModulares(req, res, next);
  });
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
        `SELECT id_auditoria, correlation_id, usuario_id, ip_origen, esquema, tabla, operacion, fecha_hora, fecha_hora AS creado_en
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

  app.get('/api/v1/admin/roles-permisos', async (_req, res, next) => {
    try {
      const { rows: roles } = await pool.query(
        `SELECT r.rol_id AS id, r.rol_id, r.codigo, r.nombre, r.descripcion,
                COALESCE(json_agg(p.codigo) FILTER (WHERE p.codigo IS NOT NULL), '[]') as permisos
         FROM sigd_org.rol_sistema r
         LEFT JOIN sigd_org.rol_permiso rp ON rp.rol_id = r.rol_id
         LEFT JOIN sigd_org.permiso_sistema p ON p.permiso_id = rp.permiso_id
         GROUP BY r.rol_id, r.codigo, r.nombre, r.descripcion`,
      );
      res.json({ roles });
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/v1/admin/roles-permisos', async (req, res, next) => {
    try {
      const { rolId, permisosIds, permisos } = req.body ?? {};
      const targetRolId = rolId;
      const listaPermisos = permisosIds ?? permisos ?? [];
      const tienePermisoAuditoriaMutacion = Array.isArray(listaPermisos) && listaPermisos.some((p: string) =>
        typeof p === 'string' && (p.includes('audit:delete') || p.includes('audit:update') || p.includes('bitacora:mutar'))
      );
      if (tienePermisoAuditoriaMutacion) {
        return res.status(422).json({
          type: 'https://sigd.iestpsuiza.edu.pe/errors/worm-violation',
          title: 'Violación de Invariante WORM',
          status: 422,
          code: 'WORM_IMMUTABLE_VIOLATION',
          detail: 'No se permite otorgar permisos de edición o borrado sobre la bitácora de auditoría (Directiva WORM LPAG/AGN).',
        });
      }

      // Validar rol existente
      const isUuid = typeof targetRolId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetRolId);
      const rolRes = await pool.query<{ rol_id: string }>(
        isUuid
          ? `SELECT rol_id FROM sigd_org.rol_sistema WHERE rol_id = $1`
          : `SELECT rol_id FROM sigd_org.rol_sistema WHERE codigo = $1`,
        [targetRolId],
      );
      if (rolRes.rowCount === 0) {
        return res.status(404).json({
          type: 'https://sigd.iestpsuiza.edu.pe/errors/not-found',
          title: 'Rol no encontrado',
          status: 404,
          detail: `No se encontró el rol con identificador: ${targetRolId}`,
        });
      }
      const realRolId = rolRes.rows[0].rol_id;

      // Resolver permisos válidos
      const permisosArray: string[] = Array.isArray(listaPermisos) ? listaPermisos : [];
      let permIds: string[] = [];
      if (permisosArray.length > 0) {
        for (const p of permisosArray) {
          const pIsUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p);
          if (!pIsUuid) {
            await pool.query(
              `INSERT INTO sigd_org.permiso_sistema (codigo, nombre, ambito)
               VALUES ($1, $1, 'GLOBAL')
               ON CONFLICT (codigo) DO NOTHING`,
              [p.slice(0, 60)],
            );
          }
        }
        const permRes = await pool.query<{ permiso_id: string }>(
          `SELECT permiso_id FROM sigd_org.permiso_sistema
           WHERE permiso_id::text = ANY($1::text[]) OR codigo = ANY($1::text[])`,
          [permisosArray.map(String)],
        );
        permIds = permRes.rows.map((r) => r.permiso_id);
      }

      // Persistencia transaccional real
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`DELETE FROM sigd_org.rol_permiso WHERE rol_id = $1`, [realRolId]);
        for (const pId of permIds) {
          await client.query(
            `INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [realRolId, pId],
          );
        }
        const correlationId = (req.headers['x-correlation-id'] as string) || crypto.randomUUID();
        await client.query(
          `INSERT INTO sigd_audit.bitacora_auditoria
             (id_auditoria, correlation_id, usuario_id, ip_origen, user_agent, esquema, tabla, operacion, datos_despues)
           VALUES ($1, $2, $3, $4, $5, 'sigd_org', 'rol_permiso', 'UPDATE', $6)`,
          [
            crypto.randomUUID(),
            correlationId,
            (req as any).user?.id || '00000000-0000-0000-0000-000000000001',
            req.ip || '127.0.0.1',
            req.headers['user-agent'] || 'backend-service',
            JSON.stringify({ rol_id: realRolId, total_permisos: permIds.length }),
          ],
        );
        await client.query('COMMIT');
      } catch (dbErr) {
        await client.query('ROLLBACK');
        throw dbErr;
      } finally {
        client.release();
      }

      res.json({ actualizado: true, rolId: realRolId, totalPermisos: permIds.length, mensaje: 'Matriz de roles y permisos actualizada correctamente' });
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/v1/admin/roles/:id/permisos', async (req, res, next) => {
    try {
      const { permisosIds, permisos } = req.body ?? {};
      const targetRolId = req.params.id;
      const listaPermisos = permisosIds ?? permisos ?? [];
      const tienePermisoAuditoriaMutacion = Array.isArray(listaPermisos) && listaPermisos.some((p: string) =>
        typeof p === 'string' && (p.includes('audit:delete') || p.includes('audit:update') || p.includes('bitacora:mutar'))
      );
      if (tienePermisoAuditoriaMutacion) {
        return res.status(422).json({
          type: 'https://sigd.iestpsuiza.edu.pe/errors/worm-violation',
          title: 'Violación de Invariante WORM',
          status: 422,
          code: 'WORM_IMMUTABLE_VIOLATION',
          detail: 'No se permite otorgar permisos de edición o borrado sobre la bitácora de auditoría (Directiva WORM LPAG/AGN).',
        });
      }

      const isUuid = typeof targetRolId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetRolId);
      const rolRes = await pool.query<{ rol_id: string }>(
        isUuid
          ? `SELECT rol_id FROM sigd_org.rol_sistema WHERE rol_id = $1`
          : `SELECT rol_id FROM sigd_org.rol_sistema WHERE codigo = $1`,
        [targetRolId],
      );
      if (rolRes.rowCount === 0) {
        return res.status(404).json({
          type: 'https://sigd.iestpsuiza.edu.pe/errors/not-found',
          title: 'Rol no encontrado',
          status: 404,
          detail: `No se encontró el rol con identificador: ${targetRolId}`,
        });
      }
      const realRolId = rolRes.rows[0].rol_id;

      const permisosArray: string[] = Array.isArray(listaPermisos) ? listaPermisos : [];
      let permIds: string[] = [];
      if (permisosArray.length > 0) {
        for (const p of permisosArray) {
          const pIsUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p);
          if (!pIsUuid) {
            await pool.query(
              `INSERT INTO sigd_org.permiso_sistema (codigo, nombre, ambito)
               VALUES ($1, $1, 'GLOBAL')
               ON CONFLICT (codigo) DO NOTHING`,
              [p.slice(0, 60)],
            );
          }
        }
        const permRes = await pool.query<{ permiso_id: string }>(
          `SELECT permiso_id FROM sigd_org.permiso_sistema
           WHERE permiso_id::text = ANY($1::text[]) OR codigo = ANY($1::text[])`,
          [permisosArray.map(String)],
        );
        permIds = permRes.rows.map((r) => r.permiso_id);
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`DELETE FROM sigd_org.rol_permiso WHERE rol_id = $1`, [realRolId]);
        for (const pId of permIds) {
          await client.query(
            `INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [realRolId, pId],
          );
        }
        const correlationId = (req.headers['x-correlation-id'] as string) || crypto.randomUUID();
        await client.query(
          `INSERT INTO sigd_audit.bitacora_auditoria
             (id_auditoria, correlation_id, usuario_id, ip_origen, user_agent, esquema, tabla, operacion, datos_despues)
           VALUES ($1, $2, $3, $4, $5, 'sigd_org', 'rol_permiso', 'UPDATE', $6)`,
          [
            crypto.randomUUID(),
            correlationId,
            (req as any).user?.id || '00000000-0000-0000-0000-000000000001',
            req.ip || '127.0.0.1',
            req.headers['user-agent'] || 'backend-service',
            JSON.stringify({ rol_id: realRolId, total_permisos: permIds.length }),
          ],
        );
        await client.query('COMMIT');
      } catch (dbErr) {
        await client.query('ROLLBACK');
        throw dbErr;
      } finally {
        client.release();
      }

      res.json({ actualizado: true, rolId: req.params.id, totalPermisos: permIds.length, mensaje: 'Permisos del rol actualizados correctamente' });
    } catch (error) {
      next(error);
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
        `SELECT tipo_documental_id, codigo, nombre, extension, mime_type, tamano_maximo_mb, exige_firma, vigente
         FROM sigd_doc.tipo_documento
         WHERE vigente = TRUE
         ORDER BY nombre ASC`,
      );
      const items = rows.map((r: any) => ({
        id: r.tipo_documental_id,
        tipoDocumentalId: r.tipo_documental_id,
        tipo_documental_id: r.tipo_documental_id,
        codigo: r.codigo,
        nombre: r.nombre,
        extension: r.extension,
        mimeType: r.mime_type,
        mime_type: r.mime_type,
        tamanoMaximoMb: Number(r.tamano_maximo_mb),
        tamano_maximo_mb: Number(r.tamano_maximo_mb),
        exigeFirma: Boolean(r.exige_firma),
        exige_firma: Boolean(r.exige_firma),
        vigente: Boolean(r.vigente),
      }));
      res.json(items);
    } catch (error) {
      next(error);
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
