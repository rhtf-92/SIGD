
-- =============================================================================
-- SIGD - Grupo 2 "TramiCore"
-- Script SQL Final: 03_tramite_expediente_registro.sql
-- Alineado con el modelo de B_RAMIREZ e integraciones con Grupo 3 y 4
-- =============================================================================

BEGIN;

-- 1. LIMPIEZA / PREPARACIÓN DE ENTORNO
DROP TABLE IF EXISTS asiento_registro CASCADE;
DROP TABLE IF EXISTS expediente CASCADE;
DROP TABLE IF EXISTS tramite CASCADE;
DROP SEQUENCE IF EXISTS seq_asiento_numero_registro CASCADE;

-- 2. SECUENCIA EXPLÍCITA PARA NUMERO_REGISTRO EN EL LIBRO GENERAL
CREATE SEQUENCE seq_asiento_numero_registro 
    START WITH 10001 
    INCREMENT BY 1 
    NO MAXVALUE;

-- 3. TABLA TRAMITE
-- Representa la solicitud o escrito inicial enviado por el remitente.
CREATE TABLE tramite (
    id_tramite BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo_tramite VARCHAR(50) NULL UNIQUE, -- Código visible de negocio (ej. TRM-2026-0001)
    asunto VARCHAR(500) NOT NULL,
    estado VARCHAR(30) NOT NULL DEFAULT 'REGISTRADO',
    fk_remitente BIGINT NOT NULL,    -- Refiere a la tabla de Usuarios (Módulo Grupo 4)
    fk_destinatario BIGINT NULL,     -- Refiere a la tabla de Áreas/Unidades Organicas (Módulo Grupo 3)
    creado_en TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_tramite_estado CHECK (
        estado IN ('REGISTRADO', 'EN_TRAMITE', 'OBSERVADO', 'CERRADO', 'ANULADO', 'REABIERTO')
    )
);

-- 4. TABLA EXPEDIENTE
-- Contenedor documental del trámite (Cardinalidad 1:1 con Trámite).
CREATE TABLE expediente (
    id_expediente BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo_expediente VARCHAR(50) NOT NULL UNIQUE, -- Formato: EXP-[AÑO]-[CORRELATIVO 6 DÍGITOS]
    fk_tramite BIGINT NOT NULL UNIQUE,
    creado_en TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_expediente_tramite FOREIGN KEY (fk_tramite) 
        REFERENCES tramite (id_tramite) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 5. TABLA ASIENTO_REGISTRO
-- Libro General de Registros inmutable para auditoría pública e institucional.
CREATE TABLE asiento_registro (
    id_asiento BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    numero_registro BIGINT NOT NULL UNIQUE DEFAULT nextval('seq_asiento_numero_registro'),
    fecha_ingreso TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    canal_ingreso VARCHAR(30) NOT NULL DEFAULT 'MESA_PRESENCIAL',
    asunto VARCHAR(500) NOT NULL,
    fk_expediente BIGINT NOT NULL,
    fk_remitente BIGINT NOT NULL,    -- Refiere al Usuario/Solicitante (Grupo 4)
    fk_destinatario BIGINT NULL,     -- Refiere a la Unidad Orgánica Destino (Grupo 3)
    anulado BOOLEAN NOT NULL DEFAULT FALSE, -- Borrado lógico (is_active = false)
    motivo_anulacion TEXT NULL,
    
    CONSTRAINT chk_asiento_canal CHECK (canal_ingreso IN ('MESA_PRESENCIAL', 'MESA_VIRTUAL')),
    CONSTRAINT fk_asiento_expediente FOREIGN KEY (fk_expediente) 
        REFERENCES expediente (id_expediente) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Índices de búsqueda y optimización para el Módulo de Trazabilidad (Grupo 1)
CREATE INDEX idx_tramite_remitente ON tramite(fk_remitente);
CREATE INDEX idx_expediente_tramite ON expediente(fk_tramite);
CREATE INDEX idx_asiento_expediente ON asiento_registro(fk_expediente);
CREATE INDEX idx_asiento_numero_registro ON asiento_registro(numero_registro);


-- =============================================================================
-- DATOS FICTICIOS DE PRUEBA (NO OFICIALES - SOLO DEMOSTRATIVOS)
-- =============================================================================

-- Inserción de Trámites Ficticios
INSERT INTO tramite (codigo_tramite, asunto, estado, fk_remitente, fk_destinatario) VALUES
('TRM-2026-0001', 'Solicitud de Expedición de Título Profesional', 'EN_TRAMITE', 101, 301),
('TRM-2026-0002', 'Rectificación de Notas de Asignatura de Base de Datos', 'OBSERVADO', 102, 302),
('TRM-2026-0003', 'Mantenimiento preventivo de Servidores de Red', 'REGISTRADO', 103, 303),
('TRM-2026-0004', 'Solicitud Invalida con Error de Formato', 'ANULADO', 104, 301);

-- Inserción de Expedientes Ficticios
INSERT INTO expediente (codigo_expediente, fk_tramite) VALUES
('EXP-2026-000001', 1),
('EXP-2026-000002', 2),
('EXP-2026-000003', 3),
('EXP-2026-000004', 4);

-- Inserción de Asientos en el Libro General
INSERT INTO asiento_registro (canal_ingreso, asunto, fk_expediente, fk_remitente, fk_destinatario, anulado, motivo_anulacion) VALUES
('MESA_VIRTUAL', 'Solicitud de Expedición de Título Profesional', 1, 101, 301, FALSE, NULL),
('MESA_PRESENCIAL', 'Rectificación de Notas de Asignatura de Base de Datos', 2, 102, 302, FALSE, NULL),
('MESA_VIRTUAL', 'Mantenimiento preventivo de Servidores de Red', 3, 103, 303, FALSE, NULL),
('MESA_PRESENCIAL', 'Solicitud Invalida con Error de Formato', 4, 104, 301, TRUE, 'Registro duplicado por error material del operador');

COMMIT;