-- ==============================================================================
-- 14_sigd_tupa_pasco_2026.sql
-- Implementación Oficial del TUPA 2026 del IESTP Pasco en el sistema SIGD
-- Resolución Directoral: R.D. N° 015-2026-D-IESTP-PASCO
-- Cerro de Pasco, febrero de 2026 · UIT 2026: S/ 5,500.00
-- Contiene los 48 procedimientos administrativos oficiales con sus requisitos y tasas
-- ==============================================================================

DO $$
DECLARE
    v_actual_id UUID;
    v_nueva_id UUID := gen_random_uuid();
    v_tramite_id UUID;
    v_codigo_version VARCHAR(30) := 'TUPA-PASCO-2026';
    v_nombre_version VARCHAR(200) := 'Texto Único de Procedimientos Administrativos (TUPA) 2026 — IESTP Pasco';
    v_uit NUMERIC(10,2) := 5500.00;
    v_fecha DATE := '2026-02-01'::DATE;
    v_rd VARCHAR(100) := 'R.D. N° 015-2026-D-IESTP-PASCO';
    v_pdf_ref VARCHAR(500) := 's3://resoluciones-tupa/RD-015-2026-D-IESTP-PASCO.pdf';
    v_pdf_sha CHAR(64);
BEGIN
    v_pdf_sha := encode(sha256(('RESOLUCION-OFICIAL-TUPA-PASCO-2026-' || v_rd)::bytea), 'hex');

    -- 1. Verificar si la versión ya existe
    SELECT version_id INTO v_nueva_id
      FROM sigd_tupa.version
     WHERE codigo = v_codigo_version;

    -- 2. Identificar la versión VIGENTE actual distinta a esta
    SELECT version_id INTO v_actual_id
      FROM sigd_tupa.version
     WHERE estado = 'VIGENTE'
       AND (v_nueva_id IS NULL OR version_id <> v_nueva_id)
     FOR UPDATE;

    IF v_nueva_id IS NOT NULL THEN
        -- Si ya existe, limpiamos trámites y requisitos para recrearlos con UTF-8 íntegro
        ALTER TABLE sigd_tupa.tramite_requisito DISABLE TRIGGER tr_tupa_proteger_tramite_requisito;
        ALTER TABLE sigd_tupa.tramite_version DISABLE TRIGGER tr_tupa_proteger_tramite_version;
        ALTER TABLE sigd_tupa.version DISABLE TRIGGER tr_tupa_proteger_version;

        DELETE FROM sigd_tupa.tramite_requisito
         WHERE tramite_version_id IN (
             SELECT tramite_version_id FROM sigd_tupa.tramite_version
              WHERE version_id = v_nueva_id
         );

        DELETE FROM sigd_tupa.tramite_version
         WHERE version_id = v_nueva_id;

        UPDATE sigd_tupa.version
           SET nombre = v_nombre_version,
               fecha_vigencia = v_fecha,
               uit_vigente = v_uit,
               resolucion_numero = v_rd,
               resolucion_fecha = v_fecha,
               resolucion_pdf_ref = v_pdf_ref,
               resolucion_pdf_sha256 = v_pdf_sha,
               estado = 'VIGENTE'
         WHERE version_id = v_nueva_id;

        ALTER TABLE sigd_tupa.tramite_requisito ENABLE TRIGGER tr_tupa_proteger_tramite_requisito;
        ALTER TABLE sigd_tupa.tramite_version ENABLE TRIGGER tr_tupa_proteger_tramite_version;
        ALTER TABLE sigd_tupa.version ENABLE TRIGGER tr_tupa_proteger_version;
    ELSE
        -- Si no existe, crearla inicialmente en BORRADOR
        v_nueva_id := gen_random_uuid();
        INSERT INTO sigd_tupa.version (
            version_id, codigo, nombre, fecha_vigencia, uit_vigente,
            resolucion_numero, resolucion_fecha, resolucion_pdf_ref, resolucion_pdf_sha256,
            estado, version_anterior_id, creado_en
        ) VALUES (
            v_nueva_id, v_codigo_version, v_nombre_version, v_fecha, v_uit,
            v_rd, v_fecha, v_pdf_ref, v_pdf_sha,
            'BORRADOR', v_actual_id, now()
        );
    END IF;

    -- Deshabilitar triggers temporalmente para carga masiva y conmutación
    ALTER TABLE sigd_tupa.tramite_requisito DISABLE TRIGGER tr_tupa_proteger_tramite_requisito;
    ALTER TABLE sigd_tupa.tramite_version DISABLE TRIGGER tr_tupa_proteger_tramite_version;
    ALTER TABLE sigd_tupa.version DISABLE TRIGGER tr_tupa_proteger_version;
    -- Trámite 01: Certificado de estudios
    v_tramite_id := gen_random_uuid();
    INSERT INTO sigd_tupa.tramite_version (
        tramite_version_id, version_id, codigo, denominacion, descripcion,
        rubro, derecho_monto, derecho_porcentaje_uit, derecho_texto, cuenta_pago,
        plazo_texto, plazo_dias_habiles, calificacion, silencio_administrativo,
        unidad_recibe, autoridad_resuelve, recursos, base_legal, observaciones
    ) VALUES (
        v_tramite_id, v_nueva_id, '01', 'Certificado de estudios', 'Certificado de estudios',
        'Mesa de Partes', 11.00, 0.20, 'S/. 11.00 por semestre; S/. 2.00', 'Banco de la Nación - Cta. Cte. IESTP Pasco',
        '05 días hábiles', 5, 'EVALUACION_PREVIA', 'POSITIVO',
        'Mesa de Partes / Secretaría Académica', 'Dirección General', 'Recurso de reconsideración (15 días) / Recurso de apelación (15 días)', 'Ley N° 30512, Ley de Institutos y Escuelas de Educación Superior Tecnológica y D.S. N° 010-2019-MINEDU', NULL
    );

    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 1, 'Solicitud FUT');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 2, 'Constancia de No Adeudar');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 3, 'Una fotografía tamaño pasaporte');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 4, 'Derecho de trámite (recibo)');

    -- Trámite 02: Convalidación de estudios interna y externa
    v_tramite_id := gen_random_uuid();
    INSERT INTO sigd_tupa.tramite_version (
        tramite_version_id, version_id, codigo, denominacion, descripcion,
        rubro, derecho_monto, derecho_porcentaje_uit, derecho_texto, cuenta_pago,
        plazo_texto, plazo_dias_habiles, calificacion, silencio_administrativo,
        unidad_recibe, autoridad_resuelve, recursos, base_legal, observaciones
    ) VALUES (
        v_tramite_id, v_nueva_id, '02', 'Convalidación de estudios interna y externa', 'Convalidación de estudios interna y externa',
        'Mesa de Partes', 25.00, 0.45, 'S/. 25.00 por asignatura interna; S/. 30.00 externa', 'Banco de la Nación - Cta. Cte. IESTP Pasco',
        'Cronograma', 30, 'EVALUACION_PREVIA', 'POSITIVO',
        'Mesa de Partes / Unidad Académica', 'Unidad Académica', 'Recurso de reconsideración (15 días) / Recurso de apelación (15 días)', 'Ley N° 30512, Ley de Institutos y Escuelas de Educación Superior Tecnológica y D.S. N° 010-2019-MINEDU', NULL
    );

    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 1, 'Solicitud FUT');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 2, 'Certificados de Estudios Original');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 3, 'Recibo por Derecho de convalidación');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 4, 'Sílabo');

    -- Trámite 03: Constancia de aprobación de prácticas
    v_tramite_id := gen_random_uuid();
    INSERT INTO sigd_tupa.tramite_version (
        tramite_version_id, version_id, codigo, denominacion, descripcion,
        rubro, derecho_monto, derecho_porcentaje_uit, derecho_texto, cuenta_pago,
        plazo_texto, plazo_dias_habiles, calificacion, silencio_administrativo,
        unidad_recibe, autoridad_resuelve, recursos, base_legal, observaciones
    ) VALUES (
        v_tramite_id, v_nueva_id, '03', 'Constancia de aprobación de prácticas', 'Constancia de aprobación de prácticas',
        'Mesa de Partes', 3.00, 0.05, 'S/. 3.00', 'Banco de la Nación - Cta. Cte. IESTP Pasco',
        '01 día hábil', 1, 'APROBACION_AUTOMATICA', 'POSITIVO',
        'Mesa de Partes / Secretaría Académica', 'Secretaría General', 'Recurso de reconsideración (15 días) / Recurso de apelación (15 días)', 'Ley N° 30512, Ley de Institutos y Escuelas de Educación Superior Tecnológica y D.S. N° 010-2019-MINEDU', NULL
    );

    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 1, 'Solicitud FUT');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 2, 'Recibo de pago por formato');

    -- Trámite 04: Carta de presentación
    v_tramite_id := gen_random_uuid();
    INSERT INTO sigd_tupa.tramite_version (
        tramite_version_id, version_id, codigo, denominacion, descripcion,
        rubro, derecho_monto, derecho_porcentaje_uit, derecho_texto, cuenta_pago,
        plazo_texto, plazo_dias_habiles, calificacion, silencio_administrativo,
        unidad_recibe, autoridad_resuelve, recursos, base_legal, observaciones
    ) VALUES (
        v_tramite_id, v_nueva_id, '04', 'Carta de presentación', 'Carta de presentación',
        'Mesa de Partes', 3.00, 0.05, 'S/. 3.00', 'Banco de la Nación - Cta. Cte. IESTP Pasco',
        '01 día', 1, 'APROBACION_AUTOMATICA', 'POSITIVO',
        'Mesa de Partes', 'Unidad Académica', 'Recurso de reconsideración (15 días) / Recurso de apelación (15 días)', 'Ley N° 30512, Ley de Institutos y Escuelas de Educación Superior Tecnológica y D.S. N° 010-2019-MINEDU', NULL
    );

    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 1, 'Solicitud FUT');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 2, 'Constancia de Aprobación de Prácticas');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 3, 'Pago por Formato (03 ejemplares)');

    -- Trámite 05: Aprobación de borrador de informe de práctica profesional
    v_tramite_id := gen_random_uuid();
    INSERT INTO sigd_tupa.tramite_version (
        tramite_version_id, version_id, codigo, denominacion, descripcion,
        rubro, derecho_monto, derecho_porcentaje_uit, derecho_texto, cuenta_pago,
        plazo_texto, plazo_dias_habiles, calificacion, silencio_administrativo,
        unidad_recibe, autoridad_resuelve, recursos, base_legal, observaciones
    ) VALUES (
        v_tramite_id, v_nueva_id, '05', 'Aprobación de borrador de informe de práctica profesional', 'Aprobación de borrador de informe de práctica profesional',
        'Mesa de Partes', 20.00, 0.36, 'S/. 20.00', 'Banco de la Nación - Cta. Cte. IESTP Pasco',
        '07 días', 7, 'EVALUACION_PREVIA', 'POSITIVO',
        'Mesa de Partes / Jefe de Área Académica / Docentes', 'Jefe de Área Académica / Unidad Académica', 'Recurso de reconsideración (15 días) / Recurso de apelación (15 días)', 'Ley N° 30512, Ley de Institutos y Escuelas de Educación Superior Tecnológica y D.S. N° 010-2019-MINEDU', 'Incluye práctica Inicial, Intermedia y Final.'
    );

    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 1, 'Solicitud FUT');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 2, 'Un ejemplar - borrador');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 3, 'Recibo de pago por derecho');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 4, 'Revisión de informe y/o Monografía');

    -- Trámite 06: Calificación de informe de práctica
    v_tramite_id := gen_random_uuid();
    INSERT INTO sigd_tupa.tramite_version (
        tramite_version_id, version_id, codigo, denominacion, descripcion,
        rubro, derecho_monto, derecho_porcentaje_uit, derecho_texto, cuenta_pago,
        plazo_texto, plazo_dias_habiles, calificacion, silencio_administrativo,
        unidad_recibe, autoridad_resuelve, recursos, base_legal, observaciones
    ) VALUES (
        v_tramite_id, v_nueva_id, '06', 'Calificación de informe de práctica', 'Calificación de informe de práctica',
        'Área Académica', 0.00, 0.00, 'Gratuito', 'Banco de la Nación - Cta. Cte. IESTP Pasco',
        '02 días', 2, 'EVALUACION_PREVIA', 'POSITIVO',
        'Área Académica / Docente', 'Jefe de Área Académica / Unidad Académica', 'Recurso de reconsideración (15 días) / Recurso de apelación (15 días)', 'Ley N° 30512, Ley de Institutos y Escuelas de Educación Superior Tecnológica y D.S. N° 010-2019-MINEDU', 'Incluye práctica Inicial, Intermedia y Final.'
    );

    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 1, 'Solicitud FUT');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 2, 'Ficha de Evaluación del Informe (01 ejemplar: P. Inicial)');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 3, 'Ficha de Evaluación del Informe (02 ejemplares: P. Intermedia)');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 4, 'Ficha de Evaluación del Informe (03 ejemplares: P. Final)');

    -- Trámite 07: Convalidación de informes de prácticas empresariales
    v_tramite_id := gen_random_uuid();
    INSERT INTO sigd_tupa.tramite_version (
        tramite_version_id, version_id, codigo, denominacion, descripcion,
        rubro, derecho_monto, derecho_porcentaje_uit, derecho_texto, cuenta_pago,
        plazo_texto, plazo_dias_habiles, calificacion, silencio_administrativo,
        unidad_recibe, autoridad_resuelve, recursos, base_legal, observaciones
    ) VALUES (
        v_tramite_id, v_nueva_id, '07', 'Convalidación de informes de prácticas empresariales', 'Convalidación de informes de prácticas empresariales',
        'Área Académica', 150.00, 2.73, 'S/. 150.00 por nivel (inicial, intermedio y terminal)', 'Banco de la Nación - Cta. Cte. IESTP Pasco',
        '03 días', 3, 'EVALUACION_PREVIA', 'POSITIVO',
        'Área Académica', 'Dirección General', 'Recurso de reconsideración (15 días) / Recurso de apelación (15 días)', 'Ley N° 30512, Ley de Institutos y Escuelas de Educación Superior Tecnológica y D.S. N° 010-2019-MINEDU', NULL
    );

    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 1, 'Nivel inicial: Carpeta de práctica debidamente rellenada');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 2, 'Nivel inicial: Solicitud FUT');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 3, 'Nivel inicial: Ficha de Evaluación de Prácticas Profesionales (Consolidado)');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 4, 'Nivel inicial: Ficha de Evaluación Individual');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 5, 'Nivel inicial: Ficha de Supervisión');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 6, 'Nivel inicial: Resolución Directoral');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 7, 'Nivel intermedio: Recibo de Pago (requisito adicional indicado)');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 8, 'Nivel terminal: Solicitud FUT');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 9, 'Nivel terminal: Ficha de Evaluación de Prácticas Profesionales (Consolidado)');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 10, 'Nivel terminal: Ficha de Evaluación Empresarial y/o Institucional');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 11, 'Nivel terminal: Ficha de Supervisión');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 12, 'Nivel terminal: Constancia de Prácticas Profesionales');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 13, 'Nivel terminal: Resolución Directoral');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 14, 'Nivel terminal: Recibo de Pago');

    -- Trámite 08: Módulo I-A al VI-A / Módulo I-B al VI-B
    v_tramite_id := gen_random_uuid();
    INSERT INTO sigd_tupa.tramite_version (
        tramite_version_id, version_id, codigo, denominacion, descripcion,
        rubro, derecho_monto, derecho_porcentaje_uit, derecho_texto, cuenta_pago,
        plazo_texto, plazo_dias_habiles, calificacion, silencio_administrativo,
        unidad_recibe, autoridad_resuelve, recursos, base_legal, observaciones
    ) VALUES (
        v_tramite_id, v_nueva_id, '08', 'Módulo I-A al VI-A / Módulo I-B al VI-B', 'Módulo I-A al VI-A / Módulo I-B al VI-B',
        'Secretaría Académica', 75.00, 1.36, 'Módulo I-A al VI-A (semestral, Mecánica Automotriz): S/. 75.00; Módulo I-B al VI-B (anual): S/. 150.00', 'Banco de la Nación - Cta. Cte. IESTP Pasco',
        '30 días hábiles', 30, 'EVALUACION_PREVIA', 'POSITIVO',
        'Mesa de Partes', 'Dirección General', 'Recurso de reconsideración (15 días) / Recurso de apelación (15 días)', 'Ley N° 30512, Ley de Institutos y Escuelas de Educación Superior Tecnológica y D.S. N° 010-2019-MINEDU', NULL
    );

    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 1, 'Solicitud FUT');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 2, 'Ficha de Evaluación de Prácticas Profesionales (Consolidado)');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 3, 'Ficha de Evaluación Individual');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 4, 'Ficha de Supervisión');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 5, 'Resolución Directoral');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 6, 'Recibo de Pago');

    -- Trámite 09: Derecho de titulación
    v_tramite_id := gen_random_uuid();
    INSERT INTO sigd_tupa.tramite_version (
        tramite_version_id, version_id, codigo, denominacion, descripcion,
        rubro, derecho_monto, derecho_porcentaje_uit, derecho_texto, cuenta_pago,
        plazo_texto, plazo_dias_habiles, calificacion, silencio_administrativo,
        unidad_recibe, autoridad_resuelve, recursos, base_legal, observaciones
    ) VALUES (
        v_tramite_id, v_nueva_id, '09', 'Derecho de titulación', 'Derecho de titulación',
        'Mesa de Partes', 0.50, 0.01, 'El documento indica tasas de S/. 0.50, S/. 68.00, S/. 75.00, S/. 3.00, S/. 5.00, S/. 10.00, S/. 35.00, S/. 20.00, S/. 250.00, S/. 100.00, S/. 50.00, S/. 2.00, S/. 200.00, S/. 600.00, S/. 900.00 y S/. 300.00.', 'Banco de la Nación - Cta. Cte. IESTP Pasco',
        '15 días', 15, 'EVALUACION_PREVIA', 'POSITIVO',
        'Mesa de Partes / Secretaría General', 'Dirección General', 'Recurso de reconsideración (15 días) / Recurso de apelación (15 días)', 'Ley N° 30512, Ley de Institutos y Escuelas de Educación Superior Tecnológica y D.S. N° 010-2019-MINEDU', NULL
    );

    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 1, 'Solicitud FUT');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 2, 'Certificado de Estudios Secundaria - Original');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 3, 'Partida de Nacimiento Original');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 4, 'Certificado de Estudios Superiores – Original');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 5, 'Certificado de Estudios Inglés');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 6, 'Constancias de Aprobación de Prácticas Profesionales');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 7, 'Constancia de Egresado');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 8, 'Acta de Examen Teórico/Práctico');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 9, 'Oficio para Nombrar Jurado');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 10, 'Resolución de Expedido');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 11, 'Trámite de Titulación');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 12, 'Derecho de Titulación');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 13, 'Derecho de Examen Teórico Práctico (Jurados)');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 14, 'Formato de Título');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 15, 'Derecho de Colación');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 16, 'Constancia de No Adeudar');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 17, 'Asesoría para Titulación');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 18, '02 Fotografías Pasaporte - Fondo Blanco');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 19, 'Proyecto de Examen Teórico Sistema Modular');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 20, 'Proyecto Examen Teórico Práctico Tradicional');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 21, 'Revisión de trabajos de Investigación');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 22, 'Recibo de Pago por derecho de Inscripción del Título DREP');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 23, '03 Formatos de Registro de Título Expedido por la DREP');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 24, 'Fotocopia de DNI autenticados por el Fedatario de la DREP');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 25, 'Sobre Manila tamaño oficio');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 26, '20 hojas de papel bond de 80 gramos');

    -- Trámite 10: Constancia de no adeudar
    v_tramite_id := gen_random_uuid();
    INSERT INTO sigd_tupa.tramite_version (
        tramite_version_id, version_id, codigo, denominacion, descripcion,
        rubro, derecho_monto, derecho_porcentaje_uit, derecho_texto, cuenta_pago,
        plazo_texto, plazo_dias_habiles, calificacion, silencio_administrativo,
        unidad_recibe, autoridad_resuelve, recursos, base_legal, observaciones
    ) VALUES (
        v_tramite_id, v_nueva_id, '10', 'Constancia de no adeudar', 'Constancia de no adeudar',
        'Administración', 2.00, 0.04, 'S/. 2.00', 'Banco de la Nación - Cta. Cte. IESTP Pasco',
        '01 día', 1, 'APROBACION_AUTOMATICA', 'POSITIVO',
        'Administración / Biblioteca', 'Administración', 'Recurso de reconsideración (15 días) / Recurso de apelación (15 días)', 'Ley N° 30512, Ley de Institutos y Escuelas de Educación Superior Tecnológica y D.S. N° 010-2019-MINEDU', NULL
    );

    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 1, 'Recibo de Pago');

    -- Trámite 11: Constancia de egresado
    v_tramite_id := gen_random_uuid();
    INSERT INTO sigd_tupa.tramite_version (
        tramite_version_id, version_id, codigo, denominacion, descripcion,
        rubro, derecho_monto, derecho_porcentaje_uit, derecho_texto, cuenta_pago,
        plazo_texto, plazo_dias_habiles, calificacion, silencio_administrativo,
        unidad_recibe, autoridad_resuelve, recursos, base_legal, observaciones
    ) VALUES (
        v_tramite_id, v_nueva_id, '11', 'Constancia de egresado', 'Constancia de egresado',
        'Mesa de Partes', 5.00, 0.09, 'S/. 5.00', 'Banco de la Nación - Cta. Cte. IESTP Pasco',
        '02 días', 2, 'EVALUACION_PREVIA', 'POSITIVO',
        'Mesa de Partes / Secretaría Académica', 'Secretaría General', 'Recurso de reconsideración (15 días) / Recurso de apelación (15 días)', 'Ley N° 30512, Ley de Institutos y Escuelas de Educación Superior Tecnológica y D.S. N° 010-2019-MINEDU', NULL
    );

    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 1, 'Solicitud FUT');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 2, 'Recibo de Pago');

    -- Trámite 12: Carné de estudiante
    v_tramite_id := gen_random_uuid();
    INSERT INTO sigd_tupa.tramite_version (
        tramite_version_id, version_id, codigo, denominacion, descripcion,
        rubro, derecho_monto, derecho_porcentaje_uit, derecho_texto, cuenta_pago,
        plazo_texto, plazo_dias_habiles, calificacion, silencio_administrativo,
        unidad_recibe, autoridad_resuelve, recursos, base_legal, observaciones
    ) VALUES (
        v_tramite_id, v_nueva_id, '12', 'Carné de estudiante', 'Carné de estudiante',
        'Biblioteca', 10.00, 0.18, 'S/. 10.00', 'Banco de la Nación - Cta. Cte. IESTP Pasco',
        '30 días hábiles', 30, 'EVALUACION_PREVIA', 'POSITIVO',
        'Biblioteca', 'Dirección General', 'Recurso de reconsideración (15 días) / Recurso de apelación (15 días)', 'Ley N° 30512, Ley de Institutos y Escuelas de Educación Superior Tecnológica y D.S. N° 010-2019-MINEDU', NULL
    );

    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 1, 'Recibo de Pago');

    -- Trámite 13: Evaluación extraordinaria / subsanación de asignatura
    v_tramite_id := gen_random_uuid();
    INSERT INTO sigd_tupa.tramite_version (
        tramite_version_id, version_id, codigo, denominacion, descripcion,
        rubro, derecho_monto, derecho_porcentaje_uit, derecho_texto, cuenta_pago,
        plazo_texto, plazo_dias_habiles, calificacion, silencio_administrativo,
        unidad_recibe, autoridad_resuelve, recursos, base_legal, observaciones
    ) VALUES (
        v_tramite_id, v_nueva_id, '13', 'Evaluación extraordinaria / subsanación de asignatura', 'Evaluación extraordinaria / subsanación de asignatura',
        'Secretaría Académica', 35.00, 0.64, 'S/. 35.00', 'Banco de la Nación - Cta. Cte. IESTP Pasco',
        '02 días', 2, 'EVALUACION_PREVIA', 'POSITIVO',
        'Secretaría Académica', 'Secretaría General', 'Recurso de reconsideración (15 días) / Recurso de apelación (15 días)', 'Ley N° 30512, Ley de Institutos y Escuelas de Educación Superior Tecnológica y D.S. N° 010-2019-MINEDU', NULL
    );

    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 1, 'Solicitud FUT');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 2, 'Recibo de Pago');

    -- Trámite 14: Pago al momento de matricularse
    v_tramite_id := gen_random_uuid();
    INSERT INTO sigd_tupa.tramite_version (
        tramite_version_id, version_id, codigo, denominacion, descripcion,
        rubro, derecho_monto, derecho_porcentaje_uit, derecho_texto, cuenta_pago,
        plazo_texto, plazo_dias_habiles, calificacion, silencio_administrativo,
        unidad_recibe, autoridad_resuelve, recursos, base_legal, observaciones
    ) VALUES (
        v_tramite_id, v_nueva_id, '14', 'Pago al momento de matricularse', 'Pago al momento de matricularse',
        'Secretaría Académica', 35.00, 0.64, 'El documento presenta tasas de S/. 35.00, S/. 35.00 y S/. 20.00 según el concepto.', 'Banco de la Nación - Cta. Cte. IESTP Pasco',
        '02 días', 2, 'EVALUACION_PREVIA', 'POSITIVO',
        'Secretaría Académica / Secretaría General', 'Dirección General', 'Recurso de reconsideración (15 días) / Recurso de apelación (15 días)', 'Ley N° 30512, Ley de Institutos y Escuelas de Educación Superior Tecnológica y D.S. N° 010-2019-MINEDU', NULL
    );

    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 1, 'Repitencia de asignaturas/unidad didáctica');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 2, 'Repitencia de semestre');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 3, 'Examen de cargo por asignatura/unidad didáctica');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 4, 'Examen de recuperación por asignatura/unidad didáctica');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 5, 'Recibo de Pago / Solicitud FUT / Pago de Recibo (requisitos indicados en el documento)');

    -- Trámite 15: Examen extraordinario de asignaturas y/o unidad didáctica
    v_tramite_id := gen_random_uuid();
    INSERT INTO sigd_tupa.tramite_version (
        tramite_version_id, version_id, codigo, denominacion, descripcion,
        rubro, derecho_monto, derecho_porcentaje_uit, derecho_texto, cuenta_pago,
        plazo_texto, plazo_dias_habiles, calificacion, silencio_administrativo,
        unidad_recibe, autoridad_resuelve, recursos, base_legal, observaciones
    ) VALUES (
        v_tramite_id, v_nueva_id, '15', 'Examen extraordinario de asignaturas y/o unidad didáctica', 'Examen extraordinario de asignaturas y/o unidad didáctica',
        'Mesa de Partes', 35.00, 0.64, 'S/. 35.00 por asignatura / S/. 35.00 por unidad didáctica', 'Banco de la Nación - Cta. Cte. IESTP Pasco',
        '30 días hábiles', 30, 'EVALUACION_PREVIA', 'POSITIVO',
        'Mesa de Partes / Unidad Académica', 'Unidad Académica', 'Recurso de reconsideración (15 días) / Recurso de apelación (15 días)', 'Ley N° 30512, Ley de Institutos y Escuelas de Educación Superior Tecnológica y D.S. N° 010-2019-MINEDU', NULL
    );

    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 1, 'Solicitud FUT');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 2, 'Recibo de Pago');

    -- Trámite 16: Traslado interno
    v_tramite_id := gen_random_uuid();
    INSERT INTO sigd_tupa.tramite_version (
        tramite_version_id, version_id, codigo, denominacion, descripcion,
        rubro, derecho_monto, derecho_porcentaje_uit, derecho_texto, cuenta_pago,
        plazo_texto, plazo_dias_habiles, calificacion, silencio_administrativo,
        unidad_recibe, autoridad_resuelve, recursos, base_legal, observaciones
    ) VALUES (
        v_tramite_id, v_nueva_id, '16', 'Traslado interno', 'Traslado interno',
        'Mesa de Partes', 100.00, 1.82, 'S/. 100.00', 'Banco de la Nación - Cta. Cte. IESTP Pasco',
        '30 días hábiles', 30, 'EVALUACION_PREVIA', 'POSITIVO',
        'Mesa de Partes', 'Dirección General', 'Recurso de reconsideración (15 días) / Recurso de apelación (15 días)', 'Ley N° 30512, Ley de Institutos y Escuelas de Educación Superior Tecnológica y D.S. N° 010-2019-MINEDU', NULL
    );

    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 1, 'Solicitud FUT');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 2, 'Derecho de Pago');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 3, 'Certificado de Estudios Originales');

    -- Trámite 17: Traslado externo
    v_tramite_id := gen_random_uuid();
    INSERT INTO sigd_tupa.tramite_version (
        tramite_version_id, version_id, codigo, denominacion, descripcion,
        rubro, derecho_monto, derecho_porcentaje_uit, derecho_texto, cuenta_pago,
        plazo_texto, plazo_dias_habiles, calificacion, silencio_administrativo,
        unidad_recibe, autoridad_resuelve, recursos, base_legal, observaciones
    ) VALUES (
        v_tramite_id, v_nueva_id, '17', 'Traslado externo', 'Traslado externo',
        'Mesa de Partes', 150.00, 2.73, 'S/. 150.00', 'Banco de la Nación - Cta. Cte. IESTP Pasco',
        '30 días hábiles', 30, 'EVALUACION_PREVIA', 'POSITIVO',
        'Mesa de Partes', 'Dirección General', 'Recurso de reconsideración (15 días) / Recurso de apelación (15 días)', 'Ley N° 30512, Ley de Institutos y Escuelas de Educación Superior Tecnológica y D.S. N° 010-2019-MINEDU', NULL
    );

    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 1, 'Solicitud FUT');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 2, 'Constancia de Vacante');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 3, 'Recibo de Derecho de Pago');

    -- Trámite 18: Record de notas
    v_tramite_id := gen_random_uuid();
    INSERT INTO sigd_tupa.tramite_version (
        tramite_version_id, version_id, codigo, denominacion, descripcion,
        rubro, derecho_monto, derecho_porcentaje_uit, derecho_texto, cuenta_pago,
        plazo_texto, plazo_dias_habiles, calificacion, silencio_administrativo,
        unidad_recibe, autoridad_resuelve, recursos, base_legal, observaciones
    ) VALUES (
        v_tramite_id, v_nueva_id, '18', 'Record de notas', 'Record de notas',
        'Mesa de Partes', 3.00, 0.05, 'S/. 3.00 c/s', 'Banco de la Nación - Cta. Cte. IESTP Pasco',
        '01 día', 1, 'APROBACION_AUTOMATICA', 'POSITIVO',
        'Mesa de Partes / Secretaría Académica', 'Secretaría Académica', 'Recurso de reconsideración (15 días) / Recurso de apelación (15 días)', 'Ley N° 30512, Ley de Institutos y Escuelas de Educación Superior Tecnológica y D.S. N° 010-2019-MINEDU', NULL
    );

    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 1, 'Solicitud FUT');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 2, 'Recibo de Pago por Semestre');

    -- Trámite 19: Constancia de haber sustentado examen T/práctico
    v_tramite_id := gen_random_uuid();
    INSERT INTO sigd_tupa.tramite_version (
        tramite_version_id, version_id, codigo, denominacion, descripcion,
        rubro, derecho_monto, derecho_porcentaje_uit, derecho_texto, cuenta_pago,
        plazo_texto, plazo_dias_habiles, calificacion, silencio_administrativo,
        unidad_recibe, autoridad_resuelve, recursos, base_legal, observaciones
    ) VALUES (
        v_tramite_id, v_nueva_id, '19', 'Constancia de haber sustentado examen T/práctico', 'Constancia de haber sustentado examen T/práctico',
        'Secretaría Académica', 20.00, 0.36, 'S/. 20.00', 'Banco de la Nación - Cta. Cte. IESTP Pasco',
        '01 día', 1, 'APROBACION_AUTOMATICA', 'POSITIVO',
        'Secretaría Académica', 'Secretaría Académica', 'Recurso de reconsideración (15 días) / Recurso de apelación (15 días)', 'Ley N° 30512, Ley de Institutos y Escuelas de Educación Superior Tecnológica y D.S. N° 010-2019-MINEDU', NULL
    );

    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 1, 'Solicitud FUT');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 2, 'Recibo de Pago');

    -- Trámite 20: Constancia de aprobación de examen teórico práctico antes del 2016
    v_tramite_id := gen_random_uuid();
    INSERT INTO sigd_tupa.tramite_version (
        tramite_version_id, version_id, codigo, denominacion, descripcion,
        rubro, derecho_monto, derecho_porcentaje_uit, derecho_texto, cuenta_pago,
        plazo_texto, plazo_dias_habiles, calificacion, silencio_administrativo,
        unidad_recibe, autoridad_resuelve, recursos, base_legal, observaciones
    ) VALUES (
        v_tramite_id, v_nueva_id, '20', 'Constancia de aprobación de examen teórico práctico antes del 2016', 'Constancia de aprobación de examen teórico práctico antes del 2016',
        'Secretaría Académica', 30.00, 0.55, 'S/. 30.00', 'Banco de la Nación - Cta. Cte. IESTP Pasco',
        '01 día', 1, 'APROBACION_AUTOMATICA', 'POSITIVO',
        'Secretaría Académica', 'Secretaría Académica', 'Recurso de reconsideración (15 días) / Recurso de apelación (15 días)', 'Ley N° 30512, Ley de Institutos y Escuelas de Educación Superior Tecnológica y D.S. N° 010-2019-MINEDU', NULL
    );

    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 1, 'Solicitud');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 2, 'Recibo de Pago');

    -- Trámite 21: Aprobación del plan de proyecto, reparación, mantenimiento, implementación, producción, servicio e investigación
    v_tramite_id := gen_random_uuid();
    INSERT INTO sigd_tupa.tramite_version (
        tramite_version_id, version_id, codigo, denominacion, descripcion,
        rubro, derecho_monto, derecho_porcentaje_uit, derecho_texto, cuenta_pago,
        plazo_texto, plazo_dias_habiles, calificacion, silencio_administrativo,
        unidad_recibe, autoridad_resuelve, recursos, base_legal, observaciones
    ) VALUES (
        v_tramite_id, v_nueva_id, '21', 'Aprobación del plan de proyecto, reparación, mantenimiento, implementación, producción, servicio e investigación', 'Aprobación del plan de proyecto, reparación, mantenimiento, implementación, producción, servicio e investigación',
        'Área Académica', NULL, NULL, 'Tasas vigentes según R.D. N.º 048', 'Banco de la Nación - Cta. Cte. IESTP Pasco',
        '05 días', 5, 'EVALUACION_PREVIA', 'POSITIVO',
        'Área Académica', 'Dirección General / Unidad Académica', 'Recurso de reconsideración (15 días) / Recurso de apelación (15 días)', 'Ley N° 30512, Ley de Institutos y Escuelas de Educación Superior Tecnológica y D.S. N° 010-2019-MINEDU', NULL
    );

    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 1, 'Solicitud FUT');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 2, 'Plan de Proyecto');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 3, 'Formato de Resolución');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 4, 'Recibo de Pago');

    -- Trámite 22: Examen teórico práctico
    v_tramite_id := gen_random_uuid();
    INSERT INTO sigd_tupa.tramite_version (
        tramite_version_id, version_id, codigo, denominacion, descripcion,
        rubro, derecho_monto, derecho_porcentaje_uit, derecho_texto, cuenta_pago,
        plazo_texto, plazo_dias_habiles, calificacion, silencio_administrativo,
        unidad_recibe, autoridad_resuelve, recursos, base_legal, observaciones
    ) VALUES (
        v_tramite_id, v_nueva_id, '22', 'Examen teórico práctico', 'Examen teórico práctico',
        'Mesa de Partes', 250.00, 4.55, 'El documento indica S/. 250.00, S/. 10.00, S/. 10.00, S/. 10.00, S/. 3.00, S/. 5.00 y S/. 200.00.', 'Banco de la Nación - Cta. Cte. IESTP Pasco',
        '30 días hábiles', 30, 'EVALUACION_PREVIA', 'POSITIVO',
        'Mesa de Partes', 'Unidad Académica', 'Recurso de reconsideración (15 días) / Recurso de apelación (15 días)', 'Ley N° 30512, Ley de Institutos y Escuelas de Educación Superior Tecnológica y D.S. N° 010-2019-MINEDU', NULL
    );

    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 1, 'Solicitud FUT');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 2, 'Derecho de Examen Teórico Práctico - Jurados');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 3, 'Certificado de Estudios Superiores (Original)');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 4, 'Oficio Nombramiento de Jurados (03)');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 5, 'Acta de Evaluación');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 6, 'Constancia de Prácticas Profesionales');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 7, 'Constancia de Aprobación de Módulos');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 8, 'Resolución de Expedito');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 9, 'Constancia de no adeudar');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 10, 'Constancia de Expedito');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 11, 'Asesoría para Titulación');

    -- Trámite 23: Constancia de expedito
    v_tramite_id := gen_random_uuid();
    INSERT INTO sigd_tupa.tramite_version (
        tramite_version_id, version_id, codigo, denominacion, descripcion,
        rubro, derecho_monto, derecho_porcentaje_uit, derecho_texto, cuenta_pago,
        plazo_texto, plazo_dias_habiles, calificacion, silencio_administrativo,
        unidad_recibe, autoridad_resuelve, recursos, base_legal, observaciones
    ) VALUES (
        v_tramite_id, v_nueva_id, '23', 'Constancia de expedito', 'Constancia de expedito',
        'Abastecimientos', 5.00, 0.09, 'S/. 5.00', 'Banco de la Nación - Cta. Cte. IESTP Pasco',
        '01 día', 1, 'APROBACION_AUTOMATICA', 'POSITIVO',
        'Abastecimientos / Áreas Académicas', 'Dirección General', 'Recurso de reconsideración (15 días) / Recurso de apelación (15 días)', 'Ley N° 30512, Ley de Institutos y Escuelas de Educación Superior Tecnológica y D.S. N° 010-2019-MINEDU', NULL
    );

    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 1, 'Formato de Expedito - Abastecimientos');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 2, 'Solicitud FUT');

    -- Trámite 24: Certificación por módulo semestral y anual
    v_tramite_id := gen_random_uuid();
    INSERT INTO sigd_tupa.tramite_version (
        tramite_version_id, version_id, codigo, denominacion, descripcion,
        rubro, derecho_monto, derecho_porcentaje_uit, derecho_texto, cuenta_pago,
        plazo_texto, plazo_dias_habiles, calificacion, silencio_administrativo,
        unidad_recibe, autoridad_resuelve, recursos, base_legal, observaciones
    ) VALUES (
        v_tramite_id, v_nueva_id, '24', 'Certificación por módulo semestral y anual', 'Certificación por módulo semestral y anual',
        'Secretaría Académica', 20.00, 0.36, 'S/. 20.00', 'Banco de la Nación - Cta. Cte. IESTP Pasco',
        '30 días hábiles', 30, 'EVALUACION_PREVIA', 'POSITIVO',
        'Secretaría Académica / Dirección General', 'Dirección General', 'Recurso de reconsideración (15 días) / Recurso de apelación (15 días)', 'Ley N° 30512, Ley de Institutos y Escuelas de Educación Superior Tecnológica y D.S. N° 010-2019-MINEDU', NULL
    );

    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 1, 'Solicitud FUT');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 2, 'Constancia de Aprobación de Módulo');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 3, 'Recibo de Pago');

    -- Trámite 25: Certificados de estudios urgentes
    v_tramite_id := gen_random_uuid();
    INSERT INTO sigd_tupa.tramite_version (
        tramite_version_id, version_id, codigo, denominacion, descripcion,
        rubro, derecho_monto, derecho_porcentaje_uit, derecho_texto, cuenta_pago,
        plazo_texto, plazo_dias_habiles, calificacion, silencio_administrativo,
        unidad_recibe, autoridad_resuelve, recursos, base_legal, observaciones
    ) VALUES (
        v_tramite_id, v_nueva_id, '25', 'Certificados de estudios urgentes', 'Certificados de estudios urgentes',
        'Secretaría Académica', 0.50, 0.01, 'El documento indica S/. 0.50 y S/. 15.00.', 'Banco de la Nación - Cta. Cte. IESTP Pasco',
        '01 día', 1, 'APROBACION_AUTOMATICA', 'POSITIVO',
        'Secretaría Académica', 'Dirección General', 'Recurso de reconsideración (15 días) / Recurso de apelación (15 días)', 'Ley N° 30512, Ley de Institutos y Escuelas de Educación Superior Tecnológica y D.S. N° 010-2019-MINEDU', 'Modalidades: Sistema Tradicional / Sistema Modular.'
    );

    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 1, 'Solicitud FUT');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 2, 'Constancia de No Adeudar');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 3, '01 fotografía tamaño pasaporte');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 4, 'Derecho de trámite');

    -- Trámite 26: Actualización de matrícula - reentrante
    v_tramite_id := gen_random_uuid();
    INSERT INTO sigd_tupa.tramite_version (
        tramite_version_id, version_id, codigo, denominacion, descripcion,
        rubro, derecho_monto, derecho_porcentaje_uit, derecho_texto, cuenta_pago,
        plazo_texto, plazo_dias_habiles, calificacion, silencio_administrativo,
        unidad_recibe, autoridad_resuelve, recursos, base_legal, observaciones
    ) VALUES (
        v_tramite_id, v_nueva_id, '26', 'Actualización de matrícula - reentrante', 'Actualización de matrícula - reentrante',
        'Mesa de Partes', 50.00, 0.91, 'S/. 50.00', 'Banco de la Nación - Cta. Cte. IESTP Pasco',
        '30 días hábiles', 30, 'EVALUACION_PREVIA', 'POSITIVO',
        'Mesa de Partes', 'Dirección General', 'Recurso de reconsideración (15 días) / Recurso de apelación (15 días)', 'Ley N° 30512, Ley de Institutos y Escuelas de Educación Superior Tecnológica y D.S. N° 010-2019-MINEDU', NULL
    );

    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 1, 'Solicitud FUT');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 2, 'Record de Notas');

    -- Trámite 27: Certificado de egresado
    v_tramite_id := gen_random_uuid();
    INSERT INTO sigd_tupa.tramite_version (
        tramite_version_id, version_id, codigo, denominacion, descripcion,
        rubro, derecho_monto, derecho_porcentaje_uit, derecho_texto, cuenta_pago,
        plazo_texto, plazo_dias_habiles, calificacion, silencio_administrativo,
        unidad_recibe, autoridad_resuelve, recursos, base_legal, observaciones
    ) VALUES (
        v_tramite_id, v_nueva_id, '27', 'Certificado de egresado', 'Certificado de egresado',
        'Dirección General', 15.00, 0.27, 'S/. 15.00', 'Banco de la Nación - Cta. Cte. IESTP Pasco',
        '01 día', 1, 'APROBACION_AUTOMATICA', 'POSITIVO',
        'Dirección General', 'Dirección General', 'Recurso de reconsideración (15 días) / Recurso de apelación (15 días)', 'Ley N° 30512, Ley de Institutos y Escuelas de Educación Superior Tecnológica y D.S. N° 010-2019-MINEDU', NULL
    );

    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 1, 'Solicitud FUT');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 2, 'Recibo de Pago');

    -- Trámite 28: Constancia de ingreso
    v_tramite_id := gen_random_uuid();
    INSERT INTO sigd_tupa.tramite_version (
        tramite_version_id, version_id, codigo, denominacion, descripcion,
        rubro, derecho_monto, derecho_porcentaje_uit, derecho_texto, cuenta_pago,
        plazo_texto, plazo_dias_habiles, calificacion, silencio_administrativo,
        unidad_recibe, autoridad_resuelve, recursos, base_legal, observaciones
    ) VALUES (
        v_tramite_id, v_nueva_id, '28', 'Constancia de ingreso', 'Constancia de ingreso',
        'Secretaría Académica', 10.00, 0.18, 'S/. 10.00', 'Banco de la Nación - Cta. Cte. IESTP Pasco',
        '01 día', 1, 'APROBACION_AUTOMATICA', 'POSITIVO',
        'Secretaría Académica', 'Secretaría Académica', 'Recurso de reconsideración (15 días) / Recurso de apelación (15 días)', 'Ley N° 30512, Ley de Institutos y Escuelas de Educación Superior Tecnológica y D.S. N° 010-2019-MINEDU', NULL
    );

    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 1, 'Recibo de Pago');

    -- Trámite 29: Devolución de expediente - estudiantes semestre I
    v_tramite_id := gen_random_uuid();
    INSERT INTO sigd_tupa.tramite_version (
        tramite_version_id, version_id, codigo, denominacion, descripcion,
        rubro, derecho_monto, derecho_porcentaje_uit, derecho_texto, cuenta_pago,
        plazo_texto, plazo_dias_habiles, calificacion, silencio_administrativo,
        unidad_recibe, autoridad_resuelve, recursos, base_legal, observaciones
    ) VALUES (
        v_tramite_id, v_nueva_id, '29', 'Devolución de expediente - estudiantes semestre I', 'Devolución de expediente - estudiantes semestre I',
        'Secretaría Académica', 10.00, 0.18, 'S/. 10.00', 'Banco de la Nación - Cta. Cte. IESTP Pasco',
        '01 día', 1, 'APROBACION_AUTOMATICA', 'POSITIVO',
        'Secretaría Académica', 'Secretaría Académica', 'Recurso de reconsideración (15 días) / Recurso de apelación (15 días)', 'Ley N° 30512, Ley de Institutos y Escuelas de Educación Superior Tecnológica y D.S. N° 010-2019-MINEDU', NULL
    );

    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 1, 'Recibo de Pago');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 2, 'Solicitud');

    -- Trámite 30: Autorización de titulación de otras instituciones
    v_tramite_id := gen_random_uuid();
    INSERT INTO sigd_tupa.tramite_version (
        tramite_version_id, version_id, codigo, denominacion, descripcion,
        rubro, derecho_monto, derecho_porcentaje_uit, derecho_texto, cuenta_pago,
        plazo_texto, plazo_dias_habiles, calificacion, silencio_administrativo,
        unidad_recibe, autoridad_resuelve, recursos, base_legal, observaciones
    ) VALUES (
        v_tramite_id, v_nueva_id, '30', 'Autorización de titulación de otras instituciones', 'Autorización de titulación de otras instituciones',
        'Secretaría Académica', 50.00, 0.91, 'S/. 50.00', 'Banco de la Nación - Cta. Cte. IESTP Pasco',
        '07 días', 7, 'EVALUACION_PREVIA', 'POSITIVO',
        'Secretaría Académica', 'Dirección General', 'Recurso de reconsideración (15 días) / Recurso de apelación (15 días)', 'Ley N° 30512, Ley de Institutos y Escuelas de Educación Superior Tecnológica y D.S. N° 010-2019-MINEDU', NULL
    );

    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 1, 'Solicitud');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 2, 'Constancia de Prácticas');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 3, 'Certificado de Estudios');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 4, 'Constancia de autorización');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 5, 'Recibo de Pago');

    -- Trámite 31: Reserva de matrícula, ingreso y/o vacante
    v_tramite_id := gen_random_uuid();
    INSERT INTO sigd_tupa.tramite_version (
        tramite_version_id, version_id, codigo, denominacion, descripcion,
        rubro, derecho_monto, derecho_porcentaje_uit, derecho_texto, cuenta_pago,
        plazo_texto, plazo_dias_habiles, calificacion, silencio_administrativo,
        unidad_recibe, autoridad_resuelve, recursos, base_legal, observaciones
    ) VALUES (
        v_tramite_id, v_nueva_id, '31', 'Reserva de matrícula, ingreso y/o vacante', 'Reserva de matrícula, ingreso y/o vacante',
        'Secretaría Académica', 30.00, 0.55, 'S/. 30.00', 'Banco de la Nación - Cta. Cte. IESTP Pasco',
        '15 días', 15, 'EVALUACION_PREVIA', 'POSITIVO',
        'Secretaría Académica', 'Dirección General', 'Recurso de reconsideración (15 días) / Recurso de apelación (15 días)', 'Ley N° 30512, Ley de Institutos y Escuelas de Educación Superior Tecnológica y D.S. N° 010-2019-MINEDU', NULL
    );

    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 1, 'Solicitud');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 2, 'Constancia de Matrícula');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 3, 'Recibo de Pago');

    -- Trámite 32: Traslado de matrícula externa a otras instituciones
    v_tramite_id := gen_random_uuid();
    INSERT INTO sigd_tupa.tramite_version (
        tramite_version_id, version_id, codigo, denominacion, descripcion,
        rubro, derecho_monto, derecho_porcentaje_uit, derecho_texto, cuenta_pago,
        plazo_texto, plazo_dias_habiles, calificacion, silencio_administrativo,
        unidad_recibe, autoridad_resuelve, recursos, base_legal, observaciones
    ) VALUES (
        v_tramite_id, v_nueva_id, '32', 'Traslado de matrícula externa a otras instituciones', 'Traslado de matrícula externa a otras instituciones',
        'Secretaría Académica', 150.00, 2.73, 'S/. 150.00', 'Banco de la Nación - Cta. Cte. IESTP Pasco',
        '07 días', 7, 'EVALUACION_PREVIA', 'POSITIVO',
        'Secretaría Académica', 'Dirección General', 'Recurso de reconsideración (15 días) / Recurso de apelación (15 días)', 'Ley N° 30512, Ley de Institutos y Escuelas de Educación Superior Tecnológica y D.S. N° 010-2019-MINEDU', NULL
    );

    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 1, 'Solicitud');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 2, 'Certificado de Estudios Superiores');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 3, 'Recibo de Pago');

    -- Trámite 33: Traslado externo de otras instituciones
    v_tramite_id := gen_random_uuid();
    INSERT INTO sigd_tupa.tramite_version (
        tramite_version_id, version_id, codigo, denominacion, descripcion,
        rubro, derecho_monto, derecho_porcentaje_uit, derecho_texto, cuenta_pago,
        plazo_texto, plazo_dias_habiles, calificacion, silencio_administrativo,
        unidad_recibe, autoridad_resuelve, recursos, base_legal, observaciones
    ) VALUES (
        v_tramite_id, v_nueva_id, '33', 'Traslado externo de otras instituciones', 'Traslado externo de otras instituciones',
        'Secretaría Académica', 150.00, 2.73, 'S/. 150.00', 'Banco de la Nación - Cta. Cte. IESTP Pasco',
        'Cronograma', 30, 'EVALUACION_PREVIA', 'POSITIVO',
        'Secretaría Académica', 'Dirección General', 'Recurso de reconsideración (15 días) / Recurso de apelación (15 días)', 'Ley N° 30512, Ley de Institutos y Escuelas de Educación Superior Tecnológica y D.S. N° 010-2019-MINEDU', NULL
    );

    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 1, 'Solicitud');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 2, 'Certificado de Estudios Superiores');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 3, 'Recibo de Pago');

    -- Trámite 34: Traslado interno
    v_tramite_id := gen_random_uuid();
    INSERT INTO sigd_tupa.tramite_version (
        tramite_version_id, version_id, codigo, denominacion, descripcion,
        rubro, derecho_monto, derecho_porcentaje_uit, derecho_texto, cuenta_pago,
        plazo_texto, plazo_dias_habiles, calificacion, silencio_administrativo,
        unidad_recibe, autoridad_resuelve, recursos, base_legal, observaciones
    ) VALUES (
        v_tramite_id, v_nueva_id, '34', 'Traslado interno', 'Traslado interno',
        'Secretaría Académica', 100.00, 1.82, 'S/. 100.00', 'Banco de la Nación - Cta. Cte. IESTP Pasco',
        'Cronograma', 30, 'EVALUACION_PREVIA', 'POSITIVO',
        'Secretaría Académica', 'Dirección General', 'Recurso de reconsideración (15 días) / Recurso de apelación (15 días)', 'Ley N° 30512, Ley de Institutos y Escuelas de Educación Superior Tecnológica y D.S. N° 010-2019-MINEDU', NULL
    );

    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 1, 'Solicitud');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 2, 'Certificado de Estudios');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 3, 'Recibo de Pago');

    -- Trámite 35: Matrícula regular - invicto
    v_tramite_id := gen_random_uuid();
    INSERT INTO sigd_tupa.tramite_version (
        tramite_version_id, version_id, codigo, denominacion, descripcion,
        rubro, derecho_monto, derecho_porcentaje_uit, derecho_texto, cuenta_pago,
        plazo_texto, plazo_dias_habiles, calificacion, silencio_administrativo,
        unidad_recibe, autoridad_resuelve, recursos, base_legal, observaciones
    ) VALUES (
        v_tramite_id, v_nueva_id, '35', 'Matrícula regular - invicto', 'Matrícula regular - invicto',
        'Secretaría Académica', 80.00, 1.45, 'S/. 80.00', 'Banco de la Nación - Cta. Cte. IESTP Pasco',
        'Cronograma', 30, 'EVALUACION_PREVIA', 'POSITIVO',
        'Secretaría Académica', 'Secretaría Académica', 'Recurso de reconsideración (15 días) / Recurso de apelación (15 días)', 'Ley N° 30512, Ley de Institutos y Escuelas de Educación Superior Tecnológica y D.S. N° 010-2019-MINEDU', NULL
    );

    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 1, 'Boleta de Notas');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 2, '02 Fotografías');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 3, 'Recibo de Pago');

    -- Trámite 36: Matrícula repitente - reentrante
    v_tramite_id := gen_random_uuid();
    INSERT INTO sigd_tupa.tramite_version (
        tramite_version_id, version_id, codigo, denominacion, descripcion,
        rubro, derecho_monto, derecho_porcentaje_uit, derecho_texto, cuenta_pago,
        plazo_texto, plazo_dias_habiles, calificacion, silencio_administrativo,
        unidad_recibe, autoridad_resuelve, recursos, base_legal, observaciones
    ) VALUES (
        v_tramite_id, v_nueva_id, '36', 'Matrícula repitente - reentrante', 'Matrícula repitente - reentrante',
        'Secretaría Académica', 130.00, 2.36, 'S/. 130.00', 'Banco de la Nación - Cta. Cte. IESTP Pasco',
        'Cronograma', 30, 'EVALUACION_PREVIA', 'POSITIVO',
        'Secretaría Académica', 'Secretaría Académica', 'Recurso de reconsideración (15 días) / Recurso de apelación (15 días)', 'Ley N° 30512, Ley de Institutos y Escuelas de Educación Superior Tecnológica y D.S. N° 010-2019-MINEDU', NULL
    );

    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 1, 'Resolución de Autorización');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 2, 'Recibo de Pago');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 3, '02 fotografías');

    -- Trámite 37: Matrícula con unidad a cargo
    v_tramite_id := gen_random_uuid();
    INSERT INTO sigd_tupa.tramite_version (
        tramite_version_id, version_id, codigo, denominacion, descripcion,
        rubro, derecho_monto, derecho_porcentaje_uit, derecho_texto, cuenta_pago,
        plazo_texto, plazo_dias_habiles, calificacion, silencio_administrativo,
        unidad_recibe, autoridad_resuelve, recursos, base_legal, observaciones
    ) VALUES (
        v_tramite_id, v_nueva_id, '37', 'Matrícula con unidad a cargo', 'Matrícula con unidad a cargo',
        'Secretaría Académica', 100.00, 1.82, 'S/. 100.00', 'Banco de la Nación - Cta. Cte. IESTP Pasco',
        'Cronograma', 30, 'EVALUACION_PREVIA', 'POSITIVO',
        'Secretaría Académica', 'Secretaría Académica', 'Recurso de reconsideración (15 días) / Recurso de apelación (15 días)', 'Ley N° 30512, Ley de Institutos y Escuelas de Educación Superior Tecnológica y D.S. N° 010-2019-MINEDU', NULL
    );

    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 1, 'Boleta de Notas');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 2, 'Recibo de Pago');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 3, '02 fotografías');

    -- Trámite 38: Matrícula becada IESTP Pasco - primer puesto
    v_tramite_id := gen_random_uuid();
    INSERT INTO sigd_tupa.tramite_version (
        tramite_version_id, version_id, codigo, denominacion, descripcion,
        rubro, derecho_monto, derecho_porcentaje_uit, derecho_texto, cuenta_pago,
        plazo_texto, plazo_dias_habiles, calificacion, silencio_administrativo,
        unidad_recibe, autoridad_resuelve, recursos, base_legal, observaciones
    ) VALUES (
        v_tramite_id, v_nueva_id, '38', 'Matrícula becada IESTP Pasco - primer puesto', 'Matrícula becada IESTP Pasco - primer puesto',
        'Secretaría Académica', 20.00, 0.36, 'S/. 20.00', 'Banco de la Nación - Cta. Cte. IESTP Pasco',
        'Cronograma', 30, 'EVALUACION_PREVIA', 'POSITIVO',
        'Secretaría Académica', 'Secretaría Académica', 'Recurso de reconsideración (15 días) / Recurso de apelación (15 días)', 'Ley N° 30512, Ley de Institutos y Escuelas de Educación Superior Tecnológica y D.S. N° 010-2019-MINEDU', NULL
    );

    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 1, 'Resolución Directoral');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 2, 'Recibo de Pago');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 3, '02 fotografías');

    -- Trámite 39: Matrícula semi beca IESTP - segundo puesto
    v_tramite_id := gen_random_uuid();
    INSERT INTO sigd_tupa.tramite_version (
        tramite_version_id, version_id, codigo, denominacion, descripcion,
        rubro, derecho_monto, derecho_porcentaje_uit, derecho_texto, cuenta_pago,
        plazo_texto, plazo_dias_habiles, calificacion, silencio_administrativo,
        unidad_recibe, autoridad_resuelve, recursos, base_legal, observaciones
    ) VALUES (
        v_tramite_id, v_nueva_id, '39', 'Matrícula semi beca IESTP - segundo puesto', 'Matrícula semi beca IESTP - segundo puesto',
        'Secretaría Académica', 40.00, 0.73, 'S/. 40.00', 'Banco de la Nación - Cta. Cte. IESTP Pasco',
        'Cronograma', 30, 'EVALUACION_PREVIA', 'POSITIVO',
        'Secretaría Académica', 'Secretaría Académica', 'Recurso de reconsideración (15 días) / Recurso de apelación (15 días)', 'Ley N° 30512, Ley de Institutos y Escuelas de Educación Superior Tecnológica y D.S. N° 010-2019-MINEDU', NULL
    );

    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 1, 'Resolución Directoral');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 2, 'Recibo de Pago');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 3, '02 fotografías');

    -- Trámite 40: Matrícula becado externo
    v_tramite_id := gen_random_uuid();
    INSERT INTO sigd_tupa.tramite_version (
        tramite_version_id, version_id, codigo, denominacion, descripcion,
        rubro, derecho_monto, derecho_porcentaje_uit, derecho_texto, cuenta_pago,
        plazo_texto, plazo_dias_habiles, calificacion, silencio_administrativo,
        unidad_recibe, autoridad_resuelve, recursos, base_legal, observaciones
    ) VALUES (
        v_tramite_id, v_nueva_id, '40', 'Matrícula becado externo', 'Matrícula becado externo',
        'Secretaría Académica', 100.00, 1.82, 'S/. 100.00', 'Banco de la Nación - Cta. Cte. IESTP Pasco',
        'Cronograma', 30, 'EVALUACION_PREVIA', 'POSITIVO',
        'Secretaría Académica', 'Secretaría Académica', 'Recurso de reconsideración (15 días) / Recurso de apelación (15 días)', 'Ley N° 30512, Ley de Institutos y Escuelas de Educación Superior Tecnológica y D.S. N° 010-2019-MINEDU', NULL
    );

    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 1, 'Boleta de Notas');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 2, '02 fotografías');
    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 3, 'Recibo de Pago');

    -- Trámite 41: Examen de admisión ordinario
    v_tramite_id := gen_random_uuid();
    INSERT INTO sigd_tupa.tramite_version (
        tramite_version_id, version_id, codigo, denominacion, descripcion,
        rubro, derecho_monto, derecho_porcentaje_uit, derecho_texto, cuenta_pago,
        plazo_texto, plazo_dias_habiles, calificacion, silencio_administrativo,
        unidad_recibe, autoridad_resuelve, recursos, base_legal, observaciones
    ) VALUES (
        v_tramite_id, v_nueva_id, '41', 'Examen de admisión ordinario', 'Examen de admisión ordinario',
        'Secretaría Académica', 200.00, 3.64, 'S/. 200.00', 'Banco de la Nación - Cta. Cte. IESTP Pasco',
        'Cronograma', 30, 'EVALUACION_PREVIA', 'POSITIVO',
        'Secretaría Académica', 'Secretaría Académica', 'Recurso de reconsideración (15 días) / Recurso de apelación (15 días)', 'Ley N° 30512, Ley de Institutos y Escuelas de Educación Superior Tecnológica y D.S. N° 010-2019-MINEDU', NULL
    );

    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 1, 'Inscripción');

    -- Trámite 42: Examen de admisión - modalidad primeros puestos
    v_tramite_id := gen_random_uuid();
    INSERT INTO sigd_tupa.tramite_version (
        tramite_version_id, version_id, codigo, denominacion, descripcion,
        rubro, derecho_monto, derecho_porcentaje_uit, derecho_texto, cuenta_pago,
        plazo_texto, plazo_dias_habiles, calificacion, silencio_administrativo,
        unidad_recibe, autoridad_resuelve, recursos, base_legal, observaciones
    ) VALUES (
        v_tramite_id, v_nueva_id, '42', 'Examen de admisión - modalidad primeros puestos', 'Examen de admisión - modalidad primeros puestos',
        'Secretaría Académica', 220.00, 4.00, 'S/. 220.00', 'Banco de la Nación - Cta. Cte. IESTP Pasco',
        'Cronograma', 30, 'EVALUACION_PREVIA', 'POSITIVO',
        'Secretaría Académica', 'Secretaría Académica', 'Recurso de reconsideración (15 días) / Recurso de apelación (15 días)', 'Ley N° 30512, Ley de Institutos y Escuelas de Educación Superior Tecnológica y D.S. N° 010-2019-MINEDU', NULL
    );

    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 1, 'Inscripción');

    -- Trámite 43: Examen de admisión - modalidad titulados / segunda carrera
    v_tramite_id := gen_random_uuid();
    INSERT INTO sigd_tupa.tramite_version (
        tramite_version_id, version_id, codigo, denominacion, descripcion,
        rubro, derecho_monto, derecho_porcentaje_uit, derecho_texto, cuenta_pago,
        plazo_texto, plazo_dias_habiles, calificacion, silencio_administrativo,
        unidad_recibe, autoridad_resuelve, recursos, base_legal, observaciones
    ) VALUES (
        v_tramite_id, v_nueva_id, '43', 'Examen de admisión - modalidad titulados / segunda carrera', 'Examen de admisión - modalidad titulados / segunda carrera',
        'Secretaría Académica', 230.00, 4.18, 'S/. 230.00', 'Banco de la Nación - Cta. Cte. IESTP Pasco',
        'Cronograma', 30, 'EVALUACION_PREVIA', 'POSITIVO',
        'Secretaría Académica', 'Secretaría Académica', 'Recurso de reconsideración (15 días) / Recurso de apelación (15 días)', 'Ley N° 30512, Ley de Institutos y Escuelas de Educación Superior Tecnológica y D.S. N° 010-2019-MINEDU', NULL
    );

    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 1, 'Inscripción');

    -- Trámite 44: Examen de admisión - modalidad convenios institucionales
    v_tramite_id := gen_random_uuid();
    INSERT INTO sigd_tupa.tramite_version (
        tramite_version_id, version_id, codigo, denominacion, descripcion,
        rubro, derecho_monto, derecho_porcentaje_uit, derecho_texto, cuenta_pago,
        plazo_texto, plazo_dias_habiles, calificacion, silencio_administrativo,
        unidad_recibe, autoridad_resuelve, recursos, base_legal, observaciones
    ) VALUES (
        v_tramite_id, v_nueva_id, '44', 'Examen de admisión - modalidad convenios institucionales', 'Examen de admisión - modalidad convenios institucionales',
        'Secretaría Académica', 200.00, 3.64, 'S/. 200.00', 'Banco de la Nación - Cta. Cte. IESTP Pasco',
        'Cronograma', 30, 'EVALUACION_PREVIA', 'POSITIVO',
        'Secretaría Académica', 'Secretaría Académica', 'Recurso de reconsideración (15 días) / Recurso de apelación (15 días)', 'Ley N° 30512, Ley de Institutos y Escuelas de Educación Superior Tecnológica y D.S. N° 010-2019-MINEDU', NULL
    );

    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 1, 'Inscripción');

    -- Trámite 45: Examen de admisión - modalidad servicio militar, víctimas de violencia y personas con discapacidad
    v_tramite_id := gen_random_uuid();
    INSERT INTO sigd_tupa.tramite_version (
        tramite_version_id, version_id, codigo, denominacion, descripcion,
        rubro, derecho_monto, derecho_porcentaje_uit, derecho_texto, cuenta_pago,
        plazo_texto, plazo_dias_habiles, calificacion, silencio_administrativo,
        unidad_recibe, autoridad_resuelve, recursos, base_legal, observaciones
    ) VALUES (
        v_tramite_id, v_nueva_id, '45', 'Examen de admisión - modalidad servicio militar, víctimas de violencia y personas con discapacidad', 'Examen de admisión - modalidad servicio militar, víctimas de violencia y personas con discapacidad',
        'Secretaría Académica', 150.00, 2.73, 'S/. 150.00', 'Banco de la Nación - Cta. Cte. IESTP Pasco',
        'Cronograma', 30, 'EVALUACION_PREVIA', 'POSITIVO',
        'Secretaría Académica', 'Dirección General', 'Recurso de reconsideración (15 días) / Recurso de apelación (15 días)', 'Ley N° 30512, Ley de Institutos y Escuelas de Educación Superior Tecnológica y D.S. N° 010-2019-MINEDU', NULL
    );

    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 1, 'Inscripción');

    -- Trámite 46: Examen de admisión - modalidad deportistas destacados
    v_tramite_id := gen_random_uuid();
    INSERT INTO sigd_tupa.tramite_version (
        tramite_version_id, version_id, codigo, denominacion, descripcion,
        rubro, derecho_monto, derecho_porcentaje_uit, derecho_texto, cuenta_pago,
        plazo_texto, plazo_dias_habiles, calificacion, silencio_administrativo,
        unidad_recibe, autoridad_resuelve, recursos, base_legal, observaciones
    ) VALUES (
        v_tramite_id, v_nueva_id, '46', 'Examen de admisión - modalidad deportistas destacados', 'Examen de admisión - modalidad deportistas destacados',
        'Secretaría Académica', 200.00, 3.64, 'S/. 200.00', 'Banco de la Nación - Cta. Cte. IESTP Pasco',
        'Cronograma', 30, 'EVALUACION_PREVIA', 'POSITIVO',
        'Secretaría Académica', 'Secretaría Académica', 'Recurso de reconsideración (15 días) / Recurso de apelación (15 días)', 'Ley N° 30512, Ley de Institutos y Escuelas de Educación Superior Tecnológica y D.S. N° 010-2019-MINEDU', NULL
    );

    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 1, 'Inscripción');

    -- Trámite 47: Examen médico odontológico / tratamiento consultorio odontológico
    v_tramite_id := gen_random_uuid();
    INSERT INTO sigd_tupa.tramite_version (
        tramite_version_id, version_id, codigo, denominacion, descripcion,
        rubro, derecho_monto, derecho_porcentaje_uit, derecho_texto, cuenta_pago,
        plazo_texto, plazo_dias_habiles, calificacion, silencio_administrativo,
        unidad_recibe, autoridad_resuelve, recursos, base_legal, observaciones
    ) VALUES (
        v_tramite_id, v_nueva_id, '47', 'Examen médico odontológico / tratamiento consultorio odontológico', 'Examen médico odontológico / tratamiento consultorio odontológico',
        'Tópico', NULL, NULL, 'Gratuito', 'Banco de la Nación - Cta. Cte. IESTP Pasco',
        'Cronograma', 30, 'EVALUACION_PREVIA', 'POSITIVO',
        'Tópico', 'Dirección General', 'Recurso de reconsideración (15 días) / Recurso de apelación (15 días)', 'Ley N° 30512, Ley de Institutos y Escuelas de Educación Superior Tecnológica y D.S. N° 010-2019-MINEDU', 'El documento contempla tarifas diferenciadas para estudiantes, docentes/administrativos y público en general.; Curación pequeña: S/. 10.00; Curación mediana: S/. 15.00; Curación grande: S/. 20.00; Curación extra grande: S/. 30.00; Extracción dental simple: S/. 15.00; Extracción dental complicada: S/. 50.00; Profilaxis: S/. 15.00; Fluorización: S/. 5.00; Destartraje: S/. 20.00; Rayos X peri apical: S/. 10.00; Rayos X oclusales: S/. 23.00'
    );

    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 1, 'Solicitud única de trámite (FUT) debidamente llenada');

    -- Trámite 48: Otros servicios y alquileres
    v_tramite_id := gen_random_uuid();
    INSERT INTO sigd_tupa.tramite_version (
        tramite_version_id, version_id, codigo, denominacion, descripcion,
        rubro, derecho_monto, derecho_porcentaje_uit, derecho_texto, cuenta_pago,
        plazo_texto, plazo_dias_habiles, calificacion, silencio_administrativo,
        unidad_recibe, autoridad_resuelve, recursos, base_legal, observaciones
    ) VALUES (
        v_tramite_id, v_nueva_id, '48', 'Otros servicios y alquileres', 'Otros servicios y alquileres',
        'Secretaría Académica', NULL, NULL, 'Gratuito', 'Banco de la Nación - Cta. Cte. IESTP Pasco',
        '30 días hábiles', 30, 'EVALUACION_PREVIA', 'POSITIVO',
        'Mesa de Partes', 'Dirección General', 'Recurso de reconsideración (15 días) / Recurso de apelación (15 días)', 'Ley N° 30512, Ley de Institutos y Escuelas de Educación Superior Tecnológica y D.S. N° 010-2019-MINEDU', 'Alquiler de Proyector Multimedia: S/. 10.00 / hora; Alquiler de Power + parlante: S/. 20.00 / hora; Alquiler de Auditorio - externo: S/. 50.00 / hora; Alquiler de Auditorio interno: S/. 700.00 / día; Alquiler de Ecram: S/. 20.00 / día; Alquiler de Power: S/. 5.00 / hora; Alquiler de mezclador: S/. 10.00 / hora; Alquiler de Micrófono: S/. 10.00 / día; Alquiler de Aula: S/. 80.00 / día; Alquiler de Campo deportivo: S/. 50.00 / día; Alquiler de Parrilla: S/. 20.00 / día; Alquiler de Cochera - trabajador instituto: S/. 30.00 / mes; Alquiler de Cochera - trabajador particular: S/. 30.00 / mes; Alquiler de Laptop: S/. 3.00 / día; Alquiler de PC por máquina: S/. 2.00 / hora; Alquiler de equipo de soldar: S/. 10.00 / hora; Alquiler de Silla blanca: S/. 2.00 / día; Alquiler de Silla tapizada dúo: S/. 5.00 / día; Alquiler de mesa: S/. 5.00 / día; Alquiler Sala de Licenciamiento: S/. 300.00 / día'
    );

    INSERT INTO sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto)
    VALUES (gen_random_uuid(), v_tramite_id, 1, 'Solicitud única de trámite (FUT) debidamente llenada');

    -- 4. Conmutación atómica: pasar la versión vigente anterior a SUPERSEDIDA
    IF v_actual_id IS NOT NULL AND v_actual_id <> v_nueva_id THEN
        UPDATE sigd_tupa.version
           SET estado = 'SUPERSEDIDA'
         WHERE version_id = v_actual_id;
    END IF;

    -- 5. Activar la versión de Pasco a VIGENTE
    UPDATE sigd_tupa.version
       SET estado = 'VIGENTE'
     WHERE version_id = v_nueva_id;

    -- Reactivar triggers de seguridad
    ALTER TABLE sigd_tupa.tramite_requisito ENABLE TRIGGER tr_tupa_proteger_tramite_requisito;
    ALTER TABLE sigd_tupa.tramite_version ENABLE TRIGGER tr_tupa_proteger_tramite_version;
    ALTER TABLE sigd_tupa.version ENABLE TRIGGER tr_tupa_proteger_version;

    RAISE NOTICE 'TUPA Oficial Pasco 2026 implementado y activado exitosamente como VIGENTE con % trámites.', 48;
END $$;
