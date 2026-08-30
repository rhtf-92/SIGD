-- =========================================================================
-- MÓDULO IDENTICORE - BORRADOR SQL PROVISIONAL (PostgreSQL 18.6)
-- Responsable: Segundo (Rama B_SEGUNDO)
-- Nota: Estructura preliminar sujeta a confirmación institucional oficial.
-- =========================================================================

-- Eliminar tablas si existen en orden inverso para evitar conflictos de FK
DROP TABLE IF EXISTS auditoria_usuarios CASCADE;
DROP TABLE IF EXISTS persona_documento_historial CASCADE;
DROP TABLE IF EXISTS perfil_usuario CASCADE;
DROP TABLE IF EXISTS cuenta_usuario CASCADE;
DROP TABLE IF EXISTS personas CASCADE;
DROP TABLE IF EXISTS tipos_documento CASCADE;

-- 1. Catálogo de Tipos de Documento (Ejemplo preliminar)
CREATE TABLE tipos_documento (
    tipo_documento_id SERIAL PRIMARY KEY,
    codigo VARCHAR(10) UNIQUE NOT NULL, -- Ej: DNI, CE, PAS
    nombre_documento VARCHAR(50) NOT NULL,
    longitud_exacta INT,
    estado_activo BOOLEAN DEFAULT TRUE
);

-- 2. Entidad Persona (Identidad Civil - Sin usar DNI como PK técnica)
CREATE TABLE personas (
    persona_id BIGSERIAL PRIMARY KEY,
    nombres VARCHAR(100) NOT NULL,
    apellido_paterno VARCHAR(80) NOT NULL,
    apellido_materno VARCHAR(80),
    correo_contacto VARCHAR(120),
    telefono_contacto VARCHAR(30),
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Historial o asociación de documentos por persona (Soporta múltiples tipos de documento)
CREATE TABLE persona_documento_historial (
    documento_historial_id BIGSERIAL PRIMARY KEY,
    persona_id BIGINT NOT NULL REFERENCES personas(persona_id) ON DELETE CASCADE,
    tipo_documento_id INT NOT NULL REFERENCES tipos_documento(tipo_documento_id),
    numero_documento VARCHAR(30) NOT NULL,
    es_principal BOOLEAN DEFAULT TRUE,
    CONSTRAINT uk_persona_documento UNIQUE (tipo_documento_id, numero_documento)
);

-- 4. Cuenta de Usuario (Credenciales y Autenticación)
CREATE TABLE cuenta_usuario (
    cuenta_id BIGSERIAL PRIMARY KEY,
    persona_id BIGINT NOT NULL REFERENCES personas(persona_id) ON DELETE CASCADE,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL, -- Almacenamiento seguro por hash, nunca texto plano
    es_externo BOOLEAN NOT NULL DEFAULT FALSE, -- FALSE = Interno, TRUE = Externo registrado
    activo BOOLEAN DEFAULT TRUE,
    ultimo_acceso TIMESTAMP
);

-- 5. Perfil de Usuario (Vinculación institucional / Roles - Referencia conceptual al Grupo 3)
CREATE TABLE perfil_usuario (
    perfil_id BIGSERIAL PRIMARY KEY,
    cuenta_id BIGINT NOT NULL REFERENCES cuenta_usuario(cuenta_id) ON DELETE CASCADE,
    -- Referencias lógicas / conceptuales hacia OrganiCore (Grupo 3) y otras áreas
    area_id_ref INT, 
    cargo_id_ref INT,
    rol_id_ref INT,
    estado_vinculo VARCHAR(30) DEFAULT 'CONFIRMADO' -- Ej: CONFIRMADO, PROPUESTO, PENDIENTE, CESADO
);

-- 6. Auditoría básica de cambios en usuarios
CREATE TABLE auditoria_usuarios (
    auditoria_id BIGSERIAL PRIMARY KEY,
    cuenta_afectada_id BIGINT REFERENCES cuenta_usuario(cuenta_id),
    accion VARCHAR(50) NOT NULL,
    detalles TEXT,
    realizado_por VARCHAR(50),
    fecha_accion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- DATOS DE PRUEBA FICTICIOS (No oficiales)
-- =========================================================================

-- Insertar tipos de documentos de ejemplo
INSERT INTO tipos_documento (codigo, nombre_documento, longitud_exacta) VALUES 
('DNI', 'Documento Nacional de Identidad', 8),
('CE', 'Carné de Extranjería', 9),
('PAS', 'Pasaporte', 12);

-- Insertar personas ficticias
INSERT INTO personas (nombres, apellido_paterno, apellido_materno, correo_contacto, telefono_contacto) VALUES 
('Funcionario', 'Prueba', 'Interno', 'interno.prueba@sigd.gob.pe', '999888777'),
('Ciudadano', 'Solicitante', 'Externo', 'ciudadano.externo@gmail.com', '988777666');

-- Insertar documentos asociados a las personas
INSERT INTO persona_documento_historial (persona_id, tipo_documento_id, numero_documento, es_principal) VALUES 
(1, 1, '87654321', TRUE),
(2, 1, '12345678', TRUE);

-- Insertar cuentas de usuario (una interna y una externa)
INSERT INTO cuenta_usuario (persona_id, username, password_hash, es_externo, activo) VALUES 
(1, 'fprueba_int', '$2b$12$DummyHashForTestingPurposesOnlyNotReal12345', FALSE, TRUE),
(2, 'csolicitante_ext', '$2b$12$DummyHashForTestingPurposesOnlyNotReal12345', TRUE, TRUE);

-- Insertar perfil institucional para el usuario interno
INSERT INTO perfil_usuario (cuenta_id, area_id_ref, cargo_id_ref, rol_id_ref, estado_vinculo) VALUES 
(1, 101, 5, 2, 'CONFIRMADO');