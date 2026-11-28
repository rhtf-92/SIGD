-- ============================================================================
-- MIGRACIÓN 15: Alineación Exhaustiva de Roles y Permisos del Sistema SIGD
-- Esquema: sigd_org
-- Catálogo oficial de permisos granulares por módulo y matriz de asignación
-- ============================================================================

BEGIN;

-- 1. Ampliación y normalización del catálogo de permisos del sistema
INSERT INTO sigd_org.permiso_sistema (codigo, nombre, ambito)
VALUES
    -- Trámites y Mesa de Partes
    ('VENTANILLA_RADICAR', 'Radicar trámites en ventanilla y mesa de partes virtual', 'GLOBAL'),
    ('EXPEDIENTE_CREAR', 'Aperturar nuevos expedientes administrativos', 'GLOBAL'),
    ('TRAMITE_CONSULTAR', 'Consultar trazabilidad y estado de trámites', 'GLOBAL'),
    ('TUPA_GESTIONAR', 'Administrar y parametrizar versiones del TUPA institucional', 'GLOBAL'),

    -- Gestión de Expedientes
    ('EXPEDIENTE_LEER', 'Consultar y leer expedientes administrativos', 'GLOBAL'),
    ('EXPEDIENTE_DERIVAR', 'Derivar expedientes y pases entre unidades orgánicas', 'AREA'),
    ('EXPEDIENTE_RESOLVER', 'Resolver y dictaminar expedientes en despacho', 'AREA'),
    ('EXPEDIENTE_FOLIAR', 'Foliar y agregar recaudos al expediente', 'AREA'),

    -- Documentos y Resoluciones
    ('DOCUMENTO_CREAR', 'Redactar y registrar documentos oficiales (oficios, informes, memorandos)', 'AREA'),
    ('FIRMA_FIRMAR', 'Firmar digitalmente documentos oficiales y resoluciones', 'GLOBAL'),
    ('RESOLUCION_PROYECTAR', 'Elaborar proyectos de resolución directoral', 'AREA'),
    ('RESOLUCION_EMITIR', 'Aprobar y promulgar Resoluciones Directorales oficiales', 'GLOBAL'),

    -- Casilla Electrónica y Notificaciones
    ('NOTIFICACION_EMITIR', 'Emitir y remitir cédulas de notificación electrónica a casillas', 'AREA'),
    ('CASILLA_LEER', 'Consultar notificaciones recibidas en casilla electrónica', 'GLOBAL'),
    ('CASILLA_ACUSE', 'Emitir acuse de recibo de notificación electrónica', 'GLOBAL'),

    -- Administración y Seguridad
    ('ADMIN_USUARIOS', 'Administrar usuarios, cuentas de acceso y asignación de roles', 'GLOBAL'),
    ('ADMIN_MAESTRAS', 'Configurar tablas maestras institucionales (sedes, tipos documentales)', 'GLOBAL'),
    ('ADMIN_AUDITORIA', 'Consultar bitácora forense de auditoría inmutable (WORM)', 'GLOBAL'),
    ('CALENDARIO_GESTIONAR', 'Mantenimiento del calendario laboral y feriados institucionales', 'GLOBAL'),

    -- Reportes y Monitoreo MGD
    ('REPORTE_LEER', 'Consultar reportes e indicadores de gestión documental MGD', 'GLOBAL'),
    ('REPORTE_EXPORTAR', 'Exportar reportes y métricas a formatos descargables (XLSX, PDF)', 'GLOBAL')
ON CONFLICT (codigo) DO UPDATE 
SET nombre = EXCLUDED.nombre,
    ambito = EXCLUDED.ambito;

-- 2. Limpieza de asignaciones previas para reconstrucción atómica de la matriz
DELETE FROM sigd_org.rol_permiso;

-- 3. Matriz de Concesión de Permisos por Rol Canónico

-- 3.1 ADMINISTRADOR: Acceso técnico total a todos los módulos y funciones
INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
FROM sigd_org.rol_sistema r
CROSS JOIN sigd_org.permiso_sistema p
WHERE r.codigo = 'ADMINISTRADOR';

-- 3.2 DIRECTOR: Máxima autoridad resolutiva, firma digital, resoluciones directorales, reportes y auditoría
INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
FROM sigd_org.rol_sistema r
JOIN sigd_org.permiso_sistema p ON p.codigo IN (
    'EXPEDIENTE_LEER',
    'EXPEDIENTE_DERIVAR',
    'EXPEDIENTE_RESOLVER',
    'DOCUMENTO_CREAR',
    'FIRMA_FIRMAR',
    'RESOLUCION_PROYECTAR',
    'RESOLUCION_EMITIR',
    'NOTIFICACION_EMITIR',
    'TRAMITE_CONSULTAR',
    'REPORTE_LEER',
    'REPORTE_EXPORTAR',
    'ADMIN_AUDITORIA'
)
WHERE r.codigo = 'DIRECTOR';

-- 3.3 SECRETARIO: Fe pública, redacción, foliación, TUPA, proyectos de resolución, firma de constancias y reportes
INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
FROM sigd_org.rol_sistema r
JOIN sigd_org.permiso_sistema p ON p.codigo IN (
    'EXPEDIENTE_LEER',
    'EXPEDIENTE_DERIVAR',
    'EXPEDIENTE_FOLIAR',
    'DOCUMENTO_CREAR',
    'RESOLUCION_PROYECTAR',
    'FIRMA_FIRMAR',
    'TUPA_GESTIONAR',
    'NOTIFICACION_EMITIR',
    'TRAMITE_CONSULTAR',
    'REPORTE_LEER',
    'REPORTE_EXPORTAR'
)
WHERE r.codigo = 'SECRETARIO';

-- 3.4 ESPECIALISTA: Análisis técnico sustantivo, emisión de informes, foliación de autos y resolución de área
INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
FROM sigd_org.rol_sistema r
JOIN sigd_org.permiso_sistema p ON p.codigo IN (
    'EXPEDIENTE_LEER',
    'EXPEDIENTE_DERIVAR',
    'EXPEDIENTE_RESOLVER',
    'EXPEDIENTE_FOLIAR',
    'DOCUMENTO_CREAR',
    'TRAMITE_CONSULTAR'
)
WHERE r.codigo = 'ESPECIALISTA';

-- 3.5 MESA_PARTES: Recepción y radicación en ventanilla/virtual, apertura y foliación de expediente, notificación
INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
FROM sigd_org.rol_sistema r
JOIN sigd_org.permiso_sistema p ON p.codigo IN (
    'VENTANILLA_RADICAR',
    'EXPEDIENTE_CREAR',
    'EXPEDIENTE_LEER',
    'EXPEDIENTE_DERIVAR',
    'EXPEDIENTE_FOLIAR',
    'DOCUMENTO_CREAR',
    'NOTIFICACION_EMITIR',
    'TRAMITE_CONSULTAR'
)
WHERE r.codigo = 'MESA_PARTES';

-- 3.6 CIUDADANO: Acceso exclusivo a Casilla Electrónica, acuse formal de recibo y consulta de sus trámites
INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
FROM sigd_org.rol_sistema r
JOIN sigd_org.permiso_sistema p ON p.codigo IN (
    'CASILLA_LEER',
    'CASILLA_ACUSE',
    'TRAMITE_CONSULTAR'
)
WHERE r.codigo = 'CIUDADANO';

COMMIT;
