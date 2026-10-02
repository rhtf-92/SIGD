/**
 * SIGD · IESTP "Suiza" (Pucallpa) — Núcleo 00 CoreLink
 * Motor Analítico MGD-PCM/SEGDI · Enrutador de la analítica ejecutiva.
 *
 * Tarea: T-BE-CL-12.
 *
 * Montar en `/api/v1`. Sin `IdentiCore` el proveedor de identidad predeterminado
 * deniega el acceso (falla cerrado), de modo que los endpoints de analítica no son
 * accesibles hasta que exista un proveedor verificado de sesiones o tokens.
 *
 * Sobre los alias: el plan maestro describe estos tres endpoints en dos secciones
 * incompatibles (§4.7 y §20). Se registran ambas familias porque el §7 del propio
 * plan exige rutas canónicas con alias de interoperabilidad, y porque el frontend
 * real consume una de cada familia. Ninguna ruta adicional que apunte al mismo
 * controlador cambia el dato devuelto.
 */

import { Router } from 'express';
import type { Pool } from 'pg';
import { actorProviderNoConfigurado, type ActorProviderRutaDoc } from '../rutadoc/rutadoc.actor-provider.js';
import type { CacheDistribuida } from '../identicore/ubigeo.service.js';
import { RepositorioMgdAnalytics } from './mgdAnalytics.repository.js';
import { ServicioMgdAnalytics } from './mgdAnalytics.service.js';
import { crearControladorReportes } from './reportes.controller.js';

export function crearRouterReportes(
  pool: Pool,
  actorProvider: ActorProviderRutaDoc = actorProviderNoConfigurado,
  cache?: CacheDistribuida,
): Router {
  const router = Router();
  const repositorio = new RepositorioMgdAnalytics(pool);
  const servicio = new ServicioMgdAnalytics(repositorio, { cache });
  const controlador = crearControladorReportes(actorProvider, servicio, repositorio);

  // Canónicas de §4.7.
  router.get('/reportes/dashboard/resumen', controlador.resumen);
  router.get('/reportes/dashboard/cuellos-botella', controlador.cuellosBotella);
  router.get('/reportes/dashboard/tendencias', controlador.tendencias);

  // Alias de §20 y del §4.7. Mismo controlador, misma respuesta.
  router.get('/reportes/dashboard/kpis', controlador.resumen);
  router.get('/reportes/dashboard-ejecutivo', controlador.resumen);
  router.get('/reportes/tiempos-atencion', controlador.tiemposAtencion);
  router.get('/reportes/vistas-materializadas/refresh', controlador.refrescar);

  return router;
}
