-- =============================================================================
-- 12_cuenta_usuario_eliminado.sql
-- =============================================================================
-- `sigd_auth.cuenta_usuario` no tenia columna de baja logica, pero
-- `usuariosAdmin.service.ts` filtra el directorio por `cu.eliminado = FALSE` y
-- la baja definitiva marca `eliminado = TRUE`. Sin esta columna, GET
-- /api/v1/usuarios fallaba con `column cu.eliminado does not exist` (500).
--
-- Se agrega con DEFAULT FALSE para que las cuentas existentes sigan visibles y
-- la baja logica sea compatible hacia atras. El borrado fisico no se usa: las
-- cuentas referenciadas por expedientes y auditoria deben conservarse.
-- =============================================================================

ALTER TABLE sigd_auth.cuenta_usuario
    ADD COLUMN IF NOT EXISTS eliminado BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_cuenta_usuario_eliminado
    ON sigd_auth.cuenta_usuario (eliminado);
