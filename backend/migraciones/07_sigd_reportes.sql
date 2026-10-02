-- =============================================================================
-- Migración 07 · BE6 Reportería y Tablero de Gestión MGD (OE6)
-- Autor: Ricardo Arévalo Villacorta · Rama B_AREVALO · Sprint S6
-- Entregable del plan: backend/docs/00_corelink/07_vistas_materializadas_mgd.sql
--
-- Objetivo
--   Vistas materializadas con los 4 indicadores del Modelo de Gestión Documental
--   PCM (VTEP, TPR, TRO, TEO) y con la retención de expedientes por área, cada
--   una con índice único para permitir REFRESH MATERIALIZED VIEW CONCURRENTLY
--   sin bloquear las lecturas del tablero (#51).
--
-- Fórmulas (MGD-PCM)
--   VTEP = (atendidos + archivados) / radicados × 100        objetivo ≥ 95 %
--   TPR  = Σ(horas hábiles de atención) / N resueltos        objetivo ≤ 24 h hábiles
--   TRO  = resueltos dentro del plazo / resueltos × 100       objetivo ≥ 90 %
--   TEO  = observados / en trámite × 100                      objetivo ≤ 5 %
--
-- Nota sobre el TPR: PostgreSQL no tiene calendario laboral, por lo que la vista
-- acumula horas calendario y el factor de conversión a horas hábiles
-- (5/7) se aplica en la capa de aplicación, junto con el descuento de feriados
-- de Ucayali (24 de junio y 13 de octubre). La conversión vive en
-- backend/src/modules/reportes/kpi.service.ts para que la fórmula sea auditable
-- y verificable con los mismos datos.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS sigd_tra;

-- -----------------------------------------------------------------------------
-- 7.1 mv_kpis_mgd_mensual · consolidado mensual de los 4 indicadores
-- -----------------------------------------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS sigd_tra.mv_kpis_mgd_mensual AS
WITH cierre AS (
    SELECT
        m.expediente_id,
        m.fecha_movimiento,
        ROW_NUMBER() OVER (PARTITION BY m.expediente_id ORDER BY m.fecha_movimiento) AS orden
    FROM sigd_rut.movimiento_tramite m
    WHERE m.estado_destino IN ('RESUELTO', 'NOTIFICADO', 'ARCHIVADO')
),
base AS (
    SELECT
        date_trunc('month', e.fecha_radicacion)::date                AS periodo,
        e.expediente_id,
        e.fecha_radicacion,
        e.fecha_limite,
        a.estado_codigo,
        a.area_actual_id,
        ar.fecha_ingreso,
        c.fecha_movimiento AS fecha_cierre
    FROM sigd_tra.expediente e
    LEFT JOIN sigd_rut.estado_actual_tramite a
           ON a.expediente_id = e.expediente_id
    LEFT JOIN sigd_tra.asiento_registro ar
           ON ar.expediente_id = e.expediente_id
          AND NOT ar.anulado
    LEFT JOIN cierre c
           ON c.expediente_id = e.expediente_id
          AND c.orden = 1
)
SELECT
    periodo,
    COUNT(*)::int                                                          AS radicados,
    COUNT(*) FILTER (
        WHERE estado_codigo IN ('RESUELTO', 'NOTIFICADO')
    )::int                                                                  AS atendidos,
    COUNT(*) FILTER (WHERE estado_codigo = 'ARCHIVADO')::int                 AS archivados,
    COUNT(*) FILTER (WHERE estado_codigo = 'OBSERVADO')::int                 AS observados,
    COUNT(*) FILTER (
        WHERE estado_codigo IS NULL
           OR estado_codigo NOT IN ('RESUELTO', 'NOTIFICADO', 'ARCHIVADO', 'ANULADO', 'OBSERVADO')
    )::int                                                                  AS en_tramite,
    COUNT(*) FILTER (
        WHERE estado_codigo IS NULL
           OR estado_codigo NOT IN ('RESUELTO', 'NOTIFICADO', 'ARCHIVADO', 'ANULADO')
    )::int                                                                  AS universo_teo,
    COUNT(fecha_cierre)::int                                                AS resueltos,
    COUNT(*) FILTER (WHERE fecha_cierre IS NOT NULL AND fecha_limite IS NOT NULL
                       AND fecha_cierre <= fecha_limite)::int                AS resueltos_dentro_de_plazo,
    COALESCE(SUM(
        EXTRACT(EPOCH FROM (COALESCE(fecha_cierre, now()) - COALESCE(fecha_ingreso, fecha_radicacion)))
    ), 0)::float8                                                           AS horas_calendario_totales,
    ROUND(
        CASE WHEN COUNT(*) = 0 THEN NULL
             ELSE (COUNT(*) FILTER (WHERE estado_codigo IN ('RESUELTO', 'NOTIFICADO', 'ARCHIVADO'))::numeric
                   * 100 / COUNT(*))
        END, 2)::float8                                                    AS vtep,
    ROUND(
        CASE WHEN COUNT(fecha_cierre) = 0 THEN NULL
             ELSE (COALESCE(SUM(EXTRACT(EPOCH FROM (fecha_cierre - COALESCE(fecha_ingreso, fecha_radicacion)))), 0)::numeric
                   / COUNT(fecha_cierre))
        END, 2)::float8                                                    AS tpr_horas_calendario,
    ROUND(
        CASE WHEN COUNT(fecha_cierre) = 0 THEN NULL
             ELSE (COUNT(*) FILTER (WHERE fecha_cierre IS NOT NULL AND fecha_limite IS NOT NULL
                                     AND fecha_cierre <= fecha_limite)::numeric
                   * 100 / COUNT(fecha_cierre))
        END, 2)::float8                                                    AS tro,
    ROUND(
        CASE
            WHEN COUNT(*) FILTER (
                     WHERE estado_codigo IS NULL
                        OR estado_codigo NOT IN ('RESUELTO', 'NOTIFICADO', 'ARCHIVADO', 'ANULADO', 'OBSERVADO')
                 ) = 0 THEN NULL
            ELSE (COUNT(*) FILTER (WHERE estado_codigo = 'OBSERVADO')::numeric
                  * 100
                  / COUNT(*) FILTER (
                      WHERE estado_codigo IS NULL
                         OR estado_codigo NOT IN ('RESUELTO', 'NOTIFICADO', 'ARCHIVADO', 'ANULADO', 'OBSERVADO')
                    ))
        END, 2)::float8                                                    AS teo
FROM base
GROUP BY periodo
WITH DATA;

-- Índice único obligatorio para REFRESH MATERIALIZED VIEW CONCURRENTLY (#51).
CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_kpis_mgd_mensual_periodo
    ON sigd_tra.mv_kpis_mgd_mensual (periodo);

COMMENT ON MATERIALIZED VIEW sigd_tra.mv_kpis_mgd_mensual IS
    'Consolidado mensual de los 4 KPIs MGD (VTEP, TPR, TRO, TEO). Índice único por periodo para permitir REFRESH CONCURRENTLY.';

-- -----------------------------------------------------------------------------
-- 7.2 mv_tiempos_retencion_area · permanencia y semáforo por unidad orgánica
-- -----------------------------------------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS sigd_tra.mv_tiempos_retencion_area AS
SELECT
    COALESCE(ar.area_id, e.area_destino_id)                                   AS area_id,
    COALESCE(ar.nombre, 'Sin área asignada')                                  AS area,
    e.estado                                                                     AS estado,
    COUNT(*)::int                                                                AS expedientes,
    ROUND(AVG(EXTRACT(EPOCH FROM (now() - a.fecha_estado)) / 3600)::numeric, 2)::float8
                                                                                 AS horas_promedio,
    ROUND(AVG(EXTRACT(EPOCH FROM (now() - a.fecha_estado)) / 86400)::numeric, 2)::float8
                                                                                 AS dias_promedio,
    ROUND(MAX(EXTRACT(EPOCH FROM (now() - a.fecha_estado)) / 86400)::numeric, 2)::float8
                                                                                 AS dias_maximo,
    COUNT(*) FILTER (WHERE e.fecha_limite IS NOT NULL AND e.fecha_limite < now())::int
                                                                                 AS vencidos,
    COUNT(*) FILTER (WHERE a.semaforo_sla = 'ROJO')::int                         AS semaforo_rojo,
    COUNT(*) FILTER (WHERE a.semaforo_sla = 'AMARILLO')::int                     AS semaforo_amarillo,
    COUNT(*) FILTER (WHERE a.semaforo_sla = 'VERDE')::int                        AS semaforo_verde
FROM sigd_rut.estado_actual_tramite a
JOIN sigd_tra.expediente e
  ON e.expediente_id = a.expediente_id
LEFT JOIN sigd_org.area ar
  ON ar.area_id = a.area_actual_id
WHERE a.estado_codigo NOT IN ('RESUELTO', 'NOTIFICADO', 'ARCHIVADO', 'ANULADO')
GROUP BY 1, 2, 3
WITH DATA;

-- La clave única combina área y estado: un área puede tener varios estados
-- vigentes y el refresco concurrente no admite duplicados.
CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_tiempos_retencion_area_clave
    ON sigd_tra.mv_tiempos_retencion_area (COALESCE(area_id, '00000000-0000-0000-0000-000000000000'::uuid), estado);

CREATE INDEX IF NOT EXISTS ix_mv_tiempos_retencion_area_dias
    ON sigd_tra.mv_tiempos_retencion_area (dias_promedio DESC);

COMMENT ON MATERIALIZED VIEW sigd_tra.mv_tiempos_retencion_area IS
    'Expedientes en trámite por área y estado, con permanencia promedio y semáforo SLA. Base del ranking de cuellos de botella (#51/#52).';

-- -----------------------------------------------------------------------------
-- 7.3 Función de refresco transaccional para el endpoint administrativo #51
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
    'Refresco concurrente de las vistas MGD sin bloquear lecturas (#51). El endpoint administrativo la invoca sobre su propia conexión, fuera de la transacción de negocio.';
