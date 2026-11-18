-- Cada URL prefirmada queda ligada a una carga emitida por el servidor.
CREATE TABLE sigd_doc.tupa_documento_oficial_upload (
    upload_id UUID PRIMARY KEY,
    id_version UUID NOT NULL REFERENCES sigd_doc.tupa_version(id_version),
    storage_key VARCHAR(500) NOT NULL UNIQUE,
    nombre_archivo VARCHAR(255) NOT NULL,
    emitido_por UUID NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario),
    estado VARCHAR(12) NOT NULL DEFAULT 'PENDIENTE'
        CHECK (estado IN ('PENDIENTE', 'CONFIRMADO')),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    confirmado_en TIMESTAMPTZ,
    CONSTRAINT uq_tupa_upload_version_key UNIQUE (upload_id, id_version, storage_key),
    CONSTRAINT ck_tupa_upload_confirmado CHECK (
        (estado = 'PENDIENTE' AND confirmado_en IS NULL)
        OR (estado = 'CONFIRMADO' AND confirmado_en IS NOT NULL)
    )
);

ALTER TABLE sigd_doc.tupa_documento_oficial_historial
    ADD COLUMN upload_id UUID NULL
        REFERENCES sigd_doc.tupa_documento_oficial_upload(upload_id),
    ADD CONSTRAINT uq_tupa_historial_upload UNIQUE (upload_id),
    ADD CONSTRAINT fk_tupa_historial_carga_exacta
        FOREIGN KEY (upload_id, id_version, storage_key)
        REFERENCES sigd_doc.tupa_documento_oficial_upload(upload_id, id_version, storage_key);

-- Las filas anteriores a esta migración pueden compartir clave y ya no son reparables
-- sin las versiones físicas del objeto. Garantizar unicidad para cargas nuevas.
CREATE UNIQUE INDEX uq_tupa_historial_storage_key_nueva
    ON sigd_doc.tupa_documento_oficial_historial(storage_key)
    WHERE upload_id IS NOT NULL;

-- La fila histórica puede nacer una sola vez. El puntero vigente se actualiza aparte.
CREATE FUNCTION sigd_doc.bloquear_cambio_historial_tupa()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'El historial del documento oficial TUPA es inmutable';
END $$;

CREATE TRIGGER tr_tupa_historial_inmutable
BEFORE UPDATE OR DELETE ON sigd_doc.tupa_documento_oficial_historial
FOR EACH ROW EXECUTE FUNCTION sigd_doc.bloquear_cambio_historial_tupa();
