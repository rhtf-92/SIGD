-- Fixtures mínimos de la suite E2E (entregable 03).
-- Garantizan la reproducibilidad del entorno sin depender de que los DDL de los
-- grupos 1 al 5 estén presentes. Si ya existen (migraciones reales), CREATE IF NOT
-- EXISTS los respeta. Las tablas de `sigd_audit` provienen del entregable DDL 06.

CREATE SCHEMA IF NOT EXISTS sigd_auth;

CREATE TABLE IF NOT EXISTS sigd_auth.cuenta_usuario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE SCHEMA IF NOT EXISTS sigd_org;

CREATE TABLE IF NOT EXISTS sigd_org.area (
    area_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre  TEXT NOT NULL,
    vigente BOOLEAN NOT NULL DEFAULT true
);

-- Control de acceso basado en roles (OrganiCore). Mismas claves y restricciones que
-- el DDL oficial docs/02_organicore/03_esquema_sigd_org_v2.sql, replicadas aquí para
-- que la suite sea autocontenida. Semilla de roles y permisos: docs/02_organicore/11.

CREATE TABLE IF NOT EXISTS sigd_org.rol_sistema (
    rol_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(50) NOT NULL UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    activo BOOLEAN NOT NULL DEFAULT true,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sigd_org.permiso_sistema (
    permiso_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    alcance_predeterminado VARCHAR(20) NOT NULL DEFAULT 'AREA',
    activo BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT ck_permiso_alcance
        CHECK (alcance_predeterminado IN ('AREA', 'SUBAREAS', 'GLOBAL'))
);

CREATE TABLE IF NOT EXISTS sigd_org.rol_permiso (
    rol_id UUID NOT NULL REFERENCES sigd_org.rol_sistema (rol_id) ON DELETE CASCADE,
    permiso_id UUID NOT NULL REFERENCES sigd_org.permiso_sistema (permiso_id) ON DELETE CASCADE,
    PRIMARY KEY (rol_id, permiso_id)
);

CREATE TABLE IF NOT EXISTS sigd_org.usuario_rol (
    cuenta_id UUID NOT NULL,
    rol_id UUID NOT NULL REFERENCES sigd_org.rol_sistema (rol_id) ON DELETE CASCADE,
    vigencia TSTZRANGE NOT NULL DEFAULT tstzrange(now(), NULL, '[)'),
    PRIMARY KEY (cuenta_id, rol_id),
    CONSTRAINT chk_usuario_rol_vigencia_no_vacia CHECK (NOT isempty(vigencia))
);

CREATE INDEX IF NOT EXISTS idx_rol_permiso_permiso ON sigd_org.rol_permiso (permiso_id);

CREATE SCHEMA IF NOT EXISTS sigd_tra;

CREATE TABLE IF NOT EXISTS sigd_tra.expediente (
    expediente_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero             TEXT NOT NULL UNIQUE,
    dni_solicitante    CHAR(8),
    tipo_documental_id UUID NOT NULL,
    solicitante_id     UUID NOT NULL,
    area_destino_id    UUID NOT NULL,
    fecha_radicacion   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE SCHEMA IF NOT EXISTS sigd_rut;

CREATE TABLE IF NOT EXISTS sigd_rut.movimiento_tramite (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expediente_id   UUID NOT NULL REFERENCES sigd_tra.expediente (expediente_id),
    area_destino_id UUID NOT NULL,
    fecha_movimiento TIMESTAMPTZ NOT NULL DEFAULT now()
);