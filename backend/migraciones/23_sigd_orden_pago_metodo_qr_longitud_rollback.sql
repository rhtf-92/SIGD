-- Reversión segura solo cuando no existen métodos de más de 20 caracteres.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM sigd_tra.orden_pago WHERE length(metodo_pago) > 20) THEN
    RAISE EXCEPTION 'No se puede volver a VARCHAR(20): existen pagos QR automáticos confirmados.';
  END IF;
END $$;

ALTER TABLE sigd_tra.orden_pago
  ALTER COLUMN metodo_pago TYPE VARCHAR(20);
