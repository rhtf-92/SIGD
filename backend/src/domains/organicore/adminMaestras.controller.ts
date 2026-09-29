/**
 * Controlador REST de administración de OrganiCore (T-BE-OC-14 y T-BE-OC-15).
 *
 * Responsabilidad exclusiva: traducir `Request` → argumentos del servicio y
 * resultado del servicio → `Response`. No contiene SQL ni reglas de negocio
 * (criterios de aceptación 5 y 6). Los errores se propagan con `throw` para que
 * los atienda `src/middleware/error-middleware.ts` con el formato RFC 9457.
 *
 * Las cabeceras de caché HTTP se escriben aquí porque son parte del contrato de
 * transporte, no del dominio.
 */

import { gzipSync } from 'node:zlib';
import type { Request, Response } from 'express';
import { getRequestContext } from '../../shared/request-context/request-context.js';
import { CalendarioService, construirVistaCalendario } from './calendario.service.js';
import {
  esquemaConsultaCalendario,
  esquemaConsultaTablasMaestras,
  esquemaFeriadoExcepcional,
} from './calendario.schemas.js';
import {
  CACHE_CONTROL_TABLAS_MAESTRAS,
  TablasMaestrasService,
  TTL_TABLAS_MAESTRAS_MS,
} from './tablasMaestras.service.js';

/** Umbral a partir del cual se comprime la respuesta (compression en el borde). */
const UMBRAL_COMPRESION_BYTES = 1024;

export interface DependenciasController {
  calendario: CalendarioService;
  tablasMaestras: TablasMaestrasService;
}

function anioPorDefecto(): number {
  return new Date().getUTCFullYear();
}

/**
 * `GET /api/v1/admin/calendario-laboral` (#48)
 * Calendario oficial con días laborables, festivos y feriados de Ucayali.
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
 * `POST /api/v1/admin/calendario-laboral/feriado-excepcional` (#49)
 * Alta de feriado regional no laborable con impacto en el cómputo de plazos.
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
 * `GET /api/v1/admin/tablas-maestras` (#47)
 * Consulta unificada de catálogos maestros (tipos de documentos, tipos de
 * trámite, estados, vías, materias y demás diccionarios ya existentes).
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
    res.setHeader('X-Cache-TTL', String(TTL_TABLAS_MAESTRAS_MS / 1000));
    escribirRespuestaComprimida(req, res, payload);
  };
}

/**
 * Comprime con gzip (zlib nativo, sin dependencias nuevas) cuando el cliente
 * lo acepta y el cuerpo supera el umbral. El proyecto no tenía middleware de
 * compresión global; limitarla a este endpoint evita afectar las respuestas ya
 * contratadas de los demás routers.
 */
function escribirRespuestaComprimida(req: Request, res: Response, payload: unknown): void {
  const aceptaGzip = (req.get('accept-encoding') ?? '').toLowerCase().includes('gzip');
  const cuerpo = JSON.stringify(payload);
  const bytes = Buffer.byteLength(cuerpo);

  if (!aceptaGzip || bytes < UMBRAL_COMPRESION_BYTES) {
    res.type('application/json').send(cuerpo);
    return;
  }

  const comprimido = gzipSync(cuerpo);
  res.setHeader('Content-Encoding', 'gzip');
  res.type('application/json').send(comprimido);
}
