-- =============================================================================
-- SIGD · IESTP "Suiza" (Pucallpa) — Núcleo 00 CoreLink
-- Motor Analítico MGD-PCM/SEGDI · Vistas Materializadas
--
-- Tareas: T-BE-CL-10 (vistas materializadas e índices únicos)
--         T-BE-CL-11 (fórmulas oficiales sobre tiempo hábil institucional)
--         T-BE-CL-13 (división por cero protegida con NULLIF/COALESCE)
-- Entregable: backend/docs/00_corelink/07_vistas_materializadas_mgd.sql
-- Autor: Elmer Ramírez (B_REATEGUI) — Desarrollador del Motor Analítico MGD-PCM
-- Marco jurídico: MGD-PCM (R.S. N° 001-2017-PCM/SEGDI), TUO Ley N° 27444
--                 (Art. 138 LPAG: horario de atención y cómputo de plazos).
-- Motor: PostgreSQL 18.3+
--
-- -----------------------------------------------------------------------------
-- MODELO REAL UTILIZADO (no supuestos)
-- -----------------------------------------------------------------------------
-- El grain real del dominio NO es la tabla `sigd_tra.expediente` de
-- `05_esquema_sigd_tra_v6.3.sql` (allí `expediente_id` es UUID y no hay columna
-- de área), sino el contrato de lectura que ya ejecuta `rutadoc.repository.ts`
-- sobre `03_esquema_sigd_tra_cut_foliado.sql` + `migraciones/06_sigd_rut.sql`:
--
--   sigd_tra.expediente
--       id_expediente      BIGINT PK
--       codigo_expediente  VARCHAR(20) UNIQUE   (CUT con máscara EXP-YYYY-XXXXXX)
--       fk_tramite         BIGINT → sigd_tra.tramite
--       creado_en          TIMESTAMPTZ           (fecha de radicación)
--
--   sigd_rut.estado_actual_expediente           (proyección reconstruible)
--       expediente_id  BIGINT PK
--       estado_nuevo   TEXT   ← FSM canónica de sigd_rut.estado_tramite
--       area_actual_id TEXT   ← unidad orgánica / área (NO es "carrera")
--       fecha_hora     TIMESTAMPTZ
--
--   sigd_rut.movimiento_tramite                 (historial particionado por año)
--       expediente_id, secuencia, estado_nuevo, fecha_hora
--
--   sigd_org.calendario_laboral
--       fecha DATE, es_feriado BOOLEAN
--
--   sigd_org.unidad_organica
--       id, sigla, nombre, padre_id, path, estado
--
-- La columna `area_actual_id` es la unidad orgánica. No se asume que "carrera" la
-- represente: en el esquema vigente no existe `carrera` y el nombre canónico del
-- árbol organizacional es `sigd_org.unidad_organica`.
--
-- -----------------------------------------------------------------------------
-- CORRESPONDENCIA DE LAS 4 FÓRMULAS CON LA TAXONOMÍA REAL
-- -----------------------------------------------------------------------------
-- El plan maestro (PLAN_DE_TRABAJO_BACKEND_100_CONFORMIDAD.md §20, OE6) define:
--
--   VTEP = (N_atendidos + N_archivados) / N_radicados            × 100
--   TPR  = Σ HorasHábiles(FechaIngreso, FechaResolucion) / N
--   TRO  = N_resueltos_con_permanencia_≤_30_días / N_resueltos   × 100
--   TEO  = N_observados / N_en_tramite                           × 100
--
-- Mapeo sobre la FSM real (`sigd_rut.estado_tramite`):
--
--   N_radicados  = todos los expedientes con `sigd_tra.expediente.creado_en`
--   N_atendidos  = estado_nuevo = 'RESUELTO'     (pestana ATENDIDOS)
--   N_archivados = estado_nuevo = 'ARCHIVADO'    (pestana ARCHIVADOS)
--   N_observados = estado_nuevo = 'OBSERVADO'
--   N_en_tramite = sigd_rut.pestana_de_estado(...) = 'EN_TRAMITE'
--                  (EN_REVISION + OBSERVADO + SUBSANADO)
--
-- `N_en_tramite` reutiliza la función institucional ya creada por RutaDoc en
-- `migraciones/06_sigd_rut.sql` en lugar de reescribir la taxonomía de pestañas.
-- Duplicar esa clasificación haría divergir el tablero ejecutivo de los contadores
-- de bandeja, que salen de `sigd_rut.contador_pestana_local`.
--
-- `FechaResolucion` es el PRIMER instante en que el expediente alcanzó 'RESUELTO'
-- o 'ARCHIVADO'. Para los expedientes aún abiertos se usa el instante de corte del
-- propio refresco, de modo que la permanencia del pendiente sea observable y no
-- desaparezca del análisis de cuellos de botella.
--
-- -----------------------------------------------------------------------------
-- TIEMPO HÁBIL INSTITUCIONAL
-- -----------------------------------------------------------------------------
-- MGD-PCM exige que TPR, TRO y TEO se computen EXCLUSIVAMENTE sobre tiempo
-- hábil. El problema que esto corrige (T-BE-CL-11) es que los cálculos previos
-- contaban fines de semana y feriados dentro del Tiempo Promedio de Respuesta y
-- concluían falsamente que la institución incumplía la celeridad de la PCM.
--
-- Convenciones, idénticas a `src/domains/tramicore/horarioCorte.util.ts`:
--   * Zona horaria institucional: America/Lima, UTC-05:00 fijo (sin horario de
--     verano desde 2019). El desplazamiento se expresa SIEMPRE como intervalo
--     (`AT TIME ZONE INTERVAL '-05:00' HOUR TO MINUTE`), nunca como cadena: una
--     especificación numérica de zona en PostgreSQL sigue el convenio POSIX e
--     invierte el signo, de modo que `'-05:00'` significaría UTC+5. Tampoco se
--     suma `INTERVAL '5 hours'` a un `timestamp` sin zona, porque eso leería el
--     `TimeZone` de la sesión y rompería la marca IMMUTABLE. Véase la sección 1.
--   * Ventana de atención: 08:00 → 16:30 (8.5 horas hábiles por día).
--   * Días no hábiles: sábado, domingo y los feriados de
--     `sigd_org.calendario_laboral`.
--
-- -----------------------------------------------------------------------------
-- INSTALACIÓN (respetar el orden topológico del DAG, igual que el resto del
-- proyecto):
--   psql -d sigd_db -f backend/docs/01_identicore/03_esquema_sigd_auth_v2.sql
--   psql -d sigd_db -f backend/docs/02_organicore/03_esquema_sigd_org_v6.3.sql
--   psql -d sigd_db -f backend/docs/03_docucore/05_esquema_sigd_doc_jsonb_v6.3_auditoria_corregido.sql
--   psql -d sigd_db -f backend/docs/04_tramicore/03_esquema_sigd_tra_cut_foliado.sql
--   psql -d sigd_db -f backend/migraciones/06_sigd_rut.sql
--   psql -d sigd_db -f backend/docs/00_corelink/07_vistas_materializadas_mgd.sql
--
-- El script NO altera ni reemplaza ninguna tabla de los demás módulos: sólo crea
-- dos funciones IMMUTABLE, una vista analítica y dos vistas materializadas.
-- Es idempotente y se puede volver a ejecutar.
--
-- REQUISITOS DE PRIVILEGIOS para el endpoint #51 (REFRESH ... CONCURRENTLY):
--   * El rol de la aplicación necesita el privilegio MAINTAIN sobre las dos vistas
--     materializadas (PostgreSQL 17+; antes bastaba ser propietario).
--   * REFRESH MATERIALIZED VIEW CONCURRENTLY exige que la vista esté poblada y
--     que exista al menos un índice UNIQUE construido sólo con nombres de columna,
--     que cubra todas las filas y sin cláusula WHERE. Véase la sección 6.
--   * Sólo puede ejecutarse UN refresco a la vez por vista materializada; el
--     endpoint de refresco de `mgdAnalytics.repository.ts` lo serializa con
--     `pg_try_advisory_lock`.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. PREFLIGHT: dependencias del DAG
--
-- Las referencias a `sigd_rut.pestana_de_estado` se resuelven al PLANIFICAR, no al
-- ejecutar. Sin este chequeo, un entorno con el DAG incompleto fallaría más tarde
-- y el mensaje no señalaría la causa. Se falla aquí, y de forma accionable.
--
-- Se exigen SÓLO los objetos que el motor no puede evitar:
--   * `sigd_tra.expediente` y `sigd_rut.movimiento_tramite` son las fuentes.
--   * `sigd_rut.pestana_de_estado` es la clasificación institucional de pestañas.
--
-- NO se exige `sigd_org.calendario_laboral`: ese catálogo NO tiene DDL en el
-- repositorio y hasta ahora sólo lo leía `crearProveedorFeriados` en
-- `radicacionVirtual.service.ts`, que degrada a un calendario vacío ante su
-- ausencia. Exigirlo aquí volvería estas vistas no instalables en un despliegue
-- limpio. La sección 3 resuelve el caso con dos variantes de la misma definición,
-- de modo que la ausencia del catálogo degrada a "sólo fines de semana" sin
-- duplicar la lógica del calendario.
--
-- Tampoco se exige `sigd_org.unidad_organica`: las vistas materializadas no la
-- necesitan. El nombre y la sigla de la unidad se enriquecen en la capa de
-- servicio, que degrada a NULL si OrganiCore no está instalado.
-- -----------------------------------------------------------------------------
DO $preflight$
DECLARE
    -- `to_regclass` sólo resuelve RELACIONES; una función exige
    -- `to_regprocedure`, con su firma completa. Confundir ambos hace que el
    -- chequeo dé por ausente una función que sí existe.
    v_tablas   TEXT[] := ARRAY[
        'sigd_tra.expediente',
        'sigd_rut.estado_actual_expediente',
        'sigd_rut.movimiento_tramite'
    ];
    v_funciones TEXT[] := ARRAY[
        'sigd_rut.pestana_de_estado(text)'
    ];
    v_faltantes  TEXT[];
BEGIN
    SELECT COALESCE(array_agg(faltante ORDER BY faltante), ARRAY[]::TEXT[])
      INTO v_faltantes
      FROM (
            SELECT t.nombre AS faltante
              FROM unnest(v_tablas) AS t(nombre)
             WHERE to_regclass(t.nombre) IS NULL
            UNION ALL
            SELECT f.nombre
              FROM unnest(v_funciones) AS f(nombre)
             WHERE to_regprocedure(f.nombre) IS NULL
           ) faltantes;

    IF array_length(v_faltantes, 1) IS NOT NULL THEN
        RAISE EXCEPTION
            'MGD_PRERREQUISITOS_INCOMPLETOS: falta(n) % -- instale los esquemas del DAG en orden (identicore, organicore, docucore, tramicore, rutadoc) antes de las vistas materializadas MGD',
            array_to_string(v_faltantes, ', ')
            USING ERRCODE = '3F000',
                  HINT = 'Ver el encabezado de este archivo, seccion INSTALACION.';
    END IF;
END;
$preflight$;

-- -----------------------------------------------------------------------------
-- 1. FUNCIÓN: sigd_tra.fn_mgd_horas_habiles(p_desde, p_hasta, p_feriados)
--
-- Horas hábiles institucionales entre dos instantes. Devuelve NUMERIC porque el
-- driver `pg` entrega los `numeric` como cadena y una suma de horas debe
-- conservar sus decimales: no se castea a INT ni se redondea a entero.
--
-- INDEPENDENCIA DE LA ZONA HORARIA DEL SERVIDOR, Y DOS FORMAS QUE PARECEN
-- EQUIVALENTES Y NO LO SON.
--
-- (a) NO sumar `INTERVAL '5 hours'` a una marca de tiempo sin zona.
--     Al sumar el intervalo a un `timestamp` sin zona, PostgreSQL interpreta el
--     muro local en el `TimeZone` de la SESIÓN. Con `TimeZone = 'UTC'` el
--     resultado es el correcto; con `TimeZone = 'America/Lima'` —o cualquier
--     desplazamiento de -05:00— toda la ventana se desplaza cinco horas: el
--     primer día se recorta de más y el último devuelve cero en vez de su solape
--     real. En el servidor público, cuyo `TimeZone` puede venir del sistema
--     operativo o de `postgresql.conf`, eso haría que el TPR dependiera de la
--     configuración de la máquina y no de los datos. Peor aún: una función que
--     lee el `TimeZone` de la sesión NO es IMMUTABLE, porque el planificador
--     podría cachear un resultado calculado con una zona y reutilizarlo con otra.
--
-- (b) NO usar `AT TIME ZONE '-05:00'`.
--     Es la forma que parece corregida natural, y es la incorrecta. PostgreSQL
--     interpreta una especificación numérica de zona con el convenio POSIX, que
--     tiene el SIGNO INVERTIDO: `'-05:00'` significa UTC**más** 5 horas. Con ella,
--     `2026-09-30 08:00` se convierte a `2026-09-30 03:00+00` en vez de a
--     `13:00+00`, y la jornada 08:00-16:30 se lee como 03:00-11:30 UTC. En el
--     servidor público eso recorta el primer día casi por completo y anula el
--     último.
--
-- La forma usada aquí es la estándar ISO/SQL,
-- `AT TIME ZONE INTERVAL '-05:00' HOUR TO MINUTE`: un intervalo, no una cadena
-- POSIX, así que el signo es el del intervalo y no se invierte. Comprobado en
-- PostgreSQL 18.3: las tres formas devuelven `03:00+00`, `13:00+00` y `13:00+00`
-- para el mismo muro local, y sólo la segunda y la tercera son correctas.
--
-- Se prefiere el intervalo a `'America/Lima'` porque no depende de que el host
-- tenga la base de datos de zonas horarias instalada: es aritmética pura. Lima es
-- UTC-05:00 fijo desde 2019 (no aplica horario de verano), de modo que el
-- desplazamiento es exacto para todo dato del sistema.
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
        -- El intervalo (no la cadena POSIX) lee `dia 08:00` como hora de Lima y
        -- devuelve el instante UTC correspondiente, sea cual sea el `TimeZone` de
        -- la sesión.
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
            SELECT e.id_expediente,
                   e.codigo_expediente,
                   e.creado_en AS fecha_radicacion,
                   -- Mismo intervalo '-05:00' que las secciones 1 y 2, para que el
                   -- módulo no dependa ni de la zona de la sesión ni de la base de
                   -- datos de zonas horarias del host: el corte de mes se define en
                   -- hora de Lima y sólo entonces se agrupa.
                   date_trunc('month',
                       e.creado_en AT TIME ZONE INTERVAL '-05:00' HOUR TO MINUTE)::date
                       AS periodo,
                   -- Centinela en vez de NULL: un índice UNIQUE de PostgreSQL trata
                   -- cada NULL como distinto, de modo que las filas de expedientes sin
                   -- área NO podrían garantizar unicidad y REFRESH ... CONCURRENTLY
                   -- fallaría con "could not create unique index". El centinela sí.
                   COALESCE(NULLIF(btrim(a.area_actual_id), ''), 'SIN_AREA')
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
                ON a.expediente_id = e.id_expediente
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
-- 4. VISTA MATERIALIZADA: sigd_tra.mv_kpis_mgd_mensual
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
CREATE MATERIALIZED VIEW IF NOT EXISTS sigd_tra.mv_kpis_mgd_mensual AS
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

COMMENT ON MATERIALIZED VIEW sigd_tra.mv_kpis_mgd_mensual IS
    'KPIs MGD-PCM por (periodo, unidad_organica_id) con numeradores y denominadores de auditoria. Fuente: vw_mgd_expediente_base.';

-- -----------------------------------------------------------------------------
-- 5. VISTA MATERIALIZADA: sigd_tra.mv_tiempos_retencion_area
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

COMMENT ON MATERIALIZED VIEW sigd_tra.mv_tiempos_retencion_area IS
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
CREATE UNIQUE INDEX IF NOT EXISTS uq_mv_kpis_mgd_mensual
    ON sigd_tra.mv_kpis_mgd_mensual (periodo, unidad_organica_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mv_tiempos_retencion_area
    ON sigd_tra.mv_tiempos_retencion_area
       (periodo, unidad_organica_id, tramo_permanencia_dias_habiles);

-- Índices de acceso del tablero. NO interfieren con los ÚNICOS: el planificador
-- puede combinarlos y jamás pueden sustituir a un UNIQUE.
CREATE INDEX IF NOT EXISTS ix_mv_kpis_mgd_mensual_unidad
    ON sigd_tra.mv_kpis_mgd_mensual (unidad_organica_id, periodo);

CREATE INDEX IF NOT EXISTS ix_mv_tiempos_retencion_area_unidad
    ON sigd_tra.mv_tiempos_retencion_area (unidad_organica_id, periodo);

-- -----------------------------------------------------------------------------
-- 7. COMENTARIOS DE COLUMNA PARA AUDITORÍA
-- -----------------------------------------------------------------------------
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

COMMIT;