import type { Pool } from 'pg';
import { z } from 'zod';
import { calcularSla } from '../../domains/rutadoc/sla.service.js';
import { calendarioLaboralPredeterminadoRutaDoc } from '../../domains/rutadoc/sla.calendario.js';
import {
  calcularIndicadoresMgd,
  horasHabilesEntre,
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
  horas_calendario: number | null;
  duraciones: Array<{ inicio: string; cierre: string }> | null;
}

const SQL_BASE_RESUMEN = `
WITH rango AS (
    SELECT $1::date AS desde, $2::date AS hasta
),
base AS (
    SELECT
        e.expediente_id,
        e.fecha_radicacion,
        e.fecha_limite,
        a.estado_nuevo AS estado_codigo,
        a.area_actual_id,
        ar.fecha_ingreso,
        cierre.fecha_cierre
    FROM sigd_tra.expediente e
    CROSS JOIN rango r
    LEFT JOIN sigd_rut.estado_actual_expediente a
           ON a.expediente_id = e.expediente_id
    LEFT JOIN LATERAL (
        SELECT MIN(fecha_ingreso) AS fecha_ingreso
          FROM sigd_tra.asiento_registro
         WHERE expediente_id = e.expediente_id AND NOT anulado
    ) ar ON TRUE
    LEFT JOIN LATERAL (
        SELECT MIN(m.fecha_hora) AS fecha_cierre
          FROM (
            SELECT expediente_id, fecha_hora, estado_nuevo FROM sigd_rut.movimiento_tramite
            UNION ALL
            SELECT expediente_id, fecha_hora, estado_nuevo FROM sigd_rut.movimiento_compensatorio
          ) m
         WHERE m.expediente_id = e.expediente_id
           AND m.estado_nuevo IN ('RESUELTO', 'ARCHIVADO')
    ) cierre ON TRUE
    WHERE e.fecha_radicacion >= r.desde
      AND e.fecha_radicacion < (r.hasta + 1)
      AND ($3::uuid IS NULL OR COALESCE(a.area_actual_id, e.area_destino_id::text) = $3::text)
)
`;

const SQL_RESUMEN = `${SQL_BASE_RESUMEN}
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
    (SUM(EXTRACT(EPOCH FROM (fecha_cierre - COALESCE(fecha_ingreso, fecha_radicacion)))) / 3600)::float8
        AS horas_calendario,
    JSON_AGG(JSON_BUILD_OBJECT('inicio', COALESCE(fecha_ingreso, fecha_radicacion),
                               'cierre', fecha_cierre)) FILTER (WHERE fecha_cierre IS NOT NULL)
        AS duraciones
FROM base
`;

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
  const horasHabilesTotales = (fila?.duraciones ?? []).reduce((suma, duracion) => {
    const inicio = new Date(duracion.inicio);
    const cierre = new Date(duracion.cierre);
    if (!Number.isFinite(inicio.getTime()) || !Number.isFinite(cierre.getTime()) || cierre < inicio) {
      throw new Error('El historial de cierres contiene fechas incompatibles con el inicio del expediente.');
    }
    return suma + horasHabilesEntre(inicio, cierre);
  }, 0);

  const insumos: InsumosKpi = {
    radicados: fila?.radicados ?? 0,
    atendidos: fila?.atendidos ?? 0,
    archivados: fila?.archivados ?? 0,
    horasHabilesTotales,
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
            WHERE a.estado_nuevo IN ('RESUELTO', 'NOTIFICADO', 'ARCHIVADO')
        )::int AS atendidos,
        COUNT(*) FILTER (WHERE a.estado_nuevo = 'OBSERVADO')::int AS observados
    FROM sigd_tra.expediente e
    LEFT JOIN sigd_rut.estado_actual_expediente a
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

interface FilaCuelloFisica {
  expediente_id: string;
  area_id: string | null;
  area: string | null;
  estado: string;
  fecha_estado: Date;
  fecha_inicio: Date;
}

const SQL_CUELLOS = `
SELECT e.expediente_id::text,
       COALESCE(a.area_actual_id, e.area_destino_id::text) AS area_id,
       ar.nombre AS area,
       COALESCE(a.estado_nuevo, 'REGISTRADO') AS estado,
       COALESCE(a.fecha_hora, e.fecha_radicacion) AS fecha_estado,
       e.fecha_radicacion AS fecha_inicio
  FROM sigd_tra.expediente e
  LEFT JOIN sigd_rut.estado_actual_expediente a ON a.expediente_id = e.expediente_id
  LEFT JOIN sigd_org.area ar
    ON ar.area_id::text = COALESCE(a.area_actual_id, e.area_destino_id::text)
 WHERE e.fecha_radicacion >= $1::date
   AND e.fecha_radicacion < ($2::date + 1)
   AND COALESCE(a.estado_nuevo, 'REGISTRADO') NOT IN ('RESUELTO', 'NOTIFICADO', 'ARCHIVADO', 'ANULADO')
 ORDER BY e.expediente_id`;

function fechaCivilLima(fecha: Date): string {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima',
    year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(fecha);
  const parte = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? '';
  return `${parte('year')}-${parte('month')}-${parte('day')}`;
}

export async function obtenerCuellosBotella(
  pool: Pool,
  parametros: z.infer<typeof esquemaCuellosBotella>,
): Promise<{ periodo: Periodo; cuelloBotella: FilaCuelloBotella[] }> {
  const resultado = await pool.query<FilaCuelloFisica>(SQL_CUELLOS, [parametros.desde, parametros.hasta]);
  const ahora = new Date();
  const hoy = fechaCivilLima(ahora);
  const fechasInicio = resultado.rows.map((fila) => fechaCivilLima(fila.fecha_inicio));
  const noLaborables = new Set(await calendarioLaboralPredeterminadoRutaDoc.obtenerDiasNoLaborables(
    fechasInicio.reduce((menor, fecha) => fecha < menor ? fecha : menor, hoy), hoy));
  const grupos = new Map<string, { areaId: string | null; area: string; estado: string;
    expedientes: number; horasTotales: number; horasMaximas: number; vencido: number;
    alerta: 'ALTO' | 'MEDIO' | 'BAJO' }>();
  for (const fila of resultado.rows) {
    const inicio = fechaCivilLima(fila.fecha_inicio);
    if (fila.fecha_estado > ahora || inicio > hoy) {
      throw new Error('El expediente contiene fechas posteriores al instante de consulta.');
    }
    const sla = calcularSla({ fechaInicio: inicio, fechaActual: hoy, diasNoLaborables: noLaborables });
    const horas = (ahora.getTime() - fila.fecha_estado.getTime()) / 3_600_000;
    const clave = JSON.stringify([fila.area_id, fila.estado]);
    const grupo = grupos.get(clave) ?? { areaId: fila.area_id, area: fila.area ?? fila.area_id ?? 'Sin área asignada',
      estado: fila.estado, expedientes: 0, horasTotales: 0, horasMaximas: 0, vencido: 0, alerta: 'BAJO' };
    grupo.expedientes++;
    grupo.horasTotales += horas;
    grupo.horasMaximas = Math.max(grupo.horasMaximas, horas);
    if (sla.estado === 'ROJO') {
      grupo.vencido++;
      grupo.alerta = 'ALTO';
    } else if (sla.estado === 'AMARILLO' && grupo.alerta !== 'ALTO') {
      grupo.alerta = 'MEDIO';
    }
    grupos.set(clave, grupo);
  }
  const ordenados = [...grupos.values()].sort((a, b) =>
    b.horasTotales / b.expedientes - a.horasTotales / a.expedientes ||
    b.expedientes - a.expedientes ||
    (a.areaId ?? '').localeCompare(b.areaId ?? '') || a.estado.localeCompare(b.estado))
    .slice(0, parametros.limite);
  const total = ordenados.reduce((suma, grupo) => suma + grupo.expedientes, 0);

  return {
    periodo: { desde: parametros.desde, hasta: parametros.hasta },
    cuelloBotella: ordenados.map((grupo) => ({
      areaId: grupo.areaId,
      area: grupo.area,
      estado: grupo.estado,
      expedientes: grupo.expedientes,
      horasPromedio: redondear(grupo.horasTotales / grupo.expedientes, 2),
      diasPromedio: redondear(grupo.horasTotales / grupo.expedientes / 24, 2),
      diasMaximo: redondear(grupo.horasMaximas / 24, 2),
      vencido: grupo.vencido,
      nivelAlerta: grupo.alerta,
      proporcion: total === 0 ? 0 : redondear((grupo.expedientes / total) * 100, 2),
    })),
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
    `WITH mensual AS (
       SELECT periodo,
              SUM(n_radicados)::int AS radicados,
              SUM(n_atendidos)::int AS atendidos,
              SUM(n_archivados)::int AS archivados,
              SUM(n_resueltos)::int AS resueltos,
              SUM(n_resueltos_dentro_plazo)::int AS dentro_plazo,
              SUM(n_observados)::int AS observados,
              SUM(n_en_tramite)::int AS en_tramite
         FROM sigd_tra.mv_kpis_mgd_mensual
        WHERE periodo >= $1::date AND periodo <= $2::date
        GROUP BY periodo
     ), cierres AS (
       SELECT date_trunc('month', e.fecha_radicacion)::date AS periodo,
              COALESCE(ingreso.fecha_inicio, e.fecha_radicacion) AS inicio,
              cierre.fecha_cierre
         FROM sigd_tra.expediente e
         LEFT JOIN LATERAL (
           SELECT MIN(fecha_ingreso) AS fecha_inicio
             FROM sigd_tra.asiento_registro
            WHERE expediente_id = e.expediente_id AND NOT anulado
         ) ingreso ON TRUE
         LEFT JOIN LATERAL (
           SELECT MIN(m.fecha_hora) AS fecha_cierre
             FROM (
               SELECT expediente_id, fecha_hora, estado_nuevo FROM sigd_rut.movimiento_tramite
               UNION ALL
               SELECT expediente_id, fecha_hora, estado_nuevo FROM sigd_rut.movimiento_compensatorio
             ) m
            WHERE m.expediente_id = e.expediente_id AND m.estado_nuevo IN ('RESUELTO', 'ARCHIVADO')
         ) cierre ON TRUE
        WHERE e.fecha_radicacion >= date_trunc('month', $1::date)
          AND e.fecha_radicacion < date_trunc('month', $2::date) + INTERVAL '1 month'
     ), calendario AS (
       SELECT periodo,
              SUM(EXTRACT(EPOCH FROM (fecha_cierre - inicio)) / 3600)
                FILTER (WHERE fecha_cierre >= inicio) AS horas,
              COUNT(*) FILTER (WHERE fecha_cierre >= inicio) AS muestras
         FROM cierres GROUP BY periodo
     )
     SELECT to_char(m.periodo, 'YYYY-MM-DD') AS periodo, m.radicados,
            ROUND((m.atendidos + m.archivados)::numeric * 100 / NULLIF(m.radicados, 0), 2)::float8 AS vtep,
            ROUND(m.dentro_plazo::numeric * 100 / NULLIF(m.resueltos, 0), 2)::float8 AS tro,
            ROUND(m.observados::numeric * 100 / NULLIF(m.en_tramite, 0), 2)::float8 AS teo,
            ROUND((c.horas / NULLIF(c.muestras, 0))::numeric, 2)::float8 AS tpr_horas_calendario
       FROM mensual m
       LEFT JOIN calendario c ON c.periodo = m.periodo
      ORDER BY m.periodo ASC`,
    [desde, hasta],
  );
  return resultado.rows;
}
