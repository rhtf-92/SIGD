-- =============================================================================
-- Migración 02 · Esquema sigd_auth
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
-- -----------------------------------------------------------------------------
-- Autor     : Ricardo Arévalo Villacorta (B_AREVALO) · Grupo 6 CoreLink
-- Marco     : TUO Ley 27444, Ley N° 29733 (Protección de Datos Personales)
-- Depende de: 01_sigd_audit.sql
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS sigd_auth;

-- -----------------------------------------------------------------------------
-- 2.1 Catálogos civiles
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_auth.tipos_documento (
    id_tipo_documento  SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo            VARCHAR(10)  NOT NULL UNIQUE,
    descripcion       VARCHAR(120) NOT NULL,
    requiere_ruc      BOOLEAN      NOT NULL DEFAULT FALSE,
    largo             SMALLINT     NOT NULL DEFAULT 8,
    vigente           BOOLEAN      NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_tipos_documento_codigo CHECK (codigo IN ('DNI', 'CE', 'RUC', 'PASAPORTE'))
);

CREATE TABLE IF NOT EXISTS sigd_auth.persona (
    id_persona    UUID        NOT NULL DEFAULT gen_random_uuid()
                               CONSTRAINT pk_persona PRIMARY KEY,
    tipo          VARCHAR(20) NOT NULL,
    id_documento  VARCHAR(20) NOT NULL,
    creado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_persona_documento UNIQUE (tipo, id_documento),
    CONSTRAINT chk_persona_tipo CHECK (tipo IN ('NATURAL', 'JURIDICA'))
);

-- -----------------------------------------------------------------------------
-- 2.2 Extensiones polimórficas
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_auth.persona_natural (
    id_persona      UUID        NOT NULL
                                 CONSTRAINT pk_persona_natural PRIMARY KEY
                                 REFERENCES sigd_auth.persona (id_persona) ON DELETE CASCADE,
    nombres         VARCHAR(120) NOT NULL,
    apellidos       VARCHAR(120) NOT NULL,
    nombre_completo VARCHAR(255) NOT NULL,
    fecha_nacimiento DATE       NULL,
    sexo            CHAR(1)     NULL,
    correo          VARCHAR(160) NULL,
    telefono        VARCHAR(20)  NULL,
    CONSTRAINT chk_persona_natural_sexo CHECK (sexo IS NULL OR sexo IN ('M', 'F'))
);

CREATE TABLE IF NOT EXISTS sigd_auth.persona_juridica (
    id_persona        UUID        NOT NULL
                                   CONSTRAINT pk_persona_juridica PRIMARY KEY
                                   REFERENCES sigd_auth.persona (id_persona) ON DELETE CASCADE,
    razon_social      VARCHAR(255) NOT NULL,
    nombre_comercial  VARCHAR(255) NULL,
    representante_legal VARCHAR(255) NULL,
    direccion         VARCHAR(255) NULL
);

CREATE TABLE IF NOT EXISTS sigd_auth.representacion_legal (
    id_representacion UUID        NOT NULL DEFAULT gen_random_uuid()
                                   CONSTRAINT pk_representacion_legal PRIMARY KEY,
    id_persona_juridica UUID      NOT NULL
                                   REFERENCES sigd_auth.persona (id_persona) ON DELETE CASCADE,
    id_persona_natural  UUID      NOT NULL
                                   REFERENCES sigd_auth.persona (id_persona) ON DELETE CASCADE,
    cargo             VARCHAR(120) NOT NULL,
    vigente_desde     DATE        NOT NULL DEFAULT CURRENT_DATE,
    vigente_hasta     DATE        NULL,
    CONSTRAINT chk_representacion_vigencia CHECK (vigente_hasta IS NULL OR vigente_hasta >= vigente_desde)
);

CREATE TABLE IF NOT EXISTS sigd_auth.persona_documento_historial (
    id_historial     UUID        NOT NULL DEFAULT gen_random_uuid()
                                 CONSTRAINT pk_persona_documento_historial PRIMARY KEY,
    id_persona       UUID        NOT NULL
                                 REFERENCES sigd_auth.persona (id_persona) ON DELETE CASCADE,
    id_documento     VARCHAR(20) NOT NULL,
    tipo_documento   SMALLINT    NULL
                                 REFERENCES sigd_auth.tipos_documento (id_tipo_documento),
    fecha_registro   TIMESTAMPTZ NOT NULL DEFAULT now(),
    origen           VARCHAR(64) NOT NULL,
    CONSTRAINT chk_persona_documento_historial_origen CHECK (origen IN ('RENIEC', 'SUNAT', 'MANUAL'))
);

-- -----------------------------------------------------------------------------
-- 2.3 Cuentas, sesiones y consentimiento (Ley N° 29733)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_auth.cuenta_usuario (
    id_usuario       UUID        NOT NULL DEFAULT gen_random_uuid()
                                 CONSTRAINT pk_cuenta_usuario PRIMARY KEY,
    id_persona       UUID        NOT NULL
                                 REFERENCES sigd_auth.persona (id_persona) ON DELETE RESTRICT,
    usuario          VARCHAR(60) NOT NULL UNIQUE,
    correo           VARCHAR(160) NOT NULL UNIQUE,
    password_hash    VARCHAR(255) NOT NULL,
    activo           BOOLEAN     NOT NULL DEFAULT TRUE,
    ultimo_acceso    TIMESTAMPTZ NULL,
    creado_en        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_cuenta_usuario_algoritmo CHECK (password_hash LIKE '$argon2id$%')
);

CREATE TABLE IF NOT EXISTS sigd_auth.sesion_usuario (
    id_sesion        UUID        NOT NULL DEFAULT gen_random_uuid()
                                 CONSTRAINT pk_sesion_usuario PRIMARY KEY,
    id_usuario       UUID        NOT NULL
                                 REFERENCES sigd_auth.cuenta_usuario (id_usuario) ON DELETE CASCADE,
    refresh_token    VARCHAR(255) NOT NULL UNIQUE,
    fingerprint      VARCHAR(128) NULL,
    ip_origen        INET        NULL,
    user_agent       VARCHAR(512) NULL,
    emitido_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
    expira_en        TIMESTAMPTZ NOT NULL,
    revocado_en      TIMESTAMPTZ NULL,
    CONSTRAINT chk_sesion_usuario_vigencia CHECK (expira_en > emitido_en)
);

CREATE TABLE IF NOT EXISTS sigd_auth.consentimiento_datos (
    id_consentimiento UUID        NOT NULL DEFAULT gen_random_uuid()
                                   CONSTRAINT pk_consentimiento_datos PRIMARY KEY,
    id_persona       UUID        NOT NULL
                                   REFERENCES sigd_auth.persona (id_persona) ON DELETE CASCADE,
    finalidade      VARCHAR(120) NOT NULL,
    version_politica VARCHAR(20) NOT NULL,
    aceptado        BOOLEAN     NOT NULL,
    fecha_aceptacion TIMESTAMPTZ NULL,
    ip_origen       INET        NULL,
    CONSTRAINT chk_consentimiento_aceptacion
        CHECK (aceptado = FALSE OR fecha_aceptacion IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS sigd_auth.perfil_usuario (
    id_usuario       UUID        NOT NULL
                                 CONSTRAINT pk_perfil_usuario PRIMARY KEY
                                 REFERENCES sigd_auth.cuenta_usuario (id_usuario) ON DELETE CASCADE,
    cargo_id         UUID        NULL,
    area_id          UUID        NULL,
    telefono         VARCHAR(20) NULL,
    firma_electronica_habilitada BOOLEAN NOT NULL DEFAULT FALSE,
    actualizado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sigd_auth.auditoria_usuarios (
    id_auditoria    UUID        NOT NULL DEFAULT gen_random_uuid()
                                CONSTRAINT pk_auditoria_usuarios PRIMARY KEY,
    correlation_id  UUID        NOT NULL,
    id_usuario      UUID        NULL,
    operacion       VARCHAR(64) NOT NULL,
    detalle         JSONB       NULL,
    fecha_hora      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cuenta_usuario_persona
    ON sigd_auth.cuenta_usuario (id_persona);
CREATE INDEX IF NOT EXISTS idx_sesion_usuario_usuario
    ON sigd_auth.sesion_usuario (id_usuario);
CREATE INDEX IF NOT EXISTS idx_sesion_usuario_expira
    ON sigd_auth.sesion_usuario (expira_en);
CREATE INDEX IF NOT EXISTS idx_consentimiento_persona
    ON sigd_auth.consentimiento_datos (id_persona);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuarios_correlacion
    ON sigd_auth.auditoria_usuarios (correlation_id);

-- -----------------------------------------------------------------------------
-- 2.4 notificacion_casilla (Casilla Electrónica y Acuse Legal - Ley N° 29733)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_auth.notificacion_casilla (
    id                    UUID         NOT NULL DEFAULT gen_random_uuid()
                                       CONSTRAINT pk_notificacion_casilla PRIMARY KEY,
    usuario_id            UUID         NULL
                                       REFERENCES sigd_auth.cuenta_usuario (id_usuario) ON DELETE CASCADE,
    correo_destinatario   VARCHAR(160) NULL,
    cut                   VARCHAR(20)  NULL,
    asunto                VARCHAR(255) NOT NULL,
    tipo_acto             VARCHAR(100) NOT NULL DEFAULT 'Notificación de Acto Administrativo',
    numero_documento      VARCHAR(100) NULL,
    cuerpo                JSONB        NULL,
    referencia            VARCHAR(100) NULL,
    estado                VARCHAR(20)  NOT NULL DEFAULT 'NO_LEIDO',
    fecha_deposito        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    fecha_lectura         TIMESTAMPTZ  NULL,
    hash_sha256           VARCHAR(64)  NULL,
    cvd                   VARCHAR(64)  NULL,
    id_acuse              VARCHAR(50)  NULL,
    acuse_hash_sha256     VARCHAR(64)  NULL,
    acuse_sellado_tiempo  TIMESTAMPTZ  NULL,
    documento_url         VARCHAR(255) NULL,
    creado_en             TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_notificacion_casilla_estado
        CHECK (estado IN ('NO_LEIDO', 'LEIDO', 'PENDIENTE', 'NOTIFICADO'))
);

CREATE INDEX IF NOT EXISTS idx_notif_casilla_usuario
    ON sigd_auth.notificacion_casilla (usuario_id);
CREATE INDEX IF NOT EXISTS idx_notif_casilla_estado
    ON sigd_auth.notificacion_casilla (usuario_id, estado);
CREATE INDEX IF NOT EXISTS idx_notif_casilla_cut
    ON sigd_auth.notificacion_casilla (cut);
CREATE INDEX IF NOT EXISTS idx_notif_casilla_fecha
    ON sigd_auth.notificacion_casilla (fecha_deposito DESC);

-- Semilla inicial determinista DESACTIVADA (CP-POOL-003):
-- INSERT INTO sigd_auth.notificacion_casilla ... (usuario_id inexistente en cuenta_usuario)
-- ON CONFLICT (id) DO NOTHING;

