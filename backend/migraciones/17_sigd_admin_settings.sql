-- Configuración durable de jornada y acceso administrativo. Idempotente.
CREATE TABLE IF NOT EXISTS sigd_org.configuracion_jornada (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  hora_inicio TIME NOT NULL DEFAULT '08:00',
  hora_fin TIME NOT NULL DEFAULT '16:30',
  hora_corte TIME NOT NULL DEFAULT '16:30' CHECK (hora_corte = '16:30'),
  zona_horaria VARCHAR(64) NOT NULL DEFAULT 'America/Lima',
  dias_laborales SMALLINT[] NOT NULL DEFAULT ARRAY[1,2,3,4,5]::SMALLINT[],
  actualizado_por UUID NULL,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (hora_inicio < hora_fin),
  CHECK (cardinality(dias_laborales) BETWEEN 1 AND 7),
  CHECK (dias_laborales <@ ARRAY[1,2,3,4,5,6,7]::SMALLINT[])
);
INSERT INTO sigd_org.configuracion_jornada(singleton) VALUES (TRUE) ON CONFLICT (singleton) DO NOTHING;

CREATE TABLE IF NOT EXISTS sigd_org.politicas_seguridad (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  max_intentos_fallidos SMALLINT NOT NULL DEFAULT 5 CHECK (max_intentos_fallidos BETWEEN 1 AND 20),
  minutos_bloqueo SMALLINT NOT NULL DEFAULT 30 CHECK (minutos_bloqueo BETWEEN 1 AND 1440),
  minutos_sesion SMALLINT NOT NULL DEFAULT 30 CHECK (minutos_sesion BETWEEN 5 AND 1440),
  actualizado_por UUID NULL,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO sigd_org.politicas_seguridad(singleton) VALUES (TRUE) ON CONFLICT (singleton) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_bitacora_intentos_acceso
  ON sigd_audit.bitacora_auditoria (fecha_hora DESC)
  WHERE esquema = 'sigd_auth' AND tabla = 'intento_acceso';
