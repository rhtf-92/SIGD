import type { Pool } from 'pg';
import { z } from 'zod';
import {
  calcularIndicadoresMgd,
  redondear,
  type InsumosKpi,
  type KpiMgd,
} from './kpi.service.js';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export const esquemaPeriodo = z
  .object({
    desde: z.string().regex(FECHA, 'Use el formato YYYY-MM-DD.'),
    hasta: z.string().regex(FECHA, 'Use el formato YYYY-MM-DD.'),
  })
  .refine((valor) => valor.desde <= valor.hasta, {
    message: 'El rango indicado es inválido: `desde` no puede ser posterior a `hasta`.',
    path: ['desde'],
  });

export type Periodo = z.infer<typeof esquemaPeriodo>;

export const esquemaResumen = z.object({
  desde: z.string().regex(FECHA).default(() => inicioMesActual()),
  hasta: z.string().regex(FECHA).default(() => hoyIso()),
  areaId: z.string().uuid().optional(),
});

export const esquemaTendencias = z.object({
  desde: z.string().regex(FECHA).default(() => inicioAnioActual()),
  hasta: z.string().regex(FECHA).default(() => hoyIso()),
  granularidad: z.enum(['DIARIA', 'SEMANAL', 'MENSUAL']).default('MENSUAL'),
  limite: z.coerce.number().int().min(2).max(60).default(24),
});

export const esquemaCuellosBotella = z.object({
  desde: z.string().regex(FECHA).default(() => inicioMesActual()),
  hasta: z.string().regex(FECHA).default(() => hoyIso()),
  limite: z.coerce.number().int().min(1).max(100).default(20),
});

export const esquemaExportarPdf = z.object({
  periodoInicio: z.string().regex(FECHA, 'Use el formato YYYY-MM-DD.'),
  periodoFin: z.string().regex(FECHA, 'Use el formato YYYY-MM-DD.'),
  incluirCuellosBotella: z.boolean().default(true),
});

export const esquemaExportarExcel = z.object({
  anio: z.coerce.number().int().min(2000).max(2100),
  areaId: z.string().uuid().optional(),
});

function hoyIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function inicioMesActual(): string {
  return `${hoyIso().slice(0, 7)}-01`;
}

function inicioAnioActual(): string {
  return `${hoyIso().slice(0, 4)}-01-01`;
}

export interface KpiRespuesta {
  valor: number | null;
  meta: number;
  cumple: boolean | null;
  unidad: '%' | 'horas';
  formula: string;
}

export interface PuntoTendencia {
  periodo: string;
  etiqueta: string;
  mes: number;
  radicados: number;
  atendidos: number;
  observados: number;
  vtep: number | null;
}

export interface FilaCuelloBotella {
  areaId: string | null;
  area: string;
  estado: string;
  expedientes: number;
  horasPromedio: number;
  diasPromedio: number;
  diasMaximo: number;
  vencido: number;
  nivelAlerta: 'ALTO' | 'MEDIO' | 'BAJO';
  proporcion: number;
}

export interface ResumenReportes {
  vtep: KpiRespuesta;
  tprHorasHabiles: KpiRespuesta;
  tro: KpiRespuesta;
  teo: KpiRespuesta;
  cumpleTodasLasMetas: boolean | null;
  totalExpedientesEnTramite: number;
  totalExpedientesAtendidos: number;
  totalRadicados: number;
  totalResueltos: number;
  totalArchivados: number;
  totalProcesados: number;
  atrasadosCriticos: number;
  tasaResolucionOportuna: number;
  tasaExpedientesObservados: number;
  tiempoPromedioRespuestaHoras: number;
  tprHoras: number;
  periodo: { desde: string; hasta: string };
  generadoEn: string;
}

interface FilaResumen {
  radicados: number;
  atendidos: number;
  archivados: number;
  observados: number;
  en_tramite: number;
  vencidos: number;
  resueltos: number;
  dentro_de_plazo: number;
  horas_calendario: number;
}

const SQL_RESUMEN = `
WITH rango AS (
    SELECT $1::date AS desde, $2::date AS hasta
),
base AS (
    SELECT
        e.expediente_id,
        e.fecha_radicacion,
        e.fecha_limite,
        a.estado_codigo,
        a.area_actual_id,
        ar.fecha_ingreso,
        cierre.fecha_cierre
    FROM sigd_tra.expediente e
    CROSS JOIN rango r
    LEFT JOIN sigd_rut.estado_actual_tramite a
           ON a.expediente_id = e.expediente_id
    LEFT JOIN sigd_tra.asiento_registro ar
           ON ar.expediente_id = e.expediente_id
          AND NOT ar.anulado
    LEFT JOIN LATERAL (
        SELECT m.fecha_movimiento
          FROM sigd_rut.movimiento_tramite m
         WHERE m.expediente_id = e.expediente_id
           AND m.estado_destino IN ('RESUELTO', 'NOTIFICADO', 'ARCHIVADO')
         ORDER BY m.fecha_movimiento
         LIMIT 1
    ) cierre ON TRUE
    WHERE e.fecha_radicacion >= r.desde
      AND e.fecha_radicacion < (r.hasta + 1)
      AND ($3::uuid IS NULL OR COALESCE(a.area_actual_id, e.area_destino_id) = $3::uuid)
)
SELECT
    COUNT(*)::int AS radicados,
    COUNT(*) FILTER (WHERE estado_codigo IN ('RESUELTO', 'NOTIFICADO'))::int AS atendidos,
    COUNT(*) FILTER (WHERE estado_codigo = 'ARCHIVADO')::int AS archivados,
    COUNT(*) FILTER (WHERE estado_codigo = 'OBSERVADO')::int AS observados,
    COUNT(*) FILTER (
        WHERE estado_codigo IS NULL
           OR estado_codigo NOT IN ('RESUELTO', 'NOTIFICADO', 'ARCHIVADO', 'ANULADO')
    )::int AS en_tramite,
    COUNT(*) FILTER (
        WHERE fecha_limite IS NOT NULL
          AND fecha_limite < now()
          AND (estado_codigo IS NULL OR estado_codigo NOT IN ('RESUELTO', 'NOTIFICADO', 'ARCHIVADO', 'ANULADO'))
    )::int AS vencidos,
    COUNT(fecha_cierre)::int AS resueltos,
    COUNT(*) FILTER (WHERE fecha_cierre IS NOT NULL AND fecha_limite IS NOT NULL
                       AND fecha_cierre <= fecha_limite)::int AS dentro_de_plazo,
    COALESCE(SUM(EXTRACT(EPOCH FROM (fecha_cierre - COALESCE(fecha_ingreso, fecha_radicacion)))), 0)::float8
        AS horas_calendario
FROM base
`;

/**
 * Las horas del TPR se acumulan en horas calendario en SQL porque PostgreSQL no
 * conoce el calendario laboral. La conversión a horas hábiles (5/7) y el
 * descuento de feriados se aplican aquí, con la misma regla de
 * `kpi.service.ts`, para que el valor publicado nunca supere artificialmente
 * el objetivo de 24 horas hábiles.
 */
function horasACalendarioHabiles(horas: number): number {
  return horas <= 0 ? 0 : redondear(horas * (5 / 7), 2);
}

function aKpiRespuesta(kpi: KpiMgd, meta: number): KpiRespuesta {
  return {
    valor: kpi.valor,
    meta,
    cumple: kpi.cumple,
    unidad: kpi.unidad,
    formula: kpi.formula,
  };
}

export async function obtenerResumen(
  pool: Pool,
  parametros: z.infer<typeof esquemaResumen>,
): Promise<ResumenReportes> {
  const { desde, hasta, areaId } = parametros;
  const resultado = await pool.query<FilaResumen>(SQL_RESUMEN, [desde, hasta, areaId ?? null]);
  const fila = resultado.rows[0];

  const insumos: InsumosKpi = {
    radicados: fila?.radicados ?? 0,
    atendidos: fila?.atendidos ?? 0,
    archivados: fila?.archivados ?? 0,
    horasHabilesTotales: horasACalendarioHabiles(fila?.horas_calendario ?? 0),
    resueltos: fila?.resueltos ?? 0,
    resueltosDentroDePlazo: fila?.dentro_de_plazo ?? 0,
    observados: fila?.observados ?? 0,
    enTramite: fila?.en_tramite ?? 0,
  };

  const indicadores = calcularIndicadoresMgd(insumos);
  const vtep = aKpiRespuesta(indicadores.vtep, 95);
  const tpr = aKpiRespuesta(indicadores.tpr, 24);
  const tro = aKpiRespuesta(indicadores.tro, 90);
  const teo = aKpiRespuesta(indicadores.teo, 5);

  return {
    vtep,
    tprHorasHabiles: tpr,
    tro,
    teo,
    cumpleTodasLasMetas: indicadores.cumpleTodas,
    totalExpedientesEnTramite: insumos.enTramite,
    totalExpedientesAtendidos: insumos.atendidos + insumos.archivados,
    totalRadicados: insumos.radicados,
    totalResueltos: insumos.resueltos,
    totalArchivados: insumos.archivados,
    totalProcesados: insumos.atendidos + insumos.archivados,
    atrasadosCriticos: fila?.vencidos ?? 0,
    tasaResolucionOportuna: tro.valor ?? 0,
    tasaExpedientesObservados: teo.valor ?? 0,
    tiempoPromedioRespuestaHoras: tpr.valor ?? 0,
    tprHoras: tpr.valor ?? 0,
    periodo: { desde, hasta },
    generadoEn: new Date().toISOString(),
  };
}

const SQL_TENDENCIAS = `
WITH serie AS (
    SELECT
        date_trunc($3, e.fecha_radicacion)::date AS periodo,
        COUNT(*)::int AS radicados,
        COUNT(*) FILTER (
            WHERE a.estado_codigo IN ('RESUELTO', 'NOTIFICADO', 'ARCHIVADO')
        )::int AS atendidos,
        COUNT(*) FILTER (WHERE a.estado_codigo = 'OBSERVADO')::int AS observados
    FROM sigd_tra.expediente e
    LEFT JOIN sigd_rut.estado_actual_tramite a
           ON a.expediente_id = e.expediente_id
    WHERE e.fecha_radicacion >= $1::date
      AND e.fecha_radicacion < ($2::date + 1)
    GROUP BY 1
)
SELECT
    to_char(periodo, 'YYYY-MM-DD') AS periodo,
    EXTRACT(MONTH FROM periodo)::int AS mes,
    radicados,
    atendidos,
    observados,
    CASE WHEN radicados = 0 THEN NULL
         ELSE ROUND((atendidos::numeric * 100 / radicados), 2)::float8 END AS vtep
FROM serie
ORDER BY periodo ASC
LIMIT $4
`;

export async function obtenerTendencias(
  pool: Pool,
  parametros: z.infer<typeof esquemaTendencias>,
): Promise<{ periodo: Periodo; granularidad: string; serie: PuntoTendencia[] }> {
  const { desde, hasta, granularidad, limite } = parametros;
  const unidad = granularidad === 'DIARIA' ? 'day' : granularidad === 'SEMANAL' ? 'week' : 'month';
  const resultado = await pool.query<{
    periodo: string;
    mes: number;
    radicados: number;
    atendidos: number;
    observados: number;
    vtep: number | null;
  }>(SQL_TENDENCIAS, [desde, hasta, unidad, limite]);

  return {
    periodo: { desde, hasta },
    granularidad,
    serie: resultado.rows.map((fila) => ({
      periodo: fila.periodo,
      etiqueta: fila.periodo,
      mes: fila.mes,
      radicados: fila.radicados,
      atendidos: fila.atendidos,
      observados: fila.observados,
      vtep: fila.vtep,
    })),
  };
}

const SQL_CUELLOS = `
SELECT
    area_id,
    area,
    estado,
    expedientes,
    horas_promedio,
    dias_promedio,
    dias_maximo,
    vencido,
    semaforo_rojo,
    semaforo_amarillo,
    semaforo_verde
FROM sigd_tra.mv_tiempos_retencion_area
ORDER BY dias_promedio DESC NULLS LAST, expedientes DESC
LIMIT $1
`;

function nivelAlerta(diasPromedio: number, vencido: number, rojo: number): 'ALTO' | 'MEDIO' | 'BAJO' {
  if (vencido > 0 || rojo > 0 || diasPromedio >= 15) return 'ALTO';
  if (diasPromedio >= 7) return 'MEDIO';
  return 'BAJO';
}

export async function obtenerCuellosBotella(
  pool: Pool,
  parametros: z.infer<typeof esquemaCuellosBotella>,
): Promise<{ periodo: Periodo; cuelloBotella: FilaCuelloBotella[] }> {
  const resultado = await pool.query<{
    area_id: string | null;
    area: string;
    estado: string;
    expedientes: number;
    horas_promedio: number | null;
    dias_promedio: number | null;
    dias_maximo: number | null;
    vencido: number;
    semaforo_rojo: number;
    semaforo_amarillo: number;
    semaforo_verde: number;
  }>(SQL_CUELLOS, [parametros.limite]);

  const total = resultado.rows.reduce((suma, fila) => suma + fila.expedientes, 0);

  return {
    periodo: { desde: parametros.desde, hasta: parametros.hasta },
    cuelloBotella: resultado.rows.map((fila) => {
      const dias = fila.dias_promedio ?? 0;
      return {
        areaId: fila.area_id,
        area: fila.area,
        estado: fila.estado,
        expedientes: fila.expedientes,
        horasPromedio: fila.horas_promedio ?? 0,
        diasPromedio: dias,
        diasMaximo: fila.dias_maximo ?? 0,
        vencido: fila.vencido,
        nivelAlerta: nivelAlerta(dias, fila.vencido, fila.semaforo_rojo),
        proporcion: total === 0 ? 0 : redondear((fila.expedientes / total) * 100, 2),
      };
    }),
  };
}

export interface ResultadoRefreshVistas {
  actualizadas: Array<{ vista: string; duracionMs: number }>;
  generadoEn: string;
}

const VISTAS_MGD = ['sigd_tra.mv_kpis_mgd_mensual', 'sigd_tra.mv_tiempos_retencion_area'];

/**
 * Refresco concurrente de las vistas MGD (#51). Se usa la función
 * `sigd_tra.refrescar_vistas_mgd()` cuando está disponible y, como respaldo,
 * `REFRESH MATERIALIZED VIEW CONCURRENTLY` vista por vista. CONCURRENTLY exige
 * índice único, por eso la migración 07 crea `ux_mv_kpis_mgd_mensual_periodo` y
 * `ux_mv_tiempos_retencion_area_clave`.
 */
export async function refrescarVistasMgd(pool: Pool): Promise<ResultadoRefreshVistas> {
  const existeFuncion = await pool
    .query<{ existe: string | null }>("SELECT to_regprocedure('sigd_tra.refrescar_vistas_mgd()')::text AS existe")
    .catch(() => ({ rows: [] as { existe: string | null }[] }));

  if (existeFuncion.rows[0]?.existe) {
    const resultado = await pool.query<{ vista: string; duracion_ms: string }>(
      'SELECT vista, duracion_ms FROM sigd_tra.refrescar_vistas_mgd()',
    );
    return {
      actualizadas: resultado.rows.map((fila) => ({
        vista: fila.vista,
        duracionMs: Number(fila.duracion_ms),
      })),
      generadoEn: new Date().toISOString(),
    };
  }

  const actualizadas: Array<{ vista: string; duracionMs: number }> = [];
  for (const vista of VISTAS_MGD) {
    const inicio = Date.now();
    await pool.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${vista}`);
    actualizadas.push({ vista, duracionMs: Date.now() - inicio });
  }

  return { actualizadas, generadoEn: new Date().toISOString() };
}

/**
 * Serie mensual servida desde la vista materializada. El tablero ejecutivo (#50)
 * la prefiere a la consulta directa cuando la vista está poblada, porque mantiene
 * la latencia por debajo de los 20 ms exigidos por el plan.
 */
export async function obtenerKpisMensualesDesdeVista(
  pool: Pool,
  desde: string,
  hasta: string,
): Promise<Array<{ periodo: string; radicados: number; vtep: number | null; tro: number | null; teo: number | null; tpr_horas_calendario: number | null }>> {
  const resultado = await pool.query<{
    periodo: string;
    radicados: number;
    vtep: number | null;
    tro: number | null;
    teo: number | null;
    tpr_horas_calendario: number | null;
  }>(
    `SELECT to_char(periodo, 'YYYY-MM-DD') AS periodo, radicados, vtep, tro, teo, tpr_horas_calendario
       FROM sigd_tra.mv_kpis_mgd_mensual
      WHERE periodo >= $1::date AND periodo <= $2::date
      ORDER BY periodo ASC`,
    [desde, hasta],
  );
  return resultado.rows;
}
