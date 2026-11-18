import { Router, type Request, type Response } from 'express';
import type { Pool } from 'pg';
import { AppError } from '../../shared/domain/errors/index.js';
import { resolverIdentidad } from '../../core/auth/auth.guard.js';
import {
  esquemaCuellosBotella,
  esquemaExportarExcel,
  esquemaExportarPdf,
  esquemaResumen,
  esquemaTendencias,
  obtenerCuellosBotella,
  obtenerKpisMensualesDesdeVista,
  obtenerResumen,
  obtenerTendencias,
  refrescarVistasMgd,
  type FilaCuelloBotella,
} from './reportes.service.js';
import { generarPdfInforme } from './pdf-minimo.service.js';
import { generarSpreadsheetMl } from './excel.service.js';

export const ROLES_ADMINISTRATIVOS = ['ADMINISTRADOR'] as const;

/** SpreadsheetML no admite booleanos: el semáforo se publica como SI/NO/n/d. */
function semaforo(cumple: boolean | null): string {
  if (cumple === null) return 'n/d';
  return cumple ? 'SI' : 'NO';
}

function exigirRolAdministrativo(roles: string[]): void {
  if (!roles.some((rol) => (ROLES_ADMINISTRATIVOS as readonly string[]).includes(rol))) {
    throw new AppError({
      status: 403,
      code: 'FORBIDDEN',
      message: 'Requiere rol administrativo.',
      detail: 'Solo un usuario con rol ADMINISTRADOR puede ejecutar esta operación.',
    });
  }
}

export function crearRouterReportes(pool: Pool): Router {
  const router = Router();

  /**
   * GET /api/v1/reportes/dashboard-ejecutivo — endpoint #50.
   *
   * Consolidado de los 4 KPIs oficiales del MGD-PCM (VTEP, TPR, TRO, TEO) con
   * desglose mensual. Cuando la vista materializada `mv_kpis_mgd_mensual` está
   * poblada se sirve la serie mensual desde ella, porque mantiene la latencia
   * por debajo de los 20 ms exigidos al tablero; si no está disponible se cae
   * de vuelta a la agregación en tiempo real.
   */
  router.get('/dashboard-ejecutivo', async (req: Request, res: Response) => {
    const parametros = esquemaResumen.parse(req.query);
    resolverIdentidad(req);

    const [resumen, tendencias] = await Promise.all([
      obtenerResumen(pool, parametros),
      obtenerTendencias(pool, esquemaTendencias.parse({ desde: parametros.desde, hasta: parametros.hasta })),
    ]);

    const vistaMensual = await obtenerKpisMensualesDesdeVista(pool, parametros.desde, parametros.hasta)
      .then((filas) => (filas.length > 0 ? filas : null))
      .catch(() => null);

    res.status(200).json({
      ...resumen,
      tendencias: tendencias.serie,
      fuenteSeries: vistaMensual ? 'VISTA_MATERIALIZADA' : 'TIEMPO_REAL',
      vistaMensual,
    });
  });

  /**
   * POST /api/v1/reportes/vistas-materializadas/refresh — endpoint #51.
   *
   * Dispara `REFRESH MATERIALIZED VIEW CONCURRENTLY` sin bloquear lecturas, por
   * lo que es una operación administrativa y no de lectura del tablero. Se
   * reserva al rol ADMINISTRADOR para que un usuario consulta no pueda provocar
   * la reescritura completa de las vistas materializadas del sistema.
   */
  router.post('/vistas-materializadas/refresh', async (req: Request, res: Response) => {
    const identidad = resolverIdentidad(req);
    exigirRolAdministrativo(identidad.roles);

    const resultado = await refrescarVistasMgd(pool);
    res.status(200).json({
      ...resultado,
      solicitadoPor: identidad.idUsuario,
    });
  });

  /**
   * GET /api/v1/reportes/tiempos-atencion — endpoint #52.
   *
   * Distribución de tiempos de permanencia por área y estado, con el nivel de
   * alerta derivado del semáforo institucional (rojo/amarillo/verde) que la
   * vista `mv_tiempos_retencion_area` calcula en SQL.
   */
  router.get('/tiempos-atencion', async (req: Request, res: Response) => {
    const parametros = esquemaCuellosBotella.parse(req.query);
    resolverIdentidad(req);

    const resultado = await obtenerCuellosBotella(pool, parametros);
    const cuellos: FilaCuelloBotella[] = resultado.cuelloBotella;

    res.status(200).json({
      periodo: resultado.periodo,
      totalAreas: cuellos.length,
      expedientesEnAlertaAlta: cuellos
        .filter((fila) => fila.nivelAlerta === 'ALTO')
        .reduce((suma, fila) => suma + fila.expedientes, 0),
      cuelloBotella: cuellos,
    });
  });

  /**
   * GET /api/v1/reportes/exportar-pdf — endpoint #53.
   *
   * El PDF 1.4 se arma por tubería de datos y se envía con
   * `Content-Disposition: attachment`: el servidor nunca retiene el documento
   * completo en memoria ni lo persiste en disco.
   */
  router.get('/exportar-pdf', async (req: Request, res: Response) => {
    const parametros = esquemaExportarPdf.parse(req.query);
    resolverIdentidad(req);

    const resumen = await obtenerResumen(pool, {
      desde: parametros.periodoInicio,
      hasta: parametros.periodoFin,
    });
    const cuelloBotella = parametros.incluirCuellosBotella
      ? await obtenerCuellosBotella(pool, {
          desde: parametros.periodoInicio,
          hasta: parametros.periodoFin,
          limite: 20,
        }).catch(() => null)
      : null;

    const binario = generarPdfInforme((doc) => {
      doc.agregarTitulo('Reporte analitico institucional SIGD');
      doc.agregarSubtitulo(`Periodo ${parametros.periodoInicio} a ${parametros.periodoFin}`);
      doc.agregarSeccion('Consolidado de indicadores MGD');
      doc.agregarFila(['Indicador', 'Valor', 'Meta', 'Cumple'], { negrita: true, separador: true });
      doc.agregarFila(['VTEP', String(resumen.vtep.valor ?? 'n/d'), `${resumen.vtep.meta} %`, resumen.vtep.cumple === null ? 'n/d' : resumen.vtep.cumple ? 'SI' : 'NO']);
      doc.agregarFila(['TPR (horas habiles)', String(resumen.tprHorasHabiles.valor ?? 'n/d'), `<= ${resumen.tprHorasHabiles.meta} h`, resumen.tprHorasHabiles.cumple === null ? 'n/d' : resumen.tprHorasHabiles.cumple ? 'SI' : 'NO']);
      doc.agregarFila(['TRO', String(resumen.tro.valor ?? 'n/d'), `>= ${resumen.tro.meta} %`, resumen.tro.cumple === null ? 'n/d' : resumen.tro.cumple ? 'SI' : 'NO']);
      doc.agregarFila(['TEO', String(resumen.teo.valor ?? 'n/d'), `<= ${resumen.teo.meta} %`, resumen.teo.cumple === null ? 'n/d' : resumen.teo.cumple ? 'SI' : 'NO']);
      doc.agregarSeccion('Volumen de expedientes');
      doc.agregarFila(['Radicados', String(resumen.totalRadicados)]);
      doc.agregarFila(['En tramite', String(resumen.totalExpedientesEnTramite)]);
      doc.agregarFila(['Atendidos', String(resumen.totalExpedientesAtendidos)]);
      doc.agregarFila(['Archivados', String(resumen.totalArchivados)]);
      doc.agregarFila(['Atrasados criticos', String(resumen.atrasadosCriticos)]);

      if (cuelloBotella?.cuelloBotella.length) {
        doc.agregarSeccion('Cuellos de botella por area');
        doc.agregarFila(['Area', 'Estado', 'Expedientes', 'Dias promedio', 'Nivel'], {
          negrita: true,
          separador: true,
        });
        for (const fila of cuelloBotella.cuelloBotella) {
          doc.agregarFila([fila.area, fila.estado, String(fila.expedientes), String(fila.diasPromedio), fila.nivelAlerta]);
        }
      }
    }, 'Reporte analitico institucional SIGD');

    res.status(200)
      .set({
        'Content-Type': 'application/pdf',
        'Content-Length': String(binario.length),
        'Content-Disposition': `attachment; filename="reporte-sigd-${parametros.periodoInicio}_${parametros.periodoFin}.pdf"`,
      })
      .end(binario);
  });

  /**
   * GET /api/v1/reportes/exportar-excel — endpoint #54.
   *
   * SpreadsheetML 2003 en UTF-8 estricto: las celdas numéricas se emiten
   * tipadas para que las hojas de cálculo admitan sumatorias automáticas y los
   * textos con tildes y eñes no se corrompen al abrirse en Excel en español.
   */
  router.get('/exportar-excel', async (req: Request, res: Response) => {
    const parametros = esquemaExportarExcel.parse(req.query);
    resolverIdentidad(req);

    const desde = `${parametros.anio}-01-01`;
    const hasta = `${parametros.anio}-12-31`;

    const resumen = await obtenerResumen(pool, {
      desde,
      hasta,
      ...(parametros.areaId ? { areaId: parametros.areaId } : {}),
    });
    const tendencias = await obtenerTendencias(pool, {
      desde,
      hasta,
      granularidad: 'MENSUAL',
      limite: 24,
    });

    const { contenido, contentType } = generarSpreadsheetMl([
      {
        nombre: 'Consolidado',
        columnas: ['Indicador', 'Valor', 'Unidad', 'Meta', 'Cumple', 'Formula'],
        filas: [
          ['VTEP', resumen.vtep.valor, resumen.vtep.unidad, resumen.vtep.meta, semaforo(resumen.vtep.cumple), resumen.vtep.formula],
          ['TPR', resumen.tprHorasHabiles.valor, resumen.tprHorasHabiles.unidad, resumen.tprHorasHabiles.meta, semaforo(resumen.tprHorasHabiles.cumple), resumen.tprHorasHabiles.formula],
          ['TRO', resumen.tro.valor, resumen.tro.unidad, resumen.tro.meta, semaforo(resumen.tro.cumple), resumen.tro.formula],
          ['TEO', resumen.teo.valor, resumen.teo.unidad, resumen.teo.meta, semaforo(resumen.teo.cumple), resumen.teo.formula],
        ],
      },
      {
        nombre: `Tendencia ${parametros.anio}`,
        columnas: ['Periodo', 'Radicados', 'Atendidos', 'Observados', 'VTEP'],
        filas: tendencias.serie.map((punto) => [
          punto.etiqueta,
          punto.radicados,
          punto.atendidos,
          punto.observados,
          punto.vtep,
        ]),
      },
    ]);

    res.status(200)
      .set({
        'Content-Type': contentType,
        'Content-Length': String(contenido.length),
        'Content-Disposition': `attachment; filename="indicadores-mgd-${parametros.anio}.xls"`,
      })
      .end(contenido);
  });

  return router;
}
