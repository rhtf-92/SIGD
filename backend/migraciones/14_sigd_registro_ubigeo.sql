-- Catalogo institucional ya definido en docs/01_identicore/06_migracion_autoregistro_ubigeo.sql.
-- Se integra al ledger canonico sin modificar migraciones historicas ni sobrescribir datos existentes.
CREATE TABLE IF NOT EXISTS sigd_auth.provincia_ubigeo (
  codigo CHAR(4) PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS sigd_auth.distrito_ubigeo (
  codigo CHAR(6) PRIMARY KEY,
  provincia_codigo CHAR(4) NOT NULL REFERENCES sigd_auth.provincia_ubigeo(codigo),
  nombre VARCHAR(120) NOT NULL,
  CONSTRAINT uq_distrito_ubigeo_nombre UNIQUE (provincia_codigo, nombre)
);

INSERT INTO sigd_auth.provincia_ubigeo (codigo, nombre) VALUES
  ('2501', 'Coronel Portillo'), ('2502', 'Atalaya'),
  ('2503', 'Padre Abad'), ('2504', 'Purús')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO sigd_auth.distrito_ubigeo (codigo, provincia_codigo, nombre) VALUES
  ('250101', '2501', 'Callería'), ('250102', '2501', 'Campoverde'),
  ('250103', '2501', 'Iparía'), ('250104', '2501', 'Masisea'),
  ('250105', '2501', 'Yarinacocha'), ('250106', '2501', 'Nueva Requena'),
  ('250107', '2501', 'Manantay'), ('250201', '2502', 'Raymondi'),
  ('250202', '2502', 'Sepahua'), ('250203', '2502', 'Tahuania'),
  ('250204', '2502', 'Yurúa'), ('250301', '2503', 'Padre Abad'),
  ('250302', '2503', 'Irazola'), ('250303', '2503', 'Curimaná'),
  ('250304', '2503', 'Neshuya'), ('250305', '2503', 'Alexander von Humboldt'),
  ('250401', '2504', 'Purús')
ON CONFLICT (codigo) DO NOTHING;

ALTER TABLE sigd_auth.persona
  ADD COLUMN IF NOT EXISTS direccion VARCHAR(250),
  ADD COLUMN IF NOT EXISTS ubigeo_distrito CHAR(6);

ALTER TABLE sigd_auth.persona_juridica
  ADD COLUMN IF NOT EXISTS partida_registral_sunarp VARCHAR(18);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_persona_distrito_ubigeo'
      AND conrelid = 'sigd_auth.persona'::regclass
  ) THEN
    ALTER TABLE sigd_auth.persona
      ADD CONSTRAINT fk_persona_distrito_ubigeo
      FOREIGN KEY (ubigeo_distrito) REFERENCES sigd_auth.distrito_ubigeo(codigo);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_persona_ubigeo_distrito
  ON sigd_auth.persona (ubigeo_distrito);
