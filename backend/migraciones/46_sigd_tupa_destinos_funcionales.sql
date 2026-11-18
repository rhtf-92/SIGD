-- ==============================================================================
-- MIGRACIÓN 46: Configuración de Destinos Funcionales y Estructura Organizacional TUPA
-- FASE C1: Matriz de Destinos, Identidad Institucional y Asignación Operativa
-- ==============================================================================
-- Áreas físicas canónicas:
--   DIR: a0000000-0000-0000-0000-000000000002 (Dirección General)
--   SDA: a0000000-0000-0000-0000-000000000001 (Subdirección Académica)
-- Funciones institucionales operativas:
--   Mesa de Partes -> Adscrita a DIR (GESTOR_RECEPCION_DOCUMENTAL)
--   Tesorería      -> Adscrita a DIR (GESTOR_TESORERIA)
--   Académica      -> Adscrita a SDA (GESTOR_AREA_ACADEMICA)
-- Total procedimientos cubiertos: 72 (TUPA-2026 VIGENTE)
-- ==============================================================================

BEGIN;

DO $$
DECLARE
    v_version_id UUID;
    v_dir_id UUID;
    v_sda_id UUID;
    v_total_proc INT;
    v_mapping_count INT;
    v_updated_count INT;
    v_null_units_count INT;
BEGIN
    -- 1. PRECONDICIONES: Validar existencia de versión TUPA-2026 vigente
    SELECT id_version INTO v_version_id
      FROM sigd_doc.tupa_version
     WHERE codigo = 'TUPA-2026' AND estado = 'VIGENTE';

    IF v_version_id IS NULL THEN
        RAISE EXCEPTION 'MIGRACION_46_ERROR: No se encontró la versión TUPA-2026 con estado VIGENTE.';
    END IF;

    -- 2. PRECONDICIONES: Validar existencia y vigencia de áreas físicas DIR y SDA
    SELECT area_id INTO v_dir_id
      FROM sigd_org.area
     WHERE codigo = 'DIR' AND vigente = true;

    IF v_dir_id IS NULL THEN
        RAISE EXCEPTION 'MIGRACION_46_ERROR: Área canónica DIR (Dirección General) no existe o no está vigente.';
    END IF;

    SELECT area_id INTO v_sda_id
      FROM sigd_org.area
     WHERE codigo = 'SDA' AND vigente = true;

    IF v_sda_id IS NULL THEN
        RAISE EXCEPTION 'MIGRACION_46_ERROR: Área canónica SDA (Subdirección Académica) no existe o no está vigente.';
    END IF;

    -- 3. PRECONDICIONES: Validar total de procedimientos en TUPA-2026
    SELECT COUNT(*) INTO v_total_proc
      FROM sigd_doc.tupa_procedimiento
     WHERE id_version = v_version_id;

    IF v_total_proc <> 72 THEN
        RAISE EXCEPTION 'MIGRACION_46_ERROR: Se esperaban 72 procedimientos en TUPA-2026, pero se encontraron %.', v_total_proc;
    END IF;

    -- 4. Crear tabla temporal determinista con la matriz ejecutable de los 72 procedimientos
    CREATE TEMP TABLE tmp_tupa_destinos_c1 (
        codigo_ref VARCHAR(50) PRIMARY KEY,
        rec_cod VARCHAR(20) NOT NULL,
        resp_cod VARCHAR(20) NOT NULL,
        resol_cod VARCHAR(20) NOT NULL,
        fin_cod VARCHAR(20) NOT NULL,
        interv_fin VARCHAR(20) NOT NULL
    ) ON COMMIT DROP;

    INSERT INTO tmp_tupa_destinos_c1 (codigo_ref, rec_cod, resp_cod, resol_cod, fin_cod, interv_fin)
    VALUES
    ('p1-fila-01', 'DIR', 'SDA', 'SDA', 'DIR', 'REQUIERE_PAGO'),
    ('p1-fila-02', 'DIR', 'SDA', 'SDA', 'DIR', 'REQUIERE_PAGO'),
    ('p1-fila-03', 'DIR', 'SDA', 'SDA', 'DIR', 'REQUIERE_PAGO'),
    ('p1-fila-04', 'DIR', 'SDA', 'SDA', 'DIR', 'REQUIERE_PAGO'),
    ('p1-fila-05', 'DIR', 'SDA', 'DIR', 'DIR', 'REQUIERE_PAGO'),
    ('p1-fila-06', 'DIR', 'SDA', 'DIR', 'DIR', 'REQUIERE_PAGO'),
    ('p1-fila-07', 'DIR', 'SDA', 'SDA', 'DIR', 'REQUIERE_PAGO'),
    ('p1-fila-08', 'DIR', 'SDA', 'SDA', 'DIR', 'REQUIERE_PAGO'),
    ('p1-fila-09', 'DIR', 'SDA', 'SDA', 'DIR', 'REQUIERE_PAGO'),
    ('p1-fila-10', 'DIR', 'DIR', 'DIR', 'DIR', 'REQUIERE_PAGO'),
    ('p2-fila-01', 'DIR', 'DIR', 'DIR', 'DIR', 'REQUIERE_PAGO'),
    ('p2-fila-02', 'DIR', 'DIR', 'DIR', 'DIR', 'REQUIERE_PAGO'),
    ('p2-fila-03', 'DIR', 'DIR', 'DIR', 'DIR', 'REQUIERE_PAGO'),
    ('p2-fila-04', 'DIR', 'DIR', 'DIR', 'DIR', 'REQUIERE_PAGO'),
    ('p2-fila-05', 'DIR', 'DIR', 'DIR', 'DIR', 'REQUIERE_PAGO'),
    ('p2-fila-06', 'DIR', 'DIR', 'DIR', 'DIR', 'REQUIERE_PAGO'),
    ('p2-fila-07', 'DIR', 'DIR', 'DIR', 'DIR', 'REQUIERE_PAGO'),
    ('p2-fila-08', 'DIR', 'DIR', 'DIR', 'DIR', 'REQUIERE_PAGO'),
    ('p2-fila-09', 'DIR', 'DIR', 'DIR', 'DIR', 'REQUIERE_PAGO'),
    ('p2-fila-10', 'DIR', 'DIR', 'DIR', 'DIR', 'REQUIERE_PAGO'),
    ('p3-fila-01', 'DIR', 'DIR', 'DIR', 'DIR', 'REQUIERE_PAGO'),
    ('p3-fila-02', 'DIR', 'DIR', 'DIR', 'DIR', 'REQUIERE_PAGO'),
    ('p3-fila-03', 'DIR', 'DIR', 'DIR', 'DIR', 'REQUIERE_PAGO'),
    ('p3-fila-04', 'DIR', 'DIR', 'DIR', 'DIR', 'REQUIERE_PAGO'),
    ('p3-fila-05', 'DIR', 'DIR', 'DIR', 'DIR', 'REQUIERE_PAGO'),
    ('p3-fila-06', 'DIR', 'DIR', 'DIR', 'DIR', 'REQUIERE_PAGO'),
    ('p3-fila-07', 'DIR', 'DIR', 'DIR', 'DIR', 'REQUIERE_PAGO'),
    ('p3-fila-08', 'DIR', 'DIR', 'DIR', 'DIR', 'REQUIERE_PAGO'),
    ('p4-fila-01', 'DIR', 'DIR', 'DIR', 'DIR', 'REQUIERE_PAGO'),
    ('p4-fila-02', 'DIR', 'DIR', 'DIR', 'DIR', 'REQUIERE_PAGO'),
    ('p4-fila-03', 'DIR', 'SDA', 'SDA', 'DIR', 'REQUIERE_PAGO'),
    ('p4-fila-04', 'DIR', 'SDA', 'SDA', 'DIR', 'REQUIERE_PAGO'),
    ('p4-fila-05', 'DIR', 'SDA', 'DIR', 'DIR', 'REQUIERE_PAGO'),
    ('p4-fila-06', 'DIR', 'SDA', 'DIR', 'DIR', 'REQUIERE_PAGO'),
    ('p4-fila-07', 'DIR', 'SDA', 'DIR', 'DIR', 'REQUIERE_PAGO'),
    ('p4-fila-08', 'DIR', 'SDA', 'SDA', 'DIR', 'REQUIERE_PAGO'),
    ('p4-fila-09', 'DIR', 'SDA', 'SDA', 'DIR', 'REQUIERE_PAGO'),
    ('p4-fila-10', 'DIR', 'SDA', 'DIR', 'DIR', 'REQUIERE_PAGO'),
    ('p4-fila-11', 'DIR', 'DIR', 'SDA', 'DIR', 'REQUIERE_PAGO'),
    ('p4-fila-12', 'DIR', 'DIR', 'SDA', 'DIR', 'REQUIERE_PAGO'),
    ('p4-fila-13', 'DIR', 'SDA', 'DIR', 'DIR', 'REQUIERE_PAGO'),
    ('p4-fila-14', 'DIR', 'DIR', 'SDA', 'DIR', 'REQUIERE_PAGO'),
    ('p4-fila-15', 'DIR', 'SDA', 'DIR', 'DIR', 'REQUIERE_PAGO'),
    ('p4-fila-16', 'DIR', 'SDA', 'DIR', 'DIR', 'REQUIERE_PAGO'),
    ('p5-fila-01', 'DIR', 'SDA', 'SDA', 'DIR', 'REQUIERE_PAGO'),
    ('p5-fila-02', 'DIR', 'SDA', 'DIR', 'DIR', 'REQUIERE_PAGO'),
    ('p5-fila-03', 'DIR', 'DIR', 'DIR', 'DIR', 'REQUIERE_PAGO'),
    ('p5-fila-04', 'DIR', 'SDA', 'DIR', 'DIR', 'REQUIERE_PAGO'),
    ('p5-fila-05', 'DIR', 'SDA', 'DIR', 'DIR', 'REQUIERE_PAGO'),
    ('p5-fila-06', 'DIR', 'SDA', 'SDA', 'DIR', 'REQUIERE_PAGO'),
    ('p5-fila-07', 'DIR', 'SDA', 'DIR', 'DIR', 'REQUIERE_PAGO'),
    ('p5-fila-08', 'DIR', 'SDA', 'SDA', 'DIR', 'REQUIERE_PAGO'),
    ('p5-fila-09', 'DIR', 'SDA', 'DIR', 'DIR', 'REQUIERE_PAGO'),
    ('p5-fila-10', 'DIR', 'SDA', 'DIR', 'DIR', 'REQUIERE_PAGO'),
    ('p5-fila-11', 'DIR', 'SDA', 'SDA', 'DIR', 'REQUIERE_PAGO'),
    ('p5-fila-12', 'DIR', 'SDA', 'SDA', 'DIR', 'REQUIERE_PAGO'),
    ('p5-fila-13', 'DIR', 'SDA', 'SDA', 'DIR', 'REQUIERE_PAGO'),
    ('p5-fila-14', 'DIR', 'SDA', 'SDA', 'DIR', 'REQUIERE_PAGO'),
    ('p5-fila-15', 'DIR', 'SDA', 'SDA', 'DIR', 'REQUIERE_PAGO'),
    ('p5-fila-16', 'DIR', 'SDA', 'SDA', 'DIR', 'REQUIERE_PAGO'),
    ('p5-fila-17', 'DIR', 'SDA', 'SDA', 'DIR', 'REQUIERE_PAGO'),
    ('p5-fila-18', 'DIR', 'SDA', 'DIR', 'DIR', 'REQUIERE_PAGO'),
    ('p5-fila-19', 'DIR', 'SDA', 'DIR', 'DIR', 'REQUIERE_PAGO'),
    ('p5-fila-20', 'DIR', 'SDA', 'DIR', 'DIR', 'REQUIERE_PAGO'),
    ('p5-fila-21', 'DIR', 'SDA', 'DIR', 'DIR', 'REQUIERE_PAGO'),
    ('p6-fila-01', 'DIR', 'DIR', 'DIR', 'DIR', 'REQUIERE_PAGO'),
    ('p6-fila-02', 'DIR', 'DIR', 'DIR', 'DIR', 'REQUIERE_PAGO'),
    ('p6-fila-03', 'DIR', 'SDA', 'SDA', 'DIR', 'REQUIERE_PAGO'),
    ('p6-fila-04', 'DIR', 'SDA', 'DIR', 'DIR', 'REQUIERE_PAGO'),
    ('p6-fila-05', 'DIR', 'SDA', 'SDA', 'DIR', 'REQUIERE_PAGO'),
    ('p6-fila-06', 'DIR', 'SDA', 'SDA', 'DIR', 'REQUIERE_PAGO'),
    ('p6-fila-07', 'DIR', 'DIR', 'DIR', 'DIR', 'REQUIERE_PAGO');

    -- 5. Validar que la tabla temporal contenga exactamente 72 filas y coincida con TUPA-2026
    SELECT COUNT(*) INTO v_mapping_count FROM tmp_tupa_destinos_c1;
    IF v_mapping_count <> 72 THEN
        RAISE EXCEPTION 'MIGRACION_46_ERROR: La matriz temporal contiene % filas (esperadas: 72).', v_mapping_count;
    END IF;

    -- Validar que no existan códigos en la matriz que no existan en TUPA-2026
    IF EXISTS (
        SELECT 1 FROM tmp_tupa_destinos_c1 m
         WHERE NOT EXISTS (
             SELECT 1 FROM sigd_doc.tupa_procedimiento p
              WHERE p.id_version = v_version_id AND p.codigo_ref = m.codigo_ref
         )
    ) THEN
        RAISE EXCEPTION 'MIGRACION_46_ERROR: Existen códigos en la matriz que no corresponden a TUPA-2026.';
    END IF;

    -- 6. EJECUCIÓN ATÓMICA DEL UPDATE DE DESTINOS
    UPDATE sigd_doc.tupa_procedimiento p
       SET unidad_receptora_id = rec.area_id,
           unidad_responsable_id = resp.area_id,
           unidad_resolutiva_id = resol.area_id,
           unidad_financiera_id = fin.area_id,
           intervencion_financiera = m.interv_fin,
           actualizado_en = now()
      FROM tmp_tupa_destinos_c1 m
      JOIN sigd_org.area rec ON rec.codigo = m.rec_cod
      JOIN sigd_org.area resp ON resp.codigo = m.resp_cod
      JOIN sigd_org.area resol ON resol.codigo = m.resol_cod
      JOIN sigd_org.area fin ON fin.codigo = m.fin_cod
     WHERE p.id_version = v_version_id
       AND p.codigo_ref = m.codigo_ref;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    IF v_updated_count <> 72 THEN
        RAISE EXCEPTION 'MIGRACION_46_ERROR: Se actualizaron % filas en lugar de 72.', v_updated_count;
    END IF;

    -- 7. POSTCONDICIONES: Verificar que ningún procedimiento de TUPA-2026 tenga unidades en NULL
    SELECT COUNT(*) INTO v_null_units_count
      FROM sigd_doc.tupa_procedimiento
     WHERE id_version = v_version_id
       AND (
           unidad_receptora_id IS NULL OR
           unidad_responsable_id IS NULL OR
           unidad_resolutiva_id IS NULL OR
           unidad_financiera_id IS NULL OR
           intervencion_financiera IS NULL
       );

    IF v_null_units_count > 0 THEN
        RAISE EXCEPTION 'MIGRACION_46_ERROR: Quedaron % procedimientos con unidades incompletas (NULL).', v_null_units_count;
    END IF;

    -- 8. Validar caso piloto: Certificado de Inglés (p1-fila-06)
    IF NOT EXISTS (
        SELECT 1 FROM sigd_doc.tupa_procedimiento
         WHERE id_version = v_version_id
           AND codigo_ref = 'p1-fila-06'
           AND unidad_receptora_id = v_dir_id
           AND unidad_responsable_id = v_sda_id
           AND unidad_resolutiva_id = v_dir_id
           AND unidad_financiera_id = v_dir_id
           AND intervencion_financiera = 'REQUIERE_PAGO'
    ) THEN
        RAISE EXCEPTION 'MIGRACION_46_ERROR: Falló la verificación del caso piloto p1-fila-06 (Certificado de Inglés).';
    END IF;

    RAISE NOTICE 'MIGRACION_46_EXITO: 72 procedimientos de TUPA-2026 configurados exitosamente con sus 4 unidades.';
END $$;

COMMIT;
