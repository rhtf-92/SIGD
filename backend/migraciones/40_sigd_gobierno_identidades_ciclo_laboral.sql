-- =============================================================================
-- Migración 40: Gobierno de Identidades, Cuentas, Ciclo Laboral y Contextos
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
-- -----------------------------------------------------------------------------
-- Autor      : Geric (B_GERIC)
-- Marco      : Fase 5E.5 — Gobierno Institucional de Identidad, Organización y Autoridad
-- Invariante : PERSONA ≠ CUENTA ≠ VÍNCULO ≠ ÁREA ≠ CARGO ≠ ASIGNACIÓN ≠ RESPONSABILIDAD ≠ PERFIL
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. ASIGNACIÓN PERSONAL: Desacople de Cuenta y Vinculación a Persona y Vínculo
-- -----------------------------------------------------------------------------

-- 1.1 Columnas aditivas id_persona e id_vinculo
ALTER TABLE sigd_org.asignacion_personal
  ADD COLUMN IF NOT EXISTS id_persona UUID REFERENCES sigd_auth.persona(id_persona) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS id_vinculo UUID REFERENCES sigd_auth.vinculo_institucional(id_vinculo) ON DELETE RESTRICT;

-- 1.2 Backfill de id_persona desde cuenta_usuario para filas preexistentes
UPDATE sigd_org.asignacion_personal a
   SET id_persona = u.id_persona
  FROM sigd_auth.cuenta_usuario u
 WHERE u.id_usuario = a.id_usuario
   AND a.id_persona IS NULL;

-- 1.3 Permitir id_usuario NULL (la cuenta es credencial de acceso opcional)
ALTER TABLE sigd_org.asignacion_personal
  ALTER COLUMN id_usuario DROP NOT NULL;

-- 1.4 Índices para llaves foráneas (prevención de table lock según Regla #4 y #8)
CREATE INDEX IF NOT EXISTS idx_asignacion_personal_persona
  ON sigd_org.asignacion_personal(id_persona);

CREATE INDEX IF NOT EXISTS idx_asignacion_personal_vinculo
  ON sigd_org.asignacion_personal(id_vinculo);

-- 1.5 Función y trigger para inferir id_persona si se inserta mediante id_usuario legacy
CREATE OR REPLACE FUNCTION sigd_org.fn_asignacion_personal_auto_persona()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.id_persona IS NULL AND NEW.id_usuario IS NOT NULL THEN
    SELECT id_persona INTO NEW.id_persona
      FROM sigd_auth.cuenta_usuario
     WHERE id_usuario = NEW.id_usuario;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_asignacion_personal_auto_persona ON sigd_org.asignacion_personal;
CREATE TRIGGER tr_asignacion_personal_auto_persona
  BEFORE INSERT OR UPDATE ON sigd_org.asignacion_personal
  FOR EACH ROW
  EXECUTE FUNCTION sigd_org.fn_asignacion_personal_auto_persona();

-- 1.6 Salvaguarda: al menos un identificador (id_persona o id_usuario) debe estar presente
ALTER TABLE sigd_org.asignacion_personal
  DROP CONSTRAINT IF EXISTS chk_asignacion_personal_identidad;

ALTER TABLE sigd_org.asignacion_personal
  ADD CONSTRAINT chk_asignacion_personal_identidad
  CHECK (id_persona IS NOT NULL OR id_usuario IS NOT NULL);

-- 1.7 Ajuste de constraint de exclusión para considerar id_persona
ALTER TABLE sigd_org.asignacion_personal
  DROP CONSTRAINT IF EXISTS ex_asignacion_personal_vigencia;

ALTER TABLE sigd_org.asignacion_personal
  ADD CONSTRAINT ex_asignacion_personal_vigencia
  EXCLUDE USING gist (
    COALESCE(id_persona, '00000000-0000-0000-0000-000000000000'::uuid) WITH =,
    cargo_id WITH =,
    tstzrange(vigente_desde, COALESCE(vigente_hasta, 'infinity'::timestamp with time zone), '[)') WITH &&
  );

-- -----------------------------------------------------------------------------
-- 2. RESPONSABILIDAD TEMPORAL: Desacople de Cuenta y Vinculación a Persona
-- -----------------------------------------------------------------------------

-- 2.1 Columnas aditivas id_persona y titular_persona_id
ALTER TABLE sigd_org.responsabilidad_temporal
  ADD COLUMN IF NOT EXISTS id_persona UUID REFERENCES sigd_auth.persona(id_persona) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS titular_persona_id UUID REFERENCES sigd_auth.persona(id_persona) ON DELETE RESTRICT;

-- 2.2 Backfill de personas desde cuenta_usuario
UPDATE sigd_org.responsabilidad_temporal r
   SET id_persona = u.id_persona
  FROM sigd_auth.cuenta_usuario u
 WHERE u.id_usuario = r.id_usuario
   AND r.id_persona IS NULL;

UPDATE sigd_org.responsabilidad_temporal r
   SET titular_persona_id = u.id_persona
  FROM sigd_auth.cuenta_usuario u
 WHERE u.id_usuario = r.titular_usuario_id
   AND r.titular_persona_id IS NULL;

-- 2.3 Permitir id_usuario NULL
ALTER TABLE sigd_org.responsabilidad_temporal
  ALTER COLUMN id_usuario DROP NOT NULL;

-- 2.4 Índices en FKs
CREATE INDEX IF NOT EXISTS idx_resp_temp_persona
  ON sigd_org.responsabilidad_temporal(id_persona);

CREATE INDEX IF NOT EXISTS idx_resp_temp_titular_persona
  ON sigd_org.responsabilidad_temporal(titular_persona_id);

-- 2.5 Trigger para inferir id_persona y titular_persona_id desde cuentas legacy
CREATE OR REPLACE FUNCTION sigd_org.fn_resp_temp_auto_persona()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.id_persona IS NULL AND NEW.id_usuario IS NOT NULL THEN
    SELECT id_persona INTO NEW.id_persona
      FROM sigd_auth.cuenta_usuario
     WHERE id_usuario = NEW.id_usuario;
  END IF;
  IF NEW.titular_persona_id IS NULL AND NEW.titular_usuario_id IS NOT NULL THEN
    SELECT id_persona INTO NEW.titular_persona_id
      FROM sigd_auth.cuenta_usuario
     WHERE id_usuario = NEW.titular_usuario_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_resp_temp_auto_persona ON sigd_org.responsabilidad_temporal;
CREATE TRIGGER tr_resp_temp_auto_persona
  BEFORE INSERT OR UPDATE ON sigd_org.responsabilidad_temporal
  FOR EACH ROW
  EXECUTE FUNCTION sigd_org.fn_resp_temp_auto_persona();

-- 2.6 Salvaguardas de no auto-suplencia a nivel de persona
ALTER TABLE sigd_org.responsabilidad_temporal
  DROP CONSTRAINT IF EXISTS chk_resp_temp_no_auto_persona;

ALTER TABLE sigd_org.responsabilidad_temporal
  ADD CONSTRAINT chk_resp_temp_no_auto_persona
  CHECK (titular_persona_id IS NULL OR titular_persona_id <> id_persona);

-- -----------------------------------------------------------------------------
-- 3. SESIONES: Trazabilidad y Auditoría de Revocación
-- -----------------------------------------------------------------------------

-- 3.1 Columnas de motivo y autor de revocación para sigd_auth.sesion_usuario
ALTER TABLE sigd_auth.sesion_usuario
  ADD COLUMN IF NOT EXISTS motivo_revocacion TEXT NULL,
  ADD COLUMN IF NOT EXISTS revocado_por UUID NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sesion_usuario_revocado_por
  ON sigd_auth.sesion_usuario(revocado_por);

COMMIT;
