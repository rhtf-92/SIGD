-- =============================================================================
-- MIGRACIÓN 30: DESGLOSE DOCUMENTAL Y DESACUMULACIÓN FORMAL EN RUTADOC
-- PROYECTO: SIGD — Sistema Integral de Gestión Documentaria
-- INSTITUCIÓN: IESTP «Suiza» — Pucallpa, Ucayali
-- INTERVENCIÓN: TSK-DEV-04.2 — Microtarea 4.2 (Fase 1)
-- NORMATIVA:
--   - TUO Ley N° 27444 (LPAG), Art. 160 (Acumulación y Desacumulación de Procedimientos)
--   - TUO Ley N° 27444 (LPAG), Art. 170 (Desglose de Documentos y Copias Fedateadas)
--   - Directiva N° 001-2019-AGN/DDPA (Foliación continua e inalterabilidad de folios)
-- ALCANCE:
--   1. Columnas complementarias en sigd_tra.expediente_acumulacion para auditoría de desacumulación.
--   2. Función sigd_tra.desacumular_expediente (reversión formal sin destrucción de historial).
--   3. Columnas en sigd_doc.documento_adjunto para marcar estado de desglose.
--   4. Creación de tabla sigd_tra.expediente_desglose_documental (asientos de retiro formal).
--   5. Función sigd_tra.registrar_desglose_documental (preservando intacta la foliación correlativa AGN).
--   6. Índices relacionales de rendimiento y búsquedas por expediente, documento y sustituto.
--   7. Asignación de privilegios DCL a roles operativos del sistema.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Auditoría complementaria para desacumulación en sigd_tra.expediente_acumulacion
-- -----------------------------------------------------------------------------
ALTER TABLE sigd_tra.expediente_acumulacion
    ADD COLUMN IF NOT EXISTS usuario_acumulacion_id UUID,
    ADD COLUMN IF NOT EXISTS usuario_desacumulacion_id UUID,
    ADD COLUMN IF NOT EXISTS motivo_desacumulacion TEXT,
    ADD COLUMN IF NOT EXISTS acto_desacumulacion VARCHAR(150),
    ADD COLUMN IF NOT EXISTS id_movimiento_acumulacion UUID,
    ADD COLUMN IF NOT EXISTS id_movimiento_desacumulacion UUID;

COMMENT ON COLUMN sigd_tra.expediente_acumulacion.motivo_desacumulacion IS
'Motivación formal y jurídica para separar un expediente previamente acumulado (Art. 160 LPAG).';

COMMENT ON COLUMN sigd_tra.expediente_acumulacion.acto_desacumulacion IS
'Acto administrativo o proveído de instrucción que dispone la desacumulación.';

-- -----------------------------------------------------------------------------
-- 2. Función formal de desacumulación de expedientes conexos
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sigd_tra.desacumular_expediente(
    p_expediente_principal UUID,
    p_expediente_accesorio UUID,
    p_acto_desacumulacion TEXT,
    p_motivo_desacumulacion TEXT,
    p_usuario_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $function$
DECLARE
    v_id_acumulacion UUID;
BEGIN
    IF p_expediente_principal = p_expediente_accesorio THEN
        RAISE EXCEPTION 'Un expediente no puede desacumularse de sí mismo: %', p_expediente_principal
            USING ERRCODE = '22023';
    END IF;

    IF p_acto_desacumulacion IS NULL OR btrim(p_acto_desacumulacion) = '' THEN
        RAISE EXCEPTION 'La desacumulación exige un acto administrativo justificativo'
            USING ERRCODE = '22023';
    END IF;

    IF p_motivo_desacumulacion IS NULL OR btrim(p_motivo_desacumulacion) = '' THEN
        RAISE EXCEPTION 'La desacumulación exige una motivación formal justificada'
            USING ERRCODE = '22023';
    END IF;

    -- Bloqueo pesimista de ambas filas de expediente
    PERFORM 1 FROM sigd_tra.expediente WHERE expediente_id = p_expediente_principal FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Expediente principal no encontrado: %', p_expediente_principal
            USING ERRCODE = '02000';
    END IF;

    PERFORM 1 FROM sigd_tra.expediente WHERE expediente_id = p_expediente_accesorio FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Expediente accesorio no encontrado: %', p_expediente_accesorio
            USING ERRCODE = '02000';
    END IF;

    -- Localizar la acumulación activa
    SELECT id_acumulacion INTO v_id_acumulacion
      FROM sigd_tra.expediente_acumulacion
     WHERE expediente_principal = p_expediente_principal
       AND expediente_accesorio = p_expediente_accesorio
       AND estado = 'ACUMULADO'
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No existe una acumulación activa entre el principal % y el accesorio %',
            p_expediente_principal, p_expediente_accesorio
            USING ERRCODE = '02000';
    END IF;

    -- Actualizar el registro histórico a DESACUMULADO (sin borrar físicamente el historial)
    UPDATE sigd_tra.expediente_acumulacion
       SET estado = 'DESACUMULADO',
           fecha_desacumulacion = clock_timestamp(),
           usuario_desacumulacion_id = p_usuario_id,
           motivo_desacumulacion = p_motivo_desacumulacion,
           acto_desacumulacion = p_acto_desacumulacion
     WHERE id_acumulacion = v_id_acumulacion;

    RETURN v_id_acumulacion;
END;
$function$;

-- -----------------------------------------------------------------------------
-- 3. Estado de Desglose en sigd_doc.documento_adjunto
-- -----------------------------------------------------------------------------
ALTER TABLE sigd_doc.documento_adjunto
    ADD COLUMN IF NOT EXISTS desglosado BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS fecha_desglose TIMESTAMPTZ;

COMMENT ON COLUMN sigd_doc.documento_adjunto.desglosado IS
'Indica si el documento original fue desglosado formalmente y sustituido por copia fedateada.';

-- -----------------------------------------------------------------------------
-- 4. Tabla de Asientos de Desglose Documental (Art. 170 LPAG y Directiva AGN)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_tra.expediente_desglose_documental (
    id_desglose UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expediente_id UUID NOT NULL,
    documento_adjunto_id UUID NOT NULL,
    folio_inicio INTEGER NOT NULL,
    folio_fin INTEGER NOT NULL,
    cantidad_folios INTEGER NOT NULL,
    acto_autorizacion VARCHAR(150) NOT NULL,
    motivo_desglose TEXT NOT NULL,
    solicitante_nombre VARCHAR(255) NOT NULL,
    solicitante_documento VARCHAR(20) NOT NULL,
    usuario_desglose_id BIGINT NOT NULL,
    usuario_cuenta_id UUID,
    documento_sustitutorio_id UUID,
    id_movimiento UUID,
    fecha_desglose TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    observaciones TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_desglose_expediente FOREIGN KEY (expediente_id)
        REFERENCES sigd_tra.expediente (expediente_id) ON DELETE RESTRICT,
    CONSTRAINT fk_desglose_doc_adjunto FOREIGN KEY (documento_adjunto_id)
        REFERENCES sigd_doc.documento_adjunto (documento_adjunto_id) ON DELETE RESTRICT,
    CONSTRAINT fk_desglose_doc_sustituto FOREIGN KEY (documento_sustitutorio_id)
        REFERENCES sigd_doc.documento_adjunto (documento_adjunto_id) ON DELETE RESTRICT,
    CONSTRAINT chk_folios_desglose_valid CHECK (folio_inicio > 0 AND folio_fin >= folio_inicio AND cantidad_folios = (folio_fin - folio_inicio + 1)),
    CONSTRAINT chk_acto_desglose_not_empty CHECK (btrim(acto_autorizacion) <> ''),
    CONSTRAINT chk_motivo_desglose_not_empty CHECK (btrim(motivo_desglose) <> ''),
    CONSTRAINT chk_solicitante_not_empty CHECK (btrim(solicitante_nombre) <> '' AND btrim(solicitante_documento) <> '')
);

COMMENT ON TABLE sigd_tra.expediente_desglose_documental IS
'Asientos de desglose formal de documentos originales según Art. 170 LPAG y Directiva AGN N° 001-2019-AGN/DDPA.';

CREATE INDEX IF NOT EXISTS idx_exp_desglose_expediente
    ON sigd_tra.expediente_desglose_documental (expediente_id);

CREATE INDEX IF NOT EXISTS idx_exp_desglose_documento
    ON sigd_tra.expediente_desglose_documental (documento_adjunto_id);

CREATE INDEX IF NOT EXISTS idx_exp_desglose_sustituto
    ON sigd_tra.expediente_desglose_documental (documento_sustitutorio_id);

CREATE INDEX IF NOT EXISTS idx_exp_desglose_movimiento
    ON sigd_tra.expediente_desglose_documental (id_movimiento);

-- -----------------------------------------------------------------------------
-- 5. Función de Registro de Desglose Documental (Preserva foliación AGN)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sigd_tra.registrar_desglose_documental(
    p_expediente_id UUID,
    p_documento_adjunto_id UUID,
    p_acto_autorizacion VARCHAR(150),
    p_motivo_desglose TEXT,
    p_solicitante_nombre VARCHAR(255),
    p_solicitante_documento VARCHAR(20),
    p_usuario_desglose_id BIGINT,
    p_usuario_cuenta_id UUID DEFAULT NULL,
    p_documento_sustitutorio_id UUID DEFAULT NULL,
    p_observaciones TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $function$
DECLARE
    v_id_desglose UUID;
    v_folio_inicio INT;
    v_folio_fin INT;
    v_cantidad_folios INT;
BEGIN
    IF p_acto_autorizacion IS NULL OR btrim(p_acto_autorizacion) = '' THEN
        RAISE EXCEPTION 'El desglose exige un acto formal de autorización' USING ERRCODE = '22023';
    END IF;
    IF p_motivo_desglose IS NULL OR btrim(p_motivo_desglose) = '' THEN
        RAISE EXCEPTION 'El desglose exige una motivación justificada' USING ERRCODE = '22023';
    END IF;
    IF p_solicitante_nombre IS NULL OR btrim(p_solicitante_nombre) = '' OR
       p_solicitante_documento IS NULL OR btrim(p_solicitante_documento) = '' THEN
        RAISE EXCEPTION 'El solicitante del desglose debe estar debidamente individualizado' USING ERRCODE = '22023';
    END IF;

    -- Bloqueo pesimista del expediente
    PERFORM 1 FROM sigd_tra.expediente WHERE expediente_id = p_expediente_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Expediente no encontrado: %', p_expediente_id USING ERRCODE = '02000';
    END IF;

    -- Validar existencia y correspondencia del documento adjunto
    PERFORM 1 FROM sigd_doc.documento_adjunto
      WHERE documento_adjunto_id = p_documento_adjunto_id
        AND expediente_id = p_expediente_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Documento adjunto % no pertenece al expediente %', p_documento_adjunto_id, p_expediente_id
            USING ERRCODE = '02000';
    END IF;

    -- Validar que no haya sido desglosado ya
    IF EXISTS (
        SELECT 1 FROM sigd_tra.expediente_desglose_documental
         WHERE documento_adjunto_id = p_documento_adjunto_id
    ) THEN
        RAISE EXCEPTION 'El documento % ya fue desglosado formalmente con anterioridad', p_documento_adjunto_id
            USING ERRCODE = '23505';
    END IF;

    -- Obtener rango de folios asignados
    SELECT folio_inicio, folio_fin INTO v_folio_inicio, v_folio_fin
      FROM sigd_tra.expediente_documento_folio
     WHERE expediente_id = p_expediente_id
       AND id_documento = p_documento_adjunto_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'El documento % no cuenta con asignación de folios en el expediente %',
            p_documento_adjunto_id, p_expediente_id
            USING ERRCODE = '02000';
    END IF;

    v_cantidad_folios := (v_folio_fin - v_folio_inicio + 1);

    -- Si se indica documento sustitutorio, validar que pertenezca al expediente
    IF p_documento_sustitutorio_id IS NOT NULL THEN
        IF p_documento_sustitutorio_id = p_documento_adjunto_id THEN
            RAISE EXCEPTION 'El documento sustitutorio no puede ser el mismo documento que se desglosa'
                USING ERRCODE = '22023';
        END IF;
        PERFORM 1 FROM sigd_doc.documento_adjunto
          WHERE documento_adjunto_id = p_documento_sustitutorio_id
            AND expediente_id = p_expediente_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Documento sustitutorio % no pertenece al expediente %', p_documento_sustitutorio_id, p_expediente_id
                USING ERRCODE = '02000';
        END IF;
    END IF;

    -- Marcar documento como desglosado
    UPDATE sigd_doc.documento_adjunto
       SET desglosado = TRUE,
           fecha_desglose = clock_timestamp()
     WHERE documento_adjunto_id = p_documento_adjunto_id;

    -- Insertar asiento de desglose documental (preservando intacta la foliación AGN)
    INSERT INTO sigd_tra.expediente_desglose_documental (
        expediente_id, documento_adjunto_id, folio_inicio, folio_fin, cantidad_folios,
        acto_autorizacion, motivo_desglose, solicitante_nombre, solicitante_documento,
        usuario_desglose_id, usuario_cuenta_id, documento_sustitutorio_id, observaciones
    ) VALUES (
        p_expediente_id, p_documento_adjunto_id, v_folio_inicio, v_folio_fin, v_cantidad_folios,
        p_acto_autorizacion, p_motivo_desglose, p_solicitante_nombre, p_solicitante_documento,
        p_usuario_desglose_id, p_usuario_cuenta_id, p_documento_sustitutorio_id, p_observaciones
    ) RETURNING id_desglose INTO v_id_desglose;

    RETURN v_id_desglose;
END;
$function$;

-- -----------------------------------------------------------------------------
-- 6. Asignación de Privilegios DCL a Roles Operativos
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sigd_app') THEN
        GRANT SELECT, INSERT, UPDATE ON sigd_tra.expediente_acumulacion TO sigd_app;
        GRANT SELECT, INSERT, UPDATE ON sigd_tra.expediente_desglose_documental TO sigd_app;
        GRANT SELECT, UPDATE ON sigd_doc.documento_adjunto TO sigd_app;
        GRANT EXECUTE ON FUNCTION sigd_tra.desacumular_expediente(UUID, UUID, TEXT, TEXT, UUID) TO sigd_app;
        GRANT EXECUTE ON FUNCTION sigd_tra.registrar_desglose_documental(UUID, UUID, VARCHAR, TEXT, VARCHAR, VARCHAR, BIGINT, UUID, UUID, TEXT) TO sigd_app;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sigd_jacobo_user') THEN
        GRANT SELECT, INSERT, UPDATE ON sigd_tra.expediente_acumulacion TO sigd_jacobo_user;
        GRANT SELECT, INSERT, UPDATE ON sigd_tra.expediente_desglose_documental TO sigd_jacobo_user;
        GRANT SELECT, UPDATE ON sigd_doc.documento_adjunto TO sigd_jacobo_user;
        GRANT EXECUTE ON FUNCTION sigd_tra.desacumular_expediente(UUID, UUID, TEXT, TEXT, UUID) TO sigd_jacobo_user;
        GRANT EXECUTE ON FUNCTION sigd_tra.registrar_desglose_documental(UUID, UUID, VARCHAR, TEXT, VARCHAR, VARCHAR, BIGINT, UUID, UUID, TEXT) TO sigd_jacobo_user;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sigd_auditor') THEN
        GRANT SELECT ON sigd_tra.expediente_acumulacion TO sigd_auditor;
        GRANT SELECT ON sigd_tra.expediente_desglose_documental TO sigd_auditor;
        GRANT SELECT ON sigd_doc.documento_adjunto TO sigd_auditor;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sigd_test_ro') THEN
        GRANT SELECT ON sigd_tra.expediente_acumulacion TO sigd_test_ro;
        GRANT SELECT ON sigd_tra.expediente_desglose_documental TO sigd_test_ro;
        GRANT SELECT ON sigd_doc.documento_adjunto TO sigd_test_ro;
    END IF;
END $$;
