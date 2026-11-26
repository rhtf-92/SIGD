-- =============================================================================
-- REVERSIÓN MIGRACIÓN 31: ELIMINACIÓN SEGURA DE TOKENS DE SEGUIMIENTO PÚBLICO
-- PROYECTO: SIGD — Sistema Integral de Gestión Documentaria (RENATO)
-- INSTITUCIÓN: IESTP «Suiza» — Pucallpa, Ucayali
-- RAMA AUTORIZADA: B_JACOBO
-- DIRECTRIZ DE SEGURIDAD INSTITUCIONAL:
--   «FALLO SEGURO Y PROTECCIÓN DEL ADMINISTRADO: La reversión está estrictamente
--    prohibida si existen evidencias o registros de tokens emitidos en la tabla,
--    incluso si se encuentran revocados o expirados, para impedir la desprotección
--    documental y la pérdida de trazabilidad garantizada por el TUO de la Ley 27444.»
-- CONDICIÓN OPERATIVA OBLIGATORIA:
--   La reversión solo procede si la tabla NO existe o si se encuentra
--   estrictamente VACÍA (0 registros).
-- =============================================================================

BEGIN;

DO $$
DECLARE
    v_total INTEGER := 0;
BEGIN
    -- 1. Verificar si la tabla existe en el esquema sigd_tra
    IF to_regclass('sigd_tra.token_seguimiento_publico') IS NULL THEN
        RAISE NOTICE 'INFORMACIÓN: La tabla sigd_tra.token_seguimiento_publico no existe en sigd_jacobo_demo. Nada que revertir.';
        RETURN;
    END IF;

    -- 2. Adquirir bloqueo exclusivo para prevenir inserciones o modificaciones concurrentes
    LOCK TABLE sigd_tra.token_seguimiento_publico IN ACCESS EXCLUSIVE MODE;

    -- 3. Contar la totalidad de registros existentes (activos, revocados o vencidos)
    SELECT count(*) INTO v_total FROM sigd_tra.token_seguimiento_publico;

    -- 4. Salvaguarda institucional de Fallo Seguro
    IF v_total > 0 THEN
        RAISE EXCEPTION 'REVERSION_DENEGADA: Se encontraron % registro(s) en sigd_tra.token_seguimiento_publico. No se permite revertir la migración porque provocaría la pérdida de credenciales y desprotegería el seguimiento de expedientes de los ciudadanos administrados.', v_total;
    END IF;

    RAISE NOTICE 'INFORMACIÓN: La tabla sigd_tra.token_seguimiento_publico está vacía (0 registros). Procediendo a la eliminación controlada.';
END $$;

-- 5. Eliminación de índices y tabla una vez certificada la ausencia de datos
DROP INDEX IF EXISTS sigd_tra.uq_token_seguimiento_activo;
DROP INDEX IF EXISTS sigd_tra.idx_token_seguimiento_expediente;
DROP TABLE IF EXISTS sigd_tra.token_seguimiento_publico;

COMMIT;
