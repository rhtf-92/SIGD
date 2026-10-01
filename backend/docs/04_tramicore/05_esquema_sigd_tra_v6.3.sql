-- =============================================================================
-- SIGD · IESTP "Suiza" (Pucallpa) — Ola 2 / Prioridad 2 · Módulo 04 TramiCore
-- Esquema relacional `sigd_tra` — versión 6.3
--
-- Autor: Elmer Ramírez (B_RAMIREZ) — Sublíder Grupo 2 / Arquitecto CUT
-- Tarea: T-BE-TC-01 (generador atómico de CUT) y base de T-BE-TC-02/03/04
-- Marco jurídico: MGD-PCM (R.S. N° 001-2017-PCM/SEGDI) y TUO Ley N° 27444
--                 (Art. 138 LPAG: horario de corte 16:30 y cómputo de plazos)
-- Motor: PostgreSQL 18.3+ (`gen_random_uuid` de pgcrypto, `to_regclass`)
--
-- DESVIACIONES CONSCIENTES RESPECTO DEL PLAN (documentadas para el equipo):
--
--   1. `id_persona` es BIGINT y no UUID. El plan muestra
--      `solicitanteId: z.string().uuid()`, pero el DDL canonico de IdentiCore
--      (`docs/01_identicore/03_esquema_sigd_auth_v2.sql`) declara
--      `sigd_auth.persona.id` como BIGSERIAL y no existe en el repositorio
--      ninguna entidad de persona con PK UUID. Un UUID aqui impediria anclar el
--      expediente a un administrado real y reproduce justamente el expediente
--      "zombie" que T-BE-TC-02 debe eliminar. Decision aprobada por el lider
--      de la rama.
--
--   2. El endpoint #16 omite el telefono en lugar de enmascararlo. El plan
--      ilustra `Telefono: 961***456`, pero enmascarar revela que el dato existe
--      y su formato; omitirlo revela menos y cumple mejor el principio de
--      minimizacion de la Ley N. 29733, que es el fin que la tarea persigue.
--
--   3. `direccion` no se protege porque `sigd_auth.persona` no tiene esa
--      columna en el esquema vigente. No hay dato que enmascarar. Si se agrega
--      en el futuro, debe incorporarse al DTO de `consultaPublica.service.ts`
--      como campo omitido o enmascarado, nunca expuesto en claro.
--
-- Requisito rector (T-BE-TC-01): el correlativo NO se obtiene con
-- `SELECT MAX(numero) + 1`, técnica que bajo concurrencia produce colisiones
-- SQLSTATE 23505 y bloquea la Mesa de Partes. La asignación se delega a
-- secuencias nativas por ejercicio fiscal con `nextval()`, es decir O(1) y sin
-- contención de bloqueos entresessions.
--
-- INSTALACIÓN (respetar el orden topológico del DAG):
--   psql -d sigd_db -f backend/docs/01_identicore/03_esquema_sigd_auth_v2.sql
--   psql -d sigd_db -f backend/docs/02_organicore/03_esquema_sigd_org_v6.3.sql
--   psql -d sigd_db -f backend/docs/03_docucore/05_esquema_sigd_doc_jsonb_v6.3_auditoria_corregido.sql
--   psql -d sigd_db -f backend/docs/04_tramicore/05_esquema_sigd_tra_v6.3.sql
--
-- NOTAS DE COORDINACIÓN (rompen consumidores previos; requieren alineación):
--   1. `sigd_tra.expediente` se define con clave `expediente_id UUID` y la
--      columna `cut` con máscara `EXP-YYYY-XXXXXX`. Los consumidores que aún
--      insertan `numero`/`dni_solicitante` (fixtures E2E de CoreLink y
--      `src/referencia/expediente.router.ts`) deben migrar a este contrato.
--   2. El CHECK `^EXP-\d{4}-\d{6}$` rechaza los CUT con prefijo `CUT-`
--      generados en cliente por `src/domains/tramicore/ventanillaPresencial.service.ts`
--      (B_RIQUELMER). Ese servicio debe delegar el CUT a `fn_generar_cut`.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS sigd_tra;

-- -----------------------------------------------------------------------------
-- 1. REGISTRO DE SECUENCIAS ANUALES DEL CUT
-- Auditoría de qué ejercicios fiscales tienen correlativo propio. Deliberadamente
-- NO se actualiza en el camino caliente de `fn_generar_cut`: escribir en cada
-- generación reintroduciría un lock de fila sobre una única tupla y rompería la
-- garantía de "sin contención". El correlativo vigente se consulta en la vista
-- `sigd_tra.vw_corte_cuit`... (ver `vw_ultimo_cut_por_anio` al final del script).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_tra.cut_secuencia_anual (
    anio            INT PRIMARY KEY,
    nombre_secuencia TEXT NOT NULL UNIQUE,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_cut_anio_rango CHECK (anio BETWEEN 1900 AND 9999)
);

COMMENT ON TABLE sigd_tra.cut_secuencia_anual IS
    'Ejercicios fiscales con correlativo CUT propio (secuencia sigd_tra.seq_cut_<anio>).';

-- -----------------------------------------------------------------------------
-- 2. FUNCIÓN NUCLEAR: sigd_tra.fn_generar_cut(p_anio INT)
--
-- T-BE-TC-01. Devuelve el CUT con máscara EXP-YYYY-XXXXXX para el ejercicio
-- fiscal indicado.
--
-- Garantías:
--   * O(1) y sin contención: `nextval()` toma un lock de muy corta duración y no
--     bloquea a ninguna otra sesión, a diferencia de `SELECT MAX() + 1` con
--     `FOR UPDATE` o de una tabla de control con `FOR UPDATE` por llamada.
--   * Sin colisiones: la unicidad la impone `expediente.cut` (UNIQUE). Dos
--     sesiones simultáneas reciben correlativos distintos por construcción de
--     la secuencia; ningún par puede repetir valor.
--   * Autoprovisionable: la secuencia del ejercicio se crea la primera vez que
--     se solicita ese año, de modo que el cambio de año fiscal no exige
--     desplegar DDL. El advisory lock se toma únicamente en ese primer
--     llamado; a partir de ahí `to_regclass` resuelve la existencia sin
--     serializar el resto de las sesiones.
--   * Formato: LPAD a 6 dígitos con relleno de ceros a la izquierda.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sigd_tra.fn_generar_cut(p_anio INT)
RETURNS VARCHAR(20)
LANGUAGE plpgsql
AS $fn$
DECLARE
    v_secuencia    TEXT;
    v_correlativo  BIGINT;
    v_cut          VARCHAR(20);
BEGIN
    IF p_anio IS NULL OR p_anio < 1900 OR p_anio > 9999 THEN
        RAISE EXCEPTION 'ANIO_FISCAL_INVALIDO: se esperaba un anio entre 1900 y 9999, se recibio %',
            p_anio
            USING ERRCODE = '22023',
                  HINT = 'Use EXTRACT(YEAR FROM NOW())::INT para el ejercicio corriente.';
    END IF;

    v_secuencia := format('seq_cut_%s', p_anio);

    INSERT INTO sigd_tra.cut_secuencia_anual (anio, nombre_secuencia)
    VALUES (p_anio, v_secuencia)
    ON CONFLICT (anio) DO NOTHING;

    -- Camino caliente: la secuencia ya existe, no se toma ningún lock.
    IF to_regclass(format('sigd_tra.%I', v_secuencia)) IS NOT NULL THEN
        EXECUTE format('SELECT nextval(%L)', format('sigd_tra.%I', v_secuencia))
            INTO v_correlativo;
    ELSE
        -- Primer llamado del ejercicio fiscal: serializar solo la provisión.
        PERFORM pg_advisory_xact_lock(7261000 + p_anio);
        EXECUTE format(
            'CREATE SEQUENCE IF NOT EXISTS sigd_tra.%I START WITH 1 INCREMENT BY 1 NO MAXVALUE CACHE 32',
            v_secuencia);
        EXECUTE format('SELECT nextval(%L)', format('sigd_tra.%I', v_secuencia))
            INTO v_correlativo;
    END IF;

    v_cut := 'EXP-' || p_anio::TEXT || '-' || lpad(v_correlativo::TEXT, 6, '0');

    RETURN v_cut;
END;
$fn$;

COMMENT ON FUNCTION sigd_tra.fn_generar_cut(INT) IS
    'Genera el CUT atomico con mascara EXP-YYYY-XXXXXX a partir de la secuencia anual sigd_tra.seq_cut_<anio>. O(1), sin colisiones y sin contencion.';

REVOKE ALL ON FUNCTION sigd_tra.fn_generar_cut(INT) FROM PUBLIC;

-- -----------------------------------------------------------------------------
-- 3. TABLAS DEL DOMINIO DE TRAMITACIÓN
-- -----------------------------------------------------------------------------

-- 3.1 Expediente: entidad central radicada. `fecha_envio_real` es metadato
--     pericial inmutable; `fecha_radicacion_legal` es la fecha que corre el
--     cómputo de plazos (Art. 138 LPAG, corte 16:30).
CREATE TABLE IF NOT EXISTS sigd_tra.expediente (
    expediente_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cut                    VARCHAR(20) NOT NULL UNIQUE,
    -- El tipo replica el DDL canonico de IdentiCore
    -- (docs/01_identicore/03_esquema_sigd_auth_v2.sql), donde `persona.id` es
    -- BIGSERIAL. No existe en el repositorio ninguna entidad de persona con
    -- PK UUID, por lo que un UUID aqui dejaria expedientes huerfanos y
    -- frustraria la causa raiz de T-BE-TC-02 (expedientes sin administrado).
    id_persona             BIGINT NOT NULL,
    id_tipo_tramite_tupa   UUID NOT NULL,
    -- Datos de contacto del solicitante capturados en el acto de la
    -- radicacion. T-BE-TC-02 exige que el esquema certifique los datos
    -- completos del solicitante y que rechace los correos invalidos antes de
    -- abrir la transaccion, porque las insertions parciales dejaban
    -- expedientes zombie sin administrador asociado. El correo se persiste
    -- para las notificaciones de cargo y seguimiento, y jamas se expone en la
    -- consulta publica (ver `consultaPublica.service.ts`).
    nombre_solicitante     VARCHAR(120) NOT NULL,
    correo_notificacion    VARCHAR(150) NOT NULL,
    asunto                 VARCHAR(500) NOT NULL,
    canal_recepcion        VARCHAR(30) NOT NULL DEFAULT 'MESA_VIRTUAL',
    estado_tramite         VARCHAR(30) NOT NULL DEFAULT 'REGISTRADO',
    total_folios           INT NOT NULL DEFAULT 1,
    fecha_envio_real       TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_radicacion_legal TIMESTAMPTZ NOT NULL,
    fuera_de_horario       BOOLEAN NOT NULL DEFAULT FALSE,
    creado_en              TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Derivada del propio CUT, por lo que no puede desincronizarse de este.
    anio_fiscal            INT GENERATED ALWAYS AS (substring(cut FROM 5 FOR 4)::INT) STORED,

    CONSTRAINT chk_expediente_cut_formato
        CHECK (cut ~ '^EXP-[0-9]{4}-[0-9]{6}$'),
    CONSTRAINT chk_expediente_asunto
        CHECK (btrim(asunto) <> ''),
    CONSTRAINT chk_expediente_nombre_solicitante
        CHECK (btrim(nombre_solicitante) <> ''),
    -- Defensa en profundidad: la app valida con Zod, pero una escritura por
    -- SQL directo no debe poder dejar un correo inutilizable para notificar.
    CONSTRAINT chk_expediente_correo
        CHECK (correo_notificacion ~* '^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$'),
    CONSTRAINT chk_expediente_folios
        CHECK (total_folios > 0),
    CONSTRAINT chk_expediente_canal
        CHECK (canal_recepcion IN ('MESA_VIRTUAL', 'VENTANILLA_PRESENCIAL')),
    CONSTRAINT chk_expediente_estado
        CHECK (estado_tramite IN (
            'REGISTRADO', 'RECEPCIONADO', 'DERIVADO', 'EN_TRAMITE',
            'PENDIENTE_FIRMA', 'FIRMADO', 'NOTIFICADO', 'OBSERVADO',
            'SUBSANADO', 'ARCHIVADO', 'ANULADO'
        ))
);

-- Radicación dentro del horario hábil: la fecha legal nunca puede ser anterior
-- al envío real, porque el silencio administrativo positivo no retrocede el
-- cómputo. La tolerancia de un dia absorbe la diferencia de zona horaria
-- entre el instante capturado por la app y el registrado por PostgreSQL.
ALTER TABLE sigd_tra.expediente
    DROP CONSTRAINT IF EXISTS chk_expediente_fecha_legal;
ALTER TABLE sigd_tra.expediente
    ADD CONSTRAINT chk_expediente_fecha_legal
    CHECK (fecha_radicacion_legal >= fecha_envio_real - INTERVAL '1 day');

-- Altas de columnas y constraints para bases donde `sigd_tra.expediente` ya
-- existia sin los datos de contacto del solicitante. Es idempotente y no
-- invalida los expedientes previos: las columnas se rellenan con marcadores
-- neutros para no dejar filas que violen el NOT NULL.
ALTER TABLE sigd_tra.expediente
    ADD COLUMN IF NOT EXISTS nombre_solicitante  VARCHAR(120) NOT NULL DEFAULT 'PENDIENTE';
ALTER TABLE sigd_tra.expediente
    ADD COLUMN IF NOT EXISTS correo_notificacion VARCHAR(150) NOT NULL DEFAULT 'pendiente@tramicore.local';

ALTER TABLE sigd_tra.expediente
    DROP CONSTRAINT IF EXISTS chk_expediente_nombre_solicitante;
ALTER TABLE sigd_tra.expediente
    ADD CONSTRAINT chk_expediente_nombre_solicitante
    CHECK (btrim(nombre_solicitante) <> '');

ALTER TABLE sigd_tra.expediente
    DROP CONSTRAINT IF EXISTS chk_expediente_correo;
ALTER TABLE sigd_tra.expediente
    ADD CONSTRAINT chk_expediente_correo
    CHECK (correo_notificacion ~* '^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$');

-- Los DEFAULT solo sirvieron para el backfill de filas existentes; se retiran
-- para que toda radicacion futura los Provea de forma explicita.
ALTER TABLE sigd_tra.expediente
    ALTER COLUMN nombre_solicitante  DROP DEFAULT;
ALTER TABLE sigd_tra.expediente
    ALTER COLUMN correo_notificacion DROP DEFAULT;

-- Claves foraneas hacia los dominios de IdentiCore (persona) y DocuCore
-- (catalogo TUPA). Se agregan de forma condicional porque este DDL tambien se
-- instala de forma independiente durante las pruebas del dominio TramiCore,
-- donde esos esquemas aun no existen. En la plataforma completa las claves si
-- quedan activas, que es lo que impide el expediente sin administrado.
DO $$
DECLARE
    v_persona TEXT := 'sigd_auth.persona';
    v_tupa    TEXT := 'sigd_doc.tipo_tramite_tupa';
BEGIN
    IF to_regclass(v_persona) IS NOT NULL
       AND NOT EXISTS (
           SELECT 1 FROM pg_constraint
           WHERE conname = 'fk_expediente_persona'
             AND conrelid = 'sigd_tra.expediente'::regclass
       )
    THEN
        ALTER TABLE sigd_tra.expediente
            ADD CONSTRAINT fk_expediente_persona
            FOREIGN KEY (id_persona)
            REFERENCES sigd_auth.persona (id)
            ON UPDATE CASCADE ON DELETE RESTRICT;
    END IF;

    IF to_regclass(v_tupa) IS NOT NULL
       AND NOT EXISTS (
           SELECT 1 FROM pg_constraint
           WHERE conname = 'fk_expediente_tipo_tramite'
             AND conrelid = 'sigd_tra.expediente'::regclass
       )
    THEN
        ALTER TABLE sigd_tra.expediente
            ADD CONSTRAINT fk_expediente_tipo_tramite
            FOREIGN KEY (id_tipo_tramite_tupa)
            REFERENCES sigd_doc.tipo_tramite_tupa (id_tipo_tramite_tupa)
            ON UPDATE CASCADE ON DELETE RESTRICT;
    END IF;
END
$$;

COMMENT ON COLUMN sigd_tra.expediente.cut IS
    'Codigo Unico de Tramite. Identificador de negocio visible al ciudadano (MGD-PCM).';
COMMENT ON COLUMN sigd_tra.expediente.fecha_envio_real IS
    'Metadato pericial inmutable: momento exacto de la recepcion tecnica.';
COMMENT ON COLUMN sigd_tra.expediente.fecha_radicacion_legal IS
    'Fecha que inicia el computo de plazos. Art. 138 LPAG: 08:00 del primer dia habil siguiente si se recibio fuera del corte de 16:30 o en dia no habil.';

-- Índices de acceso de la Mesa de Partes y de la consulta pública por CUT.
-- `cut` ya está indexado por su restricción UNIQUE.
CREATE INDEX IF NOT EXISTS idx_expediente_persona
    ON sigd_tra.expediente (id_persona);
CREATE INDEX IF NOT EXISTS idx_expediente_estado
    ON sigd_tra.expediente (estado_tramite);
CREATE INDEX IF NOT EXISTS idx_expediente_fecha_legal
    ON sigd_tra.expediente (fecha_radicacion_legal);

-- 3.2 Adjuntos del expediente. T-BE-TC-02 exige al menos un archivo cargado,
--     por lo que se materializa como tabla y no como arreglo en JSON.
CREATE TABLE IF NOT EXISTS sigd_tra.documento_adjunto (
    id_adjunto       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expediente_id    UUID NOT NULL
        REFERENCES sigd_tra.expediente (expediente_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    nombre_archivo   VARCHAR(255) NOT NULL,
    content_type     VARCHAR(120) NOT NULL,
    tamano_bytes     BIGINT NOT NULL,
    hash_sha256      CHAR(64) NOT NULL,
    storage_path     VARCHAR(512) NULL,
    creado_en        TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_adjunto_nombre
        CHECK (btrim(nombre_archivo) <> ''),
    CONSTRAINT chk_adjunto_tamano
        CHECK (tamano_bytes > 0)
);

CREATE INDEX IF NOT EXISTS idx_adjunto_expediente
    ON sigd_tra.documento_adjunto (expediente_id);

-- 3.3 Cargo digital preliminar emitido en la radicación virtual (endpoint #14).
CREATE TABLE IF NOT EXISTS sigd_tra.cargo_digital (
    id_cargo         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expediente_id    UUID NOT NULL UNIQUE
        REFERENCES sigd_tra.expediente (expediente_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    codigo_cargo     VARCHAR(40) NOT NULL UNIQUE,
    hash_sha256      CHAR(64) NOT NULL,
    qr_contenido     VARCHAR(512) NOT NULL,
    emitido_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.4 Proveídos. `es_publico` gobierna qué puede exponer la consulta anónima
--     del endpoint #16 (Ley N° 29733, principio de minimización).
CREATE TABLE IF NOT EXISTS sigd_tra.proveido (
    id_proveido      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expediente_id    UUID NOT NULL
        REFERENCES sigd_tra.expediente (expediente_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    numero           VARCHAR(20) NOT NULL,
    fecha_emision    DATE NOT NULL DEFAULT CURRENT_DATE,
    resumen          VARCHAR(500) NOT NULL,
    es_publico       BOOLEAN NOT NULL DEFAULT FALSE,
    creado_en        TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_proveido_expediente_numero UNIQUE (expediente_id, numero),
    CONSTRAINT chk_proveido_resumen
        CHECK (btrim(resumen) <> '')
);

CREATE INDEX IF NOT EXISTS idx_proveido_publico
    ON sigd_tra.proveido (expediente_id) WHERE es_publico;

-- -----------------------------------------------------------------------------
-- 4. TRIGGERS DE INTEGRIDAD
-- -----------------------------------------------------------------------------

-- 4.1 Asignación automática del CUT cuando el INSERT lo omite.
CREATE OR REPLACE FUNCTION sigd_tra.fn_expediente_asignar_cut()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $trg$
BEGIN
    IF NEW.cut IS NULL THEN
        -- El correlativo sigue al ejercicio fiscal de la recepcion tecnica.
        NEW.cut := sigd_tra.fn_generar_cut(EXTRACT(YEAR FROM NEW.fecha_envio_real)::INT);
    END IF;
    RETURN NEW;
END;
$trg$;

DROP TRIGGER IF EXISTS trg_expediente_asignar_cut ON sigd_tra.expediente;
CREATE TRIGGER trg_expediente_asignar_cut
    BEFORE INSERT ON sigd_tra.expediente
    FOR EACH ROW
    EXECUTE FUNCTION sigd_tra.fn_expediente_asignar_cut();

-- 4.2 `fecha_envio_real` es metadato pericial: no admite corrección posterior
--     ni borrado físico, conforme a los artículos 153-156 del TUO de la Ley
--     N° 27444.
CREATE OR REPLACE FUNCTION sigd_tra.fn_expediente_envio_inmutable()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $trg$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'EXPEDIENTE_NO_ELIMINABLE: la radicacion solo se anula logicamente (estado_tramite = ''ANULADO'')'
            USING ERRCODE = '23001';
    END IF;
    IF NEW.fecha_envio_real IS DISTINCT FROM OLD.fecha_envio_real THEN
        RAISE EXCEPTION 'FECHA_ENVIO_INMUTABLE: fecha_envio_real es metadato pericial y no admite modificacion'
            USING ERRCODE = '23001',
                  HINT = 'Corrija la fecha_radicacion_legal mediante un acto resolutivo.';
    END IF;
    RETURN NEW;
END;
$trg$;

DROP TRIGGER IF EXISTS trg_expediente_no_delete ON sigd_tra.expediente;
CREATE TRIGGER trg_expediente_no_delete
    BEFORE DELETE ON sigd_tra.expediente
    FOR EACH ROW
    EXECUTE FUNCTION sigd_tra.fn_expediente_envio_inmutable();

DROP TRIGGER IF EXISTS trg_expediente_envio_inmutable ON sigd_tra.expediente;
CREATE TRIGGER trg_expediente_envio_inmutable
    BEFORE UPDATE ON sigd_tra.expediente
    FOR EACH ROW
    EXECUTE FUNCTION sigd_tra.fn_expediente_envio_inmutable();

-- 4.3 La radicación exige al menos un adjunto (T-BE-TC-02). Se valida al
--     confirmar la transacción para no bloquear el INSERT de la cabecera.
--
--     El trigger se registra sobre `expediente` y no sobre `documento_adjunto`:
--     si se disparara tras insertar un adjunto, la fila recien insertada ya
--     seria visible para la comprobacion y el control pasaria siempre, con lo
--     que un expediente sin archivos podria confirmarse en silencio. Al
--     dispararse desde la cabecera y diferirse hasta el COMMIT, se evalua
--     cuando el resto de los adjuntos ya estan escritos.
CREATE OR REPLACE FUNCTION sigd_tra.fn_expediente_exigir_adjunto()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $trg$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM sigd_tra.documento_adjunto
         WHERE expediente_id = NEW.expediente_id
    ) THEN
        RAISE EXCEPTION 'RADICACION_SIN_ARCHIVOS: el expediente % no tiene ningun documento adjunto'
            , NEW.expediente_id
            USING ERRCODE = '23514',
                  HINT = 'T-BE-TC-02: la radicacion exige al menos un archivo cargado.';
    END IF;
    RETURN NULL;
END;
$trg$;

DROP TRIGGER IF EXISTS trg_expediente_exigir_adjunto ON sigd_tra.documento_adjunto;
DROP TRIGGER IF EXISTS trg_expediente_exigir_adjunto ON sigd_tra.expediente;
CREATE CONSTRAINT TRIGGER trg_expediente_exigir_adjunto
    AFTER INSERT ON sigd_tra.expediente
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW
    EXECUTE FUNCTION sigd_tra.fn_expediente_exigir_adjunto();

-- -----------------------------------------------------------------------------
-- 5. PROVISIÓN DE SECUENCIA DEL EJERCICIO CORRIENTE
-- Deja el correlativo del año en curso listo para la primera radicación sin
-- depender del camino de autoaprovisionamiento. Es idempotente.
-- -----------------------------------------------------------------------------
DO $prov$
DECLARE
    v_anio     INT := EXTRACT(YEAR FROM now())::INT;
    v_secuencia TEXT := format('seq_cut_%s', EXTRACT(YEAR FROM now())::INT);
BEGIN
    INSERT INTO sigd_tra.cut_secuencia_anual (anio, nombre_secuencia)
    VALUES (v_anio, v_secuencia)
    ON CONFLICT (anio) DO NOTHING;

    EXECUTE format(
        'CREATE SEQUENCE IF NOT EXISTS sigd_tra.%I START WITH 1 INCREMENT BY 1 NO MAXVALUE CACHE 32',
        v_secuencia);
END;
$prov$;

-- -----------------------------------------------------------------------------
-- 6. VISTA DE AUDITORÍA DEL CORRELATIVO
--
-- `pg_sequences.last_value` NO es el correlativo emitido: con `CACHE 32` la
-- secuencia reserva 32 valores por bloque y `last_value` salta aunque esos
-- valores nunca se hayan repartido. La vista expone por separado ambas
-- magnitudes para que la conciliación no confunda una reserva con una emisión.
-- `ultimo_cut_emitido` se deriva del máximo real de `sigd_tra.expediente`.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW sigd_tra.vw_ultimo_cut_por_anio AS
SELECT r.anio,
       r.nombre_secuencia,
       s.last_value::BIGINT        AS correlativo_reservado,
       s.cache_size::BIGINT        AS cache_tamanio,
       COALESCE(em.maximo, 0)     AS correlativo_emitido,
       COALESCE('EXP-' || r.anio::TEXT || '-' || lpad(em.maximo::TEXT, 6, '0'), '')
                               AS ultimo_cut_emitido
  FROM sigd_tra.cut_secuencia_anual r
  JOIN pg_catalog.pg_sequences s
    ON s.schemaname = 'sigd_tra'
   AND s.sequencename = r.nombre_secuencia
  LEFT JOIN LATERAL (
       SELECT max(substring(e.cut FROM 11 FOR 6)::BIGINT) AS maximo
         FROM sigd_tra.expediente e
        WHERE e.anio_fiscal = r.anio
  ) em ON TRUE;

COMMENT ON VIEW sigd_tra.vw_ultimo_cut_por_anio IS
    'Corte del correlativo CUT por ejercicio fiscal. correlativo_reservado incluye la preasignacion de cache; correlativo_emitido es el maximo realmente radicado.';
