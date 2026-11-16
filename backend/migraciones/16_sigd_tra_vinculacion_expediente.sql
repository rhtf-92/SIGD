-- ==============================================================================
-- PROYECTO: SIGD (Sistema Integral de Gestión Documentaria) - IESTP "Suiza"
-- MIGRACIÓN 16: Tabla de solicitud y vinculación explícita de expedientes con cuentas ciudadanas
-- ESQUEMA: sigd_tra
-- RAMA: B_JACOBO
-- ==============================================================================
-- Justificación institucional:
-- Separación estricta entre la titularidad institucional del expediente (perteneciente
-- al administrado/persona) y los permisos de acceso en las cuentas de usuario del sistema.
--
-- Regla innegociable:
-- Una cuenta de usuario recién creada NO visualiza automáticamente los expedientes
-- históricos por mera coincidencia de DNI o persona. Requiere un procedimiento explícito
-- de vinculación, validado y resuelto (APROBADA/RECHAZADA) por personal autorizado de Mesa de Partes.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS sigd_tra.vinculacion_expediente_cuenta (
  id_vinculacion UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id UUID NOT NULL REFERENCES sigd_tra.expediente(expediente_id) ON DELETE RESTRICT,
  id_usuario UUID NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE CASCADE,
  id_persona UUID NOT NULL REFERENCES sigd_auth.persona(id_persona) ON DELETE RESTRICT,
  estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
  fecha_solicitud TIMESTAMPTZ NOT NULL DEFAULT now(),
  motivo_solicitud TEXT,
  evidencia_documental TEXT,
  revisado_por UUID REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE SET NULL,
  fecha_resolucion TIMESTAMPTZ,
  motivo_resolucion TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_vinculacion_estado CHECK (estado IN ('PENDIENTE', 'APROBADA', 'RECHAZADA')),
  CONSTRAINT uq_vinculacion_expediente_usuario UNIQUE (expediente_id, id_usuario)
);

CREATE INDEX IF NOT EXISTS idx_vinculacion_usuario_estado
  ON sigd_tra.vinculacion_expediente_cuenta(id_usuario, estado);

CREATE INDEX IF NOT EXISTS idx_vinculacion_estado_fecha
  ON sigd_tra.vinculacion_expediente_cuenta(estado, fecha_solicitud DESC);

CREATE INDEX IF NOT EXISTS idx_vinculacion_expediente
  ON sigd_tra.vinculacion_expediente_cuenta(expediente_id);
