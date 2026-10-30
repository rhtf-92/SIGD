-- =============================================================================
-- Rollback 20 · Módulo Tesorería, Órdenes de Pago, Recaudación y Desbloqueo FSM
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza" (Pucallpa, Ucayali)
-- =============================================================================

DROP TABLE IF EXISTS sigd_tra.orden_pago CASCADE;
DROP SEQUENCE IF EXISTS sigd_tra.seq_orden_pago_correlativo;
DROP SEQUENCE IF EXISTS sigd_tra.seq_recibo_pago_correlativo;
DELETE FROM sigd_org.rol_sistema WHERE codigo = 'TESORERIA';

ALTER TABLE sigd_org.rol_sistema
    DROP CONSTRAINT IF EXISTS chk_rol_codigo;

ALTER TABLE sigd_org.rol_sistema
    ADD CONSTRAINT chk_rol_codigo CHECK (codigo IN (
        'ADMINISTRADOR', 'DIRECTOR', 'SECRETARIO', 'ESPECIALISTA', 'MESA_PARTES', 'CIUDADANO'
    ));
