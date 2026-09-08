-- =========================================================================
-- MÓDULO IDENTICORE - ESQUEMA POSTGRESQL V2.0 (Polimórfico, Argon2id, Ley 29733)
-- Responsable: Segundo (B_SEGUNDO)
-- Fuente de verdad: Plan de Trabajo "Levantamiento de Observaciones" v2.0
-- =========================================================================

-- 1. Base abstracta: Persona (identidad civil)
CREATE TABLE sigd_auth.persona (
    id                  BIGSERIAL PRIMARY KEY,
    tipo_documento_id   BIGINT      NOT NULL,
    numero_documento   VARCHAR(20)  NOT NULL,
    nombres             VARCHAR(120) NOT NULL,
    apellido_paterno    VARCHAR(120) NOT NULL,
    apellido_materno    VARCHAR(120),
    fecha_nacimiento    DATE,
    genero              VARCHAR(1),
    telefono            VARCHAR(20),
    email_contacto      VARCHAR(150),
    estado              BOOLEAN     NOT NULL DEFAULT TRUE,
    tipo_persona        VARCHAR(20) NOT NULL DEFAULT 'NATURAL',  -- NATURAL | JURIDICA
    CONSTRAINT fk_persona_tipo_documento
        FOREIGN KEY (tipo_documento_id)
        REFERENCES sigd_auth.tipos_documento (id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT uq_persona_documento UNIQUE (tipo_documento_id, numero_documento)
);

-- 2. Entidad polimórfica: Persona Natural (DNI/CE/Pasaporte)
CREATE TABLE sigd_auth.persona_natural (
    id                    BIGSERIAL PRIMARY KEY,
    persona_id            BIGINT     NOT NULL,
    numero_documento      VARCHAR(20) NOT NULL,
    nombres               VARCHAR(120) NOT NULL,
    apellido_paterno      VARCHAR(120) NOT NULL,
    apellido_materno      VARCHAR(120),
    fecha_nacimiento      DATE,
    genero                VARCHAR(1),
    telefono              VARCHAR(20),
    email_contacto        VARCHAR(150),
    estado                BOOLEAN     NOT NULL DEFAULT TRUE,
    CONSTRAINT fk_persona_natural_persona
        FOREIGN KEY (persona_id)
        REFERENCES sigd_auth.persona(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT chk_persona_natural_dni_format
        CHECK (tipo_persona = 'NATURAL' AND 
                (numero_documento ~* '^[0-9]{8}$'))
);

-- 3. Entidad polimórfica: Persona Jurídica (RUC)
CREATE TABLE sigd_auth.persona_juridica (
    id                    BIGSERIAL PRIMARY KEY,
    persona_id            BIGINT     NOT NULL,
    razon_social         VARCHAR(200) NOT NULL,
    nombre_comercial      VARCHAR(200) NOT NULL,
    partida_registral_sunarp BIGINT  NOT NULL,
    estado               BOOLEAN     NOT NULL DEFAULT TRUE,
    CONSTRAINT fk_persona_juridica_persona
        FOREIGN KEY (persona_id)
        REFERENCES sigd_auth.persona(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT uq_persona_juridica_razon UNIQUE (razon_social),
    CONSTRAINT chk_persona_juridica_ruc_format
        CHECK (numero_documento ~* '^(10|15|17|20)[0-9]{9}$')
);

-- 4. Representación Legal: Vincula persona natural a persona jurídica
CREATE TABLE sigd_auth.representacion_legal (
    id                    BIGSERIAL PRIMARY KEY,
    persona_natural_id    BIGINT     NOT NULL,
    persona_juridica_id   BIGINT     NOT NULL,
    vigencia_inicio       DATE       NOT NULL,
    vigencia_fin          DATE,
    activo                BOOLEAN    NOT NULL DEFAULT TRUE,
    CONSTRAINT fk_rep_legal_natural
        FOREIGN KEY (persona_natural_id)
        REFERENCES sigd_auth.persona_natural(id),
    CONSTRAINT fk_rep_legal_juridica
        FOREIGN KEY (persona_juridica_id)
        REFERENCES sigd_auth.persona_juridica(id),
    CONSTRAINT chk_rep_legal_one_to_one
        UNIQUE (persona_natural_id, persona_juridica_id)
);

-- 5. Sesión de Usuario: Sesion_usuario con diseño Argon2id
CREATE TABLE sigd_auth.sesion_usuario (
    id                    BIGSERIAL PRIMARY KEY,
    usuario_id            BIGINT     NOT NULL,
    token_refresh         VARCHAR(255) NOT NULL,  -- Token de refresco
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at            TIMESTAMPTZ NOT NULL,
    ip_address            INET,
    user_agent            TEXT,
    last_ip               INET,
    last_user_agent       TEXT,
    CONSTRAINT fk_sesion_usuario_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES sigd_auth.cuenta_usuario(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT chk_sesion_token_length
        CHECK (LENGTH(token_refresh) BETWEEN 32 AND 256)
);

-- 6. Consentimiento de Datos: Ley N° 29733
CREATE TABLE sigd_auth.consentimiento_datos (
    id                    BIGSERIAL PRIMARY KEY,
    usuario_id            BIGINT     NOT NULL,
    fecha_aceptacion      TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip_address            INET,
    version_termsoservicio VARCHAR(50) NOT NULL,
    aceptacion_notificaciones BOOLEAN NOT NULL,
    consentimiento_obfuscacion BOOLEAN NOT NULL,  -- True si se aplica ofuscación
    CONSTRAINT fk_consent_datos_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES sigd_auth.cuenta_usuario(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT chk_consent_data_types
        CHECK (version_termsoservicio IN ('v1.0', 'v1.1', 'v2.0'))
);

-- 7. Tipos de Documento (catálogo)
CREATE TABLE sigd_auth.tipos_documento (
    id                  BIGSERIAL PRIMARY KEY,
    codigo              VARCHAR(20) NOT NULL UNIQUE,
    nombre              VARCHAR(60) NOT NULL,
    estado              BOOLEAN NOT NULL DEFAULT TRUE
);

-- 8. Documentos Históricos
CREATE TABLE sigd_auth.persona_documento_historial (
    id                    BIGSERIAL PRIMARY KEY,
    persona_id            BIGINT     NOT NULL,
    tipo_documento_id     BIGINT     NOT NULL,
    numero_documento_anterior VARCHAR(20) NOT NULL,
    fecha_registro        TIMESTAMPTZ NOT NULL DEFAULT now(),
    motivo               TEXT,
    CONSTRAINT fk_hist_documento_persona
        FOREIGN KEY (persona_id)
        REFERENCES sigd_auth.persona(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_hist_documento_tipo
        FOREIGN KEY (tipo_documento_id)
        REFERENCES sigd_auth.tipos_documento(id)
);

-- 9. Cuenta de Usuario (credenciales)
CREATE TABLE sigd_auth.cuenta_usuario (
    id                    BIGSERIAL PRIMARY KEY,
    persona_id            BIGINT     NOT NULL,
    username              VARCHAR(50) NOT NULL UNIQUE,
    email_login           VARCHAR(150) NOT NULL UNIQUE,
    password_hash         VARCHAR(255) NOT NULL,
    estado                BOOLEAN     NOT NULL DEFAULT TRUE,
    intentos_fallidos     SMALLINT   NOT NULL DEFAULT 0,
    bloqueado_hasta       TIMESTAMPTZ,
    ultimo_acceso        TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_cuenta_usuario_persona
        FOREIGN KEY (persona_id)
        REFERENCES sigd_auth.persona(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT uq_cuenta_username UNIQUE (username),
    CONSTRAINT uq_cuenta_email_login UNIQUE (email_login)
);

-- 10. Perfil Institucional
CREATE TABLE sigd_auth.perfil_usuario (
    id                    BIGSERIAL PRIMARY KEY,
    persona_id            BIGINT     NOT NULL,
    cuenta_usuario_id     BIGINT     NOT NULL,
    tipo_usuario          VARCHAR(20) NOT NULL,
    condicion_registro    VARCHAR(20) NOT NULL,
    area_id               BIGINT,
    cargo_id              BIGINT,
    rol_id                BIGINT,
    fecha_vigencia_inicio DATE,
    fecha_vigencia_fin    DATE,
    estado                BOOLEAN     NOT NULL DEFAULT TRUE,
    CONSTRAINT fk_perfil_usuario_persona
        FOREIGN KEY (persona_id)
        REFERENCES sigd_auth.persona(id),
    CONSTRAINT fk_perfil_usuario_cuenta
        FOREIGN KEY (cuenta_usuario_id)
        REFERENCES sigd_auth.cuenta_usuario(id),
    CONSTRAINT fk_perfil_usuario_area
        FOREIGN KEY (area_id)
        REFERENCES sigd_auth.areas(id),  -- Referencia conceptual a OrganiCore
    CONSTRAINT fk_perfil_usuario_cargo
        FOREIGN KEY (cargo_id)
        REFERENCES sigd_auth.cargos(id),
    CONSTRAINT fk_perfil_usuario_rol
        FOREIGN KEY (rol_id)
        REFERENCES sigd_auth.roles(id),
    CONSTRAINT chk_perfil_tipo_usuario
        CHECK (tipo_usuario IN ('INTERNO', 'EXTERNO')),
    CONSTRAINT chk_perfil_condicion
        CHECK (condicion_registro IN ('CON_CUENTA', 'SIN_CUENTA'))
);

-- 11. Auditoría de Cambios
CREATE TABLE sigd_auth.auditoria_usuarios (
    id                    BIGSERIAL PRIMARY KEY,
    usuario_accion_id    BIGINT     NOT NULL,
    entidad_afectada     VARCHAR(40) NOT NULL,
    entidad_id           BIGINT     NOT NULL,
    accion               VARCHAR(30) NOT NULL,
    detalle              JSONB,
    fecha                TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_auditoria_accion
        FOREIGN KEY (usuario_accion_id)
        REFERENCES sigd_auth.cuenta_usuario(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

-- 12. Datos de Prueba Ficticios
INSERT INTO sigd_auth.tipos_documento (codigo, nombre) VALUES
    ('DNI', 'Documento Nacional de Identidad'),
    ('CE',  'Carné de Extranjería'),
    ('PAS', 'Pasaporte');

-- Insertar personas de ejemplo
INSERT INTO sigd_auth.personas (tipo_documento_id, numero_documento, nombres, apellido_paterno, apellido_materno, email_contacto, estado)
VALUES
    (1, '00000001', 'Funcionario', 'Prueba', 'Interno', 'funcionario.prueba@sigd.gob.pe', TRUE),
    (1, '00000002', 'Ciudadano',   'Solicitante', 'Externo', 'ciudadano.externo@example.com', TRUE);

-- Crear cuentas de ejemplo
INSERT INTO sigd_auth.cuenta_usuario (persona_id, username, email_login, password_hash, estado)
VALUES
    (1, 'fprueba_int', 'funcionario.prueba@sigd.gob.pe', '$2b$12$DummyHashForTestingPurposesOnlyNotReal00001', TRUE),
    (2, 'csolicitante_ext', 'ciudadano.externo@example.com', '$2b$12$DummyHashForTestingPurposesOnlyNotReal00002', TRUE);

-- Crear perfiles de ejemplo
INSERT INTO sigd_auth.perfil_usuario (persona_id, cuenta_usuario_id, tipo_usuario, condicion_registro, area_id, cargo_id, rol_id, estado)
VALUES
    (1, 1, 'INTERNO', 'CON_CUENTA', 101, 5, 2, TRUE),
    (2, 2, 'EXTERNO', 'CON_CUENTA', NULL, NULL, NULL, TRUE);

-- Crear representación legal de ejemplo
INSERT INTO sigd_auth.representacion_legal (persona_natural_id, persona_juridica_id, vigencia_inicio, activo)
VALUES
    (1, 1, CURRENT_DATE, TRUE);

-- Crear consentimiento de datos de ejemplo
INSERT INTO sigd_auth.consentimiento_datos (usuario_id, fecha_aceptacion, ip_address, version_termsoservicio, aceptacion_notificaciones, consentimiento_obfuscacion)
VALUES
    (1, CURRENT_TIMESTAMP, '192.168.1.1', 'v2.0', TRUE, TRUE);

-- Comentarios
COMMENT ON TABLE sigd_auth.persona IS 'Base abstracta de identidad civil (DNI, CE, Pasaporte)';
COMMENT ON TABLE sigd_auth.persona_natural IS 'Entidad natural (DNI/CE/Pasaporte) con datos personales detallados';
COMMENT ON TABLE sigd_auth.persona_juridica IS 'Entidad jurídica (RUC, razón social, partida SUNARP)';
COMMENT ON TABLE sigd_auth.representacion_legal IS 'Vinculación entre persona natural y persona jurídica';
COMMENT ON TABLE sigd_auth.sesion_usuario IS 'Gestión de sesiones con tokens de refresco (Argon2id)';
COMMENT ON TABLE sigd_auth.consentimiento_datos IS 'Registro de consentimiento bajo Ley N° 29733 (Protección de Datos)';