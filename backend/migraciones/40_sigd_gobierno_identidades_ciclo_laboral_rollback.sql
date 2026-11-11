-- =============================================================================
-- Rollback de Migración 40: Gobierno de Identidades, Cuentas y Ciclo Laboral
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
-- =============================================================================

BEGIN;

-- 1. Revertir Sesiones
DROP INDEX IF EXISTS sigd_auth.idx_sesion_usuario_revocado_por;
ALTER TABLE sigd_auth.sesion_usuario
  DROP COLUMN IF EXISTS revocado_por,
  DROP COLUMN IF EXISTS motivo_revocacion;

-- 2. Revertir Responsabilidad Temporal
DROP TRIGGER IF EXISTS tr_resp_temp_auto_persona ON sigd_org.responsabilidad_temporal;
DROP FUNCTION IF EXISTS sigd_org.fn_resp_temp_auto_persona();
ALTER TABLE sigd_org.responsabilidad_temporal
  DROP CONSTRAINT IF EXISTS chk_resp_temp_no_auto_persona;
DROP INDEX IF EXISTS sigd_org.idx_resp_temp_titular_persona;
DROP INDEX IF EXISTS sigd_org.idx_resp_temp_persona;
-- Verificación de seguridad fail-safe: Prohibido borrar registros persona-only legítimos
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM sigd_org.responsabilidad_temporal WHERE id_usuario IS NULL) THEN
    RAISE EXCEPTION 'Rollback abortado por salvaguarda de datos: existen responsabilidades temporales con id_usuario NULL (registros legítimos persona-only).';
  END IF;
END $$;
ALTER TABLE sigd_org.responsabilidad_temporal
  ALTER COLUMN id_usuario SET NOT NULL;
ALTER TABLE sigd_org.responsabilidad_temporal
  DROP COLUMN IF EXISTS titular_persona_id,
  DROP COLUMN IF EXISTS id_persona;

-- 3. Revertir Asignación Personal
ALTER TABLE sigd_org.asignacion_personal
  DROP CONSTRAINT IF EXISTS ex_asignacion_personal_vigencia;
ALTER TABLE sigd_org.asignacion_personal
  ADD CONSTRAINT ex_asignacion_personal_vigencia
  EXCLUDE USING gist (
    id_usuario WITH =,
    cargo_id WITH =,
    tstzrange(vigente_desde, COALESCE(vigente_hasta, 'infinity'::timestamp with time zone), '[)') WITH &&
  );
ALTER TABLE sigd_org.asignacion_personal
  DROP CONSTRAINT IF EXISTS chk_asignacion_personal_identidad;
DROP TRIGGER IF EXISTS tr_asignacion_personal_auto_persona ON sigd_org.asignacion_personal;
DROP FUNCTION IF EXISTS sigd_org.fn_asignacion_personal_auto_persona();
DROP INDEX IF EXISTS sigd_org.idx_asignacion_personal_vinculo;
DROP INDEX IF EXISTS sigd_org.idx_asignacion_personal_persona;
-- Verificación de seguridad fail-safe: Prohibido borrar registros persona-only legítimos
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM sigd_org.asignacion_personal WHERE id_usuario IS NULL) THEN
    RAISE EXCEPTION 'Rollback abortado por salvaguarda de datos: existen asignaciones de personal con id_usuario NULL (registros legítimos persona-only).';
  END IF;
END $$;
ALTER TABLE sigd_org.asignacion_personal
  ALTER COLUMN id_usuario SET NOT NULL;
ALTER TABLE sigd_org.asignacion_personal
  DROP COLUMN IF EXISTS id_vinculo,
  DROP COLUMN IF EXISTS id_persona;

COMMIT;
