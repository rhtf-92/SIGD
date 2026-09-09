-- =============================================================================
-- ESQUEMA DE BASE DE DATOS: sigd_audit
-- Grupo 6 "CoreLink" · Integración, Calidad y Pruebas del Backend — SIGD
-- -----------------------------------------------------------------------------
-- Proyecto : Sistema Integral de Gestión Documentaria (SIGD)
-- Institución: IESTP "Suiza" (Pucallpa, Ucayali, Perú) — PE DSI
-- Área     : Backend — CoreLink
-- Autor    : Reátegui · B_REATEGUI (basado en el entregable 02)
-- Archivo  : integracion/06_sigd_audit_esquema_ddl.sql
-- Versión  : 1.2 (Revisión del Liderazgo — PR #79 · alineado al entregable 02 v1.2)
-- Cambios v1.2: bitacora_auditoria.fecha_hora incluida y documentada
-- (consistente con la estructura y el índice idx_bitacora_fecha del entregable 02).
--
-- Contenido:
--   1. Esquema `sigd_audit` (CREATE SCHEMA)
--   2. Tabla `bitacora_auditoria`  (bitácora forense append-only)
--   3. Tabla `evento_outbox`       (Transactional Outbox Pattern)
--   4. Índices de consulta forense y barrido del worker
--   5. Política de inmutabilidad (roles / permisos de aplicación)
--
-- Compatibilidad: PostgreSQL 18 (usa gen_random_uuid(), INET, JSONB).
-- Ejecutar con:  psql -w -h localhost -p 5432 -U postgres -d sigd_prueba -v ON_ERROR_STOP=1 -f integracion/06_sigd_audit_esquema_ddl.sql
--
-- Dependencia: la FK `usuario_id` referencia `sigd_auth.cuenta_usuario(id)`,
-- por lo que el esquema `sigd_auth` (IdentiCore) debe existir previamente
-- (orden de migraciones de la suite Testcontainers del entregable 03).
-- =============================================================================

-- 1. ESQUEMA
CREATE SCHEMA IF NOT EXISTS sigd_audit;

-- Extensión para gen_random_uuid() (requerida en la checklist del entregable 02;
-- en PostgreSQL 13+ la función ya está disponible en el núcleo).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. BITÁCORA FORENSE (APPEND-ONLY)
-- -----------------------------------------------------------------------------
-- Registro inmutable de mutaciones INSERT/UPDATE/DELETE sobre datos de negocio.
-- Conserva el antes/después en JSONB y queda ligada al contexto de la solicitud
-- (correlation_id, usuario_id, ip_origen, user_agent) — entregable 01.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_audit.bitacora_auditoria (
    id_auditoria   UUID          NOT NULL DEFAULT gen_random_uuid()
                                 CONSTRAINT pk_bitacora_auditoria PRIMARY KEY,
    correlation_id UUID          NOT NULL DEFAULT gen_random_uuid(),
    usuario_id     UUID          NULL,
    ip_origen      INET          NULL,
    user_agent     VARCHAR(512)  NULL,
    esquema        VARCHAR(64)   NOT NULL,
    tabla          VARCHAR(64)   NOT NULL,
    operacion      VARCHAR(16)   NOT NULL
                                 CONSTRAINT chk_bitacora_operacion
                                 CHECK (operacion IN ('INSERT', 'UPDATE', 'DELETE')),
    datos_antes    JSONB         NULL,
    datos_despues  JSONB         NOT NULL,
    fecha_hora     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    -- Integridad referencial de la identidad (esquema sigd_auth / IdentiCore)
    CONSTRAINT fk_bitacora_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES sigd_auth.cuenta_usuario (id)
) WITH (fillfactor = 100);

COMMENT ON TABLE  sigd_audit.bitacora_auditoria IS
    'Bitácora forense inmutable (append-only). Solo INSERT y SELECT para la cuenta de aplicación.';
COMMENT ON COLUMN sigd_audit.bitacora_auditoria.correlation_id IS
    'UUIDv4 de la solicitud; debe coincidir con el contexto AsyncLocalStorage (entregable 01).';
COMMENT ON COLUMN sigd_audit.bitacora_auditoria.usuario_id IS
    'Identidad autenticada que ejecutó la mutación. NULL para operaciones de sistema (D-10).';
COMMENT ON COLUMN sigd_audit.bitacora_auditoria.datos_antes IS
    'Estado previo de la fila (NULL para INSERT).';
COMMENT ON COLUMN sigd_audit.bitacora_auditoria.datos_despues IS
    'Estado posterior de la fila (para DELETE puede ser el estado previo a la eliminación).';

-- 3. TRANSACTIONAL OUTBOX
-- -----------------------------------------------------------------------------
-- Eventos de integración/notificación escritos en la MISMA transacción de la
-- mutación de negocio (atomicidad) y despachados de forma asíncrona por el worker.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_audit.evento_outbox (
    id_evento      UUID          NOT NULL DEFAULT gen_random_uuid()
                                 CONSTRAINT pk_evento_outbox PRIMARY KEY,
    correlation_id UUID          NOT NULL,
    agregado       VARCHAR(64)   NOT NULL,
    tipo_evento    VARCHAR(64)   NOT NULL,
    payload        JSONB         NOT NULL,
    estado         VARCHAR(16)   NOT NULL DEFAULT 'PENDIENTE'
                                 CONSTRAINT chk_outbox_estado
                                 CHECK (estado IN ('PENDIENTE', 'PROCESADO', 'FALLIDO')),
    intentos       SMALLINT      NOT NULL DEFAULT 0
                                 CONSTRAINT chk_outbox_intentos CHECK (intentos >= 0),
    creado_en      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    procesado_en   TIMESTAMPTZ   NULL
);

COMMENT ON TABLE  sigd_audit.evento_outbox IS
    'Transactional Outbox: eventos persistidos atómicamente con la mutación y despachados por el worker.';
COMMENT ON COLUMN sigd_audit.evento_outbox.estado IS
    'PENDIENTE -> PROCESADO (éxito) o FALLIDO (dead-letter tras agotar reintentos). Solo el worker lo modifica.';
COMMENT ON COLUMN sigd_audit.evento_outbox.payload IS
    'Cuerpo autocontenido del evento más claves de idempotencia (ver matriz del entregable 04).';

-- 4. ÍNDICES
-- -----------------------------------------------------------------------------
-- Consulta forense (bitácora) y barrido eficiente del worker (outbox).
-- Nombres en estado PROPUESTO (D-11) según el entregable 02.
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_bitacora_correlation_id
    ON sigd_audit.bitacora_auditoria (correlation_id);

CREATE INDEX IF NOT EXISTS idx_bitacora_usuario
    ON sigd_audit.bitacora_auditoria (usuario_id);

CREATE INDEX IF NOT EXISTS idx_bitacora_fecha
    ON sigd_audit.bitacora_auditoria (fecha_hora);

CREATE INDEX IF NOT EXISTS idx_bitacora_tabla
    ON sigd_audit.bitacora_auditoria (esquema, tabla);

CREATE INDEX IF NOT EXISTS idx_bitacora_jsonb
    ON sigd_audit.bitacora_auditoria USING GIN (datos_despues);

CREATE INDEX IF NOT EXISTS idx_outbox_estado_fecha
    ON sigd_audit.evento_outbox (estado, creado_en);

-- 5. POLÍTICA DE INMUTABILIDAD Y PERMISOS DE APLICACIÓN
-- -----------------------------------------------------------------------------
-- La bitácora es de SOLO ESCRITURA: la cuenta de aplicación debe tener
-- únicamente INSERT y SELECT; se revocan UPDATE y DELETE.
-- El bloque crea el rol de aplicación si no existe para que el script sea
-- reproducible; ajustar el nombre si el proyecto usa otro rol (p. ej. sigd_app).
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sigd_app') THEN
        CREATE ROLE sigd_app;
    END IF;
END
$$;

GRANT USAGE  ON SCHEMA           sigd_audit TO sigd_app;
GRANT SELECT, INSERT ON sigd_audit.bitacora_auditoria TO sigd_app;
GRANT SELECT, INSERT, UPDATE ON sigd_audit.evento_outbox TO sigd_app;

REVOKE UPDATE, DELETE ON sigd_audit.bitacora_auditoria FROM sigd_app;

-- Verificación de cierre (opcional):
-- SELECT count(*) FROM pg_indexes WHERE schemaname = 'sigd_audit';
-- SELECT * FROM information_schema.tables WHERE table_schema = 'sigd_audit';