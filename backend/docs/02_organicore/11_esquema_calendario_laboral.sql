/*
 * OrganiCore — Calendario Laboral y Feriados (T-BE-OC-13)
 * Responsable: B_HECTOR
 * Grupo: Grupo 3 — OrganiCore
 * Rama: B_HECTOR
 * Fecha: 2026-09-28
 * Descripción: Extensión aditiva del esquema `sigd_org` v2. Sustituye el registro
 *              disperso de feriados en scripts sueltos por un calendario laboral
 *              data-driven, indexado por fecha y por año, que elimina la necesidad
 *              de modificar código fuente cada ejercicio fiscal.
 *
 * Marco jurídico:
 *   - TUO Ley N° 27444 (LPAG), Art. 143: plazo máximo de 30 días hábiles.
 *   - D. Leg. N° 713: feriados nacionales no laborables.
 *   - D. Leg. N° 0286 / ORM de Ucayali: feriados regionales de no laborabilidad
 *     (24 de junio y 13 de octubre).
 *
 * Ejecución:
 *   psql -h localhost -p 5432 -U postgres -d sigd_prueba -v ON_ERROR_STOP=1 \
 *        -f docs/02_organicore/11_esquema_calendario_laboral.sql
 *
 * Es idempotente: puede aplicarse sobre una base ya deployada.
 */

CREATE SCHEMA IF NOT EXISTS sigd_org;

-- =============================================================================
-- 1. TIPO DE FERIADO
-- -----------------------------------------------------------------------------
-- Taxonomía cerrada exigida por la especificación de la tarea. Los días
-- laborables excepcionales (por ejemplo, un sábado habilitado por resolución
-- directorial) NO son feriados: se registran con `es_laborable = TRUE` y
-- `tipo_feriado = NULL`, para no ensuciar el catálogo jurídico de feriados.
-- =============================================================================
DO $$
BEGIN
    CREATE TYPE sigd_org.tipo_feriado_enum AS ENUM (
        'NACIONAL',             -- D. Leg. N° 713
        'REGIONAL_UCAYALI',     -- Feriados regionales de no laborabilidad de Ucayali
        'INSTITUCIONAL',        -- Órgano resolver del IESTP "Suiza"
        'DUELO_NACIONAL'        -- Duelo nacional decretado por el Estado
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;

COMMENT ON TYPE sigd_org.tipo_feriado_enum IS
    'Clasificación normativa del día no laborable según el Art. 143 del TUO Ley N° 27444.';

-- =============================================================================
-- 2. CALENDARIO LABORAL
-- -----------------------------------------------------------------------------
-- Tabla canónica del calendario laboral institucional. Cada fila es una
-- EXCEPCIÓN al calendario laborable base (lunes a viernes):
--   * es_laborable = FALSE  → día no laborable (feriado). Exige tipo_feriado.
--   * es_laborable = TRUE   → día laborable excepcional (fin de semana que se
--                             habilita por resolución). Sin tipo_feriado.
--
-- La restricción UNIQUE (fecha, unidad_territorial) garantiza que no existan
-- registros duplicados para la misma fecha dentro de la misma unidad territorial.
-- =============================================================================
CREATE TABLE IF NOT EXISTS sigd_org.calendario_laboral (
    id_calendario       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha               DATE NOT NULL,
    anio                SMALLINT GENERATED ALWAYS AS ((EXTRACT(YEAR FROM fecha))::SMALLINT) STORED,
    tipo_feriado        sigd_org.tipo_feriado_enum,
    descripcion         VARCHAR(200) NOT NULL,
    unidad_territorial  VARCHAR(60) NOT NULL DEFAULT 'IESTP_SUIZA',
    es_laborable        BOOLEAN NOT NULL DEFAULT FALSE,
    base_legal          TEXT,
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    registrado_por      UUID,
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Unicidad del calendario: no puede haber dos filas para la misma fecha
    -- dentro de la misma unidad territorial (criterio de aceptación 3).
    CONSTRAINT uq_calendario_laboral_fecha_unidad UNIQUE (fecha, unidad_territorial),
    CONSTRAINT ck_calendario_laboral_unidad
        CHECK (unidad_territorial IN ('NACIONAL', 'UCAYALI', 'IESTP_SUIZA')),
    CONSTRAINT ck_calendario_laboral_descripcion
        CHECK (btrim(descripcion) <> ''),
    -- Coherencia entre el indicador de laborabilidad y la clasificación normativa.
    CONSTRAINT ck_calendario_laboral_coherencia
        CHECK (
            (es_laborable AND tipo_feriado IS NULL)
            OR (NOT es_laborable AND tipo_feriado IS NOT NULL)
        )
);

-- Indexación eficiente por fecha (consultas puntuales del semáforo SLA).
CREATE INDEX IF NOT EXISTS idx_calendario_laboral_fecha
    ON sigd_org.calendario_laboral (fecha);

-- Indexación eficiente por año (carga del calendario de un ejercicio fiscal).
CREATE INDEX IF NOT EXISTS idx_calendario_laboral_anio
    ON sigd_org.calendario_laboral (anio);

-- Índice parcial para la ruta caliente del cómputo de días hábiles: sólo interesan
-- las filas activas que no habilitan el día.
CREATE INDEX IF NOT EXISTS idx_calendario_laboral_no_laborable
    ON sigd_org.calendario_laboral (anio, fecha)
    WHERE activo = TRUE AND es_laborable = FALSE;

COMMENT ON TABLE sigd_org.calendario_laboral IS
    'Calendario laboral institucional data-driven. Elimina el registro manual de feriados en scripts dispersos.';
COMMENT ON COLUMN sigd_org.calendario_laboral.anio IS
    'Ejercicio fiscal derivado de la fecha (columna generada STORED) para indexación por año.';
COMMENT ON COLUMN sigd_org.calendario_laboral.unidad_territorial IS
    'Ámbito del calendario: NACIONAL, UCAYALI o IESTP_SUIZA. Entra en la clave de unicidad.';
COMMENT ON COLUMN sigd_org.calendario_laboral.es_laborable IS
    'TRUE habilita el día (excepción laborable); FALSE lo declara no laborable.';
COMMENT ON COLUMN sigd_org.calendario_laboral.activo IS
    'Permite dar de baja una excepción sin borrarla (lógica de borrado del proyecto).';

-- Mantiene actualizado_en ante cualquier mutación (patrón de sigd_tra.tramite).
CREATE OR REPLACE FUNCTION sigd_org.fn_calendario_laboral_touch_actualizado_en()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = sigd_org, public
AS $$
BEGIN
    NEW.actualizado_en := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_calendario_laboral_touch ON sigd_org.calendario_laboral;
CREATE TRIGGER trg_calendario_laboral_touch
    BEFORE UPDATE ON sigd_org.calendario_laboral
    FOR EACH ROW
    EXECUTE FUNCTION sigd_org.fn_calendario_laboral_touch_actualizado_en();

-- =============================================================================
-- 3. FUNCIÓN DE APOYO
-- -----------------------------------------------------------------------------
-- ¿Es la fecha un día no laborable según el calendario institucional vigente?
-- Es la única fuente de verdad para el cómputo de días hábiles del Art. 143
-- (30 días hábiles) y, por extensión, del semáforo SLA de expedientes activos.
--
-- Regla de resolución ante coexistencia: manda el registro `es_laborable = TRUE`
-- (habilitación expresa) sobre el feriado, porque es la resolución posterior.
-- =============================================================================
CREATE OR REPLACE FUNCTION sigd_org.es_dia_no_laborable(p_fecha DATE)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
    SELECT NOT EXISTS (
        SELECT 1
          FROM sigd_org.calendario_laboral AS c
         WHERE c.fecha = p_fecha
           AND c.activo = TRUE
           AND c.es_laborable = TRUE
    ) AND EXISTS (
        SELECT 1
          FROM sigd_org.calendario_laboral AS c
         WHERE c.fecha = p_fecha
           AND c.activo = TRUE
           AND c.es_laborable = FALSE
    );
$$;

COMMENT ON FUNCTION sigd_org.es_dia_no_laborable(DATE) IS
    'Resuelve la no laborabilidad de una fecha desde el calendario institucional (fin de semana se evalúa en la aplicación).';

-- =============================================================================
-- 4. CARGA INICIAL DEL CALENDARIO (idempotente)
-- -----------------------------------------------------------------------------
-- Genera los feriados de fecha fija del D. Leg. N° 713 y los feriados regionales
-- de Ucayali para un rango de ejercicios fiscales, de modo que los nuevos
-- ejercidos se cargan con una sentencia y no editando código fuente.
-- Los feriados condicionados a la Cuaresma (Jueves y Viernes Santo) dependen del
-- calendario litúrgico: NO se precargan aquí; se registran por el endpoint de
-- feriado excepcional con su base legal (decreto o resolución ministerial).
-- =============================================================================
INSERT INTO sigd_org.calendario_laboral
    (fecha, tipo_feriado, descripcion, unidad_territorial, es_laborable, base_legal)
SELECT
    make_date(a.anio::INT, v.mes, v.dia),
    v.tipo::sigd_org.tipo_feriado_enum,
    v.descripcion,
    v.unidad,
    FALSE,
    v.base_legal
FROM (VALUES
    -- D. Leg. N° 713: feriados nacionales no laborables
    ( 1,  1, 'NACIONAL',         'NACIONAL', 'Año Nuevo',                           'D. Leg. N° 713'),
    ( 5,  1, 'NACIONAL',         'NACIONAL', 'Día del Trabajo',                     'D. Leg. N° 713'),
    ( 6,  7, 'NACIONAL',         'NACIONAL', 'Batalla de Arica y Día de la Bandera', 'D. Leg. N° 713'),
    ( 6, 29, 'NACIONAL',         'NACIONAL', 'San Pedro y San Pablo',                'D. Leg. N° 713'),
    ( 7, 23, 'NACIONAL',         'NACIONAL', 'Día de la Fuerza Aérea del Perú',      'D. Leg. N° 713'),
    ( 7, 28, 'NACIONAL',         'NACIONAL', 'Fiestas Patrias (Primer día)',         'D. Leg. N° 713'),
    ( 7, 29, 'NACIONAL',         'NACIONAL', 'Fiestas Patrias (Segundo día)',        'D. Leg. N° 713'),
    ( 8,  6, 'NACIONAL',         'NACIONAL', 'Batalla de Junín',                     'D. Leg. N° 713'),
    ( 8, 30, 'NACIONAL',         'NACIONAL', 'Santa Rosa de Lima',                   'D. Leg. N° 713'),
    (10,  8, 'NACIONAL',         'NACIONAL', 'Combate de Angamos',                   'D. Leg. N° 713'),
    (11,  1, 'NACIONAL',         'NACIONAL', 'Día de Todos los Santos',              'D. Leg. N° 713'),
    (12,  8, 'NACIONAL',         'NACIONAL', 'Inmaculada Concepción',                'D. Leg. N° 713'),
    (12,  9, 'NACIONAL',         'NACIONAL', 'Batalla de Ayacucho',                  'D. Leg. N° 713'),
    (12, 25, 'NACIONAL',         'NACIONAL', 'Navidad',                              'D. Leg. N° 713'),
    -- Feriados regionales de no laborabilidad del departamento de Ucayali
    ( 6, 24, 'REGIONAL_UCAYALI', 'UCAYALI',  'Fiesta Patronal de San Juan Bautista', 'Ley N° 29001 - Ucayali'),
    (10, 13, 'REGIONAL_UCAYALI', 'UCAYALI',  'Aniversario de la Provincia de Coronel Portillo (Pucallpa)', 'Ley N° 29001 - Ucayali')
) AS v(mes, dia, tipo, unidad, descripcion, base_legal)
CROSS JOIN (SELECT generate_series(2026, 2030) AS anio) AS a
ON CONFLICT (fecha, unidad_territorial) DO NOTHING;

-- =============================================================================
-- 5. PERMISO DE ADMINISTRACIÓN DEL CALENDARIO (T-BE-OC-16)
-- -----------------------------------------------------------------------------
-- `POST /api/v1/admin/calendario-laboral/feriado-excepcional` altera el cómputo
-- legal de plazos del Art. 143 LPAG para todos los expedientes, por lo que exige
-- autenticación y el permiso `CALENDARIO_LABORAL_GESTIONAR` del modelo RBAC que
-- el proyecto ya define en `sigd_org.permiso_sistema` / `rol_sistema` /
-- `rol_permiso` / `usuario_rol`.
--
-- Aquí sólo se declara el permiso y el rol que lo otorga; asignar el rol a una
-- cuenta (`usuario_rol`) es una decisión de despliegue. El middleware
-- `src/middleware/autorizacion.ts` falla cerrado: si este bloque no se aplicó,
-- el endpoint responde 403 y nadie puede registrar feriados.
--
-- El bloque va dentro de un DO para no romper la aplicación del resto del
-- archivo en bases donde el esquema RBAC todavía no está desplegado (el proyecto
-- despliega los DDL por olas independientes).
-- =============================================================================
DO $$
BEGIN
    IF to_regclass('sigd_org.permiso_sistema') IS NULL
       OR to_regclass('sigd_org.rol_sistema') IS NULL
       OR to_regclass('sigd_org.rol_permiso') IS NULL THEN
        RAISE NOTICE
            '[calendario_laboral] Esquema RBAC de sigd_org no disponible: no se siembra el permiso CALENDARIO_LABORAL_GESTIONAR.';
        RETURN;
    END IF;

    INSERT INTO sigd_org.permiso_sistema (codigo, descripcion, alcance_predeterminado)
    VALUES (
        'CALENDARIO_LABORAL_GESTIONAR',
        'Registrar feriados y habilizaciones expresas en el calendario laboral oficial.',
        'GLOBAL'
    )
    ON CONFLICT (codigo) DO NOTHING;

    INSERT INTO sigd_org.rol_sistema (codigo, nombre, descripcion)
    VALUES (
        'ADMIN_CALENDARIO_LABORAL',
        'Administrador del calendario laboral',
        'Puede registrar feriados y habilitaciones expresas que alteran los plazos legales.'
    )
    ON CONFLICT (codigo) DO NOTHING;

    INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
    SELECT r.rol_id, p.permiso_id
      FROM sigd_org.rol_sistema     AS r
      JOIN sigd_org.permiso_sistema AS p ON p.codigo = 'CALENDARIO_LABORAL_GESTIONAR'
     WHERE r.codigo = 'ADMIN_CALENDARIO_LABORAL'
    ON CONFLICT DO NOTHING;
END
$$;

-- =============================================================================
-- 6. VERIFICACIÓN (opcional)
-- -----------------------------------------------------------------------------
-- SELECT anio, COUNT(*) AS dias FROM sigd_org.calendario_laboral
--  WHERE activo GROUP BY anio ORDER BY anio;
-- SELECT * FROM sigd_org.calendario_laboral WHERE anio = 2026 ORDER BY fecha;
-- SELECT fecha, descripcion FROM sigd_org.calendario_laboral
--  WHERE tipo_feriado = 'REGIONAL_UCAYALI' AND anio = 2026 ORDER BY fecha;
-- SELECT codigo FROM sigd_org.permiso_sistema
--  WHERE codigo = 'CALENDARIO_LABORAL_GESTIONAR';
-- =============================================================================
