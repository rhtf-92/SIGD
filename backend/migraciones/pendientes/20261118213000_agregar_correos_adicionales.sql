-- Migración para soportar múltiples correos por cuenta
-- Autor: SIGD RENATO (Implementación Controlada)

CREATE TABLE sigd_auth.correos_adicionales (
    id_correo_adicional UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_usuario UUID NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE CASCADE,
    correo VARCHAR(160) NOT NULL,
    verificado BOOLEAN NOT NULL DEFAULT FALSE,
    creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    fecha_verificacion TIMESTAMP WITH TIME ZONE,
    token_hash VARCHAR(255),
    token_expiracion TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uq_correos_adicionales_correo UNIQUE (correo)
);

CREATE INDEX idx_correos_adicionales_usuario ON sigd_auth.correos_adicionales(id_usuario);
