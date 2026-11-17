-- =============================================================================
-- MIGRACIÓN 28: ELIMINACIÓN DEFINITIVA DEL ROL HISTÓRICO ESPECIALISTA
-- PROYECTO: SIGD — Sistema Integral de Gestión Documentaria
-- INSTITUCIÓN: IESTP «Suiza» — Pucallpa, Ucayali
-- INTERVENCIÓN: TSK-HAL-05 — Regularización y Eliminación Definitiva de ESPECIALISTA
-- NORMATIVA: WORM (TUO Ley 27444), Modelo de Gestión Documental (MGD-PCM)
-- ALCANCE:
--   1. Creación de tabla de archivo inmutable sigd_audit.usuario_rol_historico_archivado.
--   2. Creación de tabla de archivo inmutable sigd_audit.rol_permiso_historico_archivado.
--   3. Archivo y migración forense WORM de las 6 asignaciones históricas de usuario_rol.
--   4. Archivo y migración forense WORM de las 3 relaciones históricas de rol_permiso.
--   5. Blindaje técnico WORM con funciones y triggers independientes (UPDATE/DELETE fila, TRUNCATE sentencia).
--   6. Revocación de privilegios DCL de mutación (INSERT, UPDATE, DELETE, TRUNCATE) y asignación de SELECT a roles autorizados.
--   7. Eliminación de asignaciones operativas en sigd_org.usuario_rol vinculadas a ESPECIALISTA.
--   8. Eliminación de permisos en sigd_org.rol_permiso vinculados a ESPECIALISTA.
--   9. Eliminación definitiva de ESPECIALISTA en sigd_org.rol_sistema.
--  10. Actualización de constraint chk_rol_codigo en sigd_org.rol_sistema.
--  11. Actualización de trigger function sigd_org.fn_bloquear_nueva_asignacion_rol_historico.
--  12. Creación de vista forense de consulta histórica sigd_audit.v_historial_rol_especialista.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tabla de Archivo Histórico Forense WORM de Asignaciones de Usuarios
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_audit.usuario_rol_historico_archivado (
    id_archivo UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_usuario_rol UUID NOT NULL,
    id_usuario UUID NOT NULL,
    rol_id UUID NOT NULL,
    rol_codigo VARCHAR(50) NOT NULL,
    area_id UUID,
    institucion_id UUID NOT NULL,
    vigente_desde TIMESTAMPTZ,
    vigente_hasta TIMESTAMPTZ,
    motivo_archivo TEXT NOT NULL,
    archivado_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

COMMENT ON TABLE sigd_audit.usuario_rol_historico_archivado IS 
'Custodia inmutable WORM de asignaciones de roles históricos descontinuados y eliminados del catálogo operativo (HAL-05).';

CREATE INDEX IF NOT EXISTS idx_usuario_rol_archivado_usr 
    ON sigd_audit.usuario_rol_historico_archivado (id_usuario, archivado_en DESC);

CREATE INDEX IF NOT EXISTS idx_usuario_rol_archivado_rol 
    ON sigd_audit.usuario_rol_historico_archivado (rol_codigo);

-- -----------------------------------------------------------------------------
-- 2. Tabla de Archivo Histórico Forense WORM de Relaciones Rol-Permiso
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_audit.rol_permiso_historico_archivado (
    id_archivo UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rol_id UUID NOT NULL,
    rol_codigo VARCHAR(50) NOT NULL,
    permiso_id UUID NOT NULL,
    permiso_codigo VARCHAR(100) NOT NULL,
    motivo_archivo TEXT NOT NULL,
    archivado_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

COMMENT ON TABLE sigd_audit.rol_permiso_historico_archivado IS 
'Custodia inmutable WORM de relaciones rol-permiso históricas descontinuadas y eliminadas del catálogo operativo (HAL-05).';

CREATE INDEX IF NOT EXISTS idx_rol_permiso_archivado_rol 
    ON sigd_audit.rol_permiso_historico_archivado (rol_codigo);

-- -----------------------------------------------------------------------------
-- 3. Archivar las 6 asignaciones históricas de ESPECIALISTA antes de su eliminación operativa
-- -----------------------------------------------------------------------------
INSERT INTO sigd_audit.usuario_rol_historico_archivado (
    id_usuario_rol,
    id_usuario,
    rol_id,
    rol_codigo,
    area_id,
    institucion_id,
    vigente_desde,
    vigente_hasta,
    motivo_archivo
)
SELECT 
    ur.id_usuario_rol,
    ur.id_usuario,
    ur.rol_id,
    'ESPECIALISTA',
    ur.area_id,
    ur.institucion_id,
    ur.vigente_desde,
    ur.vigente_hasta,
    'Eliminación definitiva del rol institucional no operativo ESPECIALISTA (Fase 6 - HAL-05).'
FROM sigd_org.usuario_rol ur
JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id
WHERE r.codigo = 'ESPECIALISTA'
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- 4. Archivar las 3 relaciones de permisos de ESPECIALISTA antes de su eliminación operativa
-- -----------------------------------------------------------------------------
INSERT INTO sigd_audit.rol_permiso_historico_archivado (
    rol_id,
    rol_codigo,
    permiso_id,
    permiso_codigo,
    motivo_archivo
)
SELECT 
    rp.rol_id,
    r.codigo,
    rp.permiso_id,
    ps.codigo,
    'Eliminación definitiva de permisos asociados al rol institucional no operativo ESPECIALISTA (Fase 6 - HAL-05).'
FROM sigd_org.rol_permiso rp
JOIN sigd_org.rol_sistema r ON r.rol_id = rp.rol_id
JOIN sigd_org.permiso_sistema ps ON ps.permiso_id = rp.permiso_id
WHERE r.codigo = 'ESPECIALISTA'
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- 5. Blindaje Técnico WORM: Funciones y Triggers Anti-Mutación Independientes
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sigd_audit.fn_proteger_archivo_historico_rol_worm()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'WORM_INTEGRITY_VIOLATION: La tabla de custodia histórica sigd_audit.% es inmutable. La operación % está estrictamente prohibida.',
        TG_TABLE_NAME, TG_OP
        USING ERRCODE = '42501',
              HINT = 'Los registros históricos archivados (HAL-05) son de solo lectura y no admiten mutaciones ni purgas.';
    RETURN NULL;
END;
$$;

-- Triggers independientes para sigd_audit.usuario_rol_historico_archivado
DROP TRIGGER IF EXISTS tr_usuario_rol_historico_bloquear_update ON sigd_audit.usuario_rol_historico_archivado;
CREATE TRIGGER tr_usuario_rol_historico_bloquear_update
    BEFORE UPDATE ON sigd_audit.usuario_rol_historico_archivado
    FOR EACH ROW
    EXECUTE FUNCTION sigd_audit.fn_proteger_archivo_historico_rol_worm();

DROP TRIGGER IF EXISTS tr_usuario_rol_historico_bloquear_delete ON sigd_audit.usuario_rol_historico_archivado;
CREATE TRIGGER tr_usuario_rol_historico_bloquear_delete
    BEFORE DELETE ON sigd_audit.usuario_rol_historico_archivado
    FOR EACH ROW
    EXECUTE FUNCTION sigd_audit.fn_proteger_archivo_historico_rol_worm();

DROP TRIGGER IF EXISTS tr_usuario_rol_historico_bloquear_truncate ON sigd_audit.usuario_rol_historico_archivado;
CREATE TRIGGER tr_usuario_rol_historico_bloquear_truncate
    BEFORE TRUNCATE ON sigd_audit.usuario_rol_historico_archivado
    FOR EACH STATEMENT
    EXECUTE FUNCTION sigd_audit.fn_proteger_archivo_historico_rol_worm();

-- Triggers independientes para sigd_audit.rol_permiso_historico_archivado
DROP TRIGGER IF EXISTS tr_rol_permiso_historico_bloquear_update ON sigd_audit.rol_permiso_historico_archivado;
CREATE TRIGGER tr_rol_permiso_historico_bloquear_update
    BEFORE UPDATE ON sigd_audit.rol_permiso_historico_archivado
    FOR EACH ROW
    EXECUTE FUNCTION sigd_audit.fn_proteger_archivo_historico_rol_worm();

DROP TRIGGER IF EXISTS tr_rol_permiso_historico_bloquear_delete ON sigd_audit.rol_permiso_historico_archivado;
CREATE TRIGGER tr_rol_permiso_historico_bloquear_delete
    BEFORE DELETE ON sigd_audit.rol_permiso_historico_archivado
    FOR EACH ROW
    EXECUTE FUNCTION sigd_audit.fn_proteger_archivo_historico_rol_worm();

DROP TRIGGER IF EXISTS tr_rol_permiso_historico_bloquear_truncate ON sigd_audit.rol_permiso_historico_archivado;
CREATE TRIGGER tr_rol_permiso_historico_bloquear_truncate
    BEFORE TRUNCATE ON sigd_audit.rol_permiso_historico_archivado
    FOR EACH STATEMENT
    EXECUTE FUNCTION sigd_audit.fn_proteger_archivo_historico_rol_worm();

-- -----------------------------------------------------------------------------
-- 6. Seguridad DCL: Revocación Estricta de Mutación y Concesión de Solo Lectura
-- -----------------------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON sigd_audit.usuario_rol_historico_archivado FROM PUBLIC, sigd_app, sigd_jacobo_user;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON sigd_audit.rol_permiso_historico_archivado FROM PUBLIC, sigd_app, sigd_jacobo_user;

GRANT SELECT ON sigd_audit.usuario_rol_historico_archivado TO sigd_app, sigd_jacobo_user, sigd_auditor, sigd_test_ro;
GRANT SELECT ON sigd_audit.rol_permiso_historico_archivado TO sigd_app, sigd_jacobo_user, sigd_auditor, sigd_test_ro;

-- -----------------------------------------------------------------------------
-- 7. Eliminación Definitiva de Asignaciones y Permisos Operativos en sigd_org
-- -----------------------------------------------------------------------------
DELETE FROM sigd_org.usuario_rol
WHERE rol_id IN (SELECT rol_id FROM sigd_org.rol_sistema WHERE codigo = 'ESPECIALISTA');

DELETE FROM sigd_org.rol_permiso
WHERE rol_id IN (SELECT rol_id FROM sigd_org.rol_sistema WHERE codigo = 'ESPECIALISTA');

-- -----------------------------------------------------------------------------
-- 8. Eliminación Definitiva de ESPECIALISTA del Catálogo Operativo sigd_org.rol_sistema
-- -----------------------------------------------------------------------------
DELETE FROM sigd_org.rol_sistema
WHERE codigo = 'ESPECIALISTA';

-- -----------------------------------------------------------------------------
-- 9. Actualización de Restricción chk_rol_codigo en sigd_org.rol_sistema
-- -----------------------------------------------------------------------------
ALTER TABLE sigd_org.rol_sistema DROP CONSTRAINT IF EXISTS chk_rol_codigo;
ALTER TABLE sigd_org.rol_sistema ADD CONSTRAINT chk_rol_codigo CHECK (
  codigo::text = ANY (ARRAY[
    -- 10 Roles Canónicos Vigentes Institucionales (Migración 22)
    'ADMINISTRADOR'::text,
    'DIRECTOR'::text,
    'JEFE_UNIDAD_ACADEMICA'::text,
    'COORDINADOR_AREA'::text,
    'SECRETARIO'::text,
    'MESA_PARTES'::text,
    'DOCENTE'::text,
    'TESORERO'::text,
    'ESTUDIANTE'::text,
    'CIUDADANO'::text,
    -- 3 Roles Históricos Restantes Preservados en Transición
    'CAJERO'::text,
    'APROBADOR_DEVOLUCIONES'::text,
    'SUPERVISOR_TESORERIA'::text
  ])
);

-- -----------------------------------------------------------------------------
-- 10. Actualización de Función Trigger Defensiva para Retirar ESPECIALISTA
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sigd_org.fn_bloquear_nueva_asignacion_rol_historico()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_codigo TEXT;
BEGIN
  SELECT r.codigo INTO v_codigo
    FROM sigd_org.rol_sistema r
   WHERE r.rol_id = NEW.rol_id;

  IF v_codigo IN ('CAJERO', 'APROBADOR_DEVOLUCIONES', 'SUPERVISOR_TESORERIA') THEN
    IF TG_OP = 'INSERT' THEN
      RAISE EXCEPTION 'ROL_HISTORICO_BLOQUEADO: El rol "%" está excluido del catálogo operativo y no admite nuevas asignaciones.', v_codigo
        USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'UPDATE' AND (NEW.rol_id IS DISTINCT FROM OLD.rol_id OR NEW.id_usuario IS DISTINCT FROM OLD.id_usuario OR NEW.vigente_hasta IS NULL) THEN
      RAISE EXCEPTION 'ROL_HISTORICO_BLOQUEADO: Solo se permite cerrar vigencia (vigente_hasta) sobre asignaciones históricas de "%".', v_codigo
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- 11. Vista Forense de Consulta Histórica de Solo Lectura
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW sigd_audit.v_historial_rol_especialista AS
SELECT 
    ur.id_usuario_rol,
    ur.id_usuario,
    u.usuario,
    u.activo AS usuario_activo,
    ur.rol_codigo,
    ur.area_id,
    ar.nombre AS area_nombre,
    ur.institucion_id,
    ur.vigente_desde,
    ur.vigente_hasta,
    ur.archivado_en,
    ur.motivo_archivo
FROM sigd_audit.usuario_rol_historico_archivado ur
JOIN sigd_auth.cuenta_usuario u ON u.id_usuario = ur.id_usuario
LEFT JOIN sigd_org.area ar ON ar.area_id = ur.area_id
WHERE ur.rol_codigo = 'ESPECIALISTA';

COMMENT ON VIEW sigd_audit.v_historial_rol_especialista IS 
'Vista forense de consulta de asignaciones históricas del rol descontinuado ESPECIALISTA (HAL-05). Solo lectura.';

REVOKE ALL ON sigd_audit.v_historial_rol_especialista FROM PUBLIC;
GRANT SELECT ON sigd_audit.v_historial_rol_especialista TO sigd_app, sigd_jacobo_user, sigd_auditor, sigd_test_ro;
