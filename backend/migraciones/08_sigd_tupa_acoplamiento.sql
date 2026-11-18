-- Base aditiva de Geric para contrastar el TUPA 2026 con expedientes reales.
-- No publica tarifas ni altera el catálogo legado sigd_doc.tipo_tramite_tupa.
-- Se instala después de 04_sigd_doc.sql y 05_sigd_tra.sql. El runner general
-- sigue requiriendo resolver por separado las incompatibilidades de 06/07.

CREATE TABLE IF NOT EXISTS sigd_doc.tupa_registro_version (
    registro_version_id UUID NOT NULL DEFAULT gen_random_uuid()
        CONSTRAINT pk_tupa_registro_version PRIMARY KEY,
    documento_sha256 CHAR(64) NOT NULL,
    fuente_nombre TEXT NOT NULL,
    pagina INTEGER NOT NULL,
    referencia_fila TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    codigo_externo TEXT NULL,
    denominacion_original TEXT NOT NULL,
    monto_original TEXT NULL,
    requisitos_original JSONB NULL,
    referencia_normativa_original TEXT NULL,
    version_fuente TEXT NULL,
    vigencia_desde DATE NULL,
    vigencia_hasta DATE NULL,
    estado_validacion TEXT NOT NULL DEFAULT 'PENDIENTE_VALIDACION',
    referencia_aprobacion TEXT NULL,
    registrado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_tupa_registro_procedencia
        UNIQUE (documento_sha256, pagina, referencia_fila, revision),
    CONSTRAINT chk_tupa_documento_sha256
        CHECK (documento_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT chk_tupa_fuente_nombre CHECK (btrim(fuente_nombre) <> ''),
    CONSTRAINT chk_tupa_pagina CHECK (pagina > 0),
    CONSTRAINT chk_tupa_referencia_fila CHECK (btrim(referencia_fila) <> ''),
    CONSTRAINT chk_tupa_revision CHECK (revision > 0),
    CONSTRAINT chk_tupa_denominacion CHECK (btrim(denominacion_original) <> ''),
    CONSTRAINT chk_tupa_vigencia CHECK (vigencia_hasta IS NULL
        OR (vigencia_desde IS NOT NULL AND vigencia_hasta >= vigencia_desde)),
    CONSTRAINT chk_tupa_estado_validacion CHECK (estado_validacion IN
        ('PENDIENTE_VALIDACION', 'APROBADO', 'RECHAZADO')),
    CONSTRAINT chk_tupa_aprobacion CHECK (estado_validacion <> 'APROBADO'
        OR (referencia_aprobacion IS NOT NULL AND btrim(referencia_aprobacion) <> ''))
);

COMMENT ON TABLE sigd_doc.tupa_registro_version IS
    'Registro inmutable de procedencia TUPA. No sustituye el catálogo activo ni publica montos.';
COMMENT ON COLUMN sigd_doc.tupa_registro_version.codigo_externo IS
    'Código tal como aparece en la fuente; no se supone único entre versiones o documentos.';

CREATE TABLE IF NOT EXISTS sigd_doc.expediente_tupa_vinculo (
    vinculo_id UUID NOT NULL DEFAULT gen_random_uuid()
        CONSTRAINT pk_expediente_tupa_vinculo PRIMARY KEY,
    expediente_id UUID NOT NULL
        CONSTRAINT fk_vinculo_tupa_expediente REFERENCES sigd_tra.expediente (expediente_id) ON DELETE RESTRICT,
    registro_version_id UUID NOT NULL
        CONSTRAINT fk_vinculo_tupa_version REFERENCES sigd_doc.tupa_registro_version (registro_version_id) ON DELETE RESTRICT,
    vinculado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    reemplaza_vinculo_id UUID NULL
        CONSTRAINT fk_vinculo_tupa_anterior REFERENCES sigd_doc.expediente_tupa_vinculo (vinculo_id) ON DELETE RESTRICT,
    motivo TEXT NULL,
    CONSTRAINT uq_vinculo_tupa_sucesor UNIQUE (reemplaza_vinculo_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_vinculo_tupa_raiz_expediente
    ON sigd_doc.expediente_tupa_vinculo (expediente_id)
    WHERE reemplaza_vinculo_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_vinculo_tupa_expediente_fecha
    ON sigd_doc.expediente_tupa_vinculo (expediente_id, vinculado_en DESC, vinculo_id DESC);
CREATE INDEX IF NOT EXISTS idx_vinculo_tupa_version
    ON sigd_doc.expediente_tupa_vinculo (registro_version_id);

CREATE OR REPLACE FUNCTION sigd_doc.fn_tupa_registro_inmutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'El registro de procedencia TUPA es inmutable'
        USING ERRCODE = '23001';
END;
$$;

DROP TRIGGER IF EXISTS tr_tupa_registro_inmutable ON sigd_doc.tupa_registro_version;
CREATE TRIGGER tr_tupa_registro_inmutable
    BEFORE UPDATE OR DELETE ON sigd_doc.tupa_registro_version
    FOR EACH ROW EXECUTE FUNCTION sigd_doc.fn_tupa_registro_inmutable();

DROP TRIGGER IF EXISTS tr_tupa_registro_no_truncar ON sigd_doc.tupa_registro_version;
CREATE TRIGGER tr_tupa_registro_no_truncar
    BEFORE TRUNCATE ON sigd_doc.tupa_registro_version
    FOR EACH STATEMENT EXECUTE FUNCTION sigd_doc.fn_tupa_registro_inmutable();

CREATE OR REPLACE FUNCTION sigd_doc.fn_tupa_vinculo_validar()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_estado TEXT;
    v_expediente_anterior UUID;
BEGIN
    SELECT estado_validacion INTO v_estado
      FROM sigd_doc.tupa_registro_version
     WHERE registro_version_id = NEW.registro_version_id;
    IF v_estado IS DISTINCT FROM 'APROBADO' THEN
        RAISE EXCEPTION 'Solo se puede vincular una versión TUPA aprobada'
            USING ERRCODE = '23514';
    END IF;

    IF NEW.reemplaza_vinculo_id IS NOT NULL THEN
        SELECT expediente_id INTO v_expediente_anterior
          FROM sigd_doc.expediente_tupa_vinculo
         WHERE vinculo_id = NEW.reemplaza_vinculo_id;
        IF v_expediente_anterior IS DISTINCT FROM NEW.expediente_id THEN
            RAISE EXCEPTION 'El vínculo anterior debe pertenecer al mismo expediente'
                USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_tupa_vinculo_validar ON sigd_doc.expediente_tupa_vinculo;
CREATE TRIGGER tr_tupa_vinculo_validar
    BEFORE INSERT ON sigd_doc.expediente_tupa_vinculo
    FOR EACH ROW EXECUTE FUNCTION sigd_doc.fn_tupa_vinculo_validar();

CREATE OR REPLACE FUNCTION sigd_doc.fn_tupa_vinculo_inmutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'El vínculo TUPA es inmutable; registre un sucesor'
        USING ERRCODE = '23001';
END;
$$;

DROP TRIGGER IF EXISTS tr_tupa_vinculo_inmutable ON sigd_doc.expediente_tupa_vinculo;
CREATE TRIGGER tr_tupa_vinculo_inmutable
    BEFORE UPDATE OR DELETE ON sigd_doc.expediente_tupa_vinculo
    FOR EACH ROW EXECUTE FUNCTION sigd_doc.fn_tupa_vinculo_inmutable();

DROP TRIGGER IF EXISTS tr_tupa_vinculo_no_truncar ON sigd_doc.expediente_tupa_vinculo;
CREATE TRIGGER tr_tupa_vinculo_no_truncar
    BEFORE TRUNCATE ON sigd_doc.expediente_tupa_vinculo
    FOR EACH STATEMENT EXECUTE FUNCTION sigd_doc.fn_tupa_vinculo_inmutable();


-- Inserción canónica de las 72 entradas oficiales TUPA 2026 (18 APROBADO, 54 PENDIENTE)
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 1, 'p1-fila-01', 1,
    null, 'Prácticas Iniciales', 'S/ 35.00', '["Pago del Derecho en Tesorería","Control en el Área Académica","Comprobante de Pago 0.64 % UIT Vigente"]'::jsonb,
    'Ley 28693: Ley General del Sistema Nacional de Tesorería. • Principio de Unidad de Caja. • Directiva de Tesorería.', 'TUPA 2026', null, null,
    'PENDIENTE_VALIDACION', null
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 1, 'p1-fila-02', 1,
    null, 'Prácticas Intermedias', 'S/ 45.00', '["Pago del Derecho en Tesorería","Control en el Área Académica","Comprobante de Pago 0.82 % UIT Vigente"]'::jsonb,
    'Ley 28693: Ley General del Sistema Nacional de Tesorería. • Principio de Unidad de Caja. • Directiva de Tesorería.', 'TUPA 2026', null, null,
    'PENDIENTE_VALIDACION', null
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 1, 'p1-fila-03', 1,
    null, 'Prácticas Finales', 'S/ 60.00', '["Pago del Derecho en Tesorería","Control en el Área Académica","Comprobante de Pago 1.09 % UIT Vigente"]'::jsonb,
    'Ley 28693: Ley General del Sistema Nacional de Tesorería. • Principio de Unidad de Caja. • Directiva de Tesorería.', 'TUPA 2026', null, null,
    'PENDIENTE_VALIDACION', null
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 1, 'p1-fila-04', 1,
    null, 'Experiencias Formativas en Situaciones Reales de Trabajo (I, II, III y IV)
Por cada Módulo', 'S/ 46.50', '["Informe del Área Académica designando los Docentes responsables para las Supervisiones de Experiencias Formativas en Situaciones Reales de Trabajo","Pago del Derecho en Tesorería","Comprobante de Pago 0.84 % UIT Vigente"]'::jsonb,
    'Ley 28693: Ley General del Sistema Nacional de Tesorería. • Principio de Unidad de Caja. • Directiva de Tesorería.', 'TUPA 2026', null, null,
    'PENDIENTE_VALIDACION', null
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 1, 'p1-fila-05', 1,
    null, 'Certificado Modular (I, II, III y IV)
Por cada Módulo', 'S/ 100.00', '["Pago en el Área de Tesorería","Emisión de la B/V"]'::jsonb,
    'Ley 28693: Ley General del Sistema Nacional de Tesorería. • Principio de Unidad de Caja. • Directiva de Tesorería.', 'TUPA 2026', null, null,
    'APROBADO', 'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1'
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 1, 'p1-fila-06', 1,
    null, 'Certificado de Inglés', 'S/ 100.00', '["Pago en el Área de Tesorería","Emisión de la B/V"]'::jsonb,
    'Ley 28693: Ley General del Sistema Nacional de Tesorería. • Principio de Unidad de Caja. • Directiva de Tesorería.', 'TUPA 2026', null, null,
    'APROBADO', 'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1'
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 1, 'p1-fila-07', 1,
    null, 'Centro de Idiomas:
Inglés, Portugués, Japonés
Nivel Básico Paquete: 04 meses para Alumnos del IESTP "SUIZA"', 'S/ 300.00', '["Pago en el Área de Tesorería","Emisión de la B/V"]'::jsonb,
    'Ley 28693: Ley General del Sistema Nacional de Tesorería. • Principio de Unidad de Caja. • Directiva de Tesorería.', 'TUPA 2026', null, null,
    'PENDIENTE_VALIDACION', null
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 1, 'p1-fila-08', 1,
    null, 'Centro de Idiomas:
Inglés, Portugués, Japonés
Nivel Básico Paquete: 04 meses para Alumnos Externos del IESTP "SUIZA"', 'S/ 350.00', '["Pago en el Área de Tesorería","Emisión de la B/V"]'::jsonb,
    'Ley 28693: Ley General del Sistema Nacional de Tesorería. • Principio de Unidad de Caja. • Directiva de Tesorería.', 'TUPA 2026', null, null,
    'PENDIENTE_VALIDACION', null
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 1, 'p1-fila-09', 1,
    null, 'Examen de Suficiencia de Inglés y/o Portugués', 'S/ 300.00', '["Pago en el Área de Tesorería","Emisión de la B/V"]'::jsonb,
    'Ley 28693: Ley General del Sistema Nacional de Tesorería. • Principio de Unidad de Caja. • Directiva de Tesorería.', 'TUPA 2026', null, null,
    'PENDIENTE_VALIDACION', null
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 1, 'p1-fila-10', 1,
    null, 'CEPRETEC 2026', 'S/ 400.00
S/ 200.00
S/ 60.00
S/ 50.00
S/ 40.00
S/ 10.00', '["Pago en el Área de Tesorería","Emisión de la B/V"]'::jsonb,
    'Ley 28693: Ley General del Sistema Nacional de Tesorería. • Principio de Unidad de Caja. • Directiva de Tesorería.', 'TUPA 2026', null, null,
    'PENDIENTE_VALIDACION', null
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 2, 'p2-fila-01', 1,
    null, 'Alquiler del Galpón Agrícola Para la Crianza de Pollos
(Por Campaña)', 'S/ 500.00', '["Solicitud dirigida al Director del IESTP SUIZA.","Suscripción del Contrato.","Pago en tesorería de acuerdo al Contrato","Precio por Campaña"]'::jsonb,
    'D.S. Nº 028-2007-ED', 'TUPA 2026', null, null,
    'PENDIENTE_VALIDACION', null
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 2, 'p2-fila-02', 1,
    null, 'Alquiler de Retroproyector', 'S/ 100.00', '["Pago en tesorería."]'::jsonb,
    'D.S. Nº 028-2007-ED', 'TUPA 2026', null, null,
    'PENDIENTE_VALIDACION', null
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 2, 'p2-fila-03', 1,
    null, 'Alquiler de Aulas - Diario', 'S/ 150.00', '["Solicitud dirigida al Director del IESTP SUIZA","Proveído a la Unidad Administrativa para su Autorización","Pago en tesorería.","Emisión de B/V."]'::jsonb,
    'D.S. Nº 028-2007-ED', 'TUPA 2026', null, null,
    'PENDIENTE_VALIDACION', null
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 2, 'p2-fila-04', 1,
    null, 'Alquiler de la Cancha de Fútbol - Diario', 'S/ 100.00', '["Solicitud dirigida al Director del IESTP SUIZA","Proveído a la Unidad Administrativa para su Autorización","Pago en tesorería.","Emisión de B/V."]'::jsonb,
    'D.S. Nº 028-2007-ED', 'TUPA 2026', null, null,
    'PENDIENTE_VALIDACION', null
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 2, 'p2-fila-05', 1,
    null, 'Alquiler de Ambientes para servicio de alimentación.', 'S/ 1,000.00', '["Solicitud dirigida al Director del IESTP SUIZA.","Suscripción del Contrato.","Pago en tesorería de acuerdo al Contrato","Precios de acuerdo al Contrato S/. 50.00 a S/. 350.00"]'::jsonb,
    'D.S. Nº 028-2007-ED', 'TUPA 2026', null, null,
    'PENDIENTE_VALIDACION', null
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 2, 'p2-fila-06', 1,
    null, 'Alquiler del Auditorio.', 'S/ 300.00', '["Solicitud dirigida al Director del IESTP SUIZA.","Proveído a la Unidad Administrativa para su Autorización","Pago en tesorería.","Emisión de B/V."]'::jsonb,
    'D.S. Nº 028-2007-ED', 'TUPA 2026', null, null,
    'PENDIENTE_VALIDACION', null
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 2, 'p2-fila-07', 1,
    null, 'Alquiler de Laboratorio de Cómputo a Terceros', 'S/ 20.00', '["Por hora y por cada equipo"]'::jsonb,
    'D.S. Nº 028-2007-ED', 'TUPA 2026', null, null,
    'PENDIENTE_VALIDACION', null
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 2, 'p2-fila-08', 1,
    null, 'Venta Ambulatoria Diaria', 'S/ 20.00', '["Solicitud dirigida al Director.","Proveído a la Unidad Administrativa para su Autorización.","Pago en Tesorería.","Emisión de la B/V"]'::jsonb,
    'D.S. Nº 028-2007-ED', 'TUPA 2026', null, null,
    'PENDIENTE_VALIDACION', null
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 2, 'p2-fila-09', 1,
    null, 'Venta de Mangos (Ciento)', 'S/ 15.00', '["Pago en Tesorería","Entrega del bien en proyectos","Papeleta de Autorización de salida Firmada por la Unidad Administrativa, Jefe (e) del Área de Proyectos Productivos y Jefe (e) de Abastecimiento y Patrimonio del IESTP SUIZA.","Supervisión de salida del bien-vigilancia","Emisión de Boleta de Venta"]'::jsonb,
    'D.S. Nº 028-2007-ED', 'TUPA 2026', null, null,
    'PENDIENTE_VALIDACION', null
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 2, 'p2-fila-10', 1,
    null, 'Venta de Patos BB', 'S/ 15.00', '["Pago en Tesorería","Entrega del bien en Proyectos","Papeleta de Autorización de salida Firmada por la Unidad Administrativa, Jefe (e) del Área de Proyectos Productivos y Jefe (e) de Abastecimiento y Patrimonio del IESTP SUIZA.","Supervisión de salida del bien-vigilancia","Emisión de Boleta de Venta"]'::jsonb,
    'D.S. Nº 028-2007-ED', 'TUPA 2026', null, null,
    'PENDIENTE_VALIDACION', null
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 3, 'p3-fila-01', 1,
    null, 'Venta de Patos Pichones, de acuerdo al Tamaño.', 'S/ 30.00
S/ 40.00', '["Pago en Tesorería","Entrega del bien en Proyectos","Papeleta de Autorización de salida Firmada por la Unidad Administrativa, Jefe (e) del Área de Proyectos Productivos y Jefe (e) de Abastecimiento y Patrimonio del IESTP SUIZA.","Supervisión de salida del bien-vigilancia","Emisión de Boleta de Venta","PICHONES HEMBRAS: S/ 30.00","PICHONES MACHOS: S/ 40.00"]'::jsonb,
    'D.S. Nº 028-2007-ED', 'TUPA 2026', null, null,
    'PENDIENTE_VALIDACION', null
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 3, 'p3-fila-02', 1,
    null, 'Venta de Pati Pollos', 'S/ 15.00', '["Pago en Tesorería","Entrega del bien en Proyectos","Papeleta de Autorización de salida Firmada por la Unidad Administrativa, Jefe (e) del Área de Proyectos Productivos y Jefe (e) de Abastecimiento y Patrimonio del IESTP SUIZA.","Supervisión de salida del bien-vigilancia","Emisión de Boleta de Venta"]'::jsonb,
    'D.S. Nº 028-2007-ED', 'TUPA 2026', null, null,
    'PENDIENTE_VALIDACION', null
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 3, 'p3-fila-03', 1,
    null, 'Venta de Patos adultos hembras', 'S/ 40.00', '["Pago en Tesorería","Entrega del bien en Proyectos","Papeleta de Autorización de salida Firmada por la Unidad Administrativa, Jefe (e) del Área de Proyectos Productivos y Jefe (e) de Abastecimiento y Patrimonio del IESTP SUIZA.","Supervisión de salida del bien-vigilancia","Emisión de Boleta de Venta"]'::jsonb,
    'D.S. Nº 028-2007-ED', 'TUPA 2026', null, null,
    'PENDIENTE_VALIDACION', null
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 3, 'p3-fila-04', 1,
    null, 'Venta de Patos adultos machos', 'S/ 50.00
S/ 55.00', '["Pago en Tesorería","Entrega del bien en Proyectos","Papeleta de Autorización de salida Firmada por la Unidad Administrativa, Jefe (e) del Área de Proyectos Productivos y Jefe (e) de Abastecimiento y Patrimonio del IESTP SUIZA.","Supervisión de salida del bien-vigilancia","Emisión de Boleta de Venta"]'::jsonb,
    'D.S. Nº 028-2007-ED', 'TUPA 2026', null, null,
    'PENDIENTE_VALIDACION', null
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 3, 'p3-fila-05', 1,
    null, 'Venta de Porcino para consumo Kg', 'S/ 20.00', '["Pago en Tesorería","Entrega del bien en Proyectos","Papeleta de Autorización de salida Firmada por la Unidad Administrativa, Jefe (e) del Área de Proyectos Productivos y Jefe (e) de Abastecimiento y Patrimonio del IESTP SUIZA.","Supervisión de salida del bien-vigilancia","Emisión de Boleta de Venta"]'::jsonb,
    'D.S. Nº 028-2007-ED', 'TUPA 2026', null, null,
    'PENDIENTE_VALIDACION', null
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 3, 'p3-fila-06', 1,
    null, 'Venta de Porcino en Pie Kg', 'S/ 25.00
S/ 15.00', '["Emisión de B/V.","REPRODUCTOR: S/ 25.00","CARNE: S/ 15.00"]'::jsonb,
    'D.S. Nº 028-2007-ED', 'TUPA 2026', null, null,
    'PENDIENTE_VALIDACION', null
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 3, 'p3-fila-07', 1,
    null, 'Venta de Ganado Vacuno en pie Kg; EN', 'S/ 20.00
S/ 15.00', '["Pago en Tesorería","Entrega del bien en Proyectos","Papeleta de Autorización de salida Firmada por la Unidad Administrativa, Jefe (e) del Área de Proyectos Productivos y Jefe (e) de Abastecimiento y Patrimonio del IESTP SUIZA.","Supervisión de salida del bien-vigilancia","Emisión de B/V.","CARCASA (SIN PATA, SIN CABEZA) KG: S/ 20.00","EN PIE: S/ 15.00"]'::jsonb,
    'D.S. Nº 028-2007-ED', 'TUPA 2026', null, null,
    'PENDIENTE_VALIDACION', null
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 3, 'p3-fila-08', 1,
    null, 'Servicio de Empadre', 'S/ 50.00', '["Ejecución del Servicio","Pago en Tesorería","Emisión de B/V."]'::jsonb,
    'D.S. Nº 028-2007-ED', 'TUPA 2026', null, null,
    'PENDIENTE_VALIDACION', null
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 4, 'p4-fila-01', 1,
    null, 'FUT', 'S/ 4.00', '["Pago del Derecho en Tesorería 3 FUT","Comprobante de Pago 0.07 % UIT Vigente"]'::jsonb,
    'Ley 28693: Ley General del Sistema Nacional de Tesorería. • Principio de Unidad de Caja. • Directiva de Tesorería.', 'TUPA 2026', null, null,
    'PENDIENTE_VALIDACION', null
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 4, 'p4-fila-02', 1,
    null, 'Constancia de No Adeudar
(Para fines de Titulación)', 'S/ 16.50', '["Pago del Derecho en Tesorería","Comprobante de Pago 0.30 % UIT Vigente"]'::jsonb,
    'Ley 28693: Ley General del Sistema Nacional de Tesorería. • Principio de Unidad de Caja. • Directiva de Tesorería.', 'TUPA 2026', null, null,
    'APROBADO', 'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1'
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 4, 'p4-fila-03', 1,
    null, 'Trabajo de Aplicación Profesional
(Examen Teórico Práctico)', 'S/ 57.00', '["Pago del Derecho en Tesorería, 1.03 % UIT Vigente"]'::jsonb,
    'Ley 28693: Ley General del Sistema Nacional de Tesorería. • Principio de Unidad de Caja. • Directiva de Tesorería.', 'TUPA 2026', null, null,
    'PENDIENTE_VALIDACION', null
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 4, 'p4-fila-04', 1,
    null, 'Examen de Suficiencia Profesional
(Examen Teórico Práctico)', 'S/ 57.00', '["Pago del Derecho en Tesorería, 1.03 % UIT Vigente"]'::jsonb,
    'Ley 28693: Ley General del Sistema Nacional de Tesorería. • Principio de Unidad de Caja. • Directiva de Tesorería.', 'TUPA 2026', null, null,
    'PENDIENTE_VALIDACION', null
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 4, 'p4-fila-05', 1,
    null, 'Expedición de Título', 'S/ 105.00', '["Pago del Derecho en Tesorería","Comprobante de Pago 1.90 % UIT Vigente"]'::jsonb,
    'Ley 28693: Ley General del Sistema Nacional de Tesorería. • Principio de Unidad de Caja. • Directiva de Tesorería.', 'TUPA 2026', null, null,
    'APROBADO', 'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1'
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 4, 'p4-fila-06', 1,
    null, 'Certificado de Estudios Superiores
(6 Semestres)', 'S/ 124.00', '["Pago del Derecho en Tesorería","Comprobante de Pago 2.24 % UIT Vigente"]'::jsonb,
    'Ley 28693: Ley General del Sistema Nacional de Tesorería. • Principio de Unidad de Caja. • Directiva de Tesorería.', 'TUPA 2026', null, null,
    'APROBADO', 'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1'
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 4, 'p4-fila-07', 1,
    null, 'Visación de Certificado de Estudios Superiores', 'S/ 16.00', '["Pago del Derecho en Tesorería","Comprobante de Pago 0.29 % UIT Vigente"]'::jsonb,
    'Ley 28693: Ley General del Sistema Nacional de Tesorería. • Principio de Unidad de Caja. • Directiva de Tesorería.', 'TUPA 2026', null, null,
    'APROBADO', 'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1'
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 4, 'p4-fila-08', 1,
    null, 'Caligrafiado de Título', 'S/ 26.00', '["Pago del Derecho en Tesorería","Comprobante de Pago 0.47 % UIT Vigente"]'::jsonb,
    'Ley 28693: Ley General del Sistema Nacional de Tesorería. • Principio de Unidad de Caja. • Directiva de Tesorería.', 'TUPA 2026', null, null,
    'PENDIENTE_VALIDACION', null
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 4, 'p4-fila-09', 1,
    null, 'Derecho de Formato de Título', 'S/ 42.00', '["Pago del Derecho en Tesorería","Comprobante de Pago 0.75 % UIT Vigente"]'::jsonb,
    'Ley 28693: Ley General del Sistema Nacional de Tesorería. • Principio de Unidad de Caja. • Directiva de Tesorería.', 'TUPA 2026', null, null,
    'PENDIENTE_VALIDACION', null
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 4, 'p4-fila-10', 1,
    null, 'Inscripción de Título', 'S/ 120.00', '["Pago del Derecho en Tesorería","Comprobante de Pago"]'::jsonb,
    'Ley 28693: Ley General del Sistema Nacional de Tesorería. • Principio de Unidad de Caja. • Directiva de Tesorería.', 'TUPA 2026', null, null,
    'APROBADO', 'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1'
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 4, 'p4-fila-11', 1,
    null, 'Medallas', 'S/ 100.00', '["Pago del Derecho en Tesorería","Comprobante de Pago"]'::jsonb,
    'Ley 28693: Ley General del Sistema Nacional de Tesorería. • Principio de Unidad de Caja. • Directiva de Tesorería.', 'TUPA 2026', null, null,
    'PENDIENTE_VALIDACION', null
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 4, 'p4-fila-12', 1,
    null, 'Protector de Título', 'S/ 100.00', '["Pago del Derecho en Tesorería"]'::jsonb,
    'Ley 28693: Ley General del Sistema Nacional de Tesorería. • Principio de Unidad de Caja. • Directiva de Tesorería.', 'TUPA 2026', null, null,
    'PENDIENTE_VALIDACION', null
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 4, 'p4-fila-13', 1,
    null, 'Colación', 'S/ 100.00', '["Pago del Derecho en Tesorería"]'::jsonb,
    'Ley 28693: Ley General del Sistema Nacional de Tesorería. • Principio de Unidad de Caja. • Directiva de Tesorería.', 'TUPA 2026', null, null,
    'PENDIENTE_VALIDACION', null
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 4, 'p4-fila-14', 1,
    null, 'Protector de Certificado Modular', 'S/ 50.00', '["Pago del Derecho en Tesorería"]'::jsonb,
    'Ley 28693: Ley General del Sistema Nacional de Tesorería. • Principio de Unidad de Caja. • Directiva de Tesorería.', 'TUPA 2026', null, null,
    'PENDIENTE_VALIDACION', null
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 4, 'p4-fila-15', 1,
    null, 'Modificación de Datos del Título', 'S/ 269.00', '["Pago del Derecho en Tesorería","Comprobante de Pago 4.88 % UIT Vigente"]'::jsonb,
    'Ley 28693: Ley General del Sistema Nacional de Tesorería. • Principio de Unidad de Caja. • Directiva de Tesorería.', 'TUPA 2026', null, null,
    'APROBADO', 'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1'
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 4, 'p4-fila-16', 1,
    null, 'Derecho de duplicado de Título.', 'S/ 309.00', '["Pago del Derecho en Tesorería","Comprobante de Pago 5.61 % UIT Vigente"]'::jsonb,
    'Ley 28693: Ley General del Sistema Nacional de Tesorería. • Principio de Unidad de Caja. • Directiva de Tesorería.', 'TUPA 2026', null, null,
    'PENDIENTE_VALIDACION', null
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 5, 'p5-fila-01', 1,
    null, 'Matrículas', 'S/ 200.00', '["Ficha de matrícula","Pago de adeudos en Tesorería","Pago de derecho de matrícula en tesorería"]'::jsonb,
    null, 'TUPA 2026', null, null,
    'PENDIENTE_VALIDACION', null
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 5, 'p5-fila-02', 1,
    null, 'ADMISIÓN 2026', 'S/ 250.00', '["Pago en el Área de Tesorería"]'::jsonb,
    null, 'TUPA 2026', null, null,
    'PENDIENTE_VALIDACION', null
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 5, 'p5-fila-03', 1,
    null, 'Guías del postulante', 'S/ 50.00', '["Pago en el Área de Tesorería"]'::jsonb,
    null, 'TUPA 2026', null, null,
    'PENDIENTE_VALIDACION', null
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 5, 'p5-fila-04', 1,
    null, 'Ingreso ADMISIÓN 2026 - Titulados', 'S/ 500.00', '["Pago en el Área de Tesorería"]'::jsonb,
    null, 'TUPA 2026', null, null,
    'PENDIENTE_VALIDACION', null
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 5, 'p5-fila-05', 1,
    null, 'Derecho de Reincorporación
(Reingreso)', 'S/ 300.00', '["Pago en el Área de Tesorería"]'::jsonb,
    null, 'TUPA 2026', null, null,
    'PENDIENTE_VALIDACION', null
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 5, 'p5-fila-06', 1,
    null, 'Constancia de Egresado', 'S/ 31.00', '["Pago del Derecho en Tesorería"]'::jsonb,
    null, 'TUPA 2026', null, null,
    'APROBADO', 'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1'
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 5, 'p5-fila-07', 1,
    null, 'Certificado de Bachillerato', 'S/ 42.00', '["Pago del Derecho en Tesorería","Comprobante de Pago 0.75 % UIT Vigente"]'::jsonb,
    null, 'TUPA 2026', null, null,
    'APROBADO', 'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1'
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 5, 'p5-fila-08', 1,
    null, 'Constancias
(Otros: de Título, estudios, de Matrícula)', 'S/ 23.00', '["Pago del Derecho en Tesorería","Comprobante de Pago 0.41 % UIT Vigente"]'::jsonb,
    null, 'TUPA 2026', null, null,
    'PENDIENTE_VALIDACION', null
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 5, 'p5-fila-09', 1,
    null, 'Convalidación entre Planes de Estudios', 'S/ 46.50', '["Pago del Derecho en Tesorería, 0.84% UIT Vigente"]'::jsonb,
    null, 'TUPA 2026', null, null,
    'APROBADO', 'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1'
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 5, 'p5-fila-10', 1,
    null, 'Convalidación por Unidades de Competencia', 'S/ 46.50', '["Pago del Derecho en Tesorería","Comprobante de Pago 0.84 % UIT Vigente"]'::jsonb,
    null, 'TUPA 2026', null, null,
    'APROBADO', 'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1'
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 5, 'p5-fila-11', 1,
    null, 'Devolución de Expediente', 'S/ 21.00', '["Pago del Derecho en Tesorería","Comprobante de Pago 0.37 % UIT Vigente"]'::jsonb,
    null, 'TUPA 2026', null, null,
    'APROBADO', 'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1'
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 5, 'p5-fila-12', 1,
    null, 'Evaluación Extraordinaria (A)', 'S/ 93.00', '["Pago del Derecho en Tesorería","Comprobante de Pago 1.68 % UIT Vigente"]'::jsonb,
    null, 'TUPA 2026', null, null,
    'PENDIENTE_VALIDACION', null
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 5, 'p5-fila-13', 1,
    null, 'Evaluación Extraordinaria
(RM 069)', 'S/ 70.00', '["Pago del Derecho en Tesorería","Comprobante de Pago 1.27 % UIT Vigente"]'::jsonb,
    null, 'TUPA 2026', null, null,
    'PENDIENTE_VALIDACION', null
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 5, 'p5-fila-14', 1,
    null, 'Examen de Recuperación', 'S/ 70.00', '["Pago del Derecho en Tesorería","Comprobante de Pago 1.27 % UIT Vigente"]'::jsonb,
    null, 'TUPA 2026', null, null,
    'PENDIENTE_VALIDACION', null
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 5, 'p5-fila-15', 1,
    null, 'Examen de Cargo', 'S/ 70.00', '["Pago del Derecho en Tesorería","Comprobante de Pago 1.27 % UIT Vigente"]'::jsonb,
    null, 'TUPA 2026', null, null,
    'PENDIENTE_VALIDACION', null
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 5, 'p5-fila-16', 1,
    null, 'Repitencia de Unidad Didáctica', 'S/ 86.00', '["Pago del Derecho en Tesorería","Comprobante de Pago 1.56 % UIT Vigente"]'::jsonb,
    null, 'TUPA 2026', null, null,
    'PENDIENTE_VALIDACION', null
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 5, 'p5-fila-17', 1,
    null, 'Repitencia de Semestre', 'S/ 80.00', '["Pago del Derecho en Tesorería","Comprobante de Pago 1.45 % UIT Vigente"]'::jsonb,
    null, 'TUPA 2026', null, null,
    'PENDIENTE_VALIDACION', null
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 5, 'p5-fila-18', 1,
    null, 'Reserva de Matrícula - Ingresantes', 'S/ 66.00', '["Pago del Derecho en Tesorería","Resolución Directoral-Secretaría Académica","Comprobante de Pago 1.20 % UIT Vigente"]'::jsonb,
    null, 'TUPA 2026', null, null,
    'APROBADO', 'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1'
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 5, 'p5-fila-19', 1,
    null, 'Licencia de Estudios - Estudiantes Antiguos', 'S/ 66.00', '["Pago del Derecho en Tesorería","Resolución Directoral-Secretaría - Académica","Comprobante de Pago 1.20 % UIT Vigente"]'::jsonb,
    null, 'TUPA 2026', null, null,
    'APROBADO', 'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1'
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 5, 'p5-fila-20', 1,
    null, 'Traslado Interno', 'S/ 309.00', '["Vacante en la Carrera","Resolución Directoral-Secretaría Académica","Pago del Derecho en Tesorería","Comprobante de Pago 5.61 % UIT Vigente"]'::jsonb,
    null, 'TUPA 2026', null, null,
    'APROBADO', 'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1'
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 5, 'p5-fila-21', 1,
    null, 'Traslado Externo', 'S/ 412.00', '["Solicitud en FUT dirigida al Director.","Vacante en la Carrera","Resolución Directoral-Secretaría - Académica","Pago del Derecho en Tesorería","Comprobante de Pago 7.48 % UIT Vigente"]'::jsonb,
    null, 'TUPA 2026', null, null,
    'APROBADO', 'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1'
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 6, 'p6-fila-01', 1,
    null, 'Demora Devolución Libro Biblioteca', 'S/ 10.00', '["Informe a la Unidad Administrativa de deudores de Libros","Unidad Administrativa deriva a Tesorería","Pago del Derecho en Tesorería","Comprobante de Pago 0.19 % UIT Vigente (Costo por día)"]'::jsonb,
    null, 'TUPA 2026', null, null,
    'PENDIENTE_VALIDACION', null
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 6, 'p6-fila-02', 1,
    null, 'Acceso a la Información Pública.
S/. 10.00 por C/Hoja', 'S/ 10.50', '["Solicitud dirigida a Dirección en FUT","Pago del Derecho en Tesorería 0.19 % de la UIT Vigente"]'::jsonb,
    null, 'TUPA 2026', null, null,
    'PENDIENTE_VALIDACION', null
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 6, 'p6-fila-03', 1,
    null, 'Búsqueda y Duplicados de Boletas (C/U)
Síllabus (C/U)
Otros Trámites', 'S/ 10.50', '["Pago del Derecho en Tesorería","Otros Trámites Administrativos","Comprobante de Pago 0.19% UIT Vigente"]'::jsonb,
    null, 'TUPA 2026', null, null,
    'PENDIENTE_VALIDACION', null
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 6, 'p6-fila-04', 1,
    null, 'Titulación de Otros Institutos Tecnológicos', 'S/ 515.00', '["Pago del Derecho en Tesorería","Comprobante de Pago 9.35 % UIT Vigente","Resolución Directoral-Secretaría Académica"]'::jsonb,
    null, 'TUPA 2026', null, null,
    'APROBADO', 'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1'
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 6, 'p6-fila-05', 1,
    null, 'Examen de Subsanación con Jurado', 'S/ 33.00', '["Pago del Derecho en Tesorería","Comprobante de Pago 0.60 % UIT Vigente","Resolución Directoral-Secretaría Académica"]'::jsonb,
    null, 'TUPA 2026', null, null,
    'PENDIENTE_VALIDACION', null
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 6, 'p6-fila-06', 1,
    null, 'Prueba de Suficiencia Académica', 'S/ 105.00', '["Pago del Derecho en Tesorería","Comprobante de Pago 1.90 % UIT Vigente"]'::jsonb,
    null, 'TUPA 2026', null, null,
    'PENDIENTE_VALIDACION', null
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622', 'TUPA_2026_IESTP_Suiza.pdf', 6, 'p6-fila-07', 1,
    null, 'Carnets, Insignia y Distintivos', 'S/ 50.00', '["Pago en el Área de Tesorería","Emisión de la B/V","0.93 % UIT Vigente"]'::jsonb,
    null, 'TUPA 2026', null, null,
    'PENDIENTE_VALIDACION', null
  ) ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING;
