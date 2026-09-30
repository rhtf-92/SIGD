import { Router } from 'express';
import type { Pool } from 'pg';
import { crearControladorRutaDoc, type ObtenerActorRutaDoc } from './rutadoc.controller.js';
import { RepositorioPostgresRutaDoc } from './rutadoc.repository.js';
import { ServicioRutaDoc } from './rutadoc.service.js';
import { RepositorioReversionRutaDoc } from './rutadoc.reversion.repository.js';
import { ServicioReversionRutaDoc } from './rutadoc.reversion.service.js';
import type { FolioCompensationPort, PoliticaReversionRutaDoc, PrepararCompensacionFolios } from './rutadoc.reversion.types.js';
import { actorProviderNoConfigurado, type ActorProviderRutaDoc } from './rutadoc.actor-provider.js';

/** Montar en /api/v1. Sin IdentiCore, la resolución predeterminada deniega acceso. */
export function crearRouterRutaDoc(pool: Pool, obtenerActor?: ObtenerActorRutaDoc,
  politicaReversion?: PoliticaReversionRutaDoc, prepararFolios?: PrepararCompensacionFolios,
  actorProvider: ActorProviderRutaDoc = actorProviderNoConfigurado,
  folioPort?: FolioCompensationPort): Router {
  const router = Router();
  const servicio = new ServicioRutaDoc(new RepositorioPostgresRutaDoc(pool));
  const reversion = new ServicioReversionRutaDoc(
    new RepositorioReversionRutaDoc(pool), politicaReversion, prepararFolios, folioPort);
  const controlador = crearControladorRutaDoc(servicio, reversion,
    obtenerActor ? { obtenerActor } : actorProvider);
  router.get('/expedientes', controlador.listar);
  router.get('/expedientes/:id', controlador.obtener);
  router.post('/expedientes/:id/revertir-actuacion', controlador.revertir);
  return router;
}
