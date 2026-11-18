-- Una orden pendiente o confirmada por expediente. Las vencidas y rechazadas
-- permanecen como historial y permiten una reemisión controlada.
CREATE UNIQUE INDEX IF NOT EXISTS uq_tra_orden_pago_activa_expediente
  ON sigd_tra.orden_pago (expediente_id)
  WHERE estado IN ('PENDIENTE', 'CONFIRMADO');
