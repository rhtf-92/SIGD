#!/bin/sh
set -eu

db='postgres -h postgres -d sigd_prueba'
auth_file=/migrations/15_sigd_auth_refresh_token_text.sql
auth_hash="$(sha256sum "$auth_file" | cut -d ' ' -f 1)"
schema_hash="$(sha256sum /snapshot/schema.sql | cut -d ' ' -f 1)"
data_hash="$(sha256sum /snapshot/data.sql | cut -d ' ' -f 1)"
manifest_auth="$(awk '{sub(/\r$/, "", $2); if ($2 == "../backend/migraciones/15_sigd_auth_refresh_token_text.sql") print $1}' /snapshot/SHA256SUMS)"
manifest_schema="$(awk '{sub(/\r$/, "", $2); if ($2 == "schema.sql") print $1}' /snapshot/SHA256SUMS)"
manifest_data="$(awk '{sub(/\r$/, "", $2); if ($2 == "data.sql") print $1}' /snapshot/SHA256SUMS)"
[ "$auth_hash" = "$manifest_auth" ] && [ "$schema_hash" = "$manifest_schema" ] && [ "$data_hash" = "$manifest_data" ] || {
  echo 'Academic source checksum failed; refusing to restore.' >&2
  exit 1
}

existing="$(psql -X -At $db -c "SELECT to_regclass('public.sigd_migraciones') IS NOT NULL")"
if [ "$existing" = t ]; then
  count="$(psql -X -At $db -c 'SELECT count(*) FROM public.sigd_migraciones')"
  [ "$count" = 15 ] || [ "$count" = 16 ] || { echo 'Existing database has an unexpected migration count; refusing to modify it.' >&2; exit 1; }
  role="$(psql -X -At $db -c "SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='sigd_app')")"
  [ "$role" = t ] || { echo 'Existing database is only partially restored; refusing automatic overwrite.' >&2; exit 1; }
  if [ "$count" = 16 ]; then
    baseline="$(psql -X -At $db -c "SELECT to_regclass('public.sigd_academic_baseline') IS NOT NULL")"
    [ "$baseline" = t ] || { echo 'Academic migration exists without baseline record; refusing to continue.' >&2; exit 1; }
    actual_hashes="$(psql -X -At $db -c "SELECT trim(source_schema_sha256)||'|'||trim(source_data_sha256)||'|'||trim(auth_migration_sha256) FROM public.sigd_academic_baseline WHERE id=1")"
    expected_hashes="$schema_hash|$data_hash|$auth_hash"
    [ "$actual_hashes" = "$expected_hashes" ] || { echo 'Academic baseline checksum differs from files; refusing to continue.' >&2; exit 1; }
    column_type="$(psql -X -At $db -c "SELECT data_type FROM information_schema.columns WHERE table_schema='sigd_auth' AND table_name='sesion_usuario' AND column_name='refresh_token'")"
    [ "$column_type" = text ] || { echo 'Auth column type does not match the recorded migration.' >&2; exit 1; }
  else
    echo 'Legacy 15-migration academic copy detected; no automatic upgrade performed.'
  fi
  echo 'Academic database already initialized; no restore performed.'
  exit 0
fi

psql -X -v ON_ERROR_STOP=1 $db -f /snapshot/schema.sql
psql -X -v ON_ERROR_STOP=1 $db -f /snapshot/data.sql
psql -X -v ON_ERROR_STOP=1 $db -f "$auth_file"
psql -X -v ON_ERROR_STOP=1 -v auth_hash="$auth_hash" -v schema_hash="$schema_hash" -v data_hash="$data_hash" $db -f /snapshot/baseline.sql
psql -X -v ON_ERROR_STOP=1 -v app_password="$APP_DB_PASSWORD" $db -f /snapshot/grants.sql
echo 'Academic snapshot restored.'
