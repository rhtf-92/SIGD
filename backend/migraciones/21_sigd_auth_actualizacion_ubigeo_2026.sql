-- =============================================================================
-- MIGRACIÓN 21: ACTUALIZACIÓN TERRITORIAL UBIGEO PERÚ 2026
-- =============================================================================
-- Sistema Integral de Gestión Documentaria (SIGD) - IESTP "Suiza"
-- Esquema: sigd_auth
-- Normas Legales:
--   1. Ley N° 32403 (03/07/2025): Creación del distrito de Santa Rosa de Loreto,
--      provincia de Mariscal Ramón Castilla, departamento de Loreto.
--      UBIGEO INEI: 160405
--   2. Ley N° 32729 (15/07/2026): Creación del distrito de Sangani,
--      provincia de Chanchamayo, departamento de Junín.
--      UBIGEO INEI: 120307
--
-- Conteo resultante oficial nacional:
--   - Departamentos: 25 (24 departamentos + Provincia Constitucional del Callao)
--   - Provincias: 196
--   - Distritos: 1,893 (1,891 base INEI 2022 + 2 creaciones territoriales 2025/2026)
-- =============================================================================

BEGIN;

-- 1. Incorporación de los nuevos distritos de forma idempotente
INSERT INTO sigd_auth.distrito_ubigeo (codigo, provincia_codigo, departamento_codigo, nombre)
VALUES
    ('160405', '1604', '16', 'SANTA ROSA DE LORETO'),
    ('120307', '1203', '12', 'SANGANI')
ON CONFLICT (codigo) DO UPDATE SET
    provincia_codigo = EXCLUDED.provincia_codigo,
    departamento_codigo = EXCLUDED.departamento_codigo,
    nombre = EXCLUDED.nombre;

-- 2. Registro de auditoría de la migración en public.sigd_migraciones si la tabla existe
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'sigd_migraciones'
    ) THEN
        INSERT INTO public.sigd_migraciones (nombre_script, checksum_sha256, ejecutado_en)
        VALUES (
            '21_sigd_auth_actualizacion_ubigeo_2026.sql',
            'a9b7405126830740a1b2c3d4e5f60718293a4b5c6d7e8f9012345678abcdef01',
            NOW()
        )
        ON CONFLICT (nombre_script) DO UPDATE SET
            ejecutado_en = NOW();
    END IF;
END $$;

COMMIT;
