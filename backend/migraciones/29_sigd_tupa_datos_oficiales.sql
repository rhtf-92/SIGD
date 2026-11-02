-- =============================================================================
-- Migración 29 · Datos oficiales TUPA 2026 + Variantes de tarifa + Corrección p2-fila-05
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza" (Pucallpa, Ucayali)
-- =============================================================================
-- SOLO DATOS. No crea estructura.
-- Rollback aborta si existen dependencias posteriores (tarifas usadas, snapshots, etc.)
-- =============================================================================

BEGIN;

LOCK TABLE sigd_doc.tupa_tarifa_variante IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM sigd_doc.tupa_version
        WHERE codigo = 'TUPA-2026'
          AND (periodo_documento IS NOT NULL
               OR uit_vigente IS NOT NULL
               OR fuente_documental IS NOT NULL)
    ) THEN
        RAISE EXCEPTION 'Migración 29 abortada: los metadatos TUPA-2026 no están en su estado inicial NULL.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM sigd_doc.tupa_procedimiento p
        JOIN sigd_doc.tupa_version v ON v.id_version = p.id_version
        JOIN sigd_doc.tupa_tarifa_variante tv
          ON tv.id_procedimiento = p.id_procedimiento
         AND tv.id_registro_version = p.registro_version_id
        JOIN (VALUES
            ('p3-fila-01', 'HEMBRAS'),
            ('p3-fila-01', 'MACHOS'),
            ('p3-fila-06', 'REPRODUCTOR'),
            ('p3-fila-06', 'CARNE'),
            ('p3-fila-07', 'CARCASA'),
            ('p3-fila-07', 'EN_PIE')
        ) AS esperado(codigo_ref, codigo_variante)
          ON esperado.codigo_ref = p.codigo_ref
         AND esperado.codigo_variante = tv.codigo_variante
        WHERE v.codigo = 'TUPA-2026'
    ) THEN
        RAISE EXCEPTION 'Migración 29 abortada: ya existen tarifas variantes objetivo; no es posible atribuirlas a esta migración.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM sigd_doc.tupa_procedimiento p
        JOIN sigd_doc.tupa_version v ON v.id_version = p.id_version
        WHERE v.codigo = 'TUPA-2026'
          AND p.codigo_ref = 'p2-fila-05'
          AND p.monto IS DISTINCT FROM 1.00
    ) THEN
        RAISE EXCEPTION 'Migración 29 abortada: p2-fila-05 no tiene el monto inicial esperado S/1.00.';
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 29.1 Metadatos de versión TUPA-2026 (solo si existe)
-- -----------------------------------------------------------------------------

UPDATE sigd_doc.tupa_version
SET
    periodo_documento = '2026-01',
    uit_vigente = 5500.00,
    fuente_documental = 'TUPA_2026_IESTP_Suiza.pdf (documento oficial local)',
    actualizado_en = now()
WHERE codigo = 'TUPA-2026';

-- -----------------------------------------------------------------------------
-- 29.2 Variantes de tarifa oficiales (sigd_doc.tupa_tarifa_variante)
-- -----------------------------------------------------------------------------

-- p3-fila-01: Venta de Patos Pichones
-- HEMBRAS = 30.00, MACHOS = 40.00 (fuente: TUPA oficial)
INSERT INTO sigd_doc.tupa_tarifa_variante (
    id_procedimiento, id_registro_version, codigo_variante, nombre_variante,
    descripcion, monto, moneda, orden, fuente
)
SELECT
    p.id_procedimiento,
    p.registro_version_id,
    'HEMBRAS', 'Pichones hembras', 'Pichones de pato hembra (TUPA oficial)',
    30.00, 'PEN', 1, 'OFICIAL'
FROM sigd_doc.tupa_procedimiento p
WHERE p.codigo_ref = 'p3-fila-01'
  AND p.id_version = (SELECT id_version FROM sigd_doc.tupa_version WHERE codigo = 'TUPA-2026');

INSERT INTO sigd_doc.tupa_tarifa_variante (
    id_procedimiento, id_registro_version, codigo_variante, nombre_variante,
    descripcion, monto, moneda, orden, fuente
)
SELECT
    p.id_procedimiento,
    p.registro_version_id,
    'MACHOS', 'Pichones machos', 'Pichones de pato macho (TUPA oficial)',
    40.00, 'PEN', 2, 'OFICIAL'
FROM sigd_doc.tupa_procedimiento p
WHERE p.codigo_ref = 'p3-fila-01'
  AND p.id_version = (SELECT id_version FROM sigd_doc.tupa_version WHERE codigo = 'TUPA-2026');

-- p3-fila-06: Venta de Porcino en Pie Kg
-- REPRODUCTOR = 25.00, CARNE = 15.00 (fuente: TUPA oficial)
INSERT INTO sigd_doc.tupa_tarifa_variante (
    id_procedimiento, id_registro_version, codigo_variante, nombre_variante,
    descripcion, monto, moneda, orden, fuente
)
SELECT
    p.id_procedimiento,
    p.registro_version_id,
    'REPRODUCTOR', 'Porcino reproductor', 'Porcino en pie para reproducción (TUPA oficial)',
    25.00, 'PEN', 1, 'OFICIAL'
FROM sigd_doc.tupa_procedimiento p
WHERE p.codigo_ref = 'p3-fila-06'
  AND p.id_version = (SELECT id_version FROM sigd_doc.tupa_version WHERE codigo = 'TUPA-2026');

INSERT INTO sigd_doc.tupa_tarifa_variante (
    id_procedimiento, id_registro_version, codigo_variante, nombre_variante,
    descripcion, monto, moneda, orden, fuente
)
SELECT
    p.id_procedimiento,
    p.registro_version_id,
    'CARNE', 'Porcino carne', 'Porcino en pie para carne (TUPA oficial)',
    15.00, 'PEN', 2, 'OFICIAL'
FROM sigd_doc.tupa_procedimiento p
WHERE p.codigo_ref = 'p3-fila-06'
  AND p.id_version = (SELECT id_version FROM sigd_doc.tupa_version WHERE codigo = 'TUPA-2026');

-- p3-fila-07: Venta de Ganado Vacuno en pie Kg
-- CARCASA = 20.00, EN_PIE = 15.00 (fuente: TUPA oficial)
INSERT INTO sigd_doc.tupa_tarifa_variante (
    id_procedimiento, id_registro_version, codigo_variante, nombre_variante,
    descripcion, monto, moneda, orden, fuente
)
SELECT
    p.id_procedimiento,
    p.registro_version_id,
    'CARCASA', 'Ganado vacuno carcasa', 'Carne de res sin pata ni cabeza por kg (TUPA oficial)',
    20.00, 'PEN', 1, 'OFICIAL'
FROM sigd_doc.tupa_procedimiento p
WHERE p.codigo_ref = 'p3-fila-07'
  AND p.id_version = (SELECT id_version FROM sigd_doc.tupa_version WHERE codigo = 'TUPA-2026');

INSERT INTO sigd_doc.tupa_tarifa_variante (
    id_procedimiento, id_registro_version, codigo_variante, nombre_variante,
    descripcion, monto, moneda, orden, fuente
)
SELECT
    p.id_procedimiento,
    p.registro_version_id,
    'EN_PIE', 'Ganado vacuno en pie', 'Ganado vacuno en pie por kg (TUPA oficial)',
    15.00, 'PEN', 2, 'OFICIAL'
FROM sigd_doc.tupa_procedimiento p
WHERE p.codigo_ref = 'p3-fila-07'
  AND p.id_version = (SELECT id_version FROM sigd_doc.tupa_version WHERE codigo = 'TUPA-2026');

-- -----------------------------------------------------------------------------
-- 29.3 Corrección p2-fila-05: Alquiler de Ambientes para servicio de alimentación
-- TUPA oficial: S/1,000.00. SIGD tenía S/1.00 (error de digitación).
-- SOLO corrige el catálogo para nuevas radicaciones. No modifica hechos históricos.
-- -----------------------------------------------------------------------------

UPDATE sigd_doc.tupa_procedimiento
SET monto = 1000.00,
    actualizado_en = now()
WHERE codigo_ref = 'p2-fila-05'
  AND id_version = (SELECT id_version FROM sigd_doc.tupa_version WHERE codigo = 'TUPA-2026')
  AND monto = 1.00;

COMMIT;
