-- =============================================================================
-- Migración 09 · Esquema sigd_org / sigd_auth
-- Semilla Oficial de Directorio de Personal Institucional IESTP "Suiza"
-- -----------------------------------------------------------------------------
-- Registra cuentas operativas con asignación de área, cargo y rol formal:
--   1. admin: Super Administrador (Administración / Administrador del Sistema)
--   2. director: Director General (Dirección General / Director General)
--   3. sec.academica: Secretario Académico (Secretaría Académica / Secretario Académico)
--   4. mesa.partes: Operador Ventanilla (Mesa de Partes / Operador de Ventanilla)
--   5. coordinador.dsi: Coordinador Académico (Unidad Académica / Coordinador Académico)
--   6. especialista: Especialista Trámite (Administración / Especialista en Trámite Documentario)
-- =============================================================================

-- Contraseña compartida de desarrollo/prueba para cuentas institucionales: "admin"
-- Hash Argon2id: $argon2id$v=19$m=65536,p=4,t=3$PogTZJDdv+FSH90IKSs2sQ$UISRKBb7pZHpzSLJjlOqcXsN/xJg6Qzgm+koZI3SnVM

-- -----------------------------------------------------------------------------
-- 1. ASIGNACIÓN INSTITUCIONAL DE ADMIN (00000000-0000-0000-0000-000000000001)
-- -----------------------------------------------------------------------------
INSERT INTO sigd_org.asignacion_personal (id_asignacion, id_usuario, area_id, cargo_id, vigente_desde)
SELECT 
    '00000000-0000-0000-0001-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    a.area_id,
    c.cargo_id,
    now()
FROM sigd_org.area a, sigd_org.cargo c
WHERE a.codigo = 'ADMIN' AND c.codigo = 'ADMINISTRADOR_SISTEMA'
ON CONFLICT (id_asignacion) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2. DIRECTOR GENERAL (Lic. Julio César Mori Paredes)
-- -----------------------------------------------------------------------------
INSERT INTO sigd_auth.persona (id_persona, tipo, id_documento)
VALUES ('00000000-0000-0000-0000-000000000002', 'NATURAL', '10203040')
ON CONFLICT (id_persona) DO NOTHING;

INSERT INTO sigd_auth.persona_natural (id_persona, nombres, apellidos, nombre_completo, correo)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    'Julio César',
    'Mori Paredes',
    'Lic. Julio César Mori Paredes',
    'director@iestpsuiza.edu.pe'
)
ON CONFLICT (id_persona) DO UPDATE
    SET nombre_completo = EXCLUDED.nombre_completo,
        correo = EXCLUDED.correo;

INSERT INTO sigd_auth.cuenta_usuario (id_usuario, id_persona, usuario, correo, password_hash, activo)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002',
    'director',
    'director@iestpsuiza.edu.pe',
    '$argon2id$v=19$m=65536,p=4,t=3$PogTZJDdv+FSH90IKSs2sQ$UISRKBb7pZHpzSLJjlOqcXsN/xJg6Qzgm+koZI3SnVM',
    TRUE
)
ON CONFLICT (id_usuario) DO NOTHING;

INSERT INTO sigd_org.asignacion_personal (id_asignacion, id_usuario, area_id, cargo_id, vigente_desde)
SELECT 
    '00000000-0000-0000-0001-000000000002'::uuid,
    '00000000-0000-0000-0000-000000000002'::uuid,
    a.area_id,
    c.cargo_id,
    now()
FROM sigd_org.area a, sigd_org.cargo c
WHERE a.codigo = 'DIR_GEN' AND c.codigo = 'DIRECTOR_GENERAL'
ON CONFLICT (id_asignacion) DO NOTHING;

INSERT INTO sigd_org.usuario_rol (id_usuario_rol, id_usuario, rol_id, area_id, vigente_desde)
SELECT
    '00000000-0000-0000-0002-000000000002'::uuid,
    '00000000-0000-0000-0000-000000000002'::uuid,
    r.rol_id,
    a.area_id,
    now()
FROM sigd_org.rol_sistema r, sigd_org.area a
WHERE r.codigo = 'DIRECTOR' AND a.codigo = 'DIR_GEN'
ON CONFLICT (id_usuario_rol) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. SECRETARIO ACADÉMICO (Abg. Carlos Alberto Mendoza Ríos)
-- -----------------------------------------------------------------------------
INSERT INTO sigd_auth.persona (id_persona, tipo, id_documento)
VALUES ('00000000-0000-0000-0000-000000000003', 'NATURAL', '20304050')
ON CONFLICT (id_persona) DO NOTHING;

INSERT INTO sigd_auth.persona_natural (id_persona, nombres, apellidos, nombre_completo, correo)
VALUES (
    '00000000-0000-0000-0000-000000000003',
    'Carlos Alberto',
    'Mendoza Ríos',
    'Abg. Carlos Alberto Mendoza Ríos',
    'sec.academica@iestpsuiza.edu.pe'
)
ON CONFLICT (id_persona) DO UPDATE
    SET nombre_completo = EXCLUDED.nombre_completo,
        correo = EXCLUDED.correo;

INSERT INTO sigd_auth.cuenta_usuario (id_usuario, id_persona, usuario, correo, password_hash, activo)
VALUES (
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000003',
    'sec.academica',
    'sec.academica@iestpsuiza.edu.pe',
    '$argon2id$v=19$m=65536,p=4,t=3$PogTZJDdv+FSH90IKSs2sQ$UISRKBb7pZHpzSLJjlOqcXsN/xJg6Qzgm+koZI3SnVM',
    TRUE
)
ON CONFLICT (id_usuario) DO NOTHING;

INSERT INTO sigd_org.asignacion_personal (id_asignacion, id_usuario, area_id, cargo_id, vigente_desde)
SELECT 
    '00000000-0000-0000-0001-000000000003'::uuid,
    '00000000-0000-0000-0000-000000000003'::uuid,
    a.area_id,
    c.cargo_id,
    now()
FROM sigd_org.area a, sigd_org.cargo c
WHERE a.codigo = 'SEC_ACAD' AND c.codigo = 'SECRETARIO_ACADEMICO'
ON CONFLICT (id_asignacion) DO NOTHING;

INSERT INTO sigd_org.usuario_rol (id_usuario_rol, id_usuario, rol_id, area_id, vigente_desde)
SELECT
    '00000000-0000-0000-0002-000000000003'::uuid,
    '00000000-0000-0000-0000-000000000003'::uuid,
    r.rol_id,
    a.area_id,
    now()
FROM sigd_org.rol_sistema r, sigd_org.area a
WHERE r.codigo = 'SECRETARIO' AND a.codigo = 'SEC_ACAD'
ON CONFLICT (id_usuario_rol) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 4. OPERADOR DE MESA DE PARTES (Bach. Ana María Torres Vásquez)
-- -----------------------------------------------------------------------------
INSERT INTO sigd_auth.persona (id_persona, tipo, id_documento)
VALUES ('00000000-0000-0000-0000-000000000004', 'NATURAL', '30405060')
ON CONFLICT (id_persona) DO NOTHING;

INSERT INTO sigd_auth.persona_natural (id_persona, nombres, apellidos, nombre_completo, correo)
VALUES (
    '00000000-0000-0000-0000-000000000004',
    'Ana María',
    'Torres Vásquez',
    'Bach. Ana María Torres Vásquez',
    'mesa.partes@iestpsuiza.edu.pe'
)
ON CONFLICT (id_persona) DO UPDATE
    SET nombre_completo = EXCLUDED.nombre_completo,
        correo = EXCLUDED.correo;

INSERT INTO sigd_auth.cuenta_usuario (id_usuario, id_persona, usuario, correo, password_hash, activo)
VALUES (
    '00000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000004',
    'mesa.partes',
    'mesa.partes@iestpsuiza.edu.pe',
    '$argon2id$v=19$m=65536,p=4,t=3$PogTZJDdv+FSH90IKSs2sQ$UISRKBb7pZHpzSLJjlOqcXsN/xJg6Qzgm+koZI3SnVM',
    TRUE
)
ON CONFLICT (id_usuario) DO NOTHING;

INSERT INTO sigd_org.asignacion_personal (id_asignacion, id_usuario, area_id, cargo_id, vigente_desde)
SELECT 
    '00000000-0000-0000-0001-000000000004'::uuid,
    '00000000-0000-0000-0000-000000000004'::uuid,
    a.area_id,
    c.cargo_id,
    now()
FROM sigd_org.area a, sigd_org.cargo c
WHERE a.codigo = 'MESA_PAR' AND c.codigo = 'OPERADOR_VENTANILLA'
ON CONFLICT (id_asignacion) DO NOTHING;

INSERT INTO sigd_org.usuario_rol (id_usuario_rol, id_usuario, rol_id, area_id, vigente_desde)
SELECT
    '00000000-0000-0000-0002-000000000004'::uuid,
    '00000000-0000-0000-0000-000000000004'::uuid,
    r.rol_id,
    a.area_id,
    now()
FROM sigd_org.rol_sistema r, sigd_org.area a
WHERE r.codigo = 'MESA_PARTES' AND a.codigo = 'MESA_PAR'
ON CONFLICT (id_usuario_rol) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 5. COORDINADOR ACADÉMICO / DOCENTE (Ing. Roberto Carlos Peña Dávila)
-- -----------------------------------------------------------------------------
INSERT INTO sigd_auth.persona (id_persona, tipo, id_documento)
VALUES ('00000000-0000-0000-0000-000000000005', 'NATURAL', '40506070')
ON CONFLICT (id_persona) DO NOTHING;

INSERT INTO sigd_auth.persona_natural (id_persona, nombres, apellidos, nombre_completo, correo)
VALUES (
    '00000000-0000-0000-0000-000000000005',
    'Roberto Carlos',
    'Peña Dávila',
    'Ing. Roberto Carlos Peña Dávila',
    'coordinador.dsi@iestpsuiza.edu.pe'
)
ON CONFLICT (id_persona) DO UPDATE
    SET nombre_completo = EXCLUDED.nombre_completo,
        correo = EXCLUDED.correo;

INSERT INTO sigd_auth.cuenta_usuario (id_usuario, id_persona, usuario, correo, password_hash, activo)
VALUES (
    '00000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000005',
    'coordinador.dsi',
    'coordinador.dsi@iestpsuiza.edu.pe',
    '$argon2id$v=19$m=65536,p=4,t=3$PogTZJDdv+FSH90IKSs2sQ$UISRKBb7pZHpzSLJjlOqcXsN/xJg6Qzgm+koZI3SnVM',
    TRUE
)
ON CONFLICT (id_usuario) DO NOTHING;

INSERT INTO sigd_org.asignacion_personal (id_asignacion, id_usuario, area_id, cargo_id, vigente_desde)
SELECT 
    '00000000-0000-0000-0001-000000000005'::uuid,
    '00000000-0000-0000-0000-000000000005'::uuid,
    a.area_id,
    c.cargo_id,
    now()
FROM sigd_org.area a, sigd_org.cargo c
WHERE a.codigo = 'UNID_ACAD' AND c.codigo = 'COORDINADOR_ACADEMICO'
ON CONFLICT (id_asignacion) DO NOTHING;

INSERT INTO sigd_org.usuario_rol (id_usuario_rol, id_usuario, rol_id, area_id, vigente_desde)
SELECT
    '00000000-0000-0000-0002-000000000005'::uuid,
    '00000000-0000-0000-0000-000000000005'::uuid,
    r.rol_id,
    a.area_id,
    now()
FROM sigd_org.rol_sistema r, sigd_org.area a
WHERE r.codigo = 'DOCENTE' AND a.codigo = 'UNID_ACAD'
ON CONFLICT (id_usuario_rol) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 6. ESPECIALISTA EN TRÁMITE DOCUMENTARIO (Lic. Patricia Elena Rojas Salazar)
-- -----------------------------------------------------------------------------
INSERT INTO sigd_auth.persona (id_persona, tipo, id_documento)
VALUES ('00000000-0000-0000-0000-000000000006', 'NATURAL', '50607080')
ON CONFLICT (id_persona) DO NOTHING;

INSERT INTO sigd_auth.persona_natural (id_persona, nombres, apellidos, nombre_completo, correo)
VALUES (
    '00000000-0000-0000-0000-000000000006',
    'Patricia Elena',
    'Rojas Salazar',
    'Lic. Patricia Elena Rojas Salazar',
    'especialista@iestpsuiza.edu.pe'
)
ON CONFLICT (id_persona) DO UPDATE
    SET nombre_completo = EXCLUDED.nombre_completo,
        correo = EXCLUDED.correo;

INSERT INTO sigd_auth.cuenta_usuario (id_usuario, id_persona, usuario, correo, password_hash, activo)
VALUES (
    '00000000-0000-0000-0000-000000000006',
    '00000000-0000-0000-0000-000000000006',
    'especialista',
    'especialista@iestpsuiza.edu.pe',
    '$argon2id$v=19$m=65536,p=4,t=3$PogTZJDdv+FSH90IKSs2sQ$UISRKBb7pZHpzSLJjlOqcXsN/xJg6Qzgm+koZI3SnVM',
    TRUE
)
ON CONFLICT (id_usuario) DO NOTHING;

INSERT INTO sigd_org.asignacion_personal (id_asignacion, id_usuario, area_id, cargo_id, vigente_desde)
SELECT 
    '00000000-0000-0000-0001-000000000006'::uuid,
    '00000000-0000-0000-0000-000000000006'::uuid,
    a.area_id,
    c.cargo_id,
    now()
FROM sigd_org.area a, sigd_org.cargo c
WHERE a.codigo = 'ADMIN' AND c.codigo = 'ESPECIALISTA_TRAMITE'
ON CONFLICT (id_asignacion) DO NOTHING;

INSERT INTO sigd_org.usuario_rol (id_usuario_rol, id_usuario, rol_id, area_id, vigente_desde)
SELECT
    '00000000-0000-0000-0002-000000000006'::uuid,
    '00000000-0000-0000-0000-000000000006'::uuid,
    r.rol_id,
    a.area_id,
    now()
FROM sigd_org.rol_sistema r, sigd_org.area a
WHERE r.codigo = 'ESPECIALISTA' AND a.codigo = 'ADMIN'
ON CONFLICT (id_usuario_rol) DO NOTHING;
