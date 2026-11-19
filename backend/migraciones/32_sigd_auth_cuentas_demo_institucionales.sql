-- ============================================================================
-- 32_sigd_auth_cuentas_demo_institucionales.sql
-- Semillas canónicas de cuentas y roles institucionales del IESTP Suiza
-- Clave compartida para cuentas de prueba: admin123 ($argon2id$...)
-- ============================================================================

-- 1. Personas base
INSERT INTO sigd_auth.persona (id_persona, tipo, id_documento)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'NATURAL', '00000001'),
    ('00000000-0000-0000-0000-000000000002', 'NATURAL', '00000002'),
    ('00000000-0000-0000-0000-000000000003', 'NATURAL', '00000003'),
    ('00000000-0000-0000-0000-000000000004', 'NATURAL', '00000004'),
    ('00000000-0000-0000-0000-000000000005', 'NATURAL', '00000005')
ON CONFLICT (id_persona) DO NOTHING;

-- 2. Personas Naturales
INSERT INTO sigd_auth.persona_natural (id_persona, nombres, apellidos, nombre_completo, correo)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'Administrador', 'General', 'Administrador General', 'admin@iestp-suiza.edu.pe'),
    ('00000000-0000-0000-0000-000000000002', 'Operador', 'Mesa de Partes', 'Operador Mesa de Partes', 'mesapartes@iestp-suiza.edu.pe'),
    ('00000000-0000-0000-0000-000000000003', 'Director', 'General', 'Director General', 'director@iestp-suiza.edu.pe'),
    ('00000000-0000-0000-0000-000000000004', 'Docente', 'Institucional', 'Docente Institucional', 'docente@iestp-suiza.edu.pe'),
    ('00000000-0000-0000-0000-000000000005', 'Estudiante', 'Prueba', 'Estudiante Prueba', 'estudiante@iestp-suiza.edu.pe')
ON CONFLICT (id_persona) DO UPDATE SET
    nombre_completo = EXCLUDED.nombre_completo,
    correo = EXCLUDED.correo;

-- 3. Cuentas de Usuario (Hash Argon2id de 'admin123')
INSERT INTO sigd_auth.cuenta_usuario (id_usuario, id_persona, usuario, correo, password_hash, activo)
VALUES
    ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'admin', 'admin@iestp-suiza.edu.pe', '$argon2id$v=19$m=65536,t=3,p=4$61646d696e5f73616c745f3230323621$b86d779eda5f9d3e43e6c4c5a54642cc1f54738ab694f737539fa5efff0993e0c9a0a268a73169dd90cd66b4dcecdbf52f63ab51628c416fba573884d6a6999e', TRUE),
    ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'mesapartes', 'mesapartes@iestp-suiza.edu.pe', '$argon2id$v=19$m=65536,t=3,p=4$61646d696e5f73616c745f3230323621$b86d779eda5f9d3e43e6c4c5a54642cc1f54738ab694f737539fa5efff0993e0c9a0a268a73169dd90cd66b4dcecdbf52f63ab51628c416fba573884d6a6999e', TRUE),
    ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', 'director', 'director@iestp-suiza.edu.pe', '$argon2id$v=19$m=65536,t=3,p=4$61646d696e5f73616c745f3230323621$b86d779eda5f9d3e43e6c4c5a54642cc1f54738ab694f737539fa5efff0993e0c9a0a268a73169dd90cd66b4dcecdbf52f63ab51628c416fba573884d6a6999e', TRUE),
    ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004', 'docente', 'docente@iestp-suiza.edu.pe', '$argon2id$v=19$m=65536,t=3,p=4$61646d696e5f73616c745f3230323621$b86d779eda5f9d3e43e6c4c5a54642cc1f54738ab694f737539fa5efff0993e0c9a0a268a73169dd90cd66b4dcecdbf52f63ab51628c416fba573884d6a6999e', TRUE),
    ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000005', 'estudiante', 'estudiante@iestp-suiza.edu.pe', '$argon2id$v=19$m=65536,t=3,p=4$61646d696e5f73616c745f3230323621$b86d779eda5f9d3e43e6c4c5a54642cc1f54738ab694f737539fa5efff0993e0c9a0a268a73169dd90cd66b4dcecdbf52f63ab51628c416fba573884d6a6999e', TRUE)
ON CONFLICT (id_usuario) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    activo = TRUE;

-- 4. Asignación de Roles Institucionales
INSERT INTO sigd_org.usuario_rol (id_usuario, rol_id)
SELECT '00000000-0000-0000-0000-000000000001'::uuid, rol_id FROM sigd_org.rol_sistema WHERE codigo = 'ADMINISTRADOR'
ON CONFLICT DO NOTHING;

INSERT INTO sigd_org.usuario_rol (id_usuario, rol_id)
SELECT '00000000-0000-0000-0000-000000000002'::uuid, rol_id FROM sigd_org.rol_sistema WHERE codigo = 'MESA_PARTES'
ON CONFLICT DO NOTHING;

INSERT INTO sigd_org.usuario_rol (id_usuario, rol_id)
SELECT '00000000-0000-0000-0000-000000000003'::uuid, rol_id FROM sigd_org.rol_sistema WHERE codigo = 'DIRECTOR'
ON CONFLICT DO NOTHING;

INSERT INTO sigd_org.usuario_rol (id_usuario, rol_id)
SELECT '00000000-0000-0000-0000-000000000004'::uuid, rol_id FROM sigd_org.rol_sistema WHERE codigo = 'DOCENTE'
ON CONFLICT DO NOTHING;

INSERT INTO sigd_org.usuario_rol (id_usuario, rol_id)
SELECT '00000000-0000-0000-0000-000000000005'::uuid, rol_id FROM sigd_org.rol_sistema WHERE codigo = 'ESTUDIANTE'
ON CONFLICT DO NOTHING;
