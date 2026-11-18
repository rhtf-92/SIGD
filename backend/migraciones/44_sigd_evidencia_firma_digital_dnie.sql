-- =============================================================================
-- Migración 44 · Esquema sigd_doc / sigd_tra
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
-- -----------------------------------------------------------------------------
-- Autor     : FASE 5I (Integración DNIe, Certificados, Criptografía y WORM)
-- Marco     : Ley N° 27269 (Firmas y Certificados Digitales), TUO Ley 27444
-- Depende de: 04_sigd_doc.sql, 05_sigd_tra.sql, 12_sigd_documento_expediente_tra.sql,
--             43_sigd_workflow_custodia_asignacion_observaciones.sql
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 44.1 Reconciliación de sigd_doc.resolucion con sigd_tra.expediente
-- -----------------------------------------------------------------------------
-- Permite que los actos resolutivos referencien directamente al expediente
-- canónico y operativo de tramitación (sigd_tra.expediente), en exacta simetría
-- con lo establecido en la migración 12 para sigd_doc.documento_adjunto.
-- -----------------------------------------------------------------------------

ALTER TABLE sigd_doc.resolucion
    ADD COLUMN IF NOT EXISTS expediente_tra_id UUID NULL;

ALTER TABLE sigd_doc.resolucion
    ALTER COLUMN expediente_id DROP NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'sigd_doc.resolucion'::regclass
           AND conname = 'fk_resolucion_expediente_tra'
    ) THEN
        ALTER TABLE sigd_doc.resolucion
            ADD CONSTRAINT fk_resolucion_expediente_tra
            FOREIGN KEY (expediente_tra_id)
            REFERENCES sigd_tra.expediente (expediente_id) ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'sigd_doc.resolucion'::regclass
           AND conname = 'chk_resolucion_expediente_unico'
    ) THEN
        ALTER TABLE sigd_doc.resolucion
            ADD CONSTRAINT chk_resolucion_expediente_unico
            CHECK (num_nonnulls(expediente_id, expediente_tra_id) = 1);
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_resolucion_expediente_tra
    ON sigd_doc.resolucion (expediente_tra_id);

COMMENT ON COLUMN sigd_doc.resolucion.expediente_tra_id IS
    'Referencia al expediente canónico de TramiCore/RutaDoc; exactamente una de las dos FK de expediente debe estar informada.';

-- -----------------------------------------------------------------------------
-- 44.2 Extensión de sigd_doc.firma_digital_documento (Evidencia Criptográfica DNIe)
-- -----------------------------------------------------------------------------
-- Registra metadatos de auditoría PKI y firma criptográfica sin almacenar
-- secretos ni claves privadas. Retrocompatible con registros existentes.
-- -----------------------------------------------------------------------------

ALTER TABLE sigd_doc.firma_digital_documento
    ADD COLUMN IF NOT EXISTS certificado_emisor TEXT NULL,
    ADD COLUMN IF NOT EXISTS certificado_serial VARCHAR(128) NULL,
    ADD COLUMN IF NOT EXISTS certificado_thumbprint CHAR(64) NULL,
    ADD COLUMN IF NOT EXISTS certificado_valido_desde TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS certificado_valido_hasta TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS algoritmo_firma VARCHAR(32) NOT NULL DEFAULT 'SHA256withRSA',
    ADD COLUMN IF NOT EXISTS persona_id UUID NULL REFERENCES sigd_auth.persona (id_persona) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS cuenta_usuario_id UUID NULL REFERENCES sigd_auth.cuenta_usuario (id_usuario) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS proveedor_firma VARCHAR(32) NOT NULL DEFAULT 'DNIE_BIT4ID',
    ADD COLUMN IF NOT EXISTS firma_b64 TEXT NULL,
    ADD COLUMN IF NOT EXISTS certificado_publico_pem TEXT NULL,
    ADD COLUMN IF NOT EXISTS documento_version INT NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_firma_digital_persona
    ON sigd_doc.firma_digital_documento (persona_id);

CREATE INDEX IF NOT EXISTS idx_firma_digital_thumbprint
    ON sigd_doc.firma_digital_documento (certificado_thumbprint);

COMMENT ON COLUMN sigd_doc.firma_digital_documento.certificado_thumbprint IS
    'SHA-256 del certificado X.509 público con el que se emitió la firma digital.';
COMMENT ON COLUMN sigd_doc.firma_digital_documento.firma_b64 IS
    'Contenedor o firma criptográfica en base64 para verificación independiente.';

-- -----------------------------------------------------------------------------
-- 44.3 Inmutabilidad WORM para Evidencia Criptográfica de Firma
-- -----------------------------------------------------------------------------
-- Protege contra modificaciones o eliminaciones maliciosas de firmas asentadas.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION sigd_doc.fn_proteger_firma_digital_worm()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'sigd_doc.firma_digital_documento es inmutable (WORM): % prohibido sobre documento_id %',
        TG_OP, OLD.documento_id
        USING ERRCODE = '23001',
              HINT = 'La evidencia de firma digital no puede modificarse ni eliminarse.';
END;
$$;

DROP TRIGGER IF EXISTS tr_proteger_firma_digital_worm ON sigd_doc.firma_digital_documento;
CREATE TRIGGER tr_proteger_firma_digital_worm
    BEFORE UPDATE OR DELETE ON sigd_doc.firma_digital_documento
    FOR EACH ROW
    EXECUTE FUNCTION sigd_doc.fn_proteger_firma_digital_worm();

COMMIT;
