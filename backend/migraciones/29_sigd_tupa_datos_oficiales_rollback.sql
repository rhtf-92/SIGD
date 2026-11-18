-- =============================================================================
-- Migración 29 · Rollback: Datos oficiales TUPA 2026 + Variantes de tarifa
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza" (Pucallpa, Ucayali)
-- =============================================================================
-- ABORTA si existen datos posteriores incompatibles.
-- No usa DROP CASCADE.
-- =============================================================================

BEGIN;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM sigd_doc.tupa_version
        WHERE codigo = 'TUPA-2026'
          AND (periodo_documento IS DISTINCT FROM '2026-01'
               OR uit_vigente IS DISTINCT FROM 5500.00
               OR fuente_documental IS DISTINCT FROM 'TUPA_2026_IESTP_Suiza.pdf (documento oficial local)')
    ) THEN
        RAISE EXCEPTION 'Rollback 29 abortado: los metadatos TUPA-2026 cambiaron desde la migración.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM sigd_doc.tupa_procedimiento p
        JOIN sigd_doc.tupa_version tv ON tv.id_version = p.id_version
        WHERE tv.codigo = 'TUPA-2026'
          AND p.codigo_ref = 'p2-fila-05'
          AND p.monto IS DISTINCT FROM 1000.00
    ) THEN
        RAISE EXCEPTION 'Rollback 29 abortado: p2-fila-05 cambió desde el monto oficial aplicado.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM sigd_doc.expediente_tupa_vinculo v
        JOIN sigd_doc.tupa_procedimiento p
          ON p.registro_version_id = v.registro_version_id
         AND p.codigo_ref = v.codigo_ref
        JOIN sigd_doc.tupa_version tv ON tv.id_version = p.id_version
        WHERE tv.codigo = 'TUPA-2026'
          AND v.tarifa_variante_codigo IN ('HEMBRAS', 'MACHOS', 'REPRODUCTOR', 'CARNE', 'CARCASA', 'EN_PIE')
    ) THEN
        RAISE EXCEPTION 'Rollback 29 abortado: existen snapshots que dependen de variantes de tarifa TUPA-2026.';
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 29.3 Rollback: Restaurar p2-fila-05 monto original (S/1.00)
-- Solo si no hay órdenes de pago o snapshots que dependan del monto corregido.
-- -----------------------------------------------------------------------------

DO $$
DECLARE
    v_count_ordenes INTEGER;
    v_count_snapshots INTEGER;
BEGIN
    -- Verificar que no existan órdenes de pago con monto 1000.00 para este procedimiento
    SELECT count(*) INTO v_count_ordenes
    FROM sigd_tra.orden_pago op
    JOIN sigd_doc.tupa_procedimiento p ON op.codigo_tupa = p.codigo_ref
    WHERE p.codigo_ref = 'p2-fila-05'
      AND op.monto = 1000.00;

    IF v_count_ordenes > 0 THEN
        RAISE EXCEPTION 'Rollback abortado: existen órdenes de pago con monto corregido (S/1,000.00) para p2-fila-05. No se puede revertir.';
    END IF;

    -- Verificar que no existan snapshots con monto 1000.00 para este procedimiento
    SELECT count(*) INTO v_count_snapshots
    FROM sigd_doc.expediente_tupa_vinculo v
    WHERE v.codigo_ref = 'p2-fila-05'
      AND v.monto_efectivo = 1000.00;

    IF v_count_snapshots > 0 THEN
        RAISE EXCEPTION 'Rollback abortado: existen snapshots históricos con monto corregido (S/1,000.00) para p2-fila-05. No se puede revertir.';
    END IF;

    -- Revertir monto a 1.00
    UPDATE sigd_doc.tupa_procedimiento
    SET monto = 1.00,
        actualizado_en = now()
    WHERE codigo_ref = 'p2-fila-05'
      AND id_version = (SELECT id_version FROM sigd_doc.tupa_version WHERE codigo = 'TUPA-2026')
      AND monto = 1000.00;
END $$;

-- -----------------------------------------------------------------------------
-- 29.2 Rollback: Eliminar variantes de tarifa oficiales
-- Solo si no hay órdenes de pago ni snapshots que las referencien.
-- -----------------------------------------------------------------------------

DO $$
BEGIN
    -- Eliminar variantes insertadas por esta migración
    DELETE FROM sigd_doc.tupa_tarifa_variante tv
    USING sigd_doc.tupa_procedimiento p,
          sigd_doc.tupa_version version,
          (VALUES
              ('p3-fila-01', 'HEMBRAS', 30.00),
              ('p3-fila-01', 'MACHOS', 40.00),
              ('p3-fila-06', 'REPRODUCTOR', 25.00),
              ('p3-fila-06', 'CARNE', 15.00),
              ('p3-fila-07', 'CARCASA', 20.00),
              ('p3-fila-07', 'EN_PIE', 15.00)
          ) AS esperado(codigo_ref, codigo_variante, monto)
    WHERE version.codigo = 'TUPA-2026'
      AND p.id_version = version.id_version
      AND p.codigo_ref = esperado.codigo_ref
      AND tv.id_procedimiento = p.id_procedimiento
      AND tv.id_registro_version = p.registro_version_id
      AND tv.codigo_variante = esperado.codigo_variante
      AND tv.fuente = 'OFICIAL'
      AND tv.monto = esperado.monto;
END $$;

-- -----------------------------------------------------------------------------
-- 29.1 Rollback: Restaurar metadatos de versión TUPA-2026
-- -----------------------------------------------------------------------------

UPDATE sigd_doc.tupa_version
SET
    periodo_documento = NULL,
    uit_vigente = NULL,
    fuente_documental = NULL,
    actualizado_en = now()
WHERE codigo = 'TUPA-2026';

COMMIT;
