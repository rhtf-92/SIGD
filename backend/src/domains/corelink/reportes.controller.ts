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
 * Autorización: `DIRECTOR` y `ADMINISTRADOR`. Es una vista de conjunto
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
const ROLES_ANALITICA = new Set(['DIRECTOR', 'ADMINISTRADOR']);

export interface ControladorReportes {
  resumen: RequestHandler;
  cuellosBotella: RequestHandler;
  tendencias: RequestHandler;
  tiemposAtencion: RequestHandler;
  refrescar: RequestHandler;
}

/** Etiquetas de mes para serie de tendencias del dashboard ejecutivo. */
const NOMBRES_MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'] as const;

function resolverPeriodoConsulta(filtros: {
  periodo?: string;
  anio?: number;
  mes?: string;
}): string | null {
  if (filtros.periodo && /^\d{4}-(0[1-9]|1[0-2])$/.test(filtros.periodo)) {
    return `${filtros.periodo}-01`;
  }
  if (filtros.periodo === 'mensual' && filtros.anio && filtros.mes) {
    return `${filtros.anio}-${filtros.mes}-01`;
  }
  return null;
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
      const filtros = filtrosResumenSchema.parse(req.query ?? {});
      const periodoConsulta = resolverPeriodoConsulta(filtros);
      const anioConsulta = filtros.anio ?? anioEnLima();
      const limiteDias = filtros.diasLimite ?? 5;

      const [resumen, serieTendencias, nombres] = await Promise.all([
        servicio.resumen(periodoConsulta),
        servicio.tendencias(anioConsulta).catch(() => []),
        repositorio.obtenerNombresUnidades().catch(() => new Map()),
      ]);
      const cuellos = await servicio
        .cuellosBotella(periodoConsulta, limiteDias, nombres)
        .catch(() => []);

      const tendencia = serieTendencias.map((punto) => ({
        fechaLabel: NOMBRES_MESES[punto.mes - 1] ?? `M${punto.mes}`,
        radicados: punto.radicados,
        resueltos: punto.atendidos,
        observados: punto.observados,
      }));
      const cuellosBotella = cuellos.map((c) => ({
        area: c.areaNombre,
        expedienteCount: c.expedientesEstancados,
        diasPromedio: c.diasRetencion,
        severity: c.riesgo === 'alto' ? 'high' : c.riesgo === 'medio' ? 'medium' : 'low',
      }));
      const unidades = Array.from(nombres.entries()).map(([id, info]) => ({
        id,
        nombre: info.nombre,
      }));

      const totalRad = resumen.contadores.nRadicados;
      const pct = (n: number) =>
        totalRad > 0 ? Math.round((n / totalRad) * 1000) / 10 : 0;
      const nResueltosSinArchivar = resumen.contadores.nAtendidos;
      const nArchivados = resumen.contadores.nArchivados;
      const nObservados = resumen.contadores.nObservados;
      const nEnRevision = Math.max(0, resumen.contadores.nEnTramite - nObservados);
      const nPendientesInicio = Math.max(
        0,
        totalRad - nResueltosSinArchivar - nArchivados - resumen.contadores.nEnTramite,
      );
      const estados =
        totalRad > 0
          ? [
              { estado: 'Resuelto', porcentaje: pct(nResueltosSinArchivar), color: '#059669' },
              { estado: 'Archivado', porcentaje: pct(nArchivados), color: '#475569' },
              { estado: 'En revisión', porcentaje: pct(nEnRevision), color: '#1d4ed8' },
              { estado: 'Observado', porcentaje: pct(nObservados), color: '#d97706' },
              { estado: 'Pendiente / Derivado', porcentaje: pct(nPendientesInicio), color: '#0284c7' },
            ].filter((item) => item.porcentaje > 0)
          : [];

      // `periodo` y `actualizadoEn` son metadatos de la lectura; se preservan los KPIs
      // MGD oficiales y se añaden las series y llaves esperadas por el tablero ejecutivo.
      res.json({
        ...resumen,
        totalProcesados: resumen.contadores.nRadicados,
        tasaResolucionOportuna: resumen.tro.valor,
        tasaCompletitud: resumen.vtep.valor,
        atrasadosCriticos: resumen.contadores.nObservados,
        saludMesasPartes: resumen.teo.cumple ? 'Operativa' : 'En observación',
        tendencia,
        estados,
        cuellosBotella,
        unidades,
      });
    },

    cuellosBotella: async (req, res) => {
      await autorizado(req);
      const { periodo, diasLimite } = filtrosCuellosBotellaSchema.parse(req.query ?? {});
      const periodoConsulta = periodo ? `${periodo}-01` : null;
      const nombres = await repositorio.obtenerNombresUnidades();
      res.json(await servicio.cuellosBotella(periodoConsulta, diasLimite, nombres));
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
     * tablero exige `ADMINISTRADOR`. Permitir que un `DIRECTOR` dispare un refresco que
     * compite con el refresco programado del planificador sólo introduce
     * contención; el director consulta el dato, el administrador lo materializa.
     */
    refrescar: async (req, res) => {
      const actor = await actorProvider.obtenerActor(req);
      if (!actor) throw new UnauthorizedError();
      if (!actor.roles.includes('ADMINISTRADOR')) throw new ForbiddenError();
      const resultado = await servicio.refrescar();
      res.json({
        vistas: resultado.vistas,
        duracionMs: resultado.duracionMs,
        refrescoYaEnCurso: resultado.refrescoYaEnCurso,
      });
    },
  };
}
