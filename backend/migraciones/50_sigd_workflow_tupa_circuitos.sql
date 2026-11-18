-- ==============================================================================
-- MIGRACIÓN 50: Circuitos Operativos y Configuración de Workflows TUPA (Fase C3.6)
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
-- ==============================================================================
-- Persiste de forma genérica y estructurada los 3 circuitos documentarios canónicos
-- para los 18 procedimientos documentarios de TUPA-2026 (genera_expediente = true):
--
-- Patrón 1: WF_TUPA_DOC_SDA_DIR (15 procedimientos académicos resolutivos DIR)
-- Patrón 2: WF_TUPA_DOC_DIR_DIR (1 procedimiento administrativo resolutivo DIR: p4-fila-02)
-- Patrón 3: WF_TUPA_DOC_SDA_SDA (2 procedimientos académicos resolutivos SDA: p5-fila-06, p5-fila-11)
--
-- Cumple con:
--   - Transaccionalidad atómica (BEGIN ... COMMIT).
--   - Inmutabilidad de versiones y trazabilidad de procedencia.
--   - Mapeo declarativo y genérico sin hardcoding por procedimiento específico.
-- ==============================================================================

BEGIN;

DO $$
DECLARE
    v_total_proc_doc INT;
    v_total_config INT;
BEGIN
    -- 1. VERIFICACIÓN PREVIA (FAIL-CLOSED): Comprobar que existen los 18 procedimientos documentarios
    SELECT count(*) INTO v_total_proc_doc
      FROM sigd_doc.tupa_procedimiento p
      JOIN sigd_doc.tupa_version v ON v.id_version = p.id_version
     WHERE v.codigo = 'TUPA-2026' AND p.genera_expediente = true;

    IF v_total_proc_doc <> 18 THEN
        RAISE EXCEPTION 'MIGRACION_50_ERROR: Se esperaban 18 procedimientos con genera_expediente = true, encontrados: %', v_total_proc_doc;
    END IF;

    -- 2. DEFINICIONES DE WORKFLOW CANÓNICAS
    INSERT INTO sigd_rut.workflow_definicion (
        id_workflow,
        codigo,
        nombre,
        descripcion,
        activo,
        proveniencia,
        fuente_original,
        estado_homologacion
    ) VALUES
    (
        'e0000001-0000-0000-0000-000000000001'::uuid,
        'WF_TUPA_DOC_SDA_DIR',
        'Circuito Documentario Académico Resolutivo Dirección',
        'Flujo operativo estándar para procedimientos académicos: Mesa de Partes (DIR) -> Tesorería (DIR) -> Subdirección Académica (SDA) -> Dirección General (DIR) -> Notificación y Archivo.',
        true,
        'OFICIAL_SUIZA',
        'TUPA_2026_IESTP_SUIZA',
        'HOMOLOGADO'
    ),
    (
        'e0000001-0000-0000-0000-000000000002'::uuid,
        'WF_TUPA_DOC_DIR_DIR',
        'Circuito Documentario Administrativo Resolutivo Dirección',
        'Flujo operativo para procedimientos administrativos: Mesa de Partes (DIR) -> Tesorería (DIR) -> Gestión Administrativa (DIR) -> Dirección General (DIR) -> Notificación y Archivo.',
        true,
        'OFICIAL_SUIZA',
        'TUPA_2026_IESTP_SUIZA',
        'HOMOLOGADO'
    ),
    (
        'e0000001-0000-0000-0000-000000000003'::uuid,
        'WF_TUPA_DOC_SDA_SDA',
        'Circuito Documentario Académico Resolutivo Subdirección',
        'Flujo operativo para procedimientos resolutivos académicos delegados: Mesa de Partes (DIR) -> Tesorería (DIR) -> Subdirección Académica (SDA) -> Notificación y Archivo.',
        true,
        'OFICIAL_SUIZA',
        'TUPA_2026_IESTP_SUIZA',
        'HOMOLOGADO'
    )
    ON CONFLICT (codigo) DO UPDATE SET
        nombre = EXCLUDED.nombre,
        descripcion = EXCLUDED.descripcion,
        activo = true,
        proveniencia = EXCLUDED.proveniencia,
        fuente_original = EXCLUDED.fuente_original,
        estado_homologacion = EXCLUDED.estado_homologacion,
        actualizado_en = now();

    -- 3. VERSIONES DE WORKFLOW CANÓNICAS (VERSION 1.0)
    -- Patrón 1: SDA -> DIR
    INSERT INTO sigd_rut.workflow_version (
        id_version,
        id_workflow,
        version,
        codigo_completo,
        descripcion,
        activo,
        proveniencia,
        fuente_original,
        estado_homologacion,
        pasos
    ) VALUES (
        'f0000001-0000-0000-0000-000000000001'::uuid,
        'e0000001-0000-0000-0000-000000000001'::uuid,
        '1.0',
        'WF_TUPA_DOC_SDA_DIR:V1.0',
        'Versión canónica inicial para procedimientos académicos resolutivos por Dirección General.',
        true,
        'OFICIAL_SUIZA',
        'TUPA_2026_IESTP_SUIZA',
        'HOMOLOGADO',
        jsonb_build_array(
            jsonb_build_object(
                'orden', 1,
                'nombre', 'RECEPCION_DOCUMENTAL_MESA_PARTES',
                'areaId', 'a0000000-0000-0000-0000-000000000002',
                'areaCodigo', 'DIR',
                'perfilRequerido', 'GESTOR_RECEPCION_DOCUMENTAL',
                'accionRequerida', 'REVISION_REQUISITOS',
                'permiteObservacion', true,
                'esResolutivo', false,
                'esFinal', false
            ),
            jsonb_build_object(
                'orden', 2,
                'nombre', 'VALIDACION_PAGO_TESORERIA',
                'areaId', 'a0000000-0000-0000-0000-000000000002',
                'areaCodigo', 'DIR',
                'perfilRequerido', 'GESTOR_TESORERIA',
                'accionRequerida', 'VALIDACION_PAGO',
                'permiteObservacion', false,
                'esResolutivo', false,
                'esFinal', false
            ),
            jsonb_build_object(
                'orden', 3,
                'nombre', 'DERIVACION_DESPACHO',
                'areaId', 'a0000000-0000-0000-0000-000000000002',
                'areaCodigo', 'DIR',
                'perfilRequerido', 'GESTOR_RECEPCION_DOCUMENTAL',
                'accionRequerida', 'DERIVACION_AREA',
                'permiteObservacion', false,
                'esResolutivo', false,
                'esFinal', false
            ),
            jsonb_build_object(
                'orden', 4,
                'nombre', 'ATENCION_ESPECIALISTA_ACADEMICO',
                'areaId', 'a0000000-0000-0000-0000-000000000001',
                'areaCodigo', 'SDA',
                'perfilRequerido', 'GESTOR_AREA_ACADEMICA',
                'accionRequerida', 'ATENCION_TECNICA',
                'permiteObservacion', true,
                'esResolutivo', false,
                'esFinal', false
            ),
            jsonb_build_object(
                'orden', 5,
                'nombre', 'APROBACION_Y_FIRMA_DIRECCION',
                'areaId', 'a0000000-0000-0000-0000-000000000002',
                'areaCodigo', 'DIR',
                'perfilRequerido', 'APROBADOR_DIRECCION',
                'accionRequerida', 'FIRMA',
                'permiteObservacion', false,
                'esResolutivo', true,
                'esFinal', false
            ),
            jsonb_build_object(
                'orden', 6,
                'nombre', 'NOTIFICACION_Y_ARCHIVO',
                'areaId', 'a0000000-0000-0000-0000-000000000002',
                'areaCodigo', 'DIR',
                'perfilRequerido', 'GESTOR_ADMINISTRATIVO',
                'accionRequerida', 'ARCHIVO',
                'permiteObservacion', false,
                'esResolutivo', false,
                'esFinal', true
            )
        )
    )
    ON CONFLICT (codigo_completo) DO UPDATE SET
        pasos = EXCLUDED.pasos,
        activo = true,
        actualizado_en = now();

    -- Patrón 2: DIR -> DIR
    INSERT INTO sigd_rut.workflow_version (
        id_version,
        id_workflow,
        version,
        codigo_completo,
        descripcion,
        activo,
        proveniencia,
        fuente_original,
        estado_homologacion,
        pasos
    ) VALUES (
        'f0000001-0000-0000-0000-000000000002'::uuid,
        'e0000001-0000-0000-0000-000000000002'::uuid,
        '1.0',
        'WF_TUPA_DOC_DIR_DIR:V1.0',
        'Versión canónica inicial para procedimientos administrativos resolutivos por Dirección General.',
        true,
        'OFICIAL_SUIZA',
        'TUPA_2026_IESTP_SUIZA',
        'HOMOLOGADO',
        jsonb_build_array(
            jsonb_build_object(
                'orden', 1,
                'nombre', 'RECEPCION_DOCUMENTAL_MESA_PARTES',
                'areaId', 'a0000000-0000-0000-0000-000000000002',
                'areaCodigo', 'DIR',
                'perfilRequerido', 'GESTOR_RECEPCION_DOCUMENTAL',
                'accionRequerida', 'REVISION_REQUISITOS',
                'permiteObservacion', true,
                'esResolutivo', false,
                'esFinal', false
            ),
            jsonb_build_object(
                'orden', 2,
                'nombre', 'VALIDACION_PAGO_TESORERIA',
                'areaId', 'a0000000-0000-0000-0000-000000000002',
                'areaCodigo', 'DIR',
                'perfilRequerido', 'GESTOR_TESORERIA',
                'accionRequerida', 'VALIDACION_PAGO',
                'permiteObservacion', false,
                'esResolutivo', false,
                'esFinal', false
            ),
            jsonb_build_object(
                'orden', 3,
                'nombre', 'DERIVACION_DESPACHO',
                'areaId', 'a0000000-0000-0000-0000-000000000002',
                'areaCodigo', 'DIR',
                'perfilRequerido', 'GESTOR_RECEPCION_DOCUMENTAL',
                'accionRequerida', 'DERIVACION_AREA',
                'permiteObservacion', false,
                'esResolutivo', false,
                'esFinal', false
            ),
            jsonb_build_object(
                'orden', 4,
                'nombre', 'ATENCION_GESTOR_ADMINISTRATIVO',
                'areaId', 'a0000000-0000-0000-0000-000000000002',
                'areaCodigo', 'DIR',
                'perfilRequerido', 'GESTOR_ADMINISTRATIVO',
                'accionRequerida', 'ATENCION_TECNICA',
                'permiteObservacion', true,
                'esResolutivo', false,
                'esFinal', false
            ),
            jsonb_build_object(
                'orden', 5,
                'nombre', 'APROBACION_Y_FIRMA_DIRECCION',
                'areaId', 'a0000000-0000-0000-0000-000000000002',
                'areaCodigo', 'DIR',
                'perfilRequerido', 'APROBADOR_DIRECCION',
                'accionRequerida', 'FIRMA',
                'permiteObservacion', false,
                'esResolutivo', true,
                'esFinal', false
            ),
            jsonb_build_object(
                'orden', 6,
                'nombre', 'NOTIFICACION_Y_ARCHIVO',
                'areaId', 'a0000000-0000-0000-0000-000000000002',
                'areaCodigo', 'DIR',
                'perfilRequerido', 'GESTOR_ADMINISTRATIVO',
                'accionRequerida', 'ARCHIVO',
                'permiteObservacion', false,
                'esResolutivo', false,
                'esFinal', true
            )
        )
    )
    ON CONFLICT (codigo_completo) DO UPDATE SET
        pasos = EXCLUDED.pasos,
        activo = true,
        actualizado_en = now();

    -- Patrón 3: SDA -> SDA
    INSERT INTO sigd_rut.workflow_version (
        id_version,
        id_workflow,
        version,
        codigo_completo,
        descripcion,
        activo,
        proveniencia,
        fuente_original,
        estado_homologacion,
        pasos
    ) VALUES (
        'f0000001-0000-0000-0000-000000000003'::uuid,
        'e0000001-0000-0000-0000-000000000003'::uuid,
        '1.0',
        'WF_TUPA_DOC_SDA_SDA:V1.0',
        'Versión canónica inicial para procedimientos académicos resolutivos por Subdirección Académica.',
        true,
        'OFICIAL_SUIZA',
        'TUPA_2026_IESTP_SUIZA',
        'HOMOLOGADO',
        jsonb_build_array(
            jsonb_build_object(
                'orden', 1,
                'nombre', 'RECEPCION_DOCUMENTAL_MESA_PARTES',
                'areaId', 'a0000000-0000-0000-0000-000000000002',
                'areaCodigo', 'DIR',
                'perfilRequerido', 'GESTOR_RECEPCION_DOCUMENTAL',
                'accionRequerida', 'REVISION_REQUISITOS',
                'permiteObservacion', true,
                'esResolutivo', false,
                'esFinal', false
            ),
            jsonb_build_object(
                'orden', 2,
                'nombre', 'VALIDACION_PAGO_TESORERIA',
                'areaId', 'a0000000-0000-0000-0000-000000000002',
                'areaCodigo', 'DIR',
                'perfilRequerido', 'GESTOR_TESORERIA',
                'accionRequerida', 'VALIDACION_PAGO',
                'permiteObservacion', false,
                'esResolutivo', false,
                'esFinal', false
            ),
            jsonb_build_object(
                'orden', 3,
                'nombre', 'DERIVACION_DESPACHO',
                'areaId', 'a0000000-0000-0000-0000-000000000002',
                'areaCodigo', 'DIR',
                'perfilRequerido', 'GESTOR_RECEPCION_DOCUMENTAL',
                'accionRequerida', 'DERIVACION_AREA',
                'permiteObservacion', false,
                'esResolutivo', false,
                'esFinal', false
            ),
            jsonb_build_object(
                'orden', 4,
                'nombre', 'ATENCION_ESPECIALISTA_ACADEMICO',
                'areaId', 'a0000000-0000-0000-0000-000000000001',
                'areaCodigo', 'SDA',
                'perfilRequerido', 'GESTOR_AREA_ACADEMICA',
                'accionRequerida', 'ATENCION_TECNICA',
                'permiteObservacion', true,
                'esResolutivo', false,
                'esFinal', false
            ),
            jsonb_build_object(
                'orden', 5,
                'nombre', 'APROBACION_Y_FIRMA_SUBDIRECCION',
                'areaId', 'a0000000-0000-0000-0000-000000000001',
                'areaCodigo', 'SDA',
                'perfilRequerido', 'GESTOR_AREA_ACADEMICA',
                'accionRequerida', 'FIRMA',
                'permiteObservacion', false,
                'esResolutivo', true,
                'esFinal', false
            ),
            jsonb_build_object(
                'orden', 6,
                'nombre', 'NOTIFICACION_Y_ARCHIVO',
                'areaId', 'a0000000-0000-0000-0000-000000000002',
                'areaCodigo', 'DIR',
                'perfilRequerido', 'GESTOR_ADMINISTRATIVO',
                'accionRequerida', 'ARCHIVO',
                'permiteObservacion', false,
                'esResolutivo', false,
                'esFinal', true
            )
        )
    )
    ON CONFLICT (codigo_completo) DO UPDATE SET
        pasos = EXCLUDED.pasos,
        activo = true,
        actualizado_en = now();

    -- 4. MAPEO DECLARATIVO DE PROCEDIMIENTOS A VERSIONES DE WORKFLOW
    -- Patrón 1: SDA -> DIR (15 procedimientos)
    INSERT INTO sigd_rut.workflow_procedimiento_config (
        id_procedimiento,
        id_version_workflow,
        activo
    )
    SELECT
        p.id_procedimiento,
        'f0000001-0000-0000-0000-000000000001'::uuid,
        true
    FROM sigd_doc.tupa_procedimiento p
    JOIN sigd_org.area resp ON resp.area_id = p.unidad_responsable_id
    JOIN sigd_org.area resol ON resol.area_id = p.unidad_resolutiva_id
    WHERE p.genera_expediente = true
      AND resp.codigo = 'SDA'
      AND resol.codigo = 'DIR'
    ON CONFLICT (id_procedimiento, id_version_workflow) DO UPDATE SET activo = true, actualizado_en = now();

    -- Patrón 2: DIR -> DIR (1 procedimiento: p4-fila-02)
    INSERT INTO sigd_rut.workflow_procedimiento_config (
        id_procedimiento,
        id_version_workflow,
        activo
    )
    SELECT
        p.id_procedimiento,
        'f0000001-0000-0000-0000-000000000002'::uuid,
        true
    FROM sigd_doc.tupa_procedimiento p
    JOIN sigd_org.area resp ON resp.area_id = p.unidad_responsable_id
    JOIN sigd_org.area resol ON resol.area_id = p.unidad_resolutiva_id
    WHERE p.genera_expediente = true
      AND resp.codigo = 'DIR'
      AND resol.codigo = 'DIR'
    ON CONFLICT (id_procedimiento, id_version_workflow) DO UPDATE SET activo = true, actualizado_en = now();

    -- Patrón 3: SDA -> SDA (2 procedimientos: p5-fila-06, p5-fila-11)
    INSERT INTO sigd_rut.workflow_procedimiento_config (
        id_procedimiento,
        id_version_workflow,
        activo
    )
    SELECT
        p.id_procedimiento,
        'f0000001-0000-0000-0000-000000000003'::uuid,
        true
    FROM sigd_doc.tupa_procedimiento p
    JOIN sigd_org.area resp ON resp.area_id = p.unidad_responsable_id
    JOIN sigd_org.area resol ON resol.area_id = p.unidad_resolutiva_id
    WHERE p.genera_expediente = true
      AND resp.codigo = 'SDA'
      AND resol.codigo = 'SDA'
    ON CONFLICT (id_procedimiento, id_version_workflow) DO UPDATE SET activo = true, actualizado_en = now();

    -- 5. VERIFICACIÓN POST-EJECUCIÓN (FAIL-CLOSED)
    SELECT count(*) INTO v_total_config
      FROM sigd_rut.workflow_procedimiento_config c
      JOIN sigd_doc.tupa_procedimiento p ON p.id_procedimiento = c.id_procedimiento
     WHERE p.genera_expediente = true
       AND c.activo = true;

    IF v_total_config <> 18 THEN
        RAISE EXCEPTION 'MIGRACION_50_ERROR: Se esperaban 18 procedimientos documentarios mapeados, encontrados: %', v_total_config;
    END IF;

    RAISE NOTICE 'MIGRACION_50_OK: 18 procedimientos documentarios TUPA mapeados exitosamente a sus circuitos de workflow.';
END $$;

COMMIT;
