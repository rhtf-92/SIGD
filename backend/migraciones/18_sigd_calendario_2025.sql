-- =============================================================================
-- Migración 18: Semilla Oficial del Calendario Laboral 2025 (Histórico gob.pe)
-- Marco Legal: D. Leg. N° 713, D.S. N° 042-2025-PCM, Ley N° 29001, Leyes N° 31381, 31530, 31788, 31822
-- Entidad: IESTP Suiza (Pucallpa, Ucayali)
-- =============================================================================

INSERT INTO sigd_org.calendario_laboral (
    fecha, tipo_feriado, descripcion, unidad_territorial, es_laborable, base_legal, activo
) VALUES
    ('2025-01-01', 'NACIONAL', 'Año Nuevo', 'NACIONAL', FALSE, 'D. Leg. N° 713', TRUE),
    ('2025-04-17', 'NACIONAL', 'Jueves Santo', 'NACIONAL', FALSE, 'D. Leg. N° 713', TRUE),
    ('2025-04-18', 'NACIONAL', 'Viernes Santo', 'NACIONAL', FALSE, 'D. Leg. N° 713', TRUE),
    ('2025-05-01', 'NACIONAL', 'Día del Trabajo', 'NACIONAL', FALSE, 'D. Leg. N° 713', TRUE),
    ('2025-05-02', 'NACIONAL', 'Día No Laborable Compensable (Sector Público)', 'NACIONAL', FALSE, 'D.S. N° 042-2025-PCM', TRUE),
    ('2025-06-07', 'NACIONAL', 'Batalla de Arica y Día de la Bandera', 'NACIONAL', FALSE, 'Ley N° 31788', TRUE),
    ('2025-06-24', 'REGIONAL_UCAYALI', 'Fiesta Patronal de San Juan Bautista', 'UCAYALI', FALSE, 'Ley N° 29001', TRUE),
    ('2025-06-29', 'NACIONAL', 'San Pedro y San Pablo', 'NACIONAL', FALSE, 'D. Leg. N° 713', TRUE),
    ('2025-07-23', 'NACIONAL', 'Día de la Fuerza Aérea del Perú', 'NACIONAL', FALSE, 'Ley N° 31822', TRUE),
    ('2025-07-28', 'NACIONAL', 'Fiestas Patrias (Primer día)', 'NACIONAL', FALSE, 'D. Leg. N° 713', TRUE),
    ('2025-07-29', 'NACIONAL', 'Fiestas Patrias (Segundo día)', 'NACIONAL', FALSE, 'D. Leg. N° 713', TRUE),
    ('2025-08-06', 'NACIONAL', 'Batalla de Junín', 'NACIONAL', FALSE, 'Ley N° 31530', TRUE),
    ('2025-08-30', 'NACIONAL', 'Santa Rosa de Lima', 'NACIONAL', FALSE, 'D. Leg. N° 713', TRUE),
    ('2025-10-08', 'NACIONAL', 'Combate de Angamos', 'NACIONAL', FALSE, 'D. Leg. N° 713', TRUE),
    ('2025-10-13', 'REGIONAL_UCAYALI', 'Aniversario de Creación de Ucayali', 'UCAYALI', FALSE, 'Ley N° 29001', TRUE),
    ('2025-11-01', 'NACIONAL', 'Día de Todos los Santos', 'NACIONAL', FALSE, 'D. Leg. N° 713', TRUE),
    ('2025-11-20', 'INSTITUCIONAL', 'Aniversario Institucional IESTP Suiza', 'IESTP_SUIZA', FALSE, 'Resolución Directoral IESTP Suiza', TRUE),
    ('2025-12-08', 'NACIONAL', 'Inmaculada Concepción', 'NACIONAL', FALSE, 'D. Leg. N° 713', TRUE),
    ('2025-12-09', 'NACIONAL', 'Batalla de Ayacucho', 'NACIONAL', FALSE, 'Ley N° 31381', TRUE),
    ('2025-12-25', 'NACIONAL', 'Navidad del Señor', 'NACIONAL', FALSE, 'D. Leg. N° 713', TRUE),
    ('2025-12-26', 'NACIONAL', 'Día No Laborable Compensable (Sector Público)', 'NACIONAL', FALSE, 'D.S. N° 042-2025-PCM', TRUE)
ON CONFLICT (fecha, unidad_territorial)
DO UPDATE SET
    descripcion = EXCLUDED.descripcion,
    base_legal = EXCLUDED.base_legal,
    tipo_feriado = EXCLUDED.tipo_feriado,
    es_laborable = EXCLUDED.es_laborable,
    activo = TRUE,
    actualizado_en = now();
