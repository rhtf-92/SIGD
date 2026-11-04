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

import { corsMiddleware } from './middleware/cors.middleware.js';
import { crearAuditoriaAccesoMiddleware } from './middleware/auditoria-acceso.middleware.js';
import { verificarTokenAcceso } from './core/auth/jwt.service.js';
import { ETIQUETAS_ROL, ROLES_CANONICOS, normalizarRol } from './shared/domain/roles.js';

// Módulo de Auditoría Forense (Logs de Auditoría WORM)
import { AuditoriaService } from './audit/auditoria.service.js';
import type { FiltrosAuditoria } from './audit/auditoria.service.js';

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
  app.use(crearAuditoriaAccesoMiddleware(pool));

  // Servicio de Auditoría Forense (Logs de Auditoría WORM)
  const auditoriaService = new AuditoriaService(pool);

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

  app.get('/api/v1/admin/roles-permisos', async (_req, res, next) => {
    try {
      const { rows: roles } = await pool.query(
        `SELECT r.rol_id, r.codigo, r.nombre, r.descripcion,
                COALESCE(json_agg(p.codigo) FILTER (WHERE p.codigo IS NOT NULL), '[]') as permisos
         FROM sigd_org.rol_sistema r
         LEFT JOIN sigd_org.rol_permiso rp ON rp.rol_id = r.rol_id
         LEFT JOIN sigd_org.permiso_sistema p ON p.permiso_id = rp.permiso_id
         GROUP BY r.rol_id, r.codigo, r.nombre, r.descripcion`,
      );
      res.json({ roles });
    } catch {
      res.json({
        roles: ROLES_CANONICOS.map((codigo) => ({
          codigo,
          nombre: ETIQUETAS_ROL[codigo],
        })),
      });
    }
  });

  /*
   * Escritura de la matriz RBAC - OrganiCore (#45)
   * Reemplaza los permisos de cada rol enviado en sigd_org.rol_permiso.
   * Cuerpo esperado: { roles: [{ codigo: string, permisos: string[] }] }
   * Los códigos de rol se normalizan al vocabulario canónico de la BD
   * (SUPER_ADMIN -> ADMINISTRADOR, DOCENTE -> SECRETARIO, ESTUDIANTE -> CIUDADANO, etc.).
   * Los permisos que no existan en sigd_org.permiso_sistema se ignoran.
   */
  app.put('/api/v1/admin/roles-permisos', async (req, res, next) => {
    try {
      const { roles } = req.body ?? {};
      if (!Array.isArray(roles)) {
        res.status(400).json({
          type: 'https://sigd.iestpsuiza.edu.pe/errors/validation',
          title: 'Solicitud inválida',
          status: 400,
          detail: 'El cuerpo debe contener un arreglo "roles" con elementos { codigo, permisos: string[] }.',
          instance: '/api/v1/admin/roles-permisos',
        });
        return;
      }

      const resultados = [];

      for (const rol of roles) {
        const { codigo, permisos } = rol ?? {};
        if (typeof codigo !== 'string' || !Array.isArray(permisos)) {
          continue;
        }

        const rolNormalizado = normalizarRol(codigo);
        if (!rolNormalizado) {
          resultados.push({ codigo, normalizado: null, aplicados: [], ignorados: [] });
          continue;
        }

        const { rows: filasRol } = await pool.query(
          `SELECT rol_id FROM sigd_org.rol_sistema WHERE codigo = $1 AND vigente = TRUE`,
          [rolNormalizado],
        );
        if (filasRol.length === 0) {
          resultados.push({
            codigo,
            normalizado: rolNormalizado,
            aplicados: [],
            ignorados: [],
          });
          continue;
        }
        const rolId = filasRol[0].rol_id;

        const permisoIds: string[] = [];
        const ignorados: string[] = [];
        for (const p of permisos) {
          if (typeof p !== 'string') continue;
          const { rows: filasPermiso } = await pool.query(
            `SELECT permiso_id FROM sigd_org.permiso_sistema WHERE codigo = $1`,
            [p],
          );
          if (filasPermiso.length > 0) {
            permisoIds.push(filasPermiso[0].permiso_id);
          } else {
            ignorados.push(p);
          }
        }

        await pool.query(`DELETE FROM sigd_org.rol_permiso WHERE rol_id = $1`, [rolId]);
        if (permisoIds.length > 0) {
          const values = permisoIds.map((_, i) => `($1, $${i + 2})`).join(', ');
          await pool.query(
            `INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id) VALUES ${values}`,
            [rolId, ...permisoIds],
          );
        }

        resultados.push({
          codigo,
          normalizado: rolNormalizado,
          aplicados: permisos.filter((p) => !ignorados.includes(p)),
          ignorados,
        });
      }

      res.json({ ok: true, resultados });
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
        `SELECT tipo_documental_id AS id, codigo, nombre, vigente
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

  /* =========================================================================
   * Módulo Logs de Auditoría — Trazabilidad inmutable (WORM), acciones,
   * accesos y correlación X-Correlation-ID.
   * ========================================================================= */

  // GET /api/v1/auditoria/logs — listado paginado con filtros
  app.get('/api/v1/auditoria/logs', async (req, res, next) => {
    try {
      const filtros: FiltrosAuditoria = {
        busqueda: typeof req.query.busqueda === 'string' ? req.query.busqueda : undefined,
        modulo: typeof req.query.modulo === 'string' ? req.query.modulo : undefined,
        accion: typeof req.query.accion === 'string' ? req.query.accion : undefined,
        resultado:
          req.query.resultado === 'Exitoso' || req.query.resultado === 'Denegado' || req.query.resultado === 'Error'
            ? (req.query.resultado as 'Exitoso' | 'Denegado' | 'Error')
            : undefined,
        usuario_id: typeof req.query.usuario_id === 'string' ? req.query.usuario_id : undefined,
        correlation_id:
          typeof req.query.correlation_id === 'string' ? req.query.correlation_id : undefined,
        fecha_desde: typeof req.query.fecha_desde === 'string' ? req.query.fecha_desde : undefined,
        fecha_hasta: typeof req.query.fecha_hasta === 'string' ? req.query.fecha_hasta : undefined,
        pagina: req.query.pagina ? Number(req.query.pagina) : 1,
        por_pagina: req.query.por_pagina ? Number(req.query.por_pagina) : 50,
      };

      const { filas, total } = await auditoriaService.listar(filtros);

      // Mapear filas de BD al contrato del visor forense del frontend.
      const registros = filas.map((fila) => {
        const datosDespues = fila.datos_despues as Record<string, unknown> | null;
        const datosAntes = fila.datos_antes as Record<string, unknown> | null;

        return {
          id: fila.id_auditoria,
          fecha: fila.fecha_hora
            ? new Date(fila.fecha_hora).toLocaleString('es-PE', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })
            : '',
          usuario: fila.usuario_id
            ? `Usuario ${fila.usuario_id}`
            : 'Sistema',
          rol: 'Sistema',
          area: 'Sistema',
          accion: (datosDespues?.accion as string) ?? fila.operacion,
          modulo: (datosDespues?.modulo as string) ?? fila.tabla,
          registro: (datosDespues?.registro as string) ?? `${fila.esquema}.${fila.tabla}`,
          resultado: ((datosDespues?.resultado as string) ??
            (fila.operacion === 'INSERT' ? 'Exitoso' : 'Exitoso')) as
            | 'Exitoso' | 'Denegado' | 'Error',
          ip: fila.ip_origen ?? '',
          correlationId: fila.correlation_id ?? undefined,
          hash: fila.hash_registro ?? undefined,
          hashAnterior: fila.hash_anterior ?? undefined,
          detallesTecnicos: {
            tipo: datosDespues?.tipo,
            estado_anterior: datosDespues?.estado_anterior ?? datosAntes,
            estado_nuevo: datosDespues?.estado_nuevo,
            detalles_tecnicos: datosDespues?.detalles_tecnicos,
            esquema: fila.esquema,
            tabla: fila.tabla,
            operacion: fila.operacion,
            user_agent: fila.user_agent ?? undefined,
            hash_registro: fila.hash_registro ?? undefined,
            hash_anterior: fila.hash_anterior ?? undefined,
          },
        };
      });

      res.json({
        total,
        pagina: filtros.pagina,
        por_pagina: filtros.por_pagina,
        registros,
      });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/v1/auditoria/logs/:id — detalle forense de un registro
  app.get('/api/v1/auditoria/logs/:id', async (req, res, next) => {
    try {
      const { id } = req.params;
      const fila = await auditoriaService.obtenerPorId(id);

      if (!fila) {
        res.status(404).json({
          type: 'https://sigd.iestpsuiza.edu.pe/errors/not-found',
          title: 'Registro de auditoría no encontrado',
          status: 404,
          detail: `No existe un registro de auditoría con el id ${id}.`,
          instance: `/api/v1/auditoria/logs/${id}`,
        });
        return;
      }

      const datosDespues = fila.datos_despues as Record<string, unknown> | null;
      const datosAntes = fila.datos_antes as Record<string, unknown> | null;

      res.json({
        id: fila.id_auditoria,
        fecha: fila.fecha_hora
          ? new Date(fila.fecha_hora).toISOString()
          : '',
        usuario: fila.usuario_id ? `Usuario ${fila.usuario_id}` : 'Sistema',
        rol: 'Sistema',
        area: 'Sistema',
        accion: (datosDespues?.accion as string) ?? fila.operacion,
        modulo: (datosDespues?.modulo as string) ?? fila.tabla,
        registro: (datosDespues?.registro as string) ?? `${fila.esquema}.${fila.tabla}`,
        resultado: ((datosDespues?.resultado as string) ?? 'Exitoso') as
          | 'Exitoso' | 'Denegado' | 'Error',
        ip: fila.ip_origen ?? '',
        correlationId: fila.correlation_id ?? undefined,
        hash: fila.hash_registro ?? undefined,
        hashAnterior: fila.hash_anterior ?? undefined,
        detallesTecnicos: {
          tipo: datosDespues?.tipo,
          estado_anterior: datosDespues?.estado_anterior ?? datosAntes,
          estado_nuevo: datosDespues?.estado_nuevo,
          detalles_tecnicos: datosDespues?.detalles_tecnicos,
          esquema: fila.esquema,
          tabla: fila.tabla,
          operacion: fila.operacion,
          user_agent: fila.user_agent ?? undefined,
          hash_registro: fila.hash_registro ?? undefined,
          hash_anterior: fila.hash_anterior ?? undefined,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/v1/auditoria/resumen — estadísticas para tarjetas resumen
  app.get('/api/v1/auditoria/resumen', async (req, res, next) => {
    try {
      const filtros: Pick<FiltrosAuditoria, 'fecha_desde' | 'fecha_hasta' | 'usuario_id'> = {};
      if (typeof req.query.fecha_desde === 'string') filtros.fecha_desde = req.query.fecha_desde;
      if (typeof req.query.fecha_hasta === 'string') filtros.fecha_hasta = req.query.fecha_hasta;
      if (typeof req.query.usuario_id === 'string') filtros.usuario_id = req.query.usuario_id;

      const resumen = await auditoriaService.resumen(filtros);
      res.json(resumen);
    } catch (error) {
      next(error);
    }
  });

  // GET /api/v1/auditoria/validar-worm — integridad criptográfica de la cadena
  app.get('/api/v1/auditoria/validar-worm', async (req, res, next) => {
    try {
      const validacion = await auditoriaService.validarIntegridadWorm();
      res.json(validacion);
    } catch (error) {
      next(error);
    }
  });

  // POST /api/v1/auditoria/acceso — registrar un acceso (login, lectura, denegado)
  app.post('/api/v1/auditoria/acceso', async (req, res, next) => {
    try {
      const {
        accion,
        modulo,
        registro,
        resultado,
        detalles_tecnicos,
        ip_origen,
        user_agent,
      } = req.body ?? {};

      if (!accion || !modulo || !registro || !resultado) {
        res.status(400).json({
          type: 'https://sigd.iestpsuiza.edu.pe/errors/validation',
          title: 'Solicitud inválida',
          status: 400,
          detail: 'Se requieren los campos: accion, modulo, registro, resultado.',
          instance: '/api/v1/auditoria/acceso',
        });
        return;
      }

      const id = await auditoriaService.registrarAcceso({
        accion,
        modulo,
        registro,
        resultado: resultado as 'Exitoso' | 'Denegado' | 'Error',
        detalles_tecnicos: detalles_tecnicos ?? null,
        ip_origen: ip_origen ?? null,
        user_agent: user_agent ?? null,
      });

      res.status(201).json({ id_auditoria: id, correlation_id: auditoriaService.obtenerCorrelationId() });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/v1/auditoria/accion — registrar una acción de negocio
  app.post('/api/v1/auditoria/accion', async (req, res, next) => {
    try {
      const {
        accion,
        modulo,
        registro,
        resultado,
        datos_antes,
        datos_despues,
        ip_origen,
        user_agent,
      } = req.body ?? {};

      if (!accion || !modulo || !registro || !resultado) {
        res.status(400).json({
          type: 'https://sigd.iestpsuiza.edu.pe/errors/validation',
          title: 'Solicitud inválida',
          status: 400,
          detail: 'Se requieren los campos: accion, modulo, registro, resultado.',
          instance: '/api/v1/auditoria/accion',
        });
        return;
      }

      const id = await auditoriaService.registrarAccion({
        accion,
        modulo,
        registro,
        resultado: resultado as 'Exitoso' | 'Denegado' | 'Error',
        datos_antes: datos_antes ?? null,
        datos_despues: datos_despues ?? null,
        ip_origen: ip_origen ?? null,
        user_agent: user_agent ?? null,
      });

      res.status(201).json({ id_auditoria: id, correlation_id: auditoriaService.obtenerCorrelationId() });
    } catch (error) {
      next(error);
    }
  });

  app.use(errorMiddleware);

  return app;
}

export default construirApp;
