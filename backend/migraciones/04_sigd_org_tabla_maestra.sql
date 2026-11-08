-- =============================================================================
-- Migración 04 · Tabla de Tablas Maestras (Sedes, Áreas, Tipos documentales)
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
-- -----------------------------------------------------------------------------
-- Propósito : Tabla genérica para catálogos institucionales que el frontend
--             administra en tiempo real (Sedes, Áreas, Tipos documentales).
--             Usa borrado lógico (estado = 'Inactivo') para conservar trazabilidad.
-- Depende de: 03_sigd_org.sql
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS sigd_org;

CREATE TABLE IF NOT EXISTS sigd_org.tabla_maestra (
    id           UUID        NOT NULL DEFAULT gen_random_uuid()
                            CONSTRAINT pk_tabla_maestra PRIMARY KEY,
    tipo         VARCHAR(50) NOT NULL
                            CONSTRAINT chk_tabla_maestra_tipo
                            CHECK (tipo IN ('Sedes', 'Áreas', 'Tipos documentales')),
    codigo       VARCHAR(50) NOT NULL,
    nombre       VARCHAR(200) NOT NULL,
    detalle      TEXT        NULL,
    estado       VARCHAR(20) NOT NULL DEFAULT 'Activo'
                            CONSTRAINT chk_tabla_maestra_estado
                            CHECK (estado IN ('Activo', 'Inactivo')),
    creado_en    TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_tabla_maestra_codigo_tipo UNIQUE (tipo, codigo)
);

COMMENT ON TABLE sigd_org.tabla_maestra IS
    'Catálogos institucionales gestionados en tiempo real: Sedes, Áreas y Tipos documentales. Borrado lógico (estado = Inactivo).';

CREATE INDEX IF NOT EXISTS idx_tabla_maestra_tipo
    ON sigd_org.tabla_maestra (tipo);
CREATE INDEX IF NOT EXISTS idx_tabla_maestra_estado
    ON sigd_org.tabla_maestra (estado);
CREATE INDEX IF NOT EXISTS idx_tabla_maestra_tipo_estado
    ON sigd_org.tabla_maestra (tipo, estado);

-- Semilla institucional inicial (sede principal y tipos documentales base)
INSERT INTO sigd_org.tabla_maestra (tipo, codigo, nombre, detalle, estado) VALUES
    ('Sedes', 'SED-001', 'Sede Principal', 'Campus central de Pucallpa (Av. Centenario Km 3.5).', 'Activo'),
    ('Tipos documentales', 'SOL', 'Solicitud', 'Escrito del administrado que inicia un trámite.', 'Activo'),
    ('Tipos documentales', 'OFI', 'Oficio', 'Comunicación externa con otras entidades del Estado.', 'Activo'),
    ('Tipos documentales', 'MEMO', 'Memorando', 'Comunicación interna de gestión.', 'Activo'),
    ('Tipos documentales', 'INF', 'Informe Técnico / Legal', 'Documento de sustento pericial o académico.', 'Activo'),
    ('Tipos documentales', 'RD', 'Resolución Directoral', 'Acto resolutivo de máxima jerarquía institucional.', 'Activo')
ON CONFLICT (tipo, codigo) DO NOTHING;
