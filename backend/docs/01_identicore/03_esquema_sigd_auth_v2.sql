-- =========================================================================
-- MÓDULO IDENTICORE - ESQUEMA POSTGRESQL V2.0 (Polimórfico, Argon2id, Ley 29733)
-- Responsable: Segundo (B_SEGUNDO)
-- Fuente de verdad: Plan de Trabajo "Levantamiento de Observaciones" v2.0
-- Motor: PostgreSQL 18.6
-- =========================================================================

-- 0. Creación del esquema
CREATE SCHEMA IF NOT EXISTS sigd_auth;

-- Limpieza controlada e idempotente en orden inverso de dependencias (para desarrollo/pruebas)
DROP TABLE IF EXISTS sigd_auth.auditoria_usuarios CASCADE;
DROP TABLE IF EXISTS sigd_auth.perfil_usuario CASCADE;
DROP TABLE IF EXISTS sigd_auth.consentimiento_datos CASCADE;
DROP TABLE IF EXISTS sigd_auth.sesion_usuario CASCADE;
DROP TABLE IF EXISTS sigd_auth.cuenta_usuario CASCADE;
DROP TABLE IF EXISTS sigd_auth.persona_documento_historial CASCADE;
DROP TABLE IF EXISTS sigd_auth.representacion_legal CASCADE;
DROP TABLE IF EXISTS sigd_auth.persona_juridica CASCADE;
DROP TABLE IF EXISTS sigd_auth.persona_natural CASCADE;
DROP TABLE IF EXISTS sigd_auth.persona CASCADE;
DROP TABLE IF EXISTS sigd_auth.tipos_documento CASCADE;

-- 1. Catálogo: Tipos de Documento
CREATE TABLE sigd_auth.tipos_documento (
    id                  BIGSERIAL PRIMARY KEY,
    codigo              VARCHAR(20) NOT NULL UNIQUE,
    nombre              VARCHAR(60) NOT NULL,
    estado              BOOLEAN NOT NULL DEFAULT TRUE
);

-- 2. Base abstracta: Persona (identidad civil)
CREATE TABLE sigd_auth.persona (
    id                  BIGSERIAL PRIMARY KEY,
    tipo_documento_id   BIGINT       NOT NULL,
    numero_documento    VARCHAR(20)  NOT NULL,
    nombres             VARCHAR(120) NOT NULL,
    apellido_paterno    VARCHAR(120) NOT NULL,
    apellido_materno    VARCHAR(120),
    fecha_nacimiento    DATE,
    genero              VARCHAR(1),
    telefono            VARCHAR(20),
    email_contacto      VARCHAR(150),
    estado              BOOLEAN      NOT NULL DEFAULT TRUE,
    tipo_persona        VARCHAR(20)  NOT NULL DEFAULT 'NATURAL',  -- NATURAL | JURIDICA
    CONSTRAINT fk_persona_tipo_documento
        FOREIGN KEY (tipo_documento_id)
        REFERENCES sigd_auth.tipos_documento (id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT uq_persona_documento UNIQUE (tipo_documento_id, numero_documento),
    CONSTRAINT chk_persona_tipo_persona
        CHECK (tipo_persona IN ('NATURAL', 'JURIDICA')),
    -- NOTA: Validación sintáctica de formato y prefijo para RUC (11 dígitos iniciando en 10, 15, 17 o 20).
    -- Esta restricción NO constituye validación oficial ante SUNAT ni cálculo de dígito verificador.
    -- Las validaciones oficiales quedan fuera del alcance de esta etapa (requieren servicios mock o PIDE).
    CONSTRAINT chk_persona_ruc_format
        CHECK (tipo_persona <> 'JURIDICA' OR (numero_documento ~* '^(10|15|17|20)[0-9]{9}$'))
);

-- 3. Entidad polimórfica: Persona Natural (DNI/CE/Pasaporte)
CREATE TABLE sigd_auth.persona_natural (
    id                    BIGSERIAL PRIMARY KEY,
    persona_id            BIGINT       NOT NULL,
    numero_documento      VARCHAR(20)  NOT NULL,
    nombres               VARCHAR(120) NOT NULL,
    apellido_paterno      VARCHAR(120) NOT NULL,
    apellido_materno      VARCHAR(120),
    fecha_nacimiento      DATE,
    genero                VARCHAR(1),
    telefono              VARCHAR(20),
    email_contacto        VARCHAR(150),
    estado                BOOLEAN      NOT NULL DEFAULT TRUE,
    CONSTRAINT fk_persona_natural_persona
        FOREIGN KEY (persona_id)
        REFERENCES sigd_auth.persona(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    -- NOTA: Validación sintáctica de formato para DNI de 8 dígitos en entidad persona_natural.
    -- Esta restricción NO constituye validación de identidad oficial ante RENIEC, Migraciones ni la plataforma PIDE.
    -- La verificación de identidad ciudadana en tiempo real queda fuera del alcance de esta etapa de persistencia local.
    CONSTRAINT chk_persona_natural_dni_format
        CHECK (numero_documento ~* '^[0-9]{8}$')
);

-- 4. Entidad polimórfica: Persona Jurídica (RUC)
CREATE TABLE sigd_auth.persona_juridica (
    id                       BIGSERIAL PRIMARY KEY,
    persona_id               BIGINT       NOT NULL,
    razon_social             VARCHAR(200) NOT NULL,
    nombre_comercial         VARCHAR(200) NOT NULL,
    partida_registral_sunarp BIGINT       NOT NULL,
    estado                   BOOLEAN      NOT NULL DEFAULT TRUE,
    CONSTRAINT fk_persona_juridica_persona
        FOREIGN KEY (persona_id)
        REFERENCES sigd_auth.persona(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT uq_persona_juridica_razon UNIQUE (razon_social)
);

-- NOTA DE ALCANCE POLIMÓRFICO: las tablas `persona_natural`/`persona_juridica`
-- referencian a `persona` vía FK N:1. El SQL actual NO impide que una persona
-- quede sin extensión ni con dos extensiones, ni garantiza especialización
-- total/exclusiva 1:1. Esa garantía requiere lógica transaccional de alta
-- (función/trigger diferible) PENDIENTE de decisión e implementación en aplicación.

-- 5. Representación Legal: Vincula persona natural a persona jurídica
CREATE TABLE sigd_auth.representacion_legal (
    id                    BIGSERIAL PRIMARY KEY,
    persona_natural_id    BIGINT  NOT NULL,
    persona_juridica_id   BIGINT  NOT NULL,
    vigencia_inicio       DATE    NOT NULL,
    vigencia_fin          DATE,
    activo                BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT fk_rep_legal_natural
        FOREIGN KEY (persona_natural_id)
        REFERENCES sigd_auth.persona_natural(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_rep_legal_juridica
        FOREIGN KEY (persona_juridica_id)
        REFERENCES sigd_auth.persona_juridica(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT uq_rep_legal_natural_juridica
        UNIQUE (persona_natural_id, persona_juridica_id),
    CONSTRAINT chk_rep_legal_vigencia
        CHECK (vigencia_fin IS NULL OR vigencia_fin >= vigencia_inicio)
);

-- NOTA DE ALCANCE: `uq_rep_legal_natural_juridica` impide duplicar la dupla
-- (natural, jurídica) incluso con vigencias cerradas, pero NO implementa
-- prevención de solapamiento por rango/alcance (requeriría EXCLUDE/trigger).
-- La vigencia se valida solo como coherencia temporal básica.

-- 6. Documentos Históricos
CREATE TABLE sigd_auth.persona_documento_historial (
    id                        BIGSERIAL PRIMARY KEY,
    persona_id                BIGINT      NOT NULL,
    tipo_documento_id         BIGINT      NOT NULL,
    numero_documento_anterior VARCHAR(20) NOT NULL,
    fecha_registro            TIMESTAMPTZ NOT NULL DEFAULT now(),
    motivo                    TEXT,
    CONSTRAINT fk_hist_documento_persona
        FOREIGN KEY (persona_id)
        REFERENCES sigd_auth.persona(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_hist_documento_tipo
        FOREIGN KEY (tipo_documento_id)
        REFERENCES sigd_auth.tipos_documento(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

-- 7. Cuenta de Usuario (credenciales)
CREATE TABLE sigd_auth.cuenta_usuario (
    id                BIGSERIAL PRIMARY KEY,
    persona_id        BIGINT       NOT NULL,
    username          VARCHAR(50)  NOT NULL UNIQUE,
    email_login       VARCHAR(150) NOT NULL UNIQUE,
    password_hash     VARCHAR(255) NOT NULL,
    estado            BOOLEAN      NOT NULL DEFAULT TRUE,
    intentos_fallidos SMALLINT     NOT NULL DEFAULT 0,
    bloqueado_hasta   TIMESTAMPTZ,
    ultimo_acceso     TIMESTAMPTZ,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT fk_cuenta_usuario_persona
        FOREIGN KEY (persona_id)
        REFERENCES sigd_auth.persona(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT uq_cuenta_username UNIQUE (username),
    CONSTRAINT uq_cuenta_email_login UNIQUE (email_login),
    CONSTRAINT chk_cuenta_intentos
        CHECK (intentos_fallidos >= 0)
);

-- 8. Sesión de Usuario: Sesion_usuario con diseño Argon2id
CREATE TABLE sigd_auth.sesion_usuario (
    id              BIGSERIAL PRIMARY KEY,
    usuario_id      BIGINT       NOT NULL,
    token_refresh   VARCHAR(255) NOT NULL,  -- Token de refresco
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ  NOT NULL,
    ip_address      INET,
    user_agent      TEXT,
    last_ip         INET,
    last_user_agent TEXT,
    CONSTRAINT fk_sesion_usuario_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES sigd_auth.cuenta_usuario(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT chk_sesion_token_length
        CHECK (LENGTH(token_refresh) BETWEEN 32 AND 255)
);

-- 9. Consentimiento de Datos: Ley N° 29733
CREATE TABLE sigd_auth.consentimiento_datos (
    id                         BIGSERIAL PRIMARY KEY,
    usuario_id                 BIGINT      NOT NULL,
    fecha_aceptacion           TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip_address                 INET,
    version_termsoservicio     VARCHAR(50) NOT NULL,
    aceptacion_notificaciones  BOOLEAN     NOT NULL,
    consentimiento_obfuscacion BOOLEAN     NOT NULL,  -- True si se aplica ofuscación
    CONSTRAINT fk_consent_datos_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES sigd_auth.cuenta_usuario(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT chk_consent_data_types
        CHECK (version_termsoservicio IN ('v1.0', 'v1.1', 'v2.0'))
);

-- NOTA DE ALCANCE LEY 29733: esta tabla registra estructura, versión e
-- IP/fecha del consentimiento. NO garantiza por sí sola cumplimiento jurídico
-- integral ni inmutabilidad del historial (sin trigger read-only PENDIENTE).

-- 10. Perfil Institucional
CREATE TABLE sigd_auth.perfil_usuario (
    id                    BIGSERIAL PRIMARY KEY,
    persona_id            BIGINT      NOT NULL,
    cuenta_usuario_id     BIGINT,
    tipo_usuario          VARCHAR(20) NOT NULL,
    condicion_registro    VARCHAR(20) NOT NULL,
    area_id               BIGINT,     -- Referencia conceptual hacia OrganiCore (sin FK física en IdentiCore)
    cargo_id              BIGINT,     -- Referencia conceptual hacia OrganiCore (sin FK física en IdentiCore)
    rol_id                BIGINT,     -- Referencia conceptual hacia OrganiCore (sin FK física en IdentiCore)
    fecha_vigencia_inicio DATE,
    fecha_vigencia_fin    DATE,
    estado                BOOLEAN     NOT NULL DEFAULT TRUE,
    CONSTRAINT fk_perfil_usuario_persona
        FOREIGN KEY (persona_id)
        REFERENCES sigd_auth.persona(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_perfil_usuario_cuenta
        FOREIGN KEY (cuenta_usuario_id)
        REFERENCES sigd_auth.cuenta_usuario(id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT chk_perfil_tipo_usuario
        CHECK (tipo_usuario IN ('INTERNO', 'EXTERNO')),
    CONSTRAINT chk_perfil_condicion
        CHECK (condicion_registro IN ('CON_CUENTA', 'SIN_CUENTA')),
    CONSTRAINT chk_perfil_cuenta_coherencia
        CHECK (
            (condicion_registro = 'CON_CUENTA' AND cuenta_usuario_id IS NOT NULL)
            OR
            (condicion_registro = 'SIN_CUENTA' AND cuenta_usuario_id IS NULL)
        )
);

-- NOTA DE ALCANCE BAJA LÓGICA: `estado BOOLEAN` (TRUE/FALSE) es la baja lógica
-- implementada en SQL. Los estados funcionales `ACTIVA`/`BLOQUEADA_TEMPORAL`/
-- `INACTIVA` del análisis son estados de aplicación y se derivan de
-- `estado` + `intentos_fallidos`/`bloqueado_hasta`; no existen como VARCHAR en BD.

-- 11. Auditoría de Cambios
CREATE TABLE sigd_auth.auditoria_usuarios (
    id                BIGSERIAL PRIMARY KEY,
    usuario_accion_id BIGINT      NOT NULL,
    entidad_afectada  VARCHAR(40) NOT NULL,
    entidad_id        BIGINT      NOT NULL,
    accion            VARCHAR(30) NOT NULL,
    detalle           JSONB,
    fecha             TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_auditoria_accion
        FOREIGN KEY (usuario_accion_id)
        REFERENCES sigd_auth.cuenta_usuario(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT chk_auditoria_entidad
        CHECK (entidad_afectada IN ('PERSONA', 'CUENTA', 'PERFIL', 'CONSENTIMIENTO')),
    CONSTRAINT chk_auditoria_accion
        CHECK (accion IN ('CREATE', 'UPDATE', 'DELETE', 'ACTIVATE', 'DEACTIVATE'))
);

-- =========================================================================
-- 12. Datos de Prueba Ficticios (Poblado ordenado y polimórfico)
-- =========================================================================

-- 12.1 Catálogo de tipos de documento
INSERT INTO sigd_auth.tipos_documento (codigo, nombre) VALUES
    ('DNI', 'Documento Nacional de Identidad'),
    ('CE',  'Carné de Extranjería'),
    ('PAS', 'Pasaporte'),
    ('RUC', 'Registro Único de Contribuyentes');

-- 12.2 Identidades base (Persona)
INSERT INTO sigd_auth.persona (tipo_documento_id, numero_documento, nombres, apellido_paterno, apellido_materno, email_contacto, estado, tipo_persona)
VALUES
    (1, '00000001', 'Funcionario', 'Prueba', 'Interno', 'funcionario.prueba@sigd.gob.pe', TRUE, 'NATURAL'),
    (1, '00000002', 'Ciudadano',   'Solicitante', 'Externo', 'ciudadano.externo@example.com', TRUE, 'NATURAL'),
    (4, '20123456789', 'Empresa de Prueba S.A.C.', 'Prueba', NULL, 'contacto@empresaprueba.com', TRUE, 'JURIDICA');

-- 12.3 Extensiones polimórficas de identidad
INSERT INTO sigd_auth.persona_natural (persona_id, numero_documento, nombres, apellido_paterno, apellido_materno, email_contacto, estado)
VALUES
    (1, '00000001', 'Funcionario', 'Prueba', 'Interno', 'funcionario.prueba@sigd.gob.pe', TRUE),
    (2, '00000002', 'Ciudadano',   'Solicitante', 'Externo', 'ciudadano.externo@example.com', TRUE);

INSERT INTO sigd_auth.persona_juridica (persona_id, razon_social, nombre_comercial, partida_registral_sunarp, estado)
VALUES
    (3, 'Empresa de Prueba S.A.C.', 'Prueba S.A.C.', 11223344, TRUE);

-- 12.4 Representación legal de prueba
-- Mapeo de identificadores polimórficos:
-- - persona.id = 1 (Funcionario)       -> persona_natural.id = 1
-- - persona.id = 3 (Empresa de Prueba) -> persona_juridica.id = 1
-- Por tanto, representacion_legal vincula persona_natural_id = 1 con persona_juridica_id = 1
-- (utilizando el identificador de la entidad jurídica extendida, NO el persona.id = 3).
INSERT INTO sigd_auth.representacion_legal (persona_natural_id, persona_juridica_id, vigencia_inicio, activo)
VALUES
    (1, 1, CURRENT_DATE, TRUE);

-- 12.5 Cuentas de usuario de ejemplo (hashes reales y verificables en formato Argon2id)
-- Parámetros Argon2id aplicados: memory: 65536 KiB (64 MB), iterations: 3, parallelism: 4, tagLength: 32.
-- Contraseñas de prueba conocidas (destinadas EXCLUSIVAMENTE a entornos locales/pruebas):
-- - Usuario 1 ('fprueba_int'):     'Funcionario2026!'
-- - Usuario 2 ('csolicitante_ext'): 'Ciudadano2026!'
INSERT INTO sigd_auth.cuenta_usuario (persona_id, username, email_login, password_hash, estado)
VALUES
    (1, 'fprueba_int', 'funcionario.prueba@sigd.gob.pe', '$argon2id$v=19$m=65536,t=3,p=4$c2lnZF9hdXRoX3NhbHRfMQ$951YaDkH0Om0O6Jzgn2kaYkbwDmPgccFpmYU2xhwrS4', TRUE),
    (2, 'csolicitante_ext', 'ciudadano.externo@example.com', '$argon2id$v=19$m=65536,t=3,p=4$c2lnZF9hdXRoX3NhbHRfMg$Vda1xshplgUo8HLm6o3ixt9W/GieH7OGwxIz4NMF4gs', TRUE);

-- 12.6 Sesiones de usuario de ejemplo
INSERT INTO sigd_auth.sesion_usuario (usuario_id, token_refresh, expires_at, ip_address, user_agent)
VALUES
    (1, 'a1b2c3d4e5f6789012345678901234567890abcdef12345678901234567890abcd', now() + interval '7 days', '192.168.1.10'::inet, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)');

-- 12.7 Consentimiento de datos de ejemplo (Ley N° 29733)
INSERT INTO sigd_auth.consentimiento_datos (usuario_id, fecha_aceptacion, ip_address, version_termsoservicio, aceptacion_notificaciones, consentimiento_obfuscacion)
VALUES
    (1, CURRENT_TIMESTAMP, '192.168.1.1', 'v2.0', TRUE, TRUE);

-- 12.8 Perfiles institucionales de ejemplo (cubriendo usuarios CON_CUENTA y SIN_CUENTA)
-- Nota: area_id, cargo_id y rol_id permanecen NULL mientras OrganiCore no esté físicamente desplegado.
INSERT INTO sigd_auth.perfil_usuario (persona_id, cuenta_usuario_id, tipo_usuario, condicion_registro, area_id, cargo_id, rol_id, estado)
VALUES
    (1, 1, 'INTERNO', 'CON_CUENTA', NULL, NULL, NULL, TRUE),
    (2, 2, 'EXTERNO', 'CON_CUENTA', NULL, NULL, NULL, TRUE),
    (2, NULL, 'EXTERNO', 'SIN_CUENTA', NULL, NULL, NULL, TRUE);

-- 12.9 Auditoría de cambios de ejemplo
INSERT INTO sigd_auth.auditoria_usuarios (usuario_accion_id, entidad_afectada, entidad_id, accion, detalle)
VALUES
    (1, 'PERSONA', 1, 'CREATE', '{"motivo": "Registro inicial de prueba"}'::jsonb);

-- =========================================================================
-- 13. Comentarios descriptivos del catálogo
-- =========================================================================
COMMENT ON SCHEMA sigd_auth IS 'Esquema del Módulo IdentiCore - Gestión de Identidades, Credenciales y Perfiles';
COMMENT ON TABLE sigd_auth.tipos_documento IS 'Catálogo de tipos de documento de identidad (DNI, CE, PAS, RUC)';
COMMENT ON TABLE sigd_auth.persona IS 'Base abstracta de identidad civil (DNI, CE, Pasaporte, RUC)';
COMMENT ON TABLE sigd_auth.persona_natural IS 'Entidad natural (DNI/CE/Pasaporte) con datos personales detallados';
COMMENT ON TABLE sigd_auth.persona_juridica IS 'Entidad jurídica (RUC, razón social, partida SUNARP)';
COMMENT ON TABLE sigd_auth.representacion_legal IS 'Vinculación entre persona natural y persona jurídica';
COMMENT ON TABLE sigd_auth.persona_documento_historial IS 'Historial de cambios y renovaciones de documento de identidad';
COMMENT ON TABLE sigd_auth.cuenta_usuario IS 'Credenciales de autenticación y seguridad de acceso (Argon2id)';
COMMENT ON TABLE sigd_auth.sesion_usuario IS 'Gestión de sesiones y almacenamiento controlado de tokens de refresco; la rotación y detección de reutilización se implementan en la capa de aplicación.';
COMMENT ON TABLE sigd_auth.consentimiento_datos IS 'Registro de consentimiento bajo Ley N° 29733 (Protección de Datos)';
COMMENT ON TABLE sigd_auth.perfil_usuario IS 'Vínculo institucional del usuario (rol funcional y condicion de registro)';
COMMENT ON TABLE sigd_auth.auditoria_usuarios IS 'Registro de trazabilidad y auditoría de eventos sobre identidades y cuentas';