-- OrganiCore v2 - Suite automatizada de QA
-- Requiere ejecutar antes 03_esquema_sigd_org_v2.sql.
-- Todos los datos se revierten al finalizar.

\set ON_ERROR_STOP on
BEGIN;

INSERT INTO sigd_org.area (area_id, nombre, sigla)
VALUES
    ('00000000-0000-0000-0000-000000000101', 'Raiz QA', 'QA-RAIZ'),
    ('00000000-0000-0000-0000-000000000102', 'Padre QA', 'QA-PADRE'),
    ('00000000-0000-0000-0000-000000000103', 'Hijo QA', 'QA-HIJO'),
    ('00000000-0000-0000-0000-000000000104', 'Nieto QA', 'QA-NIETO')
ON CONFLICT (area_id) DO NOTHING;

UPDATE sigd_org.area
SET parent_id = '00000000-0000-0000-0000-000000000101'
WHERE area_id = '00000000-0000-0000-0000-000000000102';
UPDATE sigd_org.area
SET parent_id = '00000000-0000-0000-0000-000000000102'
WHERE area_id = '00000000-0000-0000-0000-000000000103';
UPDATE sigd_org.area
SET parent_id = '00000000-0000-0000-0000-000000000103'
WHERE area_id = '00000000-0000-0000-0000-000000000104';

DO $$
DECLARE
    descendant_count INTEGER;
BEGIN
    SELECT count(*) INTO descendant_count
    FROM sigd_org.area
    WHERE path LIKE '/00000000-0000-0000-0000-000000000101/%';
    IF descendant_count <> 4 THEN
        RAISE EXCEPTION 'PATH_FAIL: se esperaban 4 areas bajo la raiz, se obtuvieron %', descendant_count;
    END IF;

    IF (SELECT nivel_organizacional FROM sigd_org.area
        WHERE area_id = '00000000-0000-0000-0000-000000000104') <> 4 THEN
        RAISE EXCEPTION 'PATH_FAIL: nivel del nieto incorrecto';
    END IF;
END;
$$;

-- Crear otra raiz y mover un subarbol completo.
INSERT INTO sigd_org.area (area_id, nombre, sigla)
VALUES ('00000000-0000-0000-0000-000000000105', 'Nueva raiz QA', 'QA-NUEVA');
UPDATE sigd_org.area
SET parent_id = '00000000-0000-0000-0000-000000000105'
WHERE area_id = '00000000-0000-0000-0000-000000000102';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM sigd_org.area
        WHERE area_id = '00000000-0000-0000-0000-000000000104'
          AND path LIKE '/00000000-0000-0000-0000-000000000105/%'
    ) THEN
        RAISE EXCEPTION 'PATH_FAIL: no se propago el movimiento del subarbol';
    END IF;
END;
$$;

-- Ciclo directo.
DO $$
BEGIN
    BEGIN
        UPDATE sigd_org.area
        SET parent_id = area_id
        WHERE area_id = '00000000-0000-0000-0000-000000000101';
        RAISE EXCEPTION 'CYCLE_FAIL: se permitio ciclo directo';
    EXCEPTION WHEN SQLSTATE '23514' THEN
        NULL;
    END;
END;
$$;

-- Ciclo indirecto: la nueva raiz no puede depender de su nieto.
DO $$
BEGIN
    BEGIN
        UPDATE sigd_org.area
        SET parent_id = '00000000-0000-0000-0000-000000000104'
        WHERE area_id = '00000000-0000-0000-0000-000000000105';
        RAISE EXCEPTION 'CYCLE_FAIL: se permitio ciclo indirecto';
    EXCEPTION WHEN SQLSTATE '23514' THEN
        NULL;
    END;
END;
$$;

INSERT INTO sigd_org.cargo (cargo_id, nombre, es_titular_despacho)
VALUES ('00000000-0000-0000-0000-000000000201', 'Cargo QA', TRUE);
INSERT INTO sigd_org.facultad_despacho
    (cargo_id, codigo, puede_firmar, vigente_desde)
VALUES
    ('00000000-0000-0000-0000-000000000201', 'FIRMA_QA', TRUE, DATE '2026-01-01');

INSERT INTO sigd_org.encargatura_despacho
    (cuenta_titular_id, cuenta_suplente_id, area_id, cargo_id,
     tipo_encargatura, documento_sustento, periodo_vigencia)
VALUES
    ('00000000-0000-0000-0000-000000000301',
     '00000000-0000-0000-0000-000000000302',
     '00000000-0000-0000-0000-000000000101',
     '00000000-0000-0000-0000-000000000201',
     'SUPLENTE', 'QA-RES-001',
     tstzrange('2026-09-01 00:00+00', '2026-10-01 00:00+00', '[)'));

DO $$
BEGIN
    BEGIN
        INSERT INTO sigd_org.encargatura_despacho
            (cuenta_titular_id, cuenta_suplente_id, area_id, cargo_id,
             tipo_encargatura, documento_sustento, periodo_vigencia)
        VALUES
            ('00000000-0000-0000-0000-000000000301',
             '00000000-0000-0000-0000-000000000303',
             '00000000-0000-0000-0000-000000000101',
             '00000000-0000-0000-0000-000000000201',
             'DELEGADO', 'QA-RES-002',
             tstzrange('2026-09-15 00:00+00', '2026-10-15 00:00+00', '[)'));
        RAISE EXCEPTION 'RANGE_FAIL: se permitio encargatura solapada';
    EXCEPTION WHEN exclusion_violation THEN
        NULL;
    END;
END;
$$;

DO $$
BEGIN
    IF NOT sigd_org.usuario_tiene_facultad_despacho(
        '00000000-0000-0000-0000-000000000302',
        '00000000-0000-0000-0000-000000000101',
        '00000000-0000-0000-0000-000000000201',
        '2026-09-20 12:00+00'
    ) THEN
        RAISE EXCEPTION 'AUTH_FAIL: se rechazo una facultad vigente';
    END IF;

    IF sigd_org.usuario_tiene_facultad_despacho(
        '00000000-0000-0000-0000-000000000302',
        '00000000-0000-0000-0000-000000000101',
        '00000000-0000-0000-0000-000000000201',
        '2026-10-01 00:00+00'
    ) THEN
        RAISE EXCEPTION 'AUTH_FAIL: se autorizo una facultad vencida';
    END IF;
END;
$$;

SELECT 'OK: OrganiCore v2 supero la suite automatizada' AS resultado;
ROLLBACK;
