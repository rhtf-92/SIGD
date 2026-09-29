-- Fixtures mínimos de la suite E2E (entregable 03).
-- Garantizan la reproducibilidad del entorno sin depender de que los DDL de los
-- grupos 1 al 5 estén presentes. Si ya existen (migraciones reales), CREATE IF NOT
-- EXISTS los respeta. Las tablas de `sigd_audit` provienen del entregable DDL 06.

CREATE SCHEMA IF NOT EXISTS sigd_auth;

CREATE TABLE IF NOT EXISTS sigd_auth.cuenta_usuario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE SCHEMA IF NOT EXISTS sigd_org;

-- Modelo RBAC mínimo: la suite E2E necesita resolver el permiso
-- CALENDARIO_LABORAL_GESTIONAR sin depender del DDL completo de sigd_org v2.
-- `cuenta_usuario.id` es UUID aquí para ser coherente con `usuario_rol.cuenta_id`.
CREATE TABLE IF NOT EXISTS sigd_org.rol_sistema (
    rol_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo  VARCHAR(50) NOT NULL UNIQUE,
    nombre  VARCHAR(100) NOT NULL,
    descripcion TEXT,
    activo  BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS sigd_org.permiso_sistema (
    permiso_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo                VARCHAR(100) NOT NULL UNIQUE,
    descripcion           TEXT,
    alcance_predeterminado VARCHAR(20) NOT NULL DEFAULT 'AREA',
    activo                BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS sigd_org.rol_permiso (
    rol_id     UUID NOT NULL REFERENCES sigd_org.rol_sistema (rol_id) ON DELETE CASCADE,
    permiso_id UUID NOT NULL REFERENCES sigd_org.permiso_sistema (permiso_id) ON DELETE CASCADE,
    PRIMARY KEY (rol_id, permiso_id)
);

CREATE TABLE IF NOT EXISTS sigd_org.usuario_rol (
    cuenta_id UUID NOT NULL REFERENCES sigd_auth.cuenta_usuario (id) ON DELETE CASCADE,
    rol_id    UUID NOT NULL REFERENCES sigd_org.rol_sistema (rol_id) ON DELETE CASCADE,
    vigencia  TSTZRANGE NOT NULL DEFAULT tstzrange(now(), NULL, '[)'),
    PRIMARY KEY (cuenta_id, rol_id)
);

CREATE TABLE IF NOT EXISTS sigd_org.area (
    area_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre  TEXT NOT NULL,
    vigente BOOLEAN NOT NULL DEFAULT true
);

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