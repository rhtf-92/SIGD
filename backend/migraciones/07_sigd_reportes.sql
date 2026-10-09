-- Migración 07 · CoreLink · vistas materializadas MGD
-- Usa los contratos ejecutables de 05_sigd_tra.sql y 06_sigd_rut.sql.

CREATE OR REPLACE FUNCTION sigd_tra.fn_mgd_dias_habiles_entre(
    p_desde TIMESTAMPTZ,
    p_hasta TIMESTAMPTZ
)
RETURNS NUMERIC
LANGUAGE sql
STABLE
AS $fn$
    SELECT COALESCE(COUNT(*), 0)::numeric
      FROM generate_series(
             (p_desde AT TIME ZONE 'America/Lima')::date + 1,
             (p_hasta AT TIME ZONE 'America/Lima')::date,
             INTERVAL '1 day'
           ) AS dias(fecha)
     WHERE p_desde IS NOT NULL
       AND p_hasta IS NOT NULL
       AND p_hasta > p_desde
       AND EXTRACT(ISODOW FROM dias.fecha) <= 5
       AND NOT EXISTS (
             SELECT 1
               FROM sigd_org.calendario_laboral calendario
              WHERE calendario.fecha = dias.fecha::date
                AND calendario.es_feriado = TRUE
           );
$fn$;

CREATE MATERIALIZED VIEW IF NOT EXISTS sigd_tra.mv_kpis_mgd_mensual AS
WITH cierre AS (
    SELECT expediente_id, MIN(fecha_hora) AS fecha_cierre
      FROM sigd_rut.movimiento_tramite
     WHERE estado_nuevo IN ('RESUELTO', 'ARCHIVADO')
     GROUP BY expediente_id
), base AS (
    SELECT date_trunc('month', e.fecha_radicacion)::date AS periodo,
           COALESCE(a.area_actual_id, e.area_destino_id::text, 'SIN_AREA') AS unidad_organica_id,
           COALESCE(a.estado_nuevo, e.estado) AS estado,
           e.fecha_radicacion,
           e.fecha_limite,
           c.fecha_cierre
      FROM sigd_tra.expediente e
      LEFT JOIN sigd_rut.estado_actual_expediente a
             ON a.expediente_id = e.expediente_id
      LEFT JOIN cierre c ON c.expediente_id = e.expediente_id
)
SELECT periodo,
       unidad_organica_id,
       MAX(now()) AS actualizado_en,
       COUNT(*)::BIGINT AS n_radicados,
       COUNT(*) FILTER (WHERE estado = 'RESUELTO')::BIGINT AS n_atendidos,
       COUNT(*) FILTER (WHERE estado = 'ARCHIVADO')::BIGINT AS n_archivados,
       COUNT(*) FILTER (WHERE fecha_cierre IS NOT NULL)::BIGINT AS n_resueltos,
       COUNT(*) FILTER (WHERE estado NOT IN ('RESUELTO', 'ARCHIVADO'))::BIGINT AS n_en_tramite,
       COUNT(*) FILTER (WHERE estado = 'OBSERVADO')::BIGINT AS n_observados,
       COUNT(*) FILTER (
           WHERE fecha_cierre IS NOT NULL
             AND fecha_limite IS NOT NULL
             AND fecha_cierre <= fecha_limite
       )::BIGINT AS n_resueltos_dentro_plazo,
       COALESCE(SUM(
           sigd_tra.fn_mgd_dias_habiles_entre(fecha_radicacion, COALESCE(fecha_cierre, now())) * 8.5
       ), 0)::NUMERIC AS horas_habiles_suma
  FROM base
 GROUP BY periodo, unidad_organica_id
WITH DATA;

CREATE MATERIALIZED VIEW IF NOT EXISTS sigd_tra.mv_tiempos_retencion_area AS
WITH cierre AS (
    SELECT expediente_id, MIN(fecha_hora) AS fecha_cierre
      FROM sigd_rut.movimiento_tramite
     WHERE estado_nuevo IN ('RESUELTO', 'ARCHIVADO')
     GROUP BY expediente_id
), base AS (
    SELECT date_trunc('month', e.fecha_radicacion)::date AS periodo,
           COALESCE(a.area_actual_id, e.area_destino_id::text, 'SIN_AREA') AS unidad_organica_id,
           sigd_tra.fn_mgd_dias_habiles_entre(e.fecha_radicacion, COALESCE(c.fecha_cierre, now())) AS dias_habiles
      FROM sigd_tra.expediente e
      LEFT JOIN sigd_rut.estado_actual_expediente a
             ON a.expediente_id = e.expediente_id
      LEFT JOIN cierre c ON c.expediente_id = e.expediente_id
), clasificada AS (
    SELECT periodo,
           unidad_organica_id,
           dias_habiles,
           CASE
             WHEN dias_habiles <= 5 THEN '01_00_05'
             WHEN dias_habiles <= 10 THEN '02_06_10'
             WHEN dias_habiles <= 15 THEN '03_11_15'
             WHEN dias_habiles <= 20 THEN '04_16_20'
             WHEN dias_habiles <= 30 THEN '05_21_30'
             WHEN dias_habiles <= 45 THEN '06_31_45'
             WHEN dias_habiles <= 60 THEN '07_46_60'
             ELSE '08_MAS_60'
           END AS tramo_permanencia_dias_habiles
      FROM base
), agregada AS (
    SELECT periodo,
           unidad_organica_id,
           tramo_permanencia_dias_habiles,
           COUNT(*)::BIGINT AS n_expedientes,
           AVG(dias_habiles)::NUMERIC AS promedio_dias_habiles,
           AVG(dias_habiles * 8.5)::NUMERIC AS promedio_horas_habiles
      FROM clasificada
     GROUP BY periodo, unidad_organica_id, tramo_permanencia_dias_habiles
)
SELECT periodo,
       unidad_organica_id,
       tramo_permanencia_dias_habiles,
       n_expedientes,
       promedio_dias_habiles,
       promedio_horas_habiles,
       ROUND(
           n_expedientes::NUMERIC * 100 /
           NULLIF(SUM(n_expedientes) OVER (PARTITION BY periodo, unidad_organica_id), 0),
           2
       ) AS porcentaje_del_area
  FROM agregada
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS uq_mv_kpis_mgd_mensual
    ON sigd_tra.mv_kpis_mgd_mensual (periodo, unidad_organica_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mv_tiempos_retencion_area
    ON sigd_tra.mv_tiempos_retencion_area
       (periodo, unidad_organica_id, tramo_permanencia_dias_habiles);
