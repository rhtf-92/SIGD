DROP MATERIALIZED VIEW IF EXISTS sigd_tra.mv_tiempos_retencion_area;
DROP MATERIALIZED VIEW IF EXISTS sigd_tra.mv_kpis_mgd_mensual;

CREATE MATERIALIZED VIEW sigd_tra.mv_kpis_mgd_mensual AS
WITH cierre AS (
    SELECT
        m.expediente_id,
        m.fecha_hora AS fecha_movimiento,
        ROW_NUMBER() OVER (PARTITION BY m.expediente_id ORDER BY m.fecha_hora) AS orden
    FROM sigd_rut.movimiento_tramite m
    WHERE m.estado_nuevo IN ('RESUELTO', 'NOTIFICADO', 'ARCHIVADO')
),
base AS (
    SELECT
        date_trunc('month', e.fecha_radicacion)::date AS periodo,
        e.expediente_id,
        e.fecha_radicacion,
        e.fecha_limite,
        a.estado_nuevo AS estado_codigo,
        a.area_actual_id,
        ar.fecha_ingreso,
        c.fecha_movimiento AS fecha_cierre
    FROM sigd_tra.expediente e
    LEFT JOIN sigd_rut.estado_actual_expediente a ON a.expediente_id = e.expediente_id
    LEFT JOIN sigd_tra.asiento_registro ar ON ar.expediente_id = e.expediente_id AND NOT ar.anulado
    LEFT JOIN cierre c ON c.expediente_id = e.expediente_id AND c.orden = 1
)
SELECT
    periodo,
    now() AS actualizado_en,
    COUNT(*)::int AS n_radicados,
    COUNT(*) FILTER (WHERE estado_codigo IN ('RESUELTO', 'NOTIFICADO'))::int AS n_atendidos,
    COUNT(*) FILTER (WHERE estado_codigo = 'ARCHIVADO')::int AS n_archivados,
    COUNT(fecha_cierre)::int AS n_resueltos,
    COUNT(*) FILTER (
        WHERE estado_codigo IS NULL
           OR estado_codigo NOT IN ('RESUELTO', 'NOTIFICADO', 'ARCHIVADO', 'ANULADO', 'OBSERVADO')
    )::int AS n_en_tramite,
    COUNT(*) FILTER (WHERE estado_codigo = 'OBSERVADO')::int AS n_observados,
    COUNT(*) FILTER (
        WHERE fecha_cierre IS NOT NULL AND fecha_limite IS NOT NULL AND fecha_cierre <= fecha_limite
    )::int AS n_resueltos_dentro_plazo,
    (COALESCE(SUM(EXTRACT(EPOCH FROM (
        COALESCE(fecha_cierre, now()) - COALESCE(fecha_ingreso, fecha_radicacion)
    ))), 0)::float8 * 5.0 / 7.0) AS horas_habiles_suma
FROM base
GROUP BY periodo
WITH DATA;

CREATE UNIQUE INDEX ux_mv_kpis_mgd_mensual_periodo
    ON sigd_tra.mv_kpis_mgd_mensual (periodo);

CREATE MATERIALIZED VIEW sigd_tra.mv_tiempos_retencion_area AS
WITH base AS (
    SELECT
        date_trunc('month', e.fecha_radicacion)::date AS periodo,
        COALESCE(ar.area_id, e.area_destino_id, '00000000-0000-0000-0000-000000000000'::uuid) AS unidad_organica_id,
        e.estado,
        COUNT(*)::int AS expedientes,
        ROUND((AVG(EXTRACT(EPOCH FROM (now() - a.fecha_hora)) / 86400)::numeric * 5.0 / 7.0), 2)::float8
            AS promedio_dias_habiles_permanencia,
        ROUND((AVG(EXTRACT(EPOCH FROM (now() - a.fecha_hora)) / 3600)::numeric * 5.0 / 7.0), 2)::float8
            AS promedio_horas_habiles
    FROM sigd_rut.estado_actual_expediente a
    JOIN sigd_tra.expediente e ON e.expediente_id = a.expediente_id
    LEFT JOIN sigd_org.area ar ON ar.area_id = a.area_actual_id
    WHERE a.estado_nuevo NOT IN ('RESUELTO', 'NOTIFICADO', 'ARCHIVADO', 'ANULADO')
    GROUP BY 1, 2, 3
),
clasificado AS (
    SELECT
        base.*,
        CASE
            WHEN promedio_dias_habiles_permanencia <= 5 THEN '01_00_05'
            WHEN promedio_dias_habiles_permanencia <= 10 THEN '02_06_10'
            WHEN promedio_dias_habiles_permanencia <= 15 THEN '03_11_15'
            WHEN promedio_dias_habiles_permanencia <= 20 THEN '04_16_20'
            WHEN promedio_dias_habiles_permanencia <= 30 THEN '05_21_30'
            WHEN promedio_dias_habiles_permanencia <= 45 THEN '06_31_45'
            WHEN promedio_dias_habiles_permanencia <= 60 THEN '07_46_60'
            ELSE '08_MAS_60'
        END AS tramo_permanencia_dias_habiles
    FROM base
)
SELECT
    periodo,
    unidad_organica_id,
    tramo_permanencia_dias_habiles,
    expedientes AS n_expedientes,
    promedio_dias_habiles_permanencia,
    promedio_horas_habiles,
    ROUND((expedientes::numeric * 100 / NULLIF(
        SUM(expedientes) OVER (PARTITION BY periodo, unidad_organica_id), 0
    )), 2)::float8 AS porcentaje_del_area
FROM clasificado
WITH DATA;

CREATE UNIQUE INDEX ux_mv_tiempos_retencion_area_clave
    ON sigd_tra.mv_tiempos_retencion_area
       (periodo, unidad_organica_id, tramo_permanencia_dias_habiles);
