-- =========================================================================
-- MÓDULO IDENTICORE - BORRADOR SQL PROVISIONAL (PostgreSQL 18.6)
-- Responsable: Segundo (Rama B_SEGUNDO)
-- Fuente de verdad: 02_modelo_datos_usuarios.md + 02_diccionario_datos_usuarios.md
-- Convención de niveles: CONFIRMADO / PROPUESTO / PENDIENTE / EJEMPLO
-- Nota: Estructura preliminar sujeta a confirmación institucional oficial.
-- =========================================================================

-- Eliminar tablas si existen en orden inverso para evitar conflictos de FK.
-- SOLO para escenarios de reinicio/borrador; la política de producción
-- prevé conservación histórica (bajas lógicas) en lugar de eliminación física.
DROP TABLE IF EXISTS auditoria_usuarios;
DROP TABLE IF EXISTS persona_documento_historial;
DROP TABLE IF EXISTS perfil_usuario;
DROP TABLE IF EXISTS cuenta_usuario;
DROP TABLE IF EXISTS personas;
DROP TABLE IF EXISTS tipos_documento;

-- 1. Catálogo de Tipos de Documento (catálogo abierto; valores PENDIENTES)
CREATE TABLE tipos_documento (
    id          BIGSERIAL PRIMARY KEY,
    codigo      VARCHAR(20) NOT NULL,
    nombre      VARCHAR(60) NOT NULL,
    estado      BOOLEAN     NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_tipos_documento_codigo UNIQUE (codigo)
);

-- 2. Persona (Identidad Civil - el documento NO es clave primaria técnica)
CREATE TABLE personas (
    id                 BIGSERIAL PRIMARY KEY,
    tipo_documento_id  BIGINT      NOT NULL,
    numero_documento   VARCHAR(20) NOT NULL,
    nombres            VARCHAR(120) NOT NULL,
    apellido_paterno   VARCHAR(120) NOT NULL,
    apellido_materno   VARCHAR(120),
    fecha_nacimiento   DATE,
    genero             VARCHAR(1),
    telefono           VARCHAR(20),
    email_contacto     VARCHAR(150),
    estado             BOOLEAN     NOT NULL DEFAULT TRUE,
    CONSTRAINT fk_personas_tipo_documento
        FOREIGN KEY (tipo_documento_id) REFERENCES tipos_documento (id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    -- PROPUESTO / PENDIENTE: prevenir identidades duplicadas solo si la
    -- normativa lo justifica. Nunca como PK.
    CONSTRAINT uq_persona_documento UNIQUE (tipo_documento_id, numero_documento)
);

CREATE INDEX idx_personas_numero_documento ON personas (numero_documento);

-- 3. Historial Documental (conservación histórica; sin borrado en cascada)
CREATE TABLE persona_documento_historial (
    id                      BIGSERIAL PRIMARY KEY,
    persona_id              BIGINT      NOT NULL,
    tipo_documento_id       BIGINT      NOT NULL,
    numero_documento_anterior VARCHAR(20) NOT NULL,
    fecha_registro          TIMESTAMPTZ NOT NULL DEFAULT now(),
    motivo                  TEXT,
    CONSTRAINT fk_hist_prod_persona
        FOREIGN KEY (persona_id) REFERENCES personas (id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_hist_prod_tipo_documento
        FOREIGN KEY (tipo_documento_id) REFERENCES tipos_documento (id)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

-- 4. Cuenta de Usuario (Credenciales y Autenticación)
CREATE TABLE cuenta_usuario (
    id               BIGSERIAL PRIMARY KEY,
    persona_id       BIGINT       NOT NULL,
    username         VARCHAR(50)  NOT NULL,
    email_login      VARCHAR(150) NOT NULL,
    password_hash    VARCHAR(255) NOT NULL,
    estado           BOOLEAN      NOT NULL DEFAULT TRUE,
    intentos_fallidos SMALLINT    NOT NULL DEFAULT 0,
    bloqueado_hasta  TIMESTAMPTZ,
    ultimo_acceso    TIMESTAMPTZ,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT fk_cuenta_usuario_persona
        FOREIGN KEY (persona_id) REFERENCES personas (id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT uq_cuenta_username UNIQUE (username),
    CONSTRAINT uq_cuenta_email_login UNIQUE (email_login),
    CONSTRAINT ck_cuenta_intentos CHECK (intentos_fallidos >= 0)
);

-- 5. Perfil de Usuario (Vínculo institucional / rol - conceptual con G3)
CREATE TABLE perfil_usuario (
    id                   BIGSERIAL PRIMARY KEY,
    persona_id           BIGINT      NOT NULL,
    cuenta_usuario_id    BIGINT,
    tipo_usuario         VARCHAR(20) NOT NULL,
    condicion_registro   VARCHAR(20) NOT NULL,
    -- Referencias conceptuales hacia OrganiCore (Grupo 3): no se crea FK física.
    area_id              BIGINT,
    cargo_id             BIGINT,
    rol_id               BIGINT,
    fecha_vigencia_inicio DATE,
    fecha_vigencia_fin   DATE,
    estado               BOOLEAN     NOT NULL DEFAULT TRUE,
    CONSTRAINT fk_perfil_usuario_persona
        FOREIGN KEY (persona_id) REFERENCES personas (id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_perfil_usuario_cuenta
        FOREIGN KEY (cuenta_usuario_id) REFERENCES cuenta_usuario (id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT ck_perfil_tipo_usuario
        CHECK (tipo_usuario IN ('INTERNO','EXTERNO')),
    CONSTRAINT ck_perfil_condicion_registro
        CHECK (condicion_registro IN ('CON_CUENTA','SIN_CUENTA'))
);

CREATE INDEX idx_perfil_usuario_estado_tipo
    ON perfil_usuario (estado, tipo_usuario);

-- 6. Auditoría de cambios sobre personas, cuentas y perfiles
CREATE TABLE auditoria_usuarios (
    id                BIGSERIAL PRIMARY KEY,
    usuario_accion_id BIGINT,
    entidad_afectada  VARCHAR(40) NOT NULL,
    entidad_id        BIGINT      NOT NULL,
    accion            VARCHAR(30) NOT NULL,
    detalle           JSONB,
    fecha             TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_auditoria_usuario_accion
        FOREIGN KEY (usuario_accion_id) REFERENCES cuenta_usuario (id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT ck_auditoria_entidad CHECK
        (entidad_afectada IN ('PERSONA','CUENTA','PERFIL'))
);

-- =========================================================================
-- DATOS DE PRUEBA FICTICIOS (EJEMPLO - No oficiales)
-- =========================================================================

INSERT INTO tipos_documento (codigo, nombre) VALUES
    ('DNI', 'Documento Nacional de Identidad'),
    ('CE',  'Carné de Extranjería'),
    ('PAS', 'Pasaporte');

INSERT INTO personas
    (tipo_documento_id, numero_documento, nombres, apellido_paterno, apellido_materno, email_contacto, estado)
VALUES
    (1, '00000001', 'Funcionario', 'Prueba', 'Interno', 'funcionario.prueba@sigd.gob.pe', TRUE),
    (1, '00000002', 'Ciudadano',   'Solicitante', 'Externo', 'ciudadano.externo@example.com', TRUE);

INSERT INTO cuenta_usuario (persona_id, username, email_login, password_hash, estado)
VALUES
    (1, 'fprueba_int', 'funcionario.prueba@sigd.gob.pe',
     '$2b$12$DummyHashForTestingPurposesOnlyNotReal00001', TRUE),
    (2, 'csolicitante_ext', 'ciudadano.externo@example.com',
     '$2b$12$DummyHashForTestingPurposesOnlyNotReal00002', TRUE);

INSERT INTO perfil_usuario
    (persona_id, cuenta_usuario_id, tipo_usuario, condicion_registro, area_id, cargo_id, rol_id, estado)
VALUES
    (1, 1, 'INTERNO', 'CON_CUENTA', 101, 5, 2, TRUE),
    (2, 2, 'EXTERNO', 'CON_CUENTA', NULL, NULL, NULL, TRUE);
