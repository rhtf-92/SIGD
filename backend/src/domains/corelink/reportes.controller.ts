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
  filtrosExportacionSchema,
  filtrosResumenSchema,
  filtrosTendenciasSchema,
} from './reportes.schemas.js';
import { generarSpreadsheetMl } from '../../modules/reportes/excel.service.js';
import { generarPdfInforme } from '../../modules/reportes/pdf-minimo.service.js';

/** Roles autorizados por §4.7 para la analítica ejecutiva. */
const ROLES_ANALITICA = new Set(['DIRECTOR', 'SUPER_ADMIN']);

export interface ControladorReportes {
  resumen: RequestHandler;
  cuellosBotella: RequestHandler;
  tendencias: RequestHandler;
  tiemposAtencion: RequestHandler;
  unidades: RequestHandler;
  exportarExcel: RequestHandler;
  exportarPdf: RequestHandler;
  refrescar: RequestHandler;
}

export function crearControladorReportes(
  actorProvider: ActorProviderRutaDoc,
  servicio: ServicioMgdAnalytics,
  repositorio: RepositorioMgdAnalytics,
): ControladorReportes {
  const autorizado = async (req: Request): Promise<ActorRutaDoc> => {
    const actor = await actorProvider.obtenerActor(req);
    if (!actor) throw new UnauthorizedError();
    if (!actor.roles.some((rol) => ROLES_ANALITICA.has(rol))) throw new ForbiddenError();
    return actor;
  };

  return {
    resumen: async (req, res) => {
      await autorizado(req);
      const { periodo, unidadOrganicaId } = filtrosResumenSchema.parse(req.query ?? {});
      const resumen = await servicio.resumen(periodo ?? null, unidadOrganicaId ?? null);
      res.json({ ...resumen });
    },

    cuellosBotella: async (req, res) => {
      await autorizado(req);
      const { periodo, diasLimite, unidadOrganicaId } = filtrosCuellosBotellaSchema.parse(req.query ?? {});
      const nombres = await repositorio.obtenerNombresUnidades();
      res.json(await servicio.cuellosBotella(periodo ?? null, diasLimite, nombres, unidadOrganicaId ?? null));
    },

    tendencias: async (req, res) => {
      await autorizado(req);
      const { anio, unidadOrganicaId } = filtrosTendenciasSchema.parse(req.query ?? {});
      res.json(await servicio.tendencias(anio ?? anioEnLima(), unidadOrganicaId ?? null));
    },

    tiemposAtencion: async (req, res) => {
      await autorizado(req);
      const { periodo, unidadOrganicaId } = filtrosResumenSchema.parse(req.query ?? {});
      const distribucion = await servicio.distribucionRetencion(periodo ?? null, unidadOrganicaId ?? null);
      const nombres = await repositorio.obtenerNombresUnidades();
      res.json(Array.from(distribucion.entries()).map(([areaId, tramos]) => ({
        areaId,
        areaNombre: nombres.get(areaId)?.nombre ?? areaId,
        sigla: nombres.get(areaId)?.sigla ?? null,
        tramos,
      })));
    },

    unidades: async (req, res) => {
      await autorizado(req);
      res.json(await repositorio.obtenerUnidadesDisponibles());
    },

    exportarExcel: async (req, res) => {
      await autorizado(req);
      const { anio, periodo, unidadOrganicaId, diasLimite } = filtrosExportacionSchema.parse(req.query ?? {});
      const anioEfectivo = periodo ? Number(periodo.slice(0, 4)) : (anio ?? anioEnLima());
      const [resumen, tendencias, nombres] = await Promise.all([
        servicio.resumen(periodo ?? null, unidadOrganicaId ?? null),
        servicio.tendencias(anioEfectivo, unidadOrganicaId ?? null),
        repositorio.obtenerNombresUnidades(),
      ]);
      const cuellos = await servicio.cuellosBotella(periodo ?? null, diasLimite, nombres, unidadOrganicaId ?? null);
      const etiquetaPeriodo = periodo ?? String(anioEfectivo);
      const { contenido, contentType } = generarSpreadsheetMl([
        {
          nombre: 'Indicadores MGD',
          columnas: ['Indicador', 'Valor', 'Meta', 'Cumple'],
          filas: [
            ['Expedientes registrados', resumen.contadores.nRadicados, '-', 'N/A'],
            ['VTEP (%)', resumen.vtep.valor, `>= ${resumen.vtep.meta}%`, resumen.vtep.cumple ? 'SI' : 'NO'],
            ['TPR (horas habiles)', resumen.tprHorasHabiles.valor, `<= ${resumen.tprHorasHabiles.meta} h`, resumen.tprHorasHabiles.cumple ? 'SI' : 'NO'],
            ['TRO (%)', resumen.tro.valor, `>= ${resumen.tro.meta}%`, resumen.tro.cumple ? 'SI' : 'NO'],
            ['TEO (%)', resumen.teo.valor, `<= ${resumen.teo.meta}%`, resumen.teo.cumple ? 'SI' : 'NO'],
            ['En tramite', resumen.totalExpedientesEnTramite, '-', 'N/A'],
            ['Atendidos y archivados', resumen.totalExpedientesAtendidos, '-', 'N/A'],
          ],
        },
        {
          nombre: `Tendencia ${anioEfectivo}`,
          columnas: ['Mes', 'Radicados', 'Atendidos', 'Observados'],
          filas: tendencias.map((p) => [`${anioEfectivo}-${String(p.mes).padStart(2, '0')}`, p.radicados, p.atendidos, p.observados]),
        },
        {
          nombre: 'Cuellos de botella',
          columnas: ['Unidad Organica', 'Expedientes', 'Estancados', 'Dias Promedio', 'Riesgo'],
          filas: cuellos.map((c) => [c.areaNombre, c.expedientes, c.expedientesEstancados, c.diasRetencion, c.riesgo.toUpperCase()]),
        },
      ]);
      res.status(200)
        .set({
          'Content-Type': contentType,
          'Content-Length': String(contenido.length),
          'Content-Disposition': `attachment; filename="tablero-ejecutivo-${etiquetaPeriodo}.xls"`,
        })
        .end(contenido);
    },

    exportarPdf: async (req, res) => {
      await autorizado(req);
      const { anio, periodo, unidadOrganicaId, diasLimite } = filtrosExportacionSchema.parse(req.query ?? {});
      const anioEfectivo = periodo ? Number(periodo.slice(0, 4)) : (anio ?? anioEnLima());
      const [resumen, nombres] = await Promise.all([
        servicio.resumen(periodo ?? null, unidadOrganicaId ?? null),
        repositorio.obtenerNombresUnidades(),
      ]);
      const cuellos = await servicio.cuellosBotella(periodo ?? null, diasLimite, nombres, unidadOrganicaId ?? null);
      const etiquetaPeriodo = periodo ?? `Anio ${anioEfectivo}`;
      const unidadNombre = unidadOrganicaId
        ? (nombres.get(unidadOrganicaId)?.nombre ?? (unidadOrganicaId === 'SIN_AREA' ? 'Sin unidad asignada' : unidadOrganicaId))
        : 'Todas las unidades';
      const binario = generarPdfInforme((doc) => {
        doc.agregarTitulo('Tablero Directivo Ejecutivo - SIGD SUIZA');
        doc.agregarSubtitulo(`Periodo: ${etiquetaPeriodo} | Unidad: ${unidadNombre}`);
        doc.agregarSeccion('Indicadores MGD-PCM');
        doc.agregarFila(['Indicador', 'Valor', 'Meta', 'Cumple'], { negrita: true, separador: true });
        doc.agregarFila(['Expedientes registrados', String(resumen.contadores.nRadicados), '-', '-']);
        doc.agregarFila(['VTEP', `${resumen.vtep.valor}%`, `>= ${resumen.vtep.meta}%`, resumen.vtep.cumple ? 'SI' : 'NO']);
        doc.agregarFila(['TPR (horas habiles)', `${resumen.tprHorasHabiles.valor} h`, `<= ${resumen.tprHorasHabiles.meta} h`, resumen.tprHorasHabiles.cumple ? 'SI' : 'NO']);
        doc.agregarFila(['TRO', `${resumen.tro.valor}%`, `>= ${resumen.tro.meta}%`, resumen.tro.cumple ? 'SI' : 'NO']);
        doc.agregarFila(['TEO', `${resumen.teo.valor}%`, `<= ${resumen.teo.meta}%`, resumen.teo.cumple ? 'SI' : 'NO']);
        if (cuellos.length > 0) {
          doc.agregarSeccion('Cuellos de botella por unidad');
          doc.agregarFila(['Unidad', 'Total', 'Estancados', 'Dias prom.', 'Riesgo'], { negrita: true, separador: true });
          for (const c of cuellos) {
            doc.agregarFila([c.areaNombre, String(c.expedientes), String(c.expedientesEstancados), String(c.diasRetencion), c.riesgo.toUpperCase()]);
          }
        }
      }, 'Tablero Directivo Ejecutivo SIGD');
      res.status(200)
        .set({
          'Content-Type': 'application/pdf',
          'Content-Length': String(binario.length),
          'Content-Disposition': `attachment; filename="tablero-ejecutivo-${periodo ?? anioEfectivo}.pdf"`,
        })
        .end(binario);
    },

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
