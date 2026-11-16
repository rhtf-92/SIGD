/**
 * SIGD · IESTP "Suiza" (Pucallpa) — Núcleo 00 CoreLink
 * Motor Analítico MGD-PCM/SEGDI · Repositorio de vistas materializadas.
 *
 * Tarea: T-BE-CL-12 (lectura analítica de alta velocidad) y T-BE-CL-10.
 *
 * Las vistas mensuales siguen siendo la fuente preferida. Si faltan, o el filtro
 * exige fechas diarias, se utiliza su proyecci?n de solo lectura sobre las tablas
 * originales. No se crean vistas ni se ejecutan migraciones al consultar.
 *
 * Todas las consultas son parametrizadas ($1, $2, ...). No hay concatenación de
 * valores de entrada en el SQL, y el refresco usa literales fijos en vez de
 * `EXECUTE` sobre texto armable: un nombre de vista o de índice nunca debe poder
 * venir de una petición HTTP.
 */

import type { Pool, PoolClient, QueryResultRow } from 'pg';
import { AppError } from '../../shared/domain/errors/index.js';
import type { ContadoresMgd, ResultadoRefrescoMgd } from './mgdAnalytics.types.js';

/** Clave de lock consultivo para serializar los refrescos concurrentes. */
const LOCK_REFRESCO_MGD = 827_140_051;

/**
 * Vistas refrescadas por el endpoint administrativo. El orden importa: primero los
 * KPIs y después la retención, para que un refresco interrumpido a medias no deje
 * la retención más nueva que los contadores que la originan.
 */
const VISTAS_REFRESCO = Object.freeze([
  'sigd_tra.mv_kpis_mgd_mensual',
  'sigd_tra.mv_tiempos_retencion_area',
] as const);

/**
 * `pg` entrega los `numeric` como CADENA para no perder precisión. Convertirlos en
 * la frontera evita que un `string` se cuele en las fórmulas y se descubra en un
 * `NaN` dentro del tablero. Un agregado vacío es cero; un valor corrupto hace
 * indisponible la lectura, sin fabricar un indicador.
 */
function aNumero(valor: unknown): number {
  if (valor === null || valor === undefined) return 0;
  const numero = typeof valor === 'number' || typeof valor === 'bigint' ||
    (typeof valor === 'string' && valor.trim() !== '') ? Number(valor) : NaN;
  if (Number.isFinite(numero)) return numero;
  throw new AppError({ status: 503, code: 'REPORTES_VALOR_NO_VALIDO', message: 'La fuente no contiene un valor numérico verificable.' });
}

/** El `periodo` de la vista es `DATE` y llega como `YYYY-MM-DD`. */
function aTextoPeriodo(valor: unknown): string | null {
  if (typeof valor === 'string') return valor.slice(0, 10);
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  return null;
}

interface FilaContadores {
  periodo: string | null;
  actualizado_en: Date | string | null;
  n_radicados: unknown;
  n_atendidos: unknown;
  n_archivados: unknown;
  n_resueltos: unknown;
  n_en_tramite: unknown;
  n_observados: unknown;
  n_resueltos_dentro_plazo: unknown;
  horas_habiles_suma: unknown;
}

interface FilaRetencion {
  unidad_organica_id: string;
  tramo_permanencia_dias_habiles: string;
  n_expedientes: unknown;
  promedio_dias_habiles_permanencia: unknown;
  promedio_horas_habiles: unknown;
  porcentaje_del_area: unknown;
}

export interface ContadoresPeriodo {
  periodo: string | null;
  contadores: ContadoresMgd;
  actualizadoEn: string | null;
}

/**
 * Fila mensual con período garantizado.
 *
 * `obtenerTendencias` filtra por un rango de fechas sobre una columna NOT NULL, así
 * que el período nunca es ausente. Se modela aparte en vez de `string | null` para
 * que el consumidor no tenga que narrowing en un bucle y para que un futuro cambio
 * de la consulta no pueda colar un `null` donde el servicio construye la clave
 * `YYYY-MM` de la serie.
 */
export interface ContadoresMes {
  periodo: string;
  contadores: ContadoresMgd;
  actualizadoEn: string | null;
}

export interface TramoRetencionFila {
  unidadOrganicaId: string;
  tramo: string;
  /** Límite inferior en días hábiles del tramo, para el umbral de estancamiento. */
  limiteInferiorDias: number;
  nExpedientes: number;
  promedioDiasHabiles: number;
  promedioHorasHabiles: number;
  porcentajeDelArea: number;
}

/**
 * Identificadores de tramo y su límite inferior en días hábiles. Es el mismo
 * corte que el `CASE` del script DDL; mantenerlo aquí evita que el endpoint tenga
 * que parsear el identificador (`'01_00_05'`) para decidir si un tramo está por
 * encima del umbral solicitado.
 */
const LIMITE_INFERIOR_POR_TRAMO: Readonly<Record<string, number>> = Object.freeze({
  '01_00_05': 0,
  '02_06_10': 6,
  '03_11_15': 11,
  '04_16_20': 16,
  '05_21_30': 21,
  '06_31_45': 31,
  '07_46_60': 46,
  '08_MAS_60': 61,
});

/**
 * Proyección de contadores crudos.
 *
 * Se piden explícitamente las columnas de auditoría en lugar de `SELECT *`: la
 * forma de la fila es parte del contrato de TypeScript y un `*` cambiaría los
 * tipos en silencio si alguien añadiera una columna a la vista.
 */
const PROYECCION_CONTADORES = `
  SELECT to_char(periodo, 'YYYY-MM')                                   AS periodo,
         actualizado_en,
         n_radicados, n_atendidos, n_archivados, n_resueltos,
         n_en_tramite, n_observados, n_resueltos_dentro_plazo,
         horas_habiles_suma
    FROM sigd_tra.mv_kpis_mgd_mensual`;


/** Read-only projections from institutional script 07, without creating views.
 * The operational source also supports daily filters absent from monthly views. */
export const SQL_KPIS_OPERATIVOS = `WITH feriados AS (
    -- Regla ya implementada en consultarDiasNoLaborables de OrganiCore:
    -- una habilitacion expresa del dia prevalece sobre la marca no laborable.
    SELECT DISTINCT n.fecha
      FROM sigd_org.calendario_laboral n
     WHERE n.activo AND NOT n.es_laborable
       AND NOT EXISTS (
           SELECT 1 FROM sigd_org.calendario_laboral h
            WHERE h.fecha = n.fecha AND h.activo AND h.es_laborable
       )
),
cierre AS (
    -- Una fila por expediente. No volver a contar un cierre compensado.
    SELECT m.expediente_id, MIN(m.fecha_hora) AS fecha_resolucion
      FROM sigd_rut.movimiento_tramite m
     WHERE m.estado_nuevo IN ('RESUELTO', 'ARCHIVADO')
       AND NOT EXISTS (
           SELECT 1 FROM sigd_rut.movimiento_compensatorio c
            WHERE c.movimiento_objetivo_fecha_hora = m.fecha_hora
              AND c.movimiento_objetivo_id = m.id_movimiento
       )
     GROUP BY m.expediente_id
),
base AS MATERIALIZED (
    SELECT e.expediente_id,
           date_trunc('month', e.fecha_radicacion AT TIME ZONE INTERVAL '-05:00' HOUR TO MINUTE)::date AS periodo,
           COALESCE(NULLIF(btrim(a.area_actual_id), ''), 'SIN_AREA') AS unidad_organica_id,
           COALESCE(a.estado_nuevo, 'REGISTRADO') AS estado_actual,
           e.fecha_radicacion,
           c.fecha_resolucion,
           COALESCE(a.estado_nuevo, 'REGISTRADO') IN ('RESUELTO', 'ARCHIVADO') AS es_resuelto,
           CASE WHEN a.estado_nuevo IN ('RESUELTO', 'ARCHIVADO')
                THEN c.fecha_resolucion ELSE GREATEST(e.fecha_radicacion, CURRENT_TIMESTAMP) END AS fecha_corte
      FROM sigd_tra.expediente e
      LEFT JOIN sigd_rut.estado_actual_expediente a USING (expediente_id)
      LEFT JOIN cierre c USING (expediente_id)
     WHERE ($1::date IS NULL OR e.fecha_radicacion >= ($1::date::timestamp AT TIME ZONE 'America/Lima'))
       AND ($2::date IS NULL OR e.fecha_radicacion < (($2::date + 1)::timestamp AT TIME ZONE 'America/Lima'))
       AND ($3::text IS NULL OR a.area_actual_id = $3::text)
),
integridad AS MATERIALIZED (
    -- No fabricar tiempo de respuesta si un estado cerrado carece de historial,
    -- ni aceptar duraciones negativas. 22012 aborta instalacion/refresco.
    SELECT 1 / CASE WHEN EXISTS (
        SELECT 1 FROM base
         WHERE (es_resuelto AND fecha_resolucion IS NULL)
            OR (es_resuelto AND fecha_corte < fecha_radicacion)
    ) THEN 0 ELSE 1 END AS comprobada
),
medido AS (
    SELECT b.*,
           tiempos.dias_habiles_permanencia,
           tiempos.horas_habiles_atencion
      FROM base b
      CROSS JOIN integridad i
      CROSS JOIN LATERAL (
          -- Misma ventana 08:00-16:30 y exclusion de dia inicial para el
          -- conteo de dias de mgdAnalytics.service.ts. Sin funciones nuevas.
          SELECT COUNT(*) FILTER (
                     WHERE d.dia > (b.fecha_radicacion AT TIME ZONE INTERVAL '-05:00' HOUR TO MINUTE)::date
                 )::numeric AS dias_habiles_permanencia,
                 COALESCE(ROUND(SUM(
                     GREATEST(0, EXTRACT(EPOCH FROM (
                         LEAST((d.dia + TIME '16:30') AT TIME ZONE INTERVAL '-05:00' HOUR TO MINUTE, b.fecha_corte)
                         - GREATEST((d.dia + TIME '08:00') AT TIME ZONE INTERVAL '-05:00' HOUR TO MINUTE, b.fecha_radicacion)
                     )) / 3600.0)
                 ), 4), 0)::numeric AS horas_habiles_atencion
            FROM (
                -- Serie de fechas sin depender del TimeZone de la sesion.
                SELECT (b.fecha_radicacion AT TIME ZONE INTERVAL '-05:00' HOUR TO MINUTE)::date + g.n AS dia
                  FROM generate_series(
                      0,
                      (b.fecha_corte AT TIME ZONE INTERVAL '-05:00' HOUR TO MINUTE)::date
                      - (b.fecha_radicacion AT TIME ZONE INTERVAL '-05:00' HOUR TO MINUTE)::date
                  ) AS g(n)
            ) d
           WHERE EXTRACT(ISODOW FROM d.dia) <= 5
             AND NOT EXISTS (SELECT 1 FROM feriados f WHERE f.fecha = d.dia)
      ) tiempos
     WHERE i.comprobada = 1
)
SELECT periodo,
       unidad_organica_id,
       CURRENT_TIMESTAMP AS actualizado_en,
       COUNT(*)::bigint AS n_radicados,
       COUNT(*) FILTER (WHERE estado_actual = 'RESUELTO')::bigint AS n_atendidos,
       COUNT(*) FILTER (WHERE estado_actual = 'ARCHIVADO')::bigint AS n_archivados,
       COUNT(*) FILTER (WHERE es_resuelto)::bigint AS n_resueltos,
       -- Misma clasificaci?n de EN_TRAMITE que pestana_de_estado (script 06).
       COUNT(*) FILTER (WHERE estado_actual IN ('EN_REVISION', 'OBSERVADO', 'SUBSANADO'))::bigint AS n_en_tramite,
       COUNT(*) FILTER (WHERE estado_actual = 'OBSERVADO')::bigint AS n_observados,
       COUNT(*) FILTER (WHERE es_resuelto AND dias_habiles_permanencia <= 30)::bigint AS n_resueltos_dentro_plazo,
       COALESCE(SUM(horas_habiles_atencion) FILTER (WHERE es_resuelto), 0)::numeric AS horas_habiles_suma
  FROM medido
 GROUP BY periodo, unidad_organica_id`;
export const SQL_RETENCION_OPERATIVA = `WITH feriados AS (
    -- Regla ya implementada en consultarDiasNoLaborables de OrganiCore:
    -- una habilitacion expresa del dia prevalece sobre la marca no laborable.
    SELECT DISTINCT n.fecha
      FROM sigd_org.calendario_laboral n
     WHERE n.activo AND NOT n.es_laborable
       AND NOT EXISTS (
           SELECT 1 FROM sigd_org.calendario_laboral h
            WHERE h.fecha = n.fecha AND h.activo AND h.es_laborable
       )
),
cierre AS (
    -- Una fila por expediente. No volver a contar un cierre compensado.
    SELECT m.expediente_id, MIN(m.fecha_hora) AS fecha_resolucion
      FROM sigd_rut.movimiento_tramite m
     WHERE m.estado_nuevo IN ('RESUELTO', 'ARCHIVADO')
       AND NOT EXISTS (
           SELECT 1 FROM sigd_rut.movimiento_compensatorio c
            WHERE c.movimiento_objetivo_fecha_hora = m.fecha_hora
              AND c.movimiento_objetivo_id = m.id_movimiento
       )
     GROUP BY m.expediente_id
),
base AS MATERIALIZED (
    SELECT e.expediente_id,
           date_trunc('month', e.fecha_radicacion AT TIME ZONE INTERVAL '-05:00' HOUR TO MINUTE)::date AS periodo,
           COALESCE(NULLIF(btrim(a.area_actual_id), ''), 'SIN_AREA') AS unidad_organica_id,
           COALESCE(a.estado_nuevo, 'REGISTRADO') AS estado_actual,
           e.fecha_radicacion,
           c.fecha_resolucion,
           COALESCE(a.estado_nuevo, 'REGISTRADO') IN ('RESUELTO', 'ARCHIVADO') AS es_resuelto,
           CASE WHEN a.estado_nuevo IN ('RESUELTO', 'ARCHIVADO')
                THEN c.fecha_resolucion ELSE GREATEST(e.fecha_radicacion, CURRENT_TIMESTAMP) END AS fecha_corte
      FROM sigd_tra.expediente e
      LEFT JOIN sigd_rut.estado_actual_expediente a USING (expediente_id)
      LEFT JOIN cierre c USING (expediente_id)
     WHERE ($1::date IS NULL OR e.fecha_radicacion >= ($1::date::timestamp AT TIME ZONE 'America/Lima'))
       AND ($2::date IS NULL OR e.fecha_radicacion < (($2::date + 1)::timestamp AT TIME ZONE 'America/Lima'))
       AND ($3::text IS NULL OR a.area_actual_id = $3::text)
),
integridad AS MATERIALIZED (
    -- No fabricar tiempo de respuesta si un estado cerrado carece de historial,
    -- ni aceptar duraciones negativas. 22012 aborta instalacion/refresco.
    SELECT 1 / CASE WHEN EXISTS (
        SELECT 1 FROM base
         WHERE (es_resuelto AND fecha_resolucion IS NULL)
            OR (es_resuelto AND fecha_corte < fecha_radicacion)
    ) THEN 0 ELSE 1 END AS comprobada
),
medido AS (
    SELECT b.*,
           tiempos.dias_habiles_permanencia,
           tiempos.horas_habiles_atencion
      FROM base b
      CROSS JOIN integridad i
      CROSS JOIN LATERAL (
          -- Misma ventana 08:00-16:30 y exclusion de dia inicial para el
          -- conteo de dias de mgdAnalytics.service.ts. Sin funciones nuevas.
          SELECT COUNT(*) FILTER (
                     WHERE d.dia > (b.fecha_radicacion AT TIME ZONE INTERVAL '-05:00' HOUR TO MINUTE)::date
                 )::numeric AS dias_habiles_permanencia,
                 COALESCE(ROUND(SUM(
                     GREATEST(0, EXTRACT(EPOCH FROM (
                         LEAST((d.dia + TIME '16:30') AT TIME ZONE INTERVAL '-05:00' HOUR TO MINUTE, b.fecha_corte)
                         - GREATEST((d.dia + TIME '08:00') AT TIME ZONE INTERVAL '-05:00' HOUR TO MINUTE, b.fecha_radicacion)
                     )) / 3600.0)
                 ), 4), 0)::numeric AS horas_habiles_atencion
            FROM (
                -- Serie de fechas sin depender del TimeZone de la sesion.
                SELECT (b.fecha_radicacion AT TIME ZONE INTERVAL '-05:00' HOUR TO MINUTE)::date + g.n AS dia
                  FROM generate_series(
                      0,
                      (b.fecha_corte AT TIME ZONE INTERVAL '-05:00' HOUR TO MINUTE)::date
                      - (b.fecha_radicacion AT TIME ZONE INTERVAL '-05:00' HOUR TO MINUTE)::date
                  ) AS g(n)
            ) d
           WHERE EXTRACT(ISODOW FROM d.dia) <= 5
             AND NOT EXISTS (SELECT 1 FROM feriados f WHERE f.fecha = d.dia)
      ) tiempos
     WHERE i.comprobada = 1
),
clasificado AS (
    SELECT m.*,
           CASE
               WHEN dias_habiles_permanencia <= 5 THEN '01_00_05'
               WHEN dias_habiles_permanencia <= 10 THEN '02_06_10'
               WHEN dias_habiles_permanencia <= 15 THEN '03_11_15'
               WHEN dias_habiles_permanencia <= 20 THEN '04_16_20'
               WHEN dias_habiles_permanencia <= 30 THEN '05_21_30'
               WHEN dias_habiles_permanencia <= 45 THEN '06_31_45'
               WHEN dias_habiles_permanencia <= 60 THEN '07_46_60'
               ELSE '08_MAS_60'
           END AS tramo_permanencia_dias_habiles
      FROM medido m
),
agregado AS (
    SELECT periodo, unidad_organica_id, tramo_permanencia_dias_habiles,
           COUNT(*)::bigint AS n_expedientes,
           AVG(dias_habiles_permanencia) AS promedio_dias_habiles_permanencia,
           AVG(horas_habiles_atencion) AS promedio_horas_habiles
      FROM clasificado
     GROUP BY periodo, unidad_organica_id, tramo_permanencia_dias_habiles
)
SELECT periodo, unidad_organica_id, tramo_permanencia_dias_habiles,
       CURRENT_TIMESTAMP AS actualizado_en,
       n_expedientes,
       ROUND(promedio_dias_habiles_permanencia, 4) AS promedio_dias_habiles_permanencia,
       ROUND(promedio_horas_habiles, 4) AS promedio_horas_habiles,
       ROUND(n_expedientes::numeric * 100
             / SUM(n_expedientes) OVER (PARTITION BY periodo, unidad_organica_id), 2) AS porcentaje_del_area
  FROM agregado`;
export interface FiltrosLecturaMgd {
  fechaInicio?: string; fechaFin?: string; unidadOrganicaId?: string;
}

export class RepositorioMgdAnalytics {
  constructor(private readonly pool: Pool) {}

  private async consultarLectura<T extends QueryResultRow>(
    sql: string, valores: unknown[], fuente: 'kpis' | 'retencion', filtros: FiltrosLecturaMgd,
  ) {
    const vista = fuente === 'kpis' ? 'sigd_tra.mv_kpis_mgd_mensual' : 'sigd_tra.mv_tiempos_retencion_area';
    if (!filtros.fechaInicio && !filtros.fechaFin && !filtros.unidadOrganicaId) {
      try { return await this.pool.query<T>(sql, valores); }
      catch (error) {
        const pg = error as { code?: string; message?: string };
        if (pg.code !== '42P01' || !pg.message?.includes(vista.split('.')[1])) throw error;
      }
    }
    const lectura = fuente === 'kpis' ? SQL_KPIS_OPERATIVOS : SQL_RETENCION_OPERATIVA;
    const consulta = sql.replace(/\$(\d+)/g, (_match, n: string) => '$' + (Number(n) + 3))
      .replace(vista, () => '(' + lectura + ') AS mgd_operativo');
    try {
      return await this.pool.query<T>(consulta, [
        filtros.fechaInicio ?? null, filtros.fechaFin ?? null, filtros.unidadOrganicaId ?? null, ...valores,
      ]);
    } catch (error) {
      if (['42P01', '42703', '22012'].includes((error as { code?: string }).code ?? '')) {
        throw new AppError({ status: 503, code: 'REPORTES_FUENTE_NO_DISPONIBLE',
          message: 'No se puede calcular el indicador con las fuentes e historial disponibles.' });
      }
      throw error;
    }
  }


  /**
   * Contadores crudos por (período, área), o consolidados si `periodo` es `null`.
   *
   * Devuelve las filas SIN agregar cuando hay filtro de período, y una sola fila
   * consolidada cuando no lo hay. El servicio decide cuándo sumar varias filas, de
   * modo que la agregación vive en un único lugar y es testeable sin base de datos.
   */
  async obtenerContadores(periodo: string | null, filtros: FiltrosLecturaMgd = {}): Promise<ContadoresPeriodo[]> {
    const sql = periodo === null
      ? `SELECT to_char(MIN(periodo), 'YYYY-MM')     AS periodo,
                MAX(actualizado_en)                 AS actualizado_en,
                SUM(n_radicados)                    AS n_radicados,
                SUM(n_atendidos)                    AS n_atendidos,
                SUM(n_archivados)                   AS n_archivados,
                SUM(n_resueltos)                    AS n_resueltos,
                SUM(n_en_tramite)                   AS n_en_tramite,
                SUM(n_observados)                   AS n_observados,
                SUM(n_resueltos_dentro_plazo)       AS n_resueltos_dentro_plazo,
                SUM(horas_habiles_suma)             AS horas_habiles_suma
           FROM sigd_tra.mv_kpis_mgd_mensual`
      : `${PROYECCION_CONTADORES}
          WHERE periodo = $1::date`;

    const valores = periodo === null ? [] : [periodo + '-01'];
    const { rows } = await this.consultarLectura<FilaContadores>(sql, valores, 'kpis', filtros);
    if (rows.length === 0) return [];
    return rows.map((fila) => ({
      periodo: aTextoPeriodo(fila.periodo),
      actualizadoEn: fila.actualizado_en instanceof Date
        ? fila.actualizado_en.toISOString()
        : typeof fila.actualizado_en === 'string' ? fila.actualizado_en : null,
      contadores: {
        nRadicados: aNumero(fila.n_radicados),
        nAtendidos: aNumero(fila.n_atendidos),
        nArchivados: aNumero(fila.n_archivados),
        nResueltos: aNumero(fila.n_resueltos),
        nEnTramite: aNumero(fila.n_en_tramite),
        nObservados: aNumero(fila.n_observados),
        nResueltosDentroPlazo: aNumero(fila.n_resueltos_dentro_plazo),
        horasHabilesSuma: aNumero(fila.horas_habiles_suma),
      },
    }));
  }

  /** Contadores crudos de los doce meses de un año, para la serie de tendencias. */
  async obtenerTendencias(anio: number, filtros: FiltrosLecturaMgd = {}): Promise<ContadoresMes[]> {
    const { rows } = await this.consultarLectura<FilaContadores>(
      `${PROYECCION_CONTADORES}
        WHERE periodo >= make_date($1, 1, 1)::date
          AND periodo <  (make_date($1, 1, 1) + INTERVAL '1 year')::date
        ORDER BY periodo`,
      [anio], 'kpis', filtros,
    );
    return rows.flatMap((fila): ContadoresMes[] => {
      const periodo = aTextoPeriodo(fila.periodo);
      // `periodo` es NOT NULL en la vista, así que un `null` aquí indica una fila
      // corrupta. Se descarta en vez de inventar un mes: una serie con un mes
      // desplazado es peor que una serie con un mes de menos.
      if (periodo === null) return [];
      return [{
        periodo,
        contadores: {
          nRadicados: aNumero(fila.n_radicados),
          nAtendidos: aNumero(fila.n_atendidos),
          nArchivados: aNumero(fila.n_archivados),
          nResueltos: aNumero(fila.n_resueltos),
          nEnTramite: aNumero(fila.n_en_tramite),
          nObservados: aNumero(fila.n_observados),
          nResueltosDentroPlazo: aNumero(fila.n_resueltos_dentro_plazo),
          horasHabilesSuma: aNumero(fila.horas_habiles_suma),
        },
        actualizadoEn: fila.actualizado_en instanceof Date
          ? fila.actualizado_en.toISOString()
          : typeof fila.actualizado_en === 'string' ? fila.actualizado_en : null,
      }];
    });
  }

  /** Distribución de permanencia por (período, área, tramo). */
  async obtenerRetencion(periodo: string | null, filtros: FiltrosLecturaMgd = {}): Promise<TramoRetencionFila[]> {
    const { rows } = await this.consultarLectura<FilaRetencion>(
      `SELECT unidad_organica_id,
              tramo_permanencia_dias_habiles,
              n_expedientes,
              promedio_dias_habiles_permanencia,
              promedio_horas_habiles,
              porcentaje_del_area
         FROM sigd_tra.mv_tiempos_retencion_area
        WHERE $1::date IS NULL OR periodo = $1::date
        ORDER BY unidad_organica_id, tramo_permanencia_dias_habiles`,
      [periodo ? periodo + '-01' : null], 'retencion', filtros,
    );
    return rows.map((fila) => {
      const tramo = fila.tramo_permanencia_dias_habiles;
      return {
        unidadOrganicaId: fila.unidad_organica_id,
        tramo,
        // Un tramo desconocido se trata como el más bajo: cuenta como vigente y
        // no como estancado, que es la lectura conservadora para un semáforo.
        limiteInferiorDias: LIMITE_INFERIOR_POR_TRAMO[tramo] ?? 0,
        nExpedientes: aNumero(fila.n_expedientes),
        promedioDiasHabiles: aNumero(fila.promedio_dias_habiles_permanencia),
        promedioHorasHabiles: aNumero(fila.promedio_horas_habiles),
        porcentajeDelArea: aNumero(fila.porcentaje_del_area),
      };
    });
  }

  /**
   * Nombres y siglas de las unidades orgánicas, para enriquecer el ranking.
   *
   * `sigd_org.area` NO es un requisito del motor analítico: el preflight
   * del script DDL no lo exige y las vistas no lo necesitan. Por eso la consulta se
   * degrada a un mapa vacío si OrganiCore no está instalado, y el servicio usa
   * entonces el identificador como nombre. Un tablero sin siglas es un defecto
   * cosmético; uno que devuelve 500 porque falta OrganiCore no lo es.
   */
  async obtenerNombresUnidades(): Promise<Map<string, { nombre: string; sigla: string | null }>> {
    const nombres = new Map<string, { nombre: string; sigla: string | null }>();
    try {
      const { rows } = await this.pool.query<{ id: string; sigla: string | null; nombre: string }>(
        `SELECT area_id::text AS id, codigo AS sigla, nombre
           FROM sigd_org.area`,
      );
      for (const fila of rows) {
        nombres.set(fila.id, { nombre: fila.nombre, sigla: fila.sigla });
      }
    } catch {
      // Degradación documentada: sin OrganiCore se conserva el identificador.
    }
    return nombres;
  }

  /**
   * Refresco concurrente de las dos vistas materializadas.
   *
   * PostgreSQL sólo admite UN `REFRESH MATERIALIZED VIEW CONCURRENTLY` por vista a la
   * vez: un segundo refresco simultáneo falla con
   * `ERROR: concurrent refresh is disallowed`. El lock consultivo de sesión
   * (`pg_try_advisory_lock`) lo serializa sin esperar en cola ni devolver 409.
   *
   * El lock se toma y se libera SIEMPRE en la misma conexión, incluso si un refresco
   * lanza: si se filtra, todas las peticiones posteriores de refresco recibirían
   * `refrescoYaEnCurso` y el tablero jamás se actualizaría.
   */
  async refrescarVistasMgd(): Promise<ResultadoRefrescoMgd> {
    const cliente = await this.pool.connect();
    try {
      return await this.refrescarConCliente(cliente);
    } finally {
      cliente.release();
    }
  }

  private async refrescarConCliente(cliente: PoolClient): Promise<ResultadoRefrescoMgd> {
    const inicio = Date.now();
    const { rows: bloqueado } = await cliente.query<{rok: boolean }>(
      'SELECT pg_try_advisory_lock($1) AS rok',
      [LOCK_REFRESCO_MGD],
    );
    if (!bloqueado[0]?.rok) {
      return {
        vistas: [],
        duracionMs: Date.now() - inicio,
        refrescoYaEnCurso: true,
        vistasDisponibles: false,
        mensaje: 'Otro proceso de refresco ya se encuentra en curso.',
      };
    }
    try {
      const vistasRefrescadas: string[] = [];
      const vistasNoEncontradas: string[] = [];
      for (const vista of VISTAS_REFRESCO) {
        try {
          await cliente.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${vista}`);
          vistasRefrescadas.push(vista);
        } catch (err: unknown) {
          if (typeof err === 'object' && err !== null && (err as { code?: string }).code === '42P01') {
            vistasNoEncontradas.push(vista);
            continue;
          }
          throw err;
        }
      }
      const vistasDisponibles = vistasNoEncontradas.length === 0 && vistasRefrescadas.length > 0;
      return {
        vistas: vistasRefrescadas,
        duracionMs: Date.now() - inicio,
        refrescoYaEnCurso: false,
        vistasDisponibles,
        mensaje: vistasDisponibles
          ? 'Vistas materializadas actualizadas exitosamente.'
          : 'Las vistas materializadas no están desplegadas en el esquema; el refresco no se ejecutó y el sistema opera en modo de consulta operativa directa en tiempo real.',
      };
    } finally {
      await cliente.query('SELECT pg_advisory_unlock($1)', [LOCK_REFRESCO_MGD]);
    }
  }
}
