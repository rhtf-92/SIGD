-- El valor QR_AUTOMATICO_SANDBOX (21 caracteres), admitido por la migración 22,
-- no cabe en el VARCHAR(20) heredado de la migración 20.
ALTER TABLE sigd_tra.orden_pago
  ALTER COLUMN metodo_pago TYPE VARCHAR(32);
