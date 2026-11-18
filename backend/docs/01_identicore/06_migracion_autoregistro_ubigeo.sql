BEGIN;

CREATE TABLE IF NOT EXISTS sigd_auth.provincia_ubigeo (
    codigo CHAR(4) PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS sigd_auth.distrito_ubigeo (
    codigo CHAR(6) PRIMARY KEY,
    provincia_codigo CHAR(4) NOT NULL
        REFERENCES sigd_auth.provincia_ubigeo(codigo) ON UPDATE CASCADE ON DELETE RESTRICT,
    nombre VARCHAR(120) NOT NULL,
    CONSTRAINT uq_distrito_ubigeo_nombre UNIQUE (provincia_codigo, nombre)
);

INSERT INTO sigd_auth.provincia_ubigeo (codigo, nombre) VALUES
    ('2501', 'Coronel Portillo'),
    ('2502', 'Atalaya'),
    ('2503', 'Padre Abad'),
    ('2504', 'Purús')
ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre;

INSERT INTO sigd_auth.distrito_ubigeo (codigo, provincia_codigo, nombre) VALUES
    ('250101', '2501', 'Callería'),
    ('250102', '2501', 'Campoverde'),
    ('250103', '2501', 'Iparía'),
    ('250104', '2501', 'Masisea'),
    ('250105', '2501', 'Yarinacocha'),
    ('250106', '2501', 'Nueva Requena'),
    ('250107', '2501', 'Manantay'),
    ('250201', '2502', 'Raymondi'),
    ('250202', '2502', 'Sepahua'),
    ('250203', '2502', 'Tahuania'),
    ('250204', '2502', 'Yurúa'),
    ('250301', '2503', 'Padre Abad'),
    ('250302', '2503', 'Irazola'),
    ('250303', '2503', 'Curimaná'),
    ('250304', '2503', 'Neshuya'),
    ('250305', '2503', 'Alexander von Humboldt'),
    ('250401', '2504', 'Purús')
ON CONFLICT (codigo) DO UPDATE
SET provincia_codigo = EXCLUDED.provincia_codigo, nombre = EXCLUDED.nombre;

ALTER TABLE sigd_auth.persona
    ADD COLUMN IF NOT EXISTS direccion VARCHAR(250),
    ADD COLUMN IF NOT EXISTS ubigeo_distrito CHAR(6);

ALTER TABLE sigd_auth.persona
    ALTER COLUMN apellido_paterno DROP NOT NULL;

ALTER TABLE sigd_auth.persona_juridica
    ALTER COLUMN partida_registral_sunarp DROP NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conname = 'fk_persona_distrito_ubigeo'
           AND conrelid = 'sigd_auth.persona'::regclass
    ) THEN
        ALTER TABLE sigd_auth.persona
            ADD CONSTRAINT fk_persona_distrito_ubigeo
            FOREIGN KEY (ubigeo_distrito)
            REFERENCES sigd_auth.distrito_ubigeo(codigo)
            ON UPDATE CASCADE ON DELETE RESTRICT;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_persona_ubigeo_distrito
    ON sigd_auth.persona (ubigeo_distrito);

COMMIT;