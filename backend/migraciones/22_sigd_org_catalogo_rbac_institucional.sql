-- ============================================================================
-- SIGD IESTP PÚBLICO «SUIZA» — PUCALLPA, UCAYALI
-- RAMA EXCLUSIVA: B_JACOBO | BASE EXCLUSIVA: sigd_jacobo_demo (PostgreSQL 18.6)
-- MIGRACIÓN OFICIAL: 22_sigd_org_catalogo_rbac_institucional.sql
-- FASE: TSK-1.2 FASE A (MATERIALIZADO PARA EJECUCIÓN CONTROLADA)
--
-- CONTENIDO:
--   1. Catálogo de 10 roles canónicos institucionales y 4 históricos preservados.
--   2. Catálogo de 32 permisos en sigd_org.permiso_sistema (#1..#32).
--   3. Matriz sigd_org.rol_permiso y retiro de FIRMA_FIRMAR/EXPEDIENTE_RESOLVER de ADMINISTRADOR.
--   4. Subsistema de capacidades operativas (GESTOR_APOYO_AREA).
--   5. Asignación de expedientes, custodias y evaluadores colegiados (sigd_rut).
--   6. Extensión FSM de cierre administrativo de expedientes (sigd_doc, sigd_rut).
--   7. Extensión de encargaturas de despacho y permisos temporales (sigd_org).
--   8. Comprobaciones de integridad post-migración.
--
-- REGLA DE migrate.ts: Registro en public.sigd_migraciones gestionado exclusivamente por el runner.
-- FUENTE DE VERDAD: docs/TSK_1_2_A0_SQL_PROPUESTO_NO_EJECUTADO.sql (Líneas 1-964)
-- ============================================================================

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
