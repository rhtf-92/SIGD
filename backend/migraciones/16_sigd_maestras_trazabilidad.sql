-- ============================================================================
-- MIGRACIÓN 16: Población de Tablas Maestras para Trazabilidad Documental
-- Esquemas: sigd_doc, sigd_org
-- Catálogo oficial de tipos documentales y unidades orgánicas (ltree jerárquico)
-- ============================================================================

BEGIN;

-- 1. Catálogo oficial de tipos documentales para soporte de expedientes y trazabilidad
INSERT INTO sigd_doc.tipo_documento (codigo, nombre, extension, mime_type, tamano_maximo_mb, exige_firma, vigente)
VALUES
    ('SOL', 'Solicitud / Formato Único de Trámite (FUT)', 'pdf', 'application/pdf', 25, FALSE, TRUE),
    ('OFI', 'Oficio Institucional', 'pdf', 'application/pdf', 25, TRUE, TRUE),
    ('MEMO', 'Memorando Interno de Despacho', 'pdf', 'application/pdf', 20, TRUE, TRUE),
    ('INF', 'Informe Técnico / Legal / Académico', 'pdf', 'application/pdf', 35, TRUE, TRUE),
    ('RD', 'Resolución Directoral', 'pdf', 'application/pdf', 50, TRUE, TRUE),
    ('PROV', 'Proveído de Pase y Derivación', 'pdf', 'application/pdf', 15, FALSE, TRUE),
    ('NOTIF', 'Cédula de Notificación Electrónica', 'pdf', 'application/pdf', 20, TRUE, TRUE),
    ('CONST', 'Constancia Oficial / Certificado Académico', 'pdf', 'application/pdf', 20, TRUE, TRUE),
    ('ACT', 'Acta de Evaluación / Notas Oficiales', 'pdf', 'application/pdf', 30, TRUE, TRUE),
    ('DEC_JUR', 'Declaración Jurada (Art. 51 LPAG)', 'pdf', 'application/pdf', 20, FALSE, TRUE)
ON CONFLICT (codigo) DO UPDATE
SET nombre = EXCLUDED.nombre,
    tamano_maximo_mb = EXCLUDED.tamano_maximo_mb,
    exige_firma = EXCLUDED.exige_firma,
    vigente = EXCLUDED.vigente;

-- 2. Estructura orgánica institucional oficial (IESTP Suiza - Ucayali)
-- Inserción por niveles jerárquicos para que el trigger tr_area_set_path calcule la ruta ltree
-- Nivel 1: Dirección General
INSERT INTO sigd_org.area (codigo, nombre, area_padre_id, vigente)
VALUES ('ARE_DIR', 'Dirección General', NULL, TRUE)
ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre, vigente = TRUE;

-- Nivel 2: Dependencias directas de Dirección General
INSERT INTO sigd_org.area (codigo, nombre, area_padre_id, vigente)
SELECT 'ARE_SEC', 'Secretaría Académica', area_id, TRUE
FROM sigd_org.area WHERE codigo = 'ARE_DIR'
ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre, vigente = TRUE;

INSERT INTO sigd_org.area (codigo, nombre, area_padre_id, vigente)
SELECT 'ARE_MPV', 'Mesa de Partes y Ventanilla', area_id, TRUE
FROM sigd_org.area WHERE codigo = 'ARE_DIR'
ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre, vigente = TRUE;

INSERT INTO sigd_org.area (codigo, nombre, area_padre_id, vigente)
SELECT 'ARE_ADM', 'Administración y Finanzas', area_id, TRUE
FROM sigd_org.area WHERE codigo = 'ARE_DIR'
ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre, vigente = TRUE;

-- Nivel 3: Subunidades dependientes de Administración
INSERT INTO sigd_org.area (codigo, nombre, area_padre_id, vigente)
SELECT 'ARE_ARC', 'Archivo Central y Acervo Documentario', area_id, TRUE
FROM sigd_org.area WHERE codigo = 'ARE_ADM'
ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre, vigente = TRUE;

INSERT INTO sigd_org.area (codigo, nombre, area_padre_id, vigente)
SELECT 'ARE_DSI', 'Coordinación de Desarrollo de Sistemas e Informática', area_id, TRUE
FROM sigd_org.area WHERE codigo = 'ARE_ADM'
ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre, vigente = TRUE;

COMMIT;
