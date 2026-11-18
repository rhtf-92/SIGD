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

import {
  CalendarizacionInstitucionalService,
  FUENTE_CALENDARIZACION_INSTITUCIONAL_2026,
} from './calendarizacion.service.js';

export function crearRouterAdminMaestras(pool: Pool): Router {
  const router = Router();
  const deps: DependenciasController = {
    calendario: new CalendarioService(pool),
    tablasMaestras: new TablasMaestrasService(pool),
  };

  const calendarizacionService = new CalendarizacionInstitucionalService();

  router.get('/tablas-maestras', listarTablasMaestras(deps));
  router.get('/calendario-laboral', listarCalendario(deps));
  router.post('/calendario-laboral/feriado-excepcional', registrarFeriadoExcepcional(deps));

  router.get('/calendarizacion-institucional', (req, res) => {
    const anio = req.query.anio !== undefined ? Number(req.query.anio) : undefined;
    const desde = typeof req.query.desde === 'string' ? req.query.desde : undefined;
    const hasta = typeof req.query.hasta === 'string' ? req.query.hasta : undefined;
    try {
      const actividades = calendarizacionService.listar({ anio, desde, hasta });
      res.status(200).json({
        fuente: FUENTE_CALENDARIZACION_INSTITUCIONAL_2026,
        total: actividades.length,
        actividades,
      });
    } catch (err: unknown) {
      if (err instanceof RangeError) {
        res.status(400).json({ error: err.message });
      } else {
        res.status(500).json({ error: 'Error al consultar la calendarización institucional' });
      }
    }
  });

  router.get('/calendarizacion-institucional/actividades/:numero', (req, res) => {
    const numero = Number(req.params.numero);
    const actividad = calendarizacionService.obtenerPorNumero(numero);
    if (!actividad) {
      res.status(404).json({ error: `Actividad ${numero} no encontrada.` });
      return;
    }
    res.status(200).json(actividad);
  });

  return router;
}

export default crearRouterAdminMaestras;
