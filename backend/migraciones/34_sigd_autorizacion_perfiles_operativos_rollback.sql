-- =============================================================================
-- Rollback de Migración 34 · Esquema sigd_org (Fase 5D)
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
-- -----------------------------------------------------------------------------
-- Autor     : Geric (B_GERIC)
-- Marco     : Reversión controlada e idempotente de la migración 34
-- =============================================================================

BEGIN;

-- 1. Eliminar índices y tabla de asignaciones de perfil operativo
DROP TABLE IF EXISTS sigd_org.asignacion_perfil_operativo CASCADE;

-- 2. Eliminar matriz relacional perfil-permiso
DROP TABLE IF EXISTS sigd_org.perfil_permiso CASCADE;

-- 3. Eliminar catálogo de perfiles operativos
DROP TABLE IF EXISTS sigd_org.perfil_operativo CASCADE;

-- 4. Revertir permisos incorporados específicamente en la migración 34
DELETE FROM sigd_org.permiso_sistema WHERE codigo IN (
    'ORGANIZACION_GESTIONAR',
    'CUENTA_GESTIONAR',
    'EXPEDIENTE_VER',
    'EXPEDIENTE_RECIBIR',
    'EXPEDIENTE_OBSERVAR',
    'EXPEDIENTE_ATENDER',
    'EXPEDIENTE_ARCHIVAR',
    'DEVOLUCION_REVISAR',
    'DEVOLUCION_AUTORIZAR',
    'DEVOLUCION_EJECUTAR',
    'PAGO_VER',
    'PAGO_REGISTRAR'
);

COMMIT;
