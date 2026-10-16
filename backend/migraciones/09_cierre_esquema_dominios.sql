-- =============================================================================
-- 09_cierre_esquema_dominios.sql
-- =============================================================================
-- Cierra los huecos de esquema que impedían que los dominios operaran contra el
-- DDL efectivamente versionado. Cada objeto que se crea aquí es REQUERIDO por
-- código ya escrito y versionado; no se inventa modelo nuevo, se completa el que
-- los dominios asumían contractualmente.
--
-- Reglas aplicadas:
--   * Todo es idempotente (IF NOT EXISTS / ON CONFLICT) porque el corredor de
--     migraciones es reentrante.
--   * Los datos de catálogo inmutable (ubigeo) se siembran en esta misma
--     transacción: son parte del dominio y no de una carga de demostración.
--   * Ningún objeto altera una tabla ya publicada; sólo se añaden tablas nuevas y
--     columnas nuevas, de modo que no se rompe ningún lector existente.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 9.1 sigd_auth.provincia_ubigeo / distrito_ubigeo
--      Catálogo territorial INEI del departamento 25 (Ucayali).
--      Requerido por Identicore/UbigeoService y por el registro de ciudadanos.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_auth.provincia_ubigeo (
    codigo  CHAR(4)     NOT NULL CONSTRAINT pk_provincia_ubigeo PRIMARY KEY,
    nombre  VARCHAR(80) NOT NULL,
    CONSTRAINT chk_provincia_ubigeo_codigo CHECK (codigo ~ '^25[0-9]{2}$')
);

COMMENT ON TABLE sigd_auth.provincia_ubigeo IS
    'Provincias del departamento 25 Ucayali segun codigos INEI. Catalogo inmutable.';

CREATE TABLE IF NOT EXISTS sigd_auth.distrito_ubigeo (
    codigo          CHAR(6)     NOT NULL CONSTRAINT pk_distrito_ubigeo PRIMARY KEY,
    provincia_codigo CHAR(4)    NOT NULL
                                 REFERENCES sigd_auth.provincia_ubigeo (codigo) ON DELETE RESTRICT,
    nombre          VARCHAR(80) NOT NULL,
    CONSTRAINT chk_distrito_ubigeo_codigo CHECK (codigo ~ '^25[0-9]{4}$')
);

COMMENT ON TABLE sigd_auth.distrito_ubigeo IS
    'Distritos de Ucayali segun codigos INEI (6 digitos). Catalogo inmutable.';

CREATE INDEX IF NOT EXISTS idx_distrito_ubigeo_provincia
    ON sigd_auth.distrito_ubigeo (provincia_codigo);

-- Ucayali: 4 provincias y 17 distritos (validado por UbigeoService.esquemaCatalogo).
INSERT INTO sigd_auth.provincia_ubigeo (codigo, nombre) VALUES
    ('2501', 'CORONEL PORTILLO'),
    ('2502', 'ATALAYA'),
    ('2503', 'PADRE ABAD'),
    ('2504', 'PURUS')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO sigd_auth.distrito_ubigeo (codigo, provincia_codigo, nombre) VALUES
    ('250101', '2501', 'CALLERIA'),
    ('250102', '2501', 'CAMPOVERDE'),
    ('250103', '2501', 'IPARIA'),
    ('250104', '2501', 'MASISEA'),
    ('250105', '2501', 'YARINACOCHA'),
    ('250106', '2501', 'NUEVA REQUENA'),
    ('250107', '2501', 'MANANTAY'),
    ('250201', '2502', 'RAIMONDI'),
    ('250202', '2502', 'SEPAHUA'),
    ('250203', '2502', 'TAHUANIA'),
    ('250204', '2502', 'YURUA'),
    ('250301', '2503', 'PADRE ABAD'),
    ('250302', '2503', 'IRAZOLA'),
    ('250303', '2503', 'CURIMANA'),
    ('250304', '2503', 'NESHUYA'),
    ('250305', '2503', 'ALEXANDER VON HUMBOLDT'),
    ('250401', '2504', 'PURUS')
ON CONFLICT (codigo) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 9.2 sigd_org.sede / puesto_laboral
--      Requerido por OrganiCore (directorio de usuarios) y por los filtros de
--      sede de la frontend. `sigd_org.cargo` ya existe; el puesto laboral es la
--      asignación de un cargo a una sede y a un área.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_org.sede (
    sede_id   UUID        NOT NULL DEFAULT gen_random_uuid()
                           CONSTRAINT pk_sede PRIMARY KEY,
    codigo    VARCHAR(20) NOT NULL UNIQUE,
    nombre    VARCHAR(120) NOT NULL,
    direccion VARCHAR(200) NULL,
    telefono  VARCHAR(30)  NULL,
    principal BOOLEAN     NOT NULL DEFAULT FALSE,
    activo    BOOLEAN     NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE sigd_org.sede IS
    'Sedes fisicas del IESTP. La sede con principal = TRUE es la sede matriz.';

-- Una sola sede principal: se libera la anterior dentro de la misma transaccion.
CREATE UNIQUE INDEX IF NOT EXISTS uq_sede_principal
    ON sigd_org.sede ((principal)) WHERE principal AND activo;

CREATE TABLE IF NOT EXISTS sigd_org.puesto_laboral (
    puesto_laboral_id UUID        NOT NULL DEFAULT gen_random_uuid()
                                 CONSTRAINT pk_puesto_laboral PRIMARY KEY,
    cargo_id          UUID        NOT NULL
                                 REFERENCES sigd_org.cargo (cargo_id) ON DELETE RESTRICT,
    sede_id           UUID        NULL
                                 REFERENCES sigd_org.sede (sede_id) ON DELETE RESTRICT,
    area_id           UUID        NULL
                                 REFERENCES sigd_org.area (area_id) ON DELETE RESTRICT,
    codigo            VARCHAR(20) NOT NULL UNIQUE,
    descripcion       VARCHAR(200) NULL,
    activo            BOOLEAN     NOT NULL DEFAULT TRUE,
    creado_en         TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE sigd_org.puesto_laboral IS
    'Puesto laboral: une un cargo con la sede y el area donde se ejerce.';

CREATE INDEX IF NOT EXISTS idx_puesto_laboral_cargo ON sigd_org.puesto_laboral (cargo_id);
CREATE INDEX IF NOT EXISTS idx_puesto_laboral_sede  ON sigd_org.puesto_laboral (sede_id);

-- -----------------------------------------------------------------------------
-- 9.3 sigd_tra.cargo_digital
--      Cargo de recepción con código QR y hash de integridad, emitido en cada
--      radicación (Art. 38 del TUO de la Ley 27444: constancia de recepción).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_tra.cargo_digital (
    id_cargo       UUID        NOT NULL DEFAULT gen_random_uuid()
                               CONSTRAINT pk_cargo_digital PRIMARY KEY,
    expediente_id  UUID        NOT NULL
                               REFERENCES sigd_tra.expediente (expediente_id) ON DELETE RESTRICT,
    codigo_cargo   VARCHAR(40) NOT NULL UNIQUE,
    hash_sha256    CHAR(64)    NOT NULL,
    qr_contenido   TEXT        NOT NULL,
    total_folios   INTEGER     NOT NULL DEFAULT 0,
    emitido_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_cargo_digital_folios CHECK (total_folios >= 0)
);

COMMENT ON TABLE sigd_tra.cargo_digital IS
    'Cargo digital de recepcion. Su hash SHA-256 acredita el contenido entregado al ciudadano.';

CREATE INDEX IF NOT EXISTS idx_cargo_digital_expediente ON sigd_tra.cargo_digital (expediente_id);

-- -----------------------------------------------------------------------------
-- 9.4 sigd_tra.proveido
--      Providencia emitida al ciudadano sobre un expediente. Sólo las marcadas
--      `es_publico` se exponen en la consulta pública por CUT.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_tra.proveido (
    id_proveido    UUID        NOT NULL DEFAULT gen_random_uuid()
                               CONSTRAINT pk_proveido PRIMARY KEY,
    expediente_id  UUID        NOT NULL
                               REFERENCES sigd_tra.expediente (expediente_id) ON DELETE RESTRICT,
    numero         VARCHAR(40) NOT NULL,
    fecha_emision  TIMESTAMPTZ NOT NULL DEFAULT now(),
    resumen        VARCHAR(500) NULL,
    es_publico     BOOLEAN     NOT NULL DEFAULT FALSE,
    CONSTRAINT uq_proveido_expediente_numero UNIQUE (expediente_id, numero)
);

COMMENT ON TABLE sigd_tra.proveido IS
    'Providencias del expediente. es_publico gobierna su exposicion en la consulta publica.';

CREATE INDEX IF NOT EXISTS idx_proveido_expediente ON sigd_tra.proveido (expediente_id);

-- -----------------------------------------------------------------------------
-- 9.5 sigd_doc.foliacion_documento
--      Foliación continua AGN por expediente. Inmutable una vez escrita.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_doc.foliacion_documento (
    id_foliacion   UUID        NOT NULL DEFAULT gen_random_uuid()
                               CONSTRAINT pk_foliacion_documento PRIMARY KEY,
    expediente_id  UUID        NOT NULL
                               REFERENCES sigd_tra.expediente (expediente_id) ON DELETE RESTRICT,
    documento_id   UUID        NOT NULL,
    folio_desde    INTEGER     NOT NULL,
    folio_hasta    INTEGER     NOT NULL,
    total_folios   INTEGER     NOT NULL,
    asignado_por   UUID        NULL,
    asignado_en    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_foliacion_rango CHECK (folio_desde > 0 AND folio_hasta >= folio_desde),
    CONSTRAINT uq_foliacion_documento UNIQUE (expediente_id, documento_id)
);

COMMENT ON TABLE sigd_doc.foliacion_documento IS
    'Foliacion continua por expediente segun norma AGN. Inmutable.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_foliacion_rango
    ON sigd_doc.foliacion_documento (expediente_id, folio_desde, folio_hasta);

CREATE OR REPLACE FUNCTION sigd_doc.fn_rechazar_mutacion_foliacion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'La foliacion AGN es inmutable una vez registrada (Ley 26972)'
        USING ERRCODE = '23001',
              HINT = 'Registre la foliacion dentro de la misma transaccion que el documento.';
END;
$$;

DROP TRIGGER IF EXISTS trg_foliacion_no_update ON sigd_doc.foliacion_documento;
CREATE TRIGGER trg_foliacion_no_update
    BEFORE UPDATE OR DELETE ON sigd_doc.foliacion_documento
    FOR EACH ROW EXECUTE FUNCTION sigd_doc.fn_rechazar_mutacion_foliacion();

-- -----------------------------------------------------------------------------
-- 9.6 sigd_rut.tipo_relacion_movimiento
--      Clasificador del grafo de derivaciones que alimenta las tablas maestras.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_rut.tipo_relacion_movimiento (
    codigo      VARCHAR(20)  NOT NULL CONSTRAINT pk_tipo_relacion_movimiento PRIMARY KEY,
    nombre      VARCHAR(120) NOT NULL,
    descripcion VARCHAR(300) NULL,
    vigente     BOOLEAN      NOT NULL DEFAULT TRUE
);

INSERT INTO sigd_rut.tipo_relacion_movimiento (codigo, nombre, descripcion) VALUES
    ('DERIVACION',  'Derivacion',   'El expediente pasa a otra area para suleccio.'),
    ('OBSERVACION', 'Observacion',  'Se requiere Subsanacion del administrado (Art. 164 LPAG).'),
    ('SUBSANACION', 'Subsanacion',  'El administrado subsana lo observado.'),
    ('ACUMULACION', 'Acumulacion',  'Se acumula a otro expediente (Art. 160 LPAG).'),
    ('REVERSION',   'Reversion',    'Anulacion de una actuacion previa con compensacion de folios.'),
    ('ATENCION',    'Atencion',     'Se emite pronunciamiento resolutivo.'),
    ('ARCHIVO',     'Archivo',      'Archivo definitivo del expediente.')
ON CONFLICT (codigo) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 9.7 Columnas de expediente requeridas por TramiCore
--      `sigd_tra.expediente` es la tabla CANONICA (posee el CUT, el asiento y la
--      foliación). Le faltan las columnas que el módulo de radicación y la
--      consulta pública necesitan. Se agregan como columnas nuevas: no se altera
--      ninguna columna publicada ni se rompe a los lectores existentes.
--
--      Justificación legal de cada una:
--        fecha_envio_real     momento real de envío del administrado.
--        fecha_radicacion     fecha jurídica; puede proyectarse al día hábil
--                             siguiente si el envío cae fuera del horario
--                             (Art. 143 y 137 del TUO de la Ley 27444).
--        fuera_de_horario     marca la proyección; es lo que hace auditable el
--                             diferimiento del plazo.
--        total_folios         folios declarados por el ciudadano.
--        canal_recepcion      Mesa Virtual o Mesa Presencial.
-- -----------------------------------------------------------------------------
ALTER TABLE sigd_tra.expediente
    ADD COLUMN IF NOT EXISTS id_tipo_tramite_tupa  UUID NULL
        REFERENCES sigd_doc.tipo_tramite_tupa (tipo_tramite_id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS asunto               VARCHAR(500) NULL,
    ADD COLUMN IF NOT EXISTS nombre_solicitante   VARCHAR(200) NULL,
    ADD COLUMN IF NOT EXISTS correo_notificacion  VARCHAR(200) NULL,
    ADD COLUMN IF NOT EXISTS canal_recepcion      VARCHAR(30) NOT NULL DEFAULT 'MESA_VIRTUAL',
    ADD COLUMN IF NOT EXISTS total_folios         INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS fecha_envio_real     TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS fuera_de_horario     BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS notificaciones_json  JSONB NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_tra_expediente_canal'
    ) THEN
        ALTER TABLE sigd_tra.expediente
            ADD CONSTRAINT chk_tra_expediente_canal
            CHECK (canal_recepcion IN ('MESA_VIRTUAL', 'MESA_PRESENCIAL'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_tra_expediente_total_folios'
    ) THEN
        ALTER TABLE sigd_tra.expediente
            ADD CONSTRAINT chk_tra_expediente_total_folios CHECK (total_folios >= 0);
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_tra_expediente_solicitante ON sigd_tra.expediente (solicitante_id);
CREATE INDEX IF NOT EXISTS idx_tra_expediente_radicacion    ON sigd_tra.expediente (fecha_radicacion DESC);
CREATE INDEX IF NOT EXISTS idx_tra_expediente_tipo_tramite  ON sigd_tra.expediente (id_tipo_tramite_tupa);