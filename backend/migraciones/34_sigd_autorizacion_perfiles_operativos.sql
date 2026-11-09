-- =============================================================================
-- Migración 34 · Esquema sigd_org · Perfiles Operativos y Autorización Contextual (Fase 5D)
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
-- -----------------------------------------------------------------------------
-- Autor     : Geric (B_GERIC)
-- Marco     : Modelo Canónico de Autorización Contextual, Scopes y Segregación SIGD 2026
-- Depende de: 03_sigd_org.sql, 31_sigd_vinculos_institucionales.sql, 33_sigd_organizacion_responsabilidades.sql
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 34.1 Ampliación del catálogo maestro de permisos funcionales
-- -----------------------------------------------------------------------------
INSERT INTO sigd_org.permiso_sistema (codigo, nombre, ambito)
VALUES
    ('ORGANIZACION_GESTIONAR', 'Gestionar estructura orgánica, cargos y asignaciones', 'GLOBAL'),
    ('CUENTA_GESTIONAR', 'Gestionar cuentas de usuario y perfiles operativos', 'GLOBAL'),
    ('EXPEDIENTE_VER', 'Visualizar expedientes y documentos según alcance', 'AREA'),
    ('EXPEDIENTE_RECIBIR', 'Recepcionar documentos y expedientes', 'AREA'),
    ('EXPEDIENTE_OBSERVAR', 'Observar expedientes y requerir subsanación', 'AREA'),
    ('EXPEDIENTE_ATENDER', 'Emitir dictamen o atención de expediente', 'AREA'),
    ('EXPEDIENTE_ARCHIVAR', 'Archivar expedientes física y digitalmente', 'GLOBAL'),
    ('DEVOLUCION_REVISAR', 'Revisar solicitudes de devolución', 'GLOBAL'),
    ('DEVOLUCION_AUTORIZAR', 'Autorizar documentalmente solicitudes de devolución', 'GLOBAL'),
    ('DEVOLUCION_EJECUTAR', 'Ejecutar financieramente desembolsos de devolución', 'GLOBAL'),
    ('PAGO_VER', 'Visualizar pagos y comprobantes arancelarios', 'GLOBAL'),
    ('PAGO_REGISTRAR', 'Emitir orden de pago o registrar cobranza', 'GLOBAL')
ON CONFLICT (codigo) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 34.2 Catálogo extensible de perfiles operativos funcionales (DISEÑO_SIGD)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_org.perfil_operativo (
    perfil_id         SMALLINT GENERATED ALWAYS AS IDENTITY
                      CONSTRAINT pk_perfil_operativo PRIMARY KEY,
    codigo            VARCHAR(50)  NOT NULL UNIQUE,
    nombre            VARCHAR(120) NOT NULL,
    descripcion       TEXT         NULL,
    vigente           BOOLEAN      NOT NULL DEFAULT TRUE,
    creado_en         TIMESTAMPTZ  NOT NULL DEFAULT now()
);

COMMENT ON TABLE sigd_org.perfil_operativo IS
    'Catálogo extensible de perfiles operativos funcionales (DISEÑO_SIGD) diferenciados de cargos y vínculos.';

-- Semillas iniciales de perfiles operativos canónicos (DISEÑO_SIGD)
INSERT INTO sigd_org.perfil_operativo (codigo, nombre, descripcion)
VALUES
    ('ADMINISTRADOR_SIGD', 'Administrador SIGD', 'Gestión técnica de infraestructura, cuentas y configuraciones del sistema sin autoridad sustantiva de negocio'),
    ('APROBADOR_DIRECCION', 'Aprobador Dirección General', 'Titular o encargado con facultad institucional de resolución y suscripción de actos'),
    ('GESTOR_RECEPCION_DOCUMENTAL', 'Gestor de Recepción Documental', 'Mesa de partes: recepción física/virtual, control documental e ingreso'),
    ('GESTOR_AREA_ACADEMICA', 'Gestor de Área Académica', 'Coordinación o especialista con competencia de gestión de expedientes en su área'),
    ('GESTOR_ADMINISTRATIVO', 'Gestor Administrativo', 'Personal administrativo de soporte y gestión de trámites institucionales'),
    ('GESTOR_TESORERIA', 'Gestor de Tesorería', 'Control financiero, confirmación de recaudación y desembolso de devoluciones')
ON CONFLICT (codigo) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 34.3 Matriz de permisos por perfil operativo
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_org.perfil_permiso (
    perfil_id   SMALLINT NOT NULL REFERENCES sigd_org.perfil_operativo (perfil_id) ON DELETE CASCADE,
    permiso_id  UUID     NOT NULL REFERENCES sigd_org.permiso_sistema (permiso_id) ON DELETE CASCADE,
    CONSTRAINT pk_perfil_permiso PRIMARY KEY (perfil_id, permiso_id)
);

COMMENT ON TABLE sigd_org.perfil_permiso IS
    'Matriz relacional N:M de permisos mínimos asignados por perfil operativo.';

CREATE INDEX IF NOT EXISTS idx_perfil_permiso_permiso
    ON sigd_org.perfil_permiso (permiso_id);

-- Semilla de asignación perfil-permiso
DO $$
DECLARE
    v_admin_id      SMALLINT;
    v_dir_id        SMALLINT;
    v_mesa_id       SMALLINT;
    v_acad_id       SMALLINT;
    v_adm_id        SMALLINT;
    v_teso_id       SMALLINT;
BEGIN
    SELECT perfil_id INTO v_admin_id FROM sigd_org.perfil_operativo WHERE codigo = 'ADMINISTRADOR_SIGD';
    SELECT perfil_id INTO v_dir_id   FROM sigd_org.perfil_operativo WHERE codigo = 'APROBADOR_DIRECCION';
    SELECT perfil_id INTO v_mesa_id  FROM sigd_org.perfil_operativo WHERE codigo = 'GESTOR_RECEPCION_DOCUMENTAL';
    SELECT perfil_id INTO v_acad_id  FROM sigd_org.perfil_operativo WHERE codigo = 'GESTOR_AREA_ACADEMICA';
    SELECT perfil_id INTO v_adm_id   FROM sigd_org.perfil_operativo WHERE codigo = 'GESTOR_ADMINISTRATIVO';
    SELECT perfil_id INTO v_teso_id  FROM sigd_org.perfil_operativo WHERE codigo = 'GESTOR_TESORERIA';

    -- ADMINISTRADOR_SIGD: Poder técnico, no autoridad de negocio
    INSERT INTO sigd_org.perfil_permiso (perfil_id, permiso_id)
    SELECT v_admin_id, permiso_id FROM sigd_org.permiso_sistema
    WHERE codigo IN ('ORGANIZACION_GESTIONAR', 'CUENTA_GESTIONAR', 'ADMIN_USUARIOS', 'REPORTE_LEER')
    ON CONFLICT DO NOTHING;

    -- APROBADOR_DIRECCION: Aprobación institucional y resoluciones
    INSERT INTO sigd_org.perfil_permiso (perfil_id, permiso_id)
    SELECT v_dir_id, permiso_id FROM sigd_org.permiso_sistema
    WHERE codigo IN ('EXPEDIENTE_VER', 'EXPEDIENTE_DERIVAR', 'EXPEDIENTE_RESOLVER', 'FIRMA_FIRMAR', 'REPORTE_LEER')
    ON CONFLICT DO NOTHING;

    -- GESTOR_RECEPCION_DOCUMENTAL: Recepción, calificación inicial y devolución preliminar
    INSERT INTO sigd_org.perfil_permiso (perfil_id, permiso_id)
    SELECT v_mesa_id, permiso_id FROM sigd_org.permiso_sistema
    WHERE codigo IN ('EXPEDIENTE_VER', 'EXPEDIENTE_RECIBIR', 'EXPEDIENTE_DERIVAR', 'EXPEDIENTE_OBSERVAR', 'DEVOLUCION_REVISAR', 'DEVOLUCION_AUTORIZAR', 'PAGO_REGISTRAR')
    ON CONFLICT DO NOTHING;

    -- GESTOR_AREA_ACADEMICA: Operación de expedientes del área
    INSERT INTO sigd_org.perfil_permiso (perfil_id, permiso_id)
    SELECT v_acad_id, permiso_id FROM sigd_org.permiso_sistema
    WHERE codigo IN ('EXPEDIENTE_VER', 'EXPEDIENTE_RECIBIR', 'EXPEDIENTE_DERIVAR', 'EXPEDIENTE_OBSERVAR', 'EXPEDIENTE_ATENDER')
    ON CONFLICT DO NOTHING;

    -- GESTOR_ADMINISTRATIVO: Archivo y apoyo de trámite
    INSERT INTO sigd_org.perfil_permiso (perfil_id, permiso_id)
    SELECT v_adm_id, permiso_id FROM sigd_org.permiso_sistema
    WHERE codigo IN ('EXPEDIENTE_VER', 'EXPEDIENTE_RECIBIR', 'EXPEDIENTE_DERIVAR', 'EXPEDIENTE_ARCHIVAR')
    ON CONFLICT DO NOTHING;

    -- GESTOR_TESORERIA: Cobros, consulta arancelaria y ejecución de devoluciones
    INSERT INTO sigd_org.perfil_permiso (perfil_id, permiso_id)
    SELECT v_teso_id, permiso_id FROM sigd_org.permiso_sistema
    WHERE codigo IN ('PAGO_VER', 'PAGO_REGISTRAR', 'DEVOLUCION_REVISAR', 'DEVOLUCION_EJECUTAR', 'REPORTE_LEER')
    ON CONFLICT DO NOTHING;
END $$;

-- -----------------------------------------------------------------------------
-- 34.4 Padrón histórico de asignación de perfiles operativos a cuentas
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_org.asignacion_perfil_operativo (
    id_asignacion_perfil        UUID         NOT NULL DEFAULT gen_random_uuid()
                                             CONSTRAINT pk_asignacion_perfil PRIMARY KEY,
    id_usuario                  UUID         NOT NULL
                                             REFERENCES sigd_auth.cuenta_usuario (id_usuario) ON DELETE RESTRICT,
    perfil_id                   SMALLINT     NOT NULL
                                             REFERENCES sigd_org.perfil_operativo (perfil_id) ON DELETE RESTRICT,
    area_id                     UUID         NULL
                                             REFERENCES sigd_org.area (area_id) ON DELETE RESTRICT,
    scope                       VARCHAR(30)  NOT NULL DEFAULT 'AREA',
    id_responsabilidad          UUID         NULL
                                             REFERENCES sigd_org.responsabilidad_temporal (id_responsabilidad) ON DELETE SET NULL,
    estado                      VARCHAR(20)  NOT NULL DEFAULT 'ACTIVO',
    vigente_desde               TIMESTAMPTZ  NOT NULL DEFAULT now(),
    vigente_hasta               TIMESTAMPTZ  NULL,
    tipo_documento_sustento     VARCHAR(50)  NULL,
    numero_documento_sustento   VARCHAR(100) NULL,
    fecha_documento_sustento    DATE         NULL,
    alcance                     JSONB        NULL,
    motivo_finalizacion         VARCHAR(255) NULL,
    motivo_revocacion           VARCHAR(255) NULL,
    motivo_anulacion            VARCHAR(255) NULL,
    anulado_en                  TIMESTAMPTZ  NULL,
    anulado_por                 UUID         NULL
                                             REFERENCES sigd_auth.cuenta_usuario (id_usuario) ON DELETE SET NULL,
    creado_en                   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    actualizado_en              TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_asig_perfil_scope CHECK (scope IN ('PROPIO', 'EXPEDIENTE_ASIGNADO', 'AREA', 'SUBARBOL', 'INSTITUCIONAL', 'GLOBAL_TECNICO')),
    CONSTRAINT chk_asig_perfil_estado CHECK (estado IN ('ACTIVO', 'FINALIZADO', 'REVOCADO', 'ANULADO')),
    CONSTRAINT chk_asig_perfil_vigencia CHECK (vigente_hasta IS NULL OR vigente_hasta > vigente_desde),
    CONSTRAINT chk_asig_perfil_anulacion CHECK (estado <> 'ANULADO' OR (anulado_en IS NOT NULL AND motivo_anulacion IS NOT NULL))
);

COMMENT ON TABLE sigd_org.asignacion_perfil_operativo IS
    'Padrón histórico, auditable e inmutable de asignaciones de perfiles operativos a cuentas de usuario.';

-- -----------------------------------------------------------------------------
-- 34.5 Índices B-Tree para optimización de llaves foráneas y consultas operativas
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_asig_perfil_usuario
    ON sigd_org.asignacion_perfil_operativo (id_usuario);

CREATE INDEX IF NOT EXISTS idx_asig_perfil_perfil
    ON sigd_org.asignacion_perfil_operativo (perfil_id);

CREATE INDEX IF NOT EXISTS idx_asig_perfil_area
    ON sigd_org.asignacion_perfil_operativo (area_id)
    WHERE area_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_asig_perfil_responsabilidad
    ON sigd_org.asignacion_perfil_operativo (id_responsabilidad)
    WHERE id_responsabilidad IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_asig_perfil_anulado_por
    ON sigd_org.asignacion_perfil_operativo (anulado_por)
    WHERE anulado_por IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_asig_perfil_consulta
    ON sigd_org.asignacion_perfil_operativo (id_usuario, perfil_id, estado, vigente_desde, vigente_hasta);

COMMIT;
