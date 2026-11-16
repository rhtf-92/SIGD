-- =============================================================================
-- Migración 25 · Esquema sigd_auth / sigd_audit: Separación Explícita de RBAC de Plataforma (SUPER_ADMIN)
-- Sistema Integral de Gestión Documentaria (SIGD) — Ecosistema SaaS Multiinstitucional
-- -----------------------------------------------------------------------------
-- Rama oficial: B_JACOBO | Motor: PostgreSQL 18.6 Alpine
-- Marco normativo: Modelo de Gestión Documental (MGD-PCM), TUO Ley 27444
-- Principio de Arquitectura: Los 10 roles canónicos institucionales residen en sigd_org.rol_sistema.
--                            El rol SUPER_ADMIN es una autoridad transversal de plataforma SaaS y
--                            reside exclusivamente en sigd_auth.rol_plataforma, desacoplado de institucion_id.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Catálogo de Roles de Plataforma SaaS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_auth.rol_plataforma (
    codigo      VARCHAR(30)  NOT NULL CONSTRAINT pk_rol_plataforma PRIMARY KEY,
    nombre      VARCHAR(120) NOT NULL,
    descripcion TEXT         NULL,
    vigente     BOOLEAN      NOT NULL DEFAULT TRUE
);

INSERT INTO sigd_auth.rol_plataforma (codigo, nombre, descripcion, vigente)
VALUES (
    'SUPER_ADMIN',
    'Super Administrador de Plataforma Multiinstitucional',
    'Gobernanza transversal del SaaS: gestión de instituciones, aprovisionamiento de tenants, claves maestras, seguridad de plataforma y auditoría global. No representa institucionalmente ni firma resoluciones directorales.',
    TRUE
)
ON CONFLICT (codigo) DO UPDATE
   SET nombre = EXCLUDED.nombre,
       descripcion = EXCLUDED.descripcion,
       vigente = TRUE;

-- -----------------------------------------------------------------------------
-- 2. Asignación de Roles de Plataforma a Usuarios (Cross-Tenant)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_auth.usuario_rol_plataforma (
    id_asignacion   UUID         NOT NULL DEFAULT gen_random_uuid() CONSTRAINT pk_usuario_rol_plataforma PRIMARY KEY,
    id_usuario      UUID         NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
    rol_plataforma  VARCHAR(30)  NOT NULL REFERENCES sigd_auth.rol_plataforma(codigo) ON DELETE RESTRICT,
    asignado_por    UUID         NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
    vigente_desde   TIMESTAMPTZ  NOT NULL DEFAULT clock_timestamp(),
    vigente_hasta   TIMESTAMPTZ  NULL,
    CONSTRAINT uq_usuario_rol_plataforma UNIQUE (id_usuario, rol_plataforma),
    CONSTRAINT chk_usuario_rol_plataforma_vigencia CHECK (vigente_hasta IS NULL OR vigente_hasta > vigente_desde)
);

CREATE INDEX IF NOT EXISTS idx_usuario_rol_plataforma_busqueda 
    ON sigd_auth.usuario_rol_plataforma (id_usuario, rol_plataforma, vigente_hasta);

-- -----------------------------------------------------------------------------
-- 3. Bitácora WORM de Operaciones Privilegiadas de Plataforma
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_audit.auditoria_plataforma_log (
    id_operacion             UUID         NOT NULL DEFAULT gen_random_uuid() CONSTRAINT pk_auditoria_plataforma_log PRIMARY KEY,
    correlation_id           UUID         NOT NULL,
    actor_id                 UUID         NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
    operacion                VARCHAR(80)  NOT NULL,
    institucion_afectada_id  UUID         NULL REFERENCES sigd_org.institucion(institucion_id) ON DELETE RESTRICT,
    entidad_tipo             VARCHAR(60)  NOT NULL,
    entidad_id               VARCHAR(80)  NOT NULL,
    datos_antes              JSONB        NULL,
    datos_despues            JSONB        NULL,
    motivo_justificacion     TEXT         NOT NULL CONSTRAINT chk_plataforma_motivo_len CHECK (length(trim(motivo_justificacion)) >= 15),
    ip_origen                INET         NULL,
    user_agent               VARCHAR(512) NULL,
    fecha_operacion          TIMESTAMPTZ  NOT NULL DEFAULT clock_timestamp()
) WITH (fillfactor = 100);

CREATE INDEX IF NOT EXISTS idx_auditoria_plataforma_actor 
    ON sigd_audit.auditoria_plataforma_log (actor_id, fecha_operacion DESC);

CREATE INDEX IF NOT EXISTS idx_auditoria_plataforma_inst 
    ON sigd_audit.auditoria_plataforma_log (institucion_afectada_id, fecha_operacion DESC);

-- Disparadores WORM en auditoria_plataforma_log
CREATE OR REPLACE FUNCTION sigd_audit.fn_proteger_auditoria_plataforma_worm()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'WORM_INTEGRITY_VIOLATION: La bitácora sigd_audit.auditoria_plataforma_log es inmutable (operación % prohibida)', TG_OP
        USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS tr_proteger_auditoria_plataforma_worm ON sigd_audit.auditoria_plataforma_log;
CREATE TRIGGER tr_proteger_auditoria_plataforma_worm
    BEFORE UPDATE OR DELETE ON sigd_audit.auditoria_plataforma_log
    FOR EACH STATEMENT
    EXECUTE FUNCTION sigd_audit.fn_proteger_auditoria_plataforma_worm();

DROP TRIGGER IF EXISTS tr_proteger_auditoria_plataforma_worm_trunc ON sigd_audit.auditoria_plataforma_log;
CREATE TRIGGER tr_proteger_auditoria_plataforma_worm_trunc
    BEFORE TRUNCATE ON sigd_audit.auditoria_plataforma_log
    FOR EACH STATEMENT
    EXECUTE FUNCTION sigd_audit.fn_proteger_auditoria_plataforma_worm();

-- -----------------------------------------------------------------------------
-- 4. Funciones Rectoras de Verificación de SUPER_ADMIN
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sigd_auth.fn_es_super_admin(p_usuario_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, sigd_auth, public
AS $$
    SELECT EXISTS (
        SELECT 1
          FROM sigd_auth.usuario_rol_plataforma urp
          JOIN sigd_auth.cuenta_usuario cu ON cu.id_usuario = urp.id_usuario
         WHERE urp.id_usuario = p_usuario_id
           AND urp.rol_plataforma = 'SUPER_ADMIN'
           AND cu.activo = TRUE
           AND urp.vigente_desde <= clock_timestamp()
           AND (urp.vigente_hasta IS NULL OR urp.vigente_hasta > clock_timestamp())
    );
$$;

-- -----------------------------------------------------------------------------
-- 5. Privilegios de Seguridad
-- -----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA sigd_auth, sigd_audit TO sigd_app;
GRANT SELECT ON sigd_auth.rol_plataforma, sigd_auth.usuario_rol_plataforma TO sigd_app;
GRANT SELECT, INSERT ON sigd_audit.auditoria_plataforma_log TO sigd_app;
REVOKE UPDATE, DELETE, TRUNCATE ON sigd_audit.auditoria_plataforma_log FROM PUBLIC, sigd_app;
