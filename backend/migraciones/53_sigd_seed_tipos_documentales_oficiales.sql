-- ==============================================================================
-- MIGRACIÓN 53: Semilla Oficial de Tipos Documentales Institucionales (SIGD 2026)
-- ARCHIVO: 53_sigd_seed_tipos_documentales_oficiales.sql
-- ==============================================================================

BEGIN;

INSERT INTO sigd_doc.tipo_documento (
    codigo,
    nombre,
    extension,
    mime_type,
    tamano_maximo_mb,
    exige_firma,
    vigente
) VALUES
    ('SOLICITUD', 'Solicitud General / FUT', 'pdf', 'application/pdf', 25, false, true),
    ('OFICIO', 'Oficio Institucional', 'pdf', 'application/pdf', 25, true, true),
    ('INFORME', 'Informe Técnico / Académico', 'pdf', 'application/pdf', 25, true, true),
    ('MEMORANDO', 'Memorando Interno', 'pdf', 'application/pdf', 25, true, true),
    ('RESOLUCION', 'Resolución Directoral', 'pdf', 'application/pdf', 25, true, true),
    ('CERTIFICADO', 'Certificado Oficial de Suficiencia / Estudios', 'pdf', 'application/pdf', 25, true, true),
    ('PROVEIDO', 'Proveído de Derivación', 'pdf', 'application/pdf', 25, false, true),
    ('CARTA', 'Carta Administrativa', 'pdf', 'application/pdf', 25, false, true)
ON CONFLICT (codigo) DO UPDATE
    SET vigente = EXCLUDED.vigente,
        nombre = EXCLUDED.nombre,
        tamano_maximo_mb = EXCLUDED.tamano_maximo_mb;

COMMIT;
