-- =============================================================================
-- Migración 02 · WORM hash encadenado sobre sigd_audit.bitacora_auditoria
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
-- -----------------------------------------------------------------------------
-- Propósito : Convertir la bitácora de auditoría en un registro inmutable
--             criptográficamente verificable (WORM real). Cada fila almacena
--             su propio hash (SHA-256) y el hash de la fila inmediatamente
--             anterior, formando una cadena encadenada. Cualquier alteración
--             de un registro rompe la cadena y es detectable mediante
--             fn_validar_cadena_worm().
-- Depende de: 01_sigd_audit.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 2.1 Columnas de encadenamiento WORM
-- -----------------------------------------------------------------------------
ALTER TABLE sigd_audit.bitacora_auditoria
    ADD COLUMN IF NOT EXISTS hash_registro CHAR(64) NULL;

ALTER TABLE sigd_audit.bitacora_auditoria
    ADD COLUMN IF NOT EXISTS hash_anterior CHAR(64) NULL;

COMMENT ON COLUMN sigd_audit.bitacora_auditoria.hash_registro IS
    'SHA-256 hex del contenido de esta fila (hash autocontenido).';

COMMENT ON COLUMN sigd_audit.bitacora_auditoria.hash_anterior IS
    'SHA-256 hex del hash_registro de la fila inmediatamente anterior (encadenamiento WORM).';

CREATE INDEX IF NOT EXISTS idx_bitacora_hash_anterior
    ON sigd_audit.bitacora_auditoria (hash_anterior);

-- -----------------------------------------------------------------------------
-- 2.2 Función para calcular el hash de una fila de auditoría
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sigd_audit.fn_calcular_hash_bitacora(
    p_id_auditoria UUID,
    p_correlation_id UUID,
    p_usuario_id UUID,
    p_ip_origen INET,
    p_user_agent VARCHAR,
    p_esquema VARCHAR,
    p_tabla VARCHAR,
    p_operacion VARCHAR,
    p_datos_antes JSONB,
    p_datos_despues JSONB,
    p_fecha_hora TIMESTAMPTZ,
    p_hash_anterior CHAR(64)
) RETURNS CHAR(64)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_contenido TEXT;
    v_hash CHAR(64);
BEGIN
    -- Serializamos deterministicamente todos los campos relevantes de la fila.
    -- El orden de los campos es fijo para garantizar que el hash sea reproducible.
    v_contenido :=
        p_id_auditoria::text || '|' ||
        p_correlation_id::text || '|' ||
        COALESCE(p_usuario_id::text, '') || '|' ||
        COALESCE(p_ip_origen::text, '') || '|' ||
        COALESCE(p_user_agent, '') || '|' ||
        p_esquema || '|' ||
        p_tabla || '|' ||
        p_operacion || '|' ||
        COALESCE(p_datos_antes::text, '') || '|' ||
        COALESCE(p_datos_despues::text, '') || '|' ||
        p_fecha_hora::text || '|' ||
        COALESCE(p_hash_anterior, '');

    v_hash := encode(digest(v_contenido, 'sha256'), 'hex');
    RETURN v_hash;
END;
$$;

COMMENT ON FUNCTION sigd_audit.fn_calcular_hash_bitacora IS
    'Calcula el SHA-256 encadenado de una fila de bitacora_auditoria para inmutabilidad WORM.';

-- -----------------------------------------------------------------------------
-- 2.3 Trigger: calcular hash_registro y hash_anterior al INSERT
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sigd_audit.fn_asignar_hash_worm()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_hash_anterior CHAR(64);
    v_hash_registro CHAR(64);
BEGIN
    -- Obtener el hash_registro de la fila inmediatamente anterior (por fecha_hora, id_auditoria).
    SELECT b.hash_registro
    INTO v_hash_anterior
    FROM sigd_audit.bitacora_auditoria b
    WHERE (b.fecha_hora, b.id_auditoria) < (NEW.fecha_hora, NEW.id_auditoria)
    ORDER BY b.fecha_hora DESC, b.id_auditoria DESC
    LIMIT 1;

    -- Calcular el hash de esta nueva fila encadenado al anterior.
    v_hash_registro := sigd_audit.fn_calcular_hash_bitacora(
        NEW.id_auditoria,
        NEW.correlation_id,
        NEW.usuario_id,
        NEW.ip_origen,
        NEW.user_agent,
        NEW.esquema,
        NEW.tabla,
        NEW.operacion,
        NEW.datos_antes,
        NEW.datos_despues,
        NEW.fecha_hora,
        v_hash_anterior
    );

    NEW.hash_registro := v_hash_registro;
    NEW.hash_anterior := v_hash_anterior;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_asignar_hash_worm ON sigd_audit.bitacora_auditoria;
CREATE TRIGGER tr_asignar_hash_worm
    BEFORE INSERT ON sigd_audit.bitacora_auditoria
    FOR EACH ROW EXECUTE FUNCTION sigd_audit.fn_asignar_hash_worm();

-- -----------------------------------------------------------------------------
-- 2.4 Función de validación de la cadena WORM
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sigd_audit.fn_validar_cadena_worm()
RETURNS TABLE (
    id_auditoria UUID,
    orden INTEGER,
    valido BOOLEAN,
    hash_esperado CHAR(64),
    hash_almacenado CHAR(64),
    detalle TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_fila RECORD;
    v_hash_anterior CHAR(64) := '';
    v_hash_esperado CHAR(64);
    v_orden INTEGER := 0;
BEGIN
    FOR v_fila IN
        SELECT id_auditoria, correlation_id, usuario_id, ip_origen, user_agent,
               esquema, tabla, operacion, datos_antes, datos_despues,
               fecha_hora, hash_registro, hash_anterior
        FROM sigd_audit.bitacora_auditoria
        ORDER BY fecha_hora, id_auditoria
    LOOP
        v_orden := v_orden + 1;

        -- Recalcular el hash esperado para esta fila.
        v_hash_esperado := sigd_audit.fn_calcular_hash_bitacora(
            v_fila.id_auditoria,
            v_fila.correlation_id,
            v_fila.usuario_id,
            v_fila.ip_origen,
            v_fila.user_agent,
            v_fila.esquema,
            v_fila.tabla,
            v_fila.operacion,
            v_fila.datos_antes,
            v_fila.datos_despues,
            v_fila.fecha_hora,
            v_hash_anterior
        );

        -- Validar: hash almacenado debe coincidir con el recalculado
        -- Y hash_anterior debe coincidir con el hash del registro previo.
        IF v_fila.hash_registro IS DISTINCT FROM v_hash_esperado THEN
            RETURN QUERY SELECT
                v_fila.id_auditoria,
                v_orden,
                FALSE,
                v_hash_esperado,
                v_fila.hash_registro,
                'Hash de registro no coincide (fila alterada o corrupta).';
        ELSIF v_fila.hash_anterior IS DISTINCT FROM v_hash_anterior THEN
            RETURN QUERY SELECT
                v_fila.id_auditoria,
                v_orden,
                FALSE,
                v_hash_esperado,
                v_fila.hash_registro,
                'Hash anterior no coincide con el hash del registro previo (cadena rota).';
        ELSE
            RETURN QUERY SELECT
                v_fila.id_auditoria,
                v_orden,
                TRUE,
                v_hash_esperado,
                v_fila.hash_registro,
                NULL;
        END IF;

        v_hash_anterior := v_fila.hash_registro;
    END LOOP;

    RETURN;
END;
$$;

COMMENT ON FUNCTION sigd_audit.fn_validar_cadena_worm IS
    'Recorre toda la bitácora en orden cronológico y valida que cada hash_registro y hash_anterior sea correcto. Devuelve una fila por registro con su estado de validez.';

-- -----------------------------------------------------------------------------
-- 2.5 Vista de resumen de validación WORM
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW sigd_audit.vw_validacion_worm AS
SELECT
    COUNT(*) AS total_registros,
    COUNT(*) FILTER (WHERE NOT valido) AS registros_invalidos,
    COUNT(*) FILTER (WHERE valido) AS registros_validos,
    CASE WHEN COUNT(*) FILTER (WHERE NOT valido) = 0 THEN TRUE ELSE FALSE END AS cadena_integral
FROM sigd_audit.fn_validar_cadena_worm();

COMMENT ON VIEW sigd_audit.vw_validacion_worm IS
    'Vista de resumen: indica si la cadena WORM está íntegra o si hay registros alterados.';

-- -----------------------------------------------------------------------------
-- 2.6 Concesión de privilegios sobre los nuevos objetos
-- -----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION sigd_audit.fn_validar_cadena_worm() TO sigd_app;
GRANT SELECT ON sigd_audit.vw_validacion_worm TO sigd_app;
GRANT EXECUTE ON FUNCTION sigd_audit.fn_calcular_hash_bitacora(
    uuid, uuid, uuid, inet, varchar, varchar, varchar, varchar, jsonb, jsonb, timestamptz, char
) TO sigd_app;
