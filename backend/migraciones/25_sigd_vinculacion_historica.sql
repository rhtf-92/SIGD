-- ==============================================================================
-- MIGRACIÓN 25: Mesa de Partes Digital, Trazabilidad de Creador y Vinculación Histórica
-- ARCHIVO: 25_sigd_vinculacion_historica.sql
-- ==============================================================================

BEGIN;

-- 1. Agregar columna id_usuario_creador en sigd_tra.expediente
ALTER TABLE sigd_tra.expediente
    ADD COLUMN IF NOT EXISTS id_usuario_creador UUID NULL
    REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE SET NULL;

-- Índice para optimizar búsquedas por usuario creador (Regla 4: Índices en FKs)
CREATE INDEX IF NOT EXISTS idx_tra_expediente_creador
    ON sigd_tra.expediente(id_usuario_creador)
    WHERE id_usuario_creador IS NOT NULL;

-- 2. Backfill inicial para expedientes virtuales existentes creados por usuarios con cuenta
UPDATE sigd_tra.expediente e
   SET id_usuario_creador = cu.id_usuario
  FROM sigd_auth.cuenta_usuario cu,
       sigd_tra.asiento_registro ar
 WHERE e.solicitante_id = cu.id_persona
   AND ar.expediente_id = e.expediente_id
   AND ar.canal_ingreso = 'MESA_VIRTUAL'
   AND e.id_usuario_creador IS NULL;

-- 3. Crear tabla de solicitudes de vinculación histórica de expedientes
CREATE TABLE IF NOT EXISTS sigd_tra.solicitud_vinculacion_expediente (
    id_solicitud UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expediente_id UUID NOT NULL REFERENCES sigd_tra.expediente(expediente_id) ON DELETE RESTRICT,
    persona_id UUID NOT NULL REFERENCES sigd_auth.persona(id_persona) ON DELETE RESTRICT,
    id_usuario UUID NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
    estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE'
        CONSTRAINT chk_solicitud_vinculacion_estado CHECK (estado IN ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'ANULADA')),
    motivo_solicitud TEXT NULL,
    motivo_rechazo TEXT NULL,
    solicitado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    resuelto_en TIMESTAMPTZ NULL,
    resuelto_por UUID NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT
);

-- 4. Índices en llaves foráneas y búsquedas frecuentes (Regla 4)
CREATE INDEX IF NOT EXISTS idx_solicitud_vinculacion_expediente
    ON sigd_tra.solicitud_vinculacion_expediente(expediente_id);

CREATE INDEX IF NOT EXISTS idx_solicitud_vinculacion_persona
    ON sigd_tra.solicitud_vinculacion_expediente(persona_id);

CREATE INDEX IF NOT EXISTS idx_solicitud_vinculacion_usuario
    ON sigd_tra.solicitud_vinculacion_expediente(id_usuario);

CREATE INDEX IF NOT EXISTS idx_solicitud_vinculacion_resuelto_por
    ON sigd_tra.solicitud_vinculacion_expediente(resuelto_por)
    WHERE resuelto_por IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_solicitud_vinculacion_estado
    ON sigd_tra.solicitud_vinculacion_expediente(estado);

-- Unicidad parcial: solo una solicitud activa (PENDIENTE o APROBADA) por expediente y usuario
CREATE UNIQUE INDEX IF NOT EXISTS uq_solicitud_vinculacion_activa
    ON sigd_tra.solicitud_vinculacion_expediente(expediente_id, id_usuario)
    WHERE estado IN ('PENDIENTE', 'APROBADA');

COMMIT;
