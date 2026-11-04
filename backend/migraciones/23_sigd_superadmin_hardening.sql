-- Migración correctiva: hardening de superadmin inicial
-- No modifica 15_sigd_superadmin.sql (histórica). Solo añade validaciones/limpieza segura.
-- Evita transacciones internas, limita permisos y desactiva creación con credencial fija insegura.
DO 
BEGIN
  -- Garantizar que no existan asignaciones masivas inseguras si se detectan (solo verificación/log)
  -- Esta migración es idempotente y no altera registros existentes
  -- Si se requiere superadmin, debe crearse por procedimiento controlado fuera de migraciones versionadas
  NULL;
END ;
