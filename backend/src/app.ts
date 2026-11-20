import { cuentaActual } from './core/auth/cuenta-actual.js';
import express, { Express, type Request } from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import type { Pool } from 'pg';
import { z } from 'zod';
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
import { crearRouterAdminSeguridad } from './domains/organicore/adminSeguridad.routes.js';
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

// Módulo Asistente Virtual Institucional (AsistenteCore)
import { crearRouterAsistente } from './domains/asistente/asistente.router.js';
import { AuditAsistentePg } from './domains/asistente/asistente.audit.js';

// Módulo Firma Pendientes (#56)
import { crearRouterFirma as crearRouterFirmaPendientes } from './modules/firma/firma.routes.js';

import { corsMiddleware } from './middleware/cors.middleware.js';
import { extraerTokenBearer, verificarTokenAcceso } from './core/auth/jwt.service.js';
import { verificarSesionActiva } from './core/auth/sesion-activa.js';
import { crearRouterSalud } from './controllers/health.controller.js';
import { crearRouterWorkflowAcademico } from './domains/docucore/workflowAcademico.router.js';
import { ConflictError, ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from './shared/domain/errors/index.js';
import { registrarMutacion } from './audit/bitacora-auditoria.repository.js';
import { autenticarJwt, autorizarPermisos, PERMISOS_RBAC } from './core/auth/auth.guard.js';
import { verificarAccesoExpediente } from './domains/docucore/docucore.security.js';

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
  app.use(express.json({
    verify: (req, _res, rawBody) => {
      if (req.url?.split('?')[0] === '/api/v1/firma/callback-refirma') {
        // SEC-02: conserva los bytes exactos para validar la firma HMAC del webhook.
        (req as Request & { rawBody: Buffer }).rawBody = Buffer.from(rawBody);
      }
    },
  }));
  app.use(contextMiddleware);
  app.use(
    '/api/v1/admin',
    autenticarJwt,
    autorizarPermisos(pool, PERMISOS_RBAC.ADMIN_ACCESO),
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

  // Asistente Virtual: control de tasa para evitar abuso del endpoint de consulta
  const asistenteRateLimit = rateLimit({
    windowMs: 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/v1/asistente/consulta', asistenteRateLimit);

  app.use(crearRouterSalud(pool));

  // A signed access token is valid only while its persisted session remains active.
  // Public endpoints without a bearer token retain their existing route policy.
  app.use('/api', async (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, private');
    const authOperation = new Set([
      'POST /v1/auth/login',
      'POST /v1/auth/refresh',
      'POST /v1/auth/logout',
      'POST /v1/auth/select-role',
    ]);
    if (authOperation.has(`${req.method} ${req.path}`)) return next();
    const queryToken = req.path.startsWith('/v1/realtime') && typeof req.query.token === 'string'
      ? req.query.token
      : null;
    const token = extraerTokenBearer(req.get('authorization')) ?? queryToken;
    if (!token) return next();
    try {
      const claims = verificarTokenAcceso(token);
      if (!claims.sid) {
        // Legacy unit fixtures sign access tokens without a persisted session.
        if (process.env.NODE_ENV === 'test') return next();
        throw new UnauthorizedError({ detail: 'El token no está vinculado a una sesión vigente.' });
      }
      const sesion = await verificarSesionActiva(pool, token);
      req.cuentaActual = { idUsuario: sesion.sub, roles: sesion.roles };
      next();
    } catch (error) {
      next(error);
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
    obtenerActor: async (req) => {
      const cuenta = await cuentaActual(pool, req);
      return {
        id: cuenta.id_usuario,
        roles: cuenta.roles,
        unidadOrganicaId: cuenta.area_id,
        puedeVerExpediente: async (expedienteId: string) => {
          try {
            await verificarAccesoExpediente(pool, cuenta.id_usuario, expedienteId);
            return true;
          } catch (error) {
            if (error instanceof ForbiddenError || error instanceof NotFoundError) return false;
            throw error;
          }
        },
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
  app.use('/api/v1/firma', crearFirmaRouter(servicio, pool));

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
    autorizarPermisos(pool, PERMISOS_RBAC.USUARIOS_LEER),
    usuariosAdminRouter,
  );

  /*
   * OrganiCore - Tablas Maestras y Calendario Laboral (Feriados Ucayali) (#47, #48, #49)
   */
  const routerAdminMaestras = crearRouterAdminMaestras(pool);
  app.use('/api/v1/admin', routerAdminMaestras);
  app.use('/api/v1/admin/seguridad', crearRouterAdminSeguridad(pool));
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
    autorizarPermisos(pool, PERMISOS_RBAC.ORGANIGRAMA_LEER),
    organigramaCtrl.getOrganigrama,
  );
  app.get(
    '/api/v1/admin/organigrama/arbol',
    autorizarPermisos(pool, PERMISOS_RBAC.ORGANIGRAMA_LEER),
    organigramaCtrl.getOrganigrama,
  );
  app.post(
    '/api/v1/admin/organigrama/areas',
    autorizarPermisos(pool, PERMISOS_RBAC.ORGANIGRAMA_GESTIONAR),
    organigramaCtrl.crearUnidad,
  );
  app.put(
    '/api/v1/admin/organigrama/areas/:id',
    autorizarPermisos(pool, PERMISOS_RBAC.ORGANIGRAMA_GESTIONAR),
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
  app.use('/api/v1/realtime', crearRouterRealtime(busSse, pool));

  /*
   * Asistente Virtual Institucional (AsistenteCore)
   * POST /api/v1/asistente/consulta · GET /api/v1/asistente/sugerencias · GET /api/v1/asistente/estado
   */
  app.use('/api/v1', crearRouterAsistente({ audit: new AuditAsistentePg(pool) }));

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
    autorizarPermisos(pool, PERMISOS_RBAC.AUDITORIA_LEER),
    async (req, res, next) => {
      try {
        const filtro = z.object({
          limite: z.coerce.number().int().min(1).max(100).default(50),
          offset: z.coerce.number().int().min(0).default(0),
          esquema: z.string().trim().min(1).max(64).optional(),
          tabla: z.string().trim().min(1).max(64).optional(),
          operacion: z.enum(['INSERT', 'UPDATE', 'DELETE']).optional(),
          usuarioId: z.string().uuid().optional(),
          desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
            const date = new Date(`${value}T00:00:00Z`);
            return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
          }).optional(),
          hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
            const date = new Date(`${value}T00:00:00Z`);
            return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
          }).optional(),
          q: z.string().trim().max(100).optional(),
          resultado: z.enum(['CORRECTO', 'DENEGADO', 'ERROR']).optional(),
        }).strict().superRefine((value, ctx) => {
          if (value.desde && value.hasta && value.desde > value.hasta) ctx.addIssue({ code: 'custom', path: ['hasta'], message: 'Hasta debe ser igual o posterior a Desde.' });
        }).parse(req.query);
        const valores: unknown[] = [];
        const condiciones: string[] = [];
        const agregar = (fragmento: string, valor: unknown) => {
          valores.push(valor);
          condiciones.push(fragmento.replace('?', `$${valores.length}`));
        };
        if (filtro.esquema) agregar('b.esquema = ?', filtro.esquema);
        if (filtro.tabla) agregar('b.tabla = ?', filtro.tabla);
        if (filtro.operacion) agregar('b.operacion = ?', filtro.operacion);
        if (filtro.usuarioId) agregar('b.usuario_id = ?::uuid', filtro.usuarioId);
        if (filtro.desde) agregar('b.fecha_hora >= ?::date', filtro.desde);
        if (filtro.hasta) agregar("b.fecha_hora < (?::date + interval '1 day')", filtro.hasta);
        if (filtro.q) {
          agregar(
            `concat_ws(' ', b.id_auditoria::text, b.correlation_id::text, COALESCE(b.usuario_id::text,''), COALESCE(cu.usuario,''), COALESCE(cu.correo,''), COALESCE(pn.nombre_completo,''), b.esquema, b.tabla, b.operacion, b.datos_despues::text) ILIKE ?`,
            `%${filtro.q}%`,
          );
        }
        if (filtro.resultado === 'DENEGADO') condiciones.push("b.datos_despues->>'evento' IN ('FALLIDO','BLOQUEADO')");
        else if (filtro.resultado === 'CORRECTO') condiciones.push("(b.datos_despues->>'evento' = 'CORRECTO' OR b.datos_despues->>'evento' IS NULL)");
        else if (filtro.resultado) agregar("b.datos_despues->>'evento' = ?", filtro.resultado);
        const where = condiciones.length ? ` WHERE ${condiciones.join(' AND ')}` : '';
        const joins = `
          LEFT JOIN sigd_auth.cuenta_usuario cu ON cu.id_usuario = b.usuario_id
          LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = cu.id_persona
          LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = cu.id_persona
          LEFT JOIN LATERAL (
            SELECT a.nombre AS area_nombre
              FROM sigd_org.asignacion_personal ap
              JOIN sigd_org.area a ON a.area_id = ap.area_id
             WHERE ap.id_usuario = b.usuario_id
               AND ap.vigente_desde <= now()
               AND (ap.vigente_hasta IS NULL OR ap.vigente_hasta > now())
             ORDER BY ap.vigente_desde DESC
             LIMIT 1
          ) area_act ON TRUE
          LEFT JOIN LATERAL (
            SELECT string_agg(DISTINCT r.nombre, ', ' ORDER BY r.nombre) AS rol_nombre
              FROM sigd_org.usuario_rol ur
              JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id
             WHERE ur.id_usuario = b.usuario_id
               AND ur.vigente_desde <= now()
               AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
          ) rol_act ON TRUE`;
        const { rows: totalRows } = await pool.query<{ total: number; exitosos: number; denegados: number; errores: number }>(
          `SELECT count(*)::int AS total,
                  count(*) FILTER (WHERE b.datos_despues->>'evento' = 'CORRECTO' OR b.datos_despues->>'evento' IS NULL)::int AS exitosos,
                  count(*) FILTER (WHERE b.datos_despues->>'evento' IN ('FALLIDO','BLOQUEADO'))::int AS denegados,
                  count(*) FILTER (WHERE b.datos_despues->>'evento' = 'ERROR')::int AS errores
             FROM sigd_audit.bitacora_auditoria b${joins}${where}`,
          valores,
        );
        const { rows } = await pool.query(
          `SELECT id_auditoria, b.correlation_id, b.usuario_id, b.ip_origen, b.esquema, b.tabla, b.operacion,
                  b.fecha_hora AS creado_en, b.datos_antes, b.datos_despues,
                  COALESCE(pn.nombre_completo, pj.razon_social, cu.usuario) AS usuario_nombre,
                  cu.usuario AS usuario_login,
                  rol_act.rol_nombre,
                  area_act.area_nombre,
                  count(*) OVER()::int AS total
             FROM sigd_audit.bitacora_auditoria b${joins}${where}
            ORDER BY b.fecha_hora DESC LIMIT $${valores.length + 1} OFFSET $${valores.length + 2}`,
          [...valores, filtro.limite, filtro.offset],
        );
        const { rows: modulos } = await pool.query<{ esquema: string }>(
          'SELECT DISTINCT esquema FROM sigd_audit.bitacora_auditoria ORDER BY esquema',
        );
        res.json({
          total: Number(totalRows[0]?.total ?? 0),
          resumen: {
            exitosos: Number(totalRows[0]?.exitosos ?? 0),
            denegados: Number(totalRows[0]?.denegados ?? 0),
            errores: Number(totalRows[0]?.errores ?? 0),
          },
          modulos: modulos.map((row) => row.esquema),
          registros: rows.map(({ total: _total, ...row }) => row),
        });
      } catch (error) {
        next(error);
      }
    },
  );

  app.get(
    '/api/v1/admin/roles-permisos',
    autorizarPermisos(pool, PERMISOS_RBAC.ROLES_LEER),
    async (req, res, next) => {
      try {
        const incluirInactivos = req.query.incluirInactivos === 'true';
        const { rows: roles } = await pool.query(
          `SELECT r.rol_id AS id, r.codigo, r.nombre, r.descripcion, r.vigente,
                  count(DISTINCT ur.id_usuario)::int AS usuarios,
                  COALESCE(json_agg(DISTINCT p.codigo) FILTER (WHERE p.codigo IS NOT NULL), '[]') as permisos
           FROM sigd_org.rol_sistema r
           LEFT JOIN sigd_org.rol_permiso rp ON rp.rol_id = r.rol_id
           LEFT JOIN sigd_org.permiso_sistema p ON p.permiso_id = rp.permiso_id
           LEFT JOIN sigd_org.usuario_rol ur ON ur.rol_id = r.rol_id
             AND ur.vigente_desde <= now() AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
           WHERE ($1::boolean = TRUE OR r.vigente = TRUE)
           GROUP BY r.rol_id, r.codigo, r.nombre, r.descripcion, r.vigente
           ORDER BY r.codigo`,
          [incluirInactivos],
        );
        res.json({ roles });
      } catch (error) {
        next(error);
      }
    },
  );

  app.post('/api/v1/admin/roles', async (req, res, next) => {
    const cliente = await pool.connect();
    try {
      const actor = await cuentaActual(pool, req);
      if (!actor.roles.includes('SUPER_ADMIN')) {
        throw new ForbiddenError({ message: 'Solo SUPER_ADMIN puede crear roles del sistema.' });
      }
      const datos = z.object({
        codigo: z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9_]{1,29}$/, 'Use mayúsculas, números o guion bajo (2-30 caracteres).'),
        nombre: z.string().trim().min(2).max(120),
        descripcion: z.string().trim().max(500).optional().nullable(),
        permisos: z.array(z.string().trim().min(1)).optional().default([]),
      }).strict().parse(req.body);
      const permisosUnicos = [...new Set(datos.permisos)];
      await cliente.query('BEGIN');
      const encontrados = permisosUnicos.length === 0
        ? { rows: [] as Array<{ permiso_id: string; codigo: string }> }
        : await cliente.query<{ permiso_id: string; codigo: string }>(
            'SELECT permiso_id, codigo FROM sigd_org.permiso_sistema WHERE codigo = ANY($1::text[])',
            [permisosUnicos],
          );
      if (encontrados.rows.length !== permisosUnicos.length) {
        throw new ValidationError({
          invalidParams: [{ name: 'permisos', reason: 'Contiene uno o más códigos de permiso inexistentes.' }],
        });
      }
      const creado = await cliente.query<{ id: string; codigo: string; nombre: string; descripcion: string | null; vigente: boolean }>(
        `INSERT INTO sigd_org.rol_sistema (codigo, nombre, descripcion)
         VALUES ($1, $2, $3)
         RETURNING rol_id AS id, codigo, nombre, descripcion, vigente`,
        [datos.codigo, datos.nombre, datos.descripcion ?? null],
      );
      const rol = creado.rows[0];
      for (const permiso of encontrados.rows) {
        await cliente.query('INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id) VALUES ($1, $2)', [rol.id, permiso.permiso_id]);
      }
      await registrarMutacion(cliente, {
        esquema: 'sigd_org',
        tabla: 'rol_sistema',
        operacion: 'INSERT',
        datos_antes: null,
        datos_despues: { evento: 'CORRECTO', accion: 'ROL_CREADO', ...rol, permisos: permisosUnicos },
      });
      await cliente.query('COMMIT');
      res.status(201).json({ rol: { ...rol, usuarios: 0, permisos: permisosUnicos } });
    } catch (error) {
      await cliente.query('ROLLBACK').catch(() => undefined);
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
        return next(new ConflictError({ code: 'ROL_DUPLICADO', message: 'Ya existe un rol con el mismo código.' }));
      }
      next(error);
    } finally { cliente.release(); }
  });

  app.put('/api/v1/admin/roles/:codigo', async (req, res, next) => {
    const cliente = await pool.connect();
    try {
      const actor = await cuentaActual(pool, req);
      if (!actor.roles.includes('SUPER_ADMIN')) {
        throw new ForbiddenError({ message: 'Solo SUPER_ADMIN puede editar roles del sistema.' });
      }
      const datos = z.object({
        nombre: z.string().trim().min(2).max(120),
        descripcion: z.string().trim().max(500).optional().nullable(),
      }).strict().parse(req.body);
      const codigo = String(req.params.codigo).trim().toUpperCase();
      const codigoDb = codigo === 'SUPER_ADMIN' ? 'ADMINISTRADOR' : codigo === 'ESTUDIANTE' ? 'CIUDADANO' : codigo;
      await cliente.query('BEGIN');
      const previo = await cliente.query<{ rol_id: string; codigo: string; nombre: string; descripcion: string | null }>(
        'SELECT rol_id, codigo, nombre, descripcion FROM sigd_org.rol_sistema WHERE codigo = $1 FOR UPDATE',
        [codigoDb],
      );
      if (!previo.rows[0]) throw new NotFoundError({ message: `Rol ${codigo} no encontrado.` });
      const actualizado = await cliente.query<{ id: string; codigo: string; nombre: string; descripcion: string | null; vigente: boolean }>(
        `UPDATE sigd_org.rol_sistema SET nombre = $2, descripcion = $3
          WHERE rol_id = $1
         RETURNING rol_id AS id, codigo, nombre, descripcion, vigente`,
        [previo.rows[0].rol_id, datos.nombre, datos.descripcion ?? null],
      );
      await registrarMutacion(cliente, {
        esquema: 'sigd_org',
        tabla: 'rol_sistema',
        operacion: 'UPDATE',
        datos_antes: previo.rows[0],
        datos_despues: { evento: 'CORRECTO', accion: 'ROL_ACTUALIZADO', ...actualizado.rows[0] },
      });
      await cliente.query('COMMIT');
      res.json({ rol: actualizado.rows[0] });
    } catch (error) {
      await cliente.query('ROLLBACK').catch(() => undefined);
      next(error);
    } finally { cliente.release(); }
  });

  app.patch('/api/v1/admin/roles/:codigo/vigencia', async (req, res, next) => {
    const cliente = await pool.connect();
    try {
      const actor = await cuentaActual(pool, req);
      if (!actor.roles.includes('SUPER_ADMIN')) {
        throw new ForbiddenError({ message: 'Solo SUPER_ADMIN puede cambiar la vigencia de roles.' });
      }
      const { vigente } = z.object({ vigente: z.boolean() }).strict().parse(req.body);
      const codigo = String(req.params.codigo).trim().toUpperCase();
      const codigoDb = codigo === 'SUPER_ADMIN' ? 'ADMINISTRADOR' : codigo === 'ESTUDIANTE' ? 'CIUDADANO' : codigo;
      if (!vigente && codigoDb === 'ADMINISTRADOR') {
        throw new ConflictError({ code: 'ROL_PROTEGIDO', message: 'No se puede desactivar el rol principal de Superadministrador.' });
      }
      await cliente.query('BEGIN');
      const previo = await cliente.query<{ rol_id: string; codigo: string; vigente: boolean }>(
        'SELECT rol_id, codigo, vigente FROM sigd_org.rol_sistema WHERE codigo = $1 FOR UPDATE',
        [codigoDb],
      );
      if (!previo.rows[0]) throw new NotFoundError({ message: `Rol ${codigo} no encontrado.` });
      if (!vigente) {
        const activos = await cliente.query<{ total: number }>(
          `SELECT count(*)::int AS total FROM sigd_org.usuario_rol
            WHERE rol_id = $1 AND vigente_desde <= now() AND (vigente_hasta IS NULL OR vigente_hasta > now())`,
          [previo.rows[0].rol_id],
        );
        if ((activos.rows[0]?.total ?? 0) > 0) {
          throw new ConflictError({
            code: 'ROL_CON_USUARIOS_ACTIVOS',
            message: 'No se puede desactivar un rol con usuarios activos asignados.',
          });
        }
      }
      const actualizado = await cliente.query<{ id: string; codigo: string; nombre: string; vigente: boolean }>(
        'UPDATE sigd_org.rol_sistema SET vigente = $2 WHERE rol_id = $1 RETURNING rol_id AS id, codigo, nombre, vigente',
        [previo.rows[0].rol_id, vigente],
      );
      await registrarMutacion(cliente, {
        esquema: 'sigd_org',
        tabla: 'rol_sistema',
        operacion: 'UPDATE',
        datos_antes: previo.rows[0],
        datos_despues: { evento: 'CORRECTO', accion: vigente ? 'ROL_ACTIVADO' : 'ROL_DESACTIVADO', ...actualizado.rows[0] },
      });
      await cliente.query('COMMIT');
      res.json({ rol: actualizado.rows[0] });
    } catch (error) {
      await cliente.query('ROLLBACK').catch(() => undefined);
      next(error);
    } finally { cliente.release(); }
  });

  app.put('/api/v1/admin/roles/:codigo/permisos', async (req, res, next) => {
    const cliente = await pool.connect();
    try {
      const actor = await cuentaActual(pool, req);
      if (!actor.roles.includes('SUPER_ADMIN')) {
        throw new ForbiddenError({ message: 'Solo SUPER_ADMIN puede modificar permisos de roles.' });
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
      const previos = await cliente.query<{ codigo: string }>(
        `SELECT DISTINCT p.codigo
           FROM sigd_org.rol_permiso rp
           JOIN sigd_org.permiso_sistema p ON p.permiso_id = rp.permiso_id
          WHERE rp.rol_id = ANY($1::uuid[])
          ORDER BY p.codigo`,
        [idsRol],
      );
      await cliente.query('DELETE FROM sigd_org.rol_permiso WHERE rol_id = ANY($1::uuid[])', [idsRol]);
      for (const rolId of idsRol) {
        for (const permiso of encontrados.rows) {
          await cliente.query(
            'INSERT INTO sigd_org.rol_permiso(rol_id, permiso_id) VALUES($1,$2)',
            [rolId, permiso.permiso_id],
          );
        }
      }
      await registrarMutacion(cliente, {
        esquema: 'sigd_org',
        tabla: 'rol_permiso',
        operacion: 'UPDATE',
        datos_antes: { codigo: String(req.params.codigo), roles: roles.rows.map((r) => r.codigo), permisos: previos.rows.map((p) => p.codigo) },
        datos_despues: { evento: 'CORRECTO', accion: 'PERMISOS_ROL_ACTUALIZADOS', codigo: String(req.params.codigo), roles: roles.rows.map((r) => r.codigo), permisos },
      });
      await cliente.query('COMMIT');
      res.json({ codigo: String(req.params.codigo), rolesActualizados: roles.rows.map((rol) => rol.codigo), permisos });
    } catch (error) {
      await cliente.query('ROLLBACK').catch(() => undefined);
      next(error);
    } finally { cliente.release(); }
  });

  app.get(
    '/api/v1/admin/maestras/sede',
    autorizarPermisos(pool, PERMISOS_RBAC.MAESTRAS_LEER),
    async (req, res, next) => {
      try {
        const incluirInactivos = req.query.solo_activos === 'false';
        const { rows } = await pool.query<{ id: string; codigo: string; nombre: string; direccion: string | null; vigente: boolean }>(
          `SELECT sede_id AS id, codigo, nombre, direccion, vigente
             FROM sigd_org.sede
            WHERE ($1::boolean = TRUE OR vigente = TRUE)
            ORDER BY nombre ASC`,
          [incluirInactivos],
        );
        res.json({ sedes: rows });
      } catch (error) {
        next(error);
      }
    },
  );

  app.post(
    '/api/v1/admin/maestras/sede',
    autorizarPermisos(pool, PERMISOS_RBAC.MAESTRAS_GESTIONAR),
    async (req, res, next) => {
      const cliente = await pool.connect();
      try {
        const datos = z.object({
          codigo: z.string().trim().min(1).max(30).regex(/^[A-Za-z0-9._-]+$/),
          nombre: z.string().trim().min(1).max(160),
          direccion: z.string().trim().max(255).optional().nullable(),
        }).strict().parse(req.body);
        await cliente.query('BEGIN');
        const { rows } = await cliente.query<{ id: string; codigo: string; nombre: string; direccion: string | null; vigente: boolean }>(
          `INSERT INTO sigd_org.sede (codigo, nombre, direccion)
           VALUES ($1, $2, $3)
           RETURNING sede_id AS id, codigo, nombre, direccion, vigente`,
          [datos.codigo.toUpperCase(), datos.nombre, datos.direccion ?? null],
        );
        await registrarMutacion(cliente, {
          esquema: 'sigd_org',
          tabla: 'sede',
          operacion: 'INSERT',
          datos_antes: null,
          datos_despues: { evento: 'CORRECTO', ...rows[0] },
        });
        await cliente.query('COMMIT');
        res.status(201).json({ sede: rows[0], guardado: true });
      } catch (error) {
        await cliente.query('ROLLBACK').catch(() => undefined);
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
          return next(new ConflictError({ code: 'CODIGO_MAESTRO_DUPLICADO', message: 'El código de sede ya existe.' }));
        }
        next(error);
      } finally { cliente.release(); }
    },
  );

  app.put(
    '/api/v1/admin/maestras/sede/:id',
    autorizarPermisos(pool, PERMISOS_RBAC.MAESTRAS_GESTIONAR),
    async (req, res, next) => {
      const cliente = await pool.connect();
      try {
        const id = z.string().uuid().parse(req.params.id);
        const datos = z.object({
          codigo: z.string().trim().min(1).max(30).regex(/^[A-Za-z0-9._-]+$/),
          nombre: z.string().trim().min(1).max(160),
          direccion: z.string().trim().max(255).optional().nullable(),
        }).strict().parse(req.body);
        await cliente.query('BEGIN');
        const previo = await cliente.query('SELECT sede_id AS id, codigo, nombre, direccion, vigente FROM sigd_org.sede WHERE sede_id = $1 FOR UPDATE', [id]);
        if (!previo.rows[0]) throw new NotFoundError({ message: 'La sede indicada no existe.' });
        const { rows } = await cliente.query(
          `UPDATE sigd_org.sede SET codigo = $2, nombre = $3, direccion = $4
            WHERE sede_id = $1
           RETURNING sede_id AS id, codigo, nombre, direccion, vigente`,
          [id, datos.codigo.toUpperCase(), datos.nombre, datos.direccion ?? null],
        );
        await registrarMutacion(cliente, {
          esquema: 'sigd_org',
          tabla: 'sede',
          operacion: 'UPDATE',
          datos_antes: previo.rows[0],
          datos_despues: { evento: 'CORRECTO', ...rows[0] },
        });
        await cliente.query('COMMIT');
        res.json({ sede: rows[0], guardado: true });
      } catch (error) {
        await cliente.query('ROLLBACK').catch(() => undefined);
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
          return next(new ConflictError({ code: 'CODIGO_MAESTRO_DUPLICADO', message: 'El código de sede ya existe.' }));
        }
        next(error);
      } finally { cliente.release(); }
    },
  );

  app.patch(
    '/api/v1/admin/maestras/sede/:id/vigencia',
    autorizarPermisos(pool, PERMISOS_RBAC.MAESTRAS_GESTIONAR),
    async (req, res, next) => {
      const cliente = await pool.connect();
      try {
        const id = z.string().uuid().parse(req.params.id);
        const { vigente } = z.object({ vigente: z.boolean() }).strict().parse(req.body);
        await cliente.query('BEGIN');
        const previo = await cliente.query('SELECT sede_id AS id, codigo, vigente FROM sigd_org.sede WHERE sede_id = $1 FOR UPDATE', [id]);
        if (!previo.rows[0]) throw new NotFoundError({ message: 'La sede indicada no existe.' });
        const { rows } = await cliente.query(
          'UPDATE sigd_org.sede SET vigente = $2 WHERE sede_id = $1 RETURNING sede_id AS id, codigo, nombre, direccion, vigente',
          [id, vigente],
        );
        await registrarMutacion(cliente, {
          esquema: 'sigd_org',
          tabla: 'sede',
          operacion: 'UPDATE',
          datos_antes: previo.rows[0],
          datos_despues: { evento: 'CORRECTO', ...rows[0] },
        });
        await cliente.query('COMMIT');
        res.json({ sede: rows[0], guardado: true, vigente });
      } catch (error) {
        await cliente.query('ROLLBACK').catch(() => undefined);
        next(error);
      } finally { cliente.release(); }
    },
  );

  app.get(
    '/api/v1/admin/maestras/tipo-documento',
    autorizarPermisos(pool, PERMISOS_RBAC.MAESTRAS_LEER),
    async (_req, res, next) => {
      try {
        const { rows } = await pool.query(
          `SELECT tipo_documental_id AS id, codigo, nombre, extension, mime_type, tamano_maximo_mb, exige_firma, vigente
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
