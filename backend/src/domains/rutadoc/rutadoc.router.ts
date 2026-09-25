import { Router } from 'express';
import type { Pool } from 'pg';
import { crearControladorRutaDoc, type ObtenerActorRutaDoc } from './rutadoc.controller.js';
import { RepositorioPostgresRutaDoc } from './rutadoc.repository.js';
import { ServicioRutaDoc } from './rutadoc.service.js';

/** Montar en /api/v1. Sin IdentiCore, la resolución predeterminada deniega acceso. */
export function crearRouterRutaDoc(pool: Pool, obtenerActor: ObtenerActorRutaDoc = () => null): Router {
  const router = Router();
  const servicio = new ServicioRutaDoc(new RepositorioPostgresRutaDoc(pool));
  const controlador = crearControladorRutaDoc(servicio, obtenerActor);
  router.get('/expedientes', controlador.listar);
  router.get('/expedientes/:id', controlador.obtener);
  return router;
}
