-- ============================================================================
-- SIGD RENATO — IESTP PÚBLICO «SUIZA»
-- RAMA: B_JACOBO
-- TSK-1.0A: MIGRACIÓN RBAC CONTEXTUAL, CAPACIDADES NORMALIZADAS Y EVALUADORES
-- FECHA: 2026-11-11
-- IDEMPOTENCIA: SÍ | TRANSACCIONAL: SÍ | MODO: ESTRICTO NO DESTRUCTIVO
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. COMPROBACIONES PREVIAS DE INTEGRIDAD
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'sigd_org' AND tablename = 'rol_sistema') THEN
    RAISE EXCEPTION 'Tabla sigd_org.rol_sistema no existe. Abortando migración.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'sigd_auth' AND tablename = 'cuenta_usuario') THEN
    RAISE EXCEPTION 'Tabla sigd_auth.cuenta_usuario no existe. Abortando migración.';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. AMPLIACIÓN SEGURA DEL CONSTRAINT chk_rol_codigo
--    Conserva roles históricos (ESPECIALISTA, CAJERO, etc.) para integridad referencial
--    e incorpora los cuatro nuevos roles canónicos del SIGD Suiza.
-- ----------------------------------------------------------------------------
ALTER TABLE sigd_org.rol_sistema DROP CONSTRAINT IF EXISTS chk_rol_codigo;

ALTER TABLE sigd_org.rol_sistema ADD CONSTRAINT chk_rol_codigo CHECK (
  codigo = ANY (ARRAY[
    -- 10 Roles Canónicos Activos
    'ADMINISTRADOR'::text,
    'DIRECTOR'::text,
    'JEFE_UNIDAD_ACADEMICA'::text,
    'COORDINADOR_AREA'::text,
    'SECRETARIO'::text,
    'MESA_PARTES'::text,
    'DOCENTE'::text,
    'TESORERO'::text,
    'ESTUDIANTE'::text,
    'CIUDADANO'::text,
    -- Roles Históricos Preservados para Integridad Referencial (con vigente = FALSE)
    'ESPECIALISTA'::text,
    'CAJERO'::text,
    'APROBADOR_DEVOLUCIONES'::text,
    'SUPERVISOR_TESORERIA'::text
  ])
);

-- ----------------------------------------------------------------------------
-- 3. INSERCIÓN DE LOS CUATRO ROLES CANÓNICOS FALTANTES
-- ----------------------------------------------------------------------------
INSERT INTO sigd_org.rol_sistema (rol_id, codigo, nombre, descripcion, vigente)
VALUES
  ('3a010000-0000-4000-8000-000000000001'::uuid, 'JEFE_UNIDAD_ACADEMICA', 'Jefe de Unidad Académica',
   'Responsable directivo de la Unidad Académica y supervisión de programas formativos asignados', TRUE),
  ('3a020000-0000-4000-8000-000000000002'::uuid, 'COORDINADOR_AREA', 'Coordinador de Área / Programa',
   'Coordinador de programa formativo o área académica según designación formal', TRUE),
  ('3a030000-0000-4000-8000-000000000003'::uuid, 'DOCENTE', 'Docente Institucional',
   'Personal docente ordinario y contratado del instituto', TRUE),
  ('3a040000-0000-4000-8000-000000000004'::uuid, 'ESTUDIANTE', 'Estudiante Matriculado',
   'Estudiante con matrícula activa o histórica en el IESTP Suiza', TRUE)
ON CONFLICT (codigo) DO UPDATE
  SET nombre = EXCLUDED.nombre,
      descripcion = EXCLUDED.descripcion,
      vigente = TRUE;

-- ----------------------------------------------------------------------------
-- 4. SOFT-DEPRECATION DE ROLES HISTÓRICOS DESCARTADOS
--    No se ejecutan DELETE ni DROP para proteger el historial y las claves foráneas.
-- ----------------------------------------------------------------------------
UPDATE sigd_org.rol_sistema
   SET vigente = FALSE
 WHERE codigo IN ('ESPECIALISTA', 'CAJERO', 'APROBADOR_DEVOLUCIONES', 'SUPERVISOR_TESORERIA');

-- ----------------------------------------------------------------------------
-- 5. CATÁLOGO DE PERMISOS: INCORPORACIÓN DE PERMISOS ATÓMICOS FALTANTES
-- ----------------------------------------------------------------------------
INSERT INTO sigd_org.permiso_sistema (permiso_id, codigo, nombre, ambito)
VALUES
  ('5b010000-0000-4000-8000-000000000001'::uuid, 'EXPEDIENTE_RECEPCIONAR', 'Recepcionar expedientes en bandeja de área', 'AREA'),
  ('5b020000-0000-4000-8000-000000000002'::uuid, 'EXPEDIENTE_ADJUNTAR', 'Adjuntar documentos digitalizados a expediente', 'AREA')
ON CONFLICT (codigo) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 6. ASIGNACIÓN DE PERMISOS A LOS DIEZ ROLES CANÓNICOS
-- ----------------------------------------------------------------------------
-- JEFE_UNIDAD_ACADEMICA: Ámbito delimitado a su Unidad Académica (no global automático)
INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
  FROM sigd_org.rol_sistema r
  CROSS JOIN sigd_org.permiso_sistema p
 WHERE r.codigo = 'JEFE_UNIDAD_ACADEMICA'
   AND p.codigo IN ('EXPEDIENTE_LEER', 'EXPEDIENTE_RECEPCIONAR', 'EXPEDIENTE_DERIVAR', 'EXPEDIENTE_RESOLVER', 'REPORTE_LEER')
ON CONFLICT DO NOTHING;

-- COORDINADOR_AREA: Ámbito de su programa formativo o área académica designada
INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
  FROM sigd_org.rol_sistema r
  CROSS JOIN sigd_org.permiso_sistema p
 WHERE r.codigo = 'COORDINADOR_AREA'
   AND p.codigo IN ('EXPEDIENTE_LEER', 'EXPEDIENTE_RECEPCIONAR', 'EXPEDIENTE_DERIVAR', 'EXPEDIENTE_RESOLVER')
ON CONFLICT DO NOTHING;

-- SECRETARIO: Recepción, tramitación y foliación (sin facultades de firma de resoluciones)
INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
  FROM sigd_org.rol_sistema r
  CROSS JOIN sigd_org.permiso_sistema p
 WHERE r.codigo = 'SECRETARIO'
   AND p.codigo IN ('EXPEDIENTE_RECEPCIONAR', 'EXPEDIENTE_ADJUNTAR')
ON CONFLICT DO NOTHING;

-- DOCENTE: Lectura acotada a documentos asignados, derivados o de su autoría
INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
  FROM sigd_org.rol_sistema r
  CROSS JOIN sigd_org.permiso_sistema p
 WHERE r.codigo = 'DOCENTE'
   AND p.codigo IN ('EXPEDIENTE_LEER')
ON CONFLICT DO NOTHING;

-- ESTUDIANTE: Lectura restringida a expedientes donde es solicitante titular
INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
  FROM sigd_org.rol_sistema r
  CROSS JOIN sigd_org.permiso_sistema p
 WHERE r.codigo = 'ESTUDIANTE'
   AND p.codigo IN ('EXPEDIENTE_LEER')
ON CONFLICT DO NOTHING;

-- TESORERO: Verificación y conservación de los 9 permisos históricos
INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
  FROM sigd_org.rol_sistema r
  CROSS JOIN sigd_org.permiso_sistema p
 WHERE r.codigo = 'TESORERO'
   AND p.codigo IN (
     'TESORERIA_PAGO_REGISTRAR',
     'TESORERIA_PAGO_VERIFICAR',
     'TESORERIA_LEER',
     'TESORERIA_REPORTES',
     'TESORERIA_TARIFA_PROPONER',
     'TESORERIA_TARIFA_VALIDAR',
     'TESORERIA_DEVOLUCION_EVALUAR',
     'TESORERIA_DEVOLUCION_APROBAR',
     'TESORERIA_DEVOLUCION_EJECUTAR'
   )
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- 7. MODELO RELACIONAL NORMALIZADO DE CAPACIDADES OPERATIVAS
--    Reutiliza sigd_org.permiso_sistema eliminando columnas JSONB de permisos.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_org.capacidad_sistema (
  id_capacidad UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(64) UNIQUE NOT NULL,
  nombre VARCHAR(120) NOT NULL,
  descripcion TEXT,
  vigente BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO sigd_org.capacidad_sistema (id_capacidad, codigo, nombre, descripcion, vigente)
VALUES
  ('4c010000-0000-4000-8000-000000000001'::uuid, 'GESTOR_APOYO_AREA', 'Gestor de Apoyo de Área',
   'Capacidad operativa de asistencia documental y trámite circunscrita a un área orgánica', TRUE)
ON CONFLICT (codigo) DO UPDATE SET vigente = TRUE;

CREATE TABLE IF NOT EXISTS sigd_org.capacidad_permiso (
  id_capacidad UUID NOT NULL REFERENCES sigd_org.capacidad_sistema(id_capacidad) ON DELETE CASCADE,
  permiso_id UUID NOT NULL REFERENCES sigd_org.permiso_sistema(permiso_id) ON DELETE RESTRICT,
  PRIMARY KEY (id_capacidad, permiso_id)
);

-- Mapear permisos permitidos de GESTOR_APOYO_AREA (sin firma, sin resolución, sin evaluación)
INSERT INTO sigd_org.capacidad_permiso (id_capacidad, permiso_id)
SELECT cs.id_capacidad, p.permiso_id
  FROM sigd_org.capacidad_sistema cs
  CROSS JOIN sigd_org.permiso_sistema p
 WHERE cs.codigo = 'GESTOR_APOYO_AREA'
   AND p.codigo IN ('EXPEDIENTE_LEER', 'EXPEDIENTE_RECEPCIONAR', 'EXPEDIENTE_DERIVAR', 'EXPEDIENTE_ADJUNTAR')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS sigd_org.usuario_capacidad (
  id_usuario_capacidad UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_usuario UUID NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
  id_capacidad UUID NOT NULL REFERENCES sigd_org.capacidad_sistema(id_capacidad) ON DELETE RESTRICT,
  area_id UUID NOT NULL REFERENCES sigd_org.area(area_id) ON DELETE RESTRICT,
  justificacion TEXT NOT NULL,
  asignado_por UUID NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  vigente_desde TIMESTAMPTZ NOT NULL DEFAULT now(),
  vigente_hasta TIMESTAMPTZ,
  desactivado_por UUID REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
  desactivado_en TIMESTAMPTZ,
  motivo_desactivacion TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_usuario_capacidad_activa
    ON sigd_org.usuario_capacidad (id_usuario, id_capacidad, area_id)
 WHERE activo = TRUE;

CREATE INDEX IF NOT EXISTS idx_usuario_capacidad_usuario ON sigd_org.usuario_capacidad(id_usuario);
CREATE INDEX IF NOT EXISTS idx_usuario_capacidad_area ON sigd_org.usuario_capacidad(area_id);

-- ----------------------------------------------------------------------------
-- 8. TABLA DE EVALUADORES DE EXPEDIENTES (DOCENTE_EVALUADOR) CON HISTORIAL
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_rut.expediente_evaluador (
  id_asignacion UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id UUID NOT NULL REFERENCES sigd_tra.expediente(expediente_id) ON DELETE RESTRICT,
  id_usuario_docente UUID NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
  area_id UUID NOT NULL REFERENCES sigd_org.area(area_id) ON DELETE RESTRICT,
  asignado_por UUID NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
  motivo_asignacion TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  asignado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  desactivado_por UUID REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
  desactivado_en TIMESTAMPTZ,
  motivo_desasignacion TEXT,
  observaciones TEXT,
  evidencias JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- Unicidad parcial: solo una asignación activa por expediente y docente
CREATE UNIQUE INDEX IF NOT EXISTS uq_expediente_evaluador_docente_activo
    ON sigd_rut.expediente_evaluador (expediente_id, id_usuario_docente)
 WHERE activo = TRUE;

-- Unicidad de evaluador activo por expediente
CREATE UNIQUE INDEX IF NOT EXISTS uq_expediente_evaluador_activo
    ON sigd_rut.expediente_evaluador (expediente_id)
 WHERE activo = TRUE;

CREATE INDEX IF NOT EXISTS idx_expediente_evaluador_docente ON sigd_rut.expediente_evaluador(id_usuario_docente);
CREATE INDEX IF NOT EXISTS idx_expediente_evaluador_expediente ON sigd_rut.expediente_evaluador(expediente_id);

-- ----------------------------------------------------------------------------
-- 9. COMPROBACIONES POSTERIORES DE INTEGRIDAD
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_count_roles INT;
  v_count_especialistas INT;
  v_count_permisos_tesoreria INT;
BEGIN
  -- 1. Validar que existan exactamente los 10 roles canónicos activos
  SELECT count(*) INTO v_count_roles
    FROM sigd_org.rol_sistema
   WHERE vigente = TRUE;

  IF v_count_roles <> 10 THEN
    RAISE EXCEPTION 'Discrepancia en catálogo: se esperaban 10 roles activos, se encontraron %', v_count_roles;
  END IF;

  -- 2. Validar que las asignaciones históricas de ESPECIALISTA no se hayan eliminado
  SELECT count(*) INTO v_count_especialistas
    FROM sigd_org.usuario_rol ur
    JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id
   WHERE r.codigo = 'ESPECIALISTA';

  IF v_count_especialistas < 6 THEN
    RAISE EXCEPTION 'Pérdida de integridad: se detectaron menos de 6 asignaciones históricas de ESPECIALISTA';
  END IF;

  -- 3. Validar los 9 permisos históricos de TESORERO
  SELECT count(*) INTO v_count_permisos_tesoreria
    FROM sigd_org.rol_permiso rp
    JOIN sigd_org.rol_sistema r ON r.rol_id = rp.rol_id
    JOIN sigd_org.permiso_sistema p ON p.permiso_id = rp.permiso_id
   WHERE r.codigo = 'TESORERO'
     AND p.codigo LIKE 'TESORERIA_%';

  IF v_count_permisos_tesoreria <> 9 THEN
    RAISE EXCEPTION 'Discrepancia en Tesorería: se esperaban 9 permisos históricos, se encontraron %', v_count_permisos_tesoreria;
  END IF;
END $$;

COMMIT;
