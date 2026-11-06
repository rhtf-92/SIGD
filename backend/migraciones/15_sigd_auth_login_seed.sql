-- =============================================================================
-- Migración 15 · Restauración de autenticación y alias de rol ADMIN
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
-- -----------------------------------------------------------------------------
-- Objetivo:
--   1. Permitir el código de rol ADMIN en sigd_org.rol_sistema.
--   2. Asegurar los roles que consumen el backend y el frontend.
--   3. Replicar en ADMIN los permisos de ADMINISTRADOR para que el alias no
--      quede sin autorizaciones internas.
--
-- La carga de las cinco cuentas operativas (password "123") se realiza con
-- `npm run seed:auth`, que usa Argon2Service para generar hashes con sal
-- aleatoria. No se incluyen contraseñas en esta migración.
-- =============================================================================

-- 15.1 Catálogo de roles: habilitar ADMIN junto a los códigos históricos.
ALTER TABLE sigd_org.rol_sistema DROP CONSTRAINT IF EXISTS chk_rol_codigo;
ALTER TABLE sigd_org.rol_sistema
    ADD CONSTRAINT chk_rol_codigo CHECK (codigo IN (
        'ADMIN',
        'ADMINISTRADOR',
        'SUPER_ADMIN',
        'DIRECTOR',
        'SECRETARIO',
        'ESPECIALISTA',
        'DOCENTE',
        'MESA_PARTES',
        'CIUDADANO',
        'ESTUDIANTE'
    ));

-- 15.2 Roles requeridos por el contrato de autenticación.
INSERT INTO sigd_org.rol_sistema (codigo, nombre, descripcion, vigente)
VALUES
    ('ADMIN',        'Administrador',          'Alias operativo del Administrador del Sistema', TRUE),
    ('ADMINISTRADOR','Administrador del Sistema','Administración técnica total de la plataforma SIGD', TRUE),
    ('SUPER_ADMIN',  'Super Administrador',    'Alias de gobernanza global del SIGD', TRUE),
    ('DIRECTOR',     'Director General',       'Emisión de resoluciones directorales y firma digital', TRUE),
    ('SECRETARIO',   'Secretario Académico',   'Proyección y preparación de resoluciones y expedientes', TRUE),
    ('DOCENTE',      'Docente / Coordinador',  'Evaluación académica y derivación de actuados', TRUE),
    ('ESPECIALISTA', 'Especialista',           'Análisis técnico y emisión de dictámenes', TRUE),
    ('MESA_PARTES',  'Mesa de Partes',         'Recepción, radicación y registro de documentos', TRUE),
    ('CIUDADANO',    'Ciudadano / Administrado','Consulta pública y casilla electrónica', TRUE),
    ('ESTUDIANTE',   'Estudiante / Administrado','Trámites propios y casilla electrónica personal', TRUE)
ON CONFLICT (codigo) DO UPDATE
    SET vigente = TRUE;

-- 15.3 ADMIN hereda la matriz de permisos de ADMINISTRADOR.
INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT rol_admin.rol_id, rp.permiso_id
  FROM sigd_org.rol_sistema rol_admin
  JOIN sigd_org.rol_sistema rol_base
    ON rol_base.codigo = 'ADMINISTRADOR'
  JOIN sigd_org.rol_permiso rp
    ON rp.rol_id = rol_base.rol_id
 WHERE rol_admin.codigo = 'ADMIN'
ON CONFLICT DO NOTHING;
