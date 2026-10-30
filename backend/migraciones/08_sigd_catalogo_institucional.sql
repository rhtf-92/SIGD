-- Catalogo institucional editable. El runner controla la transaccion.
CREATE SCHEMA IF NOT EXISTS sigd_doc;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='sigd_doc' AND t.typname='catalogo_tipo') THEN
    CREATE TYPE sigd_doc.catalogo_tipo AS ENUM ('PROCEDIMIENTO_ADMINISTRATIVO','BIEN_SERVICIO_PRODUCTIVO');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='sigd_doc' AND t.typname='catalogo_operacion_auditoria') THEN
    CREATE TYPE sigd_doc.catalogo_operacion_auditoria AS ENUM ('CREAR_CATALOGO','EDITAR_CATALOGO','CREAR_VERSION','ACTIVAR','DESACTIVAR','PUBLICAR_VERSION','RETIRAR_PUBLICACION');
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS sigd_doc.catalogo_institucional (
  catalogo_id UUID PRIMARY KEY DEFAULT gen_random_uuid(), codigo VARCHAR(40) NOT NULL UNIQUE CHECK (btrim(codigo)<>''),
  nombre VARCHAR(300) NOT NULL CHECK (btrim(nombre)<>''), tipo_catalogo sigd_doc.catalogo_tipo NOT NULL,
  rubro TEXT, sub_rubro TEXT, dependencia TEXT, autoridad TEXT, vigente BOOLEAN NOT NULL DEFAULT FALSE,
  version_publicada_id UUID, creado_en TIMESTAMPTZ NOT NULL DEFAULT now(), actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sigd_doc.catalogo_institucional_version (
  version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(), catalogo_id UUID NOT NULL REFERENCES sigd_doc.catalogo_institucional(catalogo_id) ON DELETE RESTRICT,
  numero_version INTEGER NOT NULL CHECK(numero_version>0), requisitos JSONB NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(requisitos)='array'),
  tarifas JSONB NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(tarifas)='array'), monto_texto TEXT, base_legal TEXT, fuente TEXT,
  motivo TEXT NOT NULL CHECK(btrim(motivo)<>''), vigente_desde DATE NOT NULL DEFAULT CURRENT_DATE, vigente_hasta DATE, creado_por UUID,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(catalogo_id,numero_version), CHECK(vigente_hasta IS NULL OR vigente_hasta>=vigente_desde)
);
ALTER TABLE sigd_doc.catalogo_institucional DROP CONSTRAINT IF EXISTS fk_catalogo_version_publicada;
ALTER TABLE sigd_doc.catalogo_institucional ADD CONSTRAINT fk_catalogo_version_publicada FOREIGN KEY(version_publicada_id) REFERENCES sigd_doc.catalogo_institucional_version(version_id) ON DELETE RESTRICT;
CREATE OR REPLACE FUNCTION sigd_doc.fn_catalogo_publicacion() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE propietario UUID; desde DATE; hasta DATE;
BEGIN
  IF NEW.version_publicada_id IS NULL THEN RETURN NEW; END IF;
  SELECT catalogo_id,vigente_desde,vigente_hasta INTO propietario,desde,hasta FROM sigd_doc.catalogo_institucional_version WHERE version_id=NEW.version_publicada_id;
  IF propietario IS DISTINCT FROM NEW.catalogo_id OR NEW.vigente IS NOT TRUE OR desde>CURRENT_DATE OR (hasta IS NOT NULL AND hasta<CURRENT_DATE) THEN RAISE EXCEPTION 'Version no publicable para el catalogo' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION sigd_doc.fn_catalogo_touch() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN NEW.actualizado_en:=now(); RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION sigd_doc.fn_catalogo_version_inmutable() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Las versiones son inmutables' USING ERRCODE='23001'; END $$;
DROP TRIGGER IF EXISTS tr_catalogo_publicacion ON sigd_doc.catalogo_institucional;
CREATE TRIGGER tr_catalogo_publicacion BEFORE INSERT OR UPDATE OF version_publicada_id,vigente ON sigd_doc.catalogo_institucional FOR EACH ROW EXECUTE FUNCTION sigd_doc.fn_catalogo_publicacion();
DROP TRIGGER IF EXISTS tr_catalogo_touch ON sigd_doc.catalogo_institucional;
CREATE TRIGGER tr_catalogo_touch BEFORE UPDATE ON sigd_doc.catalogo_institucional FOR EACH ROW EXECUTE FUNCTION sigd_doc.fn_catalogo_touch();
DROP TRIGGER IF EXISTS tr_catalogo_version_inmutable ON sigd_doc.catalogo_institucional_version;
CREATE TRIGGER tr_catalogo_version_inmutable BEFORE UPDATE OR DELETE ON sigd_doc.catalogo_institucional_version FOR EACH ROW EXECUTE FUNCTION sigd_doc.fn_catalogo_version_inmutable();
CREATE TABLE IF NOT EXISTS sigd_doc.catalogo_institucional_auditoria (
  auditoria_id UUID PRIMARY KEY DEFAULT gen_random_uuid(), catalogo_id UUID REFERENCES sigd_doc.catalogo_institucional(catalogo_id) ON DELETE SET NULL,
  version_id UUID REFERENCES sigd_doc.catalogo_institucional_version(version_id) ON DELETE SET NULL, operacion sigd_doc.catalogo_operacion_auditoria NOT NULL,
  usuario_id UUID, motivo TEXT, datos_antes JSONB, datos_despues JSONB, correlation_id UUID, ip_origen TEXT, user_agent TEXT, creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_catalogo_version_catalogo_numero ON sigd_doc.catalogo_institucional_version(catalogo_id,numero_version DESC);
CREATE INDEX IF NOT EXISTS ix_catalogo_auditoria_catalogo_fecha ON sigd_doc.catalogo_institucional_auditoria(catalogo_id,creado_en DESC);
