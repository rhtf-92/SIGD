-- =============================================================================
-- ESQUEMA DE BASE DE DATOS: sigd_audit
-- Grupo 6 "CoreLink" · Integración, Calidad y Pruebas del Backend — SIGD
-- -----------------------------------------------------------------------------
-- Proyecto : Sistema Integral de Gestión Documentaria (SIGD)
-- Institución: IESTP "Suiza" (Pucallpa, Ucayali, Perú) — PE DSI
-- Área     : Backend — CoreLink
-- Autor    : Reátegui · B_REATEGUI (basado en el entregable 02)
-- Archivo  : integracion/06_sigd_audit_esquema_ddl.sql
-- Versión  : 1.3 (Revisión del Liderazgo — PR #79 cancelado · correcciones pre-merge)
-- Cambios v1.3:
--   * correlation_id SIN DEFAULT en bitacora_auditoria: debe propagarse desde
--     AsyncLocalStorage; la BD no debe generar un UUID distinto al del contexto.
--   * FK usuario_id -> sigd_auth SUSPENDIDA (PENDIENTE): se referencia como columna
--     id_usuario hasta que exista contrato aprobado con IdentiCore (IdentiCore/RutaDoc).
--   * Separación de permisos: rol sigd_app (aplicación) y rol sigd_worker (worker outbox).
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
-- Dependencia: el esquema `sigd_auth` (IdentiCore) debe existir previamente
-- (orden de migraciones de la suite Testcontainers del entregable 03).
-- La FK a `usuario_id` está SUSPENDIDA (PENDIENTE): IdentiCore/RutaDoc mantienen
-- pendiente la columna `id_usuario` (no `id`); se activará solo con un contrato
-- aprobado entre CoreLink e IdentiCore.
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
    correlation_id UUID          NOT NULL,
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
    fecha_hora     TIMESTAMPTZ   NOT NULL DEFAULT now()
    -- FK usuario_id -> sigd_auth.cuenta_usuario(id_usuario): SUSPENDIDA (PENDIENTE).
    -- Se creará junto a un contrato aprobado con IdentiCore; ver 07_evidencia.
) WITH (fillfactor = 100);

COMMENT ON TABLE  sigd_audit.bitacora_auditoria IS
    'Bitácora forense inmutable (append-only). Solo INSERT y SELECT para la cuenta de aplicación.';
COMMENT ON COLUMN sigd_audit.bitacora_auditoria.correlation_id IS
    'UUIDv4 de la solicitud. SIN valor por defecto: debe propagarse SIEMPRE desde el contexto AsyncLocalStorage (entregable 01); la BD no genera un UUID distinto.';
COMMENT ON COLUMN sigd_audit.bitacora_auditoria.usuario_id IS
    'Identidad autenticada que ejecutó la mutación. NULL para operaciones de sistema (D-10). FK hacia sigd_auth SÓLO cuando exista contrato aprobado con IdentiCore (columna id_usuario).';
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
-- Separación de roles (v1.3):
--   * sigd_app:      la API escribe la bitácora y ENCOLA eventos (INSERT outbox).
--   * sigd_worker:   despacha eventos: SELECT + UPDATE del outbox únicamente.
-- La aplicación NO actualiza el outbox y el worker NO escribe la bitácora.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sigd_app') THEN
        CREATE ROLE sigd_app;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sigd_worker') THEN
        CREATE ROLE sigd_worker;
    END IF;
END
$$;

GRANT USAGE  ON SCHEMA           sigd_audit TO sigd_app;
GRANT SELECT, INSERT ON sigd_audit.bitacora_auditoria TO sigd_app;
GRANT SELECT, INSERT ON sigd_audit.evento_outbox TO sigd_app;

GRANT USAGE  ON SCHEMA           sigd_audit TO sigd_worker;
GRANT SELECT, UPDATE ON sigd_audit.evento_outbox TO sigd_worker;

REVOKE UPDATE, DELETE ON sigd_audit.bitacora_auditoria FROM sigd_app;
REVOKE UPDATE, DELETE ON sigd_audit.bitacora_auditoria FROM sigd_worker;
REVOKE DELETE ON sigd_audit.evento_outbox FROM sigd_worker;

-- Verificación de cierre (opcional):
-- SELECT count(*) FROM pg_indexes WHERE schemaname = 'sigd_audit';
-- SELECT * FROM information_schema.tables WHERE table_schema = 'sigd_audit';