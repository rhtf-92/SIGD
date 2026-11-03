-- Migración 16 · Longitud de tokens de refresco
-- Los JWT de refresco completos pueden superar los 255 caracteres.

ALTER TABLE sigd_auth.sesion_usuario
    ALTER COLUMN refresh_token TYPE TEXT;
