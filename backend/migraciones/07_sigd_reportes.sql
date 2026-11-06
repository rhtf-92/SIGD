-- =============================================================================
-- Migración 07 · BE6 Reportería y Motor Analítico MGD (OE6)
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
-- -----------------------------------------------------------------------------
-- Unifica el motor analítico MGD-PCM oficial (T-BE-CL-10, T-BE-CL-11, T-BE-CL-13)
-- con soporte simultáneo para mgdAnalytics.repository y reportes.service.
-- =============================================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS sigd_tra;
CREATE SCHEMA IF NOT EXISTS sigd_reportes;

-- -----------------------------------------------------------------------------
-- 1. FUNCIÓN: sigd_tra.fn_mgd_horas_habiles(p_desde, p_hasta, p_feriados)
-- Horas hábiles institucionales (America/Lima, 08:00-16:30, sin fin de semana ni feriados)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sigd_tra.fn_mgd_horas_habiles(
    p_desde     TIMESTAMPTZ,
    p_hasta     TIMESTAMPTZ,
    p_feriados  DATE[] DEFAULT ARRAY[]::DATE[]
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

COMMENT ON FUNCTION sigd_tra.fn_mgd_horas_habiles(TIMESTAMPTZ, TIMESTAMPTZ, DATE[]) IS
    'Horas habil institucionales (America/Lima, 08:00-16:30) entre dos instantes.';

-- -----------------------------------------------------------------------------
-- 2. FUNCIÓN: sigd_tra.fn_mgd_dias_habiles_entre(p_desde, p_hasta, p_feriados)
-- Días hábiles de permanencia computados con la regla SLA.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sigd_tra.fn_mgd_dias_habiles_entre(
    p_desde     TIMESTAMPTZ,
    p_hasta     TIMESTAMPTZ,
    p_feriados  DATE[] DEFAULT ARRAY[]::DATE[]
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

COMMENT ON FUNCTION sigd_tra.fn_mgd_dias_habiles_entre(TIMESTAMPTZ, TIMESTAMPTZ, DATE[]) IS
    'Dias habil entre dos instantes; el dia inicial no consume plazo.';

-- -----------------------------------------------------------------------------
-- 3. VISTA ANALÍTICA BASE: sigd_tra.vw_mgd_expediente_base
-- -----------------------------------------------------------------------------
DO $ddl$
DECLARE
    v_feriados TEXT;
BEGIN
    IF to_regclass('sigd_org.calendario_laboral') IS NOT NULL THEN
        v_feriados :=
            '(SELECT COALESCE(array_agg(c.fecha), ARRAY[]::DATE[]) AS dias
                FROM sigd_org.calendario_laboral c
               WHERE c.es_feriado = TRUE)';
    ELSE
        v_feriados := '(SELECT ARRAY[]::DATE[] AS dias)';
    END IF;

    EXECUTE format($q$
        CREATE OR REPLACE VIEW sigd_tra.vw_mgd_expediente_base AS
        WITH feriados AS (
            %s
        ),
        corte AS (
            SELECT CURRENT_TIMESTAMP AS instante
        ),
        radicaciones AS (
            SELECT e.expediente_id,
                   e.codigo_expediente,
                   e.fecha_radicacion,
                   e.fecha_limite,
                   date_trunc('month',
                       e.fecha_radicacion AT TIME ZONE INTERVAL '-05:00' HOUR TO MINUTE)::date
                       AS periodo,
                   COALESCE(NULLIF(btrim(a.area_actual_id), ''), e.area_destino_id::text, 'SIN_AREA')
                       AS unidad_organica_id,
                   COALESCE(NULLIF(btrim(a.estado_nuevo), ''), e.estado, 'REGISTRADO')
                       AS estado_actual,
                   COALESCE(
                       sigd_rut.pestana_de_estado(
                           COALESCE(NULLIF(btrim(a.estado_nuevo), ''), e.estado, 'REGISTRADO')),
                       'PENDIENTES'
                   ) AS pestana
              FROM sigd_tra.expediente e
              LEFT JOIN sigd_rut.estado_actual_expediente a
                ON a.expediente_id::text = e.expediente_id::text
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
                   r.fecha_limite,
                   res.fecha_resolucion,
                   COALESCE(res.fecha_resolucion, c.instante) AS fecha_corte,
                   (r.estado_actual IN ('RESUELTO', 'ARCHIVADO')) AS es_resuelto,
                   (r.estado_actual = 'ARCHIVADO')              AS es_archivado,
                   (r.estado_actual = 'OBSERVADO')             AS es_observado,
                   (r.pestana = 'EN_TRAMITE')                   AS es_en_tramite
              FROM radicaciones r
              CROSS JOIN feriados f
              CROSS JOIN corte c
              LEFT JOIN resoluciones res
                ON res.expediente_id::text = r.expediente_id::text
        )
        SELECT b.expediente_id,
               b.codigo_expediente,
               b.periodo,
               b.unidad_organica_id,
               b.estado_actual,
               b.pestana,
               b.fecha_radicacion,
               b.fecha_limite,
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
          CROSS JOIN feriados f
    $q$, v_feriados);
END;
$ddl$;

-- -----------------------------------------------------------------------------
-- 4. VISTA MATERIALIZADA: sigd_tra.mv_kpis_mgd_mensual
-- -----------------------------------------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS sigd_tra.mv_kpis_mgd_mensual CASCADE;
CREATE MATERIALIZED VIEW sigd_tra.mv_kpis_mgd_mensual AS
SELECT b.periodo,
       b.unidad_organica_id,
       CURRENT_TIMESTAMP                                            AS actualizado_en,
       COUNT(*)::BIGINT                                             AS n_radicados,
       COUNT(*)::INT                                                AS radicados,
       COUNT(*) FILTER (WHERE b.estado_actual = 'RESUELTO')::BIGINT AS n_atendidos,
       COUNT(*) FILTER (WHERE b.estado_actual = 'ARCHIVADO')::BIGINT AS n_archivados,
       COUNT(*) FILTER (WHERE b.es_resuelto)::BIGINT                AS n_resueltos,
       COUNT(*) FILTER (WHERE b.es_en_tramite)::BIGINT              AS n_en_tramite,
       COUNT(*) FILTER (WHERE b.es_observado)::BIGINT               AS n_observados,
       COUNT(*) FILTER (
           WHERE b.es_resuelto
             AND b.dias_habiles_permanencia <= 30
       )::BIGINT                                                    AS n_resueltos_dentro_plazo,
       COALESCE(SUM(b.horas_habiles_atencion) FILTER (WHERE b.es_resuelto), 0)::FLOAT8
                                                                    AS horas_habiles_suma,
       ROUND(COALESCE(
           (COUNT(*) FILTER (WHERE b.estado_actual = 'RESUELTO')
            + COUNT(*) FILTER (WHERE b.estado_actual = 'ARCHIVADO'))::NUMERIC
               / NULLIF(COUNT(*), 0) * 100,
           0), 2)::FLOAT8                                           AS vtep_porcentaje,
       ROUND(COALESCE(
           (COUNT(*) FILTER (WHERE b.estado_actual = 'RESUELTO')
            + COUNT(*) FILTER (WHERE b.estado_actual = 'ARCHIVADO'))::NUMERIC
               / NULLIF(COUNT(*), 0) * 100,
           0), 2)::FLOAT8                                           AS vtep,
       ROUND(COALESCE(
           SUM(b.horas_habiles_atencion) FILTER (WHERE b.es_resuelto)
               / NULLIF(COUNT(*) FILTER (WHERE b.es_resuelto), 0),
           0), 2)::FLOAT8                                           AS tpr_horas_habiles,
       ROUND(COALESCE(
           SUM(b.horas_habiles_atencion) FILTER (WHERE b.es_resuelto)
               / NULLIF(COUNT(*) FILTER (WHERE b.es_resuelto), 0),
           0), 2)::FLOAT8                                           AS tpr_horas_calendario,
       ROUND(COALESCE(
           COUNT(*) FILTER (
               WHERE b.es_resuelto
                 AND b.dias_habiles_permanencia <= 30
           )::NUMERIC / NULLIF(COUNT(*) FILTER (WHERE b.es_resuelto), 0) * 100,
           0), 2)::FLOAT8                                           AS tro_porcentaje,
       ROUND(COALESCE(
           COUNT(*) FILTER (
               WHERE b.es_resuelto
                 AND b.dias_habiles_permanencia <= 30
           )::NUMERIC / NULLIF(COUNT(*) FILTER (WHERE b.es_resuelto), 0) * 100,
           0), 2)::FLOAT8                                           AS tro,
       ROUND(COALESCE(
           COUNT(*) FILTER (WHERE b.es_observado)::NUMERIC
               / NULLIF(COUNT(*) FILTER (WHERE b.es_en_tramite), 0) * 100,
           0), 2)::FLOAT8                                           AS teo_porcentaje,
       ROUND(COALESCE(
           COUNT(*) FILTER (WHERE b.es_observado)::NUMERIC
               / NULLIF(COUNT(*) FILTER (WHERE b.es_en_tramite), 0) * 100,
           0), 2)::FLOAT8                                           AS teo
  FROM sigd_tra.vw_mgd_expediente_base b
 GROUP BY b.periodo, b.unidad_organica_id
 WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS uq_mv_kpis_mgd_mensual
    ON sigd_tra.mv_kpis_mgd_mensual (periodo, unidad_organica_id);

CREATE INDEX IF NOT EXISTS ix_mv_kpis_mgd_mensual_unidad
    ON sigd_tra.mv_kpis_mgd_mensual (unidad_organica_id, periodo);

-- -----------------------------------------------------------------------------
-- 5. VISTA MATERIALIZADA: sigd_tra.mv_tiempos_retencion_area
-- -----------------------------------------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS sigd_tra.mv_tiempos_retencion_area CASCADE;
CREATE MATERIALIZED VIEW sigd_tra.mv_tiempos_retencion_area AS
WITH clasificado AS (
    SELECT c.periodo,
           c.unidad_organica_id,
           c.estado_actual,
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
           COUNT(*)::BIGINT              AS n_expedientes,
           AVG(c.dias_habiles_permanencia) AS promedio_dias_habiles_permanencia,
           AVG(c.horas_habiles_atencion) AS promedio_horas_habiles,
           MIN(c.horas_habiles_atencion) AS minimo_horas_habiles,
           MAX(c.horas_habiles_atencion) AS maximo_horas_habiles
      FROM clasificado c
     GROUP BY c.periodo, c.unidad_organica_id, c.tramo_permanencia_dias_habiles
)
SELECT a.periodo,
       a.unidad_organica_id,
       a.unidad_organica_id                         AS area_id,
       COALESCE(ar.nombre, a.unidad_organica_id)   AS area,
       'EN_TRAMITE'::text                           AS estado,
       a.tramo_permanencia_dias_habiles,
       CURRENT_TIMESTAMP                            AS actualizado_en,
       a.n_expedientes,
       a.n_expedientes::int                         AS expedientes,
       ROUND(a.promedio_dias_habiles_permanencia, 4)::float8 AS promedio_dias_habiles_permanencia,
       ROUND(a.promedio_dias_habiles_permanencia, 2)::float8 AS dias_promedio,
       ROUND(a.promedio_horas_habiles, 4)::float8   AS promedio_horas_habiles,
       ROUND(a.promedio_horas_habiles, 2)::float8   AS horas_promedio,
       ROUND(a.minimo_horas_habiles, 4)::float8     AS minimo_horas_habiles,
       ROUND(a.maximo_horas_habiles, 4)::float8     AS maximo_horas_habiles,
       ROUND(a.maximo_horas_habiles / 8.5, 2)::float8 AS dias_maximo,
       0::int                                       AS vencido,
       0::int                                       AS vencidos,
       0::int                                       AS semaforo_rojo,
       0::int                                       AS semaforo_amarillo,
       a.n_expedientes::int                         AS semaforo_verde,
       ROUND(COALESCE(
           a.n_expedientes::NUMERIC * 100
               / NULLIF(SUM(a.n_expedientes) OVER (
                   PARTITION BY a.periodo, a.unidad_organica_id), 0),
           0), 2)::float8                           AS porcentaje_del_area
  FROM agregado a
  LEFT JOIN sigd_org.area ar
    ON ar.area_id::text = a.unidad_organica_id
  WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS uq_mv_tiempos_retencion_area
    ON sigd_tra.mv_tiempos_retencion_area
       (periodo, unidad_organica_id, tramo_permanencia_dias_habiles);

CREATE INDEX IF NOT EXISTS ix_mv_tiempos_retencion_area_unidad
    ON sigd_tra.mv_tiempos_retencion_area (unidad_organica_id, periodo);

CREATE INDEX IF NOT EXISTS ix_mv_tiempos_retencion_area_dias
    ON sigd_tra.mv_tiempos_retencion_area (dias_promedio DESC);

-- -----------------------------------------------------------------------------
-- 6. Función de refresco concurrente para el endpoint administrativo
-- -----------------------------------------------------------------------------
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

COMMENT ON FUNCTION sigd_tra.refrescar_vistas_mgd() IS
    'Refresco concurrente de las vistas MGD sin bloquear lecturas.';

COMMIT;
