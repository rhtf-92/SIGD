-- Migración correctiva idempotente: asegurar refresh_token como TEXT.
-- El runner aplica este archivo dentro de su transacción DDL.
DO $$
DECLARE
  v_type text;
BEGIN
  SELECT data_type INTO v_type
    FROM information_schema.columns
   WHERE table_schema = 'sigd_auth'
     AND table_name = 'sesion_usuario'
     AND column_name = 'refresh_token';

  IF v_type IS NOT NULL AND v_type <> 'text' THEN
    ALTER TABLE sigd_auth.sesion_usuario
      ALTER COLUMN refresh_token TYPE TEXT;
  END IF;
END $$ LANGUAGE plpgsql;
