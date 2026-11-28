-- =============================================================================
-- MIGRACIÓN 38: EXTENSIÓN DE COLUMNAS DE TRAZABILIDAD Y CÓMPUTO DE PLAZO
-- Institución: IESTP «Suiza» — Pucallpa, Ucayali
-- Reglas B_JACOBO: Sin BEGIN/COMMIT de nivel superior ni INSERT en public.sigd_migraciones.
-- =============================================================================

ALTER TABLE sigd_tra.expediente_habilitacion
    ADD COLUMN IF NOT EXISTS fecha_radicacion TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS fecha_vencimiento_pago DATE NULL,
    ADD COLUMN IF NOT EXISTS estado_plazo VARCHAR(30) NULL DEFAULT 'EN_PLAZO',
    ADD COLUMN IF NOT EXISTS motivo_cierre VARCHAR(50) NULL,
    ADD COLUMN IF NOT EXISTS cerrado_por_falta_pago_en TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_expediente_habilitacion_vencimiento
    ON sigd_tra.expediente_habilitacion (fecha_vencimiento_pago, estado_plazo);

COMMENT ON COLUMN sigd_tra.expediente_habilitacion.fecha_radicacion IS 'Fecha legal de radicación del trámite.';
COMMENT ON COLUMN sigd_tra.expediente_habilitacion.fecha_vencimiento_pago IS 'Fecha de vencimiento legal del plazo perentorio de 15 días hábiles para el pago.';
COMMENT ON COLUMN sigd_tra.expediente_habilitacion.estado_plazo IS 'Estado del plazo perentorio: EN_PLAZO, PAGADO, VENCIDO.';
COMMENT ON COLUMN sigd_tra.expediente_habilitacion.motivo_cierre IS 'Motivo de archivo o cierre si aplica (ej. FALTA_DE_PAGO).';
COMMENT ON COLUMN sigd_tra.expediente_habilitacion.cerrado_por_falta_pago_en IS 'Marca de tiempo en la que se ejecutó el cierre por falta de pago.';
