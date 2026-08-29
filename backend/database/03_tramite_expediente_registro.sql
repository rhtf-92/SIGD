
-- =============================================================================
-- GRUPO 2: TramiCore - Módulo de Trámite, Expediente y Asiento de Registro
-- Base de datos: PostgreSQL
-- Integración: Grupo 1 (Trazabilidad), Grupo 3 (Áreas), Grupo 4 (Usuarios)
-- =============================================================================

BEGIN;

-- 1. Secuencia transaccional segura para correlativo global del Libro de Registros (Evita MAX()+1)
CREATE SEQUENCE IF NOT EXISTS seq_asiento_numero_registro START WITH 1 INCREMENT BY 1;

-- 2. Secuencia para códigos visibles de expedientación anual
CREATE SEQUENCE IF NOT EXISTS seq_codigo_expediente START WITH 1 INCREMENT BY 1;

-- 3. Tabla TRAMITE (Solicitud o requerimiento inicial)
CREATE TABLE IF NOT EXISTS tramite (
    id_tramite BIGSERIAL PRIMARY KEY,
    codigo_tramite VARCHAR(50) NULL, -- Código de negocio / visible (ej. EXP-2026-000001)
    asunto VARCHAR(500) NOT NULL,
    estado VARCHAR(30) NOT NULL DEFAULT 'REGISTRADO', -- REGISTRADO, EN_TRAMITE, OBSERVADO, CERRADO, ANULADO
    fk_remitente BIGINT NOT NULL, -- Referencia al Módulo de Usuarios (Grupo 4)
    fk_destinatario BIGINT NULL,  -- Referencia al Módulo de Áreas/Usuarios (Grupo 3/4)
    creado_en TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabla EXPEDIENTE (Contenedor documental del trámite)
CREATE TABLE IF NOT EXISTS expediente (
    id_expediente BIGSERIAL PRIMARY KEY,
    codigo_expediente VARCHAR(50) NOT NULL UNIQUE,
    fk_tramite BIGINT NOT NULL UNIQUE,
    creado_en TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_expediente_tramite FOREIGN KEY (fk_tramite) 
        REFERENCES tramite (id_tramite) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 5. Tabla ASIENTO_REGISTRO (Libro General de Registros inmutable)
CREATE TABLE IF NOT EXISTS asiento_registro (
    id_asiento BIGSERIAL PRIMARY KEY,
    numero_registro BIGINT NOT NULL UNIQUE DEFAULT nextval('seq_asiento_numero_registro'),
    fecha_ingreso TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    canal_ingreso VARCHAR(30) NOT NULL DEFAULT 'MESA_PRESENCIAL', -- MESA_PRESENCIAL, MESA_VIRTUAL
    asunto VARCHAR(500) NOT NULL,
    fk_expediente BIGINT NOT NULL,
    fk_remitente BIGINT NOT NULL,
    fk_destinatario BIGINT NULL,
    anulado BOOLEAN NOT NULL DEFAULT FALSE, -- Borrado lógico (is_active = false)
    motivo_anulacion TEXT NULL,
    CONSTRAINT fk_asiento_expediente FOREIGN KEY (fk_expediente) 
        REFERENCES expediente (id_expediente) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Índices para optimización de consultas de trazabilidad y búsqueda
CREATE INDEX IF NOT EXISTS idx_tramite_remitente ON tramite(fk_remitente);
CREATE INDEX IF NOT EXISTS idx_expediente_tramite ON expediente(fk_tramite);
CREATE INDEX IF NOT EXISTS idx_asiento_expediente ON asiento_registro(fk_expediente);
CREATE INDEX IF NOT EXISTS idx_asiento_numero_registro ON asiento_registro(numero_registro);

COMMIT;