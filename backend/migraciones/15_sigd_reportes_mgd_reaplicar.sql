-- =============================================================================
-- Migración 15 · Reaplicación idempotente del contrato analítico MGD
-- -----------------------------------------------------------------------------
-- La migración 14 reconcilia las vistas con `mgdAnalytics.repository.ts`. Si una
-- instalación ya registró 14 pero las vistas siguen siendo las de la migración 07
-- (por un reinicio incompleto o una dependencia al hacer DROP), el runner no vuelve
-- a ejecutar 14 y el tablero sigue respondiendo 500. Este script reconstruye ambas
-- vistas desde cero con el MISMO contrato y puede aplicarse aunque 14 ya esté
-- registrada.
-- =============================================================================

DROP MATERIALIZED VIEW IF EXISTS sigd_tra.mv_tiempos_retencion_area CASCADE;
DROP MATERIALIZED VIEW IF EXISTS sigd_tra.mv_kpis_mgd_mensual CASCADE;
DROP VIEW IF EXISTS sigd_tra.vw_mgd_expediente_base CASCADE;
DROP FUNCTION IF EXISTS sigd_tra.fn_mgd_horas_habiles(TIMESTAMPTZ, TIMESTAMPTZ, DATE[]);
DROP FUNCTION IF EXISTS sigd_tra.fn_mgd_dias_habiles_entre(TIMESTAMPTZ, TIMESTAMPTZ, DATE[]);

CREATE OR REPLACE FUNCTION sigd_tra.fn_mgd_horas_habiles(
    p_desde TIMESTAMPTZ,
    p_hasta TIMESTAMPTZ,
    p_feriados DATE[] DEFAULT ARRAY[]::DATE[]
)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $fn$
    WITH dias AS (
        SELECT g.d::date AS dia
          FROM generate_series(
                   (p_desde AT TIME ZONE INTERVAL '-05:00' HOUR TO MINUTE)::date,
                   (p_hasta AT TIME ZONE INTERVAL '-05:00' HOUR TO MINUTE)::date,
                   INTERVAL '1 day'
               ) AS g(d)
         WHERE p_desde IS NOT NULL
           AND p_hasta IS NOT NULL
           AND p_hasta > p_desde
    ),
    habiles AS (
        SELECT d.dia
          FROM dias d
         WHERE EXTRACT(ISODOW FROM d.dia) <= 5
           AND NOT (d.dia = ANY (COALESCE(p_feriados, ARRAY[]::DATE[])))
    ),
    ventanas AS (
        SELECT (h.dia::timestamp + TIME '08:00')
                   AT TIME ZONE INTERVAL '-05:00' HOUR TO MINUTE AS apertura,
               (h.dia::timestamp + TIME '16:30')
                   AT TIME ZONE INTERVAL '-05:00' HOUR TO MINUTE AS cierre
          FROM habiles h
    )
    SELECT COALESCE(ROUND(SUM(
               GREATEST(0, EXTRACT(EPOCH FROM (
                   LEAST(v.cierre, p_hasta) - GREATEST(v.apertura, p_desde)
               )) / 3600.0)
           )::NUMERIC, 4), 0)
      FROM ventanas v;
$fn$;

CREATE OR REPLACE FUNCTION sigd_tra.fn_mgd_dias_habiles_entre(
    p_desde TIMESTAMPTZ,
    p_hasta TIMESTAMPTZ,
    p_feriados DATE[] DEFAULT ARRAY[]::DATE[]
)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $fn$
    SELECT COUNT(*)::NUMERIC
      FROM generate_series(
               (p_desde AT TIME ZONE INTERVAL '-05:00' HOUR TO MINUTE)::date + 1,
               (p_hasta AT TIME ZONE INTERVAL '-05:00' HOUR TO MINUTE)::date,
               INTERVAL '1 day'
           ) AS g(d)
     WHERE p_desde IS NOT NULL
       AND p_hasta IS NOT NULL
       AND EXTRACT(ISODOW FROM g.d::date) <= 5
       AND NOT (g.d::date = ANY (COALESCE(p_feriados, ARRAY[]::DATE[])));
$fn$;

CREATE VIEW sigd_tra.vw_mgd_expediente_base AS
WITH feriados AS (
    SELECT COALESCE(array_agg(c.fecha), ARRAY[]::DATE[]) AS dias
      FROM sigd_org.calendario_laboral c
     WHERE c.es_feriado
       AND c.activo
),
corte AS (
    SELECT CURRENT_TIMESTAMP AS instante
),
radicaciones AS (
    SELECT e.expediente_id,
           e.codigo_expediente,
           date_trunc('month',
               e.fecha_radicacion AT TIME ZONE INTERVAL '-05:00' HOUR TO MINUTE)::date AS periodo,
           COALESCE(NULLIF(a.area_actual_id::text, ''), e.area_destino_id::text, 'SIN_AREA') AS unidad_organica_id,
           COALESCE(NULLIF(btrim(a.estado_nuevo), ''), 'REGISTRADO') AS estado_actual,
           COALESCE(
               sigd_rut.pestana_de_estado(
                   COALESCE(NULLIF(btrim(a.estado_nuevo), ''), 'REGISTRADO')),
               'PENDIENTES'
           ) AS pestana,
           COALESCE(asiento.fecha_ingreso, e.fecha_radicacion) AS fecha_radicacion
      FROM sigd_tra.expediente e
      LEFT JOIN sigd_rut.estado_actual_expediente a
        ON a.expediente_id = e.expediente_id
      LEFT JOIN LATERAL (
          SELECT MIN(ar.fecha_ingreso) AS fecha_ingreso
            FROM sigd_tra.asiento_registro ar
           WHERE ar.expediente_id = e.expediente_id
             AND NOT ar.anulado
      ) AS asiento ON TRUE
),
resoluciones AS (
    SELECT m.expediente_id,
           MIN(m.fecha_hora) AS fecha_resolucion
      FROM sigd_rut.movimiento_tramite m
     WHERE m.estado_nuevo IN ('RESUELTO', 'ARCHIVADO')
     GROUP BY m.expediente_id
),
base AS (
    SELECT r.expediente_id,
           r.codigo_expediente,
           r.periodo,
           r.unidad_organica_id,
           r.estado_actual,
           r.pestana,
           r.fecha_radicacion,
           res.fecha_resolucion,
           COALESCE(res.fecha_resolucion, c.instante) AS fecha_corte,
           (r.estado_actual IN ('RESUELTO', 'ARCHIVADO')) AS es_resuelto,
           (r.estado_actual = 'ARCHIVADO') AS es_archivado,
           (r.estado_actual = 'OBSERVADO') AS es_observado,
           (r.pestana = 'EN_TRAMITE') AS es_en_tramite
      FROM radicaciones r
      CROSS JOIN corte c
      LEFT JOIN resoluciones res
        ON res.expediente_id = r.expediente_id
)
SELECT b.expediente_id,
       b.codigo_expediente,
       b.periodo,
       b.unidad_organica_id,
       b.estado_actual,
       b.pestana,
       b.fecha_radicacion,
       b.fecha_resolucion,
       b.es_resuelto,
       b.es_archivado,
       b.es_observado,
       b.es_en_tramite,
       sigd_tra.fn_mgd_horas_habiles(b.fecha_radicacion, b.fecha_corte, f.dias)
           AS horas_habiles_atencion,
       sigd_tra.fn_mgd_dias_habiles_entre(b.fecha_radicacion, b.fecha_corte, f.dias)
           AS dias_habiles_permanencia
  FROM base b
  CROSS JOIN feriados f;

CREATE MATERIALIZED VIEW sigd_tra.mv_kpis_mgd_mensual AS
SELECT b.periodo,
       b.unidad_organica_id,
       CURRENT_TIMESTAMP AS actualizado_en,
       COUNT(*)::BIGINT AS n_radicados,
       COUNT(*) FILTER (WHERE b.estado_actual = 'RESUELTO')::BIGINT AS n_atendidos,
       COUNT(*) FILTER (WHERE b.es_archivado)::BIGINT AS n_archivados,
       COUNT(*) FILTER (WHERE b.es_resuelto)::BIGINT AS n_resueltos,
       COUNT(*) FILTER (WHERE b.es_en_tramite)::BIGINT AS n_en_tramite,
       COUNT(*) FILTER (WHERE b.es_observado)::BIGINT AS n_observados,
       COUNT(*) FILTER (
           WHERE b.es_resuelto AND b.dias_habiles_permanencia <= 30
       )::BIGINT AS n_resueltos_dentro_plazo,
       COALESCE(SUM(b.horas_habiles_atencion) FILTER (WHERE b.es_resuelto), 0)
           AS horas_habiles_suma,
       ROUND(COALESCE(
           (COUNT(*) FILTER (WHERE b.estado_actual = 'RESUELTO')
            + COUNT(*) FILTER (WHERE b.es_archivado))::NUMERIC
               / NULLIF(COUNT(*), 0) * 100, 0), 2) AS vtep_porcentaje,
       ROUND(COALESCE(
           SUM(b.horas_habiles_atencion) FILTER (WHERE b.es_resuelto)
               / NULLIF(COUNT(*) FILTER (WHERE b.es_resuelto), 0), 0), 2)
           AS tpr_horas_habiles,
       ROUND(COALESCE(
           COUNT(*) FILTER (
               WHERE b.es_resuelto AND b.dias_habiles_permanencia <= 30
           )::NUMERIC / NULLIF(COUNT(*) FILTER (WHERE b.es_resuelto), 0) * 100, 0), 2)
           AS tro_porcentaje,
       ROUND(COALESCE(
           COUNT(*) FILTER (WHERE b.es_observado)::NUMERIC
               / NULLIF(COUNT(*) FILTER (WHERE b.es_en_tramite), 0) * 100, 0), 2)
           AS teo_porcentaje
  FROM sigd_tra.vw_mgd_expediente_base b
 GROUP BY b.periodo, b.unidad_organica_id;

CREATE MATERIALIZED VIEW sigd_tra.mv_tiempos_retencion_area AS
WITH clasificado AS (
    SELECT c.periodo,
           c.unidad_organica_id,
           c.dias_habiles_permanencia,
           c.horas_habiles_atencion,
           CASE
               WHEN c.dias_habiles_permanencia <= 5  THEN '01_00_05'
               WHEN c.dias_habiles_permanencia <= 10 THEN '02_06_10'
               WHEN c.dias_habiles_permanencia <= 15 THEN '03_11_15'
               WHEN c.dias_habiles_permanencia <= 20 THEN '04_16_20'
               WHEN c.dias_habiles_permanencia <= 30 THEN '05_21_30'
               WHEN c.dias_habiles_permanencia <= 45 THEN '06_31_45'
               WHEN c.dias_habiles_permanencia <= 60 THEN '07_46_60'
               ELSE '08_MAS_60'
           END AS tramo_permanencia_dias_habiles
      FROM sigd_tra.vw_mgd_expediente_base c
),
agregado AS (
    SELECT c.periodo,
           c.unidad_organica_id,
           c.tramo_permanencia_dias_habiles,
           COUNT(*)::BIGINT AS n_expedientes,
           AVG(c.dias_habiles_permanencia) AS promedio_dias_habiles_permanencia,
           AVG(c.horas_habiles_atencion) AS promedio_horas_habiles,
           MIN(c.horas_habiles_atencion) AS minimo_horas_habiles,
           MAX(c.horas_habiles_atencion) AS maximo_horas_habiles
      FROM clasificado c
     GROUP BY c.periodo, c.unidad_organica_id, c.tramo_permanencia_dias_habiles
)
SELECT a.periodo,
       a.unidad_organica_id,
       a.tramo_permanencia_dias_habiles,
       CURRENT_TIMESTAMP AS actualizado_en,
       a.n_expedientes,
       ROUND(a.promedio_dias_habiles_permanencia, 4) AS promedio_dias_habiles_permanencia,
       ROUND(a.promedio_horas_habiles, 4) AS promedio_horas_habiles,
       ROUND(a.minimo_horas_habiles, 4) AS minimo_horas_habiles,
       ROUND(a.maximo_horas_habiles, 4) AS maximo_horas_habiles,
       ROUND(COALESCE(
           a.n_expedientes::NUMERIC * 100
               / NULLIF(SUM(a.n_expedientes) OVER (
                   PARTITION BY a.periodo, a.unidad_organica_id), 0), 0), 2)
           AS porcentaje_del_area
  FROM agregado a;

CREATE UNIQUE INDEX uq_mv_kpis_mgd_mensual_reapply
    ON sigd_tra.mv_kpis_mgd_mensual (periodo, unidad_organica_id);

CREATE UNIQUE INDEX uq_mv_tiempos_retencion_area_reapply
    ON sigd_tra.mv_tiempos_retencion_area
       (periodo, unidad_organica_id, tramo_permanencia_dias_habiles);

CREATE INDEX ix_mv_kpis_mgd_mensual_unidad_reapply
    ON sigd_tra.mv_kpis_mgd_mensual (unidad_organica_id, periodo);

CREATE INDEX ix_mv_tiempos_retencion_area_unidad_reapply
    ON sigd_tra.mv_tiempos_retencion_area (unidad_organica_id, periodo);

CREATE OR REPLACE FUNCTION sigd_tra.refrescar_vistas_mgd()
RETURNS TABLE(vista TEXT, duracion_ms NUMERIC)
LANGUAGE plpgsql
AS $$
DECLARE
    v_inicio TIMESTAMPTZ := clock_timestamp();
    v_fin    TIMESTAMPTZ;
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY sigd_tra.mv_kpis_mgd_mensual;
    v_fin := clock_timestamp();
    vista := 'sigd_tra.mv_kpis_mgd_mensual';
    duracion_ms := EXTRACT(EPOCH FROM (v_fin - v_inicio)) * 1000;
    RETURN NEXT;

    v_inicio := clock_timestamp();
    REFRESH MATERIALIZED VIEW CONCURRENTLY sigd_tra.mv_tiempos_retencion_area;
    v_fin := clock_timestamp();
    vista := 'sigd_tra.mv_tiempos_retencion_area';
    duracion_ms := EXTRACT(EPOCH FROM (v_fin - v_inicio)) * 1000;
    RETURN NEXT;
END;
$$;

COMMENT ON MATERIALIZED VIEW sigd_tra.mv_kpis_mgd_mensual IS
    'KPIs MGD-PCM por (periodo, unidad_organica_id). Contrato de mgdAnalytics.repository.ts (reaplicado).';
COMMENT ON MATERIALIZED VIEW sigd_tra.mv_tiempos_retencion_area IS
    'Permanencia en días hábiles por (periodo, unidad_organica_id, tramo) (reaplicado).';
