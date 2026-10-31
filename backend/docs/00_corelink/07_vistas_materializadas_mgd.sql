-- Migraci?n 07: contratos UUID de 02/05/06 y columnas de RepositorioMgdAnalytics.
-- Transacci?n controlada por el runner. Ventana h?bil: 08:00-16:30, Lima.
-- Se reutilizan las f?rmulas CoreLink; el cierre se calcula sobre historia normal
-- y compensatoria. Una reapertura vuelve a medir permanencia hasta el refresco.
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
    'Horas habil institucionales (America/Lima, 08:00-16:30, sin sabado, domingo ni feriados) entre dos instantes. NUMERIC con 4 decimales.';

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
    'Dias habil entre dos instantes; el dia inicial no consume plazo. Misma regla que calcularSla() de RutaDoc.';


CREATE OR REPLACE VIEW sigd_tra.vw_mgd_expediente_base AS
WITH feriados AS (
    SELECT COALESCE(array_agg(DISTINCT fecha), ARRAY[]::DATE[]) AS dias
      FROM sigd_org.calendario_laboral WHERE es_feriado AND activo
), historial AS (
    SELECT expediente_id, secuencia, estado_nuevo, fecha_hora FROM sigd_rut.movimiento_tramite
    UNION ALL
    SELECT expediente_id, secuencia, estado_nuevo, fecha_hora FROM sigd_rut.movimiento_compensatorio
), radicaciones AS (
    SELECT e.expediente_id AS id_expediente, e.codigo_expediente, e.fecha_radicacion,
           date_trunc('month', e.fecha_radicacion AT TIME ZONE INTERVAL '-05:00' HOUR TO MINUTE)::date AS periodo,
           COALESCE(NULLIF(btrim(a.area_actual_id), ''), e.area_destino_id::text, 'SIN_AREA') AS unidad_organica_id,
           COALESCE(a.estado_nuevo, 'REGISTRADO') AS estado_actual,
           sigd_rut.pestana_de_estado(COALESCE(a.estado_nuevo, 'REGISTRADO')) AS pestana,
           CASE WHEN a.estado_nuevo IN ('RESUELTO', 'ARCHIVADO') THEN (
               SELECT MIN(h.fecha_hora) FROM historial h
                WHERE h.expediente_id = e.expediente_id
                  AND h.secuencia > COALESCE((
                      SELECT MAX(previo.secuencia) FROM historial previo
                       WHERE previo.expediente_id = e.expediente_id
                         AND previo.estado_nuevo NOT IN ('RESUELTO', 'ARCHIVADO')
                  ), 0)
                  AND h.estado_nuevo IN ('RESUELTO', 'ARCHIVADO')
           ) END AS fecha_resolucion
      FROM sigd_tra.expediente e
      LEFT JOIN sigd_rut.estado_actual_expediente a ON a.expediente_id = e.expediente_id
)
SELECT r.*,
       (r.estado_actual IN ('RESUELTO', 'ARCHIVADO')) AS es_resuelto,
       (r.estado_actual = 'ARCHIVADO') AS es_archivado,
       (r.estado_actual = 'OBSERVADO') AS es_observado,
       (r.pestana = 'EN_TRAMITE') AS es_en_tramite,
       sigd_tra.fn_mgd_horas_habiles(r.fecha_radicacion, COALESCE(r.fecha_resolucion, CURRENT_TIMESTAMP), f.dias) AS horas_habiles_atencion,
       sigd_tra.fn_mgd_dias_habiles_entre(r.fecha_radicacion, COALESCE(r.fecha_resolucion, CURRENT_TIMESTAMP), f.dias) AS dias_habiles_permanencia
  FROM radicaciones r CROSS JOIN feriados f;

CREATE MATERIALIZED VIEW IF NOT EXISTS sigd_tra.mv_kpis_mgd_mensual AS
SELECT b.periodo,
       b.unidad_organica_id,
       CURRENT_TIMESTAMP AS actualizado_en,
       COUNT(*)::BIGINT                                            AS n_radicados,
       COUNT(*) FILTER (WHERE b.estado_actual = 'RESUELTO')::BIGINT AS n_atendidos,
       COUNT(*) FILTER (WHERE b.estado_actual = 'ARCHIVADO')::BIGINT AS n_archivados,
       COUNT(*) FILTER (WHERE b.es_resuelto)::BIGINT               AS n_resueltos,
       COUNT(*) FILTER (WHERE b.es_en_tramite)::BIGINT             AS n_en_tramite,
       COUNT(*) FILTER (WHERE b.es_observado)::BIGINT              AS n_observados,
       COUNT(*) FILTER (
           WHERE b.es_resuelto
             AND b.dias_habiles_permanencia <= 30
       )::BIGINT                                                   AS n_resueltos_dentro_plazo,
       COALESCE(SUM(b.horas_habiles_atencion) FILTER (WHERE b.es_resuelto), 0)
                                                                    AS horas_habiles_suma,
       ROUND(COALESCE(
           (COUNT(*) FILTER (WHERE b.estado_actual = 'RESUELTO')
            + COUNT(*) FILTER (WHERE b.estado_actual = 'ARCHIVADO'))::NUMERIC
               / NULLIF(COUNT(*), 0) * 100,
           0), 2)                                                  AS vtep_porcentaje,
       ROUND(COALESCE(
           SUM(b.horas_habiles_atencion) FILTER (WHERE b.es_resuelto)
               / NULLIF(COUNT(*) FILTER (WHERE b.es_resuelto), 0),
           0), 2)                                                  AS tpr_horas_habiles,
       ROUND(COALESCE(
           COUNT(*) FILTER (
               WHERE b.es_resuelto
                 AND b.dias_habiles_permanencia <= 30
           )::NUMERIC / NULLIF(COUNT(*) FILTER (WHERE b.es_resuelto), 0) * 100,
           0), 2)                                                  AS tro_porcentaje,
       ROUND(COALESCE(
           COUNT(*) FILTER (WHERE b.es_observado)::NUMERIC
               / NULLIF(COUNT(*) FILTER (WHERE b.es_en_tramite), 0) * 100,
           0), 2)                                                  AS teo_porcentaje
  FROM sigd_tra.vw_mgd_expediente_base b
 GROUP BY b.periodo, b.unidad_organica_id;

COMMENT ON MATERIALIZED VIEW sigd_tra.mv_kpis_mgd_mensual IS
    'KPIs MGD-PCM por (periodo, unidad_organica_id) con numeradores y denominadores de auditoria. Fuente: vw_mgd_expediente_base.';

CREATE MATERIALIZED VIEW IF NOT EXISTS sigd_tra.mv_tiempos_retencion_area AS
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
       a.tramo_permanencia_dias_habiles,
       CURRENT_TIMESTAMP                            AS actualizado_en,
       a.n_expedientes,
       ROUND(a.promedio_dias_habiles_permanencia, 4) AS promedio_dias_habiles_permanencia,
       ROUND(a.promedio_horas_habiles, 4)          AS promedio_horas_habiles,
       ROUND(a.minimo_horas_habiles, 4)             AS minimo_horas_habiles,
       ROUND(a.maximo_horas_habiles, 4)             AS maximo_horas_habiles,
       ROUND(COALESCE(
           a.n_expedientes::NUMERIC * 100
               / NULLIF(SUM(a.n_expedientes) OVER (
                   PARTITION BY a.periodo, a.unidad_organica_id), 0),
           0), 2)                                  AS porcentaje_del_area
  FROM agregado a;

COMMENT ON MATERIALIZED VIEW sigd_tra.mv_tiempos_retencion_area IS
    'Distribucion de permanencia en dias habiles por (periodo, unidad_organica_id, tramo). Base del analisis de cuellos de botella.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_mv_kpis_mgd_mensual
    ON sigd_tra.mv_kpis_mgd_mensual (periodo, unidad_organica_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mv_tiempos_retencion_area
    ON sigd_tra.mv_tiempos_retencion_area
       (periodo, unidad_organica_id, tramo_permanencia_dias_habiles);

CREATE INDEX IF NOT EXISTS ix_mv_kpis_mgd_mensual_unidad
    ON sigd_tra.mv_kpis_mgd_mensual (unidad_organica_id, periodo);

CREATE INDEX IF NOT EXISTS ix_mv_tiempos_retencion_area_unidad
    ON sigd_tra.mv_tiempos_retencion_area (unidad_organica_id, periodo);

COMMENT ON COLUMN sigd_tra.mv_kpis_mgd_mensual.n_radicados IS
    'Denominador de VTEP: total de expedientes radicados en el periodo y area.';
COMMENT ON COLUMN sigd_tra.mv_kpis_mgd_mensual.n_atendidos IS
    'Numerador de VTEP: estado_nuevo = RESUELTO (pestana ATENDIDOS).';
COMMENT ON COLUMN sigd_tra.mv_kpis_mgd_mensual.n_archivados IS
    'Numerador de VTEP: estado_nuevo = ARCHIVADO (pestana ARCHIVADOS).';
COMMENT ON COLUMN sigd_tra.mv_kpis_mgd_mensual.n_resueltos IS
    'Denominador de TPR y de TRO: expedientes con RESUELTO o ARCHIVADO.';
COMMENT ON COLUMN sigd_tra.mv_kpis_mgd_mensual.n_resueltos_dentro_plazo IS
    'Numerador de TRO: resueltos con permanencia de 30 dias habiles o menos.';
COMMENT ON COLUMN sigd_tra.mv_kpis_mgd_mensual.horas_habiles_suma IS
    'Numerador de TPR: suma de horas habil de atencion de los expedientes resueltos.';
COMMENT ON COLUMN sigd_tra.mv_kpis_mgd_mensual.n_en_tramite IS
    'Denominador de TEO: pestana EN_TRAMITE (EN_REVISION + OBSERVADO + SUBSANADO).';
COMMENT ON COLUMN sigd_tra.mv_kpis_mgd_mensual.n_observados IS
    'Numerador de TEO: estado_nuevo = OBSERVADO.';
COMMENT ON COLUMN sigd_tra.mv_tiempos_retencion_area.tramo_permanencia_dias_habiles IS
    'Tramo de permanencia en dias habiles: 01_00_05, 02_06_10, 03_11_15, 04_16_20, 05_21_30, 06_31_45, 07_46_60, 08_MAS_60.';
COMMENT ON COLUMN sigd_tra.mv_tiempos_retencion_area.n_expedientes IS
    'Expedientes del tramo; peso para consolidar la permanencia promedio del area.';
COMMENT ON COLUMN sigd_tra.mv_tiempos_retencion_area.promedio_dias_habiles_permanencia IS
    'Permanencia promedio del tramo en dias habiles. Ponderada por n_expedientes da la permanencia promedio del area.';

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
    'Refresco concurrente de las vistas MGD sin bloquear lecturas (#51). El endpoint administrativo la invoca sobre su propia conexión, fuera de la transacción de negocio.';
