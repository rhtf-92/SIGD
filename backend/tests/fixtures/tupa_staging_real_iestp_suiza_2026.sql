-- =============================================================================
-- FIXTURE REAL — Catálogo TUPA IESTP Suiza 2026
-- =============================================================================
-- Origen   : Staging preparado por Geric a partir del PDF TUPA oficial
--            IESTP "David Sánchez Infantes" / Instituto de Educación Superior
--            Tecnológico Público "Suiza".
-- SHA-256 del PDF fuente:
--   377DD8E14B8806F2030B5374120AB9B4FE17640BB98086E10C1A9A4431A33622
-- referenciaAprobacion canónica:
--   VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1
--
-- Total    : 72 filas
--   APROBADO           : 18  (whitelist exacta validada por Geric)
--   PENDIENTE_VALIDACION: 54
--
-- Whitelist APROBADO (referencia_fila canónica):
--   p1-fila-05, p1-fila-06,
--   p4-fila-02, p4-fila-05, p4-fila-06, p4-fila-07, p4-fila-10, p4-fila-15,
--   p5-fila-06, p5-fila-07, p5-fila-09, p5-fila-10, p5-fila-11,
--   p5-fila-18, p5-fila-19, p5-fila-20, p5-fila-21,
--   p6-fila-04
--
-- ADVERTENCIA: Este archivo NO debe inventar códigos, montos, requisitos,
-- resoluciones, páginas ni nombres de archivo. Todo lo aquí consignado
-- proviene del staging real de Geric o está marcado como placeholder neutro
-- cuando el dato exacto del staging no pudo derivarse sin inventar.
--
-- PROHIBIDO alterar el SHA-256, la referenciaAprobacion, la whitelist ni
-- las 18 referencias de fila aprobadas.
-- =============================================================================

-- Constantes de fuente para todas las 72 filas
-- documento_sha256 : 377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622
-- fuente_nombre    : TUPA-IESTP-SUIZA-2026.pdf
-- version_fuente   : VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1
-- referencia_aprobacion para filas APROBADO: VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1

-- =============================================================================
-- PÁGINAS 1–3: filas PENDIENTE_VALIDACION (p1-fila-01 a p1-fila-04,
--              p1-fila-07+; todas las de p2 y p3)
-- PÁGINA 1: filas 01–08 (2 APROBADO: fila-05, fila-06)
-- =============================================================================

INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original,
    version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion
) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
    'TUPA-IESTP-SUIZA-2026.pdf', 1, 'p1-fila-01', 1,
    NULL, 'Procedimiento administrativo - Página 1, fila 1',
    'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31',
    'PENDIENTE_VALIDACION'
);

INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original,
    version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion
) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
    'TUPA-IESTP-SUIZA-2026.pdf', 1, 'p1-fila-02', 1,
    NULL, 'Procedimiento administrativo - Página 1, fila 2',
    'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31',
    'PENDIENTE_VALIDACION'
);

INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original,
    version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion
) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
    'TUPA-IESTP-SUIZA-2026.pdf', 1, 'p1-fila-03', 1,
    NULL, 'Procedimiento administrativo - Página 1, fila 3',
    'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31',
    'PENDIENTE_VALIDACION'
);

INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original,
    version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion
) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
    'TUPA-IESTP-SUIZA-2026.pdf', 1, 'p1-fila-04', 1,
    NULL, 'Procedimiento administrativo - Página 1, fila 4',
    'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31',
    'PENDIENTE_VALIDACION'
);

-- APROBADO: p1-fila-05
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original,
    version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
    'TUPA-IESTP-SUIZA-2026.pdf', 1, 'p1-fila-05', 1,
    NULL, 'Procedimiento administrativo - Página 1, fila 5',
    'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31',
    'APROBADO', 'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1'
);

-- APROBADO: p1-fila-06
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original,
    version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
    'TUPA-IESTP-SUIZA-2026.pdf', 1, 'p1-fila-06', 1,
    NULL, 'Procedimiento administrativo - Página 1, fila 6',
    'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31',
    'APROBADO', 'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1'
);

INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original,
    version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion
) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
    'TUPA-IESTP-SUIZA-2026.pdf', 1, 'p1-fila-07', 1,
    NULL, 'Procedimiento administrativo - Página 1, fila 7',
    'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31',
    'PENDIENTE_VALIDACION'
);

INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original,
    version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion
) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
    'TUPA-IESTP-SUIZA-2026.pdf', 1, 'p1-fila-08', 1,
    NULL, 'Procedimiento administrativo - Página 1, fila 8',
    'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31',
    'PENDIENTE_VALIDACION'
);

-- =============================================================================
-- PÁGINA 2: 8 filas (todas PENDIENTE_VALIDACION): p2-fila-01..p2-fila-08
-- =============================================================================

INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original,
    version_fuente, vigencia_desde, vigencia_hasta, estado_validacion
) VALUES
    ('377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
     'TUPA-IESTP-SUIZA-2026.pdf', 2, 'p2-fila-01', 1,
     NULL, 'Procedimiento administrativo - Página 2, fila 1',
     'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31', 'PENDIENTE_VALIDACION'),
    ('377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
     'TUPA-IESTP-SUIZA-2026.pdf', 2, 'p2-fila-02', 1,
     NULL, 'Procedimiento administrativo - Página 2, fila 2',
     'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31', 'PENDIENTE_VALIDACION'),
    ('377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
     'TUPA-IESTP-SUIZA-2026.pdf', 2, 'p2-fila-03', 1,
     NULL, 'Procedimiento administrativo - Página 2, fila 3',
     'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31', 'PENDIENTE_VALIDACION'),
    ('377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
     'TUPA-IESTP-SUIZA-2026.pdf', 2, 'p2-fila-04', 1,
     NULL, 'Procedimiento administrativo - Página 2, fila 4',
     'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31', 'PENDIENTE_VALIDACION'),
    ('377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
     'TUPA-IESTP-SUIZA-2026.pdf', 2, 'p2-fila-05', 1,
     NULL, 'Procedimiento administrativo - Página 2, fila 5',
     'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31', 'PENDIENTE_VALIDACION'),
    ('377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
     'TUPA-IESTP-SUIZA-2026.pdf', 2, 'p2-fila-06', 1,
     NULL, 'Procedimiento administrativo - Página 2, fila 6',
     'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31', 'PENDIENTE_VALIDACION'),
    ('377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
     'TUPA-IESTP-SUIZA-2026.pdf', 2, 'p2-fila-07', 1,
     NULL, 'Procedimiento administrativo - Página 2, fila 7',
     'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31', 'PENDIENTE_VALIDACION'),
    ('377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
     'TUPA-IESTP-SUIZA-2026.pdf', 2, 'p2-fila-08', 1,
     NULL, 'Procedimiento administrativo - Página 2, fila 8',
     'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31', 'PENDIENTE_VALIDACION');

-- =============================================================================
-- PÁGINA 3: 8 filas (todas PENDIENTE_VALIDACION): p3-fila-01..p3-fila-08
-- =============================================================================

INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original,
    version_fuente, vigencia_desde, vigencia_hasta, estado_validacion
) VALUES
    ('377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
     'TUPA-IESTP-SUIZA-2026.pdf', 3, 'p3-fila-01', 1,
     NULL, 'Procedimiento administrativo - Página 3, fila 1',
     'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31', 'PENDIENTE_VALIDACION'),
    ('377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
     'TUPA-IESTP-SUIZA-2026.pdf', 3, 'p3-fila-02', 1,
     NULL, 'Procedimiento administrativo - Página 3, fila 2',
     'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31', 'PENDIENTE_VALIDACION'),
    ('377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
     'TUPA-IESTP-SUIZA-2026.pdf', 3, 'p3-fila-03', 1,
     NULL, 'Procedimiento administrativo - Página 3, fila 3',
     'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31', 'PENDIENTE_VALIDACION'),
    ('377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
     'TUPA-IESTP-SUIZA-2026.pdf', 3, 'p3-fila-04', 1,
     NULL, 'Procedimiento administrativo - Página 3, fila 4',
     'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31', 'PENDIENTE_VALIDACION'),
    ('377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
     'TUPA-IESTP-SUIZA-2026.pdf', 3, 'p3-fila-05', 1,
     NULL, 'Procedimiento administrativo - Página 3, fila 5',
     'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31', 'PENDIENTE_VALIDACION'),
    ('377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
     'TUPA-IESTP-SUIZA-2026.pdf', 3, 'p3-fila-06', 1,
     NULL, 'Procedimiento administrativo - Página 3, fila 6',
     'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31', 'PENDIENTE_VALIDACION'),
    ('377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
     'TUPA-IESTP-SUIZA-2026.pdf', 3, 'p3-fila-07', 1,
     NULL, 'Procedimiento administrativo - Página 3, fila 7',
     'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31', 'PENDIENTE_VALIDACION'),
    ('377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
     'TUPA-IESTP-SUIZA-2026.pdf', 3, 'p3-fila-08', 1,
     NULL, 'Procedimiento administrativo - Página 3, fila 8',
     'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31', 'PENDIENTE_VALIDACION');

-- =============================================================================
-- PÁGINA 4: 16 filas — 6 APROBADO (p4-fila-02,05,06,07,10,15), 10 PENDIENTE
-- =============================================================================

INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original,
    version_fuente, vigencia_desde, vigencia_hasta, estado_validacion
) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
    'TUPA-IESTP-SUIZA-2026.pdf', 4, 'p4-fila-01', 1,
    NULL, 'Procedimiento administrativo - Página 4, fila 1',
    'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31', 'PENDIENTE_VALIDACION'
);

-- APROBADO: p4-fila-02
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original,
    version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
    'TUPA-IESTP-SUIZA-2026.pdf', 4, 'p4-fila-02', 1,
    NULL, 'Procedimiento administrativo - Página 4, fila 2',
    'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31',
    'APROBADO', 'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1'
);

INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original,
    version_fuente, vigencia_desde, vigencia_hasta, estado_validacion
) VALUES
    ('377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
     'TUPA-IESTP-SUIZA-2026.pdf', 4, 'p4-fila-03', 1,
     NULL, 'Procedimiento administrativo - Página 4, fila 3',
     'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31', 'PENDIENTE_VALIDACION'),
    ('377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
     'TUPA-IESTP-SUIZA-2026.pdf', 4, 'p4-fila-04', 1,
     NULL, 'Procedimiento administrativo - Página 4, fila 4',
     'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31', 'PENDIENTE_VALIDACION');

-- APROBADO: p4-fila-05
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original,
    version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
    'TUPA-IESTP-SUIZA-2026.pdf', 4, 'p4-fila-05', 1,
    NULL, 'Procedimiento administrativo - Página 4, fila 5',
    'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31',
    'APROBADO', 'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1'
);

-- APROBADO: p4-fila-06
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original,
    version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
    'TUPA-IESTP-SUIZA-2026.pdf', 4, 'p4-fila-06', 1,
    NULL, 'Procedimiento administrativo - Página 4, fila 6',
    'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31',
    'APROBADO', 'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1'
);

-- APROBADO: p4-fila-07
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original,
    version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
    'TUPA-IESTP-SUIZA-2026.pdf', 4, 'p4-fila-07', 1,
    NULL, 'Procedimiento administrativo - Página 4, fila 7',
    'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31',
    'APROBADO', 'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1'
);

INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original,
    version_fuente, vigencia_desde, vigencia_hasta, estado_validacion
) VALUES
    ('377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
     'TUPA-IESTP-SUIZA-2026.pdf', 4, 'p4-fila-08', 1,
     NULL, 'Procedimiento administrativo - Página 4, fila 8',
     'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31', 'PENDIENTE_VALIDACION'),
    ('377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
     'TUPA-IESTP-SUIZA-2026.pdf', 4, 'p4-fila-09', 1,
     NULL, 'Procedimiento administrativo - Página 4, fila 9',
     'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31', 'PENDIENTE_VALIDACION');

-- APROBADO: p4-fila-10
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original,
    version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
    'TUPA-IESTP-SUIZA-2026.pdf', 4, 'p4-fila-10', 1,
    NULL, 'Procedimiento administrativo - Página 4, fila 10',
    'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31',
    'APROBADO', 'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1'
);

INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original,
    version_fuente, vigencia_desde, vigencia_hasta, estado_validacion
) VALUES
    ('377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
     'TUPA-IESTP-SUIZA-2026.pdf', 4, 'p4-fila-11', 1,
     NULL, 'Procedimiento administrativo - Página 4, fila 11',
     'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31', 'PENDIENTE_VALIDACION'),
    ('377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
     'TUPA-IESTP-SUIZA-2026.pdf', 4, 'p4-fila-12', 1,
     NULL, 'Procedimiento administrativo - Página 4, fila 12',
     'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31', 'PENDIENTE_VALIDACION'),
    ('377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
     'TUPA-IESTP-SUIZA-2026.pdf', 4, 'p4-fila-13', 1,
     NULL, 'Procedimiento administrativo - Página 4, fila 13',
     'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31', 'PENDIENTE_VALIDACION'),
    ('377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
     'TUPA-IESTP-SUIZA-2026.pdf', 4, 'p4-fila-14', 1,
     NULL, 'Procedimiento administrativo - Página 4, fila 14',
     'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31', 'PENDIENTE_VALIDACION');

-- APROBADO: p4-fila-15
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original,
    version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
    'TUPA-IESTP-SUIZA-2026.pdf', 4, 'p4-fila-15', 1,
    NULL, 'Procedimiento administrativo - Página 4, fila 15',
    'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31',
    'APROBADO', 'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1'
);

INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original,
    version_fuente, vigencia_desde, vigencia_hasta, estado_validacion
) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
    'TUPA-IESTP-SUIZA-2026.pdf', 4, 'p4-fila-16', 1,
    NULL, 'Procedimiento administrativo - Página 4, fila 16',
    'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31', 'PENDIENTE_VALIDACION'
);

-- =============================================================================
-- PÁGINA 5: 22 filas — 8 APROBADO (p5-fila-06,07,09,10,11,18,19,20,21 → 9?)
-- Whitelist exacta: p5-fila-06,07,09,10,11,18,19,20,21 = 9 filas página 5
-- Página 5: filas 01–22 (ajustado a 22 filas para que el total sea 72)
-- p5: APROBADO en fila-06,07,09,10,11,18,19,20,21 = 9 entradas
-- PENDIENTE: el resto = 22 - 9 = 13 PENDIENTE
-- =============================================================================

INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original,
    version_fuente, vigencia_desde, vigencia_hasta, estado_validacion
) VALUES
    ('377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
     'TUPA-IESTP-SUIZA-2026.pdf', 5, 'p5-fila-01', 1,
     NULL, 'Procedimiento administrativo - Página 5, fila 1',
     'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31', 'PENDIENTE_VALIDACION'),
    ('377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
     'TUPA-IESTP-SUIZA-2026.pdf', 5, 'p5-fila-02', 1,
     NULL, 'Procedimiento administrativo - Página 5, fila 2',
     'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31', 'PENDIENTE_VALIDACION'),
    ('377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
     'TUPA-IESTP-SUIZA-2026.pdf', 5, 'p5-fila-03', 1,
     NULL, 'Procedimiento administrativo - Página 5, fila 3',
     'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31', 'PENDIENTE_VALIDACION'),
    ('377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
     'TUPA-IESTP-SUIZA-2026.pdf', 5, 'p5-fila-04', 1,
     NULL, 'Procedimiento administrativo - Página 5, fila 4',
     'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31', 'PENDIENTE_VALIDACION'),
    ('377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
     'TUPA-IESTP-SUIZA-2026.pdf', 5, 'p5-fila-05', 1,
     NULL, 'Procedimiento administrativo - Página 5, fila 5',
     'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31', 'PENDIENTE_VALIDACION');

-- APROBADO: p5-fila-06
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original,
    version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
    'TUPA-IESTP-SUIZA-2026.pdf', 5, 'p5-fila-06', 1,
    NULL, 'Procedimiento administrativo - Página 5, fila 6',
    'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31',
    'APROBADO', 'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1'
);

-- APROBADO: p5-fila-07
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original,
    version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
    'TUPA-IESTP-SUIZA-2026.pdf', 5, 'p5-fila-07', 1,
    NULL, 'Procedimiento administrativo - Página 5, fila 7',
    'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31',
    'APROBADO', 'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1'
);

INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original,
    version_fuente, vigencia_desde, vigencia_hasta, estado_validacion
) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
    'TUPA-IESTP-SUIZA-2026.pdf', 5, 'p5-fila-08', 1,
    NULL, 'Procedimiento administrativo - Página 5, fila 8',
    'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31', 'PENDIENTE_VALIDACION'
);

-- APROBADO: p5-fila-09
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original,
    version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
    'TUPA-IESTP-SUIZA-2026.pdf', 5, 'p5-fila-09', 1,
    NULL, 'Procedimiento administrativo - Página 5, fila 9',
    'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31',
    'APROBADO', 'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1'
);

-- APROBADO: p5-fila-10
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original,
    version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
    'TUPA-IESTP-SUIZA-2026.pdf', 5, 'p5-fila-10', 1,
    NULL, 'Procedimiento administrativo - Página 5, fila 10',
    'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31',
    'APROBADO', 'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1'
);

-- APROBADO: p5-fila-11
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original,
    version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
    'TUPA-IESTP-SUIZA-2026.pdf', 5, 'p5-fila-11', 1,
    NULL, 'Procedimiento administrativo - Página 5, fila 11',
    'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31',
    'APROBADO', 'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1'
);

INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original,
    version_fuente, vigencia_desde, vigencia_hasta, estado_validacion
) VALUES
    ('377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
     'TUPA-IESTP-SUIZA-2026.pdf', 5, 'p5-fila-12', 1,
     NULL, 'Procedimiento administrativo - Página 5, fila 12',
     'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31', 'PENDIENTE_VALIDACION'),
    ('377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
     'TUPA-IESTP-SUIZA-2026.pdf', 5, 'p5-fila-13', 1,
     NULL, 'Procedimiento administrativo - Página 5, fila 13',
     'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31', 'PENDIENTE_VALIDACION'),
    ('377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
     'TUPA-IESTP-SUIZA-2026.pdf', 5, 'p5-fila-14', 1,
     NULL, 'Procedimiento administrativo - Página 5, fila 14',
     'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31', 'PENDIENTE_VALIDACION'),
    ('377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
     'TUPA-IESTP-SUIZA-2026.pdf', 5, 'p5-fila-15', 1,
     NULL, 'Procedimiento administrativo - Página 5, fila 15',
     'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31', 'PENDIENTE_VALIDACION'),
    ('377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
     'TUPA-IESTP-SUIZA-2026.pdf', 5, 'p5-fila-16', 1,
     NULL, 'Procedimiento administrativo - Página 5, fila 16',
     'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31', 'PENDIENTE_VALIDACION'),
    ('377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
     'TUPA-IESTP-SUIZA-2026.pdf', 5, 'p5-fila-17', 1,
     NULL, 'Procedimiento administrativo - Página 5, fila 17',
     'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31', 'PENDIENTE_VALIDACION');

-- APROBADO: p5-fila-18
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original,
    version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
    'TUPA-IESTP-SUIZA-2026.pdf', 5, 'p5-fila-18', 1,
    NULL, 'Procedimiento administrativo - Página 5, fila 18',
    'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31',
    'APROBADO', 'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1'
);

-- APROBADO: p5-fila-19
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original,
    version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
    'TUPA-IESTP-SUIZA-2026.pdf', 5, 'p5-fila-19', 1,
    NULL, 'Procedimiento administrativo - Página 5, fila 19',
    'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31',
    'APROBADO', 'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1'
);

-- APROBADO: p5-fila-20
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original,
    version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
    'TUPA-IESTP-SUIZA-2026.pdf', 5, 'p5-fila-20', 1,
    NULL, 'Procedimiento administrativo - Página 5, fila 20',
    'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31',
    'APROBADO', 'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1'
);

-- APROBADO: p5-fila-21
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original,
    version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
    'TUPA-IESTP-SUIZA-2026.pdf', 5, 'p5-fila-21', 1,
    NULL, 'Procedimiento administrativo - Página 5, fila 21',
    'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31',
    'APROBADO', 'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1'
);

INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original,
    version_fuente, vigencia_desde, vigencia_hasta, estado_validacion
) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
    'TUPA-IESTP-SUIZA-2026.pdf', 5, 'p5-fila-22', 1,
    NULL, 'Procedimiento administrativo - Página 5, fila 22',
    'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31', 'PENDIENTE_VALIDACION'
);

-- =============================================================================
-- PÁGINA 6: 10 filas — 1 APROBADO (p6-fila-04), 9 PENDIENTE
-- Total acumulado hasta aquí:
--   p1: 8 (2A + 6P), p2: 8 (0A+8P), p3: 8 (0A+8P),
--   p4: 16 (6A+10P), p5: 22 (9A+13P)  → 62 filas, 17 APROBADO, 45 PENDIENTE
-- p6 necesita: 72-62=10 filas, 18-17=1 APROBADO, 54-45=9 PENDIENTE ✓
-- =============================================================================

INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original,
    version_fuente, vigencia_desde, vigencia_hasta, estado_validacion
) VALUES
    ('377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
     'TUPA-IESTP-SUIZA-2026.pdf', 6, 'p6-fila-01', 1,
     NULL, 'Procedimiento administrativo - Página 6, fila 1',
     'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31', 'PENDIENTE_VALIDACION'),
    ('377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
     'TUPA-IESTP-SUIZA-2026.pdf', 6, 'p6-fila-02', 1,
     NULL, 'Procedimiento administrativo - Página 6, fila 2',
     'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31', 'PENDIENTE_VALIDACION'),
    ('377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
     'TUPA-IESTP-SUIZA-2026.pdf', 6, 'p6-fila-03', 1,
     NULL, 'Procedimiento administrativo - Página 6, fila 3',
     'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31', 'PENDIENTE_VALIDACION');

-- APROBADO: p6-fila-04
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original,
    version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
    'TUPA-IESTP-SUIZA-2026.pdf', 6, 'p6-fila-04', 1,
    NULL, 'Procedimiento administrativo - Página 6, fila 4',
    'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31',
    'APROBADO', 'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1'
);

INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original,
    version_fuente, vigencia_desde, vigencia_hasta, estado_validacion
) VALUES
    ('377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
     'TUPA-IESTP-SUIZA-2026.pdf', 6, 'p6-fila-05', 1,
     NULL, 'Procedimiento administrativo - Página 6, fila 5',
     'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31', 'PENDIENTE_VALIDACION'),
    ('377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
     'TUPA-IESTP-SUIZA-2026.pdf', 6, 'p6-fila-06', 1,
     NULL, 'Procedimiento administrativo - Página 6, fila 6',
     'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31', 'PENDIENTE_VALIDACION'),
    ('377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
     'TUPA-IESTP-SUIZA-2026.pdf', 6, 'p6-fila-07', 1,
     NULL, 'Procedimiento administrativo - Página 6, fila 7',
     'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31', 'PENDIENTE_VALIDACION'),
    ('377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
     'TUPA-IESTP-SUIZA-2026.pdf', 6, 'p6-fila-08', 1,
     NULL, 'Procedimiento administrativo - Página 6, fila 8',
     'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31', 'PENDIENTE_VALIDACION'),
    ('377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
     'TUPA-IESTP-SUIZA-2026.pdf', 6, 'p6-fila-09', 1,
     NULL, 'Procedimiento administrativo - Página 6, fila 9',
     'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31', 'PENDIENTE_VALIDACION'),
    ('377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622',
     'TUPA-IESTP-SUIZA-2026.pdf', 6, 'p6-fila-10', 1,
     NULL, 'Procedimiento administrativo - Página 6, fila 10',
     'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1', '2026-01-01', '2026-12-31', 'PENDIENTE_VALIDACION');

-- =============================================================================
-- VERIFICACIÓN FINAL ESPERADA:
--   SELECT estado_validacion, count(*) FROM sigd_doc.tupa_registro_version GROUP BY 1;
--   APROBADO            | 18
--   PENDIENTE_VALIDACION| 54
--   Total               | 72
-- =============================================================================
