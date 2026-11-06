-- El refresh token JWT puede superar 255 caracteres.
-- Se amplía el tipo conservando los valores y la restricción UNIQUE existentes.
-- La transacción y el registro del ledger los controla el runner oficial.
ALTER TABLE sigd_auth.sesion_usuario
    ALTER COLUMN refresh_token TYPE TEXT;
