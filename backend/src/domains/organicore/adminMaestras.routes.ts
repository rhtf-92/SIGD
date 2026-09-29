/**
 * Rutas de administración de OrganiCore bajo `/api/v1/admin`.
 *
 * Mapea los endpoints canónicos del plan maestro (§4.6 y §7.4.3):
 *   #47  GET  /api/v1/admin/tablas-maestras
 *   #48  GET  /api/v1/admin/calendario-laboral
 *   #49  POST /api/v1/admin/calendario-laboral/feriado-excepcional
 *
 * El router es una factoría que recibe el `Pool` (misma convención que
 * `src/referencia/expediente.router.ts`) y compone las instancias de servicio
 * compartidas entre rutas para que la caché en memoria sea única por proceso.
 * La validación Zod se monta en los controladores; la lógica de negocio vive en
 * los servicios.
 *
 * Control de acceso (T-BE-OC-16): el POST #49 es una escritura con efecto legal
 * —altera el cómputo de plazos del Art. 143 LPAG para todos los expedientes—, por
 * lo que exige credencial (401 `UNAUTHORIZED`) y el permiso
 * `CALENDARIO_LABORAL_GESTIONAR` resuelto contra el RBAC de `sigd_org` (403
 * `FORBIDDEN`). Ver `src/middleware/autorizacion.ts`. Los GET #47 y #48 son de
 * sólo lectura y quedan abiertos, igual que el resto de catálogos del proyecto.
 */

import { Router } from 'express';
import type { Pool } from 'pg';
import { CalendarioService } from './calendario.service.js';
import { TablasMaestrasService } from './tablasMaestras.service.js';
import {
  listarCalendario,
  listarTablasMaestras,
  registrarFeriadoExcepcional,
  type DependenciasController,
} from './adminMaestras.controller.js';
import {
  PERMISO_GESTIONAR_CALENDARIO_LABORAL,
  autenticar,
  exigirPermiso,
} from '../../middleware/autorizacion.js';

export function crearRouterAdminMaestras(pool: Pool): Router {
  const router = Router();
  const deps: DependenciasController = {
    calendario: new CalendarioService(pool),
    tablasMaestras: new TablasMaestrasService(pool),
  };

  router.get('/tablas-maestras', listarTablasMaestras(deps));
  router.get('/calendario-laboral', listarCalendario(deps));
  router.post(
    '/calendario-laboral/feriado-excepcional',
    autenticar(),
    exigirPermiso(pool, PERMISO_GESTIONAR_CALENDARIO_LABORAL),
    registrarFeriadoExcepcional(deps),
  );

  return router;
}

export default crearRouterAdminMaestras;
