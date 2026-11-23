import path from 'node:path';
import express, { Express } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import { contextMiddleware } from './middleware/context-middleware.js';
import { errorMiddleware } from './middleware/error-middleware.js';
import { crearRouterReferencia } from './referencia/expediente.router.js';
import { crearRouterResoluciones } from './domains/docucore/resoluciones.controller.js';
import { crearRouterCertificadoIngles } from './domains/docucore/certificadoIngles.controller.js';
import { crearRouterCertificadoEstudios } from './domains/docucore/certificadoEstudios.controller.js';
import { crearUsuariosAdminRouter, exigirAdministracionUsuarios } from './domains/organicore/usuariosAdmin.routes.js';
import { crearUsuariosAdminService } from './domains/organicore/usuariosAdmin.service.js';

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
import type { AlmacenOtp, EntregaOtp } from './domains/identicore/identidadOtp.service.js';
import type { CacheDistribuida } from './domains/identicore/ubigeo.service.js';
import { crearRouterRutaDoc } from './domains/rutadoc/rutadoc.router.js';
import { crearRouterMesaPartes } from './domains/rutadoc/mesaPartes.router.js';
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
import { crearRouterRadicacionPublica } from './domains/tramicore/radicacionPublica.router.js';
import { crearRouterReportes } from './domains/corelink/reportes.router.js';

// Módulos OrganiCore Maestras, Calendario y Organigrama
import { crearRouterAdminMaestras } from './domains/organicore/adminMaestras.routes.js';
import { OrganigramaService } from './domains/organicore/organigrama.service.js';
import { crearControladorOrganigrama } from './domains/organicore/organigrama.controller.js';

// Módulos DocuCore Router y Validador CVD
import { crearRouterDocuCore } from './domains/docucore/docucore.router.js';
import { crearVerificadorCvd, type GeneradorUrlDescarga } from './domains/docucore/validadorCvd.controller.js';

// Streaming SSE CoreLink
import { BusSse } from './modules/corelink/sseStream.service.js';
import { crearRouterRealtime } from './modules/corelink/realtime.routes.js';

// Módulos IdentiCore Auth y Casilla
import { crearRouterAuth } from './domains/identicore/auth.router.js';
import { crearRouterCasilla } from './domains/identicore/casilla.router.js';
import { crearRouterCorreos } from './domains/identicore/correos.router.js';

// Módulo Almacenamiento S3 MinIO
import { crearRouterStorage } from './core/storage/storage.router.js';
import { crearRouterTesoreria } from './domains/tesoreria/tesoreria.router.js';
import { crearRouterPlataforma } from './domains/plataforma/plataforma.router.js';

// Módulo Firma Pendientes (#56)
import { crearRouterFirma as crearRouterFirmaPendientes } from './modules/firma/firma.routes.js';

import { corsMiddleware } from './middleware/cors.middleware.js';
import { verificarTokenAcceso } from './core/auth/jwt.service.js';
import { obtenerAutorizacionCuenta } from './core/auth/auth.guard.js';
import { AppError, UnauthorizedError, ForbiddenError } from './shared/domain/errors/index.js';
import { getRequestContext } from './shared/request-context/request-context.js';

export interface AppOptions {
  /** Institution-approved delivery; absent means contact claims fail closed. */
  entregaOtp?: EntregaOtp;
  almacenOtp?: AlmacenOtp;
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
  storageDocuCore?: GeneradorUrlDescarga;
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
  app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));
  app.use('/sigd-expedientes', express.static(path.resolve(process.cwd(), 'uploads')));
  app.use(express.json({
    verify: (req, _res, bytes) => {
      // El callback HMAC debe verificar los bytes originales, no JSON serializado
      // de nuevo. El resto de rutas conserva el parser y sus límites originales.
      if (req.url?.split('?')[0]?.replace(/\/$/, '') === '/api/v1/firma/callback-refirma') {
        (req as typeof req & { rawBody?: Buffer }).rawBody = Buffer.from(bytes);
      }
    },
  }));
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
    obtenerActor: async (req) => {
      const auth = req.headers.authorization;
      if (auth && auth.startsWith('Bearer ')) {
        const token = auth.slice(7).trim();
        try {
          const claims = verificarTokenAcceso(token);
          if (!z.string().uuid().safeParse(claims.sub).success) return null;
          const autorizacion = await obtenerAutorizacionCuenta(pool, claims.sub, claims.ctx);
          if (!autorizacion) throw new ForbiddenError();
          if (claims.ctx && autorizacion.contextoRevocado) {
            throw new AppError({
              status: 403,
              code: 'CONTEXT_REVOKED',
              message: 'El contexto activo ha sido revocado o no se encuentra vigente. Debe seleccionar un contexto vigente.',
            });
          }
          const unidadOrganicaId = autorizacion.unidadOrganicaId ?? null;
          return {
            id: claims.sub,
            roles: autorizacion.roles,
            permisos: autorizacion.permisos,
            unidadOrganicaId,
            puedeVerExpediente: async (expedienteId) => {
              if (!z.string().uuid().safeParse(claims.sub).success ||
                  !z.string().uuid().safeParse(expedienteId).success) return false;
              if (autorizacion.requiereSeleccionContexto) {
                const esTitular = await pool.query<{ titular: boolean }>(`
                  SELECT EXISTS (
                    SELECT 1 FROM sigd_auth.cuenta_usuario cu
                    JOIN sigd_tra.expediente e ON e.expediente_id = $2::uuid
                    WHERE cu.id_usuario = $1::uuid AND e.solicitante_id = cu.id_persona
                  ) AS titular`, [claims.sub, expedienteId]);
                return esTitular.rows[0]?.titular === true;
              }
              // Misma propiedad y permiso GLOBAL de Storage, sobre el expediente
              // de TramiCore que consultan los repositorios de RutaDoc. No se
              // confunden el UUID de cuenta y el de persona, ni se cachean permisos.
              const acceso = await pool.query<{ autorizado: boolean }>(`
                SELECT EXISTS (
                  SELECT 1
                    FROM sigd_auth.cuenta_usuario cu
                    JOIN sigd_tra.expediente e ON e.expediente_id = $2::uuid
                    LEFT JOIN sigd_rut.estado_actual_expediente ultimo ON ultimo.expediente_id = e.expediente_id
                    LEFT JOIN (
                      SELECT DISTINCT ON (expediente_id)
                             expediente_id, canal_ingreso, anulado
                        FROM sigd_tra.asiento_registro
                       WHERE anulado = FALSE
                       ORDER BY expediente_id, numero_registro ASC
                    ) ar ON ar.expediente_id = e.expediente_id
                   WHERE cu.id_usuario = $1::uuid AND cu.activo = TRUE
                     AND (
                       e.solicitante_id = cu.id_persona
                       OR EXISTS (
                         SELECT 1 FROM sigd_rut.expediente_evaluador ee
                          WHERE ee.expediente_id = e.expediente_id
                            AND ee.id_usuario_docente = cu.id_usuario
                            AND ee.activo = TRUE
                       )
                       OR EXISTS (
                         SELECT 1 FROM sigd_org.usuario_rol ur
                         JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id AND r.vigente = TRUE
                         JOIN sigd_org.rol_permiso rp ON rp.rol_id = r.rol_id
                         JOIN sigd_org.permiso_sistema p ON p.permiso_id = rp.permiso_id
                         WHERE ur.id_usuario = cu.id_usuario
                           AND r.codigo <> 'CIUDADANO' AND r.codigo <> 'ESTUDIANTE'
                           AND ur.vigente_desde <= now()
                           AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
                           AND (
                             (p.codigo = 'EXPEDIENTE_LEER' AND p.ambito = 'GLOBAL' AND ur.area_id IS NULL)
                             OR (
                               p.codigo = 'EXPEDIENTE_LEER' AND ur.area_id IS NOT NULL AND (
                                 ur.area_id::text = NULLIF(ultimo.area_actual_id, '')
                                 OR (
                                   ar.canal_ingreso IN ('MESA_PRESENCIAL', 'MESA_VIRTUAL')
                                   AND (ar.anulado IS FALSE OR ar.anulado IS NULL)
                                   AND ur.area_id::text = (SELECT area_id::text FROM sigd_org.area WHERE codigo = 'MP')
                                 )
                               )
                             )
                           )
                       )
                       OR EXISTS (
                         SELECT 1 FROM sigd_org.usuario_capacidad uc
                         JOIN sigd_org.capacidad_sistema cs ON cs.id_capacidad = uc.id_capacidad AND cs.vigente = TRUE
                         JOIN sigd_org.capacidad_permiso cp ON cp.id_capacidad = cs.id_capacidad
                         JOIN sigd_org.permiso_sistema p ON p.permiso_id = cp.permiso_id
                         WHERE uc.id_usuario = cu.id_usuario
                           AND uc.activo = TRUE
                           AND uc.vigente_desde <= now()
                           AND (uc.vigente_hasta IS NULL OR uc.vigente_hasta > now())
                           AND p.codigo = 'EXPEDIENTE_LEER'
                           AND (
                             uc.area_id::text = NULLIF(ultimo.area_actual_id, '')
                             OR (
                               ar.canal_ingreso IN ('MESA_PRESENCIAL', 'MESA_VIRTUAL')
                               AND (ar.anulado IS FALSE OR ar.anulado IS NULL)
                               AND uc.area_id::text = (SELECT area_id::text FROM sigd_org.area WHERE codigo = 'MP')
                             )
                           )
                       )
                     )
                ) AS autorizado`, [claims.sub, expedienteId]);
              return acceso.rows.length === 1 && acceso.rows[0].autorizado === true;
            },
            obtenerAlcanceBandeja: async () => {
              if (!z.string().uuid().safeParse(claims.sub).success) return null;
              if (autorizacion.requiereSeleccionContexto) {
                const persona = await pool.query<{ solicitante_id: string | null }>(`
                  SELECT cu.id_persona::text AS solicitante_id
                    FROM sigd_auth.cuenta_usuario cu
                   WHERE cu.id_usuario = $1::uuid AND cu.activo = TRUE`, [claims.sub]);
                return {
                  solicitanteId: persona.rows[0]?.solicitante_id ?? null,
                  accesoGlobal: false,
                  esOperadorArea: false,
                };
              }
              const alcance = await pool.query<{ solicitante_id: string | null; acceso_global: boolean; tiene_permiso_area: boolean }>(`
                SELECT cu.id_persona::text AS solicitante_id,
                       EXISTS (
                         SELECT 1 FROM sigd_org.usuario_rol ur
                         JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id AND r.vigente = TRUE
                         JOIN sigd_org.rol_permiso rp ON rp.rol_id = r.rol_id
                         JOIN sigd_org.permiso_sistema p ON p.permiso_id = rp.permiso_id
                         WHERE ur.id_usuario = cu.id_usuario
                           AND r.codigo <> 'CIUDADANO' AND r.codigo <> 'ESTUDIANTE'
                           AND ur.vigente_desde <= now()
                           AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
                           AND p.codigo = 'EXPEDIENTE_LEER' AND p.ambito = 'GLOBAL' AND ur.area_id IS NULL
                       ) AS acceso_global,
                       (
                         EXISTS (
                           SELECT 1 FROM sigd_org.usuario_rol ur
                           JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id AND r.vigente = TRUE
                           JOIN sigd_org.rol_permiso rp ON rp.rol_id = r.rol_id
                           JOIN sigd_org.permiso_sistema p ON p.permiso_id = rp.permiso_id
                           WHERE ur.id_usuario = cu.id_usuario
                             AND r.codigo <> 'CIUDADANO' AND r.codigo <> 'ESTUDIANTE'
                             AND ur.vigente_desde <= now()
                             AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
                             AND p.codigo = 'EXPEDIENTE_LEER' AND ur.area_id IS NOT NULL
                         ) OR EXISTS (
                           SELECT 1 FROM sigd_org.usuario_capacidad uc
                           JOIN sigd_org.capacidad_sistema cs ON cs.id_capacidad = uc.id_capacidad AND cs.vigente = TRUE
                           JOIN sigd_org.capacidad_permiso cp ON cp.id_capacidad = cs.id_capacidad
                           JOIN sigd_org.permiso_sistema p ON p.permiso_id = cp.permiso_id
                           WHERE uc.id_usuario = cu.id_usuario
                             AND uc.activo = TRUE
                             AND uc.vigente_desde <= now()
                             AND (uc.vigente_hasta IS NULL OR uc.vigente_hasta > now())
                             AND p.codigo = 'EXPEDIENTE_LEER'
                         )
                       ) AS tiene_permiso_area
                  FROM sigd_auth.cuenta_usuario cu
                 WHERE cu.id_usuario = $1::uuid AND cu.activo = TRUE`, [claims.sub]);
              if (alcance.rows.length !== 1) return null;
              return {
                solicitanteId: alcance.rows[0].solicitante_id,
                accesoGlobal: alcance.rows[0].acceso_global === true,
                esOperadorArea: alcance.rows[0].tiene_permiso_area === true,
              };
            },
          };
        } catch (error) {
          if (error instanceof UnauthorizedError) return null;
          throw error;
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
  app.use('/api/v1', crearRouterIdenticore(pool, opts.ubigeoCache, { entrega: opts.entregaOtp, almacen: opts.almacenOtp }));
  const routerAuth = crearRouterAuth(pool);
  app.use('/api/v1', routerAuth);
  app.use('/api', routerAuth);
  app.use(routerAuth);
  app.use('/api/v1', crearRouterCasilla(pool));
  app.use('/api/v1', crearRouterCorreos(pool));
  app.use('/api/v1/tramites/publico', crearRouterRadicacionPublica(pool));
  const routerStorage = crearRouterStorage(pool);
  app.use('/api/v1', routerStorage);
  app.use('/api', routerStorage);
  app.use(routerStorage);
  app.use('/api/v1', crearRouterPlataforma(pool));
  app.use('/api/v1/tesoreria', crearRouterTesoreria(pool));
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
  app.use('/api/v1/mesa-partes', crearRouterMesaPartes(pool, actorProviderRutaDocEfectivo));
  app.use('/api/v1/certificados-ingles', crearRouterCertificadoIngles(pool, actorProviderRutaDocEfectivo));
  app.use('/api/v1/certificados-estudios', crearRouterCertificadoEstudios(pool, actorProviderRutaDocEfectivo));
  app.use('/api/v1/firma', crearFirmaRouter(servicio, pool, jwtActorProvider));

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
  app.post('/api/v1/admin/organigrama/areas', exigirAdministracionUsuarios(pool), organigramaCtrl.crearUnidad);
  app.put('/api/v1/admin/organigrama/areas/:id', exigirAdministracionUsuarios(pool), organigramaCtrl.actualizarUnidad);

  /*
   * DocuCore - Foliación continua AGN, Callback Refirma y Validador CVD/QR (#31, #35, #36)
   */
  const storageDocuCore = (opciones as AppOptions)?.storageDocuCore;
  app.use('/api', crearRouterDocuCore(pool, storageDocuCore));
  const verificadorCvd = crearVerificadorCvd(pool, storageDocuCore);
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
  app.get('/api/v1/admin/auditoria/bitacora', exigirAdministracionUsuarios(pool), async (req, res, next) => {
    try {
      const limite = Math.min(Number(req.query.limite ?? 50), 100);
      const offset = Number(req.query.offset ?? 0);
      const { rows } = await pool.query(
        `SELECT id_auditoria, correlation_id, usuario_id, ip_origen, esquema, tabla, operacion, fecha_hora AS creado_en
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

  app.get('/api/v1/admin/roles-permisos', exigirAdministracionUsuarios(pool), async (_req, res, next) => {
    try {
      const { rows: roles } = await pool.query(
        `SELECT r.rol_id AS id, r.codigo, r.nombre, r.descripcion,
                r.vigente,
                (SELECT COUNT(DISTINCT ur.id_usuario)::int FROM sigd_org.usuario_rol ur
                  JOIN sigd_auth.cuenta_usuario cu ON cu.id_usuario=ur.id_usuario AND cu.activo=TRUE
                  WHERE ur.rol_id=r.rol_id AND ur.vigente_desde<=now()
                    AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta>now())) AS usuarios,
                COALESCE(json_agg(DISTINCT p.codigo) FILTER (WHERE p.codigo IS NOT NULL), '[]') as permisos
         FROM sigd_org.rol_sistema r
         LEFT JOIN sigd_org.rol_permiso rp ON rp.rol_id = r.rol_id
         LEFT JOIN sigd_org.permiso_sistema p ON p.permiso_id = rp.permiso_id
         GROUP BY r.rol_id, r.codigo, r.nombre, r.descripcion ORDER BY r.codigo`,
      );
      const { rows: catalogoPermisos } = await pool.query(
        `SELECT permiso_id::text AS id, codigo, nombre, ambito,
                CASE
                  WHEN codigo = 'ADMIN_USUARIOS' THEN 'Administración'
                  WHEN codigo LIKE 'EXPEDIENTE_%' THEN 'Trámite Documentario y RutaDoc'
                  WHEN codigo = 'TRAMICORE_DEVOLUCION_EVALUAR' THEN 'Mesa de Partes'
                  WHEN codigo LIKE 'FIRMA_%' THEN 'Gestión Documentaria'
                  WHEN codigo LIKE 'TESORERIA_%' THEN 'Tesorería'
                  WHEN codigo LIKE 'REPORTE_%' THEN 'Reportes'
                  ELSE 'General'
                END AS modulo,
                CASE
                  WHEN codigo = 'ADMIN_USUARIOS' THEN 'Administración integral de cuentas de usuario, asignación de roles y control de acceso institucional'
                  WHEN codigo = 'EXPEDIENTE_DERIVAR' THEN 'Derivación y transferencia de expedientes hacia otras dependencias u oficinas del instituto'
                  WHEN codigo = 'EXPEDIENTE_LEER' THEN 'Consulta, lectura y seguimiento del estado de expedientes y trámites institucionales'
                  WHEN codigo = 'EXPEDIENTE_RESOLVER' THEN 'Resolución, atención final y emisión de dictamen o proveído sobre expedientes asignados al área'
                  WHEN codigo = 'FIRMA_FIRMAR' THEN 'Emisión y firmado digital con validez legal de documentos oficiales y resoluciones'
                  WHEN codigo = 'REPORTE_LEER' THEN 'Acceso y consulta a paneles estadísticos, indicadores MGD y reportes consolidados'
                  WHEN codigo = 'TRAMICORE_DEVOLUCION_EVALUAR' THEN 'Recepción, examen preliminar y evaluación de solicitudes de devolución y trámites ciudadanos'
                  WHEN codigo = 'TESORERIA_DEVOLUCION_APROBAR' THEN 'Aprobación y autorización formal de devoluciones financieras solicitadas'
                  WHEN codigo = 'TESORERIA_DEVOLUCION_EJECUTAR' THEN 'Ejecución contable y registro de desembolsos de devolución'
                  WHEN codigo = 'TESORERIA_DEVOLUCION_EVALUAR' THEN 'Evaluación presupuestal y liquidación de importes sujetos a devolución'
                  WHEN codigo = 'TESORERIA_LEER' THEN 'Visualización de estados de caja, comprobantes de pago y operaciones de recaudación'
                  WHEN codigo = 'TESORERIA_PAGO_REGISTRAR' THEN 'Registro de ingresos directos en ventanilla y cobro de tasas educativas y TUPA'
                  WHEN codigo = 'TESORERIA_PAGO_VERIFICAR' THEN 'Validación de constancias de depósito y conciliación bancaria de pagos recibidos'
                  WHEN codigo = 'TESORERIA_REPORTES' THEN 'Generación de reportes de recaudación, balances de caja y libros de tesorería'
                  WHEN codigo = 'TESORERIA_TARIFA_PROPONER' THEN 'Formulación y propuesta de nuevos aranceles, tasas y derechos de tramitación'
                  WHEN codigo = 'TESORERIA_TARIFA_VALIDAR' THEN 'Revisión técnica y validación reglamentaria del tarifario institucional'
                  ELSE nombre
                END AS descripcion
         FROM sigd_org.permiso_sistema ORDER BY codigo`
      );
      res.json({ roles, catalogoPermisos });
    } catch (error) {
      next(error);
    }
  });

  // Contrato de edición previsto por la pantalla de Roles y Permisos y su alias canónico
  const handlerEditarPermisos = async (req: any, res: any, next: any) => {
    try {
      const id = z.string().uuid().parse(req.params.id);
      const datos = z.object({
        permisos: z.array(z.string().uuid()).max(1000)
          .refine(ids => new Set(ids).size === ids.length, 'No se admiten permisos duplicados.')
      }).strict().parse(req.body);
      const actorId = getRequestContext()?.usuario_id ?? (req as any).usuarioId;
      if (!actorId) {
        throw new UnauthorizedError({ message: 'No se identificó la sesión del administrador autenticado.' });
      }
      res.json(await crearUsuariosAdminService(pool).actualizarPermisosRol(id, datos.permisos, actorId));
    } catch (error) {
      next(error);
    }
  };

  app.put('/api/v1/roles/:id/permisos', exigirAdministracionUsuarios(pool), handlerEditarPermisos);
  app.put('/api/v1/admin/roles/:id/permisos', exigirAdministracionUsuarios(pool), handlerEditarPermisos);

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
        `SELECT tipo_documental_id, codigo, nombre, vigente
         FROM sigd_doc.tipo_documento
         WHERE vigente = TRUE
         ORDER BY nombre ASC`,
      );
      res.json(rows);
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
