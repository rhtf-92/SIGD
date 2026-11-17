import { Router } from 'express';
import { z } from 'zod';
import type { ActorRutaDoc } from './rutadoc.types.js';
import type { Pool } from 'pg';
import { crearControladorRutaDoc, type ObtenerActorRutaDoc } from './rutadoc.controller.js';
import { RepositorioPostgresRutaDoc } from './rutadoc.repository.js';
import { ServicioRutaDoc } from './rutadoc.service.js';
import { RepositorioReversionRutaDoc } from './rutadoc.reversion.repository.js';
import { ServicioReversionRutaDoc } from './rutadoc.reversion.service.js';
import type { FolioCompensationPort, PoliticaReversionRutaDoc, PrepararCompensacionFolios } from './rutadoc.reversion.types.js';
import { actorProviderNoConfigurado, type ActorProviderRutaDoc } from './rutadoc.actor-provider.js';
import { crearControladorLecturasRutaDoc } from './lecturas.controller.js';
import { RepositorioSlaRutaDoc, ServicioSlaRutaDoc } from './sla.service.js';
import { calendarioLaboralPredeterminadoRutaDoc } from './sla.calendario.js';
import { clasificadorCcdPredeterminadoRutaDoc, ServicioCcdRutaDoc } from './ccd.service.js';
import { ServicioTrazabilidadRutaDoc } from './trazabilidad.service.js';
import { ServicioFoliacionRutaDoc } from './foliacion.service.js';
import { crearRepositoriosLecturaRutaDoc } from './lecturas.repository.js';
import { crearRouterDerivaciones } from './derivaciones.controller.js';
import { crearRouterEvaluadores } from './evaluadores.controller.js';
import { DigitalizacionService } from './digitalizacion.service.js';
import { adjuntarDocumentoSchema } from './digitalizacion.schemas.js';
import { setUnidadOrganicaId, setUsuarioId } from '../../shared/request-context/request-context.js';
import { UnauthorizedError, ForbiddenError, ConflictError, ValidationError } from '../../shared/domain/errors/index.js';
import type { CalendarioLaboralPort } from './sla.types.js';
import type { ClasificadorCcdPort } from './ccd.types.js';
import type { DocumentoMetadataPort } from './foliacion.types.js';

/** Política institucional predeterminada de reversión de actuaciones. */
type PermisoItem = { codigo: string; ambito: string; areaId: string | null };

/** Política institucional predeterminada de reversión de actuaciones. */
export function politicaReversionPredeterminada(pool: Pool): PoliticaReversionRutaDoc {
  return async (actor: ActorRutaDoc, expedienteId: string): Promise<boolean> => {
    if (actor.permisos?.some((p: PermisoItem) => p.codigo === 'ADMIN_USUARIOS' && p.ambito === 'GLOBAL' && p.areaId === null)) {
      return true;
    }
    if (actor.permisos) {
      const permisos = actor.permisos.filter((p: PermisoItem) => p.codigo === 'EXPEDIENTE_DERIVAR' || p.codigo === 'EXPEDIENTE_RESOLVER');
      if (permisos.some((p: PermisoItem) => p.ambito === 'GLOBAL' && p.areaId === null)) return true;
      const areas = permisos.filter((p: PermisoItem) => p.ambito === 'AREA' && p.areaId !== null).map((p: PermisoItem) => p.areaId);
      if (areas.length > 0) {
        const acceso = await pool.query<{ autorizado: boolean }>(
          `SELECT EXISTS (
             SELECT 1 FROM sigd_tra.expediente e
             LEFT JOIN sigd_rut.estado_actual_expediente a USING (expediente_id)
            WHERE e.expediente_id::text = $1 AND NULLIF(a.area_actual_id, '') = ANY($2::text[])
          ) AS autorizado`,
          [expedienteId, areas],
        );
        return acceso.rows[0]?.autorizado === true;
      }
    }
    return false;
  };
}

/** Montar en /api/v1. Sin IdentiCore, la resolución predeterminada deniega acceso. */
export function crearRouterRutaDoc(pool: Pool, obtenerActor?: ObtenerActorRutaDoc,
  politicaReversion?: PoliticaReversionRutaDoc, prepararFolios?: PrepararCompensacionFolios,
  actorProvider: ActorProviderRutaDoc = actorProviderNoConfigurado,
  folioPort?: FolioCompensationPort,
  lecturas: { calendarioLaboral?: CalendarioLaboralPort; clasificadorCcd?: ClasificadorCcdPort;
    documentoMetadata?: DocumentoMetadataPort; porcentajeAmarilloSlaDesde?: number } = {}): Router {
  const router = Router();
  const servicio = new ServicioRutaDoc(new RepositorioPostgresRutaDoc(pool));
  const reversion = new ServicioReversionRutaDoc(
    new RepositorioReversionRutaDoc(pool), politicaReversion ?? politicaReversionPredeterminada(pool), prepararFolios, folioPort);
  const proveedorActor = obtenerActor ? { obtenerActor } : actorProvider;
  const controlador = crearControladorRutaDoc(servicio, reversion,
    proveedorActor);
  const repositoriosLectura = crearRepositoriosLecturaRutaDoc(pool);
  const controladorLecturas = crearControladorLecturasRutaDoc(proveedorActor, {
    trazabilidad: new ServicioTrazabilidadRutaDoc(repositoriosLectura.trazabilidad),
    foliacion: new ServicioFoliacionRutaDoc(repositoriosLectura.foliacion, lecturas.documentoMetadata),
    sla: new ServicioSlaRutaDoc(new RepositorioSlaRutaDoc(pool),
      lecturas.calendarioLaboral ?? calendarioLaboralPredeterminadoRutaDoc,
      undefined, { porcentajeAmarilloDesde: lecturas.porcentajeAmarilloSlaDesde ?? 80 }),
    ccd: new ServicioCcdRutaDoc(lecturas.clasificadorCcd ?? clasificadorCcdPredeterminadoRutaDoc),
  });
  const digitalizacionService = new DigitalizacionService(pool);

  router.get('/expedientes', controlador.listar);
  router.get('/expedientes/clasificador-ccd', controladorLecturas.ccd);
  router.use('/expedientes', crearRouterEvaluadores(pool, proveedorActor));
  router.get('/expedientes/:id/trazabilidad', controladorLecturas.trazabilidad);
  router.get('/expedientes/:id/foliacion', controladorLecturas.foliacion);
  router.get('/expedientes/:id/sla-status', controladorLecturas.sla);
  router.get('/expedientes/:id', controlador.obtener);
  router.post('/expedientes/:id/revertir-actuacion', controlador.revertir);
  router.post('/expedientes/:id/documentos', async (req, res, next) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!z.string().uuid().safeParse(id).success) {
        throw new ValidationError({
          invalidParams: [{ name: 'id', reason: 'Identificador de expediente inválido.' }],
        });
      }
      const actor = await proveedorActor.obtenerActor(req);
      if (!actor) throw new UnauthorizedError();
      if (actor.permisos !== undefined) {
        const permisosAdjuntar = actor.permisos.filter(p => p.codigo === 'EXPEDIENTE_ADJUNTAR');
        let autorizado = permisosAdjuntar.some(p => p.ambito === 'GLOBAL' && p.areaId === null);
        if (!autorizado && permisosAdjuntar.some(p => p.ambito === 'AREA' && p.areaId !== null)) {
          const areas = permisosAdjuntar.filter(p => p.ambito === 'AREA' && p.areaId !== null).map(p => p.areaId);
          const acceso = await pool.query<{ autorizado: boolean }>(`SELECT EXISTS (
            SELECT 1 FROM sigd_tra.expediente e
            LEFT JOIN sigd_rut.estado_actual_expediente a USING (expediente_id)
            LEFT JOIN (
              SELECT DISTINCT ON (expediente_id)
                     expediente_id, canal_ingreso, anulado
                FROM sigd_tra.asiento_registro
               WHERE anulado = FALSE
               ORDER BY expediente_id, numero_registro ASC
            ) ar ON ar.expediente_id = e.expediente_id
            WHERE e.expediente_id::text=$1
              AND (
                CASE
                  WHEN a.expediente_id IS NOT NULL AND NULLIF(a.area_actual_id, '') IS NOT NULL
                       THEN NULLIF(a.area_actual_id, '')
                  WHEN a.expediente_id IS NOT NULL AND a.estado_nuevo = 'RESUELTO'
                       THEN COALESCE(
                         (SELECT m.datos->>'areaId' FROM sigd_rut.movimiento_tramite m
                           WHERE m.expediente_id = e.expediente_id AND m.datos->>'areaId' IS NOT NULL
                           ORDER BY m.secuencia DESC LIMIT 1),
                         e.area_destino_id::text
                       )
                  WHEN ar.canal_ingreso IN ('MESA_PRESENCIAL', 'MESA_VIRTUAL') AND (ar.anulado IS FALSE OR ar.anulado IS NULL)
                       THEN (SELECT area_id::text FROM sigd_org.area WHERE codigo = 'MP')
                  ELSE NULL
                END
              ) = ANY($2::text[])) AS autorizado`, [id, areas]);
          autorizado = acceso.rows[0]?.autorizado === true;
        }
        if (!autorizado) {
          throw new ForbiddenError({ detail: 'No cuenta con facultades para digitalizar o foliar este expediente.' });
        }
      }
      const datos = adjuntarDocumentoSchema.parse(req.body);
      const resultado = await digitalizacionService.adjuntarDocumento(id, datos, actor.id, actor);
      res.status(201).json(resultado);
    } catch (error) {
      next(error);
    }
  });
  const derivaciones = Router();
  derivaciones.use(async (req, _res, next) => {
    const actor = await proveedorActor.obtenerActor(req);
    if (!actor) throw new UnauthorizedError();
    if (actor.permisos !== undefined) {
      const isLote = req.path.endsWith('/derivar-lote') || req.path.endsWith('/derivar-masivo') || req.path === '/derivar-lote' || req.path === '/derivar-masivo';
      const isDerivar = req.path.endsWith('/derivar') || isLote;
      const codigos = req.path.endsWith('/recepcionar')
        ? ['EXPEDIENTE_DERIVAR', 'EXPEDIENTE_RESOLVER']
        : isDerivar
        ? ['EXPEDIENTE_DERIVAR']
        : ['EXPEDIENTE_RESOLVER'];
      const permisos = actor.permisos.filter(p => codigos.includes(p.codigo));
      let autorizado = permisos.some(p => p.ambito === 'GLOBAL' && p.areaId === null);
      if (!autorizado && permisos.some(p => p.ambito === 'AREA' && p.areaId !== null)) {
        const areas = permisos.filter(p => p.ambito === 'AREA' && p.areaId !== null).map(p => p.areaId);
        if (isLote) {
          const rawIds = req.body?.expedienteIds;
          const expIds = Array.isArray(rawIds) ? rawIds.filter((id: unknown) => typeof id === 'string' && z.string().uuid().safeParse(id).success) : [];
          if (expIds.length > 0) {
            const acceso = await pool.query<{ total: number }>(`SELECT COUNT(DISTINCT e.expediente_id)::int AS total FROM sigd_tra.expediente e
              LEFT JOIN sigd_rut.estado_actual_expediente a USING (expediente_id)
              LEFT JOIN (
                SELECT DISTINCT ON (expediente_id)
                       expediente_id, canal_ingreso, anulado
                  FROM sigd_tra.asiento_registro
                 WHERE anulado = FALSE
                 ORDER BY expediente_id, numero_registro ASC
              ) ar ON ar.expediente_id = e.expediente_id
              WHERE e.expediente_id = ANY($1::uuid[])
                AND (
                  CASE
                    WHEN a.expediente_id IS NOT NULL AND NULLIF(a.area_actual_id, '') IS NOT NULL
                         THEN NULLIF(a.area_actual_id, '')
                    WHEN a.expediente_id IS NOT NULL AND a.estado_nuevo = 'RESUELTO'
                         THEN COALESCE(
                           (SELECT m.datos->>'areaId' FROM sigd_rut.movimiento_tramite m
                             WHERE m.expediente_id = e.expediente_id AND m.datos->>'areaId' IS NOT NULL
                             ORDER BY m.secuencia DESC LIMIT 1),
                           e.area_destino_id::text
                         )
                    WHEN ar.canal_ingreso IN ('MESA_PRESENCIAL', 'MESA_VIRTUAL') AND (ar.anulado IS FALSE OR ar.anulado IS NULL)
                         THEN (SELECT area_id::text FROM sigd_org.area WHERE codigo = 'MP')
                    ELSE NULL
                  END
                ) = ANY($2::text[])`, [expIds, areas]);
            autorizado = (acceso.rows[0]?.total ?? 0) === expIds.length;
          } else {
            autorizado = true;
          }
        } else {
          const expId = req.path.split('/')[1];
          if (expId && z.string().uuid().safeParse(expId).success) {
            const acceso = await pool.query<{ autorizado: boolean }>(`SELECT EXISTS (
              SELECT 1 FROM sigd_tra.expediente e
              LEFT JOIN sigd_rut.estado_actual_expediente a USING (expediente_id)
              LEFT JOIN (
                SELECT DISTINCT ON (expediente_id)
                       expediente_id, canal_ingreso, anulado
                  FROM sigd_tra.asiento_registro
                 WHERE anulado = FALSE
                 ORDER BY expediente_id, numero_registro ASC
              ) ar ON ar.expediente_id = e.expediente_id
              WHERE e.expediente_id::text=$1
                AND (
                  CASE
                    WHEN a.expediente_id IS NOT NULL AND NULLIF(a.area_actual_id, '') IS NOT NULL
                         THEN NULLIF(a.area_actual_id, '')
                    WHEN a.expediente_id IS NOT NULL AND a.estado_nuevo = 'RESUELTO'
                         THEN COALESCE(
                           (SELECT m.datos->>'areaId' FROM sigd_rut.movimiento_tramite m
                             WHERE m.expediente_id = e.expediente_id AND m.datos->>'areaId' IS NOT NULL
                             ORDER BY m.secuencia DESC LIMIT 1),
                           e.area_destino_id::text
                         )
                    WHEN ar.canal_ingreso IN ('MESA_PRESENCIAL', 'MESA_VIRTUAL') AND (ar.anulado IS FALSE OR ar.anulado IS NULL)
                         THEN (SELECT area_id::text FROM sigd_org.area WHERE codigo = 'MP')
                    ELSE NULL
                  END
                ) = ANY($2::text[])) AS autorizado`, [expId, areas]);
            autorizado = acceso.rows[0]?.autorizado === true;
          }
        }
      }
      if (!autorizado) throw new ForbiddenError();
    }
    if (req.method === 'POST') {
      const isLote = req.path.endsWith('/derivar-lote') || req.path.endsWith('/derivar-masivo') || req.path === '/derivar-lote' || req.path === '/derivar-masivo';
      if (!isLote) {
        const expId = req.path.split('/')[1];
        if (expId && z.string().uuid().safeParse(expId).success) {
          const integridad = await pool.query<{ inconsistente: boolean }>(`SELECT EXISTS (
            SELECT 1 FROM sigd_rut.estado_actual_expediente p
             WHERE p.expediente_id::text = $1 AND p.estado_nuevo <> 'REGISTRADO'
               AND NOT EXISTS (
                 SELECT 1 FROM sigd_rut.movimiento_tramite m
                  WHERE m.expediente_id = p.expediente_id AND m.id_movimiento = p.id_movimiento
                    AND m.secuencia = p.secuencia AND m.estado_nuevo = p.estado_nuevo
                    AND m.evento = p.evento
                    AND m.usuario_operador_id IS NOT DISTINCT FROM p.usuario_operador_id
                    AND m.fecha_hora IS NOT DISTINCT FROM p.fecha_hora
               )) AS inconsistente`, [expId]);
          if (integridad.rows[0]?.inconsistente === true) throw new ConflictError({
            code: 'ESTADO_SIN_TRAZABILIDAD',
            message: 'El estado del expediente no tiene una actuacion documentada coincidente. Requiere reconciliacion institucional.',
          });
        }
      }
    }
    setUsuarioId(actor.id);
    setUnidadOrganicaId(actor.unidadOrganicaId ?? null);
    next();
  });
  derivaciones.use(crearRouterDerivaciones(pool));
  router.use('/expedientes', derivaciones);
  return router;
}
