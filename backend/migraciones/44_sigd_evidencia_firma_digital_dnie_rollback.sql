-- =============================================================================
-- Rollback 44 · Esquema sigd_doc / sigd_tra
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
-- -----------------------------------------------------------------------------
-- Salvaguarda: ABORTA si existen firmas digitales con evidencia criptográfica
-- registrada bajo la Fase 5I, protegiendo la inmutabilidad y trazabilidad legal.
-- =============================================================================

BEGIN;

DO $$
DECLARE
    v_total_firmas_5i INT;
    v_total_resoluciones_tra INT;
BEGIN
    -- 1. Validar si existen firmas con evidencia criptográfica 5I
    SELECT COUNT(*)
      INTO v_total_firmas_5i
      FROM sigd_doc.firma_digital_documento
     WHERE firma_b64 IS NOT NULL
        OR certificado_thumbprint IS NOT NULL
        OR persona_id IS NOT NULL;

    IF v_total_firmas_5i > 0 THEN
        RAISE EXCEPTION 'Rollback 44 abortado: existen % firmas digitales con evidencia criptográfica registrada bajo Fase 5I.', v_total_firmas_5i
            USING ERRCODE = '55000',
                  HINT = 'No se puede destruir evidencia criptográfica de firmas legalmente asentadas.';
    END IF;

    -- 2. Validar si existen resoluciones asociadas a expedientes tra
    SELECT COUNT(*)
      INTO v_total_resoluciones_tra
      FROM sigd_doc.resolucion
     WHERE expediente_tra_id IS NOT NULL;

    IF v_total_resoluciones_tra > 0 THEN
        RAISE EXCEPTION 'Rollback 44 abortado: existen % resoluciones vinculadas a expedientes operativos de trámite.', v_total_resoluciones_tra
            USING ERRCODE = '55000';
    END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- Retiro seguro del trigger WORM y las columnas aditivas
-- -----------------------------------------------------------------------------

DROP TRIGGER IF EXISTS tr_proteger_firma_digital_worm ON sigd_doc.firma_digital_documento;
DROP FUNCTION IF EXISTS sigd_doc.fn_proteger_firma_digital_worm();

DROP INDEX IF EXISTS sigd_doc.idx_firma_digital_thumbprint;
DROP INDEX IF EXISTS sigd_doc.idx_firma_digital_persona;

ALTER TABLE sigd_doc.firma_digital_documento
    DROP COLUMN IF EXISTS documento_version,
    DROP COLUMN IF EXISTS certificado_publico_pem,
    DROP COLUMN IF EXISTS firma_b64,
    DROP COLUMN IF EXISTS proveedor_firma,
    DROP COLUMN IF EXISTS cuenta_usuario_id,
    DROP COLUMN IF EXISTS persona_id,
    DROP COLUMN IF EXISTS algoritmo_firma,
    DROP COLUMN IF EXISTS certificado_valido_hasta,
    DROP COLUMN IF EXISTS certificado_valido_desde,
    DROP COLUMN IF EXISTS certificado_thumbprint,
    DROP COLUMN IF EXISTS certificado_serial,
    DROP COLUMN IF EXISTS certificado_emisor;

DROP INDEX IF EXISTS sigd_doc.idx_resolucion_expediente_tra;

ALTER TABLE sigd_doc.resolucion
    DROP CONSTRAINT IF EXISTS chk_resolucion_expediente_unico,
    DROP CONSTRAINT IF EXISTS fk_resolucion_expediente_tra,
    DROP COLUMN IF EXISTS expediente_tra_id;

-- Restaurar NOT NULL en resolucion.expediente_id si no hay filas nulas
UPDATE sigd_doc.resolucion
   SET expediente_id = '00000000-0000-0000-0000-000000000000'::uuid
 WHERE expediente_id IS NULL;

ALTER TABLE sigd_doc.resolucion
    ALTER COLUMN expediente_id SET NOT NULL;

COMMIT;
