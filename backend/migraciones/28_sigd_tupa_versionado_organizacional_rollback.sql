-- =============================================================================
-- Migración 28 · Rollback: Estructura TUPA Versionado + Organizacional + Tarifas
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza" (Pucallpa, Ucayali)
-- =============================================================================
-- ABORTA si existen datos posteriores que dependan de estas estructuras.
-- No usa DROP CASCADE destructivo.
-- =============================================================================

BEGIN;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM sigd_doc.tupa_version
        WHERE periodo_documento IS NOT NULL
           OR uit_vigente IS NOT NULL
           OR fuente_documental IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'Rollback 28 abortado: existen metadatos TUPA que deben conservarse.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM sigd_doc.tupa_procedimiento
        WHERE plazo_fuente IS NOT NULL
           OR calificacion_fuente IS NOT NULL
           OR canal_presentacion IS NOT NULL
           OR unidad_receptora_id IS NOT NULL
           OR unidad_responsable_id IS NOT NULL
           OR unidad_resolutiva_id IS NOT NULL
           OR unidad_financiera_id IS NOT NULL
           OR intervencion_financiera IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'Rollback 28 abortado: existen datos TUPA organizacionales o de procedencia que deben conservarse.';
    END IF;

    IF EXISTS (SELECT 1 FROM sigd_doc.tupa_campo_procedencia)
       OR EXISTS (SELECT 1 FROM sigd_doc.tupa_tarifa_variante) THEN
        RAISE EXCEPTION 'Rollback 28 abortado: existen registros de procedencia o tarifas que deben conservarse.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM sigd_doc.expediente_tupa_vinculo
        WHERE tupa_codigo IS NOT NULL
           OR tupa_anio IS NOT NULL
           OR codigo_ref IS NOT NULL
           OR denominacion_snapshot IS NOT NULL
           OR monto_efectivo IS NOT NULL
           OR tarifa_variante_codigo IS NOT NULL
           OR tarifa_variante_nombre IS NOT NULL
           OR plazo_dias_snapshot IS NOT NULL
           OR calificacion_snapshot IS NOT NULL
           OR canal_presentacion IS NOT NULL
           OR unidad_receptora_id IS NOT NULL
           OR unidad_receptora_codigo IS NOT NULL
           OR unidad_receptora_nombre IS NOT NULL
           OR unidad_responsable_id IS NOT NULL
           OR unidad_responsable_codigo IS NOT NULL
           OR unidad_responsable_nombre IS NOT NULL
           OR unidad_resolutiva_id IS NOT NULL
           OR unidad_resolutiva_codigo IS NOT NULL
           OR unidad_resolutiva_nombre IS NOT NULL
           OR fuente_datos IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'Rollback 28 abortado: existen snapshots históricos que deben conservarse.';
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 28.5 Rollback: Snapshot histórico (columnas agregadas)
-- -----------------------------------------------------------------------------

ALTER TABLE sigd_doc.expediente_tupa_vinculo
    DROP COLUMN IF EXISTS fuente_datos;

ALTER TABLE sigd_doc.expediente_tupa_vinculo
    DROP COLUMN IF EXISTS unidad_resolutiva_nombre;

ALTER TABLE sigd_doc.expediente_tupa_vinculo
    DROP COLUMN IF EXISTS unidad_resolutiva_codigo;

ALTER TABLE sigd_doc.expediente_tupa_vinculo
    DROP COLUMN IF EXISTS unidad_resolutiva_id;

ALTER TABLE sigd_doc.expediente_tupa_vinculo
    DROP COLUMN IF EXISTS unidad_responsable_nombre;

ALTER TABLE sigd_doc.expediente_tupa_vinculo
    DROP COLUMN IF EXISTS unidad_responsable_codigo;

ALTER TABLE sigd_doc.expediente_tupa_vinculo
    DROP COLUMN IF EXISTS unidad_responsable_id;

ALTER TABLE sigd_doc.expediente_tupa_vinculo
    DROP COLUMN IF EXISTS unidad_receptora_nombre;

ALTER TABLE sigd_doc.expediente_tupa_vinculo
    DROP COLUMN IF EXISTS unidad_receptora_codigo;

ALTER TABLE sigd_doc.expediente_tupa_vinculo
    DROP COLUMN IF EXISTS unidad_receptora_id;

ALTER TABLE sigd_doc.expediente_tupa_vinculo
    DROP COLUMN IF EXISTS canal_presentacion;

ALTER TABLE sigd_doc.expediente_tupa_vinculo
    DROP COLUMN IF EXISTS calificacion_snapshot;

ALTER TABLE sigd_doc.expediente_tupa_vinculo
    DROP COLUMN IF EXISTS plazo_dias_snapshot;

ALTER TABLE sigd_doc.expediente_tupa_vinculo
    DROP COLUMN IF EXISTS tarifa_variante_nombre;

ALTER TABLE sigd_doc.expediente_tupa_vinculo
    DROP COLUMN IF EXISTS tarifa_variante_codigo;

ALTER TABLE sigd_doc.expediente_tupa_vinculo
    DROP COLUMN IF EXISTS monto_efectivo;

ALTER TABLE sigd_doc.expediente_tupa_vinculo
    DROP COLUMN IF EXISTS denominacion_snapshot;

ALTER TABLE sigd_doc.expediente_tupa_vinculo
    DROP COLUMN IF EXISTS codigo_ref;

ALTER TABLE sigd_doc.expediente_tupa_vinculo
    DROP COLUMN IF EXISTS tupa_anio;

ALTER TABLE sigd_doc.expediente_tupa_vinculo
    DROP COLUMN IF EXISTS tupa_codigo;

-- -----------------------------------------------------------------------------
-- 28.4 Rollback: Tarifas variantes
-- -----------------------------------------------------------------------------

DROP INDEX IF EXISTS sigd_doc.idx_tupa_tarifa_registro;
DROP INDEX IF EXISTS sigd_doc.idx_tupa_tarifa_proc;
DROP INDEX IF EXISTS sigd_doc.uq_tupa_tarifa_proc_registro_variante;

DROP TABLE IF EXISTS sigd_doc.tupa_tarifa_variante;

-- -----------------------------------------------------------------------------
-- 28.3 Rollback: Procedencia de datos
-- -----------------------------------------------------------------------------

DROP INDEX IF EXISTS sigd_doc.idx_tupa_campo_proc_registro;
DROP INDEX IF EXISTS sigd_doc.idx_tupa_campo_proc_procedimiento;
DROP INDEX IF EXISTS sigd_doc.uq_tupa_campo_proc_proc_registro_campo;

DROP TABLE IF EXISTS sigd_doc.tupa_campo_procedencia;

-- -----------------------------------------------------------------------------
-- 28.2 Rollback: Campos organizacionales
-- -----------------------------------------------------------------------------

DROP INDEX IF EXISTS sigd_doc.idx_tupa_proc_unidad_financiera;
DROP INDEX IF EXISTS sigd_doc.idx_tupa_proc_unidad_resolutiva;
DROP INDEX IF EXISTS sigd_doc.idx_tupa_proc_unidad_responsable;
DROP INDEX IF EXISTS sigd_doc.idx_tupa_proc_unidad_receptora;

ALTER TABLE sigd_doc.tupa_procedimiento
    DROP COLUMN IF EXISTS intervencion_financiera;

ALTER TABLE sigd_doc.tupa_procedimiento
    DROP COLUMN IF EXISTS unidad_financiera_id;

ALTER TABLE sigd_doc.tupa_procedimiento
    DROP COLUMN IF EXISTS unidad_resolutiva_id;

ALTER TABLE sigd_doc.tupa_procedimiento
    DROP COLUMN IF EXISTS unidad_responsable_id;

ALTER TABLE sigd_doc.tupa_procedimiento
    DROP COLUMN IF EXISTS unidad_receptora_id;

ALTER TABLE sigd_doc.tupa_procedimiento
    DROP COLUMN IF EXISTS canal_presentacion;

ALTER TABLE sigd_doc.tupa_procedimiento
    DROP COLUMN IF EXISTS calificacion_fuente;

ALTER TABLE sigd_doc.tupa_procedimiento
    DROP COLUMN IF EXISTS plazo_fuente;

-- -----------------------------------------------------------------------------
-- 28.1 Rollback: Metadatos de versión
-- -----------------------------------------------------------------------------

DROP INDEX IF EXISTS sigd_doc.uq_tupa_version_unica_vigente;

ALTER TABLE sigd_doc.tupa_version
    DROP COLUMN IF EXISTS fuente_documental;

ALTER TABLE sigd_doc.tupa_version
    DROP COLUMN IF EXISTS uit_vigente;

ALTER TABLE sigd_doc.tupa_version
    DROP COLUMN IF EXISTS periodo_documento;

COMMIT;
