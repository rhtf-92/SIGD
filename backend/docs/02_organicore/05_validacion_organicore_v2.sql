-- OrganiCore v2 - Suite de validación reproducible H4
-- Ejecutar sobre una base vacía después de 03_esquema_sigd_org_v2.sql
\set ON_ERROR_STOP on
BEGIN;

CREATE TEMP TABLE log_pruebas (
    id_prueba VARCHAR(10) PRIMARY KEY,
    resultado TEXT NOT NULL,
    descripcion TEXT NOT NULL
);

DO $$
DECLARE
    required_table TEXT;
BEGIN
    FOREACH required_table IN ARRAY ARRAY[
        'area', 'cargo', 'rol_sistema', 'permiso_sistema',
        'rol_permiso', 'usuario_rol', 'asignacion_personal',
        'facultad_despacho', 'encargatura_despacho'
    ] LOOP
        IF to_regclass('sigd_org.' || required_table) IS NULL THEN
            RAISE EXCEPTION 'Falta la tabla sigd_org.%', required_table;
        END IF;
    END LOOP;

    IF to_regclass('sigd_org.responsables') IS NOT NULL THEN
        RAISE EXCEPTION 'La tabla antigua responsables no debe existir';
    END IF;
END;
$$;

DO $$
DECLARE
    v_tabla TEXT;
    v_has_active BOOLEAN;
BEGIN
    FOREACH v_tabla IN ARRAY ARRAY['area', 'cargo', 'rol_sistema', 'permiso_sistema'] LOOP
        SELECT EXISTS (
            SELECT 1
              FROM information_schema.columns c
             WHERE c.table_schema = 'sigd_org'
               AND c.table_name = v_tabla
               AND c.column_name = 'activo'
               AND c.data_type = 'boolean'
        ) INTO v_has_active;

        IF NOT v_has_active THEN
            RAISE EXCEPTION 'sigd_org.% no tiene columna activo BOOLEAN', v_tabla;
        END IF;
    END LOOP;
END;
$$;

DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
      FROM information_schema.columns
     WHERE table_schema = 'sigd_org'
       AND table_name = 'asignacion_personal'
       AND column_name = 'vigencia'
       AND udt_name = 'tstzrange';

    IF v_count <> 1 THEN
        RAISE EXCEPTION 'asignacion_personal.vigencia debe ser TSTZRANGE';
    END IF;

    SELECT COUNT(*) INTO v_count
      FROM information_schema.columns
     WHERE table_schema = 'sigd_org'
       AND table_name = 'encargatura_despacho'
       AND column_name = 'periodo_vigencia'
       AND udt_name = 'tstzrange';

    IF v_count <> 1 THEN
        RAISE EXCEPTION 'encargatura_despacho.periodo_vigencia debe ser TSTZRANGE';
    END IF;
END;
$$;

INSERT INTO sigd_org.area (id_area, nombre, sigla)
VALUES
    ('00000000-0000-0000-0000-000000000101', 'Raíz QA A', 'QA-RAIZ-A'),
    ('00000000-0000-0000-0000-000000000105', 'Raíz QA B', 'QA-RAIZ-B');

INSERT INTO sigd_org.area (id_area, nombre, sigla, parent_id)
VALUES
    ('00000000-0000-0000-0000-000000000102', 'Padre QA', 'QA-PADRE', '00000000-0000-0000-0000-000000000101'),
    ('00000000-0000-0000-0000-000000000103', 'Hijo QA', 'QA-HIJO', '00000000-0000-0000-0000-000000000102'),
    ('00000000-0000-0000-0000-000000000104', 'Nieto QA', 'QA-NIETO', '00000000-0000-0000-0000-000000000103');

DO $$
DECLARE
    v_count INTEGER;
    v_levels INTEGER[];
BEGIN
    SELECT COUNT(*) INTO v_count
      FROM sigd_org.area
     WHERE path @> '00000000_0000_0000_0000_000000000101'::ltree;

    SELECT array_agg(nivel_organizacional ORDER BY path) INTO v_levels
      FROM sigd_org.area
     WHERE id_area IN (
         '00000000-0000-0000-0000-000000000101',
         '00000000-0000-0000-0000-000000000102',
         '00000000-0000-0000-0000-000000000103',
         '00000000-0000-0000-0000-000000000104'
     );

    IF v_count = 4 AND v_levels = ARRAY[1,2,3,4] THEN
        INSERT INTO log_pruebas VALUES ('QA-001', 'OK', 'Path materializado y niveles correctos');
    ELSE
        INSERT INTO log_pruebas VALUES ('QA-001', 'FAIL', 'Se esperaba 4 nodos y niveles [1,2,3,4]');
    END IF;
END;
$$;

DO $$
BEGIN
    BEGIN
        UPDATE sigd_org.area
           SET parent_id = id_area
         WHERE id_area = '00000000-0000-0000-0000-000000000101';
        INSERT INTO log_pruebas VALUES ('QA-002', 'FAIL', 'Se aceptó un ciclo directo');
    EXCEPTION
        WHEN SQLSTATE '23514' THEN
            INSERT INTO log_pruebas VALUES ('QA-002', 'OK', 'Ciclo directo rechazado');
        WHEN OTHERS THEN
            INSERT INTO log_pruebas VALUES ('QA-002', 'FAIL', 'SQLSTATE inesperado: ' || SQLSTATE);
    END;
END;
$$;

UPDATE sigd_org.area
   SET parent_id = '00000000-0000-0000-0000-000000000105'
 WHERE id_area = '00000000-0000-0000-0000-000000000102';

DO $$
DECLARE
    v_p102 TEXT;
    v_p103 TEXT;
    v_p104 TEXT;
    v_l102 INTEGER;
    v_l103 INTEGER;
    v_l104 INTEGER;
    v_sub_a INTEGER;
    v_sub_b INTEGER;
BEGIN
    SELECT path::text, nivel_organizacional INTO v_p102, v_l102
      FROM sigd_org.area WHERE id_area = '00000000-0000-0000-0000-000000000102';
    SELECT path::text, nivel_organizacional INTO v_p103, v_l103
      FROM sigd_org.area WHERE id_area = '00000000-0000-0000-0000-000000000103';
    SELECT path::text, nivel_organizacional INTO v_p104, v_l104
      FROM sigd_org.area WHERE id_area = '00000000-0000-0000-0000-000000000104';

    SELECT COUNT(*) INTO v_sub_a
      FROM sigd_org.area
     WHERE path <@ '00000000_0000_0000_0000_000000000101'::ltree;

    SELECT COUNT(*) INTO v_sub_b
      FROM sigd_org.area
     WHERE path <@ '00000000_0000_0000_0000_000000000105'::ltree;

    IF v_p102 = '00000000_0000_0000_0000_000000000105.00000000_0000_0000_0000_000000000102'
       AND v_p103 = '00000000_0000_0000_0000_000000000105.00000000_0000_0000_0000_000000000102.00000000_0000_0000_0000_000000000103'
       AND v_p104 = '00000000_0000_0000_0000_000000000105.00000000_0000_0000_0000_000000000102.00000000_0000_0000_0000_000000000103.00000000_0000_0000_0000_000000000104'
       AND v_l102 = 2 AND v_l103 = 3 AND v_l104 = 4
       AND v_sub_a = 1 AND v_sub_b = 4 THEN
        INSERT INTO log_pruebas VALUES ('QA-003', 'OK', 'Subárbol reubicado y niveles recalculados');
    ELSE
        INSERT INTO log_pruebas VALUES ('QA-003', 'FAIL', 'Estructura inválida tras movimiento del subárbol');
    END IF;
END;
$$;

DO $$
BEGIN
    BEGIN
        UPDATE sigd_org.area
           SET parent_id = '00000000-0000-0000-0000-000000000104'
         WHERE id_area = '00000000-0000-0000-0000-000000000105';
        INSERT INTO log_pruebas VALUES ('QA-004', 'FAIL', 'Se aceptó un ciclo indirecto');
    EXCEPTION
        WHEN SQLSTATE '23514' THEN
            INSERT INTO log_pruebas VALUES ('QA-004', 'OK', 'Ciclo indirecto rechazado');
        WHEN OTHERS THEN
            INSERT INTO log_pruebas VALUES ('QA-004', 'FAIL', 'SQLSTATE inesperado: ' || SQLSTATE);
    END;
END;
$$;

DO $$
BEGIN
    BEGIN
        UPDATE sigd_org.area
           SET parent_id = '00000000-0000-0000-0000-000000000104'
         WHERE id_area = '00000000-0000-0000-0000-000000000102';
        INSERT INTO log_pruebas VALUES ('QA-005', 'FAIL', 'Se aceptó un ciclo indirecto en nodo intermedio');
    EXCEPTION
        WHEN SQLSTATE '23514' THEN
            INSERT INTO log_pruebas VALUES ('QA-005', 'OK', 'Ciclo indirecto en intermedio rechazado');
        WHEN OTHERS THEN
            INSERT INTO log_pruebas VALUES ('QA-005', 'FAIL', 'SQLSTATE inesperado: ' || SQLSTATE);
    END;
END;
$$;

UPDATE sigd_org.area
   SET parent_id = '00000000-0000-0000-0000-000000000101'
 WHERE id_area = '00000000-0000-0000-0000-000000000102';

DO $$
DECLARE
    v_desc INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_desc
      FROM sigd_org.area
     WHERE path <@ '00000000_0000_0000_0000_000000000102'::ltree
       AND id_area <> '00000000-0000-0000-0000-000000000102';

    IF v_desc = 2 THEN
        INSERT INTO log_pruebas VALUES ('QA-006', 'OK', 'Consulta de descendientes por ltree correcta');
    ELSE
        INSERT INTO log_pruebas VALUES ('QA-006', 'FAIL', 'Descendientes no coinciden con la consulta ltree');
    END IF;
END;
$$;

INSERT INTO sigd_org.cargo (cargo_id, nombre)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'Director General'),
    ('22222222-2222-2222-2222-222222222222', 'Jefe de Oficina');

INSERT INTO sigd_org.facultad_despacho (facultad_id, codigo, nombre, cargo_id, puede_firmar, vigente_desde, vigente_hasta)
VALUES
    ('33333333-3333-3333-3333-333333333333', 'FIRMA_FUTURA', 'Firma futura', '11111111-1111-1111-1111-111111111111', TRUE, '2026-09-05', '2026-09-20'),
    ('44444444-4444-4444-4444-444444444444', 'FIRMA_VENCIDA', 'Firma vencida', '22222222-2222-2222-2222-222222222222', TRUE, '2026-09-01', '2026-09-15');

INSERT INTO sigd_org.encargatura_despacho (
    encargatura_id, id_area, cargo_id, facultad_despacho_id,
    usuario_titular_id, usuario_suplente_id, tipo_delegacion,
    resolucion_ref, periodo_vigencia, activo)
VALUES (
    '55555555-5555-5555-5555-555555555555',
    '00000000-0000-0000-0000-000000000101',
    '11111111-1111-1111-1111-111111111111',
    '33333333-3333-3333-3333-333333333333',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'SUPLENCIA',
    'R-001',
    tstzrange('2026-09-01 00:00:00+00'::timestamptz, '2026-09-30 00:00:00+00'::timestamptz, '[)'),
    TRUE
);

DO $$
BEGIN
    IF sigd_org.usuario_tiene_facultad_despacho(
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        '00000000-0000-0000-0000-000000000101',
        '11111111-1111-1111-1111-111111111111',
        '2026-09-10 00:00:00+00'::timestamptz
    ) THEN
        INSERT INTO log_pruebas VALUES ('QA-007', 'OK', 'ABAC autoriza con p_momento histórico válido');
    ELSE
        INSERT INTO log_pruebas VALUES ('QA-007', 'FAIL', 'ABAC debería autorizar con p_momento válido');
    END IF;
END;
$$;

DO $$
BEGIN
    IF sigd_org.usuario_tiene_facultad_despacho(
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        '00000000-0000-0000-0000-000000000101',
        '11111111-1111-1111-1111-111111111111',
        '2026-09-04 00:00:00+00'::timestamptz
    ) THEN
        INSERT INTO log_pruebas VALUES ('QA-008', 'FAIL', 'ABAC no debería autorizar antes del inicio de vigencia');
    ELSE
        INSERT INTO log_pruebas VALUES ('QA-008', 'OK', 'ABAC rechaza antes del inicio usando p_momento');
    END IF;
END;
$$;

DO $$
BEGIN
    IF sigd_org.usuario_tiene_facultad_despacho(
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        '00000000-0000-0000-0000-000000000101',
        '22222222-2222-2222-2222-222222222222',
        '2026-09-20 00:00:00+00'::timestamptz
    ) THEN
        INSERT INTO log_pruebas VALUES ('QA-009', 'FAIL', 'ABAC no debería autorizar facultad vencida');
    ELSE
        INSERT INTO log_pruebas VALUES ('QA-009', 'OK', 'ABAC rechaza facultad vencida con p_momento');
    END IF;
END;
$$;

DO $$
DECLARE
    v_failures INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_failures
      FROM log_pruebas
     WHERE resultado <> 'OK';

    IF v_failures = 0 THEN
        RAISE NOTICE 'SUITE_ORGANICORE_V2_OK';
    ELSE
        RAISE EXCEPTION 'Suite H4 falló con % pruebas no OK', v_failures;
    END IF;
END;
$$;

SELECT *
  FROM log_pruebas
 ORDER BY id_prueba;

COMMIT;
