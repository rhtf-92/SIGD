-- ============================================================================
-- MIGRACIÓN 54: CENTRO DE IDIOMAS (ÁREA CANÓNICA, ROLES Y CIRCUITO DE SUFICIENCIA)
-- ============================================================================

DO $$
DECLARE
    v_sda_id UUID;
    v_ci_id UUID := 'a0000000-0000-0000-0000-000000000003'::UUID;
BEGIN
    -- 1. Resolver ID de Subdirección Académica (SDA)
    SELECT area_id INTO v_sda_id
      FROM sigd_org.area
     WHERE codigo = 'SDA' AND vigente = true;

    IF v_sda_id IS NULL THEN
        v_sda_id := 'a0000000-0000-0000-0000-000000000001'::UUID;
    END IF;

    -- 2. Insertar o actualizar el Área Canónica Centro de Idiomas (CI) bajo Subdirección Académica
    INSERT INTO sigd_org.area (area_id, codigo, nombre, area_padre_id, tipo_unidad, vigente)
    VALUES (
        v_ci_id,
        'CI',
        'Centro de Idiomas',
        v_sda_id,
        'AREA',
        true
    )
    ON CONFLICT (codigo) DO UPDATE
    SET nombre = 'Centro de Idiomas',
        area_padre_id = EXCLUDED.area_padre_id,
        tipo_unidad = 'AREA',
        vigente = true;

    -- 3. Asegurar tipos documentales oficiales para el circuito
    INSERT INTO sigd_doc.tipo_documento (codigo, nombre, extension, mime_type, tamano_maximo_mb, exige_firma, vigente)
    VALUES
        ('MEMORANDUM', 'Memorándum Institucional', 'pdf', 'application/pdf', 25, false, true),
        ('INFORME', 'Informe Técnico', 'pdf', 'application/pdf', 25, false, true),
        ('CERTIFICADO', 'Certificado Oficial de Suficiencia', 'pdf', 'application/pdf', 25, true, true)
    ON CONFLICT (codigo) DO UPDATE
    SET vigente = true;

    -- 4. Extensión idempotente de sigd_rut.flujo_certificado_ingles para soporte multidioma y memorándum
    IF to_regclass('sigd_rut.flujo_certificado_ingles') IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'sigd_rut' AND table_name = 'flujo_certificado_ingles' AND column_name = 'idioma'
        ) THEN
            ALTER TABLE sigd_rut.flujo_certificado_ingles ADD COLUMN idioma VARCHAR(50) DEFAULT 'INGLES';
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'sigd_rut' AND table_name = 'flujo_certificado_ingles' AND column_name = 'memorandum_sda_numero'
        ) THEN
            ALTER TABLE sigd_rut.flujo_certificado_ingles ADD COLUMN memorandum_sda_numero VARCHAR(100);
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'sigd_rut' AND table_name = 'flujo_certificado_ingles' AND column_name = 'coordinador_idiomas_usuario_id'
        ) THEN
            ALTER TABLE sigd_rut.flujo_certificado_ingles ADD COLUMN coordinador_idiomas_usuario_id UUID;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'sigd_rut' AND table_name = 'flujo_certificado_ingles' AND column_name = 'nivel_alcanzado'
        ) THEN
            ALTER TABLE sigd_rut.flujo_certificado_ingles ADD COLUMN nivel_alcanzado VARCHAR(20);
        END IF;
    END IF;

END $$;
