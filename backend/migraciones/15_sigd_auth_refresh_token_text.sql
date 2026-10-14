-- SIGD - Compatibilidad de sesiones JWT multirrol
-- Los refresh tokens firmados incluyen perfil activo, roles autorizados y JTI,
-- por lo que pueden superar el límite histórico de VARCHAR(255).

BEGIN;

ALTER TABLE sigd_auth.sesion_usuario
    ALTER COLUMN refresh_token TYPE TEXT;

COMMIT;
