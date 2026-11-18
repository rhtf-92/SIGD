-- ==============================================================================
-- MIGRACIÓN 48: Pre-enrutamiento TUPA, Perfil Responsable y Asignación Operativa
-- FASE C3: Pre-enrutamiento TUPA, Responsables Operativos y Piloto de Inglés
-- ==============================================================================
-- Áreas físicas canónicas:
--   DIR: a0000000-0000-0000-0000-000000000002 (Dirección General)
--   SDA: a0000000-0000-0000-0000-000000000001 (Subdirección Académica)
-- Perfiles operativos competentes (sigd_org.perfil_operativo):
--   4: GESTOR_AREA_ACADEMICA (Responsable técnico para procedimientos de SDA)
--   5: GESTOR_ADMINISTRATIVO (Responsable operativo para procedimientos de DIR)
-- ==============================================================================

BEGIN;

DO $$
DECLARE
    v_version_id UUID;
    v_dir_id UUID;
    v_sda_id UUID;
    v_perfil_acad_id SMALLINT;
    v_perfil_adm_id SMALLINT;
    v_total_proc INT;
BEGIN
    -- 1. PRECONDICIONES: Validar existencia de versión TUPA-2026 vigente
    SELECT id_version INTO v_version_id
      FROM sigd_doc.tupa_version
     WHERE codigo = 'TUPA-2026' AND estado = 'VIGENTE';

    IF v_version_id IS NULL THEN
        RAISE EXCEPTION 'MIGRACION_48_ERROR: No se encontró la versión TUPA-2026 con estado VIGENTE.';
    END IF;

    -- 2. PRECONDICIONES: Validar existencia de áreas DIR y SDA
    SELECT area_id INTO v_dir_id FROM sigd_org.area WHERE codigo = 'DIR' AND vigente = true;
    IF v_dir_id IS NULL THEN
        RAISE EXCEPTION 'MIGRACION_48_ERROR: Área canónica DIR no existe o no está vigente.';
    END IF;

    SELECT area_id INTO v_sda_id FROM sigd_org.area WHERE codigo = 'SDA' AND vigente = true;
    IF v_sda_id IS NULL THEN
        RAISE EXCEPTION 'MIGRACION_48_ERROR: Área canónica SDA no existe o no está vigente.';
    END IF;

    -- 3. PRECONDICIONES: Validar existencia de perfiles operativos
    SELECT perfil_id INTO v_perfil_acad_id FROM sigd_org.perfil_operativo WHERE codigo = 'GESTOR_AREA_ACADEMICA' AND vigente = true;
    IF v_perfil_acad_id IS NULL THEN
        RAISE EXCEPTION 'MIGRACION_48_ERROR: Perfil GESTOR_AREA_ACADEMICA no existe o no está vigente.';
    END IF;

    SELECT perfil_id INTO v_perfil_adm_id FROM sigd_org.perfil_operativo WHERE codigo = 'GESTOR_ADMINISTRATIVO' AND vigente = true;
    IF v_perfil_adm_id IS NULL THEN
        RAISE EXCEPTION 'MIGRACION_48_ERROR: Perfil GESTOR_ADMINISTRATIVO no existe o no está vigente.';
    END IF;

    -- 4. PRECONDICIONES: Validar conteo de procedimientos de TUPA-2026
    SELECT COUNT(*) INTO v_total_proc FROM sigd_doc.tupa_procedimiento WHERE id_version = v_version_id;
    IF v_total_proc <> 72 THEN
        RAISE EXCEPTION 'MIGRACION_48_ERROR: Se esperaban 72 procedimientos en TUPA-2026, encontrados: %.', v_total_proc;
    END IF;
END $$;

-- 5. DDL ADITIVO: Agregar columna perfil_responsable_id a tupa_procedimiento
ALTER TABLE sigd_doc.tupa_procedimiento
  ADD COLUMN IF NOT EXISTS perfil_responsable_id SMALLINT
  REFERENCES sigd_org.perfil_operativo (perfil_id);

CREATE INDEX IF NOT EXISTS idx_tupa_proc_perfil_responsable
  ON sigd_doc.tupa_procedimiento (perfil_responsable_id);

-- 6. DDL ADITIVO: Agregar columna perfil_responsable_id a expediente_tupa_vinculo para nuevos snapshots
ALTER TABLE sigd_doc.expediente_tupa_vinculo
  ADD COLUMN IF NOT EXISTS perfil_responsable_id SMALLINT
  REFERENCES sigd_org.perfil_operativo (perfil_id);

CREATE INDEX IF NOT EXISTS idx_exp_tupa_vinc_perfil_responsable
  ON sigd_doc.expediente_tupa_vinculo (perfil_responsable_id);

-- 7. ACTUALIZACIÓN DE DATOS: Asignar perfil responsable a los 72 procedimientos de TUPA-2026
DO $$
DECLARE
    v_version_id UUID;
    v_sda_id UUID;
    v_perfil_acad_id SMALLINT;
    v_perfil_adm_id SMALLINT;
    v_updated_proc INT;
    v_null_perfiles INT;
BEGIN
    SELECT id_version INTO v_version_id FROM sigd_doc.tupa_version WHERE codigo = 'TUPA-2026' AND estado = 'VIGENTE';
    SELECT area_id INTO v_sda_id FROM sigd_org.area WHERE codigo = 'SDA';
    SELECT perfil_id INTO v_perfil_acad_id FROM sigd_org.perfil_operativo WHERE codigo = 'GESTOR_AREA_ACADEMICA';
    SELECT perfil_id INTO v_perfil_adm_id FROM sigd_org.perfil_operativo WHERE codigo = 'GESTOR_ADMINISTRATIVO';

    -- Si la unidad responsable es SDA -> GESTOR_AREA_ACADEMICA (4)
    -- Si la unidad responsable es DIR -> GESTOR_ADMINISTRATIVO (5)
    UPDATE sigd_doc.tupa_procedimiento
       SET perfil_responsable_id = CASE
             WHEN unidad_responsable_id = v_sda_id THEN v_perfil_acad_id
             ELSE v_perfil_adm_id
           END,
           actualizado_en = now()
     WHERE id_version = v_version_id;

    GET DIAGNOSTICS v_updated_proc = ROW_COUNT;
    IF v_updated_proc <> 72 THEN
        RAISE EXCEPTION 'MIGRACION_48_ERROR: Se actualizaron % procedimientos de 72.', v_updated_proc;
    END IF;

    -- 8. POSTCONDICIONES: Ningún procedimiento de TUPA-2026 debe tener perfil_responsable_id en NULL
    SELECT COUNT(*) INTO v_null_perfiles
      FROM sigd_doc.tupa_procedimiento
     WHERE id_version = v_version_id AND perfil_responsable_id IS NULL;

    IF v_null_perfiles > 0 THEN
        RAISE EXCEPTION 'MIGRACION_48_ERROR: Quedaron % procedimientos con perfil_responsable_id NULL.', v_null_perfiles;
    END IF;

    -- 9. Validar caso piloto: Certificado de Inglés (p1-fila-06)
    IF NOT EXISTS (
        SELECT 1 FROM sigd_doc.tupa_procedimiento
         WHERE id_version = v_version_id
           AND codigo_ref = 'p1-fila-06'
           AND perfil_responsable_id = v_perfil_acad_id
    ) THEN
        RAISE EXCEPTION 'MIGRACION_48_ERROR: Falló la verificación del perfil responsable en caso piloto p1-fila-06.';
    END IF;

    RAISE NOTICE 'MIGRACION_48_EXITO: 72 procedimientos de TUPA-2026 configurados con perfil_responsable_id.';
END $$;

COMMIT;
