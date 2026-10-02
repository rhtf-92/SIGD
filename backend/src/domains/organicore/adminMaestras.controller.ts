/**
 * Controladores REST de administración de OrganiCore (T-BE-OC-14 y T-BE-OC-15).
 *
 * Responsabilidad EXCLUSIVA: traducir `Request` → argumentos del servicio y
 * resultado del servicio → `Response`. No contiene SQL ni reglas de negocio.
 * Los errores se propagan con `throw` para que los atienda
 * `src/middleware/error-middleware.ts` con el formato RFC 9457, igual que el
 * resto de los routers del proyecto.
 *
 * Endpoints que cubre:
 *   #47  GET  /api/v1/admin/tablas-maestras
 *   #48  GET  /api/v1/admin/calendario-laboral
 *   #49  POST /api/v1/admin/calendario-laboral/feriado-excepcional
 *
 * Se exportan factorías de handlers (no clases) para que el router componga las
 * instancias de servicio una sola vez por proceso, igual que hace
 * `crearRouterRutaDoc` en `src/domains/rutadoc/rutadoc.router.ts`.
 *
 * PENDIENTE DE AUTORIZACIÓN (no se resuelve aquí):
 *   - El montaje de estas rutas requiere editar `src/app.ts`, que está fuera de
 *     los cuatro entregables autorizados. Hasta que el docente lo autorice, los
 *     endpoints no quedan expuestos.
 *   - `#49` altera el cómputo legal de plazos del Art. 143 LPAG y debería
 *     exigir autenticación y el permiso `CALENDARIO_LABORAL_GESTIONAR` del
 *     modelo RBAC de `sigd_org`. El middleware de autorización no forma parte
 *     del alcance, por lo que aquí no se aplica control de acceso alguno.
 */

import { gzipSync } from 'node:zlib';
import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  CalendarioService,
  construirVistaCalendario,
  esquemaConsultaCalendario,
  esquemaFeriadoExcepcional,
} from './calendario.service.js';
import {
  CACHE_CONTROL_TABLAS_MAESTRAS,
  TablasMaestrasService,
  TTL_TABLAS_MAESTRAS_SEGUNDOS,
} from './tablasMaestras.service.js';
import { getRequestContext } from '../../shared/request-context/request-context.js';

/** Umbral a partir del cual se comprime la respuesta. */
const UMBRAL_COMPRESION_BYTES = 1024;

/** Query de `#47 /api/v1/admin/tablas-maestras`. */
export const esquemaConsultaTablasMaestras = z
  .object({
    solo_activos: z
      .enum(['true', 'false'])
      .transform((valor) => valor === 'true')
      .default('true'),
    recargar: z
      .enum(['true', 'false'])
      .transform((valor) => valor === 'true')
      .default('false'),
  })
  .strict();

export type ConsultaTablasMaestras = z.infer<typeof esquemaConsultaTablasMaestras>;

/** Servicios que el router inyecta en los handlers. */
export interface DependenciasController {
  calendario: CalendarioService;
  tablasMaestras: TablasMaestrasService;
}

function anioPorDefecto(): number {
  return new Date().getUTCFullYear();
}

/**
 * `#48 GET /api/v1/admin/calendario-laboral`
 * Calendario oficial con días laborables, feriados y feriados de Ucayali.
 */
export function listarCalendario(deps: DependenciasController) {
  return async function listarCalendarioHandler(req: Request, res: Response): Promise<void> {
    const consulta = esquemaConsultaCalendario.parse(req.query);

    const catalogo = await deps.calendario.listar({
      anio: consulta.anio,
      desde: consulta.desde,
      hasta: consulta.hasta,
      incluirInactivos: consulta.incluir_inactivos ?? false,
    });

    const anios = [...new Set(catalogo.map((dia) => dia.anio))].sort((a, b) => a - b);
    const anio = consulta.anio ?? anios[0] ?? anioPorDefecto();

    res.json({
      ...construirVistaCalendario(anio, catalogo),
      anios_disponibles: anios,
      total: catalogo.length,
      correlation_id: getRequestContext()?.correlation_id ?? '',
    });
  };
}

/**
 * `#49 POST /api/v1/admin/calendario-laboral/feriado-excepcional`
 * Alta de feriado con impacto en el cómputo de plazos del Art. 143 LPAG.
 */
export function registrarFeriadoExcepcional(deps: DependenciasController) {
  return async function registrarFeriadoExcepcionalHandler(
    req: Request,
    res: Response,
  ): Promise<void> {
    const entrada = esquemaFeriadoExcepcional.parse(req.body);
    const registrado = await deps.calendario.registrarFeriadoExcepcional(entrada);
    res.status(201).json(registrado);
  };
}

/**
 * `#47 GET /api/v1/admin/tablas-maestras`
 * Consulta unificada de catálogos maestros ya existentes (tipos de documentos,
 * tipos de trámite, estados, roles, permisos y calendario de feriados).
 */
export function listarTablasMaestras(deps: DependenciasController) {
  return async function listarTablasMaestrasHandler(req: Request, res: Response): Promise<void> {
    const consulta = esquemaConsultaTablasMaestras.parse(req.query);
    const payload = await deps.tablasMaestras.listarMaestras(
      consulta.solo_activos,
      consulta.recargar,
    );

    res.setHeader('Cache-Control', CACHE_CONTROL_TABLAS_MAESTRAS);
    res.setHeader('Vary', 'Accept-Encoding');
    res.setHeader('X-Cache-TTL', String(TTL_TABLAS_MAESTRAS_SEGUNDOS));
    escribirRespuestaComprimida(req, res, payload);
  };
}

/**
 * Comprime con gzip (zlib nativo, sin dependencias nuevas) cuando el cliente lo
 * acepta y el cuerpo supera el umbral. El proyecto no tiene middleware global
 * de compresión, por lo que limitarla a este endpoint evita afectar las
 * respuestas ya contratadas de los demás routers.
 */
function escribirRespuestaComprimida(req: Request, res: Response, payload: unknown): void {
  const aceptaGzip = (req.get('accept-encoding') ?? '').toLowerCase().includes('gzip');
  const cuerpo = JSON.stringify(payload);
  const bytes = Buffer.byteLength(cuerpo);

  if (!aceptaGzip || bytes < UMBRAL_COMPRESION_BYTES) {
    res.type('application/json').send(cuerpo);
    return;
  }

  res.setHeader('Content-Encoding', 'gzip');
  res.type('application/json').send(gzipSync(cuerpo));
}