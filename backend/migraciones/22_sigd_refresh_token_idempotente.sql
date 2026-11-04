-- Migración correctiva idempotente: asegurar refresh_token como TEXT
-- No modifica migraciones históricas. Seguro para ejecuciones repetidas.
-- Cubre duplicados 15_sigd_auth_refresh_token_text.sql y 16_sigd_refresh_token_text.sql
DO 
DECLARE
  v_type text;
BEGIN
  SELECT data_type INTO v_type
  FROM information_schema.columns
  WHERE table_schema = 'sigd_auth'
    AND table_name   = 'sesion_usuario'
    AND column_name  = 'refresh_token';

  IF v_type IS DISTINCT FROM 'text' THEN
    ALTER TABLE sigd_auth.sesion_usuario
      ALTER COLUMN refresh_token TYPE TEXT;
  END IF;
END ;
