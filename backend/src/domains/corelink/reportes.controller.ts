/**
 * SIGD · IESTP "Suiza" (Pucallpa) — Núcleo 00 CoreLink
 * Motor Analítico MGD-PCM/SEGDI · Controladores REST de la analítica ejecutiva.
 *
 * Tarea: T-BE-CL-12.
 *
 * Endpoints del plan maestro §4.7 (Dominio 6, OE6):
 *   #50 `GET /api/v1/reportes/dashboard/resumen`
 *   #51 `GET /api/v1/reportes/dashboard/cuellos-botella`
 *   #52 `GET /api/v1/reportes/dashboard/tendencias`
 *
 * El plan maestro contiene DOS catálogos de rutas para estos mismos tres números y
 * no coinciden. §4.7 y el frontend coinciden en `dashboard/resumen`,
 * `dashboard/cuellos-botella` y `dashboard/tendencias`; §20 usa `dashboard-ejecutivo`,
 * `vistas-materializadas/refresh` y `tiempos-atencion`. El propio §7 del plan
 * obliga a implementar "rutas canónicas y sus respectivos alias de
 * interoperabilidad", así que aquí se registran las dos familias apuntando al mismo
 * controlador. Es la única forma de no dejar muerto a ninguno de los dos
 * consumidores: `useAreaBottlenecks.ts` llama a `dashboard/cuellos-botella` y
 * `kpiCalculator.service.ts` documenta `dashboard/resumen`.
 *
 * Autorización: `DIRECTOR` y `SUPER_ADMIN`, según §4.7. Es una vista de conjunto
 * institucional — consolidado, retención por área y calidad de la tabla — que
 * ningún rol académico debe poder leer. La denegación es la ausencia de esos dos
 * roles, nunca una condición que se pueda invertir por configuración.
 *
 * La validación de la query usa `ZodError` de `.parse()`, igual que
 * `rutadoc.controller.ts`: `errorMiddleware` ya lo traduce a un 400 RFC 7807
 * `VALIDATION_ERROR` con todos los `invalid_params`, de modo que un try-catch aquí
 * sólo duplicaría esa traducción.
 */

import type { Request, RequestHandler } from 'express';
import { ForbiddenError, UnauthorizedError } from '../../shared/domain/errors/index.js';
import type { ActorProviderRutaDoc } from '../rutadoc/rutadoc.actor-provider.js';
import type { ActorRutaDoc } from '../rutadoc/rutadoc.types.js';
import type { RepositorioMgdAnalytics } from './mgdAnalytics.repository.js';
import { ServicioMgdAnalytics } from './mgdAnalytics.service.js';
import {
  anioEnLima,
  filtrosCuellosBotellaSchema,
  filtrosResumenSchema,
  filtrosTendenciasSchema,
} from './reportes.schemas.js';
import type { CacheDistribuida } from '../identicore/ubigeo.service.js';

/** Roles autorizados por §4.7 para la analítica ejecutiva. */
const ROLES_ANALITICA = new Set(['DIRECTOR', 'SUPER_ADMIN']);

export interface ControladorReportes {
  resumen: RequestHandler;
  cuellosBotella: RequestHandler;
  tendencias: RequestHandler;
  tiemposAtencion: RequestHandler;
  refrescar: RequestHandler;
}

export function crearControladorReportes(
  actorProvider: ActorProviderRutaDoc,
  servicio: ServicioMgdAnalytics,
  repositorio: RepositorioMgdAnalytics,
): ControladorReportes {
  /**
   * Autorización fail-closed de la analítica ejecutiva.
   *
   * La ausencia de actor es 401 y la falta de rol es 403: son dos casos distintos
   * de diagnóstico para el usuario. Un rol no reconocido NO es un acceso denegado con
   * mensaje genérico sino exactamente igual: cualquier rol fuera del conjunto
   * produce 403, sin revelar qué roles sí pasan.
   */
  const autorizado = async (req: Request): Promise<ActorRutaDoc> => {
    const actor = await actorProvider.obtenerActor(req);
    if (!actor) throw new UnauthorizedError();
    if (!actor.roles.some((rol) => ROLES_ANALITICA.has(rol))) throw new ForbiddenError();
    return actor;
  };

  return {
    resumen: async (req, res) => {
      await autorizado(req);
      const { periodo } = filtrosResumenSchema.parse(req.query ?? {});
      const resumen = await servicio.resumen(periodo ?? null);
      // `periodo` y `actualizadoEn` son metadatos de la lectura; el contrato de
      // §4.7 define los seis campos de primer nivel, pero sin ellos el frontend no
      // puede distinguir "0 %" de "sin datos" ni saber de cuándo es el dato.
      res.json({ ...resumen });
    },

    cuellosBotella: async (req, res) => {
      await autorizado(req);
      const { periodo, diasLimite } = filtrosCuellosBotellaSchema.parse(req.query ?? {});
      const nombres = await repositorio.obtenerNombresUnidades();
      res.json(await servicio.cuellosBotella(periodo ?? null, diasLimite, nombres));
    },

    tendencias: async (req, res) => {
      await autorizado(req);
      const { anio } = filtrosTendenciasSchema.parse(req.query ?? {});
      res.json(await servicio.tendencias(anio ?? anioEnLima()));
    },

    /**
     * Distribución de permanencia por área (#52 según §20, `tiempos-atencion`).
     *
     * Devuelve los tramos anidados en cada área, que es lo que consume el mapa de
     * calor `BottleNeckHeatmap.tsx` del frontend. Comparte la lectura con el ranking
     * pero devuelve el detalle completo, en vez del resumen por área.
     */
    tiemposAtencion: async (req, res) => {
      await autorizado(req);
      const { periodo } = filtrosResumenSchema.parse(req.query ?? {});
      const distribucion = await servicio.distribucionRetencion(periodo ?? null);
      const nombres = await repositorio.obtenerNombresUnidades();
      res.json(Array.from(distribucion.entries()).map(([areaId, tramos]) => ({
        areaId,
        areaNombre: nombres.get(areaId)?.nombre ?? areaId,
        sigla: nombres.get(areaId)?.sigla ?? null,
        tramos,
      })));
    },

    /**
     * Refresco concurrente de las vistas materializadas (#51 según §20).
     *
     * Es una operación de plataforma, no de consulta: además de los dos roles del
     * tablero exige `SUPER_ADMIN`. Permitir que un `DIRECTOR` dispare un refresco que
     * compite con el refresco programado del planificador sólo introduce
     * contención; el director consulta el dato, el administrador lo materializa.
     */
    refrescar: async (req, res) => {
      const actor = await actorProvider.obtenerActor(req);
      if (!actor) throw new UnauthorizedError();
      if (!actor.roles.includes('SUPER_ADMIN')) throw new ForbiddenError();
      const resultado = await servicio.refrescar();
      res.json({
        vistas: resultado.vistas,
        duracionMs: resultado.duracionMs,
        refrescoYaEnCurso: resultado.refrescoYaEnCurso,
      });
    },
  };
}
