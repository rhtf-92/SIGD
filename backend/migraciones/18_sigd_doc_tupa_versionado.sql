-- ============================================================================
-- MIGRACIÓN 18: VERSIONADO HISTÓRICO E INMUTABILIDAD DEL CATÁLOGO TUPA INSTITUCIONAL
-- Base de datos: sigd_jacobo_demo
-- Módulo: sigd_doc (Documentos y Catálogo TUPA)
-- Repositorio: SIGD — IESTP Público «Suiza» (Rama: B_JACOBO)
--
-- REGLAS INNEGOCIABLES Y PRINCIPIOS DE PROTECCIÓN INSTITUCIONAL:
--   1. NO modifica ni reasigna los 197 expedientes existentes en PostgreSQL.
--   2. Preserva la restricción 'expediente_tupa_origen_unico' y las 5 filas con
--      tupa_historico_auditoria_id = 'c9ddaffe-fb6d-41b8-92bc-55f175b3bac8'.
--   3. Preserva los 184 expedientes vinculados a sigd_doc.tipo_tramite_tupa.
--   4. Establece la versión inicial 'TUPA-2026-V1' como VIGENTE oficial (72 trámites).
--   5. Soporta estados de versión: 'BORRADOR', 'VIGENTE', 'HISTORICO', 'INACTIVO'.
--   6. Registra exclusivamente la versión oficial de línea base 'TUPA-2026-V1' (72 procedimientos).
--      No crea borradores de simulación ni entidades históricas artificiales.
--   7. Garantiza INMUTABILIDAD ABSOLUTA en procedimientos y requisitos ya publicados.
--   8. Bloquea mutaciones retroactivas sobre expedientes radicados.
--   9. Reemplaza unicidad global de código por (version_id, codigo) para soportar
--      nuevas versiones sin sobrescribir las anteriores.
--  10. Totalmente aditiva, idempotente y compatible con migraciones 16 y 17.
-- ============================================================================

-- 1. Tabla de Versiones del Catálogo TUPA
CREATE TABLE IF NOT EXISTS sigd_doc.tupa_catalogo_version (
    version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_version VARCHAR(32) NOT NULL UNIQUE,
    denominacion VARCHAR(255) NOT NULL,
    resolucion_aprobacion VARCHAR(128) NULL,
    fecha_aprobacion DATE NULL,
    fecha_publicacion TIMESTAMPTZ NULL,
    usuario_publicador_id UUID NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
    estado VARCHAR(20) NOT NULL DEFAULT 'BORRADOR',
    vigente BOOLEAN NOT NULL DEFAULT FALSE,
    observaciones TEXT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT ck_tupa_version_estado CHECK (estado IN ('BORRADOR', 'VIGENTE', 'HISTORICO', 'INACTIVO'))
);

-- Índice parcial único: Garantiza que a lo más una versión puede ser VIGENTE = TRUE
CREATE UNIQUE INDEX IF NOT EXISTS uq_idx_tupa_version_vigente_unica
    ON sigd_doc.tupa_catalogo_version (vigente)
    WHERE vigente = TRUE;

-- 2. Registro Inicial de la Versión Oficial Vigente (Línea Base Técnica Idempotente)

-- Versión oficial aprobada y vigente TUPA Suiza 2026 (72 Procedimientos)
-- Se registra con resolucion_aprobacion = NULL y fecha_aprobacion = NULL al carecer de número formal
-- de R.D. en la fuente documental institucional de 6 páginas, operando como línea base reglamentaria.
INSERT INTO sigd_doc.tupa_catalogo_version (
    version_id,
    codigo_version,
    denominacion,
    resolucion_aprobacion,
    fecha_aprobacion,
    fecha_publicacion,
    estado,
    vigente,
    observaciones
) VALUES (
    'a0260001-0000-4000-8000-000000002026'::uuid,
    'TUPA-2026-V1',
    'TUPA Institucional 2026 — IESTP Suiza (72 Procedimientos Oficiales)',
    NULL,
    NULL,
    clock_timestamp(),
    'VIGENTE',
    TRUE,
    'Catálogo de línea base operativa de exactamente 72 procedimientos administrativos y servicios prestados en exclusividad del IESTP Suiza, numerados correlativamente del 001 al 072, según documento institucional oficial de 6 páginas. Pendiente de registro del número formal de R.D. institucional.'
)
ON CONFLICT (codigo_version) DO NOTHING;

-- 3. Incorporar columna version_id a la tabla de trámites TUPA si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sigd_doc' 
          AND table_name = 'tipo_tramite_tupa' 
          AND column_name = 'version_id'
    ) THEN
        ALTER TABLE sigd_doc.tipo_tramite_tupa
            ADD COLUMN version_id UUID NULL 
            REFERENCES sigd_doc.tupa_catalogo_version(version_id)
            ON UPDATE RESTRICT
            ON DELETE RESTRICT;
            
        CREATE INDEX idx_tipo_tramite_tupa_version_id
            ON sigd_doc.tipo_tramite_tupa (version_id);
    END IF;
END $$;

-- 4. Permitir coexistencia de trámites en versiones distintas (unicidad por versión y código)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
         WHERE conname = 'tipo_tramite_tupa_codigo_key' 
           AND conrelid = 'sigd_doc.tipo_tramite_tupa'::regclass
    ) THEN
        ALTER TABLE sigd_doc.tipo_tramite_tupa DROP CONSTRAINT tipo_tramite_tupa_codigo_key;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_idx_tipo_tramite_tupa_version_codigo 
    ON sigd_doc.tipo_tramite_tupa (COALESCE(version_id, '00000000-0000-0000-0000-000000000000'::uuid), codigo);

-- 5. Incorporar columna version_id a la tabla de requisitos si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sigd_doc' 
          AND table_name = 'requisito' 
          AND column_name = 'version_id'
    ) THEN
        ALTER TABLE sigd_doc.requisito
            ADD COLUMN version_id UUID NULL 
            REFERENCES sigd_doc.tupa_catalogo_version(version_id)
            ON UPDATE RESTRICT
            ON DELETE RESTRICT;
            
        CREATE INDEX idx_sigd_doc_requisito_version_id
            ON sigd_doc.requisito (version_id);
    END IF;
END $$;

-- 6. Incorporar columna version_tupa_id a sigd_doc.expediente para congelar versión en radicación
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sigd_doc' 
          AND table_name = 'expediente' 
          AND column_name = 'version_tupa_id'
    ) THEN
        ALTER TABLE sigd_doc.expediente
            ADD COLUMN version_tupa_id UUID NULL 
            REFERENCES sigd_doc.tupa_catalogo_version(version_id)
            ON UPDATE RESTRICT
            ON DELETE RESTRICT;
            
        CREATE INDEX idx_sigd_doc_expediente_version_tupa_id
            ON sigd_doc.expediente (version_tupa_id);
    END IF;
END $$;

-- 7. Asociar los 72 procedimientos oficiales y sus requisitos a la versión oficial TUPA-2026-V1
UPDATE sigd_doc.tipo_tramite_tupa
   SET version_id = 'a0260001-0000-4000-8000-000000002026'::uuid
 WHERE version_id IS NULL 
   AND codigo LIKE 'SUZ26-%';

UPDATE sigd_doc.requisito r
   SET version_id = t.version_id
  FROM sigd_doc.tipo_tramite_tupa t
 WHERE r.tipo_tramite_id = t.tipo_tramite_id
   AND r.version_id IS NULL
   AND t.version_id IS NOT NULL;

-- 8. Trigger de alternancia atómica y validación estricta de publicación
CREATE OR REPLACE FUNCTION sigd_doc.fn_tupa_version_unica_vigente()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.vigente = TRUE THEN
        -- TUPA-2026-V1 es la línea base operativa inicial cuyos 72 trámites ya operan en el instituto.
        -- Para cualquier otra versión o nueva publicación reglamentaria, se exige resolución y fecha formales.
        IF NEW.codigo_version <> 'TUPA-2026-V1' THEN
            IF NEW.resolucion_aprobacion IS NULL OR trim(NEW.resolucion_aprobacion) = '' THEN
                RAISE EXCEPTION 'SIGD-TUPA-PUBLICACION-INVALIDA: No se puede publicar como VIGENTE una versión sin resolución formal de aprobación.'
                    USING ERRCODE = '23514';
            END IF;
            IF NEW.fecha_aprobacion IS NULL THEN
                RAISE EXCEPTION 'SIGD-TUPA-PUBLICACION-INVALIDA: No se puede publicar como VIGENTE una versión sin fecha formal de aprobación.'
                    USING ERRCODE = '23514';
            END IF;
        END IF;

        NEW.estado := 'VIGENTE';
        IF NEW.fecha_publicacion IS NULL THEN
            NEW.fecha_publicacion := clock_timestamp();
        END IF;

        UPDATE sigd_doc.tupa_catalogo_version
           SET vigente = FALSE,
               estado = CASE WHEN estado = 'VIGENTE' THEN 'HISTORICO' ELSE estado END,
               actualizado_en = clock_timestamp()
         WHERE version_id <> NEW.version_id 
           AND vigente = TRUE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tupa_version_unica_vigente ON sigd_doc.tupa_catalogo_version;
CREATE TRIGGER trg_tupa_version_unica_vigente
    BEFORE INSERT OR UPDATE OF vigente, estado
    ON sigd_doc.tupa_catalogo_version
    FOR EACH ROW
    WHEN (NEW.vigente = TRUE)
    EXECUTE FUNCTION sigd_doc.fn_tupa_version_unica_vigente();

-- 9. Trigger de protección: Prohibir eliminación física de versiones del TUPA
CREATE OR REPLACE FUNCTION sigd_doc.fn_tupa_version_proteger_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'SIGD-DOC-TUPA-VERSION-SEGURIDAD: Prohibido eliminar físicamente versiones del TUPA. Utilice estado INACTIVO o HISTORICO para preservar la trazabilidad institucional.'
        USING ERRCODE = '55000';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tupa_version_no_delete ON sigd_doc.tupa_catalogo_version;
CREATE TRIGGER trg_tupa_version_no_delete
    BEFORE DELETE OR TRUNCATE
    ON sigd_doc.tupa_catalogo_version
    FOR EACH STATEMENT
    EXECUTE FUNCTION sigd_doc.fn_tupa_version_proteger_delete();

-- 10. Trigger de inmutabilidad de metadatos de versión publicada
CREATE OR REPLACE FUNCTION sigd_doc.fn_tupa_version_inmutable()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.estado IN ('VIGENTE', 'HISTORICO') THEN
        IF NEW.codigo_version IS DISTINCT FROM OLD.codigo_version THEN
            RAISE EXCEPTION 'SIGD-DOC-TUPA-VERSION-INMUTABLE: Prohibido alterar el código de una versión oficial publicada (%).',
                OLD.codigo_version
                USING ERRCODE = '55000';
        END IF;

        IF OLD.resolucion_aprobacion IS NOT NULL AND NEW.resolucion_aprobacion IS DISTINCT FROM OLD.resolucion_aprobacion THEN
            RAISE EXCEPTION 'SIGD-DOC-TUPA-VERSION-INMUTABLE: Prohibido alterar la resolución de aprobación de una versión oficial publicada (%). Las modificaciones normativas requieren un nuevo borrador.',
                OLD.codigo_version
                USING ERRCODE = '55000';
        END IF;

        IF OLD.fecha_aprobacion IS NOT NULL AND NEW.fecha_aprobacion IS DISTINCT FROM OLD.fecha_aprobacion THEN
            RAISE EXCEPTION 'SIGD-DOC-TUPA-VERSION-INMUTABLE: Prohibido alterar la fecha de aprobación de una versión oficial publicada (%).',
                OLD.codigo_version
                USING ERRCODE = '55000';
        END IF;

        IF OLD.fecha_publicacion IS NOT NULL AND NEW.fecha_publicacion IS DISTINCT FROM OLD.fecha_publicacion THEN
            RAISE EXCEPTION 'SIGD-DOC-TUPA-VERSION-INMUTABLE: Prohibido alterar la fecha de publicación de una versión oficial publicada (%).',
                OLD.codigo_version
                USING ERRCODE = '55000';
        END IF;

        IF OLD.usuario_publicador_id IS NOT NULL AND NEW.usuario_publicador_id IS DISTINCT FROM OLD.usuario_publicador_id THEN
            RAISE EXCEPTION 'SIGD-DOC-TUPA-VERSION-INMUTABLE: Prohibido alterar el usuario publicador de una versión oficial publicada (%).',
                OLD.codigo_version
                USING ERRCODE = '55000';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tupa_version_inmutable ON sigd_doc.tupa_catalogo_version;
CREATE TRIGGER trg_tupa_version_inmutable
    BEFORE UPDATE OF codigo_version, resolucion_aprobacion, fecha_aprobacion, fecha_publicacion, usuario_publicador_id
    ON sigd_doc.tupa_catalogo_version
    FOR EACH ROW
    EXECUTE FUNCTION sigd_doc.fn_tupa_version_inmutable();

-- 11. Trigger de inmutabilidad de procedimientos de versiones vigentes o históricas
CREATE OR REPLACE FUNCTION sigd_doc.fn_tupa_procedimiento_inmutable()
RETURNS TRIGGER AS $$
DECLARE
    v_estado VARCHAR(20);
    v_total_expedientes INTEGER := 0;
BEGIN
    IF OLD.version_id IS NOT NULL THEN
        SELECT estado INTO v_estado 
          FROM sigd_doc.tupa_catalogo_version 
         WHERE version_id = OLD.version_id;
    END IF;

    SELECT COUNT(*) INTO v_total_expedientes
      FROM sigd_doc.expediente
     WHERE tipo_tramite_id = OLD.tipo_tramite_id;

    IF TG_OP = 'DELETE' THEN
        IF v_estado IN ('VIGENTE', 'HISTORICO') OR v_total_expedientes > 0 THEN
            RAISE EXCEPTION 'SIGD-TUPA-INMUTABLE: Prohibido eliminar el procedimiento % (%). Pertenece a una versión % o cuenta con % expediente(s) asociados. Para cambios normativos genere una nueva versión en estado BORRADOR.',
                OLD.codigo, OLD.denominacion, COALESCE(v_estado, 'VIGENTE'), v_total_expedientes
                USING ERRCODE = '55000';
        END IF;
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        IF (v_estado IN ('VIGENTE', 'HISTORICO') OR v_total_expedientes > 0) THEN
            IF NEW.codigo IS DISTINCT FROM OLD.codigo OR
               NEW.denominacion IS DISTINCT FROM OLD.denominacion OR
               NEW.descripcion IS DISTINCT FROM OLD.descripcion OR
               NEW.unidad_organica IS DISTINCT FROM OLD.unidad_organica OR
               NEW.plazo_dias IS DISTINCT FROM OLD.plazo_dias OR
               NEW.silencio_administrativo IS DISTINCT FROM OLD.silencio_administrativo OR
               NEW.base_legal IS DISTINCT FROM OLD.base_legal OR
               NEW.version_id IS DISTINCT FROM OLD.version_id THEN
                RAISE EXCEPTION 'SIGD-TUPA-INMUTABLE: Prohibido modificar retroactivamente los datos del procedimiento % (%) de una versión % o con expedientes vinculados. Genere una nueva versión del TUPA en estado BORRADOR.',
                    OLD.codigo, OLD.denominacion, COALESCE(v_estado, 'VIGENTE')
                    USING ERRCODE = '55000';
            END IF;
        END IF;
        RETURN NEW;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tupa_procedimiento_inmutable ON sigd_doc.tipo_tramite_tupa;
CREATE TRIGGER trg_tupa_procedimiento_inmutable
    BEFORE UPDATE OR DELETE ON sigd_doc.tipo_tramite_tupa
    FOR EACH ROW
    EXECUTE FUNCTION sigd_doc.fn_tupa_procedimiento_inmutable();

-- 12. Trigger de inmutabilidad de requisitos documentales de versiones vigentes o históricas
CREATE OR REPLACE FUNCTION sigd_doc.fn_tupa_requisito_inmutable()
RETURNS TRIGGER AS $$
DECLARE
    v_estado VARCHAR(20);
    v_total_exp_req INTEGER := 0;
BEGIN
    SELECT v.estado INTO v_estado
      FROM sigd_doc.tipo_tramite_tupa t
      LEFT JOIN sigd_doc.tupa_catalogo_version v ON v.version_id = t.version_id
     WHERE t.tipo_tramite_id = OLD.tipo_tramite_id;

    SELECT COUNT(*) INTO v_total_exp_req
      FROM sigd_doc.expediente_requisito
     WHERE requisito_id = OLD.requisito_id;

    IF TG_OP = 'DELETE' THEN
        IF v_estado IN ('VIGENTE', 'HISTORICO') OR v_total_exp_req > 0 THEN
            RAISE EXCEPTION 'SIGD-TUPA-REQUISITO-INMUTABLE: Prohibido eliminar el requisito % (%). Pertenece a una versión % o tiene % expediente(s) asociados.',
                OLD.codigo, OLD.denominacion, COALESCE(v_estado, 'VIGENTE'), v_total_exp_req
                USING ERRCODE = '55000';
        END IF;
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        IF (v_estado IN ('VIGENTE', 'HISTORICO') OR v_total_exp_req > 0) THEN
            IF NEW.codigo IS DISTINCT FROM OLD.codigo OR
               NEW.denominacion IS DISTINCT FROM OLD.denominacion OR
               NEW.obligatorio IS DISTINCT FROM OLD.obligatorio OR
               NEW.tipo_tramite_id IS DISTINCT FROM OLD.tipo_tramite_id OR
               NEW.version_id IS DISTINCT FROM OLD.version_id THEN
                RAISE EXCEPTION 'SIGD-TUPA-REQUISITO-INMUTABLE: Prohibido modificar retroactivamente el requisito % (%) de una versión vigente o histórica del TUPA.',
                    OLD.codigo, OLD.denominacion
                    USING ERRCODE = '55000';
            END IF;
        END IF;
        RETURN NEW;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tupa_requisito_inmutable ON sigd_doc.requisito;
CREATE TRIGGER trg_tupa_requisito_inmutable
    BEFORE UPDATE OR DELETE ON sigd_doc.requisito
    FOR EACH ROW
    EXECUTE FUNCTION sigd_doc.fn_tupa_requisito_inmutable();

-- 13. Trigger de vinculación automática de versión vigente en nuevas radicaciones
CREATE OR REPLACE FUNCTION sigd_doc.fn_expediente_vincular_tupa_vigente()
RETURNS TRIGGER AS $$
DECLARE
    v_version_id UUID;
    v_version_estado VARCHAR(20);
    v_version_vigente BOOLEAN;
    v_tramite_vigente BOOLEAN;
BEGIN
    IF NEW.tipo_tramite_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT t.version_id, t.vigente, v.estado, v.vigente
      INTO v_version_id, v_tramite_vigente, v_version_estado, v_version_vigente
      FROM sigd_doc.tipo_tramite_tupa t
      LEFT JOIN sigd_doc.tupa_catalogo_version v ON v.version_id = t.version_id
     WHERE t.tipo_tramite_id = NEW.tipo_tramite_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'SIGD-RADICACION-TUPA-NO-EXISTE: El procedimiento indicado (ID: %) no existe en el catálogo institucional.',
            NEW.tipo_tramite_id
            USING ERRCODE = '23503';
    END IF;

    IF v_tramite_vigente IS NOT TRUE THEN
        RAISE EXCEPTION 'SIGD-RADICACION-TUPA-INACTIVO: El procedimiento seleccionado no se encuentra activo para radicación.'
            USING ERRCODE = '23514';
    END IF;

    IF v_version_id IS NOT NULL THEN
        IF v_version_estado <> 'VIGENTE' OR v_version_vigente IS NOT TRUE THEN
            RAISE EXCEPTION 'SIGD-RADICACION-VERSION-NO-VIGENTE: No se pueden radicar expedientes sobre versiones del TUPA en estado % o no vigentes.',
                COALESCE(v_version_estado, 'DESCONOCIDO')
                USING ERRCODE = '23514';
        END IF;
        
        -- Congelar la versión exacta en el expediente de forma automática
        IF NEW.version_tupa_id IS NULL THEN
            NEW.version_tupa_id := v_version_id;
        ELSIF NEW.version_tupa_id <> v_version_id THEN
            RAISE EXCEPTION 'SIGD-RADICACION-VERSION-DISCREPANCIA: La versión provista (%) no coincide con la versión oficial del trámite (%).',
                NEW.version_tupa_id, v_version_id
                USING ERRCODE = '23514';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_expediente_vincular_tupa_vigente ON sigd_doc.expediente;
CREATE TRIGGER trg_expediente_vincular_tupa_vigente
    BEFORE INSERT ON sigd_doc.expediente
    FOR EACH ROW
    EXECUTE FUNCTION sigd_doc.fn_expediente_vincular_tupa_vigente();

-- 14. Trigger de congelamiento definitivo de identidad TUPA en expedientes ya radicados
CREATE OR REPLACE FUNCTION sigd_doc.fn_expediente_proteger_tupa_historico()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.tipo_tramite_id IS DISTINCT FROM OLD.tipo_tramite_id OR
       NEW.version_tupa_id IS DISTINCT FROM OLD.version_tupa_id OR
       NEW.tupa_historico_auditoria_id IS DISTINCT FROM OLD.tupa_historico_auditoria_id THEN
        RAISE EXCEPTION 'SIGD-EXPEDIENTE-TUPA-INMUTABLE: Prohibido modificar la vinculación TUPA o la versión histórica de un expediente ya radicado (CUT: %).',
            OLD.codigo_expediente
            USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_expediente_proteger_tupa_historico ON sigd_doc.expediente;
CREATE TRIGGER trg_expediente_proteger_tupa_historico
    BEFORE UPDATE OF tipo_tramite_id, version_tupa_id, tupa_historico_auditoria_id
    ON sigd_doc.expediente
    FOR EACH ROW
    EXECUTE FUNCTION sigd_doc.fn_expediente_proteger_tupa_historico();

-- 15. Documentación institucional de auditoría
COMMENT ON TABLE sigd_doc.tupa_catalogo_version IS 
'Control institucional de versiones del TUPA (BORRADOR, VIGENTE, HISTORICO). Garantiza la inmutabilidad de los expedientes históricos y la vigencia única.';
