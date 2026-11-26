-- Versión 13 autorizada exclusivamente para sigd_jacobo_demo.
-- El directorio pendientes no pertenece al conjunto de migraciones activas.
-- Aditiva: no altera órdenes, correlativos, pagos o cuentas existentes.
-- La transacción es responsabilidad del runner institucional ejecutarMigraciones.
SET LOCAL lock_timeout='5s';
DO $$ BEGIN
 IF current_database()<>'sigd_jacobo_demo' OR (current_user<>'sigd_jacobo_user' AND current_user<>'postgres') THEN
  RAISE EXCEPTION 'Esta propuesta solo puede aplicarse en la base demo autorizada';
 END IF;
END $$;
ALTER TABLE sigd_tes.orden_pago ALTER COLUMN ciudadano_id DROP NOT NULL;
ALTER TABLE sigd_tes.orden_pago ADD COLUMN sesion_publica_hash char(64);
ALTER TABLE sigd_tes.orden_pago ADD COLUMN solicitante_declarado jsonb;
ALTER TABLE sigd_tes.orden_pago ADD CONSTRAINT orden_titular_o_capacidad CHECK(
 (ciudadano_id IS NOT NULL AND sesion_publica_hash IS NULL AND solicitante_declarado IS NULL)
 OR (ciudadano_id IS NULL AND sesion_publica_hash IS NOT NULL AND sesion_publica_hash ~ '^[0-9a-f]{64}$'
 AND solicitante_declarado IS NOT NULL AND jsonb_typeof(solicitante_declarado)='object'));
CREATE UNIQUE INDEX orden_publica_idempotencia ON sigd_tes.orden_pago(sesion_publica_hash,clave_solicitud) WHERE sesion_publica_hash IS NOT NULL;
-- No se crea cuenta genérica ni se convierte la capacidad pública en verificación de identidad.
-- El secreto aleatorio nunca se almacena: únicamente SHA-256. La sesión y antiabuso
-- permanecen en Redis. M3 conserva la persona y la declaración original.
-- Reversión operativa: deshabilitar la capacidad nueva, conservar hechos y columnas.
-- Reversión física: prohibida si existen órdenes públicas; no borrar hechos para revertir.
