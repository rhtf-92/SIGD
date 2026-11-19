-- M10: habilita pagos adicionales solo con autorización temporal confirmada.
-- Aditiva respecto de los datos: no actualiza ni elimina pagos existentes.
DO $$ DECLARE c record; BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid='sigd_tes.pago'::regclass AND contype='u'
      AND pg_get_constraintdef(oid)='UNIQUE (orden_id)'
  LOOP
    EXECUTE format('ALTER TABLE sigd_tes.pago DROP CONSTRAINT %I',c.conname);
  END LOOP;
END $$;
CREATE INDEX IF NOT EXISTS pago_orden_fecha ON sigd_tes.pago(orden_id,creado_en,id);

CREATE TABLE IF NOT EXISTS sigd_tes.autorizacion_pago_adicional (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 orden_id uuid NOT NULL REFERENCES sigd_tes.orden_pago(id) ON DELETE RESTRICT,
 expediente_id uuid NOT NULL REFERENCES sigd_doc.expediente(expediente_id) ON DELETE RESTRICT,
 solicitante_id uuid NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
 importe_autorizado numeric(14,2) NOT NULL CHECK(importe_autorizado>0),
 token_sha256 char(64) NOT NULL UNIQUE CHECK(token_sha256 ~ '^[0-9a-f]{64}$'),
 snapshot_sha256 char(64) NOT NULL CHECK(snapshot_sha256 ~ '^[0-9a-f]{64}$'),
 creada_por uuid NOT NULL,
 expira_en timestamptz NOT NULL,
 confirmada_en timestamptz,
 confirmada_por uuid REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
 consumida_en timestamptz,
 creada_en timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(expira_en>creada_en),
 CHECK((confirmada_en IS NULL AND confirmada_por IS NULL) OR (confirmada_en IS NOT NULL AND confirmada_por IS NOT NULL)),
 CHECK(consumida_en IS NULL OR confirmada_en IS NOT NULL),
 CONSTRAINT autorizacion_pago_adicional_creada_por_fk FOREIGN KEY(creada_por) REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT
);
-- Compatibilidad si una ejecución previa fuera de la transacción hubiera
-- creado la tabla antes de registrar el checksum. Los registros antiguos quedan
-- sin creador y son rechazados por el servicio (fallo cerrado).
ALTER TABLE sigd_tes.autorizacion_pago_adicional ADD COLUMN IF NOT EXISTS creada_por uuid;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='sigd_tes.autorizacion_pago_adicional'::regclass AND conname='autorizacion_pago_adicional_creada_por_fk') THEN
  ALTER TABLE sigd_tes.autorizacion_pago_adicional ADD CONSTRAINT autorizacion_pago_adicional_creada_por_fk
   FOREIGN KEY(creada_por) REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT;
 END IF;
END $$;
CREATE INDEX IF NOT EXISTS autorizacion_pago_orden ON sigd_tes.autorizacion_pago_adicional(orden_id,creada_en DESC);
ALTER TABLE sigd_tes.pago ADD COLUMN IF NOT EXISTS autorizacion_adicional_id uuid;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='sigd_tes.pago'::regclass AND conname='pago_autorizacion_adicional_fk') THEN
  ALTER TABLE sigd_tes.pago ADD CONSTRAINT pago_autorizacion_adicional_fk FOREIGN KEY(autorizacion_adicional_id)
   REFERENCES sigd_tes.autorizacion_pago_adicional(id) ON DELETE RESTRICT;
 END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS pago_autorizacion_adicional_unica ON sigd_tes.pago(autorizacion_adicional_id)
 WHERE autorizacion_adicional_id IS NOT NULL;

ALTER TABLE sigd_tes.documento ADD COLUMN IF NOT EXISTS paginas integer;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='sigd_tes.documento'::regclass AND conname='documento_paginas_rango') THEN
  ALTER TABLE sigd_tes.documento ADD CONSTRAINT documento_paginas_rango CHECK(paginas IS NULL OR paginas BETWEEN 1 AND 5000);
 END IF;
END $$;
CREATE TABLE IF NOT EXISTS sigd_tes.orden_devolucion (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 codigo varchar(50) NOT NULL UNIQUE,
 devolucion_id uuid NOT NULL UNIQUE REFERENCES sigd_tes.devolucion(id) ON DELETE RESTRICT,
 expediente_id uuid NOT NULL REFERENCES sigd_doc.expediente(expediente_id) ON DELETE RESTRICT,
 cut varchar(40) NOT NULL,
 pago_id uuid NOT NULL REFERENCES sigd_tes.pago(id) ON DELETE RESTRICT,
 recibo_documento_id uuid NOT NULL REFERENCES sigd_tes.documento(id) ON DELETE RESTRICT,
 solicitante_id uuid NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
 importe numeric(14,2) NOT NULL CHECK(importe>0),
 aprobada_por uuid NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
 aprobada_en timestamptz NOT NULL DEFAULT clock_timestamp(),
 creada_en timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS sigd_tes.devolucion_documento_folio (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 devolucion_id uuid NOT NULL REFERENCES sigd_tes.devolucion(id) ON DELETE RESTRICT,
 documento_id uuid NOT NULL REFERENCES sigd_tes.documento(id) ON DELETE RESTRICT,
 documento_adjunto_id uuid NOT NULL REFERENCES sigd_doc.documento_adjunto(documento_adjunto_id) ON DELETE RESTRICT,
 expediente_id uuid NOT NULL REFERENCES sigd_doc.expediente(expediente_id) ON DELETE RESTRICT,
 etapa varchar(20) NOT NULL CHECK(etapa IN('SOLICITUD','SUBSANACION')),
 paginas integer NOT NULL CHECK(paginas BETWEEN 1 AND 5000),
 folio_inicio integer NOT NULL CHECK(folio_inicio>0),
 folio_fin integer NOT NULL CHECK(folio_fin>=folio_inicio AND folio_fin-folio_inicio+1=paginas),
 asignado_por uuid NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
 creado_en timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(documento_id)
);
CREATE INDEX IF NOT EXISTS devolucion_documento_expediente ON sigd_tes.devolucion_documento_folio(expediente_id,folio_inicio);
INSERT INTO sigd_doc.tipo_documento(codigo,nombre,extension,mime_type,tamano_maximo_mb,exige_firma,vigente)
VALUES('SUSTENTO_DEVOLUCION','Documento de sustento de solicitud de devolución','pdf','application/pdf',20,false,true)
ON CONFLICT(codigo) DO NOTHING;

INSERT INTO sigd_org.permiso_sistema(codigo,nombre,ambito)
VALUES('TRAMICORE_DEVOLUCION_EVALUAR','Evaluar y resolver solicitudes de devolución en Mesa de Partes','GLOBAL')
ON CONFLICT(codigo) DO NOTHING;
INSERT INTO sigd_org.rol_permiso(rol_id,permiso_id)
SELECT r.rol_id,p.permiso_id FROM sigd_org.rol_sistema r
JOIN sigd_org.permiso_sistema p ON p.codigo='TRAMICORE_DEVOLUCION_EVALUAR'
WHERE r.codigo='MESA_PARTES' ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION sigd_tes.proteger_orden_devolucion() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP IN('UPDATE','DELETE','TRUNCATE') THEN RAISE EXCEPTION 'La orden de devolución es inmutable' USING ERRCODE='23001'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS proteger_orden_devolucion ON sigd_tes.orden_devolucion;
DROP TRIGGER IF EXISTS proteger_orden_devolucion_truncate ON sigd_tes.orden_devolucion;
DROP TRIGGER IF EXISTS proteger_devolucion_documento_folio ON sigd_tes.devolucion_documento_folio;
DROP TRIGGER IF EXISTS proteger_devolucion_documento_folio_truncate ON sigd_tes.devolucion_documento_folio;
CREATE TRIGGER proteger_orden_devolucion BEFORE UPDATE OR DELETE ON sigd_tes.orden_devolucion
 FOR EACH ROW EXECUTE FUNCTION sigd_tes.proteger_orden_devolucion();
CREATE TRIGGER proteger_orden_devolucion_truncate BEFORE TRUNCATE ON sigd_tes.orden_devolucion
 FOR EACH STATEMENT EXECUTE FUNCTION sigd_tes.proteger_orden_devolucion();
CREATE TRIGGER proteger_devolucion_documento_folio BEFORE UPDATE OR DELETE ON sigd_tes.devolucion_documento_folio
 FOR EACH ROW EXECUTE FUNCTION sigd_tes.proteger_orden_devolucion();
CREATE TRIGGER proteger_devolucion_documento_folio_truncate BEFORE TRUNCATE ON sigd_tes.devolucion_documento_folio
 FOR EACH STATEMENT EXECUTE FUNCTION sigd_tes.proteger_orden_devolucion();

-- REGLA INSTITUCIONAL PERMANENTE: Ningún usuario puede eliminarse físicamente del SIGD
CREATE OR REPLACE FUNCTION sigd_auth.proteger_cuenta_usuario_no_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'REGLA INSTITUCIONAL: Ningún usuario puede eliminarse físicamente del SIGD. Únicamente se puede desactivar su cuenta (activo = false).' USING ERRCODE='23001';
END $$;
DROP TRIGGER IF EXISTS proteger_cuenta_usuario_no_delete ON sigd_auth.cuenta_usuario;
DROP TRIGGER IF EXISTS proteger_cuenta_usuario_truncate ON sigd_auth.cuenta_usuario;
CREATE TRIGGER proteger_cuenta_usuario_no_delete BEFORE DELETE ON sigd_auth.cuenta_usuario
 FOR EACH ROW EXECUTE FUNCTION sigd_auth.proteger_cuenta_usuario_no_delete();
CREATE TRIGGER proteger_cuenta_usuario_truncate BEFORE TRUNCATE ON sigd_auth.cuenta_usuario
 FOR EACH STATEMENT EXECUTE FUNCTION sigd_auth.proteger_cuenta_usuario_no_delete();

REVOKE ALL ON sigd_tes.autorizacion_pago_adicional,sigd_tes.orden_devolucion,sigd_tes.devolucion_documento_folio FROM PUBLIC;

-- DDL ejecutado dentro de la transacción controlada por src/db/migrate.ts.
-- Se conserva UNIQUE(documento_id) por documento de Tesorería, pero el mismo
-- adjunto deduplicado puede respaldar más de una solicitud de devolución.
