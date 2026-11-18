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
 * NOTA DE ALCANCE: el endpoint #49 es una escritura con efecto legal sobre el
 * cómputo de plazos del Art. 143 LPAG y, por tanto, requeriría control de acceso
 * por permiso. Ese middleware (`src/middleware/autorizacion.ts` y su repositorio)
 * no forma parte de los cuatro entregables autorizados de T-BE-OC-13/14/15/16 y
 * se deja pendiente de autorización del docente. Hasta entonces los tres
 * endpoints quedan exposed sin autenticación, igual que el resto de catálogos de
 * solo lectura del proyecto.
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

export function crearRouterAdminMaestras(pool: Pool): Router {
  const router = Router();
  const deps: DependenciasController = {
    calendario: new CalendarioService(pool),
    tablasMaestras: new TablasMaestrasService(pool),
  };

  router.get('/tablas-maestras', listarTablasMaestras(deps));
  router.get('/calendario-laboral', listarCalendario(deps));
  router.post('/calendario-laboral/feriado-excepcional', registrarFeriadoExcepcional(deps));

  return router;
}

export default crearRouterAdminMaestras;
