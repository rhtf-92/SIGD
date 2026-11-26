-- =============================================================================
-- MIGRACIÓN 31: TABLA DE TOKENS SEGUROS DE SEGUIMIENTO PÚBLICO MULTIDISPOSITIVO
-- PROYECTO: SIGD — Sistema Integral de Gestión Documentaria (RENATO)
-- INSTITUCIÓN: IESTP «Suiza» — Pucallpa, Ucayali
-- RAMA AUTORIZADA: B_JACOBO
-- NORMATIVA:
--   - TUO Ley N° 27444 (LPAG), Art. 66 (Derechos de los administrados al seguimiento de expedientes)
--   - Ley N° 29733 (Ley de Protección de Datos Personales y Principio de Minimización)
--   - Estándar PCM/SEGDI sobre Servicios Digitales e Identidad Digital
-- OBJETIVO:
--   Crear el repositorio persistente para tokens criptográficos de seguimiento público
--   asociados a expedientes radicados por ciudadanos sin cuenta registrada.
-- POLÍTICA DE SEGURIDAD:
--   - Almacena ÚNICAMENTE el hash SHA-256 del secreto (nunca texto plano).
--   - Expiración obligatoria configurable (expira_en).
--   - Revocación formal (revocado, revocado_en, motivo_revocacion).
--   - Unicidad: Máximo un token activo por expediente (índice parcial).
-- =============================================================================

CREATE TABLE IF NOT EXISTS sigd_tra.token_seguimiento_publico (
    id_token UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expediente_id UUID NOT NULL REFERENCES sigd_tra.expediente(expediente_id) ON DELETE RESTRICT,
    token_hash CHARACTER(64) NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    expira_en TIMESTAMPTZ NOT NULL,
    revocado BOOLEAN NOT NULL DEFAULT false,
    revocado_en TIMESTAMPTZ NULL,
    motivo_revocacion CHARACTER VARYING(100) NULL,
    ultimo_acceso_en TIMESTAMPTZ NULL,
    contador_consultas INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT uq_token_seguimiento_hash UNIQUE (token_hash),
    CONSTRAINT chk_token_hash_formato CHECK (token_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT chk_token_revocado CHECK (revocado = false OR (revocado_en IS NOT NULL AND motivo_revocacion IS NOT NULL)),
    CONSTRAINT chk_token_expira CHECK (expira_en > creado_en),
    CONSTRAINT chk_token_consultas CHECK (contador_consultas >= 0)
);

-- Índice para búsqueda rápida por expediente
CREATE INDEX IF NOT EXISTS idx_token_seguimiento_expediente
    ON sigd_tra.token_seguimiento_publico (expediente_id);

-- Restricción parcial institucional: como máximo un token ACTIVO por expediente
CREATE UNIQUE INDEX IF NOT EXISTS uq_token_seguimiento_activo
    ON sigd_tra.token_seguimiento_publico (expediente_id)
    WHERE revocado = false;

-- Comentarios descriptivos
COMMENT ON TABLE sigd_tra.token_seguimiento_publico IS
'Tokens criptográficos exclusivos para el seguimiento público multidispositivo de expedientes sin cuenta.';
COMMENT ON COLUMN sigd_tra.token_seguimiento_publico.token_hash IS
'Hash SHA-256 en minúsculas del secreto de 256 bits entregado al administrado.';
COMMENT ON COLUMN sigd_tra.token_seguimiento_publico.expira_en IS
'Fecha y hora límite de vigencia del token de seguimiento.';
COMMENT ON COLUMN sigd_tra.token_seguimiento_publico.revocado IS
'Indica si el token fue invalidado manualmente o por rotación de credencial.';
COMMENT ON COLUMN sigd_tra.token_seguimiento_publico.motivo_revocacion IS
'Causa de la invalidación: ROTACION_POR_RENOVACION, EXPIRADO, REVOCADO_ADMINISTRATIVAMENTE, etc.';
