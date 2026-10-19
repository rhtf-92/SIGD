-- =============================================================================
-- Migración 08 · Usuarios demo institucionales + BD canónica SIGD
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
-- -----------------------------------------------------------------------------
-- Conexión pgAdmin: base de datos "SIGD"
--   DATABASE_URL=postgres://postgres:postgres_password@localhost:5432/SIGD
-- Usuarios semilla (todos con contraseña "123", hash scrypt formato $argon2id$):
--   superadmin / 123  → SUPER_ADMIN
--   director    / 123  → DIRECTOR
--   docente     / 123  → DOCENTE
--   mesa_partes / 123  → MESA_PARTES
--   estudiante  / 123  → ESTUDIANTE (frontend ingresa directo, sin pedir clave)
-- Depende de: 02_sigd_auth.sql, 03_sigd_org.sql
-- =============================================================================

-- 8.1 Ampliar roles canónicos del frontend (el CHECK original solo permitía 6).
ALTER TABLE sigd_org.rol_sistema DROP CONSTRAINT IF EXISTS chk_rol_codigo;
ALTER TABLE sigd_org.rol_sistema
  ADD CONSTRAINT chk_rol_codigo CHECK (codigo IN (
    'ADMINISTRADOR', 'SUPER_ADMIN',
    'DIRECTOR',
    'SECRETARIO', 'ESPECIALISTA', 'DOCENTE',
    'MESA_PARTES',
    'CIUDADANO', 'ESTUDIANTE'
  ));

-- 8.2 Roles faltantes del frontend
INSERT INTO sigd_org.rol_sistema (codigo, nombre, descripcion)
VALUES
  ('SUPER_ADMIN', 'Super Administrador', 'Gobernanza global del SIGD y auditoría institucional'),
  ('DOCENTE', 'Docente / Coordinador', 'Evaluación académica de titulación y firma de actuados'),
  ('ESTUDIANTE', 'Estudiante / Administrado', 'Trámites propios y casilla electrónica personal')
ON CONFLICT (codigo) DO NOTHING;

-- 8.3 Personas naturales demo (idempotente)
INSERT INTO sigd_auth.persona (id_persona, tipo, id_documento) VALUES
  ('11111111-1111-1111-1111-111111111001', 'NATURAL', '10000001'),
  ('11111111-1111-1111-1111-111111111002', 'NATURAL', '10000002'),
  ('11111111-1111-1111-1111-111111111003', 'NATURAL', '10000003'),
  ('11111111-1111-1111-1111-111111111004', 'NATURAL', '10000004'),
  ('11111111-1111-1111-1111-111111111005', 'NATURAL', '10000005')
ON CONFLICT (id_persona) DO NOTHING;

INSERT INTO sigd_auth.persona_natural (id_persona, nombres, apellidos, nombre_completo, correo) VALUES
  ('11111111-1111-1111-1111-111111111001', 'Super', 'Administrador', 'Super Administrador', 'superadmin@iestp-suiza.edu.pe'),
  ('11111111-1111-1111-1111-111111111002', 'Director', 'General', 'Director General', 'director@iestp-suiza.edu.pe'),
  ('11111111-1111-1111-1111-111111111003', 'Docente', 'Coordinador', 'Docente Coordinador', 'docente@iestp-suiza.edu.pe'),
  ('11111111-1111-1111-1111-111111111004', 'Mesa', 'Partes', 'Mesa de Partes', 'mesadepartes@iestp-suiza.edu.pe'),
  ('11111111-1111-1111-1111-111111111005', 'Estudiante', 'Demo', 'Estudiante Demo', 'estudiante@iestp-suiza.edu.pe')
ON CONFLICT (id_persona) DO NOTHING;

-- 8.4 Cuentas de usuario demo — contraseña "123" para todo el personal.
-- Hash scrypt (salt 00112233445566778899aabbccddeeff) verificado por Argon2Service:
-- $argon2id$v=19$m=65536,t=3,p=4$00112233...$99f5f264...
INSERT INTO sigd_auth.cuenta_usuario (id_usuario, id_persona, usuario, correo, password_hash, activo) VALUES
  ('22222222-2222-2222-2222-222222222001', '11111111-1111-1111-1111-111111111001', 'superadmin', 'superadmin@iestp-suiza.edu.pe',
   '$argon2id$v=19$m=65536,t=3,p=4$00112233445566778899aabbccddeeff$99f5f2641e26b1231377758f7129de5dda29351fed69e70b77f8d6d5c9d361e95663601355658a76fa3004fa92c5eec474a38776dc37df1ff8b6cae994e0ddb8', TRUE),
  ('22222222-2222-2222-2222-222222222002', '11111111-1111-1111-1111-111111111002', 'director', 'director@iestp-suiza.edu.pe',
   '$argon2id$v=19$m=65536,t=3,p=4$00112233445566778899aabbccddeeff$99f5f2641e26b1231377758f7129de5dda29351fed69e70b77f8d6d5c9d361e95663601355658a76fa3004fa92c5eec474a38776dc37df1ff8b6cae994e0ddb8', TRUE),
  ('22222222-2222-2222-2222-222222222003', '11111111-1111-1111-1111-111111111003', 'docente', 'docente@iestp-suiza.edu.pe',
   '$argon2id$v=19$m=65536,t=3,p=4$00112233445566778899aabbccddeeff$99f5f2641e26b1231377758f7129de5dda29351fed69e70b77f8d6d5c9d361e95663601355658a76fa3004fa92c5eec474a38776dc37df1ff8b6cae994e0ddb8', TRUE),
  ('22222222-2222-2222-2222-222222222004', '11111111-1111-1111-1111-111111111004', 'mesa_partes', 'mesadepartes@iestp-suiza.edu.pe',
   '$argon2id$v=19$m=65536,t=3,p=4$00112233445566778899aabbccddeeff$99f5f2641e26b1231377758f7129de5dda29351fed69e70b77f8d6d5c9d361e95663601355658a76fa3004fa92c5eec474a38776dc37df1ff8b6cae994e0ddb8', TRUE),
  ('22222222-2222-2222-2222-222222222005', '11111111-1111-1111-1111-111111111005', 'estudiante', 'estudiante@iestp-suiza.edu.pe',
   '$argon2id$v=19$m=65536,t=3,p=4$00112233445566778899aabbccddeeff$99f5f2641e26b1231377758f7129de5dda29351fed69e70b77f8d6d5c9d361e95663601355658a76fa3004fa92c5eec474a38776dc37df1ff8b6cae994e0ddb8', TRUE)
ON CONFLICT (usuario) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  correo = EXCLUDED.correo,
  activo = TRUE;

-- 8.5 Asignación de rol vigente por usuario (reemplaza asignaciones previas del mismo rol)
-- Limpieza suave: revocar asignaciones vigentes previas de estos usuarios demo
UPDATE sigd_org.usuario_rol
   SET vigente_hasta = now()
 WHERE id_usuario IN (
   '22222222-2222-2222-2222-222222222001',
   '22222222-2222-2222-2222-222222222002',
   '22222222-2222-2222-2222-222222222003',
   '22222222-2222-2222-2222-222222222004',
   '22222222-2222-2222-2222-222222222005'
 ) AND vigente_hasta IS NULL;

-- Asignaciones vigentes
-- (NOTA: literales con cast ::uuid porque UNION ALL resolvería el tipo como text)
INSERT INTO sigd_org.usuario_rol (id_usuario, rol_id, vigente_desde)
SELECT '22222222-2222-2222-2222-222222222001'::uuid, rol_id, now() FROM sigd_org.rol_sistema WHERE codigo = 'SUPER_ADMIN'
UNION ALL
SELECT '22222222-2222-2222-2222-222222222002'::uuid, rol_id, now() FROM sigd_org.rol_sistema WHERE codigo = 'DIRECTOR'
UNION ALL
SELECT '22222222-2222-2222-2222-222222222003'::uuid, rol_id, now() FROM sigd_org.rol_sistema WHERE codigo = 'DOCENTE'
UNION ALL
SELECT '22222222-2222-2222-2222-222222222004'::uuid, rol_id, now() FROM sigd_org.rol_sistema WHERE codigo = 'MESA_PARTES'
UNION ALL
SELECT '22222222-2222-2222-2222-222222222005'::uuid, rol_id, now() FROM sigd_org.rol_sistema WHERE codigo = 'ESTUDIANTE';

-- 8.6 Perfiles mínimos (evita JOIN nulo en /auth/me)
INSERT INTO sigd_auth.perfil_usuario (id_usuario, telefono, firma_electronica_habilitada)
VALUES
  ('22222222-2222-2222-2222-222222222001', '900000001', TRUE),
  ('22222222-2222-2222-2222-222222222002', '900000002', TRUE),
  ('22222222-2222-2222-2222-222222222003', '900000003', TRUE),
  ('22222222-2222-2222-2222-222222222004', '900000004', FALSE),
  ('22222222-2222-2222-2222-222222222005', '900000005', FALSE)
ON CONFLICT (id_usuario) DO NOTHING;
