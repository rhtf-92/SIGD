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
 * Los endpoints declaran permisos RBAC; el montaje de `/api/v1/admin` exige
 * además autenticación JWT y acceso administrativo.
 */

import { Router } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import { autorizarPermisos, PERMISOS_RBAC } from '../../core/auth/auth.guard.js';
import { crearAdminConfiguracionService } from './adminConfiguracion.service.js';
import { CalendarioService } from './calendario.service.js';
import { TablasMaestrasService } from './tablasMaestras.service.js';
import {
  actualizarItemTablaMaestra,
  cambiarVigenciaCalendario,
  cambiarVigenciaTablaMaestra,
  crearItemTablaMaestra,
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
  const configuracion = crearAdminConfiguracionService(pool);
  const jornadaSchema = z.object({
    horaInicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    horaFin: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    horaCorte: z.literal('16:30'),
    zonaHoraria: z.string().min(3).max(64),
    diasLaborales: z.array(z.number().int().min(1).max(7)).min(1).max(7),
  }).strict().superRefine((input, ctx) => {
    if (input.horaInicio >= input.horaFin) ctx.addIssue({ code: 'custom', path: ['horaFin'], message: 'La hora de fin debe ser posterior al inicio.' });
    if (new Set(input.diasLaborales).size !== input.diasLaborales.length) ctx.addIssue({ code: 'custom', path: ['diasLaborales'], message: 'No se permiten días duplicados.' });
    try { new Intl.DateTimeFormat('es-PE', { timeZone: input.zonaHoraria }); }
    catch { ctx.addIssue({ code: 'custom', path: ['zonaHoraria'], message: 'La zona horaria no es válida.' }); }
  });

  router.get(
    '/tablas-maestras',
    autorizarPermisos(PERMISOS_RBAC.MAESTRAS_LEER),
    listarTablasMaestras(deps),
  );
  router.post(
    '/tablas-maestras/:catalogo',
    autorizarPermisos(PERMISOS_RBAC.MAESTRAS_GESTIONAR),
    crearItemTablaMaestra(deps),
  );
  router.put(
    '/tablas-maestras/:catalogo/:id',
    autorizarPermisos(PERMISOS_RBAC.MAESTRAS_GESTIONAR),
    actualizarItemTablaMaestra(deps),
  );
  router.patch(
    '/tablas-maestras/:catalogo/:id/vigencia',
    autorizarPermisos(PERMISOS_RBAC.MAESTRAS_GESTIONAR),
    cambiarVigenciaTablaMaestra(deps),
  );
  router.get(
    '/calendario-laboral',
    autorizarPermisos(PERMISOS_RBAC.CALENDARIO_LEER),
    listarCalendario(deps),
  );
  router.get('/calendario-laboral/configuracion', autorizarPermisos(PERMISOS_RBAC.CALENDARIO_LEER), async (_req, res) => {
    res.json({ jornada: await configuracion.obtenerJornada() });
  });
  router.put('/calendario-laboral/configuracion', autorizarPermisos(PERMISOS_RBAC.CALENDARIO_GESTIONAR), async (req, res) => {
    const entrada = jornadaSchema.parse(req.body);
    const usuarioId = req.cuentaActual?.idUsuario;
    if (!usuarioId) throw new Error('La identidad autenticada es requerida.');
    res.json(await configuracion.guardarJornada(entrada, usuarioId));
  });
  router.post(
    '/calendario-laboral/feriado-excepcional',
    autorizarPermisos(PERMISOS_RBAC.CALENDARIO_GESTIONAR),
    registrarFeriadoExcepcional(deps),
  );
  router.patch(
    '/calendario-laboral/:id/vigencia',
    autorizarPermisos(PERMISOS_RBAC.CALENDARIO_GESTIONAR),
    cambiarVigenciaCalendario(deps),
  );

  return router;
}

export default crearRouterAdminMaestras;
