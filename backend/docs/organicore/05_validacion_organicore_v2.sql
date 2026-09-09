-- B_PANAIFO - Validaci├│n ejecutable OrganiCore v2
-- Ejecutar despu├®s de 03_esquema_sigd_org_v2.sql con ON_ERROR_STOP=1

\set ON_ERROR_STOP on

DO $$
DECLARE
    required_table TEXT;
BEGIN
    FOREACH required_table IN ARRAY ARRAY[
        'area', 'cargo', 'rol_sistema', 'permiso_sistema',
        'rol_permiso', 'usuario_rol', 'asignacion_area',
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
    table_name TEXT;
    has_active BOOLEAN;
BEGIN
    FOREACH table_name IN ARRAY ARRAY['area', 'cargo', 'rol_sistema', 'permiso_sistema'] LOOP
        SELECT EXISTS (
            SELECT 1
                        FROM information_schema.columns AS columns_catalog
                        WHERE columns_catalog.table_schema = 'sigd_org'
                            AND columns_catalog.table_name = table_name
                            AND columns_catalog.column_name = 'activo'
                            AND columns_catalog.data_type = 'boolean'
        ) INTO has_active;

        IF NOT has_active THEN
            RAISE EXCEPTION 'sigd_org.% no tiene activo BOOLEAN', table_name;
        END IF;
    END LOOP;
END;
$$;

DO $$
DECLARE
    range_type_count INTEGER;
    exclusion_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO range_type_count
    FROM information_schema.columns
    WHERE table_schema = 'sigd_org'
      AND table_name = 'asignacion_area'
      AND column_name = 'vigencia'
      AND udt_name = 'tstzrange';

    IF range_type_count <> 1 THEN
        RAISE EXCEPTION 'asignacion_area.vigencia debe ser TSTZRANGE';
    END IF;

    SELECT COUNT(*) INTO range_type_count
    FROM information_schema.columns
    WHERE table_schema = 'sigd_org'
      AND table_name = 'encargatura_despacho'
      AND column_name = 'periodo_vigencia'
      AND udt_name = 'tstzrange';

    IF range_type_count <> 1 THEN
        RAISE EXCEPTION 'encargatura_despacho.periodo_vigencia debe ser TSTZRANGE';
    END IF;

    SELECT COUNT(*) INTO exclusion_count
    FROM pg_constraint
    WHERE connamespace = 'sigd_org'::regnamespace
      AND contype = 'x'
      AND conname IN ('excl_asignacion_area_vigencia', 'excl_encargatura_despacho_vigencia');

    IF exclusion_count <> 2 THEN
        RAISE EXCEPTION 'Deben existir las dos restricciones de exclusi├│n GiST';
    END IF;
END;
$$;

SELECT 'OK: esquema sigd_org y entidades v2 validados' AS resultado;
SELECT table_name, column_name, udt_name
FROM information_schema.columns
WHERE table_schema = 'sigd_org'
  AND ((table_name = 'asignacion_area' AND column_name = 'vigencia')
    OR (table_name = 'encargatura_despacho' AND column_name = 'periodo_vigencia'))
ORDER BY table_name;
