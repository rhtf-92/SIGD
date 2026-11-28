-- =============================================================================
-- Migración 17: Semilla de Feriados Nacionales e Institucionales 2026
-- Marco Legal: D. Leg. N° 713, Ley N° 31530, Ley N° 31788 y Ley N° 29001
-- Entidad: IESTP Suiza (Pucallpa, Ucayali)
-- =============================================================================

INSERT INTO sigd_org.calendario_laboral (
    fecha, tipo_feriado, descripcion, unidad_territorial, es_laborable, base_legal, activo
) VALUES
    ('2026-01-01', 'NACIONAL', 'Año Nuevo', 'NACIONAL', FALSE, 'D. Leg. N° 713', TRUE),
    ('2026-04-02', 'NACIONAL', 'Jueves Santo', 'NACIONAL', FALSE, 'D. Leg. N° 713', TRUE),
    ('2026-04-03', 'NACIONAL', 'Viernes Santo', 'NACIONAL', FALSE, 'D. Leg. N° 713', TRUE),
    ('2026-05-01', 'NACIONAL', 'Día del Trabajo', 'NACIONAL', FALSE, 'D. Leg. N° 713', TRUE),
    ('2026-06-07', 'NACIONAL', 'Batalla de Arica y Día de la Bandera', 'NACIONAL', FALSE, 'Ley N° 31788', TRUE),
    ('2026-06-29', 'NACIONAL', 'San Pedro y San Pablo', 'NACIONAL', FALSE, 'D. Leg. N° 713', TRUE),
    ('2026-07-23', 'NACIONAL', 'Día de la Fuerza Aérea del Perú', 'NACIONAL', FALSE, 'Ley N° 31822', TRUE),
    ('2026-07-28', 'NACIONAL', 'Fiestas Patrias (Primer día)', 'NACIONAL', FALSE, 'D. Leg. N° 713', TRUE),
    ('2026-07-29', 'NACIONAL', 'Fiestas Patrias (Segundo día)', 'NACIONAL', FALSE, 'D. Leg. N° 713', TRUE),
    ('2026-08-06', 'NACIONAL', 'Batalla de Junín', 'NACIONAL', FALSE, 'Ley N° 31530', TRUE),
    ('2026-08-30', 'NACIONAL', 'Santa Rosa de Lima', 'NACIONAL', FALSE, 'D. Leg. N° 713', TRUE),
    ('2026-10-08', 'NACIONAL', 'Combate de Angamos', 'NACIONAL', FALSE, 'D. Leg. N° 713', TRUE),
    ('2026-11-01', 'NACIONAL', 'Día de Todos los Santos', 'NACIONAL', FALSE, 'D. Leg. N° 713', TRUE),
    ('2026-12-08', 'NACIONAL', 'Inmaculada Concepción', 'NACIONAL', FALSE, 'D. Leg. N° 713', TRUE),
    ('2026-12-09', 'NACIONAL', 'Batalla de Ayacucho', 'NACIONAL', FALSE, 'Ley N° 31381', TRUE),
    ('2026-12-25', 'NACIONAL', 'Navidad del Señor', 'NACIONAL', FALSE, 'D. Leg. N° 713', TRUE),
    ('2026-11-20', 'INSTITUCIONAL', 'Aniversario Institucional IESTP Suiza', 'IESTP_SUIZA', FALSE, 'Resolución Directoral IESTP Suiza', TRUE)
ON CONFLICT (fecha, unidad_territorial) 
DO UPDATE SET 
    descripcion = EXCLUDED.descripcion,
    base_legal = EXCLUDED.base_legal,
    tipo_feriado = EXCLUDED.tipo_feriado,
    activo = TRUE,
    actualizado_en = now();
