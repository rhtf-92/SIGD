/**
 * Rutas de administración de OrganiCore bajo `/api/v1/admin`.
 *
 * Mapea los endpoints canónicos del plan maestro (§7.4.3, asignados a B_HECTOR):
 *   #47  GET  /api/v1/admin/tablas-maestras
 *   #48  GET  /api/v1/admin/calendario-laboral
 *   #49  POST /api/v1/admin/calendario-laboral/feriado-excepcional
 *
 * El router es una factoría que recibe el `Pool` (misma convención que
 * `src/referencia/expediente.router.ts` y `src/domains/rutadoc/rutadoc.router.ts`)
 * y compone las instancias de servicio compartidas entre rutas para que la caché
 * en memoria sea única por proceso. La validación Zod se monta en los
 * controladores; la lógica de negocio vive en los servicios; los errores se
 * propagan con `throw` para que los atienda `src/middleware/error-middleware.ts`
 * con el formato RFC 9457.
 *
 * NOTA DE ALCANCE: las rutas requieren rol. La lectura permite ADMINISTRADOR
 * o DIRECTOR; la escritura permite solo ADMINISTRADOR.
 */

import { Router } from 'express';
import type { Pool } from 'pg';
import { exigirRoles } from '../../core/auth/exigirRol.js';
import { CalendarioService } from './calendario.service.js';
import { TablasMaestrasService } from './tablasMaestras.service.js';
import {
  listarCalendario,
  listarTablasMaestras,
  registrarFeriadoExcepcional,
  type DependenciasController,
} from './adminMaestras.controller.js';

export function crearRouterAdminMaestras(pool: Pool): Router {
  const router = Router();
  const deps: DependenciasController = {
    calendario: new CalendarioService(pool),
    tablasMaestras: new TablasMaestrasService(pool),
  };

  router.get('/tablas-maestras', exigirRoles('ADMINISTRADOR', 'DIRECTOR'), listarTablasMaestras(deps));
  router.get('/calendario-laboral', exigirRoles('ADMINISTRADOR', 'DIRECTOR'), listarCalendario(deps));
  router.post(
    '/calendario-laboral/feriado-excepcional',
    exigirRoles('ADMINISTRADOR'),
    registrarFeriadoExcepcional(deps),
  );

  return router;
}

export default crearRouterAdminMaestras;
