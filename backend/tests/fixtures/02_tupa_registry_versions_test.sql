INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256,
    fuente_nombre,
    pagina,
    referencia_fila,
    codigo_externo,
    denominacion_original,
    monto_original,
    estado_validacion,
    referencia_aprobacion
) VALUES
    (repeat('0', 64), 'TEST_FIXTURE_ONLY', 1, 'p1-fila-06', 'p1-fila-06', 'Fixture p1-fila-06', '100.00', 'APROBADO', 'TEST_FIXTURE_ONLY'),
    (repeat('0', 64), 'TEST_FIXTURE_ONLY', 1, 'p2-fila-05', 'p2-fila-05', 'Fixture p2-fila-05', '1000.00', 'APROBADO', 'TEST_FIXTURE_ONLY'),
    (repeat('0', 64), 'TEST_FIXTURE_ONLY', 1, 'p3-fila-01', 'p3-fila-01', 'Fixture p3-fila-01', NULL, 'APROBADO', 'TEST_FIXTURE_ONLY'),
    (repeat('0', 64), 'TEST_FIXTURE_ONLY', 1, 'p3-fila-06', 'p3-fila-06', 'Fixture p3-fila-06', NULL, 'APROBADO', 'TEST_FIXTURE_ONLY'),
    (repeat('0', 64), 'TEST_FIXTURE_ONLY', 1, 'p3-fila-07', 'p3-fila-07', 'Fixture p3-fila-07', NULL, 'APROBADO', 'TEST_FIXTURE_ONLY')
ON CONFLICT (documento_sha256, pagina, referencia_fila, revision) DO NOTHING;
