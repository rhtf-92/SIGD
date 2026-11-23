-- =============================================================================
-- MIGRACIÓN 37: CÓMPUTO DE 15 DÍAS HÁBILES Y FERIADOS NACIONALES 2026
-- Institución: IESTP Público «Suiza» — Pucallpa, Ucayali
-- =============================================================================

-- 1. Feriados Nacionales Oficiales 2026 (D. Leg. N° 713 y leyes complementarias)
INSERT INTO sigd_org.calendario_laboral (
    fecha, tipo_feriado, descripcion, unidad_territorial, es_laborable, base_legal
) VALUES
('2026-01-01', 'NACIONAL', 'Año Nuevo', 'NACIONAL', FALSE, 'D. Leg. N° 713'),
('2026-04-02', 'NACIONAL', 'Jueves Santo', 'NACIONAL', FALSE, 'D. Leg. N° 713'),
('2026-04-03', 'NACIONAL', 'Viernes Santo', 'NACIONAL', FALSE, 'D. Leg. N° 713'),
('2026-05-01', 'NACIONAL', 'Día del Trabajo', 'NACIONAL', FALSE, 'D. Leg. N° 713'),
('2026-06-07', 'NACIONAL', 'Batalla de Arica y Día de la Bandera', 'NACIONAL', FALSE, 'Ley N° 31788'),
('2026-06-29', 'NACIONAL', 'San Pedro y San Pablo', 'NACIONAL', FALSE, 'D. Leg. N° 713'),
('2026-07-23', 'NACIONAL', 'Día de la Fuerza Aérea del Perú — José Quiñones', 'NACIONAL', FALSE, 'Ley N° 31822'),
('2026-07-28', 'NACIONAL', 'Fiestas Patrias — Día de la Independencia', 'NACIONAL', FALSE, 'D. Leg. N° 713'),
('2026-07-29', 'NACIONAL', 'Fiestas Patrias — Día de las FF.AA. y PNP', 'NACIONAL', FALSE, 'D. Leg. N° 713'),
('2026-08-06', 'NACIONAL', 'Batalla de Junín', 'NACIONAL', FALSE, 'Ley N° 31530'),
('2026-08-30', 'NACIONAL', 'Santa Rosa de Lima', 'NACIONAL', FALSE, 'D. Leg. N° 713'),
('2026-10-08', 'NACIONAL', 'Combate de Angamos', 'NACIONAL', FALSE, 'D. Leg. N° 713'),
('2026-11-01', 'NACIONAL', 'Día de Todos los Santos', 'NACIONAL', FALSE, 'D. Leg. N° 713'),
('2026-12-08', 'NACIONAL', 'Inmaculada Concepción', 'NACIONAL', FALSE, 'D. Leg. N° 713'),
('2026-12-09', 'NACIONAL', 'Batalla de Ayacucho', 'NACIONAL', FALSE, 'Ley N° 31381'),
('2026-12-25', 'NACIONAL', 'Navidad del Señor', 'NACIONAL', FALSE, 'D. Leg. N° 713')
ON CONFLICT (fecha, unidad_territorial) DO UPDATE
SET descripcion = EXCLUDED.descripcion,
    base_legal = EXCLUDED.base_legal,
    es_laborable = EXCLUDED.es_laborable,
    tipo_feriado = EXCLUDED.tipo_feriado,
    activo = TRUE,
    actualizado_en = now();

-- 2. Tabla de habilitación y cómputo de 15 días hábiles post-pago
CREATE TABLE IF NOT EXISTS sigd_tra.expediente_habilitacion (
    expediente_id                  UUID NOT NULL PRIMARY KEY REFERENCES sigd_tra.expediente(expediente_id) ON DELETE RESTRICT,
    requiere_pago                  BOOLEAN NOT NULL DEFAULT TRUE,
    orden_id                       UUID NULL REFERENCES sigd_tes.orden_pago(id) ON DELETE SET NULL,
    pago_id                        UUID NULL REFERENCES sigd_tes.pago(id) ON DELETE SET NULL,
    estado_pago                    VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
    fecha_confirmacion_pago        TIMESTAMPTZ NULL,
    fecha_inicio_computo           DATE NULL,
    dias_habiles_regla             INT NOT NULL DEFAULT 15,
    fecha_habilitacion             DATE NULL,
    habilitado                     BOOLEAN NOT NULL DEFAULT FALSE,
    evento_habilitacion_emitido    BOOLEAN NOT NULL DEFAULT FALSE,
    creado_en                      TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expediente_habilitacion_estado
    ON sigd_tra.expediente_habilitacion (habilitado, estado_pago);

CREATE INDEX IF NOT EXISTS idx_expediente_habilitacion_fechas
    ON sigd_tra.expediente_habilitacion (fecha_habilitacion);
