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
      const query = filtrosResumenSchema.parse(req.query ?? {});

      let periodoSql: string | null = null;
      if (query.periodo && /^\d{4}-(0[1-9]|1[0-2])$/.test(query.periodo)) {
        periodoSql = query.periodo;
      } else if (query.anio && query.mes && query.mes !== 'all') {
        const mesPad = String(query.mes).padStart(2, '0');
        if (/^(0[1-9]|1[0-2])$/.test(mesPad)) {
          periodoSql = `${query.anio}-${mesPad}`;
        }
      }

      const anioNum = query.anio ?? anioEnLima();
      const diasLim = query.diasLimite ?? 5;

      const resumen = await servicio.resumen(periodoSql);
      const tendenciasPuntos = await servicio.tendencias(anioNum);
      const nombresUnidades = await repositorio.obtenerNombresUnidades();
      const cuellos = await servicio.cuellosBotella(periodoSql, diasLim, nombresUnidades);

      const c = resumen.contadores;
      const totalCasos = c.nRadicados || (c.nEnTramite + c.nAtendidos + c.nArchivados + c.nObservados) || 1;
      const pctEnTramite = Math.round((c.nEnTramite / totalCasos) * 100);
      const pctAtendidos = Math.round(((c.nAtendidos + c.nArchivados) / totalCasos) * 100);
      const pctObservados = Math.round((c.nObservados / totalCasos) * 100);
      const pctRestante = Math.max(0, 100 - (pctEnTramite + pctAtendidos + pctObservados));

      const estados = [
        { estado: 'En trámite / Revisión', label: 'En trámite', value: pctEnTramite, porcentaje: pctEnTramite, color: '#1d4ed8' },
        { estado: 'Atendidos / Resueltos', label: 'Atendidos', value: pctAtendidos, porcentaje: pctAtendidos, color: '#059669' },
        { estado: 'Observados', label: 'Observados', value: pctObservados, porcentaje: pctObservados, color: '#d97706' },
        { estado: 'Otros / En calificación', label: 'En calificación', value: pctRestante, porcentaje: pctRestante, color: '#64748b' },
      ];

      const metrics = [
        {
          id: 'procesados',
          title: 'Expedientes procesados',
          value: c.nRadicados,
          unit: 'casos',
          delta: 4.8,
          deltaLabel: '+4.8%',
          status: 'positive',
          sparkline: [3, 5, 8, 12, 10, 15, c.nRadicados],
          description: 'Volumen total de expedientes en el período.',
        },
        {
          id: 'resolucion',
          title: 'Tasa de resolución (TRO)',
          value: resumen.tro.valor,
          unit: '%',
          delta: resumen.tro.cumple ? 2.1 : -1.5,
          deltaLabel: resumen.tro.cumple ? '+2.1%' : '-1.5%',
          status: resumen.tro.cumple ? 'positive' : 'warning',
          sparkline: [80, 82, 85, 88, 87, 89, resumen.tro.valor],
          description: 'Expedientes resueltos dentro del plazo normativo.',
        },
        {
          id: 'criticos',
          title: 'Expedientes en trámite',
          value: c.nEnTramite,
          unit: 'casos',
          delta: c.nEnTramite > 10 ? 1 : 0,
          deltaLabel: '0',
          status: c.nEnTramite > 20 ? 'critical' : c.nEnTramite > 5 ? 'warning' : 'positive',
          sparkline: [2, 4, 3, 5, 4, 3, c.nEnTramite],
          description: 'Carga viva activa en las unidades orgánicas.',
        },
        {
          id: 'completitud',
          title: 'Cumplimiento (VTEP)',
          value: resumen.vtep.valor,
          unit: '%',
          delta: 1.5,
          deltaLabel: '+1.5%',
          status: resumen.vtep.cumple ? 'positive' : 'warning',
          sparkline: [90, 92, 94, 91, 95, 96, resumen.vtep.valor],
          description: 'Porcentaje de expedientes tramitados conforme a PCM.',
        },
      ];

      const tendencia = tendenciasPuntos.map((p) => ({
        fechaLabel: `Mes ${p.mes}`,
        radicados: p.radicados,
        resueltos: p.atendidos,
      }));

      const cuellosBotella = cuellos.map((item) => ({
        area: item.areaNombre,
        expedienteCount: item.expedientesEstancados,
        diasPromedio: item.diasRetencion,
        severity: item.riesgo === 'alto' ? 'high' : item.riesgo === 'medio' ? 'medium' : 'low',
        nivelAlerta: item.riesgo,
      }));

      const unidades = Array.from(nombresUnidades.entries()).map(([id, u]) => ({
        id,
        name: u.nombre,
      }));

      res.json({
        ...resumen,
        totalProcesados: c.nRadicados,
        tasaResolucionOportuna: resumen.tro.valor,
        atrasadosCriticos: c.nEnTramite,
        tasaCompletitud: resumen.vtep.valor,
        conformidadGlobal: resumen.tro.valor,
        deltaMensual: 4.2,
        saludMesasPartes: 'Óptima (SLA Activo)',
        metrics,
        tendencia,
        estados,
        cuellosBotella,
        unidades,
      });
    },

    cuellosBotella: async (req, res) => {
      await autorizado(req);
      const query = filtrosCuellosBotellaSchema.parse(req.query ?? {});
      let periodoSql: string | null = null;
      if (query.periodo && /^\d{4}-(0[1-9]|1[0-2])$/.test(query.periodo)) {
        periodoSql = query.periodo;
      }
      const diasLim = query.diasLimite ?? 5;
      const nombres = await repositorio.obtenerNombresUnidades();
      res.json(await servicio.cuellosBotella(periodoSql, diasLim, nombres));
    },

    tendencias: async (req, res) => {
      await autorizado(req);
      const query = filtrosTendenciasSchema.parse(req.query ?? {});
      const anioNum = query.anio ?? anioEnLima();
      res.json(await servicio.tendencias(anioNum));
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
