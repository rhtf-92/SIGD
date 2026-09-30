-- =============================================================================
-- Compatibilidad de la suite E2E con el esquema canónico (migraciones/01..06)
-- -----------------------------------------------------------------------------
-- Autor : Ricardo Arévalo Villacorta (B_AREVALO) · Grupo 6 CoreLink
-- -----------------------------------------------------------------------------
-- Este archivo ya NO crea el esquema. El esquema canónico lo despliega el runner
-- `npm run migrate` (backend/migraciones/01_sigd_audit.sql .. 06_sigd_rut.sql).
--
-- Este archivo aporta únicamente lo que la suite E2E heredada (entregable 03,
-- Zevallos) necesita y que el esquema canónico declara estrictamente:
--   1. columnas de compatibilidad que la suite legado consulta
--      (`cuenta_usuario.id`, `movimiento_tramite.id`, `area.codigo`).
--   2. relajación de NOT NULL solo dentro del entorno de pruebas, para permitir
--      los `INSERT ... DEFAULT VALUES` que usa la suite.
--
-- Ninguna de estas adaptaciones afecta producción: el DDL canónico permanece
-- estricto. Los AUTOINCREMENT/drop de constraints son por diseño.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. sigd_auth.cuenta_usuario
--    La suite E2E-06 inserta una cuenta mínima con DEFAULT VALUES y lee `id`.
-- -----------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS sigd_auth.seq_compat_cuenta_usuario;

ALTER TABLE sigd_auth.cuenta_usuario
    ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();

ALTER TABLE sigd_auth.cuenta_usuario
    ALTER COLUMN usuario DROP NOT NULL;
ALTER TABLE sigd_auth.cuenta_usuario
    ALTER COLUMN usuario SET DEFAULT ('usr_' || nextval('sigd_auth.seq_compat_cuenta_usuario')::TEXT);

ALTER TABLE sigd_auth.cuenta_usuario
    ALTER COLUMN correo DROP NOT NULL;
ALTER TABLE sigd_auth.cuenta_usuario
    ALTER COLUMN correo SET DEFAULT ('compat+' || nextval('sigd_auth.seq_compat_cuenta_usuario')::TEXT || '@e2e.local');

ALTER TABLE sigd_auth.cuenta_usuario
    ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE sigd_auth.cuenta_usuario
    ALTER COLUMN password_hash SET DEFAULT '$argon2id$compat$e2e';

ALTER TABLE sigd_auth.cuenta_usuario
    ALTER COLUMN id_persona DROP NOT NULL;

ALTER TABLE sigd_auth.cuenta_usuario
    DROP CONSTRAINT IF EXISTS chk_cuenta_usuario_algoritmo;

-- -----------------------------------------------------------------------------
-- 2. sigd_org.area
--    La suite E2E-05 inserta áreas con (nombre, vigente) y devuelve area_id.
--    `codigo` alimenta el disparador de ruta ltree, por lo que recibe default.
-- -----------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS sigd_org.seq_compat_area_codigo;

ALTER TABLE sigd_org.area
    ALTER COLUMN codigo SET DEFAULT ('AREA-' || nextval('sigd_org.seq_compat_area_codigo')::TEXT);

-- -----------------------------------------------------------------------------
-- 3. sigd_rut.movimiento_tramite
--    La suite E2E-04/E2E-05 consulta la columna `id` del movimiento.
-- -----------------------------------------------------------------------------
ALTER TABLE sigd_rut.movimiento_tramite
    ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();

-- -----------------------------------------------------------------------------
-- 4. sigd_tra.expediente
--    El DDL canónico ya cubre las columnas usadas por la suite y por el router
--    de referencia (expediente_id, numero, dni_solicitante, tipo_documental_id,
--    solicitante_id, area_destino_id, fecha_radicacion). No se requiere ninguna
--    adaptación adicional.
-- -----------------------------------------------------------------------------
