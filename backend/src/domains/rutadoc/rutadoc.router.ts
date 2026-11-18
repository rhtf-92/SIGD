import { Router } from 'express';
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
import { setUnidadOrganicaId, setUsuarioId } from '../../shared/request-context/request-context.js';
import { UnauthorizedError } from '../../shared/domain/errors/index.js';
import type { CalendarioLaboralPort } from './sla.types.js';
import type { ClasificadorCcdPort } from './ccd.types.js';
import type { DocumentoMetadataPort } from './foliacion.types.js';

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
  const controladorLecturas = crearControladorLecturasRutaDoc(proveedorActor, {
    trazabilidad: new ServicioTrazabilidadRutaDoc(repositoriosLectura.trazabilidad),
    foliacion: new ServicioFoliacionRutaDoc(repositoriosLectura.foliacion, lecturas.documentoMetadata),
    sla: new ServicioSlaRutaDoc(new RepositorioSlaRutaDoc(pool),
      lecturas.calendarioLaboral ?? calendarioLaboralPredeterminadoRutaDoc,
      undefined, { porcentajeAmarilloDesde: lecturas.porcentajeAmarilloSlaDesde ?? 80 }),
    ccd: new ServicioCcdRutaDoc(lecturas.clasificadorCcd ?? clasificadorCcdPredeterminadoRutaDoc),
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
