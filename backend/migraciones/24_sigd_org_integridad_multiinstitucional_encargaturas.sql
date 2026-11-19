-- =============================================================================
-- Migración 24 · Esquema sigd_org, sigd_auth, sigd_audit:
-- Multiinstitucionalidad, Integridad Histórica, Encargaturas y Rectificación
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
-- -----------------------------------------------------------------------------
-- Rama oficial: B_JACOBO | Base de datos: sigd_jacobo_demo (PostgreSQL 18.6)
-- Marco normativo: TUO Ley 27444, MGD-PCM, Directiva de Encargaturas
-- Depende de: 01..21, 22_sigd_org_catalogo_rbac_institucional.sql, 23_sigd_audit...
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. MODELO MULTIINSTITUCIONAL REAL (RESOLUCIÓN ESTRUCTURAL D5)
-- -----------------------------------------------------------------------------

-- 1.1. Catálogo Institucional Central
CREATE TABLE IF NOT EXISTS sigd_org.institucion (
    institucion_id   UUID         NOT NULL DEFAULT gen_random_uuid()
                                 CONSTRAINT pk_institucion PRIMARY KEY,
    codigo           VARCHAR(40)  NOT NULL UNIQUE,
    nombre           VARCHAR(200) NOT NULL,
    abreviatura      VARCHAR(40)  NOT NULL,
    ruc              VARCHAR(11)  NULL UNIQUE,
    ubigeo_inei      VARCHAR(6)   NULL,
    activo           BOOLEAN      NOT NULL DEFAULT TRUE,
    creado_en        TIMESTAMPTZ  NOT NULL DEFAULT clock_timestamp()
);

-- Inserción canónica de la sede IESTP «Suiza» (ID institucional canónico)
INSERT INTO sigd_org.institucion (
    institucion_id, codigo, nombre, abreviatura, ruc, ubigeo_inei, activo
) VALUES (
    '018f9805-51aa-7000-8111-2b00c3f00001'::uuid,
    'IESTP_SUIZA',
    'Instituto de Educación Superior Tecnológico Público «Suiza»',
    'IESTP SUIZA',
    '20493237123',
    '250101',
    TRUE
) ON CONFLICT (codigo) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    abreviatura = EXCLUDED.abreviatura,
    activo = TRUE;

-- 1.2. Relación Muchos a Muchos Cuentas de Usuario <-> Instituciones
CREATE TABLE IF NOT EXISTS sigd_auth.usuario_institucion (
    id_usuario       UUID         NOT NULL
                                 REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
    institucion_id   UUID         NOT NULL
                                 REFERENCES sigd_org.institucion(institucion_id) ON DELETE RESTRICT,
    activo           BOOLEAN      NOT NULL DEFAULT TRUE,
    creado_en        TIMESTAMPTZ  NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (id_usuario, institucion_id)
);

CREATE INDEX IF NOT EXISTS idx_usuario_institucion_inst 
    ON sigd_auth.usuario_institucion (institucion_id, id_usuario);

-- 1.3. Incorporación de Ámbito Institucional en sigd_org.area
ALTER TABLE sigd_org.area 
    ADD COLUMN IF NOT EXISTS institucion_id UUID REFERENCES sigd_org.institucion(institucion_id) ON DELETE RESTRICT;

-- Backfill determinístico de áreas existentes hacia IESTP Suiza
UPDATE sigd_org.area 
   SET institucion_id = '018f9805-51aa-7000-8111-2b00c3f00001'::uuid 
 WHERE institucion_id IS NULL;

ALTER TABLE sigd_org.area 
    ALTER COLUMN institucion_id SET NOT NULL;

-- Restricción UNIQUE bidimensional en area para claves foráneas compuestas
ALTER TABLE sigd_org.area
    DROP CONSTRAINT IF EXISTS uq_area_id_institucion;
ALTER TABLE sigd_org.area
    ADD CONSTRAINT uq_area_id_institucion UNIQUE (area_id, institucion_id);

-- 1.4. Incorporación de Ámbito Institucional en sigd_org.cargo
ALTER TABLE sigd_org.cargo 
    ADD COLUMN IF NOT EXISTS institucion_id UUID REFERENCES sigd_org.institucion(institucion_id) ON DELETE RESTRICT;

UPDATE sigd_org.cargo 
   SET institucion_id = '018f9805-51aa-7000-8111-2b00c3f00001'::uuid 
 WHERE institucion_id IS NULL;

ALTER TABLE sigd_org.cargo
    ALTER COLUMN institucion_id SET NOT NULL;

-- Restricción UNIQUE bidimensional en cargo para claves foráneas compuestas
ALTER TABLE sigd_org.cargo
    DROP CONSTRAINT IF EXISTS uq_cargo_id_institucion;
ALTER TABLE sigd_org.cargo
    ADD CONSTRAINT uq_cargo_id_institucion UNIQUE (cargo_id, institucion_id);

-- 1.5. Incorporación de Ámbito Institucional en sigd_org.usuario_rol
ALTER TABLE sigd_org.usuario_rol 
    ADD COLUMN IF NOT EXISTS institucion_id UUID REFERENCES sigd_org.institucion(institucion_id) ON DELETE RESTRICT;

-- Desactivar temporalmente el disparador de bloqueo de roles históricos durante el backfill institucional
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgname = 'tr_bloquear_nueva_asignacion_rol_historico'
       AND tgrelid = 'sigd_org.usuario_rol'::regclass
  ) THEN
    EXECUTE 'ALTER TABLE sigd_org.usuario_rol DISABLE TRIGGER tr_bloquear_nueva_asignacion_rol_historico';
  END IF;
END $$;

UPDATE sigd_org.usuario_rol 
   SET institucion_id = '018f9805-51aa-7000-8111-2b00c3f00001'::uuid 
 WHERE institucion_id IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgname = 'tr_bloquear_nueva_asignacion_rol_historico'
       AND tgrelid = 'sigd_org.usuario_rol'::regclass
  ) THEN
    EXECUTE 'ALTER TABLE sigd_org.usuario_rol ENABLE TRIGGER tr_bloquear_nueva_asignacion_rol_historico';
  END IF;
END $$;

ALTER TABLE sigd_org.usuario_rol 
    ALTER COLUMN institucion_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_usuario_rol_institucion 
    ON sigd_org.usuario_rol (institucion_id, id_usuario);

-- Sincronización de cuentas a instituciones según roles vigentes
INSERT INTO sigd_auth.usuario_institucion (id_usuario, institucion_id, activo)
SELECT DISTINCT ur.id_usuario, ur.institucion_id, TRUE
  FROM sigd_org.usuario_rol ur
ON CONFLICT (id_usuario, institucion_id) DO NOTHING;

-- Integridad referencial compuesta usuario_rol -> usuario_institucion (D5)
ALTER TABLE sigd_org.usuario_rol
    DROP CONSTRAINT IF EXISTS fk_usuario_rol_usuario_institucion;
ALTER TABLE sigd_org.usuario_rol
    ADD CONSTRAINT fk_usuario_rol_usuario_institucion
    FOREIGN KEY (id_usuario, institucion_id)
    REFERENCES sigd_auth.usuario_institucion (id_usuario, institucion_id)
    ON DELETE RESTRICT;

-- Integridad referencial compuesta usuario_rol -> area (area_id, institucion_id) (D5)
ALTER TABLE sigd_org.usuario_rol
    DROP CONSTRAINT IF EXISTS fk_usuario_rol_area_institucion;
ALTER TABLE sigd_org.usuario_rol
    ADD CONSTRAINT fk_usuario_rol_area_institucion
    FOREIGN KEY (area_id, institucion_id)
    REFERENCES sigd_org.area (area_id, institucion_id)
    ON DELETE RESTRICT;

-- 1.6. Formalización de Ámbito Institucional en sigd_org.encargatura_despacho
UPDATE sigd_org.encargatura_despacho 
   SET institucion_id = '018f9805-51aa-7000-8111-2b00c3f00001'::uuid 
 WHERE institucion_id IS NULL;

ALTER TABLE sigd_org.encargatura_despacho 
    ALTER COLUMN institucion_id SET NOT NULL;

ALTER TABLE sigd_org.encargatura_despacho 
    DROP CONSTRAINT IF EXISTS fk_encargatura_institucion;

ALTER TABLE sigd_org.encargatura_despacho 
    ADD CONSTRAINT fk_encargatura_institucion 
    FOREIGN KEY (institucion_id) REFERENCES sigd_org.institucion(institucion_id) ON DELETE RESTRICT;

-- Sincronización de cuentas de suplente y titular hacia usuario_institucion
INSERT INTO sigd_auth.usuario_institucion (id_usuario, institucion_id, activo)
SELECT DISTINCT ed.usuario_id, ed.institucion_id, TRUE
  FROM sigd_org.encargatura_despacho ed
ON CONFLICT (id_usuario, institucion_id) DO NOTHING;

INSERT INTO sigd_auth.usuario_institucion (id_usuario, institucion_id, activo)
SELECT DISTINCT ed.titular_usuario_id, ed.institucion_id, TRUE
  FROM sigd_org.encargatura_despacho ed
ON CONFLICT (id_usuario, institucion_id) DO NOTHING;

-- Integridad referencial compuesta en encargatura_despacho (D5 blindaje multiinstitucional)
ALTER TABLE sigd_org.encargatura_despacho
    DROP CONSTRAINT IF EXISTS fk_encargatura_suplente_institucion;
ALTER TABLE sigd_org.encargatura_despacho
    ADD CONSTRAINT fk_encargatura_suplente_institucion
    FOREIGN KEY (usuario_id, institucion_id)
    REFERENCES sigd_auth.usuario_institucion (id_usuario, institucion_id)
    ON DELETE RESTRICT;

ALTER TABLE sigd_org.encargatura_despacho
    DROP CONSTRAINT IF EXISTS fk_encargatura_titular_institucion;
ALTER TABLE sigd_org.encargatura_despacho
    ADD CONSTRAINT fk_encargatura_titular_institucion
    FOREIGN KEY (titular_usuario_id, institucion_id)
    REFERENCES sigd_auth.usuario_institucion (id_usuario, institucion_id)
    ON DELETE RESTRICT;

ALTER TABLE sigd_org.encargatura_despacho
    DROP CONSTRAINT IF EXISTS fk_encargatura_area_institucion;
ALTER TABLE sigd_org.encargatura_despacho
    ADD CONSTRAINT fk_encargatura_area_institucion
    FOREIGN KEY (area_despacho_id, institucion_id)
    REFERENCES sigd_org.area (area_id, institucion_id)
    ON DELETE RESTRICT;

ALTER TABLE sigd_org.encargatura_despacho
    DROP CONSTRAINT IF EXISTS fk_encargatura_cargo_institucion;
ALTER TABLE sigd_org.encargatura_despacho
    ADD CONSTRAINT fk_encargatura_cargo_institucion
    FOREIGN KEY (cargo_id, institucion_id)
    REFERENCES sigd_org.cargo (cargo_id, institucion_id)
    ON DELETE RESTRICT;

-- -----------------------------------------------------------------------------
-- 2. SUBSISTEMA CRIPTOGRÁFICO Y PROTECCIÓN ANTI-REPLAY EN sigd_auth
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sigd_auth.clave_sistema (
    kid          VARCHAR(64)  NOT NULL CONSTRAINT pk_clave_sistema PRIMARY KEY,
    institucion_id UUID       NOT NULL REFERENCES sigd_org.institucion(institucion_id) ON DELETE RESTRICT,
    secreto      TEXT         NOT NULL,
    estado       VARCHAR(20)  NOT NULL DEFAULT 'ACTIVA' 
                              CONSTRAINT chk_clave_estado CHECK (estado IN ('ACTIVA', 'GRACIA', 'REVOCADA')),
    creado_en    TIMESTAMPTZ  NOT NULL DEFAULT clock_timestamp(),
    expira_en    TIMESTAMPTZ  NULL,
    CONSTRAINT chk_clave_expiracion CHECK (expira_en IS NULL OR expira_en > creado_en)
);

CREATE TABLE IF NOT EXISTS sigd_auth.token_nonce_consumido (
    nonce           VARCHAR(64)  NOT NULL CONSTRAINT pk_token_nonce PRIMARY KEY,
    operation       VARCHAR(40)  NOT NULL,
    target_id       UUID         NOT NULL,
    consumido_en    TIMESTAMPTZ  NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_nonce_consumido_fecha 
    ON sigd_auth.token_nonce_consumido (consumido_en);

-- -----------------------------------------------------------------------------
-- 3. MÁQUINA DE ESTADOS Y CONTROL DE ENCARGATURA_PERMISO
-- -----------------------------------------------------------------------------

ALTER TABLE sigd_org.encargatura_permiso 
    ADD COLUMN IF NOT EXISTS estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO' 
    CONSTRAINT chk_encargatura_permiso_estado CHECK (estado IN ('ACTIVO', 'REVOCADO'));

ALTER TABLE sigd_org.encargatura_permiso 
    ADD COLUMN IF NOT EXISTS revocado_en TIMESTAMPTZ NULL;

ALTER TABLE sigd_org.encargatura_permiso 
    ADD COLUMN IF NOT EXISTS revocado_por UUID NULL 
    REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT;

ALTER TABLE sigd_org.encargatura_permiso 
    ADD COLUMN IF NOT EXISTS motivo_revocacion TEXT NULL;

ALTER TABLE sigd_org.encargatura_permiso 
    DROP CONSTRAINT IF EXISTS chk_encargatura_permiso_revocado;

ALTER TABLE sigd_org.encargatura_permiso 
    ADD CONSTRAINT chk_encargatura_permiso_revocado CHECK (
        (estado = 'ACTIVO' AND revocado_en IS NULL AND revocado_por IS NULL AND motivo_revocacion IS NULL) OR
        (estado = 'REVOCADO' AND revocado_en IS NOT NULL AND revocado_por IS NOT NULL AND motivo_revocacion IS NOT NULL AND length(trim(motivo_revocacion)) >= 10)
    );

-- 3.1. Triggers Restrictivos de Ciclo de Vida
CREATE OR REPLACE FUNCTION sigd_org.fn_tr_encargatura_permiso_before_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.estado IS DISTINCT FROM 'ACTIVO' THEN
        RAISE EXCEPTION 'PERMISO_ESTADO_INICIAL_INVALIDO: Todo nuevo permiso debe iniciar en estado ACTIVO'
            USING ERRCODE = '23514';
    END IF;

    IF NEW.revocado_en IS NOT NULL OR NEW.revocado_por IS NOT NULL OR NEW.motivo_revocacion IS NOT NULL THEN
        RAISE EXCEPTION 'PERMISO_METADATOS_CREACION_INVALIDOS: Un permiso nuevo no puede crearse revocado'
            USING ERRCODE = '23514';
    END IF;

    NEW.creado_en := clock_timestamp();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_encargatura_permiso_before_insert ON sigd_org.encargatura_permiso;
CREATE TRIGGER tr_encargatura_permiso_before_insert
    BEFORE INSERT ON sigd_org.encargatura_permiso
    FOR EACH ROW
    EXECUTE FUNCTION sigd_org.fn_tr_encargatura_permiso_before_insert();

CREATE OR REPLACE FUNCTION sigd_org.fn_tr_encargatura_permiso_before_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.encargatura_id IS DISTINCT FROM OLD.encargatura_id OR
       NEW.permiso_id IS DISTINCT FROM OLD.permiso_id OR
       NEW.creado_en IS DISTINCT FROM OLD.creado_en THEN
        RAISE EXCEPTION 'PERMISO_IDENTITY_IMMUTABLE: Las identidades y fecha de creación son inmutables'
            USING ERRCODE = '23514';
    END IF;

    IF OLD.estado = 'ACTIVO' AND NEW.estado = 'REVOCADO' THEN
        IF NEW.revocado_en IS NULL OR NEW.revocado_por IS NULL OR NEW.motivo_revocacion IS NULL THEN
            RAISE EXCEPTION 'REVOCACION_METADATOS_FALTANTES: La revocación exige revocado_en, revocado_por y motivo'
                USING ERRCODE = '23514';
        END IF;

        IF length(trim(NEW.motivo_revocacion)) < 10 THEN
            RAISE EXCEPTION 'REVOCACION_MOTIVO_CORTO: El motivo debe tener al menos 10 caracteres'
                USING ERRCODE = '23514';
        END IF;

        RETURN NEW;
    ELSE
        RAISE EXCEPTION 'PERMISO_TRANSICION_ESTADO_INVALIDA: Transición "%" -> "%" prohibida', OLD.estado, NEW.estado
            USING ERRCODE = '23514';
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS tr_encargatura_permiso_before_update ON sigd_org.encargatura_permiso;
CREATE TRIGGER tr_encargatura_permiso_before_update
    BEFORE UPDATE ON sigd_org.encargatura_permiso
    FOR EACH ROW
    EXECUTE FUNCTION sigd_org.fn_tr_encargatura_permiso_before_update();

CREATE OR REPLACE FUNCTION sigd_org.fn_tr_encargatura_permiso_before_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'SEGURIDAD_RELACIONAL_PROHIBIDA: La eliminación física (DELETE) de permisos de encargatura está estrictamente prohibida.'
        USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS tr_encargatura_permiso_before_delete ON sigd_org.encargatura_permiso;
CREATE TRIGGER tr_encargatura_permiso_before_delete
    BEFORE DELETE ON sigd_org.encargatura_permiso
    FOR EACH STATEMENT
    EXECUTE FUNCTION sigd_org.fn_tr_encargatura_permiso_before_delete();

CREATE OR REPLACE FUNCTION sigd_org.fn_tr_encargatura_permiso_before_truncate()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'SEGURIDAD_RELACIONAL_PROHIBIDA: La operación TRUNCATE sobre encargatura_permiso está estrictamente prohibida.'
        USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS tr_encargatura_permiso_before_truncate ON sigd_org.encargatura_permiso;
CREATE TRIGGER tr_encargatura_permiso_before_truncate
    BEFORE TRUNCATE ON sigd_org.encargatura_permiso
    FOR EACH STATEMENT
    EXECUTE FUNCTION sigd_org.fn_tr_encargatura_permiso_before_truncate();

-- -----------------------------------------------------------------------------
-- 4. BITÁCORAS FORENSES INMUTABLES WORM EN sigd_audit
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sigd_audit.encargatura_rectificacion_log (
    id_log                   UUID         NOT NULL DEFAULT gen_random_uuid()
                                          CONSTRAINT pk_encargatura_rect_log PRIMARY KEY,
    encargatura_id           UUID         NOT NULL
                                          REFERENCES sigd_org.encargatura_despacho(encargatura_id) ON DELETE RESTRICT,
    institucion_id           UUID         NOT NULL
                                          REFERENCES sigd_org.institucion(institucion_id) ON DELETE RESTRICT,
    campo_rectificado        VARCHAR(40)  NOT NULL,
    valor_anterior           TEXT         NULL,
    valor_nuevo              TEXT         NOT NULL,
    justificacion            TEXT         NOT NULL,
    documento_sustento_tipo  VARCHAR(40)  NOT NULL,
    documento_sustento_numero VARCHAR(80) NOT NULL,
    rectificado_por          UUID         NOT NULL
                                          REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
    correlation_id           UUID         NOT NULL,
    rectificado_en           TIMESTAMPTZ  NOT NULL DEFAULT clock_timestamp()
) WITH (fillfactor = 100);

CREATE TABLE IF NOT EXISTS sigd_audit.encargatura_permiso_audit (
    id_audit                 UUID         NOT NULL DEFAULT gen_random_uuid()
                                          CONSTRAINT pk_encargatura_permiso_audit PRIMARY KEY,
    encargatura_id           UUID         NOT NULL,
    permiso_id               UUID         NOT NULL,
    institucion_id           UUID         NOT NULL
                                          REFERENCES sigd_org.institucion(institucion_id) ON DELETE RESTRICT,
    accion                   VARCHAR(20)  NOT NULL 
                                          CONSTRAINT chk_audit_accion CHECK (accion IN ('ASIGNAR', 'REVOCAR')),
    estado_anterior          VARCHAR(20)  NULL,
    estado_nuevo             VARCHAR(20)  NOT NULL,
    motivo                   TEXT         NOT NULL,
    operado_por              UUID         NOT NULL
                                          REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
    correlation_id           UUID         NOT NULL,
    operado_en               TIMESTAMPTZ  NOT NULL DEFAULT clock_timestamp(),
    
    -- Clave foránea bidimensional compuesta hacia la entidad operativa
    CONSTRAINT fk_audit_encargatura_permiso_compuesta
        FOREIGN KEY (encargatura_id, permiso_id)
        REFERENCES sigd_org.encargatura_permiso(encargatura_id, permiso_id)
        ON DELETE RESTRICT
) WITH (fillfactor = 100);

-- Disparadores WORM en Bitácoras
CREATE OR REPLACE FUNCTION sigd_audit.fn_proteger_rectificacion_log_worm()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'WORM_INTEGRITY_VIOLATION: La bitácora sigd_audit.encargatura_rectificacion_log es inmutable (prohibido %)', TG_OP
        USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS tr_proteger_rectificacion_log_worm ON sigd_audit.encargatura_rectificacion_log;
CREATE TRIGGER tr_proteger_rectificacion_log_worm
    BEFORE UPDATE OR DELETE ON sigd_audit.encargatura_rectificacion_log
    FOR EACH STATEMENT
    EXECUTE FUNCTION sigd_audit.fn_proteger_rectificacion_log_worm();

DROP TRIGGER IF EXISTS tr_proteger_rectificacion_log_worm_trunc ON sigd_audit.encargatura_rectificacion_log;
CREATE TRIGGER tr_proteger_rectificacion_log_worm_trunc
    BEFORE TRUNCATE ON sigd_audit.encargatura_rectificacion_log
    FOR EACH STATEMENT
    EXECUTE FUNCTION sigd_audit.fn_proteger_rectificacion_log_worm();

CREATE OR REPLACE FUNCTION sigd_audit.fn_proteger_permiso_audit_worm()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'WORM_INTEGRITY_VIOLATION: La bitácora sigd_audit.encargatura_permiso_audit es inmutable (prohibido %)', TG_OP
        USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS tr_proteger_permiso_audit_worm ON sigd_audit.encargatura_permiso_audit;
CREATE TRIGGER tr_proteger_permiso_audit_worm
    BEFORE UPDATE OR DELETE ON sigd_audit.encargatura_permiso_audit
    FOR EACH STATEMENT
    EXECUTE FUNCTION sigd_audit.fn_proteger_permiso_audit_worm();

DROP TRIGGER IF EXISTS tr_proteger_permiso_audit_worm_trunc ON sigd_audit.encargatura_permiso_audit;
CREATE TRIGGER tr_proteger_permiso_audit_worm_trunc
    BEFORE TRUNCATE ON sigd_audit.encargatura_permiso_audit
    FOR EACH STATEMENT
    EXECUTE FUNCTION sigd_audit.fn_proteger_permiso_audit_worm();

-- -----------------------------------------------------------------------------
-- 5. ROLES TÉCNICOS DE EJECUCIÓN Y PROPIEDAD
-- -----------------------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sigd_schema_owner') THEN
        CREATE ROLE sigd_schema_owner NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sigd_rector_encargatura') THEN
        CREATE ROLE sigd_rector_encargatura NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sigd_audit_writer') THEN
        CREATE ROLE sigd_audit_writer NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sigd_auditor') THEN
        CREATE ROLE sigd_auditor NOLOGIN;
    END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. FUNCIONES DE NEGOCIO Y CONTROL TRANSACCIONAL (SECURITY DEFINER)
-- -----------------------------------------------------------------------------

-- 6.1. Verificación Fail-Closed de Token Transaccional (Interna)
CREATE OR REPLACE FUNCTION sigd_org.fn_verificar_token_transaccional(
    p_token          TEXT,
    p_op_esperada    VARCHAR(40),
    p_target_id      UUID,
    p_sub_target_id  VARCHAR(80),
    p_content_hash   VARCHAR(64)
)
RETURNS TABLE (
    user_id          UUID,
    institucion_id   UUID,
    correlation_id   UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, sigd_auth, sigd_org, public
AS $$
DECLARE
    v_raw_payload    TEXT;
    v_rec_sig        TEXT;
    v_calc_sig       TEXT;
    v_payload_json   JSONB;
    v_secret         TEXT;
    v_key_estado     VARCHAR(20);
    v_key_expira     TIMESTAMPTZ;
    v_kid            VARCHAR(64);
    v_iss            TEXT;
    v_aud            TEXT;
    v_user_id        UUID;
    v_op             VARCHAR(40);
    v_target_id      UUID;
    v_sub_target_id  VARCHAR(80);
    v_content_hash   VARCHAR(64);
    v_inst_id        UUID;
    v_corr_id        UUID;
    v_iat_epoch      DOUBLE PRECISION;
    v_exp_epoch      DOUBLE PRECISION;
    v_iat            TIMESTAMPTZ;
    v_exp            TIMESTAMPTZ;
    v_nonce          VARCHAR(64);
    v_now            TIMESTAMPTZ;
BEGIN
    v_now := clock_timestamp();

    IF p_token IS NULL OR split_part(p_token, '.', 2) = '' OR split_part(p_token, '.', 3) <> '' THEN
        RAISE EXCEPTION 'TOKEN_INVALID_FORMAT: Estructura de token inválida' USING ERRCODE = '28000';
    END IF;

    v_raw_payload := convert_from(decode(split_part(p_token, '.', 1), 'base64'), 'UTF8');
    v_rec_sig     := split_part(p_token, '.', 2);

    BEGIN
        v_payload_json := v_raw_payload::jsonb;
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'TOKEN_CORRUPT_PAYLOAD: JSON inválido' USING ERRCODE = '22023';
    END;

    v_iss           := v_payload_json->>'iss';
    v_aud           := v_payload_json->>'aud';
    v_kid           := v_payload_json->>'kid';
    v_op            := v_payload_json->>'op';
    v_content_hash  := v_payload_json->>'content_hash';
    v_nonce         := v_payload_json->>'nonce';

    IF v_iss IS NULL OR v_aud IS NULL OR v_kid IS NULL OR v_op IS NULL OR 
       v_content_hash IS NULL OR v_nonce IS NULL THEN
        RAISE EXCEPTION 'TOKEN_MISSING_PROPERTIES: Propiedades de cabecera ausentes' USING ERRCODE = '28000';
    END IF;

    BEGIN
        v_user_id       := (v_payload_json->>'user_id')::uuid;
        v_target_id     := (v_payload_json->>'target_id')::uuid;
        v_inst_id       := (v_payload_json->>'institucion_id')::uuid;
        v_corr_id       := (v_payload_json->>'correlation_id')::uuid;
        v_iat_epoch     := (v_payload_json->>'iat')::double precision;
        v_exp_epoch     := (v_payload_json->>'exp')::double precision;
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'TOKEN_TYPE_ERROR: Conversión de tipo fallida en el token' USING ERRCODE = '22000';
    END;

    v_sub_target_id := v_payload_json->>'sub_target_id';

    IF v_user_id IS NULL OR v_target_id IS NULL OR v_inst_id IS NULL OR v_corr_id IS NULL OR 
       v_iat_epoch IS NULL OR v_exp_epoch IS NULL THEN
        RAISE EXCEPTION 'TOKEN_NULL_PAYLOAD: Valores nulos en identidades obligatorias' USING ERRCODE = '28000';
    END IF;

    IF v_iss IS DISTINCT FROM 'SIGD_API_BACKEND' OR v_aud IS DISTINCT FROM 'SIGD_POSTGRESQL_ENGINE' THEN
        RAISE EXCEPTION 'TOKEN_UNAUTHORIZED_PARTIES: Emisor o Audiencia no válidos' USING ERRCODE = '28000';
    END IF;

    v_iat := to_timestamp(v_iat_epoch);
    v_exp := to_timestamp(v_exp_epoch);

    -- Ventana de gracia de 5 segundos a futuro para mitigar drift entre API y DB
    IF v_iat > (v_now + interval '5 seconds') THEN
        RAISE EXCEPTION 'TOKEN_PREMATURE: Token con iat en el futuro' USING ERRCODE = '28000';
    END IF;

    IF v_exp <= v_now THEN
        RAISE EXCEPTION 'TOKEN_EXPIRED: Token transaccional expirado' USING ERRCODE = '28000';
    END IF;

    IF (v_exp - v_iat) > interval '60 seconds' OR (v_exp <= v_iat) THEN
        RAISE EXCEPTION 'TOKEN_INVALID_WINDOW: Ventana de validez inválida (>60s o regresiva)' USING ERRCODE = '28000';
    END IF;

    -- Obtención de clave activa por kid
    SELECT cs.secreto, cs.estado, cs.expira_en 
      INTO v_secret, v_key_estado, v_key_expira
      FROM sigd_auth.clave_sistema cs
     WHERE cs.kid = v_kid;

    IF v_secret IS NULL OR v_key_estado = 'REVOCADA' OR (v_key_expira IS NOT NULL AND v_key_expira <= v_now) THEN
        RAISE EXCEPTION 'TOKEN_KEY_INVALID: Clave kid no registrada, revocada o vencida' USING ERRCODE = '28000';
    END IF;

    -- Verificación de firma HMAC-SHA256
    v_calc_sig := encode(public.hmac(split_part(p_token, '.', 1), v_secret, 'sha256'), 'hex');
    IF v_rec_sig IS DISTINCT FROM v_calc_sig THEN
        RAISE EXCEPTION 'TOKEN_SIGNATURE_FORGERY: Firma criptográfica no coincide' USING ERRCODE = '28000';
    END IF;

    -- Comprobación contextual de la operación solicitada
    IF v_op IS DISTINCT FROM p_op_esperada THEN
        RAISE EXCEPTION 'TOKEN_OPERATION_MISMATCH: Operación no autorizada' USING ERRCODE = '28000';
    END IF;

    IF v_target_id IS DISTINCT FROM p_target_id THEN
        RAISE EXCEPTION 'TOKEN_TARGET_MISMATCH: Objetivo destino no coincide' USING ERRCODE = '28000';
    END IF;

    IF p_sub_target_id IS NOT NULL AND v_sub_target_id IS DISTINCT FROM p_sub_target_id THEN
        RAISE EXCEPTION 'TOKEN_SUBTARGET_MISMATCH: Subobjetivo no coincide' USING ERRCODE = '28000';
    END IF;

    IF v_content_hash IS DISTINCT FROM p_content_hash THEN
        RAISE EXCEPTION 'TOKEN_CONTENT_DIGEST_MISMATCH: Resumen de contenido no coincide' USING ERRCODE = '28000';
    END IF;

    -- Consumo atómico de nonce anti-replay
    BEGIN
        INSERT INTO sigd_auth.token_nonce_consumido (nonce, operation, target_id, consumido_en)
        VALUES (v_nonce, v_op, v_target_id, v_now);
    EXCEPTION WHEN unique_violation THEN
        RAISE EXCEPTION 'TOKEN_NONCE_REPLAY: Token ya consumido previamente' USING ERRCODE = '28000';
    END;

    user_id        := v_user_id;
    institucion_id := v_inst_id;
    correlation_id := v_corr_id;
    RETURN NEXT;
END;
$$;

ALTER FUNCTION sigd_org.fn_verificar_token_transaccional(TEXT, VARCHAR, UUID, VARCHAR, VARCHAR) OWNER TO sigd_rector_encargatura;
REVOKE ALL ON FUNCTION sigd_org.fn_verificar_token_transaccional(TEXT, VARCHAR, UUID, VARCHAR, VARCHAR) FROM PUBLIC, sigd_app;

-- 6.2. Rectificación de Encargatura con Soporte de Autoridad Institucional
CREATE OR REPLACE FUNCTION sigd_org.fn_rectificar_encargatura(
    p_auth_token             TEXT,
    p_encargatura_id         UUID,
    p_campo                  VARCHAR(40),
    p_valor_anterior         TEXT,
    p_valor_nuevo            TEXT,
    p_documento_sustento_tipo VARCHAR(40),
    p_documento_sustento_num  VARCHAR(80),
    p_justificacion          TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, sigd_auth, sigd_org, sigd_audit, public
AS $$
DECLARE
    v_content_canonical TEXT;
    v_content_hash      VARCHAR(64);
    v_auth_ctx          RECORD;
    v_actor_cuenta      RECORD;
    v_actor_rol         RECORD;
    v_encargatura       RECORD;
    v_actual_valor      TEXT;
    v_now               TIMESTAMPTZ;
BEGIN
    v_now := clock_timestamp();

    v_content_canonical := 'OP:RECTIFICAR_ENCARGATURA|TARGET:' || p_encargatura_id::text || 
                           '|CAMPO:' || coalesce(p_campo, '') || 
                           '|VAL_ANT:' || coalesce(p_valor_anterior, '') || 
                           '|VAL_NUEVO:' || coalesce(p_valor_nuevo, '') || 
                           '|DOC_TIPO:' || coalesce(p_documento_sustento_tipo, '') || 
                           '|DOC_NUM:' || coalesce(p_documento_sustento_num, '') || 
                           '|JUST:' || coalesce(p_justificacion, '');
    v_content_hash := encode(public.digest(v_content_canonical, 'sha256'), 'hex');

    SELECT * INTO v_auth_ctx 
      FROM sigd_org.fn_verificar_token_transaccional(
               p_auth_token, 'RECTIFICAR_ENCARGATURA', p_encargatura_id, p_campo, v_content_hash
           );

    -- Nivel 1: Bloqueo de Cuenta
    SELECT cu.id_usuario, cu.activo 
      INTO v_actor_cuenta
      FROM sigd_auth.cuenta_usuario cu
     WHERE cu.id_usuario = v_auth_ctx.user_id
       FOR SHARE OF cu;

    IF NOT FOUND OR v_actor_cuenta.activo IS NOT TRUE THEN
        RAISE EXCEPTION 'RECTIFICACION_ADMIN_INACTIVO: Cuenta inactiva' USING ERRCODE = '28000';
    END IF;

    -- Nivel 2 y 3: Bloqueo de Rol con facultades (ADMINISTRADOR o DIRECTOR)
    SELECT ur.id_usuario_rol, rs.codigo 
      INTO v_actor_rol
      FROM sigd_org.usuario_rol ur
      JOIN sigd_org.rol_sistema rs ON rs.rol_id = ur.rol_id
     WHERE ur.id_usuario = v_auth_ctx.user_id
       AND ur.institucion_id = v_auth_ctx.institucion_id
       AND rs.codigo IN ('ADMINISTRADOR', 'DIRECTOR')
       AND ur.vigente_desde <= v_now
       AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > v_now)
       FOR SHARE OF ur;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'RECTIFICACION_FACULTAD_DENEGADA: Requiere rol ADMINISTRADOR o DIRECTOR vigente' USING ERRCODE = '42501';
    END IF;

    -- Nivel 4: Bloqueo Exclusivo de la Encargatura
    SELECT ed.* INTO v_encargatura
      FROM sigd_org.encargatura_despacho ed
     WHERE ed.encargatura_id = p_encargatura_id
       FOR UPDATE OF ed;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'RECTIFICACION_NOT_FOUND: Encargatura no existe' USING ERRCODE = '02000';
    END IF;

    IF v_encargatura.institucion_id IS DISTINCT FROM v_auth_ctx.institucion_id THEN
        RAISE EXCEPTION 'RECTIFICACION_INSTITUCION_MISMATCH: Encargatura no pertenece a la institución del token' USING ERRCODE = '42501';
    END IF;

    IF p_campo NOT IN ('inicio', 'fin', 'documento_sustento_tipo', 'documento_sustento_numero', 'motivo_encargatura') THEN
        RAISE EXCEPTION 'RECTIFICACION_CAMPO_PROHIBIDO: Campo no sujeto a rectificación' USING ERRCODE = '23514';
    END IF;

    IF length(trim(p_justificacion)) < 15 THEN
        RAISE EXCEPTION 'RECTIFICACION_JUSTIFICACION_CORTA: Mínimo 15 caracteres' USING ERRCODE = '23514';
    END IF;

    -- Verificación del valor anterior directamente en base de datos
    IF p_campo = 'inicio' THEN
        v_actual_valor := v_encargatura.inicio::text;
    ELSIF p_campo = 'fin' THEN
        v_actual_valor := coalesce(v_encargatura.fin::text, '');
    ELSIF p_campo = 'documento_sustento_tipo' THEN
        v_actual_valor := coalesce(v_encargatura.documento_sustento_tipo, '');
    ELSIF p_campo = 'documento_sustento_numero' THEN
        v_actual_valor := coalesce(v_encargatura.documento_sustento_numero, '');
    ELSIF p_campo = 'motivo_encargatura' THEN
        v_actual_valor := coalesce(v_encargatura.motivo_encargatura, '');
    END IF;

    IF coalesce(p_valor_anterior, '') IS DISTINCT FROM coalesce(v_actual_valor, '') THEN
        RAISE EXCEPTION 'RECTIFICACION_VALOR_ANTERIOR_DISCREPANTE: El valor anterior esperado (%) no coincide con el real en BD (%)', p_valor_anterior, v_actual_valor
            USING ERRCODE = '23514';
    END IF;

    -- Aplicación de rectificación
    IF p_campo = 'inicio' THEN
        UPDATE sigd_org.encargatura_despacho SET inicio = p_valor_nuevo::timestamptz WHERE encargatura_id = p_encargatura_id;
    ELSIF p_campo = 'fin' THEN
        UPDATE sigd_org.encargatura_despacho SET fin = CASE WHEN p_valor_nuevo IS NULL OR p_valor_nuevo = '' THEN NULL ELSE p_valor_nuevo::timestamptz END WHERE encargatura_id = p_encargatura_id;
    ELSIF p_campo = 'documento_sustento_tipo' THEN
        UPDATE sigd_org.encargatura_despacho SET documento_sustento_tipo = p_valor_nuevo WHERE encargatura_id = p_encargatura_id;
    ELSIF p_campo = 'documento_sustento_numero' THEN
        UPDATE sigd_org.encargatura_despacho SET documento_sustento_numero = p_valor_nuevo WHERE encargatura_id = p_encargatura_id;
    ELSIF p_campo = 'motivo_encargatura' THEN
        UPDATE sigd_org.encargatura_despacho SET motivo_encargatura = p_valor_nuevo WHERE encargatura_id = p_encargatura_id;
    END IF;

    -- Registro WORM
    INSERT INTO sigd_audit.encargatura_rectificacion_log (
        id_log, encargatura_id, institucion_id, campo_rectificado,
        valor_anterior, valor_nuevo, justificacion,
        documento_sustento_tipo, documento_sustento_numero,
        rectificado_por, correlation_id, rectificado_en
    ) VALUES (
        gen_random_uuid(), p_encargatura_id, v_auth_ctx.institucion_id, p_campo,
        v_actual_valor, p_valor_nuevo, p_justificacion,
        p_documento_sustento_tipo, p_documento_sustento_num,
        v_auth_ctx.user_id, v_auth_ctx.correlation_id, v_now
    );

    RETURN jsonb_build_object(
        'resultado', 'EXITO',
        'encargatura_id', p_encargatura_id,
        'campo', p_campo,
        'valor_anterior', v_actual_valor,
        'valor_nuevo', p_valor_nuevo,
        'correlation_id', v_auth_ctx.correlation_id,
        'rectificado_en', v_now
    );
END;
$$;

ALTER FUNCTION sigd_org.fn_rectificar_encargatura(TEXT, UUID, VARCHAR, TEXT, TEXT, VARCHAR, VARCHAR, TEXT) OWNER TO sigd_rector_encargatura;
GRANT EXECUTE ON FUNCTION sigd_org.fn_rectificar_encargatura(TEXT, UUID, VARCHAR, TEXT, TEXT, VARCHAR, VARCHAR, TEXT) TO sigd_app;

-- 6.3. Revocación de Permiso de Encargatura
CREATE OR REPLACE FUNCTION sigd_org.fn_revocar_permiso_encargatura(
    p_auth_token       TEXT,
    p_encargatura_id   UUID,
    p_permiso_id       UUID,
    p_motivo           TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, sigd_auth, sigd_org, sigd_audit, public
AS $$
DECLARE
    v_content_canonical TEXT;
    v_content_hash      VARCHAR(64);
    v_auth_ctx          RECORD;
    v_actor_cuenta      RECORD;
    v_actor_rol         RECORD;
    v_encargatura       RECORD;
    v_permiso           RECORD;
    v_now               TIMESTAMPTZ;
BEGIN
    v_now := clock_timestamp();

    IF length(trim(p_motivo)) < 10 THEN
        RAISE EXCEPTION 'REVOCACION_MOTIVO_CORTO: Mínimo 10 caracteres' USING ERRCODE = '23514';
    END IF;

    v_content_canonical := 'OP:REVOCAR_PERMISO|TARGET:' || p_encargatura_id::text || 
                           '|PERM:' || p_permiso_id::text || 
                           '|MOTIVO:' || coalesce(p_motivo, '');
    v_content_hash := encode(public.digest(v_content_canonical, 'sha256'), 'hex');

    SELECT * INTO v_auth_ctx 
      FROM sigd_org.fn_verificar_token_transaccional(
               p_auth_token, 'REVOCAR_PERMISO', p_encargatura_id, p_permiso_id::text, v_content_hash
           );

    -- Nivel 1: Bloqueo de Cuenta
    SELECT cu.id_usuario, cu.activo INTO v_actor_cuenta
      FROM sigd_auth.cuenta_usuario cu
     WHERE cu.id_usuario = v_auth_ctx.user_id
       FOR SHARE OF cu;

    IF NOT FOUND OR v_actor_cuenta.activo IS NOT TRUE THEN
        RAISE EXCEPTION 'REVOCACION_ADMIN_INACTIVO: Cuenta inactiva' USING ERRCODE = '28000';
    END IF;

    -- Nivel 2 y 3: Bloqueo de Rol con facultades (ADMINISTRADOR o DIRECTOR)
    SELECT ur.id_usuario_rol 
      INTO v_actor_rol
      FROM sigd_org.usuario_rol ur
      JOIN sigd_org.rol_sistema rs ON rs.rol_id = ur.rol_id
     WHERE ur.id_usuario = v_auth_ctx.user_id
       AND ur.institucion_id = v_auth_ctx.institucion_id
       AND rs.codigo IN ('ADMINISTRADOR', 'DIRECTOR')
       AND ur.vigente_desde <= v_now
       AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > v_now)
       FOR SHARE OF ur;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'REVOCACION_FACULTAD_DENEGADA: Requiere rol ADMINISTRADOR o DIRECTOR vigente' USING ERRCODE = '42501';
    END IF;

    -- Nivel 4: Bloqueo del Padre
    SELECT ed.* INTO v_encargatura
      FROM sigd_org.encargatura_despacho ed
     WHERE ed.encargatura_id = p_encargatura_id
       FOR SHARE OF ed;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'REVOCACION_PADRE_NOT_FOUND: Encargatura no existe' USING ERRCODE = '02000';
    END IF;

    IF v_encargatura.institucion_id IS DISTINCT FROM v_auth_ctx.institucion_id THEN
        RAISE EXCEPTION 'REVOCACION_INSTITUCION_MISMATCH: Encargatura no pertenece a la institución autorizada' USING ERRCODE = '42501';
    END IF;

    -- Nivel 5: Bloqueo Exclusivo del Permiso
    SELECT ep.* INTO v_permiso
      FROM sigd_org.encargatura_permiso ep
     WHERE ep.encargatura_id = p_encargatura_id
       AND ep.permiso_id = p_permiso_id
       FOR UPDATE OF ep;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'REVOCACION_PERMISO_NOT_FOUND: Permiso no asignado a esta encargatura' USING ERRCODE = '02000';
    END IF;

    IF v_permiso.estado = 'REVOCADO' THEN
        RAISE EXCEPTION 'REVOCACION_PERMISO_YA_REVOCADO: El permiso ya se encuentra REVOCADO' USING ERRCODE = '23514';
    END IF;

    -- Transición a REVOCADO
    UPDATE sigd_org.encargatura_permiso
       SET estado = 'REVOCADO',
           revocado_en = v_now,
           revocado_por = v_auth_ctx.user_id,
           motivo_revocacion = p_motivo
     WHERE encargatura_id = p_encargatura_id
       AND permiso_id = p_permiso_id;

    -- Registro WORM
    INSERT INTO sigd_audit.encargatura_permiso_audit (
        id_audit, encargatura_id, permiso_id, institucion_id,
        accion, estado_anterior, estado_nuevo, motivo,
        operado_por, correlation_id, operado_en
    ) VALUES (
        gen_random_uuid(), p_encargatura_id, p_permiso_id, v_auth_ctx.institucion_id,
        'REVOCAR', 'ACTIVO', 'REVOCADO', p_motivo,
        v_auth_ctx.user_id, v_auth_ctx.correlation_id, v_now
    );

    RETURN jsonb_build_object(
        'resultado', 'EXITO',
        'encargatura_id', p_encargatura_id,
        'permiso_id', p_permiso_id,
        'estado_anterior', 'ACTIVO',
        'estado_nuevo', 'REVOCADO',
        'revocado_en', v_now,
        'correlation_id', v_auth_ctx.correlation_id
    );
END;
$$;

ALTER FUNCTION sigd_org.fn_revocar_permiso_encargatura(TEXT, UUID, UUID, TEXT) OWNER TO sigd_rector_encargatura;
GRANT EXECUTE ON FUNCTION sigd_org.fn_revocar_permiso_encargatura(TEXT, UUID, UUID, TEXT) TO sigd_app;

-- 6.4. Asignación Autorizada de Permisos a Encargatura
CREATE OR REPLACE FUNCTION sigd_org.fn_asignar_permiso_encargatura(
    p_auth_token       TEXT,
    p_encargatura_id   UUID,
    p_permiso_id       UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, sigd_auth, sigd_org, sigd_audit, public
AS $$
DECLARE
    v_content_canonical TEXT;
    v_content_hash      VARCHAR(64);
    v_auth_ctx          RECORD;
    v_actor_rol         RECORD;
    v_encargatura       RECORD;
    v_permiso_codigo    VARCHAR(60);
    v_permiso_vigente   BOOLEAN;
    v_now               TIMESTAMPTZ;
BEGIN
    v_now := clock_timestamp();

    v_content_canonical := 'OP:ASIGNAR_PERMISO|TARGET:' || p_encargatura_id::text || 
                           '|PERM:' || p_permiso_id::text;
    v_content_hash := encode(public.digest(v_content_canonical, 'sha256'), 'hex');

    SELECT * INTO v_auth_ctx 
      FROM sigd_org.fn_verificar_token_transaccional(
               p_auth_token, 'ASIGNAR_PERMISO', p_encargatura_id, p_permiso_id::text, v_content_hash
           );

    -- Verificación de facultades del actor (ADMINISTRADOR o DIRECTOR)
    SELECT ur.id_usuario_rol 
      INTO v_actor_rol
      FROM sigd_org.usuario_rol ur
      JOIN sigd_org.rol_sistema rs ON rs.rol_id = ur.rol_id
     WHERE ur.id_usuario = v_auth_ctx.user_id
       AND ur.institucion_id = v_auth_ctx.institucion_id
       AND rs.codigo IN ('ADMINISTRADOR', 'DIRECTOR')
       AND ur.vigente_desde <= v_now
       AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > v_now)
       FOR SHARE OF ur;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ASIGNACION_FACULTAD_DENEGADA: Requiere rol ADMINISTRADOR o DIRECTOR vigente' USING ERRCODE = '42501';
    END IF;

    -- Bloqueo del Padre
    SELECT ed.* INTO v_encargatura
      FROM sigd_org.encargatura_despacho ed
     WHERE ed.encargatura_id = p_encargatura_id
       FOR SHARE OF ed;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ASIGNACION_PADRE_NOT_FOUND: Encargatura no existe' USING ERRCODE = '02000';
    END IF;

    IF v_encargatura.institucion_id IS DISTINCT FROM v_auth_ctx.institucion_id THEN
        RAISE EXCEPTION 'ASIGNACION_INSTITUCION_MISMATCH: Encargatura de otra institución' USING ERRCODE = '42501';
    END IF;

    IF v_encargatura.vigente IS NOT TRUE OR v_encargatura.revocado_en IS NOT NULL THEN
        RAISE EXCEPTION 'ASIGNACION_ENCARGATURA_INACTIVA: Encargatura inactiva o revocada' USING ERRCODE = '23514';
    END IF;

    -- Verificación en catálogo
    SELECT ps.codigo, ps.vigente INTO v_permiso_codigo, v_permiso_vigente
      FROM sigd_org.permiso_sistema ps
     WHERE ps.permiso_id = p_permiso_id;

    IF NOT FOUND OR v_permiso_vigente IS NOT TRUE THEN
        RAISE EXCEPTION 'ASIGNACION_PERMISO_INVALIDO: Permiso no vigente en catálogo' USING ERRCODE = '23514';
    END IF;

    IF v_permiso_codigo NOT IN (
        'EXPEDIENTE_LEER', 'EXPEDIENTE_APROBAR', 'EXPEDIENTE_RECHAZAR',
        'EXPEDIENTE_ASIGNAR', 'EXPEDIENTE_REASIGNAR', 'EXPEDIENTE_DERIVAR',
        'RESOLUCION_EMITIR', 'RESOLUCION_FIRMAR', 'FIRMA_FIRMAR'
    ) THEN
        RAISE EXCEPTION 'ASIGNACION_PERMISO_NO_DELEGABLE: El permiso "%" no es delegable', v_permiso_codigo USING ERRCODE = '23514';
    END IF;

    -- Inserción
    INSERT INTO sigd_org.encargatura_permiso (
        encargatura_id, permiso_id, estado, creado_en
    ) VALUES (
        p_encargatura_id, p_permiso_id, 'ACTIVO', v_now
    );

    -- WORM Audit
    INSERT INTO sigd_audit.encargatura_permiso_audit (
        id_audit, encargatura_id, permiso_id, institucion_id,
        accion, estado_anterior, estado_nuevo, motivo,
        operado_por, correlation_id, operado_en
    ) VALUES (
        gen_random_uuid(), p_encargatura_id, p_permiso_id, v_auth_ctx.institucion_id,
        'ASIGNAR', NULL, 'ACTIVO', 'Asignación institucional autorizada',
        v_auth_ctx.user_id, v_auth_ctx.correlation_id, v_now
    );

    RETURN jsonb_build_object(
        'resultado', 'EXITO',
        'encargatura_id', p_encargatura_id,
        'permiso_id', p_permiso_id,
        'estado', 'ACTIVO',
        'creado_en', v_now
    );
END;
$$;

ALTER FUNCTION sigd_org.fn_asignar_permiso_encargatura(TEXT, UUID, UUID) OWNER TO sigd_rector_encargatura;
GRANT EXECUTE ON FUNCTION sigd_org.fn_asignar_permiso_encargatura(TEXT, UUID, UUID) TO sigd_app;

-- 6.5. Autorización de Suplencia Transaccional Blindada
CREATE OR REPLACE FUNCTION sigd_org.fn_adquirir_autorizacion_suplencia(
    p_auth_token       TEXT,
    p_encargatura_id   UUID,
    p_codigo_permiso   VARCHAR(60),
    p_tipo_documento   VARCHAR(40)
)
RETURNS TABLE (
    autorizado               BOOLEAN,
    usuario_suplente_id      UUID,
    titular_usuario_id       UUID,
    cargo_id                 UUID,
    area_despacho_id         UUID,
    institucion_id           UUID,
    documento_sustento_tipo  VARCHAR(40),
    documento_sustento_num   VARCHAR(80),
    correlation_id           UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, sigd_auth, sigd_org, public
AS $$
DECLARE
    v_content_canonical TEXT;
    v_content_hash      VARCHAR(64);
    v_auth_ctx          RECORD;
    v_cuenta            RECORD;
    v_encargatura       RECORD;
    v_permiso           RECORD;
    v_ps                RECORD;
    v_now               TIMESTAMPTZ;
BEGIN
    v_now := clock_timestamp();

    v_content_canonical := 'OP:AUTORIZAR_SUPLENCIA|TARGET:' || p_encargatura_id::text || 
                           '|PERM:' || coalesce(p_codigo_permiso, '') || 
                           '|DOC_TIPO:' || coalesce(p_tipo_documento, '');
    v_content_hash := encode(public.digest(v_content_canonical, 'sha256'), 'hex');

    SELECT * INTO v_auth_ctx 
      FROM sigd_org.fn_verificar_token_transaccional(
               p_auth_token, 'AUTORIZAR_SUPLENCIA', p_encargatura_id, p_codigo_permiso, v_content_hash
           );

    -- Nivel 1: Bloqueo de Cuenta
    SELECT cu.id_usuario, cu.activo INTO v_cuenta
      FROM sigd_auth.cuenta_usuario cu
     WHERE cu.id_usuario = v_auth_ctx.user_id
       FOR SHARE OF cu;

    IF NOT FOUND OR v_cuenta.activo IS NOT TRUE THEN
        RETURN;
    END IF;

    -- Nivel 4: Bloqueo de Encargatura
    SELECT ed.* INTO v_encargatura
      FROM sigd_org.encargatura_despacho ed
     WHERE ed.encargatura_id = p_encargatura_id
       AND ed.usuario_id = v_auth_ctx.user_id
       FOR SHARE OF ed;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- Validaciones copulativas
    IF v_encargatura.vigente IS NOT TRUE OR v_encargatura.revocado_en IS NOT NULL OR 
       v_encargatura.motivo_no_habilitado IS NOT NULL THEN
        RETURN;
    END IF;

    IF v_encargatura.inicio > v_now OR (v_encargatura.fin IS NOT NULL AND v_encargatura.fin <= v_now) THEN
        RETURN;
    END IF;

    IF v_encargatura.institucion_id IS DISTINCT FROM v_auth_ctx.institucion_id THEN
        RETURN;
    END IF;

    IF p_tipo_documento IS NOT NULL AND 
       cardinality(v_encargatura.tipos_documento_permitidos) > 0 AND 
       NOT (p_tipo_documento = ANY(v_encargatura.tipos_documento_permitidos)) THEN
        RETURN;
    END IF;

    -- Nivel 6: Catálogo de Permisos
    SELECT ps.permiso_id, ps.vigente INTO v_ps
      FROM sigd_org.permiso_sistema ps
     WHERE ps.codigo = p_codigo_permiso;

    IF NOT FOUND OR v_ps.vigente IS NOT TRUE THEN
        RETURN;
    END IF;

    -- Nivel 5: Bloqueo del Permiso Delegado
    SELECT ep.* INTO v_permiso
      FROM sigd_org.encargatura_permiso ep
     WHERE ep.encargatura_id = p_encargatura_id
       AND ep.permiso_id = v_ps.permiso_id
       FOR SHARE OF ep;

    IF NOT FOUND OR v_permiso.estado IS DISTINCT FROM 'ACTIVO' OR v_permiso.revocado_en IS NOT NULL THEN
        RETURN;
    END IF;

    autorizado              := TRUE;
    usuario_suplente_id     := v_encargatura.usuario_id;
    titular_usuario_id      := v_encargatura.titular_usuario_id;
    cargo_id                := v_encargatura.cargo_id;
    area_despacho_id        := v_encargatura.area_despacho_id;
    institucion_id          := v_encargatura.institucion_id;
    documento_sustento_tipo := v_encargatura.documento_sustento_tipo;
    documento_sustento_num  := v_encargatura.documento_sustento_numero;
    correlation_id          := v_auth_ctx.correlation_id;
    RETURN NEXT;
END;
$$;

ALTER FUNCTION sigd_org.fn_adquirir_autorizacion_suplencia(TEXT, UUID, VARCHAR, VARCHAR) OWNER TO sigd_rector_encargatura;
GRANT EXECUTE ON FUNCTION sigd_org.fn_adquirir_autorizacion_suplencia(TEXT, UUID, VARCHAR, VARCHAR) TO sigd_app;

-- 6.6. Purga Periódica de Nonces Expirados (>24 horas)
CREATE OR REPLACE FUNCTION sigd_auth.fn_purgar_nonces_expirados()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, sigd_auth
AS $$
DECLARE
    v_purgados INTEGER;
BEGIN
    DELETE FROM sigd_auth.token_nonce_consumido
     WHERE consumido_en < clock_timestamp() - interval '24 hours';
    GET DIAGNOSTICS v_purgados = ROW_COUNT;
    RETURN v_purgados;
END;
$$;

ALTER FUNCTION sigd_auth.fn_purgar_nonces_expirados() OWNER TO sigd_schema_owner;
REVOKE ALL ON FUNCTION sigd_auth.fn_purgar_nonces_expirados() FROM PUBLIC, sigd_app;

-- -----------------------------------------------------------------------------
-- 7. MATRIZ DE PRIVILEGIOS POR COLUMNA Y BLINDAJE RELACIONAL
-- -----------------------------------------------------------------------------

-- Concesión de USAGE en esquemas institucionales para roles técnicos
GRANT USAGE ON SCHEMA sigd_auth, sigd_org, sigd_audit TO sigd_rector_encargatura, sigd_app;

-- Concesión de lectura sobre entidades de catálogo institucional
GRANT SELECT ON sigd_org.institucion, sigd_auth.usuario_institucion, sigd_org.area, sigd_org.cargo TO sigd_rector_encargatura;

-- Concesión a sigd_rector_encargatura de columnas necesarias para bloqueos de fila
GRANT SELECT ON sigd_auth.cuenta_usuario TO sigd_rector_encargatura;
GRANT UPDATE (ultimo_acceso) ON sigd_auth.cuenta_usuario TO sigd_rector_encargatura;

GRANT SELECT ON sigd_org.usuario_rol TO sigd_rector_encargatura;
GRANT UPDATE (vigente_hasta) ON sigd_org.usuario_rol TO sigd_rector_encargatura;

GRANT SELECT ON sigd_org.rol_sistema TO sigd_rector_encargatura;
GRANT SELECT ON sigd_org.permiso_sistema TO sigd_rector_encargatura;

GRANT SELECT, UPDATE (vigente, fin, revocado_en, revocado_por, motivo_revocacion, documento_sustento_tipo, documento_sustento_numero, motivo_encargatura, inicio) 
    ON sigd_org.encargatura_despacho TO sigd_rector_encargatura;

GRANT SELECT, INSERT, UPDATE (estado, revocado_en, revocado_por, motivo_revocacion) 
    ON sigd_org.encargatura_permiso TO sigd_rector_encargatura;

GRANT SELECT, INSERT ON sigd_auth.token_nonce_consumido TO sigd_rector_encargatura;
GRANT SELECT (kid, institucion_id, secreto, estado, expira_en) ON sigd_auth.clave_sistema TO sigd_rector_encargatura;

GRANT SELECT, INSERT ON sigd_audit.encargatura_rectificacion_log TO sigd_rector_encargatura, sigd_audit_writer;
GRANT SELECT, INSERT ON sigd_audit.encargatura_permiso_audit TO sigd_rector_encargatura, sigd_audit_writer;

-- Retiro de privilegios directos de modificación al rol de aplicación sigd_app
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON sigd_org.encargatura_permiso FROM PUBLIC, sigd_app;
REVOKE UPDATE, DELETE, TRUNCATE ON sigd_audit.encargatura_rectificacion_log FROM PUBLIC, sigd_app;
REVOKE UPDATE, DELETE, TRUNCATE ON sigd_audit.encargatura_permiso_audit FROM PUBLIC, sigd_app;
REVOKE ALL ON sigd_auth.clave_sistema FROM PUBLIC, sigd_app;
REVOKE ALL ON sigd_auth.token_nonce_consumido FROM PUBLIC, sigd_app;

GRANT SELECT ON sigd_org.encargatura_permiso TO sigd_app;
GRANT SELECT ON sigd_audit.encargatura_rectificacion_log TO sigd_app, sigd_auditor;
GRANT SELECT ON sigd_audit.encargatura_permiso_audit TO sigd_app, sigd_auditor;

-- -----------------------------------------------------------------------------
-- 8. SANEAMIENTO Y BACKFILL HISTÓRICO DE ENCARGATURAS (9 ESTADOS)
-- -----------------------------------------------------------------------------

-- Saneamiento E4: Clausura de encargaturas con fin cumplido que permanecían vigentes
UPDATE sigd_org.encargatura_despacho
   SET vigente = FALSE
 WHERE vigente IS TRUE
   AND fin IS NOT NULL
   AND fin <= clock_timestamp();
