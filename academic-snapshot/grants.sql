\set ON_ERROR_STOP on
-- This role exists only inside the independent academic PostgreSQL container.
SELECT format('CREATE ROLE sigd_app LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION', :'app_password') \gexec
REVOKE CONNECT ON DATABASE sigd_prueba FROM PUBLIC;
REVOKE CONNECT ON DATABASE postgres FROM PUBLIC;
REVOKE CONNECT ON DATABASE template1 FROM PUBLIC;
GRANT CONNECT ON DATABASE sigd_prueba TO sigd_app;
GRANT USAGE ON SCHEMA sigd_audit,sigd_auth,sigd_doc,sigd_org,sigd_rut,sigd_tra TO sigd_app;
-- Full application DML is confined to existing objects in this academic database.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA sigd_audit,sigd_auth,sigd_doc,sigd_org,sigd_rut,sigd_tra TO sigd_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA sigd_audit,sigd_auth,sigd_doc,sigd_org,sigd_rut,sigd_tra TO sigd_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA sigd_audit,sigd_auth,sigd_doc,sigd_org,sigd_rut,sigd_tra TO sigd_app;
