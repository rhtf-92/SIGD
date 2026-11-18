-- =============================================================================
-- Migración 43: Workflow Configurable, Custodia Institucional, Asignación Individual y Observaciones Trazables
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
-- -----------------------------------------------------------------------------
-- Autor      : Geric (Fase 5G)
-- Dependencia: 42_sigd_tupa_proveniencia_y_homologacion_requisitos.sql
-- =============================================================================

-- 1. TABLA: sigd_rut.workflow_definicion
-- Catálogo de definiciones de flujo de trabajo configurable (desacoplado de categorías TUPA)
CREATE TABLE IF NOT EXISTS sigd_rut.workflow_definicion (
    id_workflow UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(50) NOT NULL UNIQUE,
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT,
    activo BOOLEAN NOT NULL DEFAULT true,
    proveniencia VARCHAR(30) NOT NULL DEFAULT 'NO_DETERMINADO',
    fuente_original TEXT NOT NULL DEFAULT 'NO_DETERMINADO',
    estado_homologacion VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE_HOMOLOGACION',
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_wf_def_proveniencia CHECK (
        proveniencia IN ('OFICIAL_SUIZA', 'DISEÑO_SIGD', 'NORMATIVA_MINEDU', 'NO_DETERMINADO')
    ),
    CONSTRAINT chk_wf_def_homologacion CHECK (
        estado_homologacion IN ('PENDIENTE_HOMOLOGACION', 'HOMOLOGADO', 'HISTORICO', 'ANULADO')
    )
);

CREATE INDEX IF NOT EXISTS idx_wf_def_codigo ON sigd_rut.workflow_definicion(codigo);
CREATE INDEX IF NOT EXISTS idx_wf_def_homologacion ON sigd_rut.workflow_definicion(estado_homologacion);

-- 2. TABLA: sigd_rut.workflow_version
-- Versiones inmutables de definición de flujo para salvaguardar expedientes históricos
CREATE TABLE IF NOT EXISTS sigd_rut.workflow_version (
    id_version UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_workflow UUID NOT NULL REFERENCES sigd_rut.workflow_definicion(id_workflow) ON DELETE RESTRICT,
    version VARCHAR(20) NOT NULL,
    codigo_completo VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    activo BOOLEAN NOT NULL DEFAULT false,
    proveniencia VARCHAR(30) NOT NULL DEFAULT 'NO_DETERMINADO',
    fuente_original TEXT NOT NULL DEFAULT 'NO_DETERMINADO',
    estado_homologacion VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE_HOMOLOGACION',
    pasos JSONB NOT NULL DEFAULT '[]'::jsonb,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_wf_version_num UNIQUE (id_workflow, version),
    CONSTRAINT chk_wf_ver_proveniencia CHECK (
        proveniencia IN ('OFICIAL_SUIZA', 'DISEÑO_SIGD', 'NORMATIVA_MINEDU', 'NO_DETERMINADO')
    ),
    CONSTRAINT chk_wf_ver_homologacion CHECK (
        estado_homologacion IN ('PENDIENTE_HOMOLOGACION', 'HOMOLOGADO', 'HISTORICO', 'ANULADO')
    )
);

CREATE INDEX IF NOT EXISTS idx_wf_version_wf ON sigd_rut.workflow_version(id_workflow);
CREATE INDEX IF NOT EXISTS idx_wf_version_codigo ON sigd_rut.workflow_version(codigo_completo);

-- 3. TABLA: sigd_rut.workflow_procedimiento_config
-- Asignación explícita de un workflow a un procedimiento TUPA (NUNCA inferido por categoría)
CREATE TABLE IF NOT EXISTS sigd_rut.workflow_procedimiento_config (
    id_config UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_procedimiento UUID NULL REFERENCES sigd_doc.tupa_procedimiento(id_procedimiento) ON DELETE RESTRICT,
    id_version_workflow UUID NOT NULL REFERENCES sigd_rut.workflow_version(id_version) ON DELETE RESTRICT,
    activo BOOLEAN NOT NULL DEFAULT true,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_wf_proc_config UNIQUE (id_procedimiento, id_version_workflow)
);

CREATE INDEX IF NOT EXISTS idx_wf_proc_config_proc ON sigd_rut.workflow_procedimiento_config(id_procedimiento);

-- 4. TABLA: sigd_rut.workflow_instancia
-- Instancia concreta y versionada ligada a un expediente
CREATE TABLE IF NOT EXISTS sigd_rut.workflow_instancia (
    id_instancia UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expediente_id UUID NOT NULL UNIQUE REFERENCES sigd_tra.expediente(expediente_id) ON DELETE RESTRICT,
    id_version_workflow UUID NOT NULL REFERENCES sigd_rut.workflow_version(id_version) ON DELETE RESTRICT,
    paso_actual INTEGER NOT NULL DEFAULT 1,
    total_pasos INTEGER NOT NULL DEFAULT 1,
    estado_instancia VARCHAR(30) NOT NULL DEFAULT 'EN_CURSO',
    historial_pasos JSONB NOT NULL DEFAULT '[]'::jsonb,
    iniciado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    finalizado_en TIMESTAMPTZ NULL,
    CONSTRAINT chk_wf_inst_estado CHECK (
        estado_instancia IN ('EN_CURSO', 'COMPLETADO', 'CANCELADO')
    )
);

CREATE INDEX IF NOT EXISTS idx_wf_inst_expediente ON sigd_rut.workflow_instancia(expediente_id);
CREATE INDEX IF NOT EXISTS idx_wf_inst_version ON sigd_rut.workflow_instancia(id_version_workflow);

-- 5. TABLA: sigd_rut.expediente_asignacion
-- Historial inmutable y control de asignación operativa individual a funcionarios
CREATE TABLE IF NOT EXISTS sigd_rut.expediente_asignacion (
    id_asignacion UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expediente_id UUID NOT NULL REFERENCES sigd_tra.expediente(expediente_id) ON DELETE RESTRICT,
    id_persona UUID NOT NULL REFERENCES sigd_auth.persona(id_persona) ON DELETE RESTRICT,
    id_usuario UUID NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
    id_area UUID NOT NULL REFERENCES sigd_org.area(area_id) ON DELETE RESTRICT,
    asignado_por UUID NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
    motivo TEXT NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT true,
    asignado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    desasignado_en TIMESTAMPTZ NULL,
    desasignado_por UUID NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
    motivo_desasignacion TEXT NULL
);

-- Solo puede existir una asignación activa a la vez por expediente
CREATE UNIQUE INDEX IF NOT EXISTS uq_expediente_asignacion_activa 
    ON sigd_rut.expediente_asignacion (expediente_id) 
 WHERE activo = true;

CREATE INDEX IF NOT EXISTS idx_exp_asig_expediente ON sigd_rut.expediente_asignacion(expediente_id);
CREATE INDEX IF NOT EXISTS idx_exp_asig_usuario ON sigd_rut.expediente_asignacion(id_usuario);
CREATE INDEX IF NOT EXISTS idx_exp_asig_area ON sigd_rut.expediente_asignacion(id_area);
CREATE INDEX IF NOT EXISTS idx_exp_asig_activo ON sigd_rut.expediente_asignacion(activo);

-- 6. TABLA: sigd_rut.expediente_observacion
-- Observaciones estructuradas con trazabilidad de requisitos afectados y ciclos repetibles
CREATE TABLE IF NOT EXISTS sigd_rut.expediente_observacion (
    id_observacion UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expediente_id UUID NOT NULL REFERENCES sigd_tra.expediente(expediente_id) ON DELETE RESTRICT,
    numero_observacion INTEGER NOT NULL,
    estado_observacion VARCHAR(30) NOT NULL DEFAULT 'OBSERVADO',
    estado_anterior_expediente VARCHAR(50) NOT NULL,
    motivo TEXT NOT NULL,
    observado_por_persona_id UUID NOT NULL REFERENCES sigd_auth.persona(id_persona) ON DELETE RESTRICT,
    observado_por_usuario_id UUID NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
    area_observacion_id UUID NOT NULL REFERENCES sigd_org.area(area_id) ON DELETE RESTRICT,
    id_movimiento_observacion UUID NULL,
    requisitos_afectados JSONB NOT NULL DEFAULT '[]'::jsonb,
    subsanado_en TIMESTAMPTZ NULL,
    subsanado_por_persona_id UUID NULL REFERENCES sigd_auth.persona(id_persona) ON DELETE RESTRICT,
    subsanado_por_usuario_id UUID NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
    motivo_subsanacion TEXT NULL,
    id_movimiento_subsanacion UUID NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_expediente_num_observacion UNIQUE (expediente_id, numero_observacion),
    CONSTRAINT chk_exp_obs_estado CHECK (
        estado_observacion IN ('OBSERVADO', 'SUBSANADO', 'REVISADO', 'ANULADO')
    )
);

CREATE INDEX IF NOT EXISTS idx_exp_obs_expediente ON sigd_rut.expediente_observacion(expediente_id);
CREATE INDEX IF NOT EXISTS idx_exp_obs_estado ON sigd_rut.expediente_observacion(estado_observacion);

-- 7. EXTENSIÓN ADITIVA: sigd_rut.estado_actual_expediente
ALTER TABLE sigd_rut.estado_actual_expediente
    ADD COLUMN IF NOT EXISTS persona_asignada_id UUID NULL REFERENCES sigd_auth.persona(id_persona) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS usuario_asignado_id UUID NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS id_version_workflow UUID NULL REFERENCES sigd_rut.workflow_version(id_version) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_estado_actual_persona_asig ON sigd_rut.estado_actual_expediente(persona_asignada_id);
CREATE INDEX IF NOT EXISTS idx_estado_actual_usuario_asig ON sigd_rut.estado_actual_expediente(usuario_asignado_id);

-- 8. REFINAMIENTO DE TRIGGER: sigd_rut.actualizar_estado_actual_expediente()
-- Preserva custodia de área cuando datos->>'areaId' es null y actualiza asignación operativa
CREATE OR REPLACE FUNCTION sigd_rut.actualizar_estado_actual_expediente()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'sigd_rut'
AS $function$
DECLARE
    v_nueva_area TEXT;
    v_nuevo_usuario_asig UUID;
    v_nueva_persona_asig UUID;
BEGIN
    v_nueva_area := NEW.datos->>'areaId';
    
    -- Extraer usuario y persona asignada si se incluyeron en el movimiento
    IF (NEW.datos ? 'usuario_asignado_id') AND (NEW.datos->>'usuario_asignado_id') IS NOT NULL THEN
        BEGIN
            v_nuevo_usuario_asig := (NEW.datos->>'usuario_asignado_id')::uuid;
        EXCEPTION WHEN OTHERS THEN
            v_nuevo_usuario_asig := NULL;
        END;
    END IF;

    IF (NEW.datos ? 'persona_asignada_id') AND (NEW.datos->>'persona_asignada_id') IS NOT NULL THEN
        BEGIN
            v_nueva_persona_asig := (NEW.datos->>'persona_asignada_id')::uuid;
        EXCEPTION WHEN OTHERS THEN
            v_nueva_persona_asig := NULL;
        END;
    END IF;

    INSERT INTO sigd_rut.estado_actual_expediente
        (expediente_id, secuencia, estado_nuevo, evento, area_actual_id,
         id_movimiento, fecha_hora, usuario_operador_id,
         persona_asignada_id, usuario_asignado_id)
    VALUES (NEW.expediente_id, NEW.secuencia, NEW.estado_nuevo, NEW.evento,
            v_nueva_area, NEW.id_movimiento, NEW.fecha_hora,
            NEW.usuario_operador_id,
            v_nueva_persona_asig, v_nuevo_usuario_asig)
    ON CONFLICT (expediente_id) DO UPDATE SET
        secuencia = EXCLUDED.secuencia,
        estado_nuevo = EXCLUDED.estado_nuevo,
        evento = EXCLUDED.evento,
        area_actual_id = COALESCE(EXCLUDED.area_actual_id, sigd_rut.estado_actual_expediente.area_actual_id),
        id_movimiento = EXCLUDED.id_movimiento,
        fecha_hora = EXCLUDED.fecha_hora,
        usuario_operador_id = EXCLUDED.usuario_operador_id,
        persona_asignada_id = COALESCE(EXCLUDED.persona_asignada_id, sigd_rut.estado_actual_expediente.persona_asignada_id),
        usuario_asignado_id = COALESCE(EXCLUDED.usuario_asignado_id, sigd_rut.estado_actual_expediente.usuario_asignado_id)
    WHERE sigd_rut.estado_actual_expediente.secuencia < EXCLUDED.secuencia;
    RETURN NULL;
END;
$function$;
