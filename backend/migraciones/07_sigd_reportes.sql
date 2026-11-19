-- =============================================================================
-- Migracion 07: reportes MGD compatibles con los consumidores activos de CoreLink.
-- Contrato: mgdAnalytics.repository.ts / mgdAnalytics.service.ts / .types.ts.
-- Solo corrige los dos objetos materializados y el refresco ya previstos aqui.
-- No crea tablas, columnas fisicas, esquemas, funciones auxiliares ni otra vista.
--
-- Fuente de estado: proyeccion de 06 (incluye compensaciones); sin movimiento,
-- REGISTRADO como en las consultas existentes de RutaDoc. No unir asientos:
-- varios asientos de recepcion no deben multiplicar un expediente.
-- Permanencia: desde radicacion hasta cierre efectivo o instante del refresco,
-- conforme al contrato analitico existente, NO tiempo desde el ultimo movimiento.
--
-- El TRO usa la referencia TECNICA DIAS_HABILES_PLAZO=30 de CoreLink. No consulta
-- ni valida plazo_dias/silencio del TUPA, no rellena fecha_limite y NO acredita
-- un plazo legal Suiza. La validacion institucional de esos datos sigue pendiente.
-- No se deriva semaforo_sla: CoreLink calcula sus indicadores/colores en servicio.
--
-- No aplicar sobre una 07 ya registrada con otro checksum ni sobre vistas con
-- otra definicion. El runner debe rechazarlo; no alterar su tabla de control.
-- =============================================================================

-- El runner omite las migraciones cuyo checksum ya esta registrado. Si encuentra
-- objetos previos sin esa garantia, no fingir una instalacion de este contrato
-- usando IF NOT EXISTS sobre vistas con otra definicion.
DO $precondicion_reportes$
BEGIN
    IF to_regclass('sigd_tra.mv_kpis_mgd_mensual') IS NOT NULL
       OR to_regclass('sigd_tra.mv_tiempos_retencion_area') IS NOT NULL
       OR to_regprocedure('sigd_tra.refrescar_vistas_mgd()') IS NOT NULL THEN
        RAISE EXCEPTION 'Existen objetos MGD previos: revisar definicion y checksum antes de aplicar 07. No se reemplazan automaticamente.';
    END IF;
END;
$precondicion_reportes$;

-- 7.1 Una fila por periodo/area, con contadores que CoreLink agrega sin
-- promediar porcentajes. SIN_AREA es el centinela ya definido por CoreLink.
CREATE MATERIALIZED VIEW IF NOT EXISTS sigd_tra.mv_kpis_mgd_mensual AS
WITH feriados AS (
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
           sigd_rut.pestana_de_estado(COALESCE(a.estado_nuevo, 'REGISTRADO')) AS pestana,
           e.fecha_radicacion,
           c.fecha_resolucion,
           COALESCE(a.estado_nuevo, 'REGISTRADO') IN ('RESUELTO', 'ARCHIVADO') AS es_resuelto,
           CASE WHEN a.estado_nuevo IN ('RESUELTO', 'ARCHIVADO')
                THEN c.fecha_resolucion ELSE CURRENT_TIMESTAMP END AS fecha_corte
      FROM sigd_tra.expediente e
      LEFT JOIN sigd_rut.estado_actual_expediente a USING (expediente_id)
      LEFT JOIN cierre c USING (expediente_id)
),
integridad AS MATERIALIZED (
    -- No fabricar tiempo de respuesta si un estado cerrado carece de historial,
    -- ni aceptar duraciones negativas. 22012 aborta instalacion/refresco.
    SELECT 1 / CASE WHEN EXISTS (
        SELECT 1 FROM base
         WHERE (es_resuelto AND fecha_resolucion IS NULL)
            OR fecha_corte < fecha_radicacion
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
       COUNT(*) FILTER (WHERE pestana = 'EN_TRAMITE')::bigint AS n_en_tramite,
       COUNT(*) FILTER (WHERE estado_actual = 'OBSERVADO')::bigint AS n_observados,
       COUNT(*) FILTER (WHERE es_resuelto AND dias_habiles_permanencia <= 30)::bigint AS n_resueltos_dentro_plazo,
       COALESCE(SUM(horas_habiles_atencion) FILTER (WHERE es_resuelto), 0)::numeric AS horas_habiles_suma
  FROM medido
 GROUP BY periodo, unidad_organica_id
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_kpis_mgd_mensual_periodo
    ON sigd_tra.mv_kpis_mgd_mensual (periodo, unidad_organica_id);

COMMENT ON MATERIALIZED VIEW sigd_tra.mv_kpis_mgd_mensual IS
    'Contadores CoreLink por periodo/area; TRO con referencia tecnica de 30 dias habiles, no plazo institucional TUPA confirmado.';

-- 7.2 Una fila por periodo/area/tramo, como exige obtenerRetencion().
-- Cortes copiados de tramoDePermanencia()/LIMITES_TRAMOS de CoreLink.
CREATE MATERIALIZED VIEW IF NOT EXISTS sigd_tra.mv_tiempos_retencion_area AS
WITH feriados AS (
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
           sigd_rut.pestana_de_estado(COALESCE(a.estado_nuevo, 'REGISTRADO')) AS pestana,
           e.fecha_radicacion,
           c.fecha_resolucion,
           COALESCE(a.estado_nuevo, 'REGISTRADO') IN ('RESUELTO', 'ARCHIVADO') AS es_resuelto,
           CASE WHEN a.estado_nuevo IN ('RESUELTO', 'ARCHIVADO')
                THEN c.fecha_resolucion ELSE CURRENT_TIMESTAMP END AS fecha_corte
      FROM sigd_tra.expediente e
      LEFT JOIN sigd_rut.estado_actual_expediente a USING (expediente_id)
      LEFT JOIN cierre c USING (expediente_id)
),
integridad AS MATERIALIZED (
    -- No fabricar tiempo de respuesta si un estado cerrado carece de historial,
    -- ni aceptar duraciones negativas. 22012 aborta instalacion/refresco.
    SELECT 1 / CASE WHEN EXISTS (
        SELECT 1 FROM base
         WHERE (es_resuelto AND fecha_resolucion IS NULL)
            OR fecha_corte < fecha_radicacion
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
  FROM agregado
WITH DATA;

-- Solo columnas, sin expresiones ni WHERE: requisito de REFRESH CONCURRENTLY.
CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_tiempos_retencion_area_clave
    ON sigd_tra.mv_tiempos_retencion_area (periodo, unidad_organica_id, tramo_permanencia_dias_habiles);

CREATE INDEX IF NOT EXISTS ix_mv_tiempos_retencion_area_dias
    ON sigd_tra.mv_tiempos_retencion_area (promedio_dias_habiles_permanencia DESC);

COMMENT ON MATERIALIZED VIEW sigd_tra.mv_tiempos_retencion_area IS
    'Distribucion CoreLink por periodo/area/tramo; dias y horas habiles desde radicacion, calendario vigente y referencia tecnica no equivalente a plazo TUPA validado.';

-- 7.3 Se conserva nombre, firma y columnas de respuesta del refresco existente.
CREATE OR REPLACE FUNCTION sigd_tra.refrescar_vistas_mgd()
RETURNS TABLE(vista TEXT, duracion_ms NUMERIC)
LANGUAGE plpgsql
AS $$
DECLARE
    v_inicio TIMESTAMPTZ := clock_timestamp();
    v_fin TIMESTAMPTZ;
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
    'Refresca los dos objetos MGD previstos; para CoreLink el repositorio conserva su serializacion y contrato HTTP existentes.';
