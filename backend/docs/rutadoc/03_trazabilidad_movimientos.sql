-- ============================================================================
-- PROYECTO: Sistema Integral de Gestión Documentaria (SIGD)
-- MÓDULO: Grupo 1 — RutaDoc (Trazabilidad, recepción, derivación y atención)
-- ARCHIVO: 03_trazabilidad_movimientos.sql
-- RESPONSABLE: Jhasy (Rama: B_JHASY)
-- SGBD DE REFERENCIA: PostgreSQL 18.6
-- ESTADO: IMPLEMENTACIÓN TÉCNICA PROVISIONAL / VALIDACIÓN PENDIENTE
-- ============================================================================
-- Propósito:
-- Implementar físicamente las 12 entidades y 69 atributos aprobados en el modelo
-- lógico (02_modelo_datos_trazabilidad.md) y diccionario de datos (02_diccionario_datos_trazabilidad.md).
-- Garantiza la inmutabilidad histórica, el ordenamiento secuencial, la proyección
-- atómica del estado actual, el soporte de idempotencia y la compatibilidad de detalles.
--
-- NOTA IMPORTANTE:
-- Los catálogos y transiciones incluidos corresponden a EJEMPLOS PROPUESTOS para
-- validación académica. No se asumen como reglas institucionales oficiales.
-- Las referencias externas hacia los Grupos 2, 3, 4 y 5 se implementan como
-- identificadores sin claves foráneas físicas, a la espera de sus tablas propietarias.
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECCIÓN 1: LIMPIEZA PREVIA (DDL DOWN / IDEMPOTENCIA DE CREACIÓN)
-- ============================================================================

DROP TRIGGER IF EXISTS trg_inmutabilidad_movimiento ON movimiento_tramite;
DROP TRIGGER IF EXISTS trg_actualizar_estado_actual ON movimiento_tramite;
DROP TRIGGER IF EXISTS trg_validar_detalle_derivacion ON derivacion_tramite;
DROP TRIGGER IF EXISTS trg_validar_detalle_recepcion ON recepcion_tramite;
DROP TRIGGER IF EXISTS trg_validar_detalle_observacion ON observacion_tramite;
DROP TRIGGER IF EXISTS trg_validar_detalle_atencion ON atencion_tramite;

DROP FUNCTION IF EXISTS fn_impedir_mutacion_movimiento();
DROP FUNCTION IF EXISTS fn_proyectar_estado_actual();
DROP FUNCTION IF EXISTS fn_validar_compatibilidad_detalle();

DROP TABLE IF EXISTS estado_actual_tramite CASCADE;
DROP TABLE IF EXISTS movimiento_documento CASCADE;
DROP TABLE IF EXISTS relacion_movimiento CASCADE;
DROP TABLE IF EXISTS tipo_relacion_movimiento CASCADE;
DROP TABLE IF EXISTS atencion_tramite CASCADE;
DROP TABLE IF EXISTS observacion_tramite CASCADE;
DROP TABLE IF EXISTS recepcion_tramite CASCADE;
DROP TABLE IF EXISTS derivacion_tramite CASCADE;
DROP TABLE IF EXISTS transicion_estado_tramite CASCADE;
DROP TABLE IF EXISTS movimiento_tramite CASCADE;
DROP TABLE IF EXISTS estado_tramite CASCADE;
DROP TABLE IF EXISTS accion_tramite CASCADE;

-- ============================================================================
-- SECCIÓN 2: CREACIÓN DE TABLAS Y RESTRICCIONES (12 ENTIDADES / 69 ATRIBUTOS)
-- ============================================================================

-- 1. accion_tramite (Catálogo - 7 atributos)
CREATE TABLE accion_tramite (
    accion_tramite_id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo              VARCHAR(50) NOT NULL,
    nombre              VARCHAR(100) NOT NULL,
    descripcion         TEXT NOT NULL,
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    vigente_desde       TIMESTAMPTZ,
    vigente_hasta       TIMESTAMPTZ,
    CONSTRAINT uk_accion_tramite_codigo UNIQUE (codigo),
    CONSTRAINT ck_accion_tramite_vigencia CHECK (vigente_hasta IS NULL OR vigente_desde IS NULL OR vigente_hasta >= vigente_desde)
);

-- 2. estado_tramite (Catálogo - 8 atributos)
CREATE TABLE estado_tramite (
    estado_tramite_id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo              VARCHAR(50) NOT NULL,
    nombre              VARCHAR(100) NOT NULL,
    descripcion         TEXT NOT NULL,
    es_terminal         BOOLEAN NOT NULL DEFAULT FALSE,
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    vigente_desde       TIMESTAMPTZ,
    vigente_hasta       TIMESTAMPTZ,
    CONSTRAINT uk_estado_tramite_codigo UNIQUE (codigo),
    CONSTRAINT ck_estado_tramite_vigencia CHECK (vigente_hasta IS NULL OR vigente_desde IS NULL OR vigente_hasta >= vigente_desde)
);

-- 3. transicion_estado_tramite (Regla configurable - 8 atributos)
CREATE TABLE transicion_estado_tramite (
    transicion_estado_tramite_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    estado_anterior_id           BIGINT REFERENCES estado_tramite(estado_tramite_id) ON DELETE RESTRICT,
    accion_tramite_id            BIGINT NOT NULL REFERENCES accion_tramite(accion_tramite_id) ON DELETE RESTRICT,
    estado_resultante_id         BIGINT NOT NULL REFERENCES estado_tramite(estado_tramite_id) ON DELETE RESTRICT,
    condicion_descriptiva        TEXT,
    activo                       BOOLEAN NOT NULL DEFAULT TRUE,
    vigente_desde                TIMESTAMPTZ,
    vigente_hasta                TIMESTAMPTZ,
    CONSTRAINT uk_transicion_regla UNIQUE NULLS NOT DISTINCT (estado_anterior_id, accion_tramite_id, estado_resultante_id),
    CONSTRAINT ck_transicion_vigencia CHECK (vigente_hasta IS NULL OR vigente_desde IS NULL OR vigente_hasta >= vigente_desde)
);

-- 4. movimiento_tramite (Entidad Principal - 12 atributos)
CREATE TABLE movimiento_tramite (
    movimiento_id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    expediente_id               VARCHAR(64) NOT NULL, -- REF externa Grupo 2
    secuencia                   INTEGER NOT NULL,
    accion_tramite_id           BIGINT NOT NULL REFERENCES accion_tramite(accion_tramite_id) ON DELETE RESTRICT,
    transicion_estado_tramite_id BIGINT REFERENCES transicion_estado_tramite(transicion_estado_tramite_id) ON DELETE RESTRICT,
    estado_anterior_id          BIGINT REFERENCES estado_tramite(estado_tramite_id) ON DELETE RESTRICT,
    estado_resultante_id        BIGINT NOT NULL REFERENCES estado_tramite(estado_tramite_id) ON DELETE RESTRICT,
    usuario_actor_id            VARCHAR(64), -- REF externa Grupo 4
    area_contexto_id            VARCHAR(64), -- REF externa Grupo 3
    fecha_hora                  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    observacion                 TEXT,
    clave_idempotencia          VARCHAR(128),
    CONSTRAINT uk_movimiento_expediente_secuencia UNIQUE (expediente_id, secuencia),
    CONSTRAINT uk_movimiento_idempotencia UNIQUE (expediente_id, clave_idempotencia),
    CONSTRAINT ck_movimiento_secuencia_positiva CHECK (secuencia > 0)
);

-- 5. derivacion_tramite (Detalle opcional - 4 atributos)
CREATE TABLE derivacion_tramite (
    movimiento_id       BIGINT PRIMARY KEY REFERENCES movimiento_tramite(movimiento_id) ON DELETE RESTRICT,
    area_origen_id      VARCHAR(64) NOT NULL, -- REF externa Grupo 3
    area_destino_id     VARCHAR(64) NOT NULL, -- REF externa Grupo 3
    motivo              TEXT NOT NULL,
    CONSTRAINT ck_derivacion_areas_distintas CHECK (area_origen_id <> area_destino_id)
);

-- 6. recepcion_tramite (Detalle opcional - 4 atributos)
CREATE TABLE recepcion_tramite (
    movimiento_id           BIGINT PRIMARY KEY REFERENCES movimiento_tramite(movimiento_id) ON DELETE RESTRICT,
    derivacion_movimiento_id BIGINT REFERENCES movimiento_tramite(movimiento_id) ON DELETE RESTRICT,
    area_receptora_id       VARCHAR(64), -- REF externa Grupo 3
    observacion_recepcion   TEXT,
    CONSTRAINT uk_recepcion_derivacion_unica UNIQUE (derivacion_movimiento_id)
);

-- 7. observacion_tramite (Detalle opcional - 3 atributos)
CREATE TABLE observacion_tramite (
    movimiento_id       BIGINT PRIMARY KEY REFERENCES movimiento_tramite(movimiento_id) ON DELETE RESTRICT,
    motivo              VARCHAR(200) NOT NULL,
    detalle             TEXT
);

-- 8. atencion_tramite (Detalle opcional - 2 atributos)
CREATE TABLE atencion_tramite (
    movimiento_id       BIGINT PRIMARY KEY REFERENCES movimiento_tramite(movimiento_id) ON DELETE RESTRICT,
    resultado_resumen   TEXT NOT NULL
);

-- 9. tipo_relacion_movimiento (Catálogo - 5 atributos)
CREATE TABLE tipo_relacion_movimiento (
    tipo_relacion_movimiento_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo                      VARCHAR(50) NOT NULL,
    nombre                      VARCHAR(100) NOT NULL,
    descripcion                 TEXT NOT NULL,
    activo                      BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uk_tipo_relacion_codigo UNIQUE (codigo)
);

-- 10. relacion_movimiento (Asociación N:M - 6 atributos)
CREATE TABLE relacion_movimiento (
    relacion_movimiento_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    movimiento_origen_id        BIGINT NOT NULL REFERENCES movimiento_tramite(movimiento_id) ON DELETE RESTRICT,
    movimiento_destino_id       BIGINT NOT NULL REFERENCES movimiento_tramite(movimiento_id) ON DELETE RESTRICT,
    tipo_relacion_movimiento_id BIGINT NOT NULL REFERENCES tipo_relacion_movimiento(tipo_relacion_movimiento_id) ON DELETE RESTRICT,
    motivo                      TEXT,
    registrado_en               TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_relacion_movimiento UNIQUE (movimiento_origen_id, movimiento_destino_id, tipo_relacion_movimiento_id),
    CONSTRAINT ck_relacion_movimientos_distintos CHECK (movimiento_origen_id <> movimiento_destino_id)
);

-- 11. movimiento_documento (Asociación externa N:M - 4 atributos)
CREATE TABLE movimiento_documento (
    movimiento_id       BIGINT NOT NULL REFERENCES movimiento_tramite(movimiento_id) ON DELETE RESTRICT,
    documento_id        VARCHAR(64) NOT NULL, -- REF externa Grupo 5
    finalidad           VARCHAR(50) NOT NULL,
    version_documento_id VARCHAR(64), -- REF externa Grupo 5
    CONSTRAINT uk_movimiento_documento UNIQUE NULLS NOT DISTINCT (movimiento_id, documento_id, version_documento_id, finalidad)
);

-- 12. estado_actual_tramite (Proyección opcional derivada - 6 atributos)
CREATE TABLE estado_actual_tramite (
    expediente_id       VARCHAR(64) PRIMARY KEY, -- REF externa Grupo 2
    movimiento_actual_id BIGINT NOT NULL REFERENCES movimiento_tramite(movimiento_id) ON DELETE RESTRICT,
    estado_actual_id    BIGINT NOT NULL REFERENCES estado_tramite(estado_tramite_id) ON DELETE RESTRICT,
    secuencia_actual    INTEGER NOT NULL,
    actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version_proyeccion  INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT ck_estado_actual_secuencia CHECK (secuencia_actual > 0),
    CONSTRAINT ck_estado_actual_version CHECK (version_proyeccion > 0)
);

-- ============================================================================
-- SECCIÓN 3: ÍNDICES DE RENDIMIENTO Y ACCESO
-- ============================================================================

CREATE INDEX idx_movimiento_expediente ON movimiento_tramite(expediente_id, secuencia ASC);
CREATE INDEX idx_movimiento_fecha ON movimiento_tramite(fecha_hora);
CREATE INDEX idx_movimiento_actor ON movimiento_tramite(usuario_actor_id) WHERE usuario_actor_id IS NOT NULL;
CREATE INDEX idx_movimiento_area ON movimiento_tramite(area_contexto_id) WHERE area_contexto_id IS NOT NULL;
CREATE INDEX idx_movimiento_estado_res ON movimiento_tramite(estado_resultante_id);
CREATE INDEX idx_derivacion_origen_destino ON derivacion_tramite(area_origen_id, area_destino_id);
CREATE INDEX idx_recepcion_derivacion ON recepcion_tramite(derivacion_movimiento_id);
CREATE INDEX idx_relacion_origen ON relacion_movimiento(movimiento_origen_id);
CREATE INDEX idx_relacion_destino ON relacion_movimiento(movimiento_destino_id);
CREATE INDEX idx_movimiento_doc_documento ON movimiento_documento(documento_id);

-- ============================================================================
-- SECCIÓN 4: TRIGGERS Y FUNCIONES DE INTEGRIDAD Y PROYECCIÓN
-- ============================================================================

-- 4.1 Inmutabilidad del historial
CREATE OR REPLACE FUNCTION fn_impedir_mutacion_movimiento()
RETURNS TRIGGER AS 
BEGIN
    RAISE EXCEPTION 'Operación no permitida: Los registros de movimiento_tramite son inmutables por principio de trazabilidad histórica.'
        USING ERRCODE = 'restrict_violation';
END;
 LANGUAGE plpgsql;

CREATE TRIGGER trg_inmutabilidad_movimiento
    BEFORE UPDATE OR DELETE ON movimiento_tramite
    FOR EACH ROW
    EXECUTE FUNCTION fn_impedir_mutacion_movimiento();

-- 4.2 Proyección atómica del estado actual
CREATE OR REPLACE FUNCTION fn_proyectar_estado_actual()
RETURNS TRIGGER AS 
BEGIN
    INSERT INTO estado_actual_tramite (
        expediente_id,
        movimiento_actual_id,
        estado_actual_id,
        secuencia_actual,
        actualizado_en,
        version_proyeccion
    )
    VALUES (
        NEW.expediente_id,
        NEW.movimiento_id,
        NEW.estado_resultante_id,
        NEW.secuencia,
        NEW.fecha_hora,
        1
    )
    ON CONFLICT (expediente_id) DO UPDATE SET
        movimiento_actual_id = EXCLUDED.movimiento_actual_id,
        estado_actual_id    = EXCLUDED.estado_actual_id,
        secuencia_actual    = EXCLUDED.secuencia_actual,
        actualizado_en      = EXCLUDED.actualizado_en,
        version_proyeccion  = estado_actual_tramite.version_proyeccion + 1
    WHERE EXCLUDED.secuencia_actual >= estado_actual_tramite.secuencia_actual;

    RETURN NEW;
END;
 LANGUAGE plpgsql;

CREATE TRIGGER trg_actualizar_estado_actual
    AFTER INSERT ON movimiento_tramite
    FOR EACH ROW
    EXECUTE FUNCTION fn_proyectar_estado_actual();

-- 4.3 Validación de compatibilidad entre acción y detalle especializado
CREATE OR REPLACE FUNCTION fn_validar_compatibilidad_detalle()
RETURNS TRIGGER AS 
DECLARE
    v_codigo_accion VARCHAR(50);
BEGIN
    SELECT a.codigo INTO v_codigo_accion
    FROM movimiento_tramite m
    JOIN accion_tramite a ON a.accion_tramite_id = m.accion_tramite_id
    WHERE m.movimiento_id = NEW.movimiento_id;

    IF TG_TABLE_NAME = 'derivacion_tramite' AND v_codigo_accion NOT IN ('DERIVACION', 'DEVOLUCION') THEN
        RAISE EXCEPTION 'Incompatibilidad: detalle derivacion_tramite solo aplica a acciones DERIVACION o DEVOLUCION (acción actual: %)', v_codigo_accion;
    ELSIF TG_TABLE_NAME = 'recepcion_tramite' AND v_codigo_accion NOT IN ('RECEPCION', 'REGISTRO_EXTERNO') THEN
        RAISE EXCEPTION 'Incompatibilidad: detalle recepcion_tramite solo aplica a acción RECEPCION (acción actual: %)', v_codigo_accion;
    ELSIF TG_TABLE_NAME = 'observacion_tramite' AND v_codigo_accion <> 'OBSERVACION' THEN
        RAISE EXCEPTION 'Incompatibilidad: detalle observacion_tramite solo aplica a acción OBSERVACION (acción actual: %)', v_codigo_accion;
    ELSIF TG_TABLE_NAME = 'atencion_tramite' AND v_codigo_accion <> 'ATENCION' THEN
        RAISE EXCEPTION 'Incompatibilidad: detalle atencion_tramite solo aplica a acción ATENCION (acción actual: %)', v_codigo_accion;
    END IF;

    RETURN NEW;
END;
 LANGUAGE plpgsql;

CREATE TRIGGER trg_validar_detalle_derivacion
    BEFORE INSERT OR UPDATE ON derivacion_tramite
    FOR EACH ROW EXECUTE FUNCTION fn_validar_compatibilidad_detalle();

CREATE TRIGGER trg_validar_detalle_recepcion
    BEFORE INSERT OR UPDATE ON recepcion_tramite
    FOR EACH ROW EXECUTE FUNCTION fn_validar_compatibilidad_detalle();

CREATE TRIGGER trg_validar_detalle_observacion
    BEFORE INSERT OR UPDATE ON observacion_tramite
    FOR EACH ROW EXECUTE FUNCTION fn_validar_compatibilidad_detalle();

CREATE TRIGGER trg_validar_detalle_atencion
    BEFORE INSERT OR UPDATE ON atencion_tramite
    FOR EACH ROW EXECUTE FUNCTION fn_validar_compatibilidad_detalle();

-- ============================================================================
-- SECCIÓN 5: CARGA DE CATÁLOGOS Y TRANSICIONES (EJEMPLOS PROPUESTOS)
-- ============================================================================

-- 5.1 Catálogo de Acciones (13 acciones propuestas)
INSERT INTO accion_tramite (codigo, nombre, descripcion, activo) VALUES
('REGISTRO_EXTERNO',     'Registro externo',          'Ingreso inicial del expediente desde el Grupo 2', TRUE),
('RECEPCION',            'Recepción',                 'Confirmación de recepción inicial o en destino', TRUE),
('INICIAR_REVISION',     'Iniciar revisión',          'Inicio de evaluación de información y requisitos', TRUE),
('OBSERVACION',          'Observación',               'Registro de observación por requisitos faltantes', TRUE),
('CORRECCION',           'Corrección',                'Registro de subsanación o corrección aportada', TRUE),
('INCORPORACION_ADJUNTO','Incorporación de adjunto',  'Vinculación de documento o adjunto complementario', TRUE),
('DERIVACION',           'Derivación',                'Traslado del trámite hacia otra área', TRUE),
('DEVOLUCION',           'Devolución',                'Retorno justificado a un área previa', TRUE),
('INICIAR_ATENCION',     'Iniciar atención',          'Inicio de preparación de respuesta o resolución', TRUE),
('ATENCION',             'Atención y respuesta',      'Registro de la respuesta final del trámite', TRUE),
('CIERRE',               'Cierre',                    'Finalización formal del flujo activo', TRUE),
('REAPERTURA',           'Reapertura',                'Reanudación autorizada de un trámite cerrado', TRUE),
('RECTIFICACION',        'Rectificación',             'Corrección de un movimiento previo sin borrarlo', TRUE);

-- 5.2 Catálogo de Estados (10 estados propuestos)
INSERT INTO estado_tramite (codigo, nombre, descripcion, es_terminal, activo) VALUES
('REGISTRADO',          'Registrado',                'Expediente registrado externamente', FALSE, TRUE),
('PENDIENTE_RECEPCION', 'Pendiente de recepción',    'Derivado a la espera de confirmación de destino', FALSE, TRUE),
('RECIBIDO',            'Recibido',                  'Recepción confirmada en área correspondiente', FALSE, TRUE),
('EN_REVISION',         'En revisión',               'Evaluación en curso en área competente', FALSE, TRUE),
('OBSERVADO',           'Observado',                 'Requiere corrección o subsanación', FALSE, TRUE),
('EN_ATENCION',         'En atención',               'Preparación de resolución en curso', FALSE, TRUE),
('ATENDIDO',            'Atendido',                  'Respuesta final registrada', FALSE, TRUE),
('CERRADO',             'Cerrado',                   'Flujo activo concluido formalmente', TRUE, TRUE),
('REABIERTO',           'Reabierto',                 'Trámite reactivado para nueva revisión', FALSE, TRUE),
('DEVUELTO',            'Devuelto',                  'Retornado a un área u origen previo', FALSE, TRUE);

-- 5.3 Catálogo de Tipos de Relación (5 tipos propuestos)
INSERT INTO tipo_relacion_movimiento (codigo, nombre, descripcion, activo) VALUES
('RECTIFICA',           'Rectifica',                 'Corrige el contenido o contexto de un movimiento previo', TRUE),
('SUBSANA',             'Subsana',                   'Responde y corrige una observación previa', TRUE),
('CONFIRMA_DERIVACION', 'Confirma derivación',       'Recepción que valida un traslado previo', TRUE),
('REABRE',              'Reabre',                    'Reapertura asociada a un cierre anterior', TRUE),
('RESPONDE_A',          'Responde a',                'Atención vinculada a una solicitud específica', TRUE);

-- 5.4 Matriz preliminar de transiciones (13 transiciones propuestas)
INSERT INTO transicion_estado_tramite (estado_anterior_id, accion_tramite_id, estado_resultante_id, condicion_descriptiva)
VALUES
(NULL, 
 (SELECT accion_tramite_id FROM accion_tramite WHERE codigo = 'REGISTRO_EXTERNO'),
 (SELECT estado_tramite_id FROM estado_tramite WHERE codigo = 'REGISTRADO'),
 'Registro externo inicial sin estado local previo'),

((SELECT estado_tramite_id FROM estado_tramite WHERE codigo = 'REGISTRADO'),
 (SELECT accion_tramite_id FROM accion_tramite WHERE codigo = 'RECEPCION'),
 (SELECT estado_tramite_id FROM estado_tramite WHERE codigo = 'RECIBIDO'),
 'Recepción inicial confirmada'),

((SELECT estado_tramite_id FROM estado_tramite WHERE codigo = 'PENDIENTE_RECEPCION'),
 (SELECT accion_tramite_id FROM accion_tramite WHERE codigo = 'RECEPCION'),
 (SELECT estado_tramite_id FROM estado_tramite WHERE codigo = 'RECIBIDO'),
 'Confirmación de llegada en área destinataria'),

((SELECT estado_tramite_id FROM estado_tramite WHERE codigo = 'RECIBIDO'),
 (SELECT accion_tramite_id FROM accion_tramite WHERE codigo = 'INICIAR_REVISION'),
 (SELECT estado_tramite_id FROM estado_tramite WHERE codigo = 'EN_REVISION'),
 'Inicio de evaluación en área responsable'),

((SELECT estado_tramite_id FROM estado_tramite WHERE codigo = 'EN_REVISION'),
 (SELECT accion_tramite_id FROM accion_tramite WHERE codigo = 'OBSERVACION'),
 (SELECT estado_tramite_id FROM estado_tramite WHERE codigo = 'OBSERVADO'),
 'Identificación de requisitos o datos incompletos'),

((SELECT estado_tramite_id FROM estado_tramite WHERE codigo = 'OBSERVADO'),
 (SELECT accion_tramite_id FROM accion_tramite WHERE codigo = 'CORRECCION'),
 (SELECT estado_tramite_id FROM estado_tramite WHERE codigo = 'EN_REVISION'),
 'Corrección aportada para reanudar revisión'),

((SELECT estado_tramite_id FROM estado_tramite WHERE codigo = 'EN_REVISION'),
 (SELECT accion_tramite_id FROM accion_tramite WHERE codigo = 'DERIVACION'),
 (SELECT estado_tramite_id FROM estado_tramite WHERE codigo = 'PENDIENTE_RECEPCION'),
 'Traslado hacia otra área competente'),

((SELECT estado_tramite_id FROM estado_tramite WHERE codigo = 'EN_REVISION'),
 (SELECT accion_tramite_id FROM accion_tramite WHERE codigo = 'DEVOLUCION'),
 (SELECT estado_tramite_id FROM estado_tramite WHERE codigo = 'PENDIENTE_RECEPCION'),
 'Retorno justificado a origen previo'),

((SELECT estado_tramite_id FROM estado_tramite WHERE codigo = 'EN_REVISION'),
 (SELECT accion_tramite_id FROM accion_tramite WHERE codigo = 'INICIAR_ATENCION'),
 (SELECT estado_tramite_id FROM estado_tramite WHERE codigo = 'EN_ATENCION'),
 'Inicio de resolución en área competente'),

((SELECT estado_tramite_id FROM estado_tramite WHERE codigo = 'EN_ATENCION'),
 (SELECT accion_tramite_id FROM accion_tramite WHERE codigo = 'ATENCION'),
 (SELECT estado_tramite_id FROM estado_tramite WHERE codigo = 'ATENDIDO'),
 'Registro de la respuesta final del trámite'),

((SELECT estado_tramite_id FROM estado_tramite WHERE codigo = 'ATENDIDO'),
 (SELECT accion_tramite_id FROM accion_tramite WHERE codigo = 'CIERRE'),
 (SELECT estado_tramite_id FROM estado_tramite WHERE codigo = 'CERRADO'),
 'Cierre formal tras verificar respuesta'),

((SELECT estado_tramite_id FROM estado_tramite WHERE codigo = 'CERRADO'),
 (SELECT accion_tramite_id FROM accion_tramite WHERE codigo = 'REAPERTURA'),
 (SELECT estado_tramite_id FROM estado_tramite WHERE codigo = 'REABIERTO'),
 'Reactivación justificada de trámite cerrado'),

((SELECT estado_tramite_id FROM estado_tramite WHERE codigo = 'REABIERTO'),
 (SELECT accion_tramite_id FROM accion_tramite WHERE codigo = 'INICIAR_REVISION'),
 (SELECT estado_tramite_id FROM estado_tramite WHERE codigo = 'EN_REVISION'),
 'Reingreso a revisión tras reapertura');

COMMIT;
