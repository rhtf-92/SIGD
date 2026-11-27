import { Router } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
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
import { clasificadorCcdPredeterminadoRutaDoc, SERIES_CCD_RUTADOC, ServicioCcdRutaDoc } from './ccd.service.js';
import { ServicioTrazabilidadRutaDoc } from './trazabilidad.service.js';
import { ServicioFoliacionRutaDoc } from './foliacion.service.js';
import { crearRepositoriosLecturaRutaDoc } from './lecturas.repository.js';
import { crearRouterDerivaciones } from './derivaciones.controller.js';
import { setUnidadOrganicaId, setUsuarioId } from '../../shared/request-context/request-context.js';
import { ForbiddenError, UnauthorizedError } from '../../shared/domain/errors/index.js';
import type { CalendarioLaboralPort } from './sla.types.js';
import type { ClasificadorCcdPort } from './ccd.types.js';
import type { DocumentoMetadataPort } from './foliacion.types.js';
import { idSchema } from './rutadoc.schemas.js';
import { obtenerConfiguracionS3 } from '../../config/s3.config.js';
import { generarUrlPresigned } from '../../core/storage/s3-storage.service.js';

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
    new RepositorioReversionRutaDoc(pool), politicaReversion, prepararFolios, folioPort);
  const proveedorActor = obtenerActor ? { obtenerActor } : actorProvider;
  const controlador = crearControladorRutaDoc(servicio, reversion,
    proveedorActor);
  const repositoriosLectura = crearRepositoriosLecturaRutaDoc(pool);
  const metadataDocumento: DocumentoMetadataPort = lecturas.documentoMetadata ?? {
    async obtenerMetadataDocumento(documentoId) {
      const resultado = await pool.query<{
        nombre_archivo: string;
        mime_type: string;
        sha256: string;
        s3_bucket: string;
        s3_key: string;
      }>(`
        SELECT nombre_archivo, mime_type, sha256, s3_bucket, s3_key
          FROM sigd_doc.documento_adjunto
         WHERE documento_adjunto_id = $1::uuid`, [documentoId]).catch(() => null);
      const documento = resultado?.rows[0];
      if (!documento) return { checksumSha256: null, nombre: null, tipo: null, urlOriginal: null };
      const configuracion = obtenerConfiguracionS3();
      return {
        checksumSha256: documento.sha256.trim(),
        nombre: documento.nombre_archivo,
        tipo: documento.mime_type,
        urlOriginal: generarUrlPresigned(documento.s3_key,
          { ...configuracion, bucket: documento.s3_bucket },
          { metodo: 'GET', expiraSegundos: 900 }),
      };
    },
  };
  const servicioSla = new ServicioSlaRutaDoc(new RepositorioSlaRutaDoc(pool),
    lecturas.calendarioLaboral ?? calendarioLaboralPredeterminadoRutaDoc,
    undefined, { porcentajeAmarilloDesde: lecturas.porcentajeAmarilloSlaDesde ?? 80 });
  const controladorLecturas = crearControladorLecturasRutaDoc(proveedorActor, {
    trazabilidad: new ServicioTrazabilidadRutaDoc(repositoriosLectura.trazabilidad),
    foliacion: new ServicioFoliacionRutaDoc(repositoriosLectura.foliacion, metadataDocumento),
    sla: servicioSla,
    ccd: new ServicioCcdRutaDoc(lecturas.clasificadorCcd ?? clasificadorCcdPredeterminadoRutaDoc),
  });
  router.get('/expedientes/indicadores', async (req, res) => {
    const actor = await proveedorActor.obtenerActor(req);
    if (!actor) throw new UnauthorizedError();
    const esAdministrador = actor.roles.includes('SUPER_ADMIN');
    if (!esAdministrador && !actor.unidadOrganicaId) {
      throw new ForbiddenError({ detail: 'El perfil del usuario no tiene un área asignada.' });
    }
    if (!actor.roles.some((rol) => ['DOCENTE', 'DIRECTOR', 'MESA_PARTES', 'SUPER_ADMIN'].includes(rol))) {
      throw new ForbiddenError();
    }
    res.json(await servicioSla.obtenerIndicadores(esAdministrador ? null : actor.unidadOrganicaId));
  });
  router.get('/areas', async (req, res) => {
    const actor = await proveedorActor.obtenerActor(req);
    if (!actor) throw new UnauthorizedError();
    if (!actor.roles.some((rol) => ['DOCENTE', 'DIRECTOR', 'MESA_PARTES', 'SUPER_ADMIN'].includes(rol))) {
      throw new ForbiddenError();
    }
    const resultado = await pool.query<{ id: string; nombre: string }>(`
      SELECT area_id::text AS id, nombre
        FROM sigd_org.area
       WHERE vigente = TRUE
       ORDER BY nombre`);
    res.json({ unidades: resultado.rows });
  });
  router.put('/expedientes/:id/clasificacion-ccd', async (req, res) => {
    const actor = await proveedorActor.obtenerActor(req);
    if (!actor) throw new UnauthorizedError();
    if (!actor.roles.some((rol) => ['DOCENTE', 'DIRECTOR', 'MESA_PARTES', 'SUPER_ADMIN'].includes(rol))) {
      throw new ForbiddenError();
    }
    const expedienteId = idSchema.parse(req.params.id);
    const { codigoSerie } = z.object({
      codigoSerie: z.string().regex(/^[A-Z0-9._-]{1,60}$/),
    }).strict().parse(req.body);
    const serie = SERIES_CCD_RUTADOC.find((opcion) => opcion.codigo === codigoSerie);
    if (!serie) {
      throw new z.ZodError([{
        code: 'custom',
        path: ['codigoSerie'],
        message: 'La serie CCD no pertenece al catálogo vigente.',
      }]);
    }
    if (!actor.puedeVerExpediente || !await actor.puedeVerExpediente(expedienteId)) {
      throw new ForbiddenError();
    }
    const resultado = await pool.query(`
      INSERT INTO sigd_rut.expediente_clasificacion_ccd
        (expediente_id, codigo_fondo, codigo_seccion, codigo_serie, nombre_serie, asignado_por)
      VALUES ($1::uuid, 'IESTP_SUIZA', $2, $3, $4, $5::uuid)
      ON CONFLICT (expediente_id) DO UPDATE SET
        codigo_fondo = EXCLUDED.codigo_fondo,
        codigo_seccion = EXCLUDED.codigo_seccion,
        codigo_serie = EXCLUDED.codigo_serie,
        nombre_serie = EXCLUDED.nombre_serie,
        asignado_por = EXCLUDED.asignado_por,
        actualizado_en = now()
      RETURNING codigo_serie AS "codigoSerie", nombre_serie AS "nombreSerie"`,
    [expedienteId, serie.seccion, serie.codigo, serie.nombre, actor.id]);
    res.json(resultado.rows[0]);
  });
  router.get('/expedientes', controlador.listar);
  router.get('/expedientes/clasificador-ccd', controladorLecturas.ccd);
  router.get('/expedientes/:id/trazabilidad', controladorLecturas.trazabilidad);
  router.get('/expedientes/:id/foliacion', controladorLecturas.foliacion);
  router.get('/expedientes/:id/sla-status', controladorLecturas.sla);
  router.get('/expedientes/:id', controlador.obtener);
  router.post('/expedientes/:id/revertir-actuacion', controlador.revertir);
  const derivaciones = Router();
  derivaciones.use(async (req, _res, next) => {
    const actor = await proveedorActor.obtenerActor(req);
    if (!actor) throw new UnauthorizedError();
    setUsuarioId(actor.id);
    setUnidadOrganicaId(actor.unidadOrganicaId ?? null);
    next();
  });
  derivaciones.use(crearRouterDerivaciones(pool));
  router.use('/expedientes', derivaciones);
  return router;
}
