-- ============================================================================
-- Migración 36 (Aditiva y Reversible): Módulo de Anotaciones Internas de Seguimiento
-- Alcance: Creación de la tabla inmutable sigd_rut.expediente_anotacion_interna,
-- triggers de protección append-only (sin UPDATE ni DELETE) e índices de consulta.
-- Reglas B_JACOBO: Sin BEGIN/COMMIT de nivel superior ni INSERT en public.sigd_migraciones.
-- NOTA DE CONTROL: Archivo de migración versionado para despliegue controlado.
-- ============================================================================

CREATE TABLE IF NOT EXISTS sigd_rut.expediente_anotacion_interna (
    id_anotacion UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expediente_id UUID NOT NULL REFERENCES sigd_tra.expediente(expediente_id) ON DELETE RESTRICT,
    id_asignacion UUID REFERENCES sigd_rut.expediente_evaluador(id_asignacion) ON DELETE SET NULL,
    usuario_id UUID NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
    rol_codigo VARCHAR(50) NOT NULL,
    area_id UUID NOT NULL REFERENCES sigd_org.area(area_id) ON DELETE RESTRICT,
    tipo_anotacion VARCHAR(30) NOT NULL DEFAULT 'SEGUIMIENTO' CHECK (
        tipo_anotacion IN ('SEGUIMIENTO', 'SUPERVISION', 'INCIDENCIA')
    ),
    contenido TEXT NOT NULL CHECK (
        char_length(trim(contenido)) >= 10 AND char_length(contenido) <= 2000
    ),
    anotacion_padre_id UUID REFERENCES sigd_rut.expediente_anotacion_interna(id_anotacion) ON DELETE RESTRICT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- Comentarios institucionales de tabla y columnas
COMMENT ON TABLE sigd_rut.expediente_anotacion_interna IS 'Registro histórico e inmutable (append-only) de actuaciones y anotaciones internas de seguimiento académico entre evaluadores y coordinación.';
COMMENT ON COLUMN sigd_rut.expediente_anotacion_interna.id_anotacion IS 'Identificador único de la anotación interna.';
COMMENT ON COLUMN sigd_rut.expediente_anotacion_interna.expediente_id IS 'Identificador del expediente al que pertenece la actuación de seguimiento.';
COMMENT ON COLUMN sigd_rut.expediente_anotacion_interna.id_asignacion IS 'Asignación activa del docente evaluador relacionada con la anotación, si aplica.';
COMMENT ON COLUMN sigd_rut.expediente_anotacion_interna.usuario_id IS 'Identificador del usuario autor real que registra la anotación institucional.';
COMMENT ON COLUMN sigd_rut.expediente_anotacion_interna.rol_codigo IS 'Rol institucional efectivo con el que se emite la anotación (DOCENTE, COORDINADOR_AREA, etc.).';
COMMENT ON COLUMN sigd_rut.expediente_anotacion_interna.area_id IS 'Área o unidad orgánica institucional donde se produce la actuación.';
COMMENT ON COLUMN sigd_rut.expediente_anotacion_interna.tipo_anotacion IS 'Tipo normativo: SEGUIMIENTO (técnico), SUPERVISION (coordinación) o INCIDENCIA (bloqueos/actas).';
COMMENT ON COLUMN sigd_rut.expediente_anotacion_interna.contenido IS 'Texto íntegro de la anotación (entre 10 y 2,000 caracteres).';
COMMENT ON COLUMN sigd_rut.expediente_anotacion_interna.anotacion_padre_id IS 'Referencia opcional a una anotación previa para aclaraciones o ampliaciones estructuradas.';
COMMENT ON COLUMN sigd_rut.expediente_anotacion_interna.creado_en IS 'Marca de tiempo oficial del servidor generada en la persistencia.';

-- Índices de alto rendimiento para consulta cronológica y auditoría
CREATE INDEX IF NOT EXISTS idx_anotacion_interna_expediente_fecha
    ON sigd_rut.expediente_anotacion_interna (expediente_id, creado_en ASC);

CREATE INDEX IF NOT EXISTS idx_anotacion_interna_usuario
    ON sigd_rut.expediente_anotacion_interna (usuario_id);

CREATE INDEX IF NOT EXISTS idx_anotacion_interna_asignacion
    ON sigd_rut.expediente_anotacion_interna (id_asignacion);

CREATE INDEX IF NOT EXISTS idx_anotacion_interna_padre
    ON sigd_rut.expediente_anotacion_interna (anotacion_padre_id);

-- Función y Trigger de Inmutabilidad Estricta (Append-Only)
CREATE OR REPLACE FUNCTION sigd_rut.fn_expediente_anotacion_interna_inmutable()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'Las anotaciones internas de seguimiento son estrictamente inmutables (append-only) y no admiten modificación posterior. Registre una nueva anotación vinculada si requiere formular una aclaración o ampliación institucional.'
            USING ERRCODE = '55000';
    ELSIF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Las anotaciones internas de seguimiento forman parte de la trazabilidad institucional inmutable y no admiten eliminación.'
            USING ERRCODE = '55000';
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_expediente_anotacion_interna_inmutable ON sigd_rut.expediente_anotacion_interna;
CREATE TRIGGER trg_expediente_anotacion_interna_inmutable
    BEFORE UPDATE OR DELETE ON sigd_rut.expediente_anotacion_interna
    FOR EACH ROW
    EXECUTE FUNCTION sigd_rut.fn_expediente_anotacion_interna_inmutable();
