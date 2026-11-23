-- ============================================================================
-- SIGD IESTP PÚBLICO «SUIZA» — PUCALLPA, UCAYALI
-- RAMA EXCLUSIVA: B_JACOBO | BASE EXCLUSIVA: sigd_jacobo_demo (PostgreSQL 18.6)
-- DOCUMENTO: TSK-1.2 FASE A0 — DISEÑO DEFINITIVO DE MIGRACIÓN RBAC INSTITUCIONAL
-- CANDIDATO FUTURO (FASE A): backend/migraciones/22_sigd_org_catalogo_rbac_institucional.sql
--
-- ============================================================================
-- ADVERTENCIA CRÍTICA: NO EJECUTADO — DOCUMENTO DE DISEÑO
-- Este script NO ha sido ejecutado sobre sigd_jacobo_demo ni sobre ninguna
-- otra base de datos. Permanece fuera de backend/migraciones/ hasta recibir
-- autorización expresa de TSK-1.2 Fase A.
-- Regla de migrate.ts: NO incluir INSERT INTO public.sigd_migraciones.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 0. COMPROBACIONES PREVIAS DE ENTORNO B_JACOBO E INTEGRIDAD REFERENCIAL
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_roles INT;
  v_permisos INT;
  v_esp_asigs INT;
BEGIN
  IF current_database() <> 'sigd_jacobo_demo' THEN
    RAISE EXCEPTION 'ABORTADO: Base efectiva "%" no corresponde a sigd_jacobo_demo (B_JACOBO).', current_database();
  END IF;

  IF to_regclass('sigd_org.rol_sistema') IS NULL
     OR to_regclass('sigd_org.permiso_sistema') IS NULL
     OR to_regclass('sigd_org.usuario_rol') IS NULL
     OR to_regclass('sigd_tra.expediente') IS NULL
     OR to_regclass('sigd_rut.estado_tramite') IS NULL THEN
    RAISE EXCEPTION 'ABORTADO: Faltan tablas base institucionales requeridas para la migración 22.';
  END IF;

  SELECT count(*) INTO v_roles FROM sigd_org.rol_sistema;
  SELECT count(*) INTO v_permisos FROM sigd_org.permiso_sistema;
  SELECT count(*) INTO v_esp_asigs
    FROM sigd_org.usuario_rol ur
    JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id
   WHERE r.codigo = 'ESPECIALISTA';

  IF v_roles < 10 OR v_permisos < 16 THEN
    RAISE EXCEPTION 'ABORTADO: Línea base inesperada (roles=%, permisos=%).', v_roles, v_permisos;
  END IF;

  IF v_esp_asigs < 6 THEN
    RAISE EXCEPTION 'ABORTADO: Faltan asignaciones históricas de ESPECIALISTA (% < 6).', v_esp_asigs;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 1. AMPLIACIÓN SEGURA DE chk_rol_codigo E INSERCIÓN DE LOS 4 ROLES FALTANTES
--    Conserva integralmente los 10 UUID existentes (6 canónicos + 4 históricos).
--    Nota: SUPER_ADMIN_PLATAFORMA NO es rol institucional #11 y NO se inserta aquí.
-- ----------------------------------------------------------------------------
ALTER TABLE sigd_org.rol_sistema DROP CONSTRAINT IF EXISTS chk_rol_codigo;

ALTER TABLE sigd_org.rol_sistema ADD CONSTRAINT chk_rol_codigo CHECK (
  codigo::text = ANY (ARRAY[
    -- 10 Roles Canónicos Vigentes
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
    -- 4 Roles Históricos Preservados (excluidos de operación; nunca DELETE)
    'ESPECIALISTA'::text,
    'CAJERO'::text,
    'APROBADOR_DEVOLUCIONES'::text,
    'SUPERVISOR_TESORERIA'::text
  ])
);

-- Normalizar nombre visible institucional del rol SECRETARIO
UPDATE sigd_org.rol_sistema
   SET nombre = 'Secretario Académico'
 WHERE codigo = 'SECRETARIO'
   AND nombre <> 'Secretario Académico';

INSERT INTO sigd_org.rol_sistema (rol_id, codigo, nombre, descripcion, vigente)
VALUES
  ('3a010000-0000-4000-8000-000000000001'::uuid, 'JEFE_UNIDAD_ACADEMICA', 'Jefe de Unidad Académica',
   'Supervisión académica y operativa delimitada a la Unidad Académica asignada.', TRUE),
  ('3a020000-0000-4000-8000-000000000002'::uuid, 'COORDINADOR_AREA', 'Coordinador de Área / Programa',
   'Gestión, asignación, reasignación y seguimiento técnico de expedientes en su área o programa.', TRUE),
  ('3a030000-0000-4000-8000-000000000003'::uuid, 'DOCENTE', 'Docente',
   'Personal docente interno para trámites propios y evaluación de expedientes expresamente asignados.', TRUE),
  ('3a040000-0000-4000-8000-000000000004'::uuid, 'ESTUDIANTE', 'Estudiante',
   'Rol interno de la comunidad estudiantil del IESTP Suiza (acceso acotado por titularidad).', TRUE)
ON CONFLICT (codigo) DO UPDATE
  SET nombre = EXCLUDED.nombre,
      descripcion = EXCLUDED.descripcion,
      vigente = TRUE;

-- ----------------------------------------------------------------------------
-- 2. PROTECCIÓN CONTRA NUEVAS ASIGNACIONES DE ROLES HISTÓRICOS (INCL. ESPECIALISTA)
--    Regla Sec. 4.3:
--    - No eliminar asignaciones históricas existentes.
--    - No reasignar automáticamente ni desactivar cuentas automáticamente.
--    - Prohibir categóricamente nuevas asignaciones o reactivaciones de roles históricos.
--    - Permitir UPDATE únicamente para cerrar vigencia (vigente_hasta).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sigd_org.fn_bloquear_nueva_asignacion_rol_historico()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_codigo TEXT;
BEGIN
  SELECT r.codigo INTO v_codigo
    FROM sigd_org.rol_sistema r
   WHERE r.rol_id = NEW.rol_id;

  IF v_codigo IN ('ESPECIALISTA', 'CAJERO', 'APROBADOR_DEVOLUCIONES', 'SUPERVISOR_TESORERIA') THEN
    IF TG_OP = 'INSERT' THEN
      RAISE EXCEPTION 'ROL_HISTORICO_BLOQUEADO: El rol "%" está excluido del catálogo operativo y no admite nuevas asignaciones.', v_codigo
        USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'UPDATE' AND (NEW.rol_id IS DISTINCT FROM OLD.rol_id OR NEW.id_usuario IS DISTINCT FROM OLD.id_usuario OR NEW.vigente_hasta IS NULL) THEN
      RAISE EXCEPTION 'ROL_HISTORICO_BLOQUEADO: Solo se permite cerrar vigencia (vigente_hasta) sobre asignaciones históricas de "%".', v_codigo
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_bloquear_nueva_asignacion_rol_historico ON sigd_org.usuario_rol;
CREATE TRIGGER tr_bloquear_nueva_asignacion_rol_historico
  BEFORE INSERT OR UPDATE ON sigd_org.usuario_rol
  FOR EACH ROW
  EXECUTE FUNCTION sigd_org.fn_bloquear_nueva_asignacion_rol_historico();

-- DECISIÓN CERRADA EN FASE A0 SOBRE ESPECIALISTA:
-- 1. Descontinuar ESPECIALISTA del catálogo operativo preservando su UUID y las
--    6 filas históricas en sigd_org.usuario_rol (4 cuentas), sin borrar relaciones,
--    sin crear roles inventados, sin reasignar automáticamente y sin alterar
--    sigd_auth.cuenta_usuario.activo (especialista.demo / trabajador.h2.test
--    quedan sin autorización operativa — 403 ACCOUNT_WITHOUT_ROLES en Fase B —
--    hasta recibir asignación canónica explícita).
-- 2. Desactivar vigente = FALSE en sigd_org.rol_sistema dentro de esta migración 22_.
UPDATE sigd_org.rol_sistema
   SET vigente = FALSE
 WHERE codigo = 'ESPECIALISTA'
   AND vigente = TRUE;

-- ----------------------------------------------------------------------------
-- 3. CONCILIACIÓN DEL CATÁLOGO DE PERMISOS (16 PRESERVADOS + 16 ATÓMICOS = 32)
-- ----------------------------------------------------------------------------
ALTER TABLE sigd_org.permiso_sistema DROP CONSTRAINT IF EXISTS chk_permiso_ambito;

ALTER TABLE sigd_org.permiso_sistema ADD CONSTRAINT chk_permiso_ambito CHECK (
  ambito::text = ANY (ARRAY[
    'AREA'::text,
    'GLOBAL'::text,
    'UNIDAD'::text,
    'TITULAR'::text
  ])
);

-- Columnas aditivas backward-compatible para descripción institucional y vigencia
ALTER TABLE sigd_org.permiso_sistema ADD COLUMN IF NOT EXISTS descripcion TEXT;
ALTER TABLE sigd_org.permiso_sistema ADD COLUMN IF NOT EXISTS vigente BOOLEAN NOT NULL DEFAULT TRUE;

-- Completar descripción institucional en los 16 permisos reales preservados (sin alterar codigo, permiso_id ni ambito)
UPDATE sigd_org.permiso_sistema
   SET descripcion = CASE codigo
     WHEN 'ADMIN_USUARIOS'               THEN 'Administración integral de cuentas, asignaciones, roles, capacidades y catálogos institucionales.'
     WHEN 'EXPEDIENTE_LEER'              THEN 'Consulta de bandejas, detalle, trazabilidad y visualización previa inline de documentos (no habilita descarga ni escritura).'
     WHEN 'EXPEDIENTE_DERIVAR'           THEN 'Derivación simple o por lotes de expedientes entre áreas institucionales.'
     WHEN 'EXPEDIENTE_RESOLVER'          THEN 'Macro-permiso legado en transición controlada (Etapa 1 Compatibilidad en 22_); prohibido en ADMINISTRADOR y sujeto a descontinuación progresiva en Fases B–D.'
     WHEN 'FIRMA_FIRMAR'                 THEN 'Capacidad técnica PKI institucional (pasarela ReFirma y firma de documentos oficiales autorizados).'
     WHEN 'REPORTE_LEER'                 THEN 'Lectura de paneles estadísticos, indicadores MGD y reportes consolidados.'
     WHEN 'TRAMICORE_DEVOLUCION_EVALUAR' THEN 'Evaluación preliminar de devoluciones y observaciones de requisitos en ventanilla.'
     WHEN 'TESORERIA_LEER'               THEN 'Consulta de órdenes de pago, recibos y estado de caja en dominio Tesorería.'
     WHEN 'TESORERIA_PAGO_REGISTRAR'     THEN 'Registro de pagos directos y pagos adicionales en Tesorería.'
     WHEN 'TESORERIA_PAGO_VERIFICAR'     THEN 'Verificación de comprobantes y conciliación bancaria de pagos en Tesorería.'
     WHEN 'TESORERIA_REPORTES'           THEN 'Generación de reportes de recaudación y arqueos en Tesorería.'
     WHEN 'TESORERIA_TARIFA_PROPONER'    THEN 'Formulación y propuesta de nuevas tarifas o derechos TUPA.'
     WHEN 'TESORERIA_TARIFA_VALIDAR'     THEN 'Validación reglamentaria y activación de tarifas en Tesorería.'
     WHEN 'TESORERIA_DEVOLUCION_EVALUAR' THEN 'Evaluación financiera y liquidación de devoluciones en Tesorería.'
     WHEN 'TESORERIA_DEVOLUCION_APROBAR' THEN 'Aprobación contable de solicitudes de devolución financiera.'
     WHEN 'TESORERIA_DEVOLUCION_EJECUTAR' THEN 'Ejecución de desembolso y cierre contable de devoluciones financieras.'
     ELSE descripcion
   END
 WHERE descripcion IS NULL;

-- Insertar los 16 permisos atómicos conciliados (#17 a #32) sin duplicar EXPEDIENTE_CREAR ni DOCENTE_EVALUAR
-- Nota: EXPEDIENTE_DESCARGAR (#32) se incorpora al catálogo como permiso independiente y vigente,
-- SIN asignarse automáticamente a ningún rol en sigd_org.rol_permiso.
INSERT INTO sigd_org.permiso_sistema (permiso_id, codigo, nombre, ambito, descripcion, vigente)
VALUES
  ('5b010000-0000-4000-8000-000000000001'::uuid, 'EXPEDIENTE_REGISTRAR',   'Registrar o radicar expedientes y solicitudes', 'TITULAR',
   'Permite radicar nuevas solicitudes o expedientes en nombre propio o mediante ventanilla autorizada.', TRUE),
  ('5b010000-0000-4000-8000-000000000002'::uuid, 'DOCUMENTO_EDITAR',       'Editar borradores de documentos o resoluciones no suscritas', 'AREA',
   'Permite modificar borradores documentales y proyectos de resolución antes de su firma digital.', TRUE),
  ('5b010000-0000-4000-8000-000000000003'::uuid, 'EXPEDIENTE_SUBSANAR',    'Presentar subsanación de expediente observado', 'TITULAR',
   'Permite al titular o ventanilla autorizada remitir la subsanación de observaciones formuladas.', TRUE),
  ('5b010000-0000-4000-8000-000000000004'::uuid, 'EXPEDIENTE_RECEPCIONAR', 'Recepcionar formalmente expedientes en área destino', 'AREA',
   'Permite acusar recepción operativa formal del expediente en la unidad u oficina competente.', TRUE),
  ('5b010000-0000-4000-8000-000000000005'::uuid, 'EXPEDIENTE_ADJUNTAR',    'Adjuntar documentos digitalizados y anexos al expediente', 'AREA',
   'Permite incorporar anexos PDF validados y ejecutar foliación electrónica dentro del ámbito autorizado.', TRUE),
  ('5b010000-0000-4000-8000-000000000006'::uuid, 'EXPEDIENTE_OBSERVAR',    'Registrar observación técnica o formal sobre expediente', 'AREA',
   'Permite formular observaciones formales o técnicas motivadas sobre expedientes en calificación o revisión.', TRUE),
  ('5b010000-0000-4000-8000-000000000007'::uuid, 'EXPEDIENTE_ASIGNAR',     'Asignar responsable o docente evaluador a expediente', 'AREA',
   'Permite designar responsable actual o docente evaluador dentro del área o unidad académica.', TRUE),
  ('5b010000-0000-4000-8000-000000000008'::uuid, 'EXPEDIENTE_REASIGNAR',   'Reasignar responsable o evaluador con justificación obligatoria', 'AREA',
   'Permite sustituir al responsable o evaluador de un expediente exigiendo justificación documentada.', TRUE),
  ('5b010000-0000-4000-8000-000000000009'::uuid, 'EXPEDIENTE_EVALUAR',     'Emitir evaluación o informe técnico de expediente asignado', 'AREA',
   'Permite registrar dictamen o informe técnico de evaluación sobre expedientes expresamente asignados.', TRUE),
  ('5b010000-0000-4000-8000-000000000010'::uuid, 'EXPEDIENTE_APROBAR',     'Aprobar institucionalmente expediente o acto administrativo', 'UNIDAD',
   'Permite aprobar el fondo técnico/administrativo de un expediente dentro de la unidad o despacho competente.', TRUE),
  ('5b010000-0000-4000-8000-000000000011'::uuid, 'EXPEDIENTE_RECHAZAR',    'Declarar improcedencia o rechazo formal de expediente', 'AREA',
   'Permite declarar improcedente o rechazar formalmente un trámite con motivación obligatoria.', TRUE),
  ('5b010000-0000-4000-8000-000000000012'::uuid, 'EXPEDIENTE_CERRAR',      'Ejecutar cierre administrativo formal del expediente (CERRADO)', 'AREA',
   'Permite ejecutar el cierre administrativo formal validando reglas procedimentales y bitácora WORM.', TRUE),
  ('5b010000-0000-4000-8000-000000000013'::uuid, 'EXPEDIENTE_ARCHIVAR',    'Archivar expediente y transferir custodia documental final', 'AREA',
   'Permite transferir a archivo definitivo un expediente previamente cerrado registrando custodia física/digital.', TRUE),
  ('5b010000-0000-4000-8000-000000000014'::uuid, 'RESOLUCION_EMITIR',      'Proyectar y emitir borrador de resolución administrativa/directoral', 'AREA',
   'Permite proyectar y elevar borradores de resoluciones hacia despacho directoral para su firma.', TRUE),
  ('5b010000-0000-4000-8000-000000000015'::uuid, 'RESOLUCION_FIRMAR',      'Firmar digitalmente resoluciones emitidas por despacho competente', 'GLOBAL',
   'Competencia jurídico-administrativa exclusiva para suscribir digitalmente resoluciones directorales vigentes.', TRUE),
  ('5b010000-0000-4000-8000-000000000016'::uuid, 'EXPEDIENTE_DESCARGAR',   'Descargar copia de documento digital perteneciente a un expediente', 'AREA',
   'Permite obtener una copia descargable de un documento perteneciente a un expediente, sujeto a validación institucional, contextual, documental y auditoría obligatoria. Sin asignación automática por rol.', TRUE)
ON CONFLICT (codigo) DO UPDATE
  SET nombre      = EXCLUDED.nombre,
      ambito      = EXCLUDED.ambito,
      descripcion = EXCLUDED.descripcion,
      vigente     = EXCLUDED.vigente;

-- ----------------------------------------------------------------------------
-- 4. MATRIZ sigd_org.rol_permiso SINCRONIZADA CON LOS 10 ROLES
-- ----------------------------------------------------------------------------
-- 4.1 ADMINISTRADOR: Plataforma y lectura global institucional (Control 1 + Control 5)
--     Decisión institucional confirmada (Adenda Definitiva TSK-1.2 Fase A0):
--     Se retiran ÚNICAMENTE de ADMINISTRADOR en sigd_org.rol_permiso las dos
--     relaciones autorizadas:
--       1. ADMINISTRADOR -> FIRMA_FIRMAR
--       2. ADMINISTRADOR -> EXPEDIENTE_RESOLVER
--     Prohibiciones respetadas:
--       - No eliminar FIRMA_FIRMAR ni EXPEDIENTE_RESOLVER de permiso_sistema.
--       - No retirar estos códigos de los otros roles autorizados.
--       - No eliminar otras relaciones de ADMINISTRADOR por interpretación:
--         conserva ADMIN_USUARIOS, REPORTE_LEER y EXPEDIENTE_LEER (ámbito GLOBAL)
--         para su acceso global de lectura y visualización previa dentro de su institución.
--       - No insertar en ADMINISTRADOR permisos de mutación documental ni firma
--         (EXPEDIENTE_APROBAR, EXPEDIENTE_CERRAR, RESOLUCION_FIRMAR, EXPEDIENTE_ARCHIVAR).
--       - NO asignar automáticamente EXPEDIENTE_DESCARGAR (#32) a ADMINISTRADOR ni
--         a ningún otro rol en sigd_org.rol_permiso.
DELETE FROM sigd_org.rol_permiso rp
 USING sigd_org.rol_sistema r, sigd_org.permiso_sistema p
 WHERE rp.rol_id = r.rol_id
   AND rp.permiso_id = p.permiso_id
   AND r.codigo = 'ADMINISTRADOR'
   AND p.codigo IN (
     'FIRMA_FIRMAR',
     'EXPEDIENTE_RESOLVER'
   );

-- 4.2 DIRECTOR: Despacho directoral, aprobación, firma y competencias institucionales
INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
  FROM sigd_org.rol_sistema r
  JOIN sigd_org.permiso_sistema p ON p.codigo IN (
    'EXPEDIENTE_LEER', 'EXPEDIENTE_RECEPCIONAR', 'EXPEDIENTE_DERIVAR',
    'EXPEDIENTE_ADJUNTAR', 'EXPEDIENTE_OBSERVAR', 'EXPEDIENTE_ASIGNAR',
    'EXPEDIENTE_REASIGNAR', 'EXPEDIENTE_APROBAR', 'EXPEDIENTE_RECHAZAR',
    'EXPEDIENTE_CERRAR', 'EXPEDIENTE_ARCHIVAR', 'EXPEDIENTE_RESOLVER',
    'DOCUMENTO_EDITAR', 'RESOLUCION_EMITIR', 'RESOLUCION_FIRMAR',
    'FIRMA_FIRMAR', 'REPORTE_LEER'
  )
 WHERE r.codigo = 'DIRECTOR'
ON CONFLICT DO NOTHING;

-- 4.3 JEFE_UNIDAD_ACADEMICA: Supervisión acotada a su unidad académica (sin asignar EXPEDIENTE_RESOLVER legado)
INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
  FROM sigd_org.rol_sistema r
  JOIN sigd_org.permiso_sistema p ON p.codigo IN (
    'EXPEDIENTE_LEER', 'EXPEDIENTE_RECEPCIONAR', 'EXPEDIENTE_DERIVAR',
    'EXPEDIENTE_ADJUNTAR', 'EXPEDIENTE_OBSERVAR', 'EXPEDIENTE_ASIGNAR',
    'EXPEDIENTE_REASIGNAR', 'EXPEDIENTE_EVALUAR', 'EXPEDIENTE_APROBAR',
    'EXPEDIENTE_RECHAZAR', 'EXPEDIENTE_CERRAR', 'EXPEDIENTE_ARCHIVAR',
    'DOCUMENTO_EDITAR', 'RESOLUCION_EMITIR'
  )
 WHERE r.codigo = 'JEFE_UNIDAD_ACADEMICA'
ON CONFLICT DO NOTHING;

-- 4.4 COORDINADOR_AREA: Gestión, asignación y supervisión técnica de su área (sin asignar EXPEDIENTE_RESOLVER legado)
INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
  FROM sigd_org.rol_sistema r
  JOIN sigd_org.permiso_sistema p ON p.codigo IN (
    'EXPEDIENTE_LEER', 'EXPEDIENTE_RECEPCIONAR', 'EXPEDIENTE_DERIVAR',
    'EXPEDIENTE_ADJUNTAR', 'EXPEDIENTE_OBSERVAR', 'EXPEDIENTE_ASIGNAR',
    'EXPEDIENTE_REASIGNAR', 'EXPEDIENTE_EVALUAR',
    'DOCUMENTO_EDITAR', 'RESOLUCION_EMITIR'
  )
 WHERE r.codigo = 'COORDINADOR_AREA'
ON CONFLICT DO NOTHING;

-- 4.5 SECRETARIO (Secretario Académico): Gestión documental SEC y responsable principal de cierre académico
INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
  FROM sigd_org.rol_sistema r
  JOIN sigd_org.permiso_sistema p ON p.codigo IN (
    'EXPEDIENTE_LEER', 'EXPEDIENTE_REGISTRAR', 'EXPEDIENTE_RECEPCIONAR',
    'EXPEDIENTE_DERIVAR', 'EXPEDIENTE_ADJUNTAR', 'EXPEDIENTE_OBSERVAR',
    'EXPEDIENTE_ASIGNAR', 'EXPEDIENTE_REASIGNAR', 'EXPEDIENTE_EVALUAR',
    'EXPEDIENTE_RECHAZAR', 'EXPEDIENTE_CERRAR', 'EXPEDIENTE_ARCHIVAR',
    'EXPEDIENTE_RESOLVER', 'DOCUMENTO_EDITAR', 'RESOLUCION_EMITIR'
  )
 WHERE r.codigo = 'SECRETARIO'
ON CONFLICT DO NOTHING;

-- 4.6 MESA_PARTES: Ventanilla, recepción, subsanación presencial y derivación (sin cerrar expedientes)
INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
  FROM sigd_org.rol_sistema r
  JOIN sigd_org.permiso_sistema p ON p.codigo IN (
    'EXPEDIENTE_LEER', 'EXPEDIENTE_REGISTRAR', 'EXPEDIENTE_RECEPCIONAR',
    'EXPEDIENTE_DERIVAR', 'EXPEDIENTE_ADJUNTAR', 'EXPEDIENTE_OBSERVAR',
    'EXPEDIENTE_SUBSANAR', 'TRAMICORE_DEVOLUCION_EVALUAR'
  )
 WHERE r.codigo = 'MESA_PARTES'
ON CONFLICT DO NOTHING;

-- 4.7 DOCENTE: Trámites propios y evaluación exclusiva de expedientes asignados
INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
  FROM sigd_org.rol_sistema r
  JOIN sigd_org.permiso_sistema p ON p.codigo IN (
    'EXPEDIENTE_LEER', 'EXPEDIENTE_REGISTRAR', 'EXPEDIENTE_RECEPCIONAR',
    'EXPEDIENTE_ADJUNTAR', 'EXPEDIENTE_OBSERVAR', 'EXPEDIENTE_SUBSANAR',
    'EXPEDIENTE_EVALUAR'
  )
 WHERE r.codigo = 'DOCENTE'
ON CONFLICT DO NOTHING;

-- 4.8 ESTUDIANTE: Rol interno (titularidad propia)
INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
  FROM sigd_org.rol_sistema r
  JOIN sigd_org.permiso_sistema p ON p.codigo IN (
    'EXPEDIENTE_LEER', 'EXPEDIENTE_REGISTRAR', 'EXPEDIENTE_SUBSANAR'
  )
 WHERE r.codigo = 'ESTUDIANTE'
ON CONFLICT DO NOTHING;

-- 4.9 CIUDADANO: Único rol externo (titularidad propia)
INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
  FROM sigd_org.rol_sistema r
  JOIN sigd_org.permiso_sistema p ON p.codigo IN (
    'EXPEDIENTE_LEER', 'EXPEDIENTE_REGISTRAR', 'EXPEDIENTE_SUBSANAR'
  )
 WHERE r.codigo = 'CIUDADANO'
ON CONFLICT DO NOTHING;

-- 4.10 TESORERO: Conservación íntegra de los 9 permisos de Tesorería (sin acceso académico)
INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
  FROM sigd_org.rol_sistema r
  JOIN sigd_org.permiso_sistema p ON p.codigo LIKE 'TESORERIA_%'
 WHERE r.codigo = 'TESORERO'
ON CONFLICT DO NOTHING;

-- 4.11 Etapa 2 de descontinuación de EXPEDIENTE_RESOLVER:
--      Prohibir terminantemente nuevas asignaciones del permiso heredado en rol_permiso
--      (se conservan únicamente las preexistentes de compatibilidad DIRECTOR y SECRETARIO
--      e historial de ESPECIALISTA; ADMINISTRADOR queda retirado en 4.1).
CREATE OR REPLACE FUNCTION sigd_org.fn_bloquear_nueva_asignacion_permiso_legado()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_perm_codigo TEXT;
BEGIN
  SELECT codigo INTO v_perm_codigo
    FROM sigd_org.permiso_sistema
   WHERE permiso_id = NEW.permiso_id;

  IF v_perm_codigo = 'EXPEDIENTE_RESOLVER' THEN
    RAISE EXCEPTION 'PERMISO_LEGADO_BLOQUEADO: El permiso heredado "%" se encuentra en descontinuación progresiva y no admite nuevas asignaciones.', v_perm_codigo
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_bloquear_nueva_asignacion_permiso_legado ON sigd_org.rol_permiso;
CREATE TRIGGER tr_bloquear_nueva_asignacion_permiso_legado
  BEFORE INSERT OR UPDATE ON sigd_org.rol_permiso
  FOR EACH ROW
  EXECUTE FUNCTION sigd_org.fn_bloquear_nueva_asignacion_permiso_legado();

-- ----------------------------------------------------------------------------
-- 5. SUBSISTEMA DE CAPACIDADES OPERATIVAS (GESTOR_APOYO_AREA - APOYO DE ÁREA)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_org.capacidad_sistema (
  id_capacidad     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo           VARCHAR(64) NOT NULL UNIQUE,
  nombre           VARCHAR(120) NOT NULL,
  descripcion      TEXT,
  ambito_requerido VARCHAR(16) NOT NULL DEFAULT 'AREA' CHECK (ambito_requerido = 'AREA'),
  vigente          BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en        TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO sigd_org.capacidad_sistema (id_capacidad, codigo, nombre, descripcion, ambito_requerido, vigente)
VALUES (
  '4c010000-0000-4000-8000-000000000001'::uuid,
  'GESTOR_APOYO_AREA',
  'Apoyo de Área',
  'Capacidad operativa delegada para organización documental, anexos y seguimiento dentro de un área asignada. No es un rol institucional.',
  'AREA',
  TRUE
)
ON CONFLICT (codigo) DO UPDATE
  SET nombre = EXCLUDED.nombre,
      descripcion = EXCLUDED.descripcion,
      vigente = TRUE;

CREATE TABLE IF NOT EXISTS sigd_org.capacidad_permiso (
  id_capacidad UUID NOT NULL REFERENCES sigd_org.capacidad_sistema(id_capacidad) ON DELETE CASCADE,
  permiso_id   UUID NOT NULL REFERENCES sigd_org.permiso_sistema(permiso_id) ON DELETE RESTRICT,
  PRIMARY KEY (id_capacidad, permiso_id)
);

-- Trigger lista negra: impide asociar facultades resolutivas, firma, cierre, evaluación o administración a capacidades de apoyo
CREATE OR REPLACE FUNCTION sigd_org.fn_proteger_capacidad_permiso()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_cap_codigo  TEXT;
  v_perm_codigo TEXT;
BEGIN
  SELECT codigo INTO v_cap_codigo FROM sigd_org.capacidad_sistema WHERE id_capacidad = NEW.id_capacidad;
  SELECT codigo INTO v_perm_codigo FROM sigd_org.permiso_sistema WHERE permiso_id = NEW.permiso_id;

  IF v_cap_codigo = 'GESTOR_APOYO_AREA' AND v_perm_codigo NOT IN (
    'EXPEDIENTE_LEER',
    'EXPEDIENTE_RECEPCIONAR',
    'EXPEDIENTE_DERIVAR',
    'EXPEDIENTE_ADJUNTAR'
  ) THEN
    RAISE EXCEPTION 'CAPACIDAD_PERMISO_PROHIBIDO: El permiso "%" está prohibido para la capacidad operativa "%".', v_perm_codigo, v_cap_codigo
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_proteger_capacidad_permiso ON sigd_org.capacidad_permiso;
CREATE TRIGGER tr_proteger_capacidad_permiso
  BEFORE INSERT OR UPDATE ON sigd_org.capacidad_permiso
  FOR EACH ROW
  EXECUTE FUNCTION sigd_org.fn_proteger_capacidad_permiso();

INSERT INTO sigd_org.capacidad_permiso (id_capacidad, permiso_id)
SELECT cs.id_capacidad, p.permiso_id
  FROM sigd_org.capacidad_sistema cs
  JOIN sigd_org.permiso_sistema p ON p.codigo IN (
    'EXPEDIENTE_LEER',
    'EXPEDIENTE_RECEPCIONAR',
    'EXPEDIENTE_DERIVAR',
    'EXPEDIENTE_ADJUNTAR'
  )
 WHERE cs.codigo = 'GESTOR_APOYO_AREA'
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS sigd_org.usuario_capacidad (
  id_usuario_capacidad UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_usuario           UUID NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
  id_capacidad         UUID NOT NULL REFERENCES sigd_org.capacidad_sistema(id_capacidad) ON DELETE RESTRICT,
  area_id              UUID NOT NULL REFERENCES sigd_org.area(area_id) ON DELETE RESTRICT,
  justificacion        TEXT NOT NULL CHECK (length(btrim(justificacion)) >= 10),
  asignado_por         UUID NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
  activo               BOOLEAN NOT NULL DEFAULT TRUE,
  vigente_desde        TIMESTAMPTZ NOT NULL DEFAULT now(),
  vigente_hasta        TIMESTAMPTZ,
  desactivado_por      UUID REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
  desactivado_en       TIMESTAMPTZ,
  motivo_desactivacion TEXT,
  creado_en            TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_usuario_capacidad_vigencia CHECK (vigente_hasta IS NULL OR vigente_hasta > vigente_desde),
  CONSTRAINT chk_usuario_capacidad_cierre CHECK (activo = TRUE OR desactivado_en IS NOT NULL),
  CONSTRAINT ex_usuario_capacidad_vigencia EXCLUDE USING gist (
    id_usuario WITH =,
    id_capacidad WITH =,
    area_id WITH =,
    tstzrange(vigente_desde, COALESCE(vigente_hasta, 'infinity'::timestamptz), '[)') WITH &&
  ) WHERE (activo = TRUE)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_usuario_capacidad_activa
  ON sigd_org.usuario_capacidad (id_usuario, id_capacidad, area_id)
  WHERE activo = TRUE;
CREATE INDEX IF NOT EXISTS idx_usuario_capacidad_usuario ON sigd_org.usuario_capacidad (id_usuario) WHERE activo = TRUE;
CREATE INDEX IF NOT EXISTS idx_usuario_capacidad_area    ON sigd_org.usuario_capacidad (area_id)    WHERE activo = TRUE;

-- ----------------------------------------------------------------------------
-- 6. ASIGNACIÓN DE RESPONSABLES, CUSTODIA Y EVALUADORES (sigd_rut)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_rut.expediente_responsable (
  id_responsabilidad        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id             UUID NOT NULL REFERENCES sigd_tra.expediente(expediente_id) ON DELETE RESTRICT,
  tipo_responsabilidad      VARCHAR(32) NOT NULL CHECK (tipo_responsabilidad IN ('RESPONSABLE_ACTUAL', 'RESPONSABLE_UNIDAD')),
  id_usuario                UUID NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
  area_id                   UUID NOT NULL REFERENCES sigd_org.area(area_id) ON DELETE RESTRICT,
  asignado_por              UUID NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
  es_reasignacion           BOOLEAN NOT NULL DEFAULT FALSE,
  justificacion             TEXT,
  asignacion_reemplazada_id UUID REFERENCES sigd_rut.expediente_responsable(id_responsabilidad) ON DELETE RESTRICT,
  activo                    BOOLEAN NOT NULL DEFAULT TRUE,
  asignado_en               TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmado_recepcion_en   TIMESTAMPTZ,
  confirmado_por            UUID REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
  desactivado_en            TIMESTAMPTZ,
  desactivado_por           UUID REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
  motivo_desactivacion      TEXT,
  CONSTRAINT chk_exp_resp_reasignacion_justif CHECK (
    NOT es_reasignacion OR length(btrim(COALESCE(justificacion, ''))) >= 10
  ),
  CONSTRAINT chk_exp_resp_cierre CHECK (activo = TRUE OR desactivado_en IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_exp_responsable_activo
  ON sigd_rut.expediente_responsable (expediente_id, tipo_responsabilidad)
  WHERE activo = TRUE;
CREATE INDEX IF NOT EXISTS idx_exp_responsable_usuario ON sigd_rut.expediente_responsable (id_usuario, activo);
CREATE INDEX IF NOT EXISTS idx_exp_responsable_area    ON sigd_rut.expediente_responsable (area_id, activo);

CREATE TABLE IF NOT EXISTS sigd_rut.expediente_custodia (
  id_custodia         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id       UUID NOT NULL REFERENCES sigd_tra.expediente(expediente_id) ON DELETE RESTRICT,
  area_custodia_id    UUID NOT NULL REFERENCES sigd_org.area(area_id) ON DELETE RESTRICT,
  custodio_usuario_id UUID REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
  ubicacion_fisica    JSONB,
  transferido_por     UUID NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
  motivo_custodia     TEXT NOT NULL CHECK (length(btrim(motivo_custodia)) >= 5),
  activo              BOOLEAN NOT NULL DEFAULT TRUE,
  desde               TIMESTAMPTZ NOT NULL DEFAULT now(),
  hasta               TIMESTAMPTZ,
  CONSTRAINT chk_exp_custodia_vigencia CHECK (hasta IS NULL OR hasta >= desde),
  CONSTRAINT chk_exp_custodia_cierre   CHECK (activo = TRUE OR hasta IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_exp_custodia_activa
  ON sigd_rut.expediente_custodia (expediente_id)
  WHERE activo = TRUE;
CREATE INDEX IF NOT EXISTS idx_exp_custodia_area ON sigd_rut.expediente_custodia (area_custodia_id, activo);

CREATE TABLE IF NOT EXISTS sigd_rut.expediente_evaluador (
  id_asignacion              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id              UUID NOT NULL REFERENCES sigd_tra.expediente(expediente_id) ON DELETE RESTRICT,
  id_usuario_docente         UUID NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
  area_id                    UUID NOT NULL REFERENCES sigd_org.area(area_id) ON DELETE RESTRICT,
  asignado_por               UUID NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
  motivo_asignacion          TEXT NOT NULL CHECK (length(btrim(motivo_asignacion)) >= 5),
  es_reasignacion            BOOLEAN NOT NULL DEFAULT FALSE,
  justificacion_reasignacion TEXT,
  asignacion_anterior_id     UUID REFERENCES sigd_rut.expediente_evaluador(id_asignacion) ON DELETE RESTRICT,
  activo                     BOOLEAN NOT NULL DEFAULT TRUE,
  asignado_en                TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmado_recepcion_en    TIMESTAMPTZ,
  estado_evaluacion          VARCHAR(32) NOT NULL DEFAULT 'PENDIENTE'
    CHECK (estado_evaluacion IN ('PENDIENTE', 'EN_EVALUACION', 'CONCLUIDA', 'REASIGNADA', 'REVOCADA')),
  evaluacion_concluida_en    TIMESTAMPTZ,
  resultado_evaluacion       TEXT,
  desactivado_por            UUID REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
  desactivado_en             TIMESTAMPTZ,
  motivo_desasignacion       TEXT,
  observaciones              TEXT,
  evidencias                 JSONB NOT NULL DEFAULT '[]'::jsonb,
  CONSTRAINT chk_exp_eval_reasig_justif CHECK (
    NOT es_reasignacion OR length(btrim(COALESCE(justificacion_reasignacion, ''))) >= 10
  ),
  CONSTRAINT chk_exp_eval_cierre CHECK (activo = TRUE OR desactivado_en IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_expediente_evaluador_docente_activo
  ON sigd_rut.expediente_evaluador (expediente_id, id_usuario_docente)
  WHERE activo = TRUE;
CREATE UNIQUE INDEX IF NOT EXISTS uq_expediente_evaluador_activo
  ON sigd_rut.expediente_evaluador (expediente_id)
  WHERE activo = TRUE;
CREATE INDEX IF NOT EXISTS idx_expediente_evaluador_docente    ON sigd_rut.expediente_evaluador (id_usuario_docente, activo);
CREATE INDEX IF NOT EXISTS idx_expediente_evaluador_expediente ON sigd_rut.expediente_evaluador (expediente_id);

-- Trigger de prevención de incompatibilidades (auto-evaluación o cuentas sin rol evaluador válido)
CREATE OR REPLACE FUNCTION sigd_rut.fn_validar_expediente_evaluador()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_solicitante_id UUID;
  v_docente_persona UUID;
  v_cuenta_activa BOOLEAN;
  v_tiene_rol_evaluador BOOLEAN;
BEGIN
  SELECT e.solicitante_id INTO v_solicitante_id
    FROM sigd_tra.expediente e
   WHERE e.expediente_id = NEW.expediente_id;

  SELECT cu.id_persona, cu.activo INTO v_docente_persona, v_cuenta_activa
    FROM sigd_auth.cuenta_usuario cu
   WHERE cu.id_usuario = NEW.id_usuario_docente;

  IF COALESCE(v_cuenta_activa, FALSE) = FALSE THEN
    RAISE EXCEPTION 'EVALUADOR_INACTIVO: La cuenta asignada como evaluador no está activa.' USING ERRCODE = '23514';
  END IF;

  IF v_solicitante_id IS NOT NULL AND v_docente_persona = v_solicitante_id THEN
    RAISE EXCEPTION 'CONFLICTO_INTERES_EVALUADOR: El solicitante del expediente no puede ser designado evaluador del mismo expediente.' USING ERRCODE = '23514';
  END IF;

  IF NEW.activo = TRUE THEN
    SELECT EXISTS (
      SELECT 1
        FROM sigd_org.usuario_rol ur
        JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id AND r.vigente = TRUE
       WHERE ur.id_usuario = NEW.id_usuario_docente
         AND r.codigo IN ('DOCENTE', 'COORDINADOR_AREA', 'JEFE_UNIDAD_ACADEMICA', 'SECRETARIO')
         AND ur.vigente_desde <= now()
         AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
    ) INTO v_tiene_rol_evaluador;

    IF NOT v_tiene_rol_evaluador THEN
      RAISE EXCEPTION 'EVALUADOR_SIN_ROL_CANONICO: La cuenta debe tener rol vigente DOCENTE, COORDINADOR_AREA, JEFE_UNIDAD_ACADEMICA o SECRETARIO.' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_expediente_evaluador_integridad ON sigd_rut.expediente_evaluador;
CREATE TRIGGER tr_expediente_evaluador_integridad
  BEFORE INSERT OR UPDATE ON sigd_rut.expediente_evaluador
  FOR EACH ROW
  EXECUTE FUNCTION sigd_rut.fn_validar_expediente_evaluador();

-- ----------------------------------------------------------------------------
-- 7. EXTENSIÓN FSM DE CIERRE ADMINISTRATIVO, MATRIZ POR PROCEDIMIENTO E HISTORIAL
-- ----------------------------------------------------------------------------
INSERT INTO sigd_rut.estado_tramite (codigo, es_terminal)
VALUES
  ('ATENDIDO',  FALSE),
  ('CERRADO',   FALSE),
  ('REABIERTO', FALSE)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO sigd_rut.accion_tramite (codigo)
VALUES
  ('ATENCION_TECNICA'),
  ('CIERRE_ADMINISTRATIVO'),
  ('ARCHIVO'),
  ('REAPERTURA')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO sigd_rut.transicion_estado_tramite (estado_anterior, evento, estado_nuevo)
VALUES
  ('EN_REVISION', 'ATENCION_TECNICA',      'ATENDIDO'),
  ('ATENDIDO',    'ENVIAR_A_FIRMA',        'EN_FIRMA'),
  ('ATENDIDO',    'CIERRE_ADMINISTRATIVO', 'CERRADO'),
  ('RESUELTO',    'CIERRE_ADMINISTRATIVO', 'CERRADO'),
  ('EN_REVISION', 'CIERRE_ADMINISTRATIVO', 'CERRADO'),
  ('CERRADO',     'ARCHIVO',               'ARCHIVADO'),
  ('CERRADO',     'REAPERTURA',            'REABIERTO'),
  ('REABIERTO',   'INICIAR_REVISION',      'EN_REVISION')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS sigd_doc.procedimiento_cierre_regla (
  id_regla                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_tramite_id              UUID REFERENCES sigd_doc.tipo_tramite_tupa(tipo_tramite_id) ON DELETE RESTRICT,
  area_responsable_id          UUID NOT NULL REFERENCES sigd_org.area(area_id) ON DELETE RESTRICT,
  etapa_habilitante            VARCHAR(32) NOT NULL CHECK (etapa_habilitante IN ('ATENDIDO', 'RESUELTO', 'EN_REVISION')),
  rol_cierre_codigo            VARCHAR(64) NOT NULL REFERENCES sigd_org.rol_sistema(codigo) ON DELETE RESTRICT,
  permiso_requerido_codigo     VARCHAR(64) NOT NULL DEFAULT 'EXPEDIENTE_CERRAR' REFERENCES sigd_org.permiso_sistema(codigo) ON DELETE RESTRICT,
  requiere_atencion_tecnica    BOOLEAN NOT NULL DEFAULT TRUE,
  requiere_resolucion_aprobada BOOLEAN NOT NULL DEFAULT FALSE,
  requiere_firma_director      BOOLEAN NOT NULL DEFAULT FALSE,
  requiere_notificacion_previa BOOLEAN NOT NULL DEFAULT FALSE,
  requiere_pago_verificado     BOOLEAN NOT NULL DEFAULT FALSE,
  requiere_documento_final     BOOLEAN NOT NULL DEFAULT TRUE,
  permite_reapertura           BOOLEAN NOT NULL DEFAULT FALSE,
  vigente                      BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cierre_regla_tramite_activo
  ON sigd_doc.procedimiento_cierre_regla (tipo_tramite_id, area_responsable_id)
  WHERE tipo_tramite_id IS NOT NULL AND vigente = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cierre_regla_default_area
  ON sigd_doc.procedimiento_cierre_regla (area_responsable_id)
  WHERE tipo_tramite_id IS NULL AND vigente = TRUE;

-- Semilla institucional mínima sobre áreas reales existentes (SEC y DG; sin inventar unidades futuras)
INSERT INTO sigd_doc.procedimiento_cierre_regla (
  tipo_tramite_id, area_responsable_id, etapa_habilitante, rol_cierre_codigo,
  permiso_requerido_codigo, requiere_atencion_tecnica, requiere_resolucion_aprobada,
  requiere_firma_director, requiere_notificacion_previa, requiere_pago_verificado,
  requiere_documento_final, permite_reapertura
)
SELECT NULL, a.area_id, 'ATENDIDO', 'SECRETARIO',
       'EXPEDIENTE_CERRAR', TRUE, FALSE, FALSE, FALSE, FALSE, TRUE, TRUE
  FROM sigd_org.area a
 WHERE a.codigo = 'SEC'
ON CONFLICT DO NOTHING;

INSERT INTO sigd_doc.procedimiento_cierre_regla (
  tipo_tramite_id, area_responsable_id, etapa_habilitante, rol_cierre_codigo,
  permiso_requerido_codigo, requiere_atencion_tecnica, requiere_resolucion_aprobada,
  requiere_firma_director, requiere_notificacion_previa, requiere_pago_verificado,
  requiere_documento_final, permite_reapertura
)
SELECT NULL, a.area_id, 'RESUELTO', 'DIRECTOR',
       'EXPEDIENTE_CERRAR', TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE
  FROM sigd_org.area a
 WHERE a.codigo = 'DG'
ON CONFLICT DO NOTHING;

-- Historial cronológico append-only y WORM de cierres administrativos y reaperturas
CREATE TABLE IF NOT EXISTS sigd_rut.expediente_cierre_historial (
  id_cierre               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id           UUID NOT NULL REFERENCES sigd_tra.expediente(expediente_id) ON DELETE RESTRICT,
  tipo_actuacion          VARCHAR(20) NOT NULL CHECK (tipo_actuacion IN ('CIERRE', 'REAPERTURA')),
  usuario_id              UUID NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
  persona_id              UUID NOT NULL REFERENCES sigd_auth.persona(id_persona) ON DELETE RESTRICT,
  contexto_activo_id      UUID NOT NULL,
  unidad_area_id          UUID NOT NULL REFERENCES sigd_org.area(area_id) ON DELETE RESTRICT,
  fecha_hora              TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  permiso_utilizado       VARCHAR(64) NOT NULL REFERENCES sigd_org.permiso_sistema(codigo) ON DELETE RESTRICT,
  estado_anterior         TEXT NOT NULL REFERENCES sigd_rut.estado_tramite(codigo),
  estado_posterior        TEXT NOT NULL REFERENCES sigd_rut.estado_tramite(codigo),
  justificacion           TEXT,
  condiciones_verificadas JSONB NOT NULL,
  evidencias              JSONB NOT NULL DEFAULT '[]'::jsonb,
  regla_cierre_id         UUID REFERENCES sigd_doc.procedimiento_cierre_regla(id_regla) ON DELETE RESTRICT,
  correlation_id          UUID NOT NULL,
  CONSTRAINT chk_cierre_hist_reapertura_justif CHECK (
    tipo_actuacion <> 'REAPERTURA' OR length(btrim(COALESCE(justificacion, ''))) >= 10
  ),
  CONSTRAINT chk_cierre_hist_condiciones_obj CHECK (jsonb_typeof(condiciones_verificadas) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_exp_cierre_hist_exp   ON sigd_rut.expediente_cierre_historial (expediente_id, fecha_hora DESC);
CREATE INDEX IF NOT EXISTS idx_exp_cierre_hist_actor ON sigd_rut.expediente_cierre_historial (usuario_id, fecha_hora DESC);

CREATE OR REPLACE FUNCTION sigd_rut.fn_cierre_historial_inmutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'CIERRE_HISTORIAL_INMUTABLE: La tabla sigd_rut.expediente_cierre_historial es append-only; no admite %.', TG_OP
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS tr_cierre_historial_inmutable ON sigd_rut.expediente_cierre_historial;
CREATE TRIGGER tr_cierre_historial_inmutable
  BEFORE UPDATE OR DELETE OR TRUNCATE ON sigd_rut.expediente_cierre_historial
  FOR EACH STATEMENT
  EXECUTE FUNCTION sigd_rut.fn_cierre_historial_inmutable();

-- ----------------------------------------------------------------------------
-- 7B. CONTROL 2 — EXTENSIÓN DE ENCARGATURA TEMPORAL Y FACULTADES DELEGADAS
--     Separa competencia ordinaria (sigd_org.facultad_despacho) de suplencia
--     temporal (encargatura_despacho + encargatura_permiso), habilita contexto
--     temporal ENCARGATURA:<id> sin otorgar DIRECTOR permanente y mantiene
--     estrictamente separados FIRMA_FIRMAR y RESOLUCION_FIRMAR.
--     Nota de compatibilidad: las columnas nuevas se agregan como NULLables
--     para preservar filas previas a 22_; la obligatoriedad de designante,
--     sustento y motivo >= 10 chars en nuevas altas se aplica en backend (DTO)
--     y por constraint condicional sobre filas nuevas. Asimismo,
--     tipos_documento_permitidos pasa a ser la fuente autoritativa en Fase B
--     (tipo_resolucion heredada de 03_sigd_org.sql queda solo de lectura legacy).
-- ----------------------------------------------------------------------------
ALTER TABLE sigd_org.encargatura_despacho ADD COLUMN IF NOT EXISTS institucion_id UUID;
ALTER TABLE sigd_org.encargatura_despacho ADD COLUMN IF NOT EXISTS area_despacho_id UUID REFERENCES sigd_org.area(area_id) ON DELETE RESTRICT;
ALTER TABLE sigd_org.encargatura_despacho ADD COLUMN IF NOT EXISTS autoridad_designante_id UUID REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT;
ALTER TABLE sigd_org.encargatura_despacho ADD COLUMN IF NOT EXISTS documento_sustento_tipo VARCHAR(40);
ALTER TABLE sigd_org.encargatura_despacho ADD COLUMN IF NOT EXISTS documento_sustento_numero VARCHAR(80);
ALTER TABLE sigd_org.encargatura_despacho ADD COLUMN IF NOT EXISTS documento_sustento_id UUID;
ALTER TABLE sigd_org.encargatura_despacho ADD COLUMN IF NOT EXISTS tipos_documento_permitidos TEXT[] NOT NULL DEFAULT ARRAY[]::text[];
ALTER TABLE sigd_org.encargatura_despacho ADD COLUMN IF NOT EXISTS motivo_encargatura TEXT;
ALTER TABLE sigd_org.encargatura_despacho ADD COLUMN IF NOT EXISTS revocado_en TIMESTAMPTZ;
ALTER TABLE sigd_org.encargatura_despacho ADD COLUMN IF NOT EXISTS revocado_por UUID REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT;
ALTER TABLE sigd_org.encargatura_despacho ADD COLUMN IF NOT EXISTS motivo_revocacion TEXT;

ALTER TABLE sigd_org.encargatura_despacho DROP CONSTRAINT IF EXISTS chk_encargatura_motivo_len;
ALTER TABLE sigd_org.encargatura_despacho ADD CONSTRAINT chk_encargatura_motivo_len CHECK (
  motivo_encargatura IS NULL OR length(btrim(motivo_encargatura)) >= 10
);

ALTER TABLE sigd_org.encargatura_despacho DROP CONSTRAINT IF EXISTS chk_encargatura_cierre;
ALTER TABLE sigd_org.encargatura_despacho ADD CONSTRAINT chk_encargatura_cierre CHECK (
  vigente = TRUE OR revocado_en IS NOT NULL OR fin <= now() OR motivo_no_habilitado IS NOT NULL
);

-- Recrear exclusión temporal parcial únicamente sobre encargaturas vigentes no revocadas
ALTER TABLE sigd_org.encargatura_despacho DROP CONSTRAINT IF EXISTS ex_encargatura_vigencia;
ALTER TABLE sigd_org.encargatura_despacho ADD CONSTRAINT ex_encargatura_vigencia EXCLUDE USING gist (
  usuario_id WITH =,
  cargo_id WITH =,
  tstzrange(inicio, COALESCE(fin, 'infinity'::timestamptz), '[)') WITH &&
) WHERE (vigente = TRUE AND revocado_en IS NULL);

CREATE TABLE IF NOT EXISTS sigd_org.encargatura_permiso (
  encargatura_id UUID NOT NULL REFERENCES sigd_org.encargatura_despacho(encargatura_id) ON DELETE RESTRICT,
  permiso_id     UUID NOT NULL REFERENCES sigd_org.permiso_sistema(permiso_id) ON DELETE RESTRICT,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (encargatura_id, permiso_id)
);

CREATE OR REPLACE FUNCTION sigd_org.fn_proteger_encargatura_permiso()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_perm TEXT;
BEGIN
  SELECT codigo INTO v_perm FROM sigd_org.permiso_sistema WHERE permiso_id = NEW.permiso_id;
  IF v_perm NOT IN (
    'EXPEDIENTE_LEER', 'EXPEDIENTE_APROBAR', 'EXPEDIENTE_RECHAZAR',
    'EXPEDIENTE_ASIGNAR', 'EXPEDIENTE_REASIGNAR', 'EXPEDIENTE_DERIVAR',
    'RESOLUCION_EMITIR', 'RESOLUCION_FIRMAR', 'FIRMA_FIRMAR'
  ) THEN
    RAISE EXCEPTION 'ENCARGATURA_PERMISO_PROHIBIDO: El permiso "%" no es delegable mediante encargatura de despacho.', v_perm
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_proteger_encargatura_permiso ON sigd_org.encargatura_permiso;
CREATE TRIGGER tr_proteger_encargatura_permiso
  BEFORE INSERT OR UPDATE ON sigd_org.encargatura_permiso
  FOR EACH ROW
  EXECUTE FUNCTION sigd_org.fn_proteger_encargatura_permiso();

-- ----------------------------------------------------------------------------
-- 8. COMPROBACIONES POSTERIORES DE INTEGRIDAD DE LA MIGRACIÓN
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_canon_roles          INT;
  v_esp_asigs            INT;
  v_tes_perms            INT;
  v_cap_bad              INT;
  v_tot_perms            INT;
  v_desc_asigs           INT;
  v_admin_forbidden      INT;
  v_admin_core           INT;
BEGIN
  SELECT count(*) INTO v_canon_roles
    FROM sigd_org.rol_sistema
   WHERE codigo IN (
     'ADMINISTRADOR', 'DIRECTOR', 'JEFE_UNIDAD_ACADEMICA', 'COORDINADOR_AREA',
     'SECRETARIO', 'MESA_PARTES', 'DOCENTE', 'TESORERO', 'ESTUDIANTE', 'CIUDADANO'
   ) AND vigente = TRUE;
  IF v_canon_roles <> 10 THEN
    RAISE EXCEPTION 'VERIFICACIÓN FALLIDA: se esperaban 10 roles canónicos vigentes, encontrados %.', v_canon_roles;
  END IF;

  SELECT count(*) INTO v_esp_asigs
    FROM sigd_org.usuario_rol ur
    JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id
   WHERE r.codigo = 'ESPECIALISTA';
  IF v_esp_asigs < 6 THEN
    RAISE EXCEPTION 'VERIFICACIÓN FALLIDA: se perdió historial de ESPECIALISTA (% < 6).', v_esp_asigs;
  END IF;

  SELECT count(*) INTO v_tes_perms
    FROM sigd_org.rol_permiso rp
    JOIN sigd_org.rol_sistema r ON r.rol_id = rp.rol_id
    JOIN sigd_org.permiso_sistema p ON p.permiso_id = rp.permiso_id
   WHERE r.codigo = 'TESORERO' AND p.codigo LIKE 'TESORERIA_%';
  IF v_tes_perms <> 9 THEN
    RAISE EXCEPTION 'VERIFICACIÓN FALLIDA: TESORERO debe conservar 9 permisos TESORERIA_*, encontrados %.', v_tes_perms;
  END IF;

  SELECT count(*) INTO v_tot_perms FROM sigd_org.permiso_sistema;
  IF v_tot_perms <> 32 THEN
    RAISE EXCEPTION 'VERIFICACIÓN FALLIDA: se esperaban 32 permisos conciliados (16 reales + 16 atómicos incluyendo EXPEDIENTE_DESCARGAR), encontrados %.', v_tot_perms;
  END IF;

  SELECT count(*) INTO v_desc_asigs
    FROM sigd_org.rol_permiso rp
    JOIN sigd_org.permiso_sistema p ON p.permiso_id = rp.permiso_id
   WHERE p.codigo = 'EXPEDIENTE_DESCARGAR';
  IF v_desc_asigs <> 0 THEN
    RAISE EXCEPTION 'VERIFICACIÓN FALLIDA: EXPEDIENTE_DESCARGAR no debe tener asignaciones automáticas en rol_permiso (encontradas=%).', v_desc_asigs;
  END IF;

  SELECT count(*) INTO v_cap_bad
    FROM sigd_org.capacidad_permiso cp
    JOIN sigd_org.capacidad_sistema cs ON cs.id_capacidad = cp.id_capacidad
    JOIN sigd_org.permiso_sistema p ON p.permiso_id = cp.permiso_id
   WHERE cs.codigo = 'GESTOR_APOYO_AREA'
     AND p.codigo NOT IN ('EXPEDIENTE_LEER', 'EXPEDIENTE_RECEPCIONAR', 'EXPEDIENTE_DERIVAR', 'EXPEDIENTE_ADJUNTAR');
  IF v_cap_bad <> 0 THEN
    RAISE EXCEPTION 'VERIFICACIÓN FALLIDA: GESTOR_APOYO_AREA contiene permisos prohibidos (%).', v_cap_bad;
  END IF;

  SELECT count(*) INTO v_admin_forbidden
    FROM sigd_org.rol_permiso rp
    JOIN sigd_org.rol_sistema r ON r.rol_id = rp.rol_id
    JOIN sigd_org.permiso_sistema p ON p.permiso_id = rp.permiso_id
   WHERE r.codigo = 'ADMINISTRADOR'
     AND p.codigo IN ('FIRMA_FIRMAR', 'EXPEDIENTE_RESOLVER');
  IF v_admin_forbidden <> 0 THEN
    RAISE EXCEPTION 'VERIFICACIÓN FALLIDA: ADMINISTRADOR aún conserva % relación(es) retirada(s) (FIRMA_FIRMAR/EXPEDIENTE_RESOLVER).', v_admin_forbidden;
  END IF;

  SELECT count(*) INTO v_admin_forbidden
    FROM sigd_org.rol_permiso rp
    JOIN sigd_org.rol_sistema r ON r.rol_id = rp.rol_id
    JOIN sigd_org.permiso_sistema p ON p.permiso_id = rp.permiso_id
   WHERE r.codigo = 'ADMINISTRADOR'
     AND p.codigo IN ('EXPEDIENTE_APROBAR', 'EXPEDIENTE_CERRAR', 'RESOLUCION_FIRMAR', 'EXPEDIENTE_ARCHIVAR', 'EXPEDIENTE_DESCARGAR');
  IF v_admin_forbidden <> 0 THEN
    RAISE EXCEPTION 'VERIFICACIÓN FALLIDA: ADMINISTRADOR recibió indebidamente % permiso(s) de resolución/cierre/firma/archivo/descarga.', v_admin_forbidden;
  END IF;

  SELECT count(*) INTO v_admin_core
    FROM sigd_org.rol_permiso rp
    JOIN sigd_org.rol_sistema r ON r.rol_id = rp.rol_id
    JOIN sigd_org.permiso_sistema p ON p.permiso_id = rp.permiso_id
   WHERE r.codigo = 'ADMINISTRADOR'
     AND p.codigo IN ('ADMIN_USUARIOS', 'EXPEDIENTE_LEER', 'REPORTE_LEER');
  IF v_admin_core <> 3 THEN
    RAISE EXCEPTION 'VERIFICACIÓN FALLIDA: ADMINISTRADOR debe conservar ADMIN_USUARIOS, EXPEDIENTE_LEER (lectura global) y REPORTE_LEER (encontrados=%).', v_admin_core;
  END IF;

  -- Verificar que EXPEDIENTE_RESOLVER no recibió ninguna nueva asignación fuera de compatibilidad (DIRECTOR, SECRETARIO) e historial (ESPECIALISTA)
  SELECT count(*) INTO v_admin_forbidden
    FROM sigd_org.rol_permiso rp
    JOIN sigd_org.rol_sistema r ON r.rol_id = rp.rol_id
    JOIN sigd_org.permiso_sistema p ON p.permiso_id = rp.permiso_id
   WHERE p.codigo = 'EXPEDIENTE_RESOLVER'
     AND r.codigo NOT IN ('DIRECTOR', 'SECRETARIO', 'ESPECIALISTA');
  IF v_admin_forbidden <> 0 THEN
    RAISE EXCEPTION 'VERIFICACIÓN FALLIDA: EXPEDIENTE_RESOLVER presenta % asignación(es) fuera de roles de compatibilidad/historial.', v_admin_forbidden;
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- ANEXO DDL PROPUESTO — CANDIDATO PARA MIGRACIÓN POSTERIOR 23_
-- ESTADO: NO EJECUTADO — DOCUMENTO DE DISEÑO (NO CREAR EN backend/migraciones/)
-- ============================================================================
/*
BEGIN;

-- A.1 Auditoría documental de consulta, visualización y descarga (separada de movimiento_tramite)
CREATE TABLE IF NOT EXISTS sigd_audit.bitacora_acceso_documental (
  id_acceso                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha_hora                      TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  institucion_id                  UUID, -- NULL en línea base mono-institución; NOT NULL al habilitar SaaS multi-tenant
  usuario_id                      UUID NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
  rol_activo                      VARCHAR(64) NOT NULL,
  contexto_activo_id              UUID,
  sesion_id                       UUID REFERENCES sigd_auth.sesion_usuario(id_sesion) ON DELETE SET NULL,
  correlation_id                  UUID NOT NULL,
  tipo_evento                     VARCHAR(40) NOT NULL CHECK (tipo_evento IN (
    'CONSULTA_BANDEJA',
    'CONSULTA_EXPEDIENTE',
    'VISUALIZACION_DOCUMENTO',
    'DESCARGA_AUTORIZADA',
    'DESCARGA_DENEGADA',
    'INTENTO_ACCESO_DIRECTO_MINIO',
    'ACCESO_EXCEPCIONAL',
    'OTORGAMIENTO_EXCEPCION',
    'REVOCACION_EXCEPCION'
  )),
  resultado                       VARCHAR(16) NOT NULL CHECK (resultado IN ('PERMITIDO', 'DENEGADO')),
  codigo_http                     SMALLINT NOT NULL,
  expediente_id                   UUID REFERENCES sigd_tra.expediente(expediente_id) ON DELETE RESTRICT,
  documento_id                    UUID REFERENCES sigd_doc.documento_adjunto(documento_adjunto_id) ON DELETE RESTRICT,
  nombre_logico_archivo           VARCHAR(255),
  s3_bucket                       VARCHAR(120),
  s3_key                          VARCHAR(500),
  autorizacion_excepcional_id     UUID,
  motivo_autorizacion_excepcional TEXT,
  motivo_denegacion               VARCHAR(128),
  detalle_filtro                  JSONB,
  ip_origen                       INET, -- sujeta a política institucional de privacidad/retención
  user_agent                      VARCHAR(512)
);

CREATE INDEX IF NOT EXISTS idx_bitacora_acc_doc_usuario   ON sigd_audit.bitacora_acceso_documental (usuario_id, fecha_hora DESC);
CREATE INDEX IF NOT EXISTS idx_bitacora_acc_doc_exp       ON sigd_audit.bitacora_acceso_documental (expediente_id, fecha_hora DESC);
CREATE INDEX IF NOT EXISTS idx_bitacora_acc_doc_evento    ON sigd_audit.bitacora_acceso_documental (tipo_evento, resultado, fecha_hora DESC);
CREATE INDEX IF NOT EXISTS idx_bitacora_acc_doc_inst      ON sigd_audit.bitacora_acceso_documental (institucion_id, fecha_hora DESC);

CREATE OR REPLACE FUNCTION sigd_audit.fn_bitacora_acceso_inmutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'BITACORA_ACCESO_INMUTABLE: sigd_audit.bitacora_acceso_documental es append-only para cuentas ordinarias; % bloqueado.', TG_OP
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS tr_bitacora_acceso_inmutable ON sigd_audit.bitacora_acceso_documental;
CREATE TRIGGER tr_bitacora_acceso_inmutable
  BEFORE UPDATE OR DELETE OR TRUNCATE ON sigd_audit.bitacora_acceso_documental
  FOR EACH STATEMENT
  EXECUTE FUNCTION sigd_audit.fn_bitacora_acceso_inmutable();

-- DCL de defensa en profundidad para rol de aplicación (separación de privilegios):
-- El usuario de aplicación (sigd_app) solo tiene permisos de lectura e inserción.
-- Se revoca explícitamente UPDATE, DELETE y TRUNCATE para impedir mutaciones ordinarias.
GRANT SELECT, INSERT ON sigd_audit.bitacora_acceso_documental TO sigd_app;
REVOKE UPDATE, DELETE, TRUNCATE ON sigd_audit.bitacora_acceso_documental FROM sigd_app;

-- Nota de seguridad y límites de inmutabilidad (Tres niveles de defensa):
-- 1. Capa aplicativa: Backend solo invoca métodos de inserción de eventos (sin métodos de modificación/borrado).
-- 2. Capa PostgreSQL: Triggers BEFORE UPDATE/DELETE/TRUNCATE y DCL con revocación a sigd_app.
--    Límite técnico honesto: El propietario de la tabla (owner) o un superusuario (postgres) conservan privilegios
--    para ejecutar DDL (ALTER TABLE ... DISABLE TRIGGER, DROP TABLE). Por tanto, la protección en PostgreSQL es append-only
--    frente a la aplicación, pero NO constituye WORM absoluto frente a superusuarios o DBAs.
-- 3. Inmutabilidad externa: La garantía WORM absoluta exige replicación asíncrona continua (log shipping / CDC)
--    hacia un almacenamiento inmutable externo (S3 Object Lock en modo Compliance o SIEM externo).

-- A.2 Autorización extraordinaria de descarga temporal (máximo 15 minutos por autorización,
--     renovable únicamente mediante nuevo registro justificado; nunca permiso permanente)
CREATE TABLE IF NOT EXISTS sigd_org.autorizacion_descarga_excepcional (
  id_autorizacion              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institucion_id               UUID NOT NULL, -- Delimitación multi-tenant estricta
  usuario_beneficiario_id      UUID NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
  autoridad_otorgante_id       UUID REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT, -- DIRECTOR institucional (NULL si autoridad superior externa)
  tipo_autoridad_otorgante     VARCHAR(64) NOT NULL DEFAULT 'DIRECTOR' CHECK (tipo_autoridad_otorgante IN ('DIRECTOR', 'AUTORIDAD_SUPERIOR_ACREDITADA')),
  rol_otorgante                VARCHAR(64) NOT NULL DEFAULT 'DIRECTOR',
  ejecutor_tecnico_id          UUID REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT, -- ADMINISTRADOR institucional que asienta registralmente
  acto_administrativo_sustento VARCHAR(160), -- Obligatorio cuando autoriza autoridad superior legalmente competente acreditada por acto administrativo
  contexto_beneficiario        UUID REFERENCES sigd_org.area(area_id) ON DELETE RESTRICT,
  expediente_id                UUID NOT NULL REFERENCES sigd_tra.expediente(expediente_id) ON DELETE RESTRICT,
  documentos_permitidos        UUID[] NOT NULL CHECK (cardinality(documentos_permitidos) >= 1),
  documentos_descargados       UUID[] NOT NULL DEFAULT '{}', -- Registro individual de documentos consumidos (un solo uso)
  justificacion                TEXT NOT NULL CHECK (length(btrim(justificacion)) >= 15),
  alcance_limitado             VARCHAR(160) NOT NULL DEFAULT 'EXPEDIENTE_ESPECIFICO_EMERGENCIA',
  vigente_desde                TIMESTAMPTZ NOT NULL DEFAULT now(),
  vigente_hasta                TIMESTAMPTZ NOT NULL,
  activo                       BOOLEAN NOT NULL DEFAULT TRUE,
  revocado_en                  TIMESTAMPTZ,
  revocado_por                 UUID REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
  motivo_revocacion            TEXT,
  creado_en                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_desc_excep_no_auto CHECK (autoridad_otorgante_id IS NULL OR usuario_beneficiario_id <> autoridad_otorgante_id),
  CONSTRAINT chk_desc_excep_no_auto_ejecutor CHECK (ejecutor_tecnico_id IS NULL OR ejecutor_tecnico_id <> usuario_beneficiario_id),
  CONSTRAINT chk_desc_excep_sup_acto CHECK (
    tipo_autoridad_otorgante <> 'AUTORIDAD_SUPERIOR_ACREDITADA' OR length(btrim(COALESCE(acto_administrativo_sustento, ''))) >= 10
  ),
  CONSTRAINT chk_desc_excep_consumo CHECK (documentos_descargados <@ documentos_permitidos),
  CONSTRAINT chk_desc_excep_rango   CHECK (vigente_hasta > vigente_desde),
  CONSTRAINT chk_desc_excep_max_15m CHECK (vigente_hasta <= vigente_desde + INTERVAL '15 minutes'),
  CONSTRAINT chk_desc_excep_cierre  CHECK (activo = TRUE OR revocado_en IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_desc_excep_activa
  ON sigd_org.autorizacion_descarga_excepcional (institucion_id, usuario_beneficiario_id, expediente_id)
  WHERE activo = TRUE AND revocado_en IS NULL;

-- Trigger y serialización concurrente atómica de 64 bits para autorizaciones extraordinarias
CREATE OR REPLACE FUNCTION sigd_org.fn_validar_autorizacion_descarga_excepcional()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
AS $$
BEGIN
  -- Protección contra eliminación física (DELETE)
  IF TG_OP = 'DELETE' THEN
    PERFORM pg_advisory_xact_lock(
      hashtextextended(
        'desc_excep:' || OLD.institucion_id::text || ':' || OLD.usuario_beneficiario_id::text || ':' || OLD.expediente_id::text,
        0::bigint
      )
    );
    RAISE EXCEPTION 'ELIMINACION_FISICA_PROHIBIDA: Las autorizaciones extraordinarias son auditables y no pueden eliminarse físicamente. Utilice revocación lógica.'
      USING ERRCODE = '42501';
  END IF;

  -- Serialización transaccional concurrente con llave unificada
  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      'desc_excep:' || NEW.institucion_id::text || ':' || NEW.usuario_beneficiario_id::text || ':' || NEW.expediente_id::text,
      0::bigint
    )
  );

  -- Si el beneficiario es el Director institucional, prohibida auto-autorización
  IF NEW.tipo_autoridad_otorgante = 'DIRECTOR' AND NEW.autoridad_otorgante_id = NEW.usuario_beneficiario_id THEN
    RAISE EXCEPTION 'AUTO_AUTORIZACION_PROHIBIDA: El Director no puede autorizarse a sí mismo la descarga excepcional. Requiere habilitación de órgano jerárquico superior competente y formalmente acreditado.'
      USING ERRCODE = '23514';
  END IF;

  -- Vencimiento estricto <= 15 minutos
  IF NEW.vigente_hasta > NEW.vigente_desde + INTERVAL '15 minutes' THEN
    RAISE EXCEPTION 'VIGENCIA_EXCESIVA: La autorización de descarga excepcional no puede exceder 15 minutos.'
      USING ERRCODE = '23514';
  END IF;

  -- Monotonía en documentos consumidos: no se pueden eliminar registros de descargas previas
  IF TG_OP = 'UPDATE' THEN
    IF NOT (OLD.documentos_descargados <@ NEW.documentos_descargados) THEN
      RAISE EXCEPTION 'CONSUMO_IRREVERSIBLE: No se pueden eliminar registros de documentos ya descargados.'
        USING ERRCODE = '23514';
    END IF;

    -- Revocación automática si se completó la descarga de todos los documentos autorizados
    IF NEW.activo = TRUE AND NEW.documentos_permitidos <@ NEW.documentos_descargados THEN
      NEW.activo := FALSE;
      NEW.revocado_en := COALESCE(NEW.revocado_en, clock_timestamp());
      NEW.motivo_revocacion := COALESCE(NEW.motivo_revocacion, 'CONSUMO_TOTAL_DOCUMENTOS');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_validar_autorizacion_descarga_excepcional ON sigd_org.autorizacion_descarga_excepcional;
CREATE TRIGGER tr_validar_autorizacion_descarga_excepcional
BEFORE INSERT OR UPDATE OR DELETE ON sigd_org.autorizacion_descarga_excepcional
FOR EACH ROW EXECUTE FUNCTION sigd_org.fn_validar_autorizacion_descarga_excepcional();

-- Función atómica para registrar el consumo individual de documentos bajo autorización extraordinaria
-- Regla de negocio: Cada documento autorizado puede descargarse una sola vez.
-- Solo se invoca tras evento TRANSFERENCIA_COMPLETADA en el backend (los fallos de red no computan como descarga).
-- Cuando todos los documentos permitidos han sido descargados, la autorización se revoca automáticamente.
CREATE OR REPLACE FUNCTION sigd_org.fn_registrar_consumo_descarga_excepcional(
  p_autorizacion_id UUID,
  p_documento_id    UUID
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_aut RECORD;
  v_consumo_total BOOLEAN := FALSE;
BEGIN
  -- Serialización concurrente atómica por autorización mediante advisory lock
  PERFORM pg_advisory_xact_lock(
    hashtextextended('desc_excep_consumo:' || p_autorizacion_id::text, 0::bigint)
  );

  -- Bloqueo pesimista de fila para actualización atómica
  SELECT * INTO v_aut
  FROM sigd_org.autorizacion_descarga_excepcional
  WHERE id_autorizacion = p_autorizacion_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AUTORIZACION_NO_ENCONTRADA: La autorización excepcional % no existe.', p_autorizacion_id
      USING ERRCODE = 'P0002';
  END IF;

  -- Validar estado activo y no revocado
  IF v_aut.activo = FALSE OR v_aut.revocado_en IS NOT NULL THEN
    RAISE EXCEPTION 'AUTORIZACION_NO_ACTIVA: La autorización excepcional ha sido revocada o consumida previamente.'
      USING ERRCODE = '23514';
  END IF;

  -- Validar ventana temporal estricta (<= 15 minutos)
  IF clock_timestamp() < v_aut.vigente_desde OR clock_timestamp() > v_aut.vigente_hasta THEN
    UPDATE sigd_org.autorizacion_descarga_excepcional
    SET activo = FALSE, revocado_en = clock_timestamp(), motivo_revocacion = 'EXPIRACION_VENTANA_TEMPORAL'
    WHERE id_autorizacion = p_autorizacion_id;

    RAISE EXCEPTION 'AUTORIZACION_EXPIRADA: La ventana temporal de la autorización excepcional (15 min) ha expirado.'
      USING ERRCODE = '23514';
  END IF;

  -- Validar que el documento solicitado forme parte de la autorización
  IF NOT (p_documento_id = ANY(v_aut.documentos_permitidos)) THEN
    RAISE EXCEPTION 'DOCUMENTO_NO_AUTORIZADO: El documento % no forma parte de los documentos permitidos en esta autorización.', p_documento_id
      USING ERRCODE = '23514';
  END IF;

  -- Validar regla de un solo uso por documento: denegar descargas duplicadas
  IF p_documento_id = ANY(v_aut.documentos_descargados) THEN
    RAISE EXCEPTION 'DOCUMENTO_YA_DESCARGADO: El documento % ya fue descargado bajo esta autorización. Cada documento permitido puede descargarse una sola vez.', p_documento_id
      USING ERRCODE = '23514';
  END IF;

  -- Evaluar si con esta descarga se alcanza el consumo total del lote
  IF v_aut.documentos_permitidos <@ array_append(v_aut.documentos_descargados, p_documento_id) THEN
    v_consumo_total := TRUE;
  END IF;

  -- Actualizar registro atómicamente
  UPDATE sigd_org.autorizacion_descarga_excepcional
  SET documentos_descargados = array_append(documentos_descargados, p_documento_id),
      activo = CASE WHEN v_consumo_total THEN FALSE ELSE activo END,
      revocado_en = CASE WHEN v_consumo_total THEN clock_timestamp() ELSE revocado_en END,
      motivo_revocacion = CASE WHEN v_consumo_total THEN 'CONSUMO_TOTAL_DOCUMENTOS' ELSE motivo_revocacion END
  WHERE id_autorizacion = p_autorizacion_id;

  RETURN jsonb_build_object(
    'exito', true,
    'autorizacion_id', p_autorizacion_id,
    'documento_descargado_id', p_documento_id,
    'consumo_total_alcanzado', v_consumo_total,
    'activo', NOT v_consumo_total,
    'registrado_en', clock_timestamp()
  );
END;
$$;

-- A.2.a.bis Estructura relacional para reserva atómica previa al streaming con modelo Lease & Heartbeat
--           Garantiza exclusión mutua estricta durante transferencias prolongadas,
--           renovación periódica por heartbeat, auto-recuperación de leases expirados,
--           y tratamiento conservador de estados con RESULTADO_INCIERTO.
--           Máquina de estados canónica de exactamente 4 estados:
--           RESERVADO -> COMPLETADO / FALLIDO / RESULTADO_INCIERTO.
--           (Se elimina 'LIBERADO' por duplicidad conceptual: la liberación para reintento es una consecuencia inherente de FALLIDO).
CREATE TABLE IF NOT EXISTS sigd_org.intento_descarga_excepcional (
  id_intento                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_autorizacion              UUID NOT NULL REFERENCES sigd_org.autorizacion_descarga_excepcional(id_autorizacion) ON DELETE RESTRICT,
  documento_id                 UUID NOT NULL,
  usuario_id                   UUID NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
  token_propietario            UUID NOT NULL DEFAULT gen_random_uuid(), -- Token secreto de propietario del lease (NUNCA exponer al cliente ni a logs)
  estado                       VARCHAR(32) NOT NULL DEFAULT 'RESERVADO' CHECK (estado IN ('RESERVADO', 'COMPLETADO', 'FALLIDO', 'RESULTADO_INCIERTO')),
  reservado_en                 TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  expiracion_lease             TIMESTAMPTZ NOT NULL DEFAULT (clock_timestamp() + INTERVAL '30 seconds'), -- Ventana activa renovable
  ultimo_heartbeat             TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  finalizado_en                TIMESTAMPTZ,
  resultado                    VARCHAR(64),
  motivo_resultado             TEXT,
  ip_origen                    VARCHAR(64),
  user_agent                   TEXT,
  creado_en                    TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- Índice único parcial que asegura exclusión mutua absoluta:
-- Solo puede existir UNA reserva activa simultánea para la misma combinación autorización-documento.
CREATE UNIQUE INDEX IF NOT EXISTS uq_intento_reserva_activa
  ON sigd_org.intento_descarga_excepcional (id_autorizacion, documento_id)
  WHERE estado = 'RESERVADO';

CREATE INDEX IF NOT EXISTS idx_intento_desc_excep_aut
  ON sigd_org.intento_descarga_excepcional (id_autorizacion, estado);

CREATE INDEX IF NOT EXISTS idx_intento_desc_excep_lease
  ON sigd_org.intento_descarga_excepcional (expiracion_lease)
  WHERE estado = 'RESERVADO';

-- Función atómica para crear la reserva previa a la transmisión con adquisición de lease (antes del primer byte)
CREATE OR REPLACE FUNCTION sigd_org.fn_reservar_descarga_excepcional(
  p_autorizacion_id UUID,
  p_documento_id    UUID,
  p_usuario_id      UUID,
  p_ip_origen       VARCHAR DEFAULT NULL,
  p_user_agent      TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_aut RECORD;
  v_intento_id UUID;
  v_token_propietario UUID;
  v_expiracion_lease TIMESTAMPTZ;
  v_reserva_previa RECORD;
  v_incierto RECORD;
BEGIN
  -- Serialización concurrente atómica por documento y autorización mediante advisory lock
  PERFORM pg_advisory_xact_lock(
    hashtextextended('desc_excep_reserva:' || p_autorizacion_id::text || ':' || p_documento_id::text, 0::bigint)
  );

  -- 1. Validar existencia y vigencia de la autorización extraordinaria
  SELECT * INTO v_aut
  FROM sigd_org.autorizacion_descarga_excepcional
  WHERE id_autorizacion = p_autorizacion_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AUTORIZACION_NO_ENCONTRADA: La autorización excepcional % no existe.', p_autorizacion_id
      USING ERRCODE = 'P0002';
  END IF;

  IF v_aut.activo = FALSE OR v_aut.revocado_en IS NOT NULL THEN
    RAISE EXCEPTION 'AUTORIZACION_NO_ACTIVA: La autorización excepcional ha sido revocada o consumida totalmente.'
      USING ERRCODE = '23514';
  END IF;

  IF clock_timestamp() < v_aut.vigente_desde OR clock_timestamp() > v_aut.vigente_hasta THEN
    RAISE EXCEPTION 'AUTORIZACION_EXPIRADA: La ventana temporal de 15 minutos ha expirado.'
      USING ERRCODE = '23514';
  END IF;

  -- 2. Validar que el usuario solicitante sea el beneficiario autorizado
  IF v_aut.usuario_beneficiario_id <> p_usuario_id THEN
    RAISE EXCEPTION 'USUARIO_NO_AUTORIZADO: El usuario solicitante no es el beneficiario de esta autorización excepcional.'
      USING ERRCODE = '42501';
  END IF;

  -- 3. Validar que el documento solicitado forme parte de los documentos permitidos
  IF NOT (p_documento_id = ANY(v_aut.documentos_permitidos)) THEN
    RAISE EXCEPTION 'DOCUMENTO_NO_AUTORIZADO: El documento % no está incluido en la autorización excepcional.', p_documento_id
      USING ERRCODE = '23514';
  END IF;

  -- 4. Comprobar que el documento no haya sido consumido definitivamente (regla de un solo uso)
  IF p_documento_id = ANY(v_aut.documentos_descargados) OR EXISTS (
    SELECT 1 FROM sigd_org.intento_descarga_excepcional
    WHERE id_autorizacion = p_autorizacion_id AND documento_id = p_documento_id AND estado = 'COMPLETADO'
  ) THEN
    RAISE EXCEPTION 'DOCUMENTO_YA_DESCARGADO: El documento % ya fue descargado previamente bajo esta autorización (regla de un solo uso).', p_documento_id
      USING ERRCODE = '23514';
  END IF;

  -- 5. Bloqueo conservador ante resultados inciertos: No liberar automáticamente intentos en RESULTADO_INCIERTO
  SELECT id_intento, creado_en INTO v_incierto
  FROM sigd_org.intento_descarga_excepcional
  WHERE id_autorizacion = p_autorizacion_id
    AND documento_id = p_documento_id
    AND estado = 'RESULTADO_INCIERTO'
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'RESERVA_BLOQUEADA_RESULTADO_INCIERTO: La descarga previa del documento % quedó en estado incierto (intento %). Requiere reconciliación auditable antes de permitir nuevos intentos.', p_documento_id, v_incierto.id_intento
      USING ERRCODE = '55P03';
  END IF;

  -- 6. Manejo de reservas concurrentes y tratamiento conservador de leases expirados
  SELECT * INTO v_reserva_previa
  FROM sigd_org.intento_descarga_excepcional
  WHERE id_autorizacion = p_autorizacion_id
    AND documento_id = p_documento_id
    AND estado = 'RESERVADO'
  FOR UPDATE;

  IF FOUND THEN
    -- Si el lease aún está vigente (renovado por heartbeat de streaming activo), denegar colisión concurrente
    IF v_reserva_previa.expiracion_lease > clock_timestamp() THEN
      RAISE EXCEPTION 'DESCARGA_CONCURRENTE_EN_CURSO: El documento % se encuentra actualmente en transmisión activa protegida por lease vigente.', p_documento_id
        USING ERRCODE = '55P03';
    ELSE
      -- Si el lease expiró sin renovación (heartbeat cesó por caída de proceso, desconexión o congelamiento):
      -- REGLA OBLIGATORIA: La ausencia de heartbeat NO demuestra que la transmisión HTTP haya terminado sin éxito.
      -- Pasar a RESULTADO_INCIERTO (NUNCA a FALLIDO) y bloquear cualquier nueva reserva hasta reconciliación auditable.
      UPDATE sigd_org.intento_descarga_excepcional
      SET estado = 'RESULTADO_INCIERTO',
          finalizado_en = clock_timestamp(),
          resultado = 'EXPIRACION_LEASE_SIN_CONFIRMACION',
          motivo_resultado = 'Lease expirado sin confirmación concluyente de finalización; requiere reconciliación auditable conservadora'
      WHERE id_intento = v_reserva_previa.id_intento;

      RAISE EXCEPTION 'RESERVA_BLOQUEADA_RESULTADO_INCIERTO: La reserva previa del documento % expiró su lease sin confirmación concluyente y ha pasado a RESULTADO_INCIERTO. Se bloquea un nuevo intento hasta su reconciliación auditable.', p_documento_id
        USING ERRCODE = '55P03';
    END IF;
  END IF;

  -- 7. Crear la reserva exclusiva asignando token secreto de propietario y lease inicial de 30 segundos
  v_token_propietario := gen_random_uuid();
  v_expiracion_lease  := clock_timestamp() + INTERVAL '30 seconds';

  INSERT INTO sigd_org.intento_descarga_excepcional (
    id_autorizacion,
    documento_id,
    usuario_id,
    token_propietario,
    estado,
    reservado_en,
    expiracion_lease,
    ultimo_heartbeat,
    ip_origen,
    user_agent
  ) VALUES (
    p_autorizacion_id,
    p_documento_id,
    p_usuario_id,
    v_token_propietario,
    'RESERVADO',
    clock_timestamp(),
    v_expiracion_lease,
    clock_timestamp(),
    p_ip_origen,
    p_user_agent
  ) RETURNING id_intento INTO v_intento_id;

  RETURN jsonb_build_object(
    'exito', true,
    'intento_id', v_intento_id,
    'token_propietario', v_token_propietario,
    'autorizacion_id', p_autorizacion_id,
    'documento_id', p_documento_id,
    'estado', 'RESERVADO',
    'expiracion_lease', v_expiracion_lease,
    'reservado_en', clock_timestamp()
  );
END;
$$;

-- Función atómica para renovar periódicamente el lease de una reserva activa mediante heartbeat (durante streaming prolongado)
CREATE OR REPLACE FUNCTION sigd_org.fn_renovar_reserva_descarga_excepcional(
  p_intento_id            UUID,
  p_token_propietario     UUID,
  p_extension_segundos    INT DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_intento RECORD;
  v_aut RECORD;
  v_nueva_expiracion TIMESTAMPTZ;
BEGIN
  -- Serialización concurrente atómica por intento
  PERFORM pg_advisory_xact_lock(
    hashtextextended('desc_excep_intento:' || p_intento_id::text, 0::bigint)
  );

  -- Bloqueo pesimista del intento
  SELECT * INTO v_intento
  FROM sigd_org.intento_descarga_excepcional
  WHERE id_intento = p_intento_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INTENTO_NO_ENCONTRADO: El intento de descarga % no existe.', p_intento_id
      USING ERRCODE = 'P0002';
  END IF;

  -- Validar estado activo de la reserva
  IF v_intento.estado <> 'RESERVADO' THEN
    RAISE EXCEPTION 'RESERVA_NO_RENOVABLE: La reserva ya no se encuentra en estado RESERVADO (estado actual: %).', v_intento.estado
      USING ERRCODE = '23514';
  END IF;

  -- Validar que quien renueva sea el poseedor legítimo del token de propietario del lease
  IF v_intento.token_propietario <> p_token_propietario THEN
    RAISE EXCEPTION 'PROPIETARIO_INVALIDO: El token de propietario no coincide con el lease activo.', p_intento_id
      USING ERRCODE = '42501';
  END IF;

  -- Validar que la autorización padre continúe activa y vigente
  SELECT activo, vigente_hasta INTO v_aut
  FROM sigd_org.autorizacion_descarga_excepcional
  WHERE id_autorizacion = v_intento.id_autorizacion;

  IF v_aut.activo = FALSE OR clock_timestamp() > v_aut.vigente_hasta THEN
    RAISE EXCEPTION 'AUTORIZACION_NO_VIGENTE: La autorización extraordinaria ha expirado o ha sido revocada durante la transmisión.'
      USING ERRCODE = '23514';
  END IF;

  -- Extender lease
  v_nueva_expiracion := clock_timestamp() + (p_extension_segundos || ' seconds')::interval;

  UPDATE sigd_org.intento_descarga_excepcional
  SET expiracion_lease = v_nueva_expiracion,
      ultimo_heartbeat = clock_timestamp()
  WHERE id_intento = p_intento_id;

  RETURN jsonb_build_object(
    'exito', true,
    'intento_id', p_intento_id,
    'nueva_expiracion_lease', v_nueva_expiracion,
    'heartbeat_registrado_en', clock_timestamp()
  );
END;
$$;

-- Función atómica para finalizar la descarga (tras completitud del stream, interrupción comprobada o resultado incierto)
CREATE OR REPLACE FUNCTION sigd_org.fn_finalizar_descarga_excepcional(
  p_intento_id          UUID,
  p_token_propietario   UUID,
  p_estado_final        VARCHAR, -- 'COMPLETADO', 'FALLIDO', 'RESULTADO_INCIERTO'
  p_resultado           VARCHAR,
  p_motivo              TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_intento RECORD;
  v_aut RECORD;
  v_consumo_total BOOLEAN := FALSE;
BEGIN
  -- Validar parámetro de estado final permitido
  IF p_estado_final NOT IN ('COMPLETADO', 'FALLIDO', 'RESULTADO_INCIERTO') THEN
    RAISE EXCEPTION 'ESTADO_FINAL_INVALIDO: Solo se admite COMPLETADO, FALLIDO o RESULTADO_INCIERTO.'
      USING ERRCODE = '23514';
  END IF;

  -- Serialización concurrente atómica por intento
  PERFORM pg_advisory_xact_lock(
    hashtextextended('desc_excep_intento:' || p_intento_id::text, 0::bigint)
  );

  -- Bloqueo pesimista del intento
  SELECT * INTO v_intento
  FROM sigd_org.intento_descarga_excepcional
  WHERE id_intento = p_intento_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INTENTO_NO_ENCONTRADO: El intento de descarga % no existe.', p_intento_id
      USING ERRCODE = 'P0002';
  END IF;

  -- Validar token de propietario del lease
  IF v_intento.token_propietario <> p_token_propietario THEN
    RAISE EXCEPTION 'PROPIETARIO_INVALIDO: El token de propietario no coincide con el intento a finalizar.'
      USING ERRCODE = '42501';
  END IF;

  -- Idempotencia: Si ya no está en estado RESERVADO, retornar estado actual sin error ni duplicar consumo
  IF v_intento.estado <> 'RESERVADO' THEN
    RETURN jsonb_build_object(
      'exito', true,
      'intento_id', p_intento_id,
      'estado', v_intento.estado,
      'resultado', v_intento.resultado,
      'mensaje', 'El intento ya se encontraba en estado terminal.'
    );
  END IF;

  IF p_estado_final = 'COMPLETADO' THEN
    -- Transmisión completada satisfactoriamente en el socket de red del servidor (res.writableFinished === true)
    UPDATE sigd_org.intento_descarga_excepcional
    SET estado = 'COMPLETADO',
        finalizado_en = clock_timestamp(),
        resultado = COALESCE(p_resultado, 'TRANSFERENCIA_COMPLETADA'),
        motivo_resultado = COALESCE(p_motivo, 'Transmisión binaria completada por el servidor')
    WHERE id_intento = p_intento_id;

    -- Bloqueo de la autorización para registrar el consumo irreversible
    SELECT * INTO v_aut
    FROM sigd_org.autorizacion_descarga_excepcional
    WHERE id_autorizacion = v_intento.id_autorizacion
    FOR UPDATE;

    -- Evaluar si con esta descarga se alcanza el consumo de todos los documentos permitidos
    IF v_aut.documentos_permitidos <@ array_append(v_aut.documentos_descargados, v_intento.documento_id) THEN
      v_consumo_total := TRUE;
    END IF;

    -- Actualizar autorización
    UPDATE sigd_org.autorizacion_descarga_excepcional
    SET documentos_descargados = array_append(documentos_descargados, v_intento.documento_id),
        activo = CASE WHEN v_consumo_total THEN FALSE ELSE activo END,
        revocado_en = CASE WHEN v_consumo_total THEN clock_timestamp() ELSE revocado_en END,
        motivo_revocacion = CASE WHEN v_consumo_total THEN 'CONSUMO_TOTAL_DOCUMENTOS' ELSE motivo_revocacion END
    WHERE id_autorizacion = v_intento.id_autorizacion;

  ELSIF p_estado_final = 'FALLIDO' THEN
    -- Transmisión fallida, cancelada o interrumpida con evidencia fehaciente (res.writableFinished === false, error de socket)
    -- Al registrar FALLIDO, la reserva concluye permitiendo un nuevo intento dentro de los 15 minutos sin computar consumo
    UPDATE sigd_org.intento_descarga_excepcional
    SET estado = 'FALLIDO',
        finalizado_en = clock_timestamp(),
        resultado = COALESCE(p_resultado, 'TRANSFERENCIA_INTERRUMPIDA'),
        motivo_resultado = COALESCE(p_motivo, 'Fallo de red, socket cerrado prematuramente o error de transporte')
    WHERE id_intento = p_intento_id;

  ELSIF p_estado_final = 'RESULTADO_INCIERTO' THEN
    -- Transmisión potencialmente completada en transporte pero sin confirmación transaccional
    -- Bloqueo conservador: NO se libera la reserva para evitar segundas descargas hasta reconciliación auditable
    UPDATE sigd_org.intento_descarga_excepcional
    SET estado = 'RESULTADO_INCIERTO',
        finalizado_en = clock_timestamp(),
        resultado = COALESCE(p_resultado, 'ESTADO_INCIERTO_REQUIERE_RECONCILIACION'),
        motivo_resultado = COALESCE(p_motivo, 'Transmisión finalizada en servidor pero fallo en confirmación transaccional')
    WHERE id_intento = p_intento_id;
  END IF;

  RETURN jsonb_build_object(
    'exito', true,
    'intento_id', p_intento_id,
    'autorizacion_id', v_intento.id_autorizacion,
    'documento_id', v_intento.documento_id,
    'estado', p_estado_final,
    'resultado', COALESCE(p_resultado, p_estado_final),
    'consumo_total_alcanzado', v_consumo_total,
    'finalizado_en', clock_timestamp()
  );
END;
$$;

-- A.2.b Autorización institucional ordinaria de EXPEDIENTE_DESCARGAR por rol e institución
--       (Separación tripartita de autoridad: DIRECTOR autoriza institucionalmente,
--        ADMINISTRADOR ejecuta técnicamente sin auto-concesión, SUPER_ADMIN_PLATAFORMA control global SaaS)
CREATE TABLE IF NOT EXISTS sigd_org.autorizacion_rol_permiso_institucional (
  id_autorizacion_rol_permiso   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institucion_id                 UUID NOT NULL, -- Delimitación multi-tenant estricta por institución
  usuario_beneficiario_id        UUID REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT, -- Beneficiario individual de la asignación (obligatorio para #32)
  rol_id                         UUID NOT NULL REFERENCES sigd_org.rol_sistema(rol_id) ON DELETE RESTRICT,
  permiso_id                     UUID NOT NULL REFERENCES sigd_org.permiso_sistema(permiso_id) ON DELETE RESTRICT,
  ambito_autorizado              VARCHAR(20) NOT NULL DEFAULT 'AREA' CHECK (ambito_autorizado IN ('AREA', 'UNIDAD', 'GLOBAL_INSTITUCIONAL')),
  contexto_autorizado_id         UUID REFERENCES sigd_org.area(area_id) ON DELETE RESTRICT, -- Contexto específico (área/unidad); NULL = institucional
  tipo_autoridad_otorgante       VARCHAR(64) NOT NULL CHECK (tipo_autoridad_otorgante IN ('DIRECTOR', 'AUTORIDAD_SUPERIOR_ACREDITADA', 'SUPER_ADMIN_PLATAFORMA')),
  autoridad_otorgante_id         UUID REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT, -- NOT NULL solo si tipo = 'DIRECTOR'
  autoridad_superior_nombre      VARCHAR(160), -- Nombre de autoridad superior externa (cuando no tiene cuenta SIGD)
  autoridad_superior_cargo       VARCHAR(120), -- Cargo formal de autoridad superior competente acreditada conforme a ley
  autoridad_superior_entidad     VARCHAR(160), -- Entidad u órgano emisor formal de la autoridad superior
  acto_administrativo_tipo       VARCHAR(60),  -- Tipo de instrumento (RESOLUCION, OFICIO_AUTORITATIVO, etc.)
  acto_administrativo_numero     VARCHAR(80),  -- Número identificatorio formal del acto
  acto_administrativo_fecha      DATE,         -- Fecha oficial de expedición
  acto_administrativo_archivo_id UUID REFERENCES sigd_doc.documento_adjunto(documento_adjunto_id) ON DELETE SET NULL, -- Sustento probatorio digitalizado
  acto_administrativo_sustento   TEXT,         -- Motivación, alcance y fundamentación jurídica del acto
  ejecutor_tecnico_id            UUID REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT, -- ADMINISTRADOR institucional (NULL si SaaS)
  es_superadmin_saas             BOOLEAN NOT NULL DEFAULT FALSE, -- TRUE cuando SUPER_ADMIN_PLATAFORMA opera directamente en soporte
  super_admin_id                 UUID,         -- Identificador del superadministrador SaaS (cuando es_superadmin_saas = TRUE)
  justificacion                  TEXT NOT NULL CHECK (length(btrim(justificacion)) >= 15),
  vigente_desde                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  vigente_hasta                  TIMESTAMPTZ NOT NULL,  -- Vencimiento obligatorio para #32 EXPEDIENTE_DESCARGAR (cero asignaciones indefinidas)
  activo                         BOOLEAN NOT NULL DEFAULT TRUE,
  revocado_en                    TIMESTAMPTZ,
  revocado_por                   UUID REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
  super_admin_revocador_id       UUID,         -- Identificador del superadmin SaaS si revoca vía plataforma
  motivo_revocacion              TEXT,
  creado_en                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en                 TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Restricción 1: No auto-autorización ni auto-asignación del ejecutor institucional
  CONSTRAINT chk_auth_inst_no_auto_ejecutor CHECK (
    es_superadmin_saas = TRUE OR (
      ejecutor_tecnico_id <> autoridad_otorgante_id AND
      (usuario_beneficiario_id IS NULL OR ejecutor_tecnico_id <> usuario_beneficiario_id)
    )
  ),

  -- Restricción 1.b: Prohibición absoluta de auto-autorización del Director General
  CONSTRAINT chk_auth_inst_no_auto_director CHECK (
    tipo_autoridad_otorgante <> 'DIRECTOR' OR (
      usuario_beneficiario_id IS NULL OR autoridad_otorgante_id <> usuario_beneficiario_id
    )
  ),

  -- Restricción 2: Rango temporal válido (vencimiento posterior a inicio)
  CONSTRAINT chk_auth_inst_vigencia CHECK (
    vigente_hasta > vigente_desde
  ),

  -- Restricción 3: Consistencia estricta de estado de revocación (sin now() volátil en CHECK)
  CONSTRAINT chk_auth_inst_revocacion CHECK (
    activo = TRUE OR revocado_en IS NOT NULL
  ),

  -- Restricción 4: Acreditación obligatoria de autoridad superior externa
  CONSTRAINT chk_auth_inst_sup_acreditacion CHECK (
    tipo_autoridad_otorgante <> 'AUTORIDAD_SUPERIOR_ACREDITADA' OR (
      length(btrim(COALESCE(autoridad_superior_nombre, ''))) >= 3 AND
      length(btrim(COALESCE(autoridad_superior_cargo, ''))) >= 3 AND
      length(btrim(COALESCE(autoridad_superior_entidad, ''))) >= 3 AND
      length(btrim(COALESCE(acto_administrativo_numero, ''))) >= 3 AND
      acto_administrativo_fecha IS NOT NULL AND
      length(btrim(COALESCE(acto_administrativo_sustento, ''))) >= 15 AND
      autoridad_otorgante_id IS NULL AND
      ejecutor_tecnico_id IS NOT NULL
    )
  ),

  -- Restricción 5: Consistencia de autoridad interna DIRECTOR
  CONSTRAINT chk_auth_inst_director_emisor CHECK (
    tipo_autoridad_otorgante <> 'DIRECTOR' OR (
      autoridad_otorgante_id IS NOT NULL AND
      ejecutor_tecnico_id IS NOT NULL AND
      es_superadmin_saas = FALSE
    )
  ),

  -- Restricción 6: Consistencia de operador SaaS global
  CONSTRAINT chk_auth_inst_saas_actor CHECK (
    es_superadmin_saas = FALSE OR (
      super_admin_id IS NOT NULL AND
      tipo_autoridad_otorgante = 'SUPER_ADMIN_PLATAFORMA'
    )
  )
);

-- Unicidad de autorizaciones activas por usuario y contexto específico (evita duplicidad dentro de la misma área)
CREATE UNIQUE INDEX IF NOT EXISTS uq_auth_rol_permiso_activa_usr_ctx
  ON sigd_org.autorizacion_rol_permiso_institucional (institucion_id, usuario_beneficiario_id, rol_id, permiso_id, contexto_autorizado_id)
  WHERE activo = TRUE AND revocado_en IS NULL AND contexto_autorizado_id IS NOT NULL AND usuario_beneficiario_id IS NOT NULL;

-- Unicidad de autorizaciones activas globales por usuario dentro de la institución (cuando contexto_autorizado_id es NULL)
CREATE UNIQUE INDEX IF NOT EXISTS uq_auth_rol_permiso_activa_usr_global
  ON sigd_org.autorizacion_rol_permiso_institucional (institucion_id, usuario_beneficiario_id, rol_id, permiso_id)
  WHERE activo = TRUE AND revocado_en IS NULL AND contexto_autorizado_id IS NULL AND usuario_beneficiario_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_auth_rol_permiso_inst_usr
  ON sigd_org.autorizacion_rol_permiso_institucional (institucion_id, usuario_beneficiario_id, rol_id, activo);

CREATE INDEX IF NOT EXISTS idx_auth_rol_permiso_ctx
  ON sigd_org.autorizacion_rol_permiso_institucional (contexto_autorizado_id)
  WHERE contexto_autorizado_id IS NOT NULL;

-- Función y trigger de validación de reglas de gobernanza institucional para asignación de permisos
CREATE OR REPLACE FUNCTION sigd_org.fn_validar_autorizacion_rol_permiso_institucional()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_rol_cod           VARCHAR(30);
  v_perm_cod          VARCHAR(60);
  v_es_director       BOOLEAN;
  v_es_admin          BOOLEAN;
  v_hay_global_activa BOOLEAN;
  v_hay_ctx_activa    BOOLEAN;
BEGIN
  -- -1. Protección contra eliminación física (DELETE) para preservar auditoría WORM
  IF TG_OP = 'DELETE' THEN
    PERFORM pg_advisory_xact_lock(
      hashtextextended(
        'auth_rol_permiso:' || OLD.institucion_id::text || ':' || COALESCE(OLD.usuario_beneficiario_id::text, '00000000-0000-0000-0000-000000000000') || ':' || OLD.rol_id::text || ':' || OLD.permiso_id::text,
        0::bigint
      )
    );
    RAISE EXCEPTION 'ELIMINACION_FISICA_PROHIBIDA: Las autorizaciones institucionales son auditables y no pueden eliminarse físicamente. Utilice revocación lógica (activo = FALSE, revocado_en = clock_timestamp()).'
      USING ERRCODE = '23514';
  END IF;

  -- 0. Protección de inmutabilidad de identidad en modificaciones (UPDATE)
  IF TG_OP = 'UPDATE' THEN
    IF NEW.institucion_id <> OLD.institucion_id OR NEW.rol_id <> OLD.rol_id OR NEW.permiso_id <> OLD.permiso_id OR NEW.usuario_beneficiario_id IS DISTINCT FROM OLD.usuario_beneficiario_id THEN
      RAISE EXCEPTION 'IDENTIDAD_AUTORIZACION_INMUTABLE: No se permite modificar institucion_id, usuario_beneficiario_id, rol_id o permiso_id de una autorización existente. Debe revocar y crear una nueva.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  -- 0.b Serialización transaccional concurrente de 64 bits con LLAVE COMÚN UNIFICADA (institucion_id + usuario_beneficiario_id + rol_id + permiso_id):
  --     1. Adquisición previa: Se adquiere el lock consultivo ANTES de cualquier lectura o validación de incompatibilidad.
  --     2. Operaciones cubiertas: Aplica tanto en INSERT como en UPDATE (activaciones y revocaciones).
  --     3. Llave común: 'auth_rol_permiso:' || institucion_id || ':' || usuario_beneficiario_id || ':' || rol_id || ':' || permiso_id
  --        serializa operaciones que puedan entrar en conflicto sobre el mismo usuario y rol.
  --     4. Rigor sobre colisiones de hash: hashtextextended proyecta la cadena a un entero con signo de 64 bits;
  --        al ser un espacio discreto finito, no genera identificadores matemáticamente únicos (las colisiones teóricas
  --        son posibles por el principio del palomar). No obstante, una colisión de hash únicamente produce contención
  --        adicional de serialización (tiempo de espera determinado por la duración de la transacción concurrente, sin
  --        garantía de duración fija), y NO una vulneración de integridad por sí misma, ya que las consultas SQL posteriores
  --        dentro del trigger evalúan igualdad estricta sobre las columnas físicas.
  --     5. Dependencia transaccional: Requiere volatilidad VOLATILE y nivel de aislamiento READ COMMITTED para que, al
  --        despertar de la espera del lock, la consulta SELECT EXISTS opere sobre un snapshot fresco con los cambios confirmados.
  --     6. Estado de validación: Diseño propuesto en Fase A0; NO ha sido probado aún mediante concurrencia real en vivo
  --        (su validación empírica con cargas simultáneas está programada para la suite de pruebas de Fase D).
  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      'auth_rol_permiso:' || NEW.institucion_id::text || ':' || COALESCE(NEW.usuario_beneficiario_id::text, '00000000-0000-0000-0000-000000000000') || ':' || NEW.rol_id::text || ':' || NEW.permiso_id::text,
      0::bigint
    )
  );

  -- 1. Validar código de permiso
  SELECT codigo INTO v_perm_cod FROM sigd_org.permiso_sistema WHERE permiso_id = NEW.permiso_id;
  IF v_perm_cod IS NULL THEN
    RAISE EXCEPTION 'PERMISO_INEXISTENTE: El permiso especificado (%) no existe.', NEW.permiso_id
      USING ERRCODE = '23503';
  END IF;

  -- 2. Validar elegibilidad de rol para EXPEDIENTE_DESCARGAR y obligatoriedad de beneficiario individual
  IF v_perm_cod = 'EXPEDIENTE_DESCARGAR' THEN
    IF NEW.usuario_beneficiario_id IS NULL THEN
      RAISE EXCEPTION 'BENEFICIARIO_INDIVIDUAL_OBLIGATORIO: El permiso EXPEDIENTE_DESCARGAR (#32) exige vincularse a un usuario_beneficiario_id individual; no se admite concesión genérica a todo el rol.'
        USING ERRCODE = '23514';
    END IF;

    SELECT codigo INTO v_rol_cod FROM sigd_org.rol_sistema WHERE rol_id = NEW.rol_id;
    IF v_rol_cod IN ('ADMINISTRADOR', 'ESTUDIANTE', 'CIUDADANO', 'ESPECIALISTA', 'CAJERO', 'APROBADOR_DEVOLUCIONES', 'SUPERVISOR_TESORERIA') THEN
      RAISE EXCEPTION 'ROL_NO_ELEGIBLE: El rol "%" no es elegible para la asignación institucional de EXPEDIENTE_DESCARGAR.', v_rol_cod
        USING ERRCODE = '23514';
    END IF;

    -- 3. Regla de vencimiento obligatorio para EXPEDIENTE_DESCARGAR (#32): cero asignaciones indefinidas
    IF NEW.vigente_hasta IS NULL THEN
      RAISE EXCEPTION 'VENCIMIENTO_OBLIGATORIO_PERMISO_32: El permiso EXPEDIENTE_DESCARGAR (#32) exige una fecha de vencimiento obligatoria cierta (vigente_hasta NOT NULL); no se admiten autorizaciones indefinidas.'
        USING ERRCODE = '23514';
    END IF;

    -- 3.b Regla para DIRECTOR: prohibida auto-autorización, requiere autoridad jerárquica superior competente y formalmente acreditada
    IF v_rol_cod = 'DIRECTOR' THEN
      IF NEW.tipo_autoridad_otorgante = 'DIRECTOR' OR NEW.autoridad_otorgante_id = NEW.usuario_beneficiario_id THEN
        RAISE EXCEPTION 'AUTO_AUTORIZACION_PROHIBIDA: El DIRECTOR no puede autorizarse EXPEDIENTE_DESCARGAR a sí mismo. Requiere autorización de autoridad jerárquica superior competente y formalmente acreditada.'
          USING ERRCODE = '23514';
      END IF;
      IF NEW.tipo_autoridad_otorgante <> 'AUTORIDAD_SUPERIOR_ACREDITADA' THEN
        RAISE EXCEPTION 'AUTORIDAD_INVALIDA_DIRECTOR: La concesión a DIRECTOR solo puede provenir de AUTORIDAD_SUPERIOR_ACREDITADA.'
          USING ERRCODE = '23514';
      END IF;
      IF NEW.ambito_autorizado <> 'GLOBAL_INSTITUCIONAL' THEN
        RAISE EXCEPTION 'AMBITO_INVALIDO_DIRECTOR: La concesión a DIRECTOR debe tener ámbito GLOBAL_INSTITUCIONAL.'
          USING ERRCODE = '23514';
      END IF;
    END IF;

    -- 4. Validación de compatibilidad de ámbitos por rol
    IF v_rol_cod IN ('COORDINADOR_AREA', 'SECRETARIO', 'MESA_PARTES', 'DOCENTE', 'TESORERO') AND NEW.ambito_autorizado = 'GLOBAL_INSTITUCIONAL' THEN
      RAISE EXCEPTION 'AMBITO_EXCESIVO: El rol "%" no puede recibir ámbito GLOBAL_INSTITUCIONAL; debe delimitarse a AREA.', v_rol_cod
        USING ERRCODE = '23514';
    END IF;
    IF v_rol_cod = 'JEFE_UNIDAD_ACADEMICA' AND NEW.ambito_autorizado = 'GLOBAL_INSTITUCIONAL' THEN
      RAISE EXCEPTION 'AMBITO_EXCESIVO: El rol JEFE_UNIDAD_ACADEMICA no puede recibir ámbito GLOBAL_INSTITUCIONAL; debe delimitarse a UNIDAD o AREA.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  -- 4.b Validación de existencia y vigencia de contexto orgánico en sigd_org.area (si aplica)
  IF NEW.contexto_autorizado_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM sigd_org.area WHERE area_id = NEW.contexto_autorizado_id AND vigente = TRUE) THEN
      RAISE EXCEPTION 'AREA_INVALIDA: El área orgánica especificada en contexto_autorizado_id (%) no existe o no está vigente.', NEW.contexto_autorizado_id
        USING ERRCODE = '23503';
    END IF;
  END IF;

  -- 5. Control de autorizaciones activas incompatibles (evaluado tras adquirir el advisory lock)
  IF NEW.activo = TRUE AND NEW.revocado_en IS NULL THEN
    IF NEW.contexto_autorizado_id IS NULL THEN
      -- Se intenta activar global: verificar que no haya específicas activas para el mismo usuario/rol
      SELECT EXISTS (
        SELECT 1 FROM sigd_org.autorizacion_rol_permiso_institucional
         WHERE institucion_id = NEW.institucion_id
           AND (
             (NEW.usuario_beneficiario_id IS NOT NULL AND usuario_beneficiario_id = NEW.usuario_beneficiario_id)
             OR (NEW.usuario_beneficiario_id IS NULL AND usuario_beneficiario_id IS NULL)
           )
           AND rol_id = NEW.rol_id
           AND permiso_id = NEW.permiso_id
           AND contexto_autorizado_id IS NOT NULL
           AND activo = TRUE
           AND revocado_en IS NULL
           AND id_autorizacion_rol_permiso <> COALESCE(NEW.id_autorizacion_rol_permiso, '00000000-0000-0000-0000-000000000000'::uuid)
      ) INTO v_hay_ctx_activa;
      IF v_hay_ctx_activa THEN
        RAISE EXCEPTION 'AUTORIZACION_INCOMPATIBLE: Existen autorizaciones activas específicas por área para este usuario/rol; deben revocarse antes de emitir una autorización global.'
          USING ERRCODE = '23514';
      END IF;
    ELSE
      -- Se intenta activar específica: verificar que no haya una global activa para el mismo usuario/rol
      SELECT EXISTS (
        SELECT 1 FROM sigd_org.autorizacion_rol_permiso_institucional
         WHERE institucion_id = NEW.institucion_id
           AND (
             (NEW.usuario_beneficiario_id IS NOT NULL AND usuario_beneficiario_id = NEW.usuario_beneficiario_id)
             OR (NEW.usuario_beneficiario_id IS NULL AND usuario_beneficiario_id IS NULL)
           )
           AND rol_id = NEW.rol_id
           AND permiso_id = NEW.permiso_id
           AND contexto_autorizado_id IS NULL
           AND activo = TRUE
           AND revocado_en IS NULL
           AND id_autorizacion_rol_permiso <> COALESCE(NEW.id_autorizacion_rol_permiso, '00000000-0000-0000-0000-000000000000'::uuid)
      ) INTO v_hay_global_activa;
      IF v_hay_global_activa THEN
        RAISE EXCEPTION 'AUTORIZACION_INCOMPATIBLE: Ya existe una autorización global activa para este usuario/rol en la institución; no procede autorizar un área individual redundante.'
          USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;

  -- 6. Validar rol de ejecutor y autoridad si no es SUPER_ADMIN_PLATAFORMA
  IF NEW.es_superadmin_saas = FALSE THEN
    -- El ejecutor debe tener rol ADMINISTRADOR activo
    SELECT EXISTS (
      SELECT 1 FROM sigd_org.usuario_rol ur
      JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id
      WHERE ur.id_usuario = NEW.ejecutor_tecnico_id
        AND r.codigo = 'ADMINISTRADOR'
        AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
    ) INTO v_es_admin;
    IF NOT v_es_admin THEN
      RAISE EXCEPTION 'EJECUTOR_INVALIDO: El ejecutor técnico institucional (%) debe ostentar el rol ADMINISTRADOR vigente.', NEW.ejecutor_tecnico_id
        USING ERRCODE = '23514';
    END IF;

    -- Si la autoridad es DIRECTOR, debe tener el rol DIRECTOR activo en la institución
    IF NEW.tipo_autoridad_otorgante = 'DIRECTOR' THEN
      SELECT EXISTS (
        SELECT 1 FROM sigd_org.usuario_rol ur
        JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id
        WHERE ur.id_usuario = NEW.autoridad_otorgante_id
          AND r.codigo = 'DIRECTOR'
          AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
      ) INTO v_es_director;
      IF NOT v_es_director THEN
        RAISE EXCEPTION 'AUTORIZADOR_INVALIDO: La autoridad otorgante (%) debe ostentar el rol DIRECTOR vigente.', NEW.autoridad_otorgante_id
          USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;

  NEW.actualizado_en := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_validar_autorizacion_rol_permiso_inst ON sigd_org.autorizacion_rol_permiso_institucional;
CREATE TRIGGER tr_validar_autorizacion_rol_permiso_inst
  BEFORE INSERT OR UPDATE OR DELETE ON sigd_org.autorizacion_rol_permiso_institucional
  FOR EACH ROW
  EXECUTE FUNCTION sigd_org.fn_validar_autorizacion_rol_permiso_institucional();

-- A.3 Auditoría Privilegiada SaaS Independiente (SEPARADA de bitacora_acceso_documental institucional)
--     Registra actuaciones globales de SUPER_ADMIN_PLATAFORMA sin mezclarse con roles institucionales
--     (el esquema sigd_saas dentro de la MISMA base sigd_jacobo_demo, y sus tablas
--      sigd_saas.cuenta_super_admin_plataforma / sesion_super_admin_plataforma son PROPUESTAS
--      para implementación posterior; aquí super_admin_id no exige FK en cuenta_usuario).
CREATE TABLE IF NOT EXISTS sigd_audit.bitacora_superadmin_saas (
  id_evento_saas              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha_hora                  TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  super_admin_id              UUID NOT NULL,
  usuario_plataforma          VARCHAR(120) NOT NULL,
  sesion_saas_id              UUID NOT NULL,
  mfa_verificado              BOOLEAN NOT NULL CHECK (mfa_verificado = TRUE),
  metodo_mfa                  VARCHAR(32) NOT NULL, -- Suministrado por proceso de autenticación verificado en servidor (TOTP, WebAuthn, FIDO2, etc.; sin default estático)
  mfa_verificado_en           TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  mfa_evento_ref              VARCHAR(128), -- Referencia o huella del evento de autenticación verificado en servidor
  correlation_id              UUID NOT NULL,
  institucion_id              UUID,
  institucion_codigo          VARCHAR(80),
  tipo_evento                 VARCHAR(48) NOT NULL CHECK (tipo_evento IN (
    'SAAS_LOGIN_MFA',
    'SAAS_VISITA_INSTITUCION',
    'SAAS_CONSULTA_BANDEJA',
    'SAAS_CONSULTA_EXPEDIENTE',
    'SAAS_VISUALIZACION_DOCUMENTO',
    'SAAS_DESCARGA_DOCUMENTO',
    'SAAS_CONSULTA_TRAZABILIDAD',
    'SAAS_ADMIN_CONFIGURACION_GLOBAL',
    'SAAS_ADMIN_USUARIOS_PLATAFORMA',
    'SAAS_OTORGAMIENTO_PERMISO_GLOBAL',
    'SAAS_REVOCACION_PERMISO_GLOBAL',
    'SAAS_ACCESO_DENEGADO_O_REVOCADO'
  )),
  resultado                   VARCHAR(16) NOT NULL CHECK (resultado IN ('PERMITIDO', 'DENEGADO')),
  codigo_http                 SMALLINT NOT NULL,
  expediente_id               UUID REFERENCES sigd_tra.expediente(expediente_id) ON DELETE RESTRICT,
  documento_id                UUID REFERENCES sigd_doc.documento_adjunto(documento_adjunto_id) ON DELETE RESTRICT,
  nombre_logico_archivo       VARCHAR(255),
  s3_bucket                   VARCHAR(120),
  s3_key                      VARCHAR(500),
  es_confidencial             BOOLEAN NOT NULL DEFAULT FALSE,
  justificacion_confidencial  TEXT,
  indicador_anomalia          VARCHAR(64), -- p. ej. DESCARGA_MASIVA, MULTI_TENANT_RAFAGA
  ip_origen                   INET,
  user_agent                  VARCHAR(512),
  CONSTRAINT chk_saas_confidencial_justif CHECK (
    es_confidencial = FALSE OR length(btrim(COALESCE(justificacion_confidencial, ''))) >= 15
  )
);

CREATE INDEX IF NOT EXISTS idx_bitacora_saas_actor ON sigd_audit.bitacora_superadmin_saas (super_admin_id, fecha_hora DESC);
CREATE INDEX IF NOT EXISTS idx_bitacora_saas_inst  ON sigd_audit.bitacora_superadmin_saas (institucion_id, fecha_hora DESC);
CREATE INDEX IF NOT EXISTS idx_bitacora_saas_exp   ON sigd_audit.bitacora_superadmin_saas (expediente_id, fecha_hora DESC);
CREATE INDEX IF NOT EXISTS idx_bitacora_saas_anom  ON sigd_audit.bitacora_superadmin_saas (indicador_anomalia, fecha_hora DESC)
  WHERE indicador_anomalia IS NOT NULL;

CREATE OR REPLACE FUNCTION sigd_audit.fn_bitacora_saas_inmutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'BITACORA_SAAS_INMUTABLE: sigd_audit.bitacora_superadmin_saas es append-only para cuentas ordinarias; % bloqueado.', TG_OP
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS tr_bitacora_saas_inmutable ON sigd_audit.bitacora_superadmin_saas;
CREATE TRIGGER tr_bitacora_saas_inmutable
  BEFORE UPDATE OR DELETE OR TRUNCATE ON sigd_audit.bitacora_superadmin_saas
  FOR EACH STATEMENT
  EXECUTE FUNCTION sigd_audit.fn_bitacora_saas_inmutable();

-- DCL de defensa en profundidad para rol de aplicación (separación de privilegios):
-- El usuario de aplicación (sigd_app) solo tiene permisos de lectura e inserción en la bitácora SaaS.
-- Se revoca explícitamente UPDATE, DELETE y TRUNCATE para impedir mutaciones ordinarias.
GRANT SELECT, INSERT ON sigd_audit.bitacora_superadmin_saas TO sigd_app;
REVOKE UPDATE, DELETE, TRUNCATE ON sigd_audit.bitacora_superadmin_saas FROM sigd_app;

-- Nota de seguridad y límites de inmutabilidad (Tres niveles de defensa):
-- 1. Capa aplicativa: Middleware y servicios SaaS solo ejecutan inserciones automáticas ante eventos privilegiados.
-- 2. Capa PostgreSQL: Trigger BEFORE UPDATE/DELETE/TRUNCATE y DCL con revocación a sigd_app.
--    Límite técnico honesto: El propietario de la tabla (owner) o superusuario (postgres) conservan privilegios DDL
--    para desactivar triggers o modificar el esquema. La protección en PostgreSQL es append-only para roles de aplicación,
--    pero NO garantiza WORM absoluto frente a superusuarios del motor de base de datos o accesos root al host.
-- 3. Inmutabilidad externa: La inmutabilidad probatoria WORM real exige replicación asíncrona continua fuera del host
--    hacia un almacenamiento inmutable externo (S3 Object Lock en modo Compliance o SIEM inmutable independiente).

-- Verificación de dependencia obligatoria respecto a migración 22_
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sigd_org.permiso_sistema WHERE codigo = 'EXPEDIENTE_DESCARGAR' AND vigente = TRUE) THEN
    RAISE EXCEPTION 'DEPENDENCIA_FALTANTE_22: La migración 23_ requiere el catálogo RBAC (incl. EXPEDIENTE_DESCARGAR) creado por la migración 22_.';
  END IF;
  IF to_regclass('sigd_org.encargatura_permiso') IS NULL THEN
    RAISE EXCEPTION 'DEPENDENCIA_FALTANTE_22: La migración 23_ requiere las estructuras RBAC previas de la migración 22_.';
  END IF;
END $$;

COMMIT;
*/
-- Estado del script completo: NO EJECUTADO — DOCUMENTO DE DISEÑO
