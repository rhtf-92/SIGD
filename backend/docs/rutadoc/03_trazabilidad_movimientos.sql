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
-- SECCIÓN 1: PRECONDICIONES DE INSTALACIÓN
-- ============================================================================

-- PRECONDICION: este archivo requiere un esquema vacio. No contiene desmontaje
-- automatico ni DROP ... CASCADE. Toda limpieza debe ejecutarse fuera de este
-- archivo, por un operador, despues de comprobar expresamente que la conexion
-- corresponde a una base desechable de pruebas.

-- Necesaria para excluir vigencias solapadas sin agregar atributos al modelo.
CREATE EXTENSION IF NOT EXISTS btree_gist;

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
    CONSTRAINT ck_transicion_vigencia CHECK (vigente_hasta IS NULL OR vigente_desde IS NULL OR vigente_hasta > vigente_desde),
    CONSTRAINT ex_transicion_regla_vigencia EXCLUDE USING gist (
        (COALESCE(estado_anterior_id, 0::BIGINT)) WITH =,
        accion_tramite_id WITH =,
        estado_resultante_id WITH =,
        (tstzrange(COALESCE(vigente_desde, '-infinity'::TIMESTAMPTZ),
                   COALESCE(vigente_hasta, 'infinity'::TIMESTAMPTZ), '[)')) WITH &&
    )
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
    CONSTRAINT uk_movimiento_proyeccion UNIQUE (expediente_id, movimiento_id, estado_resultante_id, secuencia),
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
    movimiento_actual_id BIGINT NOT NULL,
    estado_actual_id    BIGINT NOT NULL REFERENCES estado_tramite(estado_tramite_id) ON DELETE RESTRICT,
    secuencia_actual    INTEGER NOT NULL,
    actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version_proyeccion  INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT fk_estado_actual_movimiento_coherente
        FOREIGN KEY (expediente_id, movimiento_actual_id, estado_actual_id, secuencia_actual)
        REFERENCES movimiento_tramite (expediente_id, movimiento_id, estado_resultante_id, secuencia)
        ON DELETE RESTRICT,
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
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Operación no permitida: Los registros de movimiento_tramite son inmutables por principio de trazabilidad histórica.'
        USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_inmutabilidad_movimiento
    BEFORE UPDATE OR DELETE ON movimiento_tramite
    FOR EACH ROW
    EXECUTE FUNCTION fn_impedir_mutacion_movimiento();

-- 4.2 Proyección atómica del estado actual
CREATE OR REPLACE FUNCTION fn_proyectar_estado_actual()
RETURNS TRIGGER AS $$
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
    WHERE EXCLUDED.secuencia_actual > estado_actual_tramite.secuencia_actual;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_actualizar_estado_actual
    AFTER INSERT ON movimiento_tramite
    FOR EACH ROW
    EXECUTE FUNCTION fn_proyectar_estado_actual();

-- 4.3 Validación de compatibilidad entre acción y detalle especializado
CREATE OR REPLACE FUNCTION fn_validar_compatibilidad_detalle()
RETURNS TRIGGER AS $$
DECLARE
    v_codigo_accion VARCHAR(50);
    v_expediente_id VARCHAR(64);
    v_secuencia INTEGER;
    v_estado_anterior VARCHAR(50);
    v_derivacion_expediente VARCHAR(64);
    v_derivacion_secuencia INTEGER;
    v_derivacion_accion VARCHAR(50);
    v_area_destino VARCHAR(64);
BEGIN
    SELECT a.codigo, m.expediente_id, m.secuencia, ea.codigo
      INTO v_codigo_accion, v_expediente_id, v_secuencia, v_estado_anterior
    FROM movimiento_tramite m
    JOIN accion_tramite a ON a.accion_tramite_id = m.accion_tramite_id
    LEFT JOIN estado_tramite ea ON ea.estado_tramite_id = m.estado_anterior_id
    WHERE m.movimiento_id = NEW.movimiento_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El movimiento % no existe', NEW.movimiento_id;
    END IF;

    IF TG_TABLE_NAME = 'derivacion_tramite' AND v_codigo_accion NOT IN ('DERIVACION', 'DEVOLUCION') THEN
        RAISE EXCEPTION 'Incompatibilidad: detalle derivacion_tramite solo aplica a acciones DERIVACION o DEVOLUCION (acción actual: %)', v_codigo_accion;
    ELSIF TG_TABLE_NAME = 'recepcion_tramite' AND v_codigo_accion NOT IN ('RECEPCION', 'REGISTRO_EXTERNO') THEN
        RAISE EXCEPTION 'Incompatibilidad: detalle recepcion_tramite solo aplica a acción RECEPCION (acción actual: %)', v_codigo_accion;
    ELSIF TG_TABLE_NAME = 'observacion_tramite' AND v_codigo_accion <> 'OBSERVACION' THEN
        RAISE EXCEPTION 'Incompatibilidad: detalle observacion_tramite solo aplica a acción OBSERVACION (acción actual: %)', v_codigo_accion;
    ELSIF TG_TABLE_NAME = 'atencion_tramite' AND v_codigo_accion <> 'ATENCION' THEN
        RAISE EXCEPTION 'Incompatibilidad: detalle atencion_tramite solo aplica a acción ATENCION (acción actual: %)', v_codigo_accion;
    END IF;

    IF TG_TABLE_NAME = 'recepcion_tramite' THEN
        IF v_estado_anterior = 'PENDIENTE_RECEPCION' AND NEW.derivacion_movimiento_id IS NULL THEN
            RAISE EXCEPTION 'Una recepcion posterior a derivacion debe indicar derivacion_movimiento_id';
        END IF;

        IF NEW.derivacion_movimiento_id IS NOT NULL THEN
            SELECT dm.expediente_id, dm.secuencia, da.codigo, d.area_destino_id
              INTO v_derivacion_expediente, v_derivacion_secuencia,
                   v_derivacion_accion, v_area_destino
            FROM movimiento_tramite dm
            JOIN accion_tramite da ON da.accion_tramite_id = dm.accion_tramite_id
            JOIN derivacion_tramite d ON d.movimiento_id = dm.movimiento_id
            WHERE dm.movimiento_id = NEW.derivacion_movimiento_id;

            IF NOT FOUND OR v_derivacion_accion NOT IN ('DERIVACION', 'DEVOLUCION') THEN
                RAISE EXCEPTION 'La recepcion debe vincular una derivacion o devolucion valida';
            END IF;
            IF v_derivacion_expediente <> v_expediente_id THEN
                RAISE EXCEPTION 'La recepcion y la derivacion deben pertenecer al mismo expediente';
            END IF;
            IF v_derivacion_secuencia >= v_secuencia THEN
                RAISE EXCEPTION 'La derivacion vinculada debe ser anterior a la recepcion';
            END IF;
            IF NEW.area_receptora_id IS NULL OR NEW.area_receptora_id <> v_area_destino THEN
                RAISE EXCEPTION 'El area receptora debe coincidir con el destino de la derivacion';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

-- 4.4 Coherencia secuencial, transicion aplicable y cierre posterior a atencion
CREATE OR REPLACE FUNCTION fn_validar_movimiento()
RETURNS TRIGGER AS $$
DECLARE
    v_ultima_secuencia INTEGER;
    v_ultimo_estado BIGINT;
    v_accion_codigo VARCHAR(50);
    v_transicion_valida BOOLEAN;
    v_tiene_atencion BOOLEAN;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.expediente_id, 0));

    SELECT secuencia, estado_resultante_id
      INTO v_ultima_secuencia, v_ultimo_estado
    FROM movimiento_tramite
    WHERE expediente_id = NEW.expediente_id
    ORDER BY secuencia DESC
    LIMIT 1;

    IF v_ultima_secuencia IS NULL THEN
        IF NEW.secuencia <> 1 OR NEW.estado_anterior_id IS NOT NULL THEN
            RAISE EXCEPTION 'El primer movimiento debe tener secuencia 1 y estado anterior nulo';
        END IF;
    ELSE
        IF NEW.secuencia <> v_ultima_secuencia + 1 THEN
            RAISE EXCEPTION 'Conflicto de secuencia: se esperaba %, se recibio %',
                v_ultima_secuencia + 1, NEW.secuencia;
        END IF;
        IF NEW.estado_anterior_id IS DISTINCT FROM v_ultimo_estado THEN
            RAISE EXCEPTION 'El estado anterior no coincide con el ultimo estado del expediente';
        END IF;
    END IF;

    SELECT codigo INTO v_accion_codigo
    FROM accion_tramite
    WHERE accion_tramite_id = NEW.accion_tramite_id;

    IF NEW.transicion_estado_tramite_id IS NOT NULL THEN
        SELECT TRUE INTO v_transicion_valida
        FROM transicion_estado_tramite t
        WHERE t.transicion_estado_tramite_id = NEW.transicion_estado_tramite_id
          AND t.estado_anterior_id IS NOT DISTINCT FROM NEW.estado_anterior_id
          AND t.accion_tramite_id = NEW.accion_tramite_id
          AND t.estado_resultante_id = NEW.estado_resultante_id
          AND t.activo
          AND (t.vigente_desde IS NULL OR NEW.fecha_hora >= t.vigente_desde)
          AND (t.vigente_hasta IS NULL OR NEW.fecha_hora < t.vigente_hasta);

        IF NOT COALESCE(v_transicion_valida, FALSE) THEN
            RAISE EXCEPTION 'La transicion indicada no es compatible, activa o vigente';
        END IF;
    END IF;

    IF v_accion_codigo = 'CIERRE' THEN
        SELECT EXISTS (
            SELECT 1
            FROM movimiento_tramite m
            JOIN accion_tramite a ON a.accion_tramite_id = m.accion_tramite_id
            JOIN atencion_tramite atn ON atn.movimiento_id = m.movimiento_id
            WHERE m.expediente_id = NEW.expediente_id
              AND m.secuencia < NEW.secuencia
              AND a.codigo = 'ATENCION'
        ) INTO v_tiene_atencion;

        IF NOT v_tiene_atencion THEN
            RAISE EXCEPTION 'No se puede cerrar un expediente sin una atencion valida anterior';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validar_movimiento
    BEFORE INSERT ON movimiento_tramite
    FOR EACH ROW EXECUTE FUNCTION fn_validar_movimiento();

-- 4.5 Relaciones: mismo expediente, orden temporal y semantica propuesta
CREATE OR REPLACE FUNCTION fn_validar_relacion_movimiento()
RETURNS TRIGGER AS $$
DECLARE
    v_origen_expediente VARCHAR(64);
    v_destino_expediente VARCHAR(64);
    v_origen_secuencia INTEGER;
    v_destino_secuencia INTEGER;
    v_origen_accion VARCHAR(50);
    v_destino_accion VARCHAR(50);
    v_tipo VARCHAR(50);
BEGIN
    SELECT m.expediente_id, m.secuencia, a.codigo
      INTO v_origen_expediente, v_origen_secuencia, v_origen_accion
    FROM movimiento_tramite m
    JOIN accion_tramite a ON a.accion_tramite_id = m.accion_tramite_id
    WHERE m.movimiento_id = NEW.movimiento_origen_id;

    SELECT m.expediente_id, m.secuencia, a.codigo
      INTO v_destino_expediente, v_destino_secuencia, v_destino_accion
    FROM movimiento_tramite m
    JOIN accion_tramite a ON a.accion_tramite_id = m.accion_tramite_id
    WHERE m.movimiento_id = NEW.movimiento_destino_id;

    SELECT codigo INTO v_tipo
    FROM tipo_relacion_movimiento
    WHERE tipo_relacion_movimiento_id = NEW.tipo_relacion_movimiento_id
      AND activo;

    IF v_tipo IS NULL THEN
        RAISE EXCEPTION 'El tipo de relacion debe existir y estar activo';
    END IF;
    IF NEW.movimiento_origen_id = NEW.movimiento_destino_id THEN
        RAISE EXCEPTION 'Un movimiento no puede relacionarse consigo mismo'
            USING ERRCODE = 'check_violation';
    END IF;
    IF v_origen_expediente <> v_destino_expediente THEN
        RAISE EXCEPTION 'Los movimientos relacionados deben pertenecer al mismo expediente';
    END IF;
    IF v_origen_secuencia <= v_destino_secuencia THEN
        RAISE EXCEPTION 'El movimiento que relaciona debe ser posterior al movimiento relacionado';
    END IF;
    IF v_tipo = 'RECTIFICA' AND v_origen_accion <> 'RECTIFICACION' THEN
        RAISE EXCEPTION 'Una relacion RECTIFICA debe originarse en una RECTIFICACION';
    END IF;
    IF v_tipo = 'REABRE'
       AND (v_origen_accion <> 'REAPERTURA' OR v_destino_accion <> 'CIERRE') THEN
        RAISE EXCEPTION 'Una relacion REABRE debe vincular una REAPERTURA con un CIERRE anterior';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validar_relacion_movimiento
    BEFORE INSERT OR UPDATE ON relacion_movimiento
    FOR EACH ROW EXECUTE FUNCTION fn_validar_relacion_movimiento();

CREATE OR REPLACE FUNCTION fn_impedir_mutacion_relacion()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Las relaciones entre movimientos historicos son inmutables'
        USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_inmutabilidad_relacion
    BEFORE UPDATE OR DELETE ON relacion_movimiento
    FOR EACH ROW EXECUTE FUNCTION fn_impedir_mutacion_relacion();

-- 4.6 Reapertura y rectificacion requieren una relacion al confirmar.
CREATE OR REPLACE FUNCTION fn_validar_relacion_obligatoria()
RETURNS TRIGGER AS $$
DECLARE
    v_accion VARCHAR(50);
    v_tipo_requerido VARCHAR(50);
BEGIN
    SELECT codigo INTO v_accion
    FROM accion_tramite
    WHERE accion_tramite_id = NEW.accion_tramite_id;

    v_tipo_requerido := CASE v_accion
        WHEN 'REAPERTURA' THEN 'REABRE'
        WHEN 'RECTIFICACION' THEN 'RECTIFICA'
        ELSE NULL
    END;

    IF v_tipo_requerido IS NOT NULL AND NOT EXISTS (
        SELECT 1
        FROM relacion_movimiento r
        JOIN tipo_relacion_movimiento tr
          ON tr.tipo_relacion_movimiento_id = r.tipo_relacion_movimiento_id
        WHERE r.movimiento_origen_id = NEW.movimiento_id
          AND tr.codigo = v_tipo_requerido
    ) THEN
        RAISE EXCEPTION 'El movimiento % requiere una relacion %',
            NEW.movimiento_id, v_tipo_requerido;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER trg_validar_relacion_obligatoria
    AFTER INSERT ON movimiento_tramite
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION fn_validar_relacion_obligatoria();

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
