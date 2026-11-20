-- =============================================================================
-- Migración 25 · Permisos base por rol canónico, roles configurables y sedes
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
-- -----------------------------------------------------------------------------
-- Idempotente y compatible con el esquema existente (no altera migraciones 01-24).
-- =============================================================================

-- 1. Asegurar permisos predeterminados por rol canónico (sin sobrescribir cambios)
INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
  FROM sigd_org.rol_sistema r
 CROSS JOIN sigd_org.permiso_sistema p
 WHERE r.codigo = 'ADMINISTRADOR'
ON CONFLICT DO NOTHING;

INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
  FROM sigd_org.rol_sistema r
  JOIN sigd_org.permiso_sistema p
    ON p.codigo IN (
      'REPORTE_LEER',
      'EXPEDIENTE_LEER',
      'EXPEDIENTE_DERIVAR',
      'EXPEDIENTE_RESOLVER',
      'FIRMA_FIRMAR',
      'admin:acceso',
      'organigrama:leer',
      'calendario:leer'
    )
 WHERE r.codigo = 'DIRECTOR'
ON CONFLICT DO NOTHING;

INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
  FROM sigd_org.rol_sistema r
  JOIN sigd_org.permiso_sistema p
    ON p.codigo IN ('EXPEDIENTE_LEER', 'EXPEDIENTE_DERIVAR', 'EXPEDIENTE_RESOLVER')
 WHERE r.codigo IN ('SECRETARIO', 'ESPECIALISTA')
ON CONFLICT DO NOTHING;

INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
  FROM sigd_org.rol_sistema r
  JOIN sigd_org.permiso_sistema p
    ON p.codigo IN ('EXPEDIENTE_LEER', 'EXPEDIENTE_DERIVAR')
 WHERE r.codigo = 'MESA_PARTES'
ON CONFLICT DO NOTHING;

-- 2. Permitir creación de roles institucionales personalizados con formato seguro
DO $$
BEGIN
  IF to_regclass('sigd_org.rol_sistema') IS NOT NULL THEN
    ALTER TABLE sigd_org.rol_sistema DROP CONSTRAINT IF EXISTS chk_rol_codigo;
    ALTER TABLE sigd_org.rol_sistema
      ADD CONSTRAINT chk_rol_codigo
      CHECK (codigo ~ '^[A-Z][A-Z0-9_]{1,29}$');
  END IF;
END $$ LANGUAGE plpgsql;

-- 3. Tabla maestra real de sedes institucionales
CREATE TABLE IF NOT EXISTS sigd_org.sede (
  sede_id    UUID         NOT NULL DEFAULT gen_random_uuid()
                          CONSTRAINT pk_sede PRIMARY KEY,
  codigo     VARCHAR(30)  NOT NULL UNIQUE,
  nombre     VARCHAR(160) NOT NULL,
  direccion  VARCHAR(255) NULL,
  vigente    BOOLEAN      NOT NULL DEFAULT TRUE,
  creado_en  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sede_vigente
  ON sigd_org.sede (vigente) WHERE vigente = TRUE;

INSERT INTO sigd_org.sede (codigo, nombre, direccion)
VALUES
  ('SEDE_CENTRAL', 'Sede Central Pucallpa', 'Av. Túpac Amaru Km. 4.5, Pucallpa'),
  ('SEDE_FILIAL', 'Filial Yarinacocha', 'Distrito de Yarinacocha, Coronel Portillo')
ON CONFLICT (codigo) DO NOTHING;

-- 4. Sincronizar perfil_usuario desde asignacion_personal vigente si falta
INSERT INTO sigd_auth.perfil_usuario (id_usuario, area_id, cargo_id)
SELECT DISTINCT ON (ap.id_usuario) ap.id_usuario, ap.area_id, ap.cargo_id
  FROM sigd_org.asignacion_personal ap
 WHERE ap.vigente_desde <= now()
   AND (ap.vigente_hasta IS NULL OR ap.vigente_hasta > now())
 ORDER BY ap.id_usuario, ap.vigente_desde DESC
ON CONFLICT (id_usuario) DO NOTHING;
