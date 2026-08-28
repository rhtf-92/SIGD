
-- 1. Tabla EXPEDIENTE (Contenedor principal)
CREATE TABLE IF NOT EXISTS expediente (
    id_expediente BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo_expediente VARCHAR(30) NOT NULL UNIQUE,
    asunto VARCHAR(255) NOT NULL,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 2. Tabla ASIENTO_REGISTRO (Entrada/Salida oficial con numeración segura y FKs)
CREATE TABLE IF NOT EXISTS asiento_registro (
    id_asiento BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    numero_registro VARCHAR(30) NOT NULL UNIQUE, -- Correlativo generado secuencialmente
    id_expediente BIGINT NOT NULL,
    id_remitente BIGINT NOT NULL,   -- Referencia por FK (sin repetir DNI/nombres)
    id_destinatario BIGINT NOT NULL,-- Referencia por FK (sin repetir DNI/nombres)
    tipo_asiento VARCHAR(20) NOT NULL CHECK (tipo_asiento IN ('ENTRADA', 'SALIDA')),
    anulado BOOLEAN DEFAULT FALSE NOT NULL,
    fecha_ingreso TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_asiento_expediente FOREIGN KEY (id_expediente) 
        REFERENCES expediente (id_expediente) ON DELETE RESTRICT
);

-- 3. Tabla TRAMITE (Flujo interno del documento)
CREATE TABLE IF NOT EXISTS tramite (
    id_tramite BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_expediente BIGINT NOT NULL,
    id_asiento BIGINT,
    estado VARCHAR(30) DEFAULT 'registrado' NOT NULL CHECK (estado IN ('registrado', 'en_proceso', 'atendido', 'observado')),
    anulado BOOLEAN DEFAULT FALSE NOT NULL,
    fecha_registro TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_tramite_expediente FOREIGN KEY (id_expediente) 
        REFERENCES expediente (id_expediente) ON DELETE CASCADE,
    CONSTRAINT fk_tramite_asiento FOREIGN KEY (id_asiento) 
        REFERENCES asiento_registro (id_asiento) ON DELETE SET NULL
);

-- 4. ÍNDICES DE OPTIMIZACIÓN (Justificados para búsquedas frecuentes)
CREATE INDEX IF NOT EXISTS idx_expediente_codigo ON expediente(codigo_expediente);
CREATE INDEX IF NOT EXISTS idx_asiento_fecha_ingreso ON asiento_registro(fecha_ingreso);
CREATE INDEX IF NOT EXISTS idx_tramite_estado ON tramite(estado);

-- 5. DATOS FICTICIOS DE PRUEBA (Ejemplo)
INSERT INTO expediente (codigo_expediente, asunto) VALUES 
('EXP-2026-001', 'Solicitud de Certificado de Estudios');

INSERT INTO asiento_registro (numero_registro, id_expediente, id_remitente, id_destinatario, tipo_asiento) VALUES 
('REG-2026-0001', 1, 101, 201, 'ENTRADA');

INSERT INTO tramite (id_expediente, id_asiento, estado) VALUES 
(1, 1, 'registrado');