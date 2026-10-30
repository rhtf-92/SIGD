-- Seguridad del catalogo. El runner SIGD controla la transaccion.
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='sigd_app') THEN RAISE EXCEPTION 'El rol sigd_app es obligatorio' USING ERRCODE='42704'; END IF; END $$;
CREATE OR REPLACE FUNCTION sigd_doc.fn_catalogo_auditoria_inmutable() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'La auditoria es inmutable' USING ERRCODE='23001'; END $$;
CREATE OR REPLACE FUNCTION sigd_doc.fn_catalogo_no_delete() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'El catalogo no admite borrado fisico' USING ERRCODE='23001'; END $$;
CREATE OR REPLACE FUNCTION sigd_doc.fn_catalogo_codigo_inmutable() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN IF NEW.codigo IS DISTINCT FROM OLD.codigo THEN RAISE EXCEPTION 'El codigo es inmutable' USING ERRCODE='23001'; END IF; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS tr_catalogo_auditoria_inmutable ON sigd_doc.catalogo_institucional_auditoria;
CREATE TRIGGER tr_catalogo_auditoria_inmutable BEFORE UPDATE OR DELETE ON sigd_doc.catalogo_institucional_auditoria FOR EACH ROW EXECUTE FUNCTION sigd_doc.fn_catalogo_auditoria_inmutable();
DROP TRIGGER IF EXISTS tr_catalogo_no_delete ON sigd_doc.catalogo_institucional;
CREATE TRIGGER tr_catalogo_no_delete BEFORE DELETE ON sigd_doc.catalogo_institucional FOR EACH ROW EXECUTE FUNCTION sigd_doc.fn_catalogo_no_delete();
DROP TRIGGER IF EXISTS tr_catalogo_codigo_inmutable ON sigd_doc.catalogo_institucional;
CREATE TRIGGER tr_catalogo_codigo_inmutable BEFORE UPDATE OF codigo ON sigd_doc.catalogo_institucional FOR EACH ROW EXECUTE FUNCTION sigd_doc.fn_catalogo_codigo_inmutable();
REVOKE ALL ON sigd_doc.catalogo_institucional,sigd_doc.catalogo_institucional_version,sigd_doc.catalogo_institucional_auditoria FROM PUBLIC,sigd_app;
GRANT USAGE ON SCHEMA sigd_doc TO sigd_app;
GRANT SELECT,INSERT,UPDATE ON sigd_doc.catalogo_institucional TO sigd_app;
GRANT SELECT,INSERT ON sigd_doc.catalogo_institucional_version,sigd_doc.catalogo_institucional_auditoria TO sigd_app;
