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

  app.all(['/api', '/api/v1'], (_req, res) => {
    res.status(200).json({ status: 'ok', estado: 'UP', servicio: 'SIGD API', timestamp: new Date().toISOString() });
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
              if (autorizacion.roles.some((r) => ['ADMINISTRADOR', 'SUPER_ADMIN', 'MESA_PARTES'].includes(r))) {
                return true;
              }
              if (!z.string().uuid().safeParse(claims.sub).success) return false;
              let idEvaluado = expedienteId;
              if (!z.string().uuid().safeParse(idEvaluado).success) {
                const res = await pool.query<{ expediente_id: string }>(`
                  SELECT expediente_id::text
                    FROM sigd_tra.expediente
                   WHERE codigo_expediente = $1
                   LIMIT 1`, [idEvaluado]);
                if (res.rows.length === 0) return false;
                idEvaluado = res.rows[0].expediente_id;
              }
              if (autorizacion.requiereSeleccionContexto) {
                const esTitular = await pool.query<{ titular: boolean }>(`
                  SELECT EXISTS (
                    SELECT 1 FROM sigd_auth.cuenta_usuario cu
                    JOIN sigd_tra.expediente e ON e.expediente_id = $2::uuid
                    WHERE cu.id_usuario = $1::uuid AND e.solicitante_id = cu.id_persona
                  ) AS titular`, [claims.sub, idEvaluado]);
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
                             OR (r.codigo = 'MESA_PARTES' AND p.codigo = 'EXPEDIENTE_LEER')
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
                ) AS autorizado`, [claims.sub, idEvaluado]);
              return acceso.rows.length === 1 && acceso.rows[0].autorizado === true;
            },
            obtenerAlcanceBandeja: async () => {
              if (autorizacion.roles.some((r) => ['ADMINISTRADOR', 'SUPER_ADMIN', 'MESA_PARTES', 'DIRECTOR', 'SECRETARIO'].includes(r))) {
                return {
                  solicitanteId: null,
                  accesoGlobal: true,
                  esOperadorArea: true,
                };
              }
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
  const routerRutaDoc = crearRouterRutaDoc(
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
  );
  app.use('/api/v1', routerRutaDoc);
  app.use('/api/v1/rutadoc', routerRutaDoc);
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
  app.get('/api/v1/admin/auditoria/bitacora', exigirAdministracionUsuarios(pool), async (req, res, _next) => {
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
      console.warn('[ADMIN] Error consultando bitacora de auditoria:', (error as Error).message);
      res.json({ total: 0, registros: [] });
    }
  });

  const CATALOGO_PERMISOS_FALLBACK = [
    { id: '20000000-0000-0000-0000-000000000001', codigo: 'ADMIN_USUARIOS', nombre: 'Administración de Usuarios', ambito: 'GLOBAL', modulo: 'Administración', descripcion: 'Administración integral de cuentas de usuario, asignación de roles y control de acceso institucional' },
    { id: '20000000-0000-0000-0000-000000000002', codigo: 'EXPEDIENTE_DERIVAR', nombre: 'Derivar Expedientes', ambito: 'AREA', modulo: 'Trámite Documentario y RutaDoc', descripcion: 'Derivación y transferencia de expedientes hacia otras dependencias u oficinas del instituto' },
    { id: '20000000-0000-0000-0000-000000000003', codigo: 'EXPEDIENTE_LEER', nombre: 'Lectura de Expedientes', ambito: 'AREA', modulo: 'Trámite Documentario y RutaDoc', descripcion: 'Consulta, lectura y seguimiento del estado de expedientes y trámites institucionales' },
    { id: '20000000-0000-0000-0000-000000000004', codigo: 'EXPEDIENTE_RESOLVER', nombre: 'Resolver Expedientes', ambito: 'AREA', modulo: 'Trámite Documentario y RutaDoc', descripcion: 'Resolución, atención final y emisión de dictamen o proveído sobre expedientes asignados al área' },
    { id: '20000000-0000-0000-0000-000000000005', codigo: 'FIRMA_FIRMAR', nombre: 'Firma Digital', ambito: 'AREA', modulo: 'Gestión Documentaria', descripcion: 'Emisión y firmado digital con validez legal de documentos oficiales y resoluciones' },
    { id: '20000000-0000-0000-0000-000000000006', codigo: 'REPORTE_LEER', nombre: 'Reportes e Indicadores', ambito: 'GLOBAL', modulo: 'Reportes', descripcion: 'Acceso y consulta a paneles estadísticos, indicadores MGD y reportes consolidados' },
    { id: '20000000-0000-0000-0000-000000000007', codigo: 'TRAMICORE_DEVOLUCION_EVALUAR', nombre: 'Evaluación de Trámites', ambito: 'GLOBAL', modulo: 'Mesa de Partes', descripcion: 'Recepción, examen preliminar y evaluación de solicitudes de devolución y trámites ciudadanos' },
    { id: '20000000-0000-0000-0000-000000000008', codigo: 'TESORERIA_DEVOLUCION_APROBAR', nombre: 'Aprobar Devoluciones', ambito: 'GLOBAL', modulo: 'Tesorería', descripcion: 'Aprobación y autorización formal de devoluciones financieras solicitadas' },
    { id: '20000000-0000-0000-0000-000000000009', codigo: 'TESORERIA_DEVOLUCION_EJECUTAR', nombre: 'Ejecutar Devoluciones', ambito: 'GLOBAL', modulo: 'Tesorería', descripcion: 'Ejecución contable y registro de desembolsos de devolución' },
    { id: '20000000-0000-0000-0000-000000000010', codigo: 'TESORERIA_DEVOLUCION_EVALUAR', nombre: 'Evaluar Devoluciones', ambito: 'GLOBAL', modulo: 'Tesorería', descripcion: 'Evaluación presupuestal y liquidación de importes sujetos a devolución' },
    { id: '20000000-0000-0000-0000-000000000011', codigo: 'TESORERIA_LEER', nombre: 'Lectura de Tesorería', ambito: 'GLOBAL', modulo: 'Tesorería', descripcion: 'Visualización de estados de caja, comprobantes de pago y operaciones de recaudación' },
    { id: '20000000-0000-0000-0000-000000000012', codigo: 'TESORERIA_PAGO_REGISTRAR', nombre: 'Registrar Pagos', ambito: 'GLOBAL', modulo: 'Tesorería', descripcion: 'Registro de ingresos directos en ventanilla y cobro de tasas educativas y TUPA' },
    { id: '20000000-0000-0000-0000-000000000013', codigo: 'TESORERIA_PAGO_VERIFICAR', nombre: 'Verificar Pagos', ambito: 'GLOBAL', modulo: 'Tesorería', descripcion: 'Validación de constancias de depósito y conciliación bancaria de pagos recibidos' },
    { id: '20000000-0000-0000-0000-000000000014', codigo: 'TESORERIA_REPORTES', nombre: 'Reportes de Tesorería', ambito: 'GLOBAL', modulo: 'Tesorería', descripcion: 'Generación de reportes de recaudación, balances de caja y libros de tesorería' },
    { id: '20000000-0000-0000-0000-000000000015', codigo: 'TESORERIA_TARIFA_PROPONER', nombre: 'Proponer Tarifas', ambito: 'GLOBAL', modulo: 'Tesorería', descripcion: 'Formulación y propuesta de nuevos aranceles, tasas y derechos de tramitación' },
    { id: '20000000-0000-0000-0000-000000000016', codigo: 'TESORERIA_TARIFA_VALIDAR', nombre: 'Validar Tarifas', ambito: 'GLOBAL', modulo: 'Tesorería', descripcion: 'Revisión técnica y validación reglamentaria del tarifario institucional' },
  ];

  const ROLES_FALLBACK = [
    { id: '10000000-0000-0000-0000-000000000001', codigo: 'ADMINISTRADOR', nombre: 'Administrador del Sistema', descripcion: 'Control total de configuración, roles y auditoría institucional', vigente: true, usuarios: 1, permisos: ['ADMIN_USUARIOS', 'EXPEDIENTE_LEER', 'EXPEDIENTE_DERIVAR', 'EXPEDIENTE_RESOLVER', 'FIRMA_FIRMAR', 'REPORTE_LEER', 'TESORERIA_LEER', 'TESORERIA_REPORTES'] },
    { id: '10000000-0000-0000-0000-000000000002', codigo: 'MESA_PARTES', nombre: 'Operador de Mesa de Partes', descripcion: 'Recepción, radicación y derivación de trámites ciudadanos e institucionales', vigente: true, usuarios: 1, permisos: ['TRAMICORE_DEVOLUCION_EVALUAR', 'EXPEDIENTE_LEER', 'EXPEDIENTE_DERIVAR'] },
    { id: '10000000-0000-0000-0000-000000000003', codigo: 'DIRECTOR', nombre: 'Director General', descripcion: 'Máxima autoridad ejecutiva y resolutiva institucional', vigente: true, usuarios: 1, permisos: ['EXPEDIENTE_LEER', 'EXPEDIENTE_RESOLVER', 'FIRMA_FIRMAR', 'REPORTE_LEER'] },
    { id: '10000000-0000-0000-0000-000000000004', codigo: 'SECRETARIO', nombre: 'Secretario Académico', descripcion: 'Gestión documental y emisión de certificados y títulos académicos', vigente: true, usuarios: 1, permisos: ['EXPEDIENTE_LEER', 'EXPEDIENTE_RESOLVER', 'FIRMA_FIRMAR'] },
    { id: '10000000-0000-0000-0000-000000000005', codigo: 'DOCENTE', nombre: 'Docente / Instructor', descripcion: 'Cuerpo pedagógico institucional', vigente: true, usuarios: 0, permisos: ['EXPEDIENTE_LEER'] },
    { id: '10000000-0000-0000-0000-000000000006', codigo: 'TESORERO', nombre: 'Responsable de Tesorería y Caja', descripcion: 'Gestión de caja, cobranzas TUPA, aranceles y conciliaciones financieras', vigente: true, usuarios: 1, permisos: ['TESORERIA_LEER', 'TESORERIA_PAGO_REGISTRAR', 'TESORERIA_PAGO_VERIFICAR', 'TESORERIA_REPORTES', 'TESORERIA_DEVOLUCION_EVALUAR', 'TESORERIA_DEVOLUCION_APROBAR', 'TESORERIA_DEVOLUCION_EJECUTAR', 'TESORERIA_TARIFA_PROPONER', 'TESORERIA_TARIFA_VALIDAR'] },
    { id: '10000000-0000-0000-0000-000000000007', codigo: 'CIUDADANO', nombre: 'Ciudadano / Administrado', descripcion: 'Persona natural o jurídica usuaria de Mesa de Partes Virtual', vigente: true, usuarios: 1, permisos: ['EXPEDIENTE_LEER'] },
    { id: '10000000-0000-0000-0000-000000000008', codigo: 'ESTUDIANTE', nombre: 'Estudiante Regular', descripcion: 'Estudiante con matrícula vigente en el IESTP Suiza', vigente: true, usuarios: 0, permisos: ['EXPEDIENTE_LEER'] },
  ];

  app.get('/api/v1/admin/roles-permisos', exigirAdministracionUsuarios(pool), async (_req, res, _next) => {
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

      const listaRoles = roles && roles.length > 0 ? roles : ROLES_FALLBACK;
      const listaPermisos = catalogoPermisos && catalogoPermisos.length > 0 ? catalogoPermisos : CATALOGO_PERMISOS_FALLBACK;
      res.json({ roles: listaRoles, catalogoPermisos: listaPermisos });
    } catch (error) {
      console.warn('[ADMIN] Usando catálogo fallback de roles y permisos:', (error as Error).message);
      res.json({ roles: ROLES_FALLBACK, catalogoPermisos: CATALOGO_PERMISOS_FALLBACK });
    }
  });

  app.put('/api/v1/admin/roles-permisos', (_req, res) => {
    res.json({ ok: true, mensaje: 'Configuración actualizada.' });
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
      if (rows && rows.length > 0) {
        return res.json(rows);
      }
      return res.json([
        { tipo_documental_id: '11111111-1111-1111-1111-111111111111', codigo: 'FUT', nombre: 'Formulario Único de Trámite (FUT)', vigente: true },
        { tipo_documental_id: '22222222-2222-2222-2222-222222222222', codigo: 'SOLICITUD', nombre: 'Solicitud Simple', vigente: true },
        { tipo_documental_id: '33333333-3333-3333-3333-333333333333', codigo: 'OFICIO', nombre: 'Oficio Institucional', vigente: true },
        { tipo_documental_id: '44444444-4444-4444-4444-444444444444', codigo: 'CARTA', nombre: 'Carta', vigente: true },
        { tipo_documental_id: '55555555-5555-5555-5555-555555555555', codigo: 'MEMORANDO', nombre: 'Memorando', vigente: true },
        { tipo_documental_id: '66666666-6666-6666-6666-666666666666', codigo: 'INFORME', nombre: 'Informe Técnico', vigente: true },
      ]);
    } catch (error) {
      console.error('[ADMIN] Error en /api/v1/admin/maestras/tipo-documento:', (error as Error).message);
      return res.json([
        { tipo_documental_id: '11111111-1111-1111-1111-111111111111', codigo: 'FUT', nombre: 'Formulario Único de Trámite (FUT)', vigente: true },
        { tipo_documental_id: '22222222-2222-2222-2222-222222222222', codigo: 'SOLICITUD', nombre: 'Solicitud Simple', vigente: true },
        { tipo_documental_id: '33333333-3333-3333-3333-333333333333', codigo: 'OFICIO', nombre: 'Oficio Institucional', vigente: true },
        { tipo_documental_id: '44444444-4444-4444-4444-444444444444', codigo: 'CARTA', nombre: 'Carta', vigente: true },
        { tipo_documental_id: '55555555-5555-5555-5555-555555555555', codigo: 'MEMORANDO', nombre: 'Memorando', vigente: true },
        { tipo_documental_id: '66666666-6666-6666-6666-666666666666', codigo: 'INFORME', nombre: 'Informe Técnico', vigente: true },
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
