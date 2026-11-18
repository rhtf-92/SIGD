-- ==============================================================================
-- ROLLBACK MIGRACIÓN 50: Circuitos Operativos y Configuración de Workflows TUPA
-- ==============================================================================

BEGIN;

-- 1. Eliminar mapeos de procedimientos para los workflows canónicos
DELETE FROM sigd_rut.workflow_procedimiento_config
 WHERE id_version_workflow IN (
    'f0000001-0000-0000-0000-000000000001'::uuid,
    'f0000001-0000-0000-0000-000000000002'::uuid,
    'f0000001-0000-0000-0000-000000000003'::uuid
 );

-- 2. Eliminar versiones de workflow canónicas
DELETE FROM sigd_rut.workflow_version
 WHERE id_version IN (
    'f0000001-0000-0000-0000-000000000001'::uuid,
    'f0000001-0000-0000-0000-000000000002'::uuid,
    'f0000001-0000-0000-0000-000000000003'::uuid
 );

-- 3. Eliminar definiciones de workflow canónicas
DELETE FROM sigd_rut.workflow_definicion
 WHERE id_workflow IN (
    'e0000001-0000-0000-0000-000000000001'::uuid,
    'e0000001-0000-0000-0000-000000000002'::uuid,
    'e0000001-0000-0000-0000-000000000003'::uuid
 );

COMMIT;
