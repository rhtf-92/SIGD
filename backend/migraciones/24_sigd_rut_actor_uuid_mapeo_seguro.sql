-- Migración correctiva segura para convertir actor_id BIGINT a IdentiCore UUID.
-- No modifica 09_sigd_rut_actor_uuid.sql ni elimina/reemplaza la columna histórica actor_id.
-- Conserva la identidad de la columna (attnum), datos existentes mediante mapeo explícito,
-- restricciones (NOT NULL, PK, UNIQUE, CHECK, FK), índices, privilegios, comentarios,
-- triggers y vistas dependientes.
DO $$
DECLARE
  v_rel regclass;
  v_attnum smallint;
  v_type text;
  v_default text;
  v_rows bigint;
  v_rows_after bigint;
  v_unmapped bigint;
  v_incompat_fk text;
  r_view record;
  r_grant record;
BEGIN
  v_rel := to_regclass('sigd_rut.solicitud_compensacion_folios');
  IF v_rel IS NULL THEN
    RETURN;
  END IF;

  SELECT a.attnum
    INTO v_attnum
    FROM pg_catalog.pg_attribute a
   WHERE a.attrelid = v_rel
     AND a.attname = 'actor_id'
     AND NOT a.attisdropped;

  SELECT c.data_type, c.column_default
    INTO v_type, v_default
    FROM information_schema.columns c
   WHERE c.table_schema = 'sigd_rut'
     AND c.table_name = 'solicitud_compensacion_folios'
     AND c.column_name = 'actor_id';

  IF v_attnum IS NULL OR v_type IS NULL OR v_type = 'uuid' THEN
    RETURN;
  END IF;

  IF v_type NOT IN ('bigint', 'integer', 'smallint') THEN
    RAISE EXCEPTION
      'actor_id tiene tipo %, se requiere BIGINT para aplicar el mapeo explícito a IdentiCore UUID',
      v_type;
  END IF;

  SELECT c.conname
    INTO v_incompat_fk
    FROM pg_catalog.pg_constraint c
   WHERE c.contype = 'f'
     AND (
       (c.conrelid = v_rel AND v_attnum = ANY(c.conkey))
       OR (c.confrelid = v_rel AND v_attnum = ANY(c.confkey))
     )
   LIMIT 1;

  IF v_incompat_fk IS NOT NULL THEN
    RAISE EXCEPTION
      'No se puede convertir actor_id mientras exista la restricción foránea % asociada a actor_id numérico',
      v_incompat_fk;
  END IF;

  EXECUTE 'CREATE TABLE IF NOT EXISTS sigd_rut.actor_id_uuid_mapeo (
    actor_id_numerico BIGINT PRIMARY KEY,
    actor_uuid UUID NOT NULL UNIQUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
  )';

  EXECUTE 'SELECT COUNT(*) FROM sigd_rut.solicitud_compensacion_folios' INTO v_rows;

  IF v_rows > 0 THEN
    EXECUTE 'SELECT COUNT(*)
               FROM sigd_rut.solicitud_compensacion_folios s
               LEFT JOIN sigd_rut.actor_id_uuid_mapeo m
                 ON m.actor_id_numerico = s.actor_id::bigint
              WHERE s.actor_id IS NOT NULL
                AND m.actor_uuid IS NULL' INTO v_unmapped;

    IF v_unmapped > 0 THEN
      RAISE EXCEPTION
        'CORRECCIÓN REQUERIDA: % fila(s) no tienen correspondencia en sigd_rut.actor_id_uuid_mapeo (actor_id_numerico -> actor_uuid)',
        v_unmapped;
    END IF;
  END IF;

  DROP TABLE IF EXISTS pg_temp._sigd_rut_tmp_dep_view_grants;
  DROP TABLE IF EXISTS pg_temp._sigd_rut_tmp_dep_views;

  CREATE TEMP TABLE _sigd_rut_tmp_dep_views (
    depth integer NOT NULL,
    view_oid oid PRIMARY KEY,
    schema_name text NOT NULL,
    view_name text NOT NULL,
    owner_name text NOT NULL,
    view_def text NOT NULL,
    view_comment text
  ) ON COMMIT DROP;

  CREATE TEMP TABLE _sigd_rut_tmp_dep_view_grants (
    view_oid oid NOT NULL,
    grantee_sql text NOT NULL,
    privilege_type text NOT NULL,
    is_grantable boolean NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO _sigd_rut_tmp_dep_views (depth, view_oid, schema_name, view_name, owner_name, view_def, view_comment)
  WITH RECURSIVE dep_views(depth, view_oid, path) AS (
    SELECT DISTINCT
      1 AS depth,
      rw.ev_class AS view_oid,
      ARRAY[rw.ev_class] AS path
    FROM pg_catalog.pg_depend d
    JOIN pg_catalog.pg_rewrite rw ON rw.oid = d.objid
    JOIN pg_catalog.pg_class vc ON vc.oid = rw.ev_class
    WHERE d.classid = 'pg_catalog.pg_rewrite'::regclass
      AND d.refclassid = 'pg_catalog.pg_class'::regclass
      AND d.refobjid = v_rel
      AND vc.relkind = 'v'
      AND rw.ev_class <> v_rel
    UNION ALL
    SELECT
      dv.depth + 1,
      rw.ev_class,
      dv.path || rw.ev_class
    FROM dep_views dv
    JOIN pg_catalog.pg_depend d
      ON d.refclassid = 'pg_catalog.pg_class'::regclass
     AND d.refobjid = dv.view_oid
     AND d.classid = 'pg_catalog.pg_rewrite'::regclass
    JOIN pg_catalog.pg_rewrite rw ON rw.oid = d.objid
    JOIN pg_catalog.pg_class vc ON vc.oid = rw.ev_class
    WHERE vc.relkind = 'v'
      AND NOT (rw.ev_class = ANY(dv.path))
  ),
  dedup_views AS (
    SELECT view_oid, MAX(depth) AS depth
    FROM dep_views
    GROUP BY view_oid
  )
  SELECT
    dv.depth,
    c.oid,
    n.nspname,
    c.relname,
    pg_catalog.pg_get_userbyid(c.relowner),
    pg_catalog.pg_get_viewdef(c.oid, true),
    pg_catalog.obj_description(c.oid, 'pg_class')
  FROM dedup_views dv
  JOIN pg_catalog.pg_class c ON c.oid = dv.view_oid
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace;

  INSERT INTO _sigd_rut_tmp_dep_view_grants (view_oid, grantee_sql, privilege_type, is_grantable)
  SELECT
    v.view_oid,
    CASE
      WHEN acl.grantee = 0 THEN 'PUBLIC'
      ELSE format('%I', pg_catalog.pg_get_userbyid(acl.grantee))
    END,
    acl.privilege_type,
    acl.is_grantable
  FROM _sigd_rut_tmp_dep_views v
  JOIN pg_catalog.pg_class c ON c.oid = v.view_oid
  CROSS JOIN LATERAL pg_catalog.aclexplode(c.relacl) acl
  WHERE c.relacl IS NOT NULL;

  FOR r_view IN
    SELECT schema_name, view_name
      FROM _sigd_rut_tmp_dep_views
     ORDER BY depth DESC, view_oid DESC
  LOOP
    EXECUTE format('DROP VIEW %I.%I', r_view.schema_name, r_view.view_name);
  END LOOP;

  IF v_default IS NOT NULL THEN
    EXECUTE 'ALTER TABLE sigd_rut.solicitud_compensacion_folios ALTER COLUMN actor_id DROP DEFAULT';
  END IF;

  -- ALTER COLUMN TYPE conserva la identidad de la columna (attnum), NOT NULL,
  -- privilegios, comentarios y reconstruye índices dependientes sin reemplazarla.
  EXECUTE $create_fn$
    CREATE OR REPLACE FUNCTION sigd_rut._map_actor_id_uuid(p_actor_id BIGINT)
    RETURNS UUID
    LANGUAGE SQL
    STABLE
    STRICT
    AS $fn$
      SELECT actor_uuid
        FROM sigd_rut.actor_id_uuid_mapeo
       WHERE actor_id_numerico = p_actor_id
    $fn$
  $create_fn$;

  EXECUTE 'ALTER TABLE sigd_rut.solicitud_compensacion_folios
             ALTER COLUMN actor_id TYPE UUID
             USING sigd_rut._map_actor_id_uuid(actor_id)';

  EXECUTE 'DROP FUNCTION sigd_rut._map_actor_id_uuid(BIGINT)';

  FOR r_view IN
    SELECT view_oid, schema_name, view_name, owner_name, view_def, view_comment
      FROM _sigd_rut_tmp_dep_views
     ORDER BY depth ASC, view_oid ASC
  LOOP
    EXECUTE format('CREATE VIEW %I.%I AS %s', r_view.schema_name, r_view.view_name, r_view.view_def);
    EXECUTE format('ALTER VIEW %I.%I OWNER TO %I', r_view.schema_name, r_view.view_name, r_view.owner_name);
    IF r_view.view_comment IS NOT NULL THEN
      EXECUTE format('COMMENT ON VIEW %I.%I IS %L', r_view.schema_name, r_view.view_name, r_view.view_comment);
    END IF;
    IF EXISTS (SELECT 1 FROM _sigd_rut_tmp_dep_view_grants WHERE view_oid = r_view.view_oid) THEN
      EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM PUBLIC', r_view.schema_name, r_view.view_name);
      FOR r_grant IN
        SELECT grantee_sql, privilege_type, is_grantable
          FROM _sigd_rut_tmp_dep_view_grants
         WHERE view_oid = r_view.view_oid
      LOOP
        EXECUTE format(
          'GRANT %s ON TABLE %I.%I TO %s%s',
          r_grant.privilege_type,
          r_view.schema_name,
          r_view.view_name,
          r_grant.grantee_sql,
          CASE WHEN r_grant.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END
        );
      END LOOP;
    END IF;
  END LOOP;

  DROP TABLE IF EXISTS pg_temp._sigd_rut_tmp_dep_view_grants;
  DROP TABLE IF EXISTS pg_temp._sigd_rut_tmp_dep_views;

  EXECUTE 'SELECT COUNT(*) FROM sigd_rut.solicitud_compensacion_folios' INTO v_rows_after;
  IF v_rows_after <> v_rows THEN
    RAISE EXCEPTION
      'Integridad fallida: el conteo de filas cambió de % a % durante la conversión de actor_id',
      v_rows,
      v_rows_after;
  END IF;
END $$ LANGUAGE plpgsql;
