-- Contrato virtual sobre las identidades UUID existentes; no modifica datos previos.
ALTER TABLE sigd_tra.expediente
 ADD COLUMN tipo_tramite_id UUID REFERENCES sigd_doc.tipo_tramite_tupa(tipo_tramite_id),
 ADD COLUMN fecha_envio_real TIMESTAMPTZ,
 ADD COLUMN fuera_de_horario BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN correo_notificacion VARCHAR(150),
 ADD COLUMN nombre_solicitante VARCHAR(120),
 ADD COLUMN total_folios INTEGER CHECK(total_folios > 0);
INSERT INTO sigd_doc.tipo_documento(tipo_documental_id,codigo,nombre)
 VALUES ('10000000-0000-4000-8000-000000000001','SOLICITUD','Solicitud PDF')
 ON CONFLICT(codigo) DO NOTHING;
CREATE TABLE sigd_doc.carga_documento (
 carga_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 usuario_id UUID NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario),
 nombre_archivo VARCHAR(255) NOT NULL,
 tamano_bytes BIGINT NOT NULL CHECK(tamano_bytes BETWEEN 1 AND 20971520),
 sha256 CHAR(64) NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),
 s3_bucket TEXT NOT NULL, s3_key TEXT NOT NULL UNIQUE,
 estado TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK(estado IN ('PENDIENTE','CONFIRMADO','VINCULADO')),
 expediente_id UUID REFERENCES sigd_tra.expediente(expediente_id),
 creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE sigd_tra.cargo_digital (
 expediente_id UUID PRIMARY KEY REFERENCES sigd_tra.expediente(expediente_id),
 codigo_cargo TEXT NOT NULL UNIQUE, hash_sha256 CHAR(64) NOT NULL,
 qr_contenido TEXT NOT NULL, emitido_en TIMESTAMPTZ NOT NULL
);
CREATE FUNCTION sigd_tra.exigir_adjunto_virtual() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.tipo_tramite_id IS NOT NULL AND NOT EXISTS
  (SELECT 1 FROM sigd_doc.documento_adjunto WHERE expediente_id=NEW.expediente_id) THEN
  RAISE EXCEPTION 'La radicacion virtual exige un adjunto confirmado';
 END IF;
 RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER trg_expediente_exigir_adjunto
 AFTER INSERT OR UPDATE ON sigd_tra.expediente DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION sigd_tra.exigir_adjunto_virtual();
