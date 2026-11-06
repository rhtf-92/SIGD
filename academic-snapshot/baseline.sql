\set ON_ERROR_STOP on
-- The legacy 15-row registry is preserved verbatim. These rows are not rewritten.
-- The new auth migration is registered only after its SQL actually runs.
INSERT INTO public.sigd_migraciones (nombre_script, checksum_sha256)
VALUES ('15_sigd_auth_refresh_token_text.sql', :'auth_hash');

CREATE TABLE public.sigd_academic_baseline (
  id smallint PRIMARY KEY CHECK (id = 1),
  source_schema_sha256 char(64) NOT NULL,
  source_data_sha256 char(64) NOT NULL,
  auth_migration_sha256 char(64) NOT NULL,
  legacy_migration_count smallint NOT NULL CHECK (legacy_migration_count = 15),
  legacy_source_status text NOT NULL CHECK (legacy_source_status = 'UNVERIFIED_08_09_12'),
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.sigd_academic_baseline
  (id, source_schema_sha256, source_data_sha256, auth_migration_sha256,
   legacy_migration_count, legacy_source_status)
VALUES (1, :'schema_hash', :'data_hash', :'auth_hash', 15, 'UNVERIFIED_08_09_12');
