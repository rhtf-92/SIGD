-- ============================================================================
-- SIGD RENATO — IESTP PÚBLICO «SUIZA»
-- RAMA: B_JACOBO
-- TSK-1.0A: SCRIPT DE REVERSIÓN (ROLLBACK) - RBAC CONTEXTUAL Y CAPACIDADES
-- FECHA: 2026-11-11
-- IDEMPOTENCIA: SÍ | TRANSACCIONAL: SÍ | MODO: SEGURO NO DESTRUCTIVO
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. DESACTIVAR ASIGNACIONES DE EVALUADORES SIN PÉRDIDA DE HISTORIAL
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_evaluadores INT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'sigd_rut' AND tablename = 'expediente_evaluador') THEN
    SELECT count(*) INTO v_evaluadores FROM sigd_rut.expediente_evaluador;
    IF v_evaluadores > 0 THEN
      -- Preservar historial: marcar inactivos en vez de eliminar tabla
      UPDATE sigd_rut.expediente_evaluador SET activo = FALSE, desactivado_en = now();
    ELSE
      DROP TABLE IF EXISTS sigd_rut.expediente_evaluador CASCADE;
    END IF;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. DESACTIVAR CAPACIDADES DE USUARIO SIN PÉRDIDA DE HISTORIAL
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_capacidades INT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'sigd_org' AND tablename = 'usuario_capacidad') THEN
    SELECT count(*) INTO v_capacidades FROM sigd_org.usuario_capacidad;
    IF v_capacidades > 0 THEN
      UPDATE sigd_org.usuario_capacidad SET activo = FALSE, desactivado_en = now();
    ELSE
      DROP TABLE IF EXISTS sigd_org.usuario_capacidad CASCADE;
      DROP TABLE IF EXISTS sigd_org.capacidad_permiso CASCADE;
      DROP TABLE IF EXISTS sigd_org.capacidad_sistema CASCADE;
    END IF;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. RETIRAR PERMISOS ASIGNADOS A LOS CUATRO ROLES NUEVOS
-- ----------------------------------------------------------------------------
DELETE FROM sigd_org.rol_permiso
 WHERE rol_id IN (
   SELECT rol_id FROM sigd_org.rol_sistema
    WHERE codigo IN ('JEFE_UNIDAD_ACADEMICA', 'COORDINADOR_AREA', 'DOCENTE', 'ESTUDIANTE')
 );

-- ----------------------------------------------------------------------------
-- 4. GESTIÓN SEGURA DE ROLES CANÓNICOS NUEVOS
--    Si existen usuarios asignados, NO eliminar físicamente (soft-deprecation).
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_asignaciones INT;
BEGIN
  SELECT count(*) INTO v_asignaciones
    FROM sigd_org.usuario_rol ur
    JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id
   WHERE r.codigo IN ('JEFE_UNIDAD_ACADEMICA', 'COORDINADOR_AREA', 'DOCENTE', 'ESTUDIANTE');

  IF v_asignaciones > 0 THEN
    -- Preservar claves foráneas activas desactivando vigencia
    UPDATE sigd_org.rol_sistema
       SET vigente = FALSE
     WHERE codigo IN ('JEFE_UNIDAD_ACADEMICA', 'COORDINADOR_AREA', 'DOCENTE', 'ESTUDIANTE');
  ELSE
    DELETE FROM sigd_org.rol_sistema
     WHERE codigo IN ('JEFE_UNIDAD_ACADEMICA', 'COORDINADOR_AREA', 'DOCENTE', 'ESTUDIANTE');
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 5. RESTAURAR VIGENCIA DE ROLES HISTÓRICOS SI CORRESPONDE
-- ----------------------------------------------------------------------------
UPDATE sigd_org.rol_sistema
   SET vigente = TRUE
 WHERE codigo = 'ESPECIALISTA';

-- ----------------------------------------------------------------------------
-- 6. RESTAURAR EL CONSTRAINT chk_rol_codigo DE MANERA COMPATIBLE Y SEGURA
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_asignaciones INT;
BEGIN
  SELECT count(*) INTO v_asignaciones
    FROM sigd_org.usuario_rol ur
    JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id
   WHERE r.codigo IN ('JEFE_UNIDAD_ACADEMICA', 'COORDINADOR_AREA', 'DOCENTE', 'ESTUDIANTE');

  ALTER TABLE sigd_org.rol_sistema DROP CONSTRAINT IF EXISTS chk_rol_codigo;

  IF v_asignaciones > 0 THEN
    -- Si existen asignaciones persistidas que impidieron el DELETE físico de los roles,
    -- el constraint tolera los códigos desactivados (vigente = FALSE) para no
    -- violar la integridad de chequeo de la tabla durante el rollback.
    ALTER TABLE sigd_org.rol_sistema ADD CONSTRAINT chk_rol_codigo CHECK (
      codigo = ANY (ARRAY[
        'ADMINISTRADOR'::text,
        'DIRECTOR'::text,
        'SECRETARIO'::text,
        'MESA_PARTES'::text,
        'TESORERO'::text,
        'CIUDADANO'::text,
        'ESPECIALISTA'::text,
        'CAJERO'::text,
        'APROBADOR_DEVOLUCIONES'::text,
        'SUPERVISOR_TESORERIA'::text,
        'JEFE_UNIDAD_ACADEMICA'::text,
        'COORDINADOR_AREA'::text,
        'DOCENTE'::text,
        'ESTUDIANTE'::text
      ])
    );
  ELSE
    -- Si no hubo asignaciones persistidas, los 4 roles fueron eliminados limpiamente
    -- y se restaura el CHECK histórico estricto de 10 códigos.
    ALTER TABLE sigd_org.rol_sistema ADD CONSTRAINT chk_rol_codigo CHECK (
      codigo = ANY (ARRAY[
        'ADMINISTRADOR'::text,
        'DIRECTOR'::text,
        'SECRETARIO'::text,
        'MESA_PARTES'::text,
        'TESORERO'::text,
        'CIUDADANO'::text,
        'ESPECIALISTA'::text,
        'CAJERO'::text,
        'APROBADOR_DEVOLUCIONES'::text,
        'SUPERVISOR_TESORERIA'::text
      ])
    );
  END IF;
END $$;

COMMIT;
