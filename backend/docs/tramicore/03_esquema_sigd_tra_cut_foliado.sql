-- =============================================================================
-- SIGD · Grupo 2 "TramiCore" — Esquema Fase 2
-- CUT, Acumulación de Expedientes y Foliado Digital
-- Basado en: MGD-PCM (R.S. N° 001-2017-PCM/SEGDI), TUO Ley N° 27444 (Art. 160 LPAG)
--            y Directiva AGN (R.J. N° 073-2023-AGN/J)
-- Ejecutado y verificado en PostgreSQL 18.3+
-- =============================================================================

BEGIN;

-- =============================================================================
-- 0. ESQUEMA DE TRABAJO
-- =============================================================================
CREATE SCHEMA IF NOT EXISTS sigd_tra;
SET search_path TO sigd_tra, public;

-- =============================================================================
-- 1. LIMPIEZA / PREPARACIÓN DE ENTORNO
-- ADVERTENCIA: estos DROP TABLE ... CASCADE son únicamente para una base de
-- datos aislada de pruebas. En un entorno real de producción NO deben ejecutarse.
-- =============================================================================
DROP TABLE IF EXISTS sigd_tra.expediente_documento_folio CASCADE;
DROP TABLE IF EXISTS sigd_tra.expediente_acumulacion CASCADE;
DROP TABLE IF EXISTS sigd_tra.secuencia_anual_cut CASCADE;
DROP TABLE IF EXISTS sigd_tra.asiento_registro CASCADE;
DROP TABLE IF EXISTS sigd_tra.expediente CASCADE;
DROP TABLE IF EXISTS sigd_tra.tramite CASCADE;
DROP SEQUENCE IF EXISTS sigd_tra.seq_asiento_numero_registro CASCADE;
DROP SEQUENCE IF EXISTS sigd_tra.seq_cut_expediente_anio CASCADE;

-- =============================================================================
-- 2. SECUENCIAS
-- =============================================================================

-- Secuencia para el Libro General de Registros (número_registro inmutable)
CREATE SEQUENCE seq_asiento_numero_registro
    START WITH 10001
    INCREMENT BY 1
    NO MAXVALUE;

-- Secuencia para generación de CUT por año fiscal (EXP-YYYY-XXXXXX)
CREATE SEQUENCE seq_cut_expediente_anio
    START WITH 100000
    INCREMENT BY 1
    NO MAXVALUE;

-- =============================================================================
-- 3. TABLA TRAMITE
-- =============================================================================
CREATE TABLE tramite (
    id_tramite BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo_tramite VARCHAR(20) NOT NULL UNIQUE,
    asunto VARCHAR(500) NOT NULL,
    estado VARCHAR(30) NOT NULL DEFAULT 'REGISTRADO',
    fk_remitente BIGINT NOT NULL,
    fk_destinatario BIGINT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT chk_tramite_estado CHECK (
        estado IN ('REGISTRADO', 'EN_TRAMITE', 'OBSERVADO', 'CERRADO', 'ANULADO', 'REABIERTO')
    )
);

-- =============================================================================
-- 4. TABLA EXPEDIENTE (sin UNIQUE en fk_tramite → relación 1:N flexible)
-- =============================================================================
CREATE TABLE expediente (
    id_expediente BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo_expediente VARCHAR(50) NOT NULL UNIQUE,
    fk_tramite BIGINT NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_expediente_tramite FOREIGN KEY (fk_tramite)
        REFERENCES tramite (id_tramite) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- =============================================================================
-- 5. TABLA SECUENCIA_ANUAL_CUT
-- =============================================================================
CREATE TABLE secuencia_anual_cut (
    id_secuencia BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    anio_fiscal INT NOT NULL UNIQUE,
    secuencia BIGINT NOT NULL DEFAULT 0,
    ultimo_cut_generado VARCHAR(20) NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insertar secuencias para años fiscales comunes
INSERT INTO secuencia_anual_cut (anio_fiscal, secuencia) VALUES (2026, 100000);

-- =============================================================================
-- 6. TABLA EXPEDIENTE_ACUMULACION (Art. 160 LPAG)
-- =============================================================================
CREATE TABLE expediente_acumulacion (
    id_acumulacion BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_expediente_principal BIGINT NOT NULL,
    id_expediente_accesorio BIGINT NOT NULL,
    fecha_acumulacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acto_resolutivo TEXT NOT NULL,
    estado_acumulacion VARCHAR(20) NOT NULL DEFAULT 'ACUMULADO',
    fecha_desacumulacion TIMESTAMPTZ NULL,
    acto_resolutivo_desacumulacion TEXT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_acumulacion_principal_accesorio UNIQUE (id_expediente_principal, id_expediente_accesorio),
    CONSTRAINT fk_exp_acum_principal FOREIGN KEY (id_expediente_principal)
        REFERENCES expediente (id_expediente) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_exp_acum_accesorio FOREIGN KEY (id_expediente_accesorio)
        REFERENCES expediente (id_expediente) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT chk_exp_acum_diferente CHECK (id_expediente_principal <> id_expediente_accesorio),
    CONSTRAINT chk_exp_acum_estado CHECK (estado_acumulacion IN ('ACUMULADO', 'DESACUMULADO'))
);

-- =============================================================================
-- 7. TABLA EXPEDIENTE_DOCUMENTO_FOLIO (AGN - foliatura progresiva)
-- =============================================================================
CREATE TABLE expediente_documento_folio (
    id_folio BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_expediente BIGINT NOT NULL,
    id_documento BIGINT NOT NULL,
    folio_inicio INT NOT NULL,
    folio_fin INT NOT NULL,
    total_folios INT NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_folio_expediente FOREIGN KEY (id_expediente)
        REFERENCES expediente (id_expediente) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT chk_folio_rango_valido CHECK (folio_fin >= folio_inicio),
    CONSTRAINT chk_folio_total_consistente CHECK (total_folios = folio_fin - folio_inicio + 1),
    CONSTRAINT chk_folio_positivo CHECK (folio_inicio > 0 AND folio_fin > 0)
);

-- Índice para evitar solapamientos de folios (excluido por rango)
CREATE INDEX idx_folio_expediente_rango ON expediente_documento_folio (id_expediente, folio_inicio, folio_fin);

-- =============================================================================
-- 8. TABLA ASIENTO_REGISTRO (Libro General - inmutable)
-- =============================================================================
CREATE TABLE asiento_registro (
    id_asiento BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    numero_registro BIGINT NOT NULL UNIQUE DEFAULT nextval('seq_asiento_numero_registro'),
    fecha_ingreso TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    canal_ingreso VARCHAR(30) NOT NULL DEFAULT 'MESA_PRESENCIAL',
    asunto VARCHAR(500) NOT NULL,
    fk_expediente BIGINT NOT NULL,
    fk_remitente BIGINT NOT NULL,
    fk_destinatario BIGINT NULL,
    anulado BOOLEAN NOT NULL DEFAULT FALSE,
    motivo_anulacion TEXT NULL,

    CONSTRAINT chk_asiento_canal CHECK (canal_ingreso IN ('MESA_PRESENCIAL', 'MESA_VIRTUAL')),
    CONSTRAINT fk_asiento_expediente FOREIGN KEY (fk_expediente)
        REFERENCES expediente (id_expediente) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- =============================================================================
-- 9. FUNCIÓN: generar_cut_expediente(p_anio INT)
-- Genera CUT con formato EXP-YYYY-XXXXXX de forma atómica y segura
-- =============================================================================
CREATE OR REPLACE FUNCTION sigd_tra.generar_cut_expediente(p_anio INT)
RETURNS VARCHAR(20)
LANGUAGE plpgsql
AS $$
DECLARE
    v_secuencia INT;
    v_cut VARCHAR(20);
BEGIN
    -- Validar que el año fiscal tenga una secuencia registrada
    IF NOT EXISTS (SELECT 1 FROM secuencia_anual_cut WHERE anio_fiscal = p_anio) THEN
        INSERT INTO secuencia_anual_cut (anio_fiscal, secuencia) VALUES (p_anio, 100000);
    END IF;

    -- Obtener y avanzar la secuencia de forma atómica (nextval es thread-safe)
    SELECT nextval('seq_cut_expediente_anio') INTO v_secuencia;

    -- Formatear: EXP-YYYY-XXXXXX (6 dígitos con ceros a la izquierda)
    v_cut := 'EXP-' || p_anio || '-' || LPAD(v_secuencia::TEXT, 6, '0');

    -- Actualizar el último CUT generado en la tabla de secuencias
    UPDATE secuencia_anual_cut
    SET ultimo_cut_generado = v_cut, secuencia = v_secuencia
    WHERE anio_fiscal = p_anio;

    RETURN v_cut;
END;
$$;

GRANT EXECUTE ON FUNCTION sigd_tra.generar_cut_expediente(INT) TO PUBLIC;

-- =============================================================================
-- 10. ÍNDICES OPTIMIZADOS
-- =============================================================================
CREATE INDEX idx_tramite_remitente ON tramite(fk_remitente);
CREATE INDEX idx_expediente_tramite ON expediente(fk_tramite);
CREATE INDEX idx_expediente_acum_principal ON expediente_acumulacion(id_expediente_principal);
CREATE INDEX idx_expediente_acum_accesorio ON expediente_acumulacion(id_expediente_accesorio);
CREATE INDEX idx_folio_expediente ON expediente_documento_folio(id_expediente);
CREATE INDEX idx_asiento_expediente ON asiento_registro(fk_expediente);
CREATE INDEX idx_asiento_numero_registro ON asiento_registro(numero_registro);
CREATE INDEX idx_asiento_anulado ON asiento_registro(anulado) WHERE anulado = TRUE;

-- =============================================================================
-- 11. DATOS DE PRUEBA (NO OFICIALES - SOLO DEMOSTRATIVOS)
-- =============================================================================

-- Trámites
INSERT INTO tramite (codigo_tramite, asunto, estado, fk_remitente, fk_destinatario) VALUES
('TRM-2026-0001', 'Solicitud de Expedición de Título Profesional', 'EN_TRAMITE', 101, 301),
('TRM-2026-0002', 'Rectificación de Notas de Asignatura de Base de Datos', 'OBSERVADO', 102, 302),
('TRM-2026-0003', 'Mantenimiento preventivo de Servidores de Red', 'REGISTRADO', 103, 303),
('TRM-2026-0004', 'Solicitud Inválida con Error de Formato', 'ANULADO', 104, 301);

-- Expedientes (un trámite puede generar múltiples expedientes - 1:N)
INSERT INTO expediente (codigo_expediente, fk_tramite) VALUES
('EXP-2026-000001', 1),
('EXP-2026-000002', 1),
('EXP-2026-000003', 2),
('EXP-2026-000004', 3),
('EXP-2026-000005', 4);

-- Acumulación de expedientes (Art. 160 LPAG)
INSERT INTO expediente_acumulacion (id_expediente_principal, id_expediente_accesorio, acto_resolutivo, estado_acumulacion) VALUES
(1, 2, 'Acto Resolutivo N° 001-2026: Fusión de expedientes accesorios por conexidad jurídica', 'ACUMULADO'),
(4, 5, 'Acto Resolutivo N° 002-2026: Acumulación por vinculación administrativa', 'ACUMULADO');

-- Foliación digital
INSERT INTO expediente_documento_folio (id_expediente, id_documento, folio_inicio, folio_fin, total_folios) VALUES
(1, 101, 1, 5, 5),
(1, 102, 6, 12, 7),
(3, 201, 1, 3, 3),
(4, 301, 1, 10, 10);

-- Asientos de registro
INSERT INTO asiento_registro (canal_ingreso, asunto, fk_expediente, fk_remitente, fk_destinatario, anulado, motivo_anulacion) VALUES
('MESA_VIRTUAL', 'Solicitud de Expedición de Título Profesional', 1, 101, 301, FALSE, NULL),
('MESA_PRESENCIAL', 'Rectificación de Notas de Asignatura de Base de Datos', 3, 102, 302, FALSE, NULL),
('MESA_VIRTUAL', 'Mantenimiento preventivo de Servidores de Red', 4, 103, 303, FALSE, NULL),
('MESA_PRESENCIAL', 'Solicitud Inválida con Error de Formato', 5, 104, 301, TRUE, 'Registro duplicado por error material del operador');

-- Generar CUT de prueba
SELECT sigd_tra.generar_cut_expediente(2026);

COMMIT;
