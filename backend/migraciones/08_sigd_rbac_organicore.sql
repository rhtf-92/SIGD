-- =============================================================================
-- 08 - RBAC de OrganiCore: roles canonicos, catalogo de permisos y matriz
--      (migracion ADITIVA, compatible con 03_sigd_org.sql)
-- =============================================================================
-- CONTRATO DE COMPATIBILIDAD
-- --------------------------
-- Este script NO redefine ninguna tabla de `03_sigd_org.sql`. Solo:
--   1. AMPLIA el CHECK `chk_rol_codigo` con los 5 codigos de OrganiCore,
--      conservando los 6 de CoreLink (unica union; no se elimina ninguno).
--   2. Inserta filas nuevas con `ON CONFLICT DO NOTHING` (idempotente).
--   3. Crea una tabla nueva de alcance de subareas.
--
-- Nombres canonicos respetados (los de `03_sigd_org.sql`):
--   rol_sistema      -> `vigente`          (NO `activo`)
--   permiso_sistema  -> `nombre`, `ambito` (NO `descripcion`,
--                                          NO `alcance_predetermido`)
--                       `ambito` SOLO admite 'AREA' o 'GLOBAL'.
--   usuario_rol      -> `id_usuario`, `vigente_desde`, `vigente_hasta`
--                       (NO `cuenta_id`, NO `vigencia`)
--
-- Las columnas `vigente` de rol_sistema y el catalogo de permisos NO se tocan:
-- los 6 roles y los 6 permisos que `03` ya sembró permanecen intactos.
-- -----------------------------------------------------------------------------

-- =============================================================================
-- 8.1 Ampliar el catalogo de roles admitidos
-- =============================================================================
-- `03` restringe `codigo` a los 6 roles de CoreLink. OrganiCore requiere
-- SUPER_ADMIN, DIRECTOR, DOCENTE, MESA_PARTES y ESTUDIANTE. DIRECTOR y
-- MESA_PARTES ya coexisten; los otros tres se agregan. Ningun codigo previo
-- se elimina, de modo que los modulos de CoreLink y B_HECTOR siguen validos.

ALTER TABLE sigd_org.rol_sistema DROP CONSTRAINT IF EXISTS chk_rol_codigo;

ALTER TABLE sigd_org.rol_sistema
    ADD CONSTRAINT chk_rol_codigo CHECK (
        codigo IN (
            -- Roles canónicos de OrganiCore (5)
            'SUPER_ADMIN',
            'DIRECTOR',
            'DOCENTE',
            'MESA_PARTES',
            'ESTUDIANTE',
            -- Roles canónicos de CoreLink (6), preservados de `03`
            'ADMINISTRADOR',
            'SECRETARIO',
            'ESPECIALISTA',
            'CIUDADANO'
        )
    );

-- =============================================================================
-- 8.2 Semilla de los 5 roles canonicos de OrganiCore
-- =============================================================================
-- `descripcion` existe en `rol_sistema` y es nullable, pero se completa porque
-- la trazabilidad de SUPER_ADMIN es requisito del DoD de OC-09.

INSERT INTO sigd_org.rol_sistema (codigo, nombre, descripcion) VALUES
  ('SUPER_ADMIN', 'Superadministrador',
   'Administración técnica total del sistema. Su trazabilidad queda registrada en sigd_audit y sigue sujeta a los triggers de inmutabilidad WORM.'),
  ('DIRECTOR', 'Director',
   'Supervisión de áreas, aprobación y observancia de trámites, y consulta de auditoría.'),
  ('DOCENTE', 'Docente',
   'Atención y resolución de trámites asignados, firma y carga académica.'),
  ('MESA_PARTES', 'Mesa de Partes',
   'Radicación, clasificación y derivación inicial de expedientes.'),
  ('ESTUDIANTE', 'Estudiante',
   'Radicación de escritos propios, consulta de sus expedientes y adjuntos.')
ON CONFLICT (codigo) DO NOTHING;

-- =============================================================================
-- 8.3 Modelo de alcance de subareas (aditivo, sin tocar `ambito`)
-- =============================================================================
-- `03` fija `permiso_sistema.ambito IN ('AREA','GLOBAL')`. OrganiCore necesita
-- un permiso cuyo alcance se narrowed a subareas concretas (`derivacion.ejecutar`).
-- En vez de romper ese CHECK, la restriccion se modela aparte: un permiso esta
-- restringido a subareas SI tiene al menos una fila en esta tabla, y las areas
-- listadas son las unicas que lo conceden.
--
-- `solo_descendientes = TRUE` (por defecto) hace que cada area listada conceda
-- tambien su subarbol ltree. Con cero filas el permiso NO esta restringido: es
-- el comportamiento identico al actual, por lo que la migracion no altera el
--funcionamiento de ningun modulo desplegado. La restriccion se activa cuando se
-- carguen filas, y `RbacService.usuarioTienePermiso` ya la evalua.
--
-- No se siembran filas a proposito: `03` no define areas de la institucion, y
-- sembrar codigos de area inventados seria inventar datos.

CREATE TABLE IF NOT EXISTS sigd_org.permiso_restriccion_area (
    permiso_id         UUID        NOT NULL
                       REFERENCES sigd_org.permiso_sistema (permiso_id)
                       ON DELETE CASCADE,
    area_id            UUID        NOT NULL
                       REFERENCES sigd_org.area (area_id)
                       ON DELETE CASCADE,
    solo_descendientes BOOLEAN     NOT NULL DEFAULT TRUE,
    CONSTRAINT pk_permiso_restriccion_area PRIMARY KEY (permiso_id, area_id)
);

CREATE INDEX IF NOT EXISTS idx_permiso_restriccion_area_area
    ON sigd_org.permiso_restriccion_area (area_id);

COMMENT ON TABLE sigd_org.permiso_restriccion_area IS
  'Alcance efectivo por subarea de un permiso con ambito=AREA. La presencia de '
  'filas restringe el permiso a esas areas (y a su subarbol si solo_descendientes). '
  'Sin filas el permiso conserva el alcance AREA completo de 03_sigd_org.sql.';

-- =============================================================================
-- 8.4 Catalogo de permisos atomicos de OrganiCore (54 permisos)
-- =============================================================================
-- Nomenclatura: `dominio.accion` en minusculas, coherente con
-- `docs/02_organicore/03_datos_prueba_organizacion.sql`.
-- `descripcion` -> `nombre` y `alcance_predeterminado` -> `ambito`, con las
-- columnas reales de `03_sigd_org.sql`. `derivacion.ejecutar` usaba SUBAREAS y
-- pasa a 'AREA'; su restriccion a subareas la aporta 8.3.

INSERT INTO sigd_org.permiso_sistema (codigo, nombre, ambito) VALUES
  -- Expediente (5)
  ('expediente.ver',          'Consultar expedientes',                                 'AREA'),
  ('expediente.crear',        'Crear expedientes',                                     'AREA'),
  ('expediente.editar',       'Editar datos de un expediente',                          'AREA'),
  ('expediente.anular',       'Anular un expediente',                                   'AREA'),
  ('expediente.eliminar',     'Eliminar lógicamente un expediente',                      'AREA'),
  -- Radicación (4)
  ('radicacion.registrar',    'Registrar escritos en mesa de partes',                   'AREA'),
  ('radicacion.corregir',     'Corregir datos de una radicación',                       'AREA'),
  ('radicacion.rechazar',     'Rechazar una radicación por incompleta',                 'AREA'),
  ('radicacion.duplicar',     'Duplicar una radicación existente',                      'AREA'),
  -- Derivación (4)
  ('derivacion.ver',          'Consultar el historial de derivaciones',                 'AREA'),
  ('derivacion.ejecutar',     'Derivar un expediente a otra área',                      'AREA'),
  ('derivacion.reasignar',    'Reasignar un expediente ya derivado',                    'AREA'),
  ('derivacion.cancelar',     'Cancelar una derivación',                               'AREA'),
  -- Atención (5)
  ('atencion.ver',            'Consultar la bandeja de atención',                      'AREA'),
  ('atencion.atender',        'Registrar la atención de un expediente',                 'AREA'),
  ('atencion.observar',       'Observar un expediente y requerir subsanación',         'AREA'),
  ('atencion.desobligar',     'Levantar una observación previa',                       'AREA'),
  ('atencion.finalizar',      'Finalizar un expediente',                               'AREA'),
  -- Plazos (2)
  ('plazo.extender',          'Extender el plazo de atención',                          'AREA'),
  ('plazo.suspender',         'Suspender el cómputo de un plazo',                       'AREA'),
  -- Adjuntos (4)
  ('adjunto.adjuntar',        'Adjuntar documentos a un expediente',                    'AREA'),
  ('adjunto.descargar',       'Descargar adjuntos de un expediente',                    'AREA'),
  ('adjunto.eliminar',        'Eliminar adjuntos de un expediente',                     'AREA'),
  ('adjunto.sustituir',       'Sustituir un adjunto por una versión nueva',             'AREA'),
  -- Firma (4)
  ('firma.solicitar',         'Solicitar la firma de un documento',                     'AREA'),
  ('firma.firmar',            'Firmar electrónicamente un documento',                   'AREA'),
  ('firma.anular',            'Anular una firma emitida',                              'AREA'),
  ('firma.ver',               'Verificar la validez de una firma',                      'AREA'),
  -- Mesa de Partes (2)
  ('mesa_partes.registrar',   'Registrar el ingreso de un documento en mesa de partes', 'AREA'),
  ('mesa_partes.clasificar',  'Clasificar un documento según su tipo documental',       'AREA'),
  -- Docente (2)
  ('docente.gestionar',       'Gestionar la carga académica asignada',                 'GLOBAL'),
  ('docente.consultar_carga', 'Consultar la propia carga académica',                   'GLOBAL'),
  -- Dirección (3)
  ('director.aprobar',        'Aprobar actos administrativos',                         'GLOBAL'),
  ('director.observar',       'Observar actos administrativos de las áreas',           'GLOBAL'),
  ('director.supervisar',     'Supervisar la operación de las áreas',                   'GLOBAL'),
  -- Organización (5)
  ('area.crear',              'Crear áreas y unidades organizacionales',                'GLOBAL'),
  ('area.editar',             'Editar datos de un área',                               'GLOBAL'),
  ('area.desactivar',         'Desactivar un área',                                     'GLOBAL'),
  ('area.asignar_responsable','Asignar o cambiar el responsable de un área',            'GLOBAL'),
  ('area.ver_organigrama',    'Consultar el organigrama institucional',                 'GLOBAL'),
  -- Roles (4)
  ('rol.ver',                 'Consultar la matriz de roles y permisos',                'GLOBAL'),
  ('rol.crear',               'Crear roles del sistema',                                'GLOBAL'),
  ('rol.editar',              'Editar datos de un rol',                                 'GLOBAL'),
  ('rol.asignar',             'Asignar roles a cuentas',                                'GLOBAL'),
  -- Usuarios (3)
  ('usuario.ver',             'Consultar datos de usuarios',                           'GLOBAL'),
  ('usuario.editar',          'Editar datos de usuarios',                              'GLOBAL'),
  ('usuario.desactivar',      'Desactivar cuentas de usuario',                         'GLOBAL'),
  -- Auditoría (2)
  ('auditoria.ver',           'Consultar la bitácora de auditoría',                    'GLOBAL'),
  ('auditoria.exportar',      'Exportar la bitácora de auditoría',                     'GLOBAL'),
  -- Configuración (2)
  ('configuracion.ver',       'Consultar los parámetros del sistema',                  'GLOBAL'),
  ('configuracion.editar',    'Modificar los parámetros del sistema',                  'GLOBAL'),
  -- Reportes (2)
  ('reporte.generar',         'Generar reportes de gestión',                           'GLOBAL'),
  ('reporte.ver',             'Consultar reportes de gestión',                         'GLOBAL'),
  -- Gestión de la propia matriz (1)
  ('permiso.gestionar',       'Modificar la matriz de permisos de un rol',              'GLOBAL')
ON CONFLICT (codigo) DO NOTHING;

-- =============================================================================
-- 8.5 Matriz rol -> permisos (N:M efectiva)
-- =============================================================================

-- 8.5.1 SUPER_ADMIN: administracion tecnica completa. El CROSS JOIN le concede
--       tambien los 6 permisos de CoreLink que `03` ya sembro.
INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
  FROM sigd_org.rol_sistema r
 CROSS JOIN sigd_org.permiso_sistema p
 WHERE r.codigo = 'SUPER_ADMIN'
ON CONFLICT DO NOTHING;

-- 8.5.2 DIRECTOR: supervision, aprobacion y observancia. Sin gestion de la matriz.
INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
  FROM sigd_org.rol_sistema r
  JOIN sigd_org.permiso_sistema p ON p.codigo IN (
    'expediente.ver','atencion.ver','atencion.observar','atencion.finalizar',
    'director.aprobar','director.observar','director.supervisar',
    'area.editar','area.asignar_responsable','area.ver_organigrama',
    'rol.ver','usuario.ver','auditoria.ver',
    'firma.ver','derivacion.ver',
    'radicacion.registrar','radicacion.rechazar',
    'plazo.extender','plazo.suspender',
    'reporte.generar','reporte.ver')
 WHERE r.codigo = 'DIRECTOR'
ON CONFLICT DO NOTHING;

-- 8.5.3 DOCENTE: atencion, firma y carga propia. Sin configuracion ni auditoria.
INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
  FROM sigd_org.rol_sistema r
  JOIN sigd_org.permiso_sistema p ON p.codigo IN (
    'expediente.ver','atencion.ver','atencion.atender','atencion.observar',
    'atencion.desobligar','atencion.finalizar',
    'firma.solicitar','firma.firmar','firma.ver','firma.anular',
    'adjunto.adjuntar','adjunto.descargar','adjunto.sustituir',
    'plazo.extender','docente.gestionar','docente.consultar_carga',
    'derivacion.ejecutar','reporte.ver')
 WHERE r.codigo = 'DOCENTE'
ON CONFLICT DO NOTHING;

-- 8.5.4 MESA_PARTES: radicacion, clasificacion y derivacion. Sin firma ni aprobacion.
INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
  FROM sigd_org.rol_sistema r
  JOIN sigd_org.permiso_sistema p ON p.codigo IN (
    'radicacion.registrar','radicacion.corregir','radicacion.rechazar','radicacion.duplicar',
    'derivacion.ver','derivacion.ejecutar','derivacion.reasignar',
    'mesa_partes.registrar','mesa_partes.clasificar',
    'expediente.crear','expediente.ver','expediente.editar',
    'adjunto.adjuntar','adjunto.descargar','adjunto.eliminar')
 WHERE r.codigo = 'MESA_PARTES'
ON CONFLICT DO NOTHING;

-- 8.5.5 ESTUDIANTE: minimo privilegio. Ninguna funcion administrativa, ninguna
--       configuracion, ningun acceso a la auditoria y ninguna firma a su nombre.
INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
  FROM sigd_org.rol_sistema r
  JOIN sigd_org.permiso_sistema p ON p.codigo IN (
    'radicacion.registrar','expediente.ver',
    'adjunto.adjuntar','adjunto.descargar',
    'firma.solicitar','firma.ver','reporte.ver')
 WHERE r.codigo = 'ESTUDIANTE'
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 8.6 Verificacion de integridad (aborta la migracion si algo no cuadra)
-- =============================================================================
-- El runner DDL (`src/db/migrate.ts`) sella cada script con un checksum SHA-256
-- que invalida cualquier edicion posterior, y este entorno no dispone de
-- PostgreSQL para una ejecucion de prueba. Por eso la migracion se autocomprueba
-- con un DO block: si una asercion falla, el script lanza excepcion y no se
-- registra en `public.sigd_migraciones`.

DO $$
DECLARE
    faltan_rol    TEXT;
    permisos_chk  INTEGER;
    roles_chk     TEXT;
BEGIN
    SELECT string_agg(c.codigo, ', ')
      INTO faltan_rol
      FROM unnest(ARRAY['SUPER_ADMIN','DIRECTOR','DOCENTE','MESA_PARTES','ESTUDIANTE']) AS c(codigo)
     WHERE NOT EXISTS (SELECT 1 FROM sigd_org.rol_sistema r WHERE r.codigo = c.codigo);

    IF faltan_rol IS NOT NULL THEN
        RAISE EXCEPTION 'OC-09: no se pudieron sembrar los roles canonicos: %', faltan_rol;
    END IF;

    SELECT count(*) INTO permisos_chk
      FROM sigd_org.permiso_sistema
     WHERE codigo LIKE '%.%';

    IF permisos_chk < 30 THEN
        RAISE EXCEPTION 'OC-09: el catalogo de permisos atomicos quedo en %, se exigen >= 30', permisos_chk;
    END IF;

    -- Los 5 roles deben tener al menos un permiso en la matriz.
    SELECT string_agg(c.codigo, ', ')
      INTO roles_chk
      FROM unnest(ARRAY['SUPER_ADMIN','DIRECTOR','DOCENTE','MESA_PARTES','ESTUDIANTE']) AS c(codigo)
     WHERE NOT EXISTS (
        SELECT 1
          FROM sigd_org.rol_sistema r
          JOIN sigd_org.rol_permiso rp ON rp.rol_id = r.rol_id
         WHERE r.codigo = c.codigo);

    IF roles_chk IS NOT NULL THEN
        RAISE EXCEPTION 'OC-09: roles canonicos sin permisos en la matriz: %', roles_chk;
    END IF;

    -- CASO DENEGADO (OC-12): ESTUDIANTE no administra roles, ni configura, ni audita.
    IF EXISTS (
        SELECT 1
          FROM sigd_org.rol_permiso rp
          JOIN sigd_org.rol_sistema r     ON r.rol_id     = rp.rol_id
          JOIN sigd_org.permiso_sistema p ON p.permiso_id = rp.permiso_id
         WHERE r.codigo = 'ESTUDIANTE'
           AND p.codigo IN ('permiso.gestionar','rol.editar','configuracion.editar','auditoria.ver')
    ) THEN
        RAISE EXCEPTION 'OC-12: ESTUDIANTE tiene permisos administrativos prohibidos';
    END IF;
END
$$;