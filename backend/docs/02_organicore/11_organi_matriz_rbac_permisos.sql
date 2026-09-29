/*
=========================================================
Grupo 3 — OrganiCore · Matriz RBAC y catálogo de permisos
Proyecto: Sistema Integral de Gestión Documentaria (SIGD)
Responsable: Geiner Panaifo (B_PANAIFO)
Motor: PostgreSQL 18.6
Categoría global: PROPUESTO — la matriz no tiene valor institucional oficial

ESTE SCRIPT ES IDEMPOTENTE: puede ejecutarse repetidamente y sobre una base vacía.
No crea credenciales, contraseñas ni datos personales reales.

REGLAS APLICADAS
  1. Mínimo privilegio: ningún permiso se concede por defecto. Un rol sin fila en
     sigd_org.rol_permiso no tiene ningún permiso, incluido SUPER_ADMIN.
  2. Los roles y permisos NO se declaran como constantes en el backend. La
     autorización lee siempre esta matriz desde PostgreSQL.
  3. Los permisos se relacionan por identificador (rol_permiso), nunca por texto
     duplicado ni por listas separadas por comas.

Sobre los triggers WORM
  La inmutabilidad de sigd_audit y sigd_doc se resuelve con triggers definidos en
  PostgreSQL. El RBAC es una capa de aplicación y NO los elude: el rol SUPER_ADMIN
  tiene permisos administrativos completos, pero sigue sin poder deshabilitar
  triggers, alterar session_replication_role ni modificar la bitácora. Toda
  mutación de la matriz se registra en sigd_audit.bitacora_auditoria mediante
  registrarMutacion(), de modo que el rastro es verificable por un tercero.
=========================================================
*/

CREATE SCHEMA IF NOT EXISTS sigd_org;

-- ======================================================
-- 1. ESTRUCTURA (idempotente, idéntica al DDL oficial
--    docs/02_organicore/03_esquema_sigd_org_v2.sql)
-- ======================================================

CREATE TABLE IF NOT EXISTS sigd_org.rol_sistema (
    rol_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(50) NOT NULL UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sigd_org.permiso_sistema (
    permiso_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    alcance_predeterminado VARCHAR(20) NOT NULL DEFAULT 'AREA',
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT ck_permiso_alcance
        CHECK (alcance_predeterminado IN ('AREA', 'SUBAREAS', 'GLOBAL'))
);

CREATE TABLE IF NOT EXISTS sigd_org.rol_permiso (
    rol_id UUID NOT NULL REFERENCES sigd_org.rol_sistema(rol_id) ON DELETE CASCADE,
    permiso_id UUID NOT NULL REFERENCES sigd_org.permiso_sistema(permiso_id) ON DELETE CASCADE,
    PRIMARY KEY (rol_id, permiso_id)
);

CREATE INDEX IF NOT EXISTS idx_rol_permiso_permiso ON sigd_org.rol_permiso(permiso_id);

-- Necesario para resolver el rol vigente de una cuenta en cada petición.
CREATE TABLE IF NOT EXISTS sigd_org.usuario_rol (
    cuenta_id UUID NOT NULL,
    rol_id UUID NOT NULL REFERENCES sigd_org.rol_sistema(rol_id) ON DELETE CASCADE,
    vigencia TSTZRANGE NOT NULL DEFAULT tstzrange(now(), NULL, '[)'),
    PRIMARY KEY (cuenta_id, rol_id),
    CONSTRAINT chk_usuario_rol_vigencia_no_vacia CHECK (NOT isempty(vigencia))
);

-- ======================================================
-- 2. ROLES CANÓNICOS
-- ======================================================

INSERT INTO sigd_org.rol_sistema (codigo, nombre, descripcion) VALUES
  ('SUPER_ADMIN',  'Superadministrador',
   'Administración técnica total del sistema. Su trazabilidad queda registrada en sigd_audit y sigue sujeta a los triggers de inmutabilidad WORM.'),
  ('DIRECTOR',     'Director',
   'Supervisión de áreas, aprobación y observancia de trámites, y consulta de auditoría.'),
  ('DOCENTE',      'Docente',
   'Atención y resolución de trámites asignados, firma y carga académica.'),
  ('MESA_PARTES',  'Mesa de Partes',
   'Radicación, clasificación y derivación inicial de expedientes.'),
  ('ESTUDIANTE',   'Estudiante',
   'Radicación de escritos propios, consulta de sus expedientes y adjuntos.')
ON CONFLICT (codigo) DO NOTHING;

-- ======================================================
-- 3. CATÁLOGO DE PERMISOS ATÓMICOS
--    Nomenclatura: dominio.accion  (minúsculas, coherente
--    con docs/02_organicore/03_datos_prueba_organizacion.sql)
-- ======================================================

INSERT INTO sigd_org.permiso_sistema (codigo, descripcion, alcance_predeterminado) VALUES
  -- Expediente (5)
  ('expediente.ver',        'Consultar expedientes',                                   'AREA'),
  ('expediente.crear',      'Crear expedientes',                                       'AREA'),
  ('expediente.editar',     'Editar datos de un expediente',                            'AREA'),
  ('expediente.anular',     'Anular un expediente',                                     'AREA'),
  ('expediente.eliminar',   'Eliminar lógicamente un expediente',                        'AREA'),
  -- Radicación (4)
  ('radicacion.registrar',  'Registrar escritos en mesa de partes',                     'AREA'),
  ('radicacion.corregir',   'Corregir datos de una radicación',                         'AREA'),
  ('radicacion.rechazar',   'Rechazar una radicación por incompleta',                   'AREA'),
  ('radicacion.duplicar',   'Duplicar una radicación existente',                        'AREA'),
  -- Derivación (4)
  ('derivacion.ver',        'Consultar el historial de derivaciones',                   'AREA'),
  ('derivacion.ejecutar',   'Derivar un expediente a otra área',                        'SUBAREAS'),
  ('derivacion.reasignar',  'Reasignar un expediente ya derivado',                      'AREA'),
  ('derivacion.cancelar',   'Cancelar una derivación',                                 'AREA'),
  -- Atención (5)
  ('atencion.ver',          'Consultar la bandeja de atención',                        'AREA'),
  ('atencion.atender',      'Registrar la atención de un expediente',                   'AREA'),
  ('atencion.observar',     'Observar un expediente y requerir subsanación',           'AREA'),
  ('atencion.desobligar',   'Levantar una observación previa',                         'AREA'),
  ('atencion.finalizar',    'Finalizar un expediente',                                 'AREA'),
  -- Plazos (2)
  ('plazo.extender',        'Extender el plazo de atención',                            'AREA'),
  ('plazo.suspender',       'Suspender el cómputo de un plazo',                         'AREA'),
  -- Adjuntos (4)
  ('adjunto.adjuntar',      'Adjuntar documentos a un expediente',                     'AREA'),
  ('adjunto.descargar',     'Descargar adjuntos de un expediente',                      'AREA'),
  ('adjunto.eliminar',      'Eliminar adjuntos de un expediente',                       'AREA'),
  ('adjunto.sustituir',     'Sustituir un adjunto por una versión nueva',               'AREA'),
  -- Firma (4)
  ('firma.solicitar',       'Solicitar la firma de un documento',                       'AREA'),
  ('firma.firmar',          'Firmar electrónicamente un documento',                     'AREA'),
  ('firma.anular',          'Anular una firma emitida',                                'AREA'),
  ('firma.ver',             'Verificar la validez de una firma',                        'AREA'),
  -- Mesa de Partes (2)
  ('mesa_partes.registrar', 'Registrar el ingreso de un documento en mesa de partes',   'AREA'),
  ('mesa_partes.clasificar','Clasificar un documento según su tipo documental',         'AREA'),
  -- Docente (2)
  ('docente.gestionar',     'Gestionar la carga académica asignada',                   'GLOBAL'),
  ('docente.consultar_carga','Consultar la propia carga académica',                     'GLOBAL'),
  -- Dirección (3)
  ('director.aprobar',      'Aprobar actos administrativos',                           'GLOBAL'),
  ('director.observar',     'Observar actos administrativos de las áreas',             'GLOBAL'),
  ('director.supervisar',   'Supervisar la operación de las áreas',                     'GLOBAL'),
  -- Organización (5)
  ('area.crear',            'Crear áreas y unidades organizacionales',                'GLOBAL'),
  ('area.editar',           'Editar datos de un área',                                 'GLOBAL'),
  ('area.desactivar',       'Desactivar un área',                                       'GLOBAL'),
  ('area.asignar_responsable','Asignar o cambiar el responsable de un área',            'GLOBAL'),
  ('area.ver_organigrama',  'Consultar el organigrama institucional',                   'GLOBAL'),
  -- Roles (4)
  ('rol.ver',               'Consultar la matriz de roles y permisos',                  'GLOBAL'),
  ('rol.crear',             'Crear roles del sistema',                                  'GLOBAL'),
  ('rol.editar',            'Editar datos de un rol',                                   'GLOBAL'),
  ('rol.asignar',           'Asignar roles a cuentas',                                  'GLOBAL'),
  -- Usuarios (3)
  ('usuario.ver',           'Consultar datos de usuarios',                             'GLOBAL'),
  ('usuario.editar',        'Editar datos de usuarios',                                'GLOBAL'),
  ('usuario.desactivar',    'Desactivar cuentas de usuario',                           'GLOBAL'),
  -- Auditoría (2)
  ('auditoria.ver',         'Consultar la bitácora de auditoría',                      'GLOBAL'),
  ('auditoria.exportar',    'Exportar la bitácora de auditoría',                       'GLOBAL'),
  -- Configuración (2)
  ('configuracion.ver',     'Consultar los parámetros del sistema',                    'GLOBAL'),
  ('configuracion.editar',  'Modificar los parámetros del sistema',                    'GLOBAL'),
  -- Reportes (2)
  ('reporte.generar',       'Generar reportes de gestión',                             'GLOBAL'),
  ('reporte.ver',           'Consultar reportes de gestión',                           'GLOBAL'),
  -- Gestión de la propia matriz (1)
  ('permiso.gestionar',     'Modificar la matriz de permisos de un rol',                'GLOBAL')
ON CONFLICT (codigo) DO NOTHING;

-- ======================================================
-- 4. MATRIZ ROL → PERMISOS
--    N:M efectiva: un rol tiene varios permisos y un
--    permiso puede pertenecer a varios roles.
-- ======================================================

-- 4.1 SUPER_ADMIN: administración técnica completa.
INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
  FROM sigd_org.rol_sistema r
  CROSS JOIN sigd_org.permiso_sistema p
 WHERE r.codigo = 'SUPER_ADMIN'
ON CONFLICT DO NOTHING;

-- 4.2 DIRECTOR: supervisión, aprobación y observancia. Sin gestión de la matriz.
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

-- 4.3 DOCENTE: atención, firma y carga propia. Sin acceso a configuración ni auditoría.
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

-- 4.4 MESA_PARTES: radicación, clasificación y derivación. Sin firma ni aprobación.
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

-- 4.5 ESTUDIANTE: mínimo privilegio. Ninguna función administrativa, ninguna
--     configuración, ningún acceso a la auditoría y ninguna firma a su nombre.
INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
  FROM sigd_org.rol_sistema r
  JOIN sigd_org.permiso_sistema p ON p.codigo IN (
    'radicacion.registrar','expediente.ver',
    'adjunto.adjuntar','adjunto.descargar',
    'firma.solicitar','firma.ver','reporte.ver')
 WHERE r.codigo = 'ESTUDIANTE'
ON CONFLICT DO NOTHING;

-- ======================================================
-- 5. VERIFICACIÓN
-- ======================================================

-- 5.1 Los 5 roles canónicos están registrados y activos.
SELECT codigo, nombre, activo
  FROM sigd_org.rol_sistema
 ORDER BY codigo;

-- 5.2 Total de permisos atómicos registrados (debe ser >= 30).
SELECT count(*) AS total_permisos
  FROM sigd_org.permiso_sistema
 WHERE activo = TRUE;

-- 5.3 Matriz completa: un permiso puede pertenecer a varios roles (N:M real).
SELECT r.codigo AS rol,
       count(*)  AS total_permisos,
       string_agg(p.codigo, ', ' ORDER BY p.codigo) AS permisos
  FROM sigd_org.rol_permiso rp
  JOIN sigd_org.rol_sistema r    ON r.rol_id    = rp.rol_id
  JOIN sigd_org.permiso_sistema p ON p.permiso_id = rp.permiso_id
 GROUP BY r.codigo
 ORDER BY r.codigo;

-- 5.4 CASO DENEGADO: ESTUDIANTE no puede administrar roles ni configuración.
--     Debe devolver 0 filas.
SELECT r.codigo AS rol, p.codigo AS permiso_prohibido
  FROM sigd_org.rol_permiso rp
  JOIN sigd_org.rol_sistema r     ON r.rol_id     = rp.rol_id
  JOIN sigd_org.permiso_sistema p ON p.permiso_id = rp.permiso_id
 WHERE r.codigo = 'ESTUDIANTE'
   AND p.codigo IN ('permiso.gestionar', 'rol.editar', 'configuracion.editar', 'auditoria.ver');

-- 5.5 Un mismo permiso en varios roles (relación N:M verificada).
SELECT p.codigo AS permiso, count(DISTINCT rp.rol_id) AS cantidad_de_roles
  FROM sigd_org.rol_permiso rp
  JOIN sigd_org.permiso_sistema p ON p.permiso_id = rp.permiso_id
 GROUP BY p.codigo
HAVING count(DISTINCT rp.rol_id) > 1
 ORDER BY p.codigo;
