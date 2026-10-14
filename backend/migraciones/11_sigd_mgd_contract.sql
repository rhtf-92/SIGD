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
        -- El intervalo (no la cadena POSIX) lee `dia 08:00` como hora de Lima y
        -- devuelve el instante UTC correspondiente, sea cual sea el `TimeZone` de
        -- la sesión.
        SELECT (h.dia + TIME '08:00')
                   AT TIME ZONE INTERVAL '-05:00' HOUR TO MINUTE AS apertura,
               (h.dia + TIME '16:30')
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

-- -----------------------------------------------------------------------------
-- 2. FUNCIÓN: sigd_tra.fn_mgd_dias_habiles_entre(p_desde, p_hasta, p_feriados)
--
-- Días hábiles de permanencia. Reproduce exactamente la regla de `calcularSla`
-- en `src/domains/rutadoc/sla.service.ts`: el día inicial NO consume plazo y el
-- día final SÍ. Es la MISMA magnitud con la que RutaDoc evalúa el plazo de 30
-- días hábiles, de modo que TRO y el semáforo SLA no pueden discrepar sobre el
-- mismo expediente.
--
-- Misma independencia de `TimeZone` y misma forma de zona que la sección 1: la
-- fecha civil de Lima se obtiene con el intervalo `'-05:00'`, ni restando cinco
-- horas al instante (depende de la zona de la sesión) ni con la cadena POSIX
-- `'-05:00'` (signo invertido).
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
    'Dias habil entre dos instantes; el dia inicial no consume plazo. Misma regla que calcularSla() de RutaDoc.';

-- -----------------------------------------------------------------------------
-- 3. VISTA ANALÍTICA BASE: una fila por expediente
--
-- Es el único punto donde se juntan `sigd_tra`, `sigd_rut` y el calendario. Las
-- vistas materializadas de las secciones 4 y 5 se apoyan en ella, de modo que el
-- cálculo de horas hábiles existe en UN solo lugar. `sigd_tra.expediente` y
-- `sigd_rut.movimiento_tramite` son tablas vivas: nunca se consultan desde un
-- endpoint, sólo desde el refresco programado.
--
-- La vista se crea dentro de un bloque DO porque la FUENTE del calendario debe
-- decidirse en tiempo de instalación: `sigd_org.calendario_laboral` es una
-- referencia que PostgreSQL resuelve al PLANIFICAR, así que no puede protegerse
-- con `to_regclass` dentro del cuerpo. Se generan dos variantes de la MISMA
-- definición, que sólo difieren en de dónde salen los feriados. No es lógica
-- duplicada: el cálculo de horas hábiles vive íntegro en la sección 1.
--   * Con catálogo de OrganiCore: se leen los feriados reales.
--   * Sin él: calendario vacío, es decir sólo se excluyen sábados y domingos.
--     Es la misma degradación que ya aplica `crearProveedorFeriados`.
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
            SELECT e.expediente_id AS id_expediente,
                   e.codigo_expediente,
                   COALESCE(e.fecha_envio_real,e.fecha_radicacion) AS fecha_radicacion,
                   -- Mismo intervalo '-05:00' que las secciones 1 y 2, para que el
                   -- módulo no dependa ni de la zona de la sesión ni de la base de
                   -- datos de zonas horarias del host: el corte de mes se define en
                   -- hora de Lima y sólo entonces se agrupa.
                   date_trunc('month',
                       COALESCE(e.fecha_envio_real,e.fecha_radicacion) AT TIME ZONE INTERVAL '-05:00' HOUR TO MINUTE)::date
                       AS periodo,
                   -- Centinela en vez de NULL: un índice UNIQUE de PostgreSQL trata
                   -- cada NULL como distinto, de modo que las filas de expedientes sin
                   -- área NO podrían garantizar unicidad y REFRESH ... CONCURRENTLY
                   -- fallaría con "could not create unique index". El centinela sí.
                   COALESCE(NULLIF(btrim(a.area_actual_id), ''), e.area_destino_id::text, 'SIN_AREA')
                       AS unidad_organica_id,
                   COALESCE(NULLIF(btrim(a.estado_nuevo), ''), 'REGISTRADO')
                       AS estado_actual,
                   COALESCE(
                       sigd_rut.pestana_de_estado(
                           COALESCE(NULLIF(btrim(a.estado_nuevo), ''), 'REGISTRADO')),
                       'PENDIENTES'
                   ) AS pestana
              FROM sigd_tra.expediente e
              LEFT JOIN sigd_rut.estado_actual_expediente a
                ON a.expediente_id = e.expediente_id
        ),
        -- Primer instante terminal del expediente. MIN() porque un expediente que
        -- pasó por RESUELTO y luego por ARCHIVADO tiene dos asientos terminales, y el
        -- que cuenta es el primero: archivar más tarde no debe inflar el TPR.
        resoluciones AS (
            SELECT m.expediente_id,
                   MIN(m.fecha_hora) AS fecha_resolucion
              FROM sigd_rut.movimiento_tramite m
             WHERE m.estado_nuevo IN ('RESUELTO', 'ARCHIVADO')
             GROUP BY m.expediente_id
        ),
        base AS (
            SELECT r.id_expediente,
                   r.codigo_expediente,
                   r.periodo,
                   r.unidad_organica_id,
                   r.estado_actual,
                   r.pestana,
                   r.fecha_radicacion,
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
                ON res.expediente_id = r.id_expediente
        )
        SELECT b.id_expediente,
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
               -- Un expediente pendiente (`fecha_resolucion IS NULL`) aporta
               -- permanencia para el análisis de cuellos de botella, pero su TIEMPO
               -- DE ATENCIÓN se descarta del numerador de TPR mediante el FILTER de
               -- la sección 4: TPR mide el tiempo de atención real, no el de espera.
               sigd_tra.fn_mgd_horas_habiles(b.fecha_radicacion, b.fecha_corte, f.dias)
                   AS horas_habiles_atencion,
               sigd_tra.fn_mgd_dias_habiles_entre(b.fecha_radicacion, b.fecha_corte, f.dias)
                   AS dias_habiles_permanencia
          FROM base b
          CROSS JOIN feriados f
    $q$, v_feriados);
END;
$ddl$;

COMMENT ON VIEW sigd_tra.vw_mgd_expediente_base IS
    'Grain de una fila por expediente con su tiempo habil de atencion. Fuente unica de las vistas materializadas MGD.';

-- -----------------------------------------------------------------------------
-- 4. VISTA MATERIALIZADA: sigd_tra.mv_kpis_mgd_mensual_v2
--
-- Grain: (periodo, unidad_organica_id). Ambas columnas son NOT NULL por
-- construcción (gracias al centinela 'SIN_AREA' de la vista base), de modo que el
-- índice UNIQUE de la sección 6 es realmente único y REFRESH ... CONCURRENTLY es
-- legal.
--
-- Se almacenan NUMERADORES y DENOMINADORES además de los porcentajes. Motivo: el
-- consolidado institucional y el desglose por área NO pueden obtenerse promediando
-- porcentajes de los grupos; hay que volver a dividir las sumas (media ponderada).
-- Con las columnas crudas, `mgdAnalytics.service.ts` aplica las MISMAS fórmulas
-- puras y testeadas sobre los totales, de modo que la fila consolidada nunca puede
-- discrepar de la media aritmética de sus grupos.
-- -----------------------------------------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS sigd_tra.mv_kpis_mgd_mensual_v2 AS
SELECT b.periodo,
       b.unidad_organica_id,
       -- CURRENT_TIMESTAMP es el instante de la transacción: idéntico para todas
       -- las filas de un mismo refresco. No forma parte del índice UNIQUE y, aun
       -- así, no puede romper la unicidad de (periodo, unidad_organica_id).
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

COMMENT ON MATERIALIZED VIEW sigd_tra.mv_kpis_mgd_mensual_v2 IS
    'KPIs MGD-PCM por (periodo, unidad_organica_id) con numeradores y denominadores de auditoria. Fuente: vw_mgd_expediente_base.';

-- -----------------------------------------------------------------------------
-- 5. VISTA MATERIALIZADA: sigd_tra.mv_tiempos_retencion_area_v2
--
-- Grain: (periodo, unidad_organica_id, tramo_permanencia_dias_habiles).
--
-- Se elige el grain POR TRAMO y no "una fila por área con columnas de tramos"
-- porque el objetivo declarado (T-BE-CL-12, endpoint #52) es la DISTRIBUCIÓN y la
-- identificación de cuellos de botella. En una fila por área, representar un tramo
-- sin expedientes obliga a usar NULL y se pierde la distinción entre "cero
-- expedientes" y "celda vacía"; el grain por tramo conserva una fila por hecho
-- observado, y sus tres columnas son NOT NULL por construcción.
--
-- Los tramos están expresados en DÍAS HÁBILES, no en días calendario: un
-- expediente con 43 días calendario y 10 días hábiles de permanencia no es un
-- cuello de botella, y el tablero ejecutivo no debe presentarlo como tal.
-- -----------------------------------------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS sigd_tra.mv_tiempos_retencion_area_v2 AS
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
           -- La media de medias pesada por n_expedientes es EXACTAMENTE la media
           -- del área: por eso basta con guardar la media dentro del tramo y el
           -- consolidado se obtiene en `mgdAnalytics.service.ts` sin releer la
           -- tabla de expedientes. Sin esta columna el tablero no podría informar
           -- la permanencia promedio en días hábiles, que es su métrica principal.
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
       -- Peso por ventana: SUM(...) OVER no necesita subconsulta ni segunda
       -- pasada, y el centinela 'SIN_AREA' participa igual que cualquier área.
       ROUND(COALESCE(
           a.n_expedientes::NUMERIC * 100
               / NULLIF(SUM(a.n_expedientes) OVER (
                   PARTITION BY a.periodo, a.unidad_organica_id), 0),
           0), 2)                                  AS porcentaje_del_area
  FROM agregado a;

COMMENT ON MATERIALIZED VIEW sigd_tra.mv_tiempos_retencion_area_v2 IS
    'Distribucion de permanencia en dias habiles por (periodo, unidad_organica_id, tramo). Base del analisis de cuellos de botella.';

-- -----------------------------------------------------------------------------
-- 6. ÍNDICES
--
-- PostgreSQL EXIGE un índice UNIQUE que cubra TODAS las filas de la vista
-- materializada para admitir REFRESH MATERIALIZED VIEW CONCURRENTLY: la vista no
-- puede contener filas duplicadas ni valores NULL en las columnas del índice,
-- porque en la comparación OLD/NEW un NULL no iguala a nada y la fila insertada se
-- consideraría duplicada. El índice debe construirse sólo con nombres de columna,
-- sin expresión y sin cláusula WHERE.
--
-- Por eso la granularidad de las secciones 4 y 5 se eligió con columnas NOT NULL
-- por construcción, y por eso `unidad_organica_id` lleva el centinela 'SIN_AREA'.
-- Estos índices NO son decorativos: son la condición de posibilidad del refresco
-- concurrente, que es el requisito que evita bloquear la mesa de partes.
-- -----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_mv_kpis_mgd_mensual_v2
    ON sigd_tra.mv_kpis_mgd_mensual_v2 (periodo, unidad_organica_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mv_tiempos_retencion_area_v2
    ON sigd_tra.mv_tiempos_retencion_area_v2
       (periodo, unidad_organica_id, tramo_permanencia_dias_habiles);

-- Índices de acceso del tablero. NO interfieren con los ÚNICOS: el planificador
-- puede combinarlos y jamás pueden sustituir a un UNIQUE.
CREATE INDEX IF NOT EXISTS ix_mv_kpis_mgd_mensual_v2_unidad
    ON sigd_tra.mv_kpis_mgd_mensual_v2 (unidad_organica_id, periodo);

CREATE INDEX IF NOT EXISTS ix_mv_tiempos_retencion_area_v2_unidad
    ON sigd_tra.mv_tiempos_retencion_area_v2 (unidad_organica_id, periodo);

-- -----------------------------------------------------------------------------
