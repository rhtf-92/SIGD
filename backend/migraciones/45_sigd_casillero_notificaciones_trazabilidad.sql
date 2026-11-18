-- ==============================================================================
-- MIGRACIÓN 45: Casillero Electrónico, Trazabilidad WORM e Idempotencia
-- FASE 5J: Separación de Superficies, Estados Neutros y Evidencia de Acceso
-- ==============================================================================

BEGIN;

-- 1. Agregar columnas a sigd_auth.notificacion_casilla
ALTER TABLE sigd_auth.notificacion_casilla
    ADD COLUMN IF NOT EXISTS persona_id UUID NULL
        REFERENCES sigd_auth.persona(id_persona) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS fecha_descarga TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(150) NULL;

-- 2. Actualizar CHECK constraint en sigd_auth.notificacion_casilla para soportar estados neutros
ALTER TABLE sigd_auth.notificacion_casilla
    DROP CONSTRAINT IF EXISTS chk_notificacion_casilla_estado;

ALTER TABLE sigd_auth.notificacion_casilla
    ADD CONSTRAINT chk_notificacion_casilla_estado CHECK (
        estado IN (
            'NO_LEIDO', 'LEIDO', 'PENDIENTE', 'NOTIFICADO',
            'GENERADA', 'PUESTA_A_DISPOSICION', 'VISUALIZADA', 'DESCARGADA', 'ERROR_ENVIO'
        )
    );

-- 3. Índices en llaves foráneas y búsquedas frecuentes (Regla 4 y Regla 8)
CREATE INDEX IF NOT EXISTS idx_notif_casilla_persona
    ON sigd_auth.notificacion_casilla(persona_id)
    WHERE persona_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_notif_casilla_idempotency
    ON sigd_auth.notificacion_casilla(idempotency_key)
    WHERE idempotency_key IS NOT NULL;

-- 4. Tabla de trazabilidad inmutable (WORM) de eventos del casillero y notificaciones
CREATE TABLE IF NOT EXISTS sigd_auth.notificacion_trazabilidad_evento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notificacion_id UUID NOT NULL
        REFERENCES sigd_auth.notificacion_casilla(id) ON DELETE RESTRICT,
    tipo_evento VARCHAR(50) NOT NULL
        CONSTRAINT chk_notif_trazabilidad_tipo CHECK (
            tipo_evento IN (
                'GENERADA',
                'PUESTA_A_DISPOSICION',
                'VISUALIZADA',
                'ENLACE_DE_DESCARGA_GENERADO',
                'INTENTO_ENVIO_EMAIL',
                'ACUSE_GENERADO'
            )
        ),
    canal VARCHAR(30) NOT NULL DEFAULT 'CASILLA'
        CONSTRAINT chk_notif_trazabilidad_canal CHECK (canal IN ('CASILLA', 'EMAIL', 'SSE', 'SMS')),
    estado VARCHAR(40) NOT NULL
        CONSTRAINT chk_notif_trazabilidad_estado CHECK (
            estado IN ('EXITOSO', 'ERROR_ENVIO', 'EMAIL_PROVIDER_NO_CONFIGURADO', 'REGISTRADO')
        ),
    detalles JSONB NULL,
    ip_origen VARCHAR(45) NULL,
    registrado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices en la tabla de trazabilidad
CREATE INDEX IF NOT EXISTS idx_notif_trazabilidad_notificacion
    ON sigd_auth.notificacion_trazabilidad_evento(notificacion_id);

CREATE INDEX IF NOT EXISTS idx_notif_trazabilidad_fecha
    ON sigd_auth.notificacion_trazabilidad_evento(registrado_en DESC);

CREATE INDEX IF NOT EXISTS idx_notif_trazabilidad_evento_canal
    ON sigd_auth.notificacion_trazabilidad_evento(tipo_evento, canal);

-- 5. Trigger WORM: Garantizar inmutabilidad estricta (no UPDATE, no DELETE)
CREATE OR REPLACE FUNCTION sigd_auth.fn_notificacion_trazabilidad_worm()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'INMUTABILIDAD_WORM: La tabla sigd_auth.notificacion_trazabilidad_evento es de solo inserción (WORM). No se permite modificar ni eliminar eventos registrados.'
        USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notificacion_trazabilidad_worm ON sigd_auth.notificacion_trazabilidad_evento;
CREATE TRIGGER trg_notificacion_trazabilidad_worm
    BEFORE UPDATE OR DELETE ON sigd_auth.notificacion_trazabilidad_evento
    FOR EACH ROW
    EXECUTE FUNCTION sigd_auth.fn_notificacion_trazabilidad_worm();

COMMIT;
