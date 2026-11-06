-- =============================================================================
-- Migración 08 · Esquema sigd_org / sigd_auth
-- Privilegios, Permisos y Roles Integrales del Sistema SIGD para Usuario "admin"
-- -----------------------------------------------------------------------------
-- Autor     : Ricardo Arévalo Villacorta (B_AREVALO) · Auditoría y Arquitectura SIGD
-- Marco     : TUO Ley 27444, MGD-PCM (D.S. N° 026-2016-PCM), Ley 27269 (Firmas)
-- Depende de: 02_sigd_auth.sql, 03_sigd_org.sql
-- Contenido :
--   1. Aseguramiento de credenciales de usuario "admin" con contraseña "admin"
--      (Argon2id conforme a RFC 9106 e invariante de seguridad).
--   2. Ampliación del catálogo de roles canónicos en sigd_org.rol_sistema
--      incluyendo SUPER_ADMIN, ADMINISTRADOR, DIRECTOR, SECRETARIO, DOCENTE,
--      ESPECIALISTA, MESA_PARTES, CIUDADANO, ESTUDIANTE.
--   3. Catálogo de cargos institucionales en sigd_org.cargo.
--   4. Catálogo completo de permisos y privilegios para los 6 módulos canónicos
--      en sigd_org.permiso_sistema.
--   5. Asignación total de privilegios a los roles SUPER_ADMIN y ADMINISTRADOR.
--   6. Asignación de todos los roles al usuario "admin".
--   7. Habilitación de firma electrónica y facultades de despacho directoral.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Asegurar usuario "admin" con contraseña "admin" (Hash Argon2id verificado)
-- -----------------------------------------------------------------------------
INSERT INTO sigd_auth.persona (id_persona, tipo, id_documento)
VALUES ('00000000-0000-0000-0000-000000000001', 'NATURAL', '00000001')
ON CONFLICT (id_persona) DO NOTHING;

INSERT INTO sigd_auth.persona_natural (id_persona, nombres, apellidos, nombre_completo, correo)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Administrador',
    'General SIGD',
    'Super Administrador General SIGD',
    'admin@iestpsuiza.edu.pe'
)
ON CONFLICT (id_persona) DO UPDATE
    SET nombre_completo = EXCLUDED.nombre_completo,
        correo = EXCLUDED.correo;

-- Hash verificado con Argon2Service: coincide exactamente con "admin"
INSERT INTO sigd_auth.cuenta_usuario (id_usuario, id_persona, usuario, correo, password_hash, activo)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'admin',
    'admin@iestpsuiza.edu.pe',
    '$argon2id$v=19$m=65536,p=4,t=3$PogTZJDdv+FSH90IKSs2sQ$UISRKBb7pZHpzSLJjlOqcXsN/xJg6Qzgm+koZI3SnVM',
    TRUE
)
ON CONFLICT (id_usuario) DO UPDATE
    SET password_hash = '$argon2id$v=19$m=65536,p=4,t=3$PogTZJDdv+FSH90IKSs2sQ$UISRKBb7pZHpzSLJjlOqcXsN/xJg6Qzgm+koZI3SnVM',
        activo = TRUE,
        correo = 'admin@iestpsuiza.edu.pe';

UPDATE sigd_auth.cuenta_usuario
   SET password_hash = '$argon2id$v=19$m=65536,p=4,t=3$PogTZJDdv+FSH90IKSs2sQ$UISRKBb7pZHpzSLJjlOqcXsN/xJg6Qzgm+koZI3SnVM',
       activo = TRUE
 WHERE usuario = 'admin';

-- -----------------------------------------------------------------------------
-- 2. Ampliación del catálogo de roles canónicos del sistema
-- -----------------------------------------------------------------------------
ALTER TABLE sigd_org.rol_sistema DROP CONSTRAINT IF EXISTS chk_rol_codigo;
ALTER TABLE sigd_org.rol_sistema ADD CONSTRAINT chk_rol_codigo CHECK (codigo IN (
    'SUPER_ADMIN',
    'ADMINISTRADOR',
    'DIRECTOR',
    'SECRETARIO',
    'DOCENTE',
    'ESPECIALISTA',
    'MESA_PARTES',
    'CIUDADANO',
    'ESTUDIANTE'
));

INSERT INTO sigd_org.rol_sistema (codigo, nombre, descripcion, vigente)
VALUES
    ('SUPER_ADMIN', 'Super Administrador del Sistema', 'Gobernanza global, auditoría forense WORM y configuración institucional total', TRUE),
    ('ADMINISTRADOR', 'Administrador del Sistema', 'Administración técnica total de la plataforma SIGD', TRUE),
    ('DIRECTOR', 'Director General', 'Emisión de resoluciones directorales, despacho y firma digital', TRUE),
    ('SECRETARIO', 'Secretario Académico', 'Proyección y preparación de resoluciones y expedientes de titulación', TRUE),
    ('DOCENTE', 'Docente / Coordinador', 'Evaluación académica de proyectos de titulación y derivación de actuados', TRUE),
    ('ESPECIALISTA', 'Especialista', 'Análisis técnico y emisión de dictámenes', TRUE),
    ('MESA_PARTES', 'Mesa de Partes', 'Recepción, radicación y registro presencial y virtual de documentos', TRUE),
    ('CIUDADANO', 'Ciudadano / Administrado', 'Acceso y gestión fehaciente en la Casilla Electrónica', TRUE),
    ('ESTUDIANTE', 'Estudiante / Administrado', 'Presentación de solicitudes académicas y consulta de trámites', TRUE)
ON CONFLICT (codigo) DO UPDATE
    SET nombre = EXCLUDED.nombre,
        descripcion = EXCLUDED.descripcion,
        vigente = TRUE;

-- -----------------------------------------------------------------------------
-- 3. Catálogo de cargos institucionales
-- -----------------------------------------------------------------------------
INSERT INTO sigd_org.cargo (codigo, nombre, descripcion, vigente)
VALUES
    ('ADMINISTRADOR_SISTEMA', 'Administrador del Sistema', 'Responsable de la infraestructura tecnológica y gobernanza del SIGD', TRUE),
    ('DIRECTOR_GENERAL', 'Director General', 'Máxima autoridad ejecutiva del IESTP Suiza', TRUE),
    ('SECRETARIO_ACADEMICO', 'Secretario Académico', 'Custodio del acervo documentario y actas de titulación', TRUE),
    ('COORDINADOR_ACADEMICO', 'Coordinador Académico', 'Coordinación y dictamen de programas de estudio', TRUE),
    ('ESPECIALISTA_TRAMITE', 'Especialista en Trámite Documentario', 'Gestión, clasificación y derivación de expedientes', TRUE),
    ('OPERADOR_VENTANILLA', 'Operador de Ventanilla y Mesa de Partes', 'Atención ciudadana presencial y emisión de cargos', TRUE)
ON CONFLICT (codigo) DO UPDATE
    SET nombre = EXCLUDED.nombre,
        descripcion = EXCLUDED.descripcion,
        vigente = TRUE;

-- -----------------------------------------------------------------------------
-- 4. Catálogo completo de permisos y privilegios del sistema SIGD
-- -----------------------------------------------------------------------------
INSERT INTO sigd_org.permiso_sistema (codigo, nombre, ambito)
VALUES
    -- Módulo 1: Identidad, Autenticación y Casilla Digital
    ('AUTH_LOGIN', 'Iniciar sesión y autenticación en la plataforma', 'GLOBAL'),
    ('AUTH_PERFIL', 'Consultar y actualizar perfil de usuario', 'GLOBAL'),
    ('CASILLA_ACCEDER', 'Acceso a la bandeja de Casilla Electrónica', 'GLOBAL'),
    ('CASILLA_NOTIFICAR', 'Emisión y depósito de notificaciones de actos administrativos', 'GLOBAL'),
    ('CASILLA_ACUSE', 'Generación y descarga de acuses fehacientes SHA-256', 'GLOBAL'),
    ('REGISTRO_CIUDADANO', 'Registro de personas naturales y jurídicas', 'GLOBAL'),

    -- Módulo 2: Trámites, Radicación y Ventanilla Presencial
    ('TRAMITE_RADICAR', 'Radicación de expedientes vía Mesa de Partes Virtual', 'GLOBAL'),
    ('TRAMITE_VENTANILLA', 'Registro presencial de documentos y cargo con ticket térmico', 'GLOBAL'),
    ('TRAMITE_CONSULTAR', 'Consulta pública anónima de estado de expedientes', 'GLOBAL'),
    ('TRAMITE_TUPA', 'Mantenimiento del catálogo de trámites TUPA', 'GLOBAL'),

    -- Módulo 3: RutaDoc y FSM de Expedientes
    ('EXPEDIENTE_LEER', 'Leer y consultar expedientes institucionales', 'GLOBAL'),
    ('EXPEDIENTE_VER', 'Visualizar expediente y foliación correlativa', 'GLOBAL'),
    ('EXPEDIENTE_CREAR', 'Crear y registrar nuevos expedientes', 'GLOBAL'),
    ('EXPEDIENTE_EDITAR', 'Modificar metadatos y clasificación CCD', 'AREA'),
    ('EXPEDIENTE_DERIVAR', 'Derivar expedientes entre dependencias y áreas', 'AREA'),
    ('EXPEDIENTE_RESOLVER', 'Resolver y emitir dictámenes sobre expedientes', 'AREA'),
    ('EXPEDIENTE_OBSERVAR', 'Observar expedientes y suspender plazos SLA', 'AREA'),
    ('EXPEDIENTE_SUBSANAR', 'Levantar observaciones y reactivar plazos SLA', 'AREA'),
    ('EXPEDIENTE_ACUMULAR', 'Acumular expedientes conexos (Art. 160 LPAG)', 'AREA'),
    ('EXPEDIENTE_ARCHIVAR', 'Archivar expedientes resueltos o concluidos', 'AREA'),
    ('EXPEDIENTE_ELIMINAR', 'Anular o dar de baja expedientes', 'GLOBAL'),
    ('EXPEDIENTE_EXPORTAR', 'Exportar expedientes y cargos a Excel/PDF', 'GLOBAL'),
    ('FOLIADO_GESTIONAR', 'Control de foliación digital correlativa AGN', 'AREA'),

    -- Módulo 4: DocuCore y Firma Digital PAdES / Refirma
    ('DOCUMENTO_VER', 'Visualizar documentos institucionales y resoluciones', 'GLOBAL'),
    ('DOCUMENTO_CREAR', 'Proyectar y redactar Resoluciones Directorales A4', 'AREA'),
    ('DOCUMENTO_EDITAR', 'Modificar proyectos de resoluciones y documentos', 'AREA'),
    ('DOCUMENTO_DERIVAR', 'Despachar y vincular documentos oficiales', 'AREA'),
    ('DOCUMENTO_ARCHIVAR', 'Archivar documentos oficiales en el repositorio institucional', 'AREA'),
    ('DOCUMENTO_ELIMINAR', 'Anular proyectos documentales no suscritos', 'AREA'),
    ('DOCUMENTO_EXPORTAR', 'Exportar copias de documentos y reportes', 'GLOBAL'),
    ('FIRMA_FIRMAR', 'Firmar digitalmente con PAdES-BES y Refirma Suite RENIEC', 'GLOBAL'),
    ('FIRMA_VALIDAR', 'Validar Código de Verificación Digital (CVD) y QR', 'GLOBAL'),
    ('FIRMA_LOTE', 'Ejecutar firma digital en lote de documentos', 'GLOBAL'),

    -- Módulo 5: OrganiCore y Administración Institucional
    ('ADMIN_VER', 'Acceso al módulo integral de administración institucional', 'GLOBAL'),
    ('ADMIN_CREAR', 'Crear dependencias, cargos y catálogos institucionales', 'GLOBAL'),
    ('ADMIN_EDITAR', 'Modificar organigrama y parámetros del sistema', 'GLOBAL'),
    ('ADMIN_ELIMINAR', 'Dar de baja registros administrativos', 'GLOBAL'),
    ('ADMIN_EXPORTAR', 'Exportar catálogos maestros y directorio institucional', 'GLOBAL'),
    ('ADMIN_USUARIOS', 'Administrar directorio institucional de usuarios y credenciales', 'GLOBAL'),
    ('ADMIN_ROLES', 'Gestionar roles RBAC y matriz de control de acceso', 'GLOBAL'),
    ('ADMIN_AREAS', 'Administrar jerarquía orgánica ltree', 'GLOBAL'),
    ('ADMIN_CALENDARIO', 'Configurar calendario laboral institucional y feriados', 'GLOBAL'),
    ('ADMIN_MAESTRAS', 'Mantenimiento de tablas maestras unificadas', 'GLOBAL'),
    ('ADMIN_SEGURIDAD', 'Gestión de políticas de seguridad y sesiones activas', 'GLOBAL'),

    -- Módulo 6: CoreLink, Analítica y Auditoría Forense
    ('REPORTE_LEER', 'Consultar tablero directivo ejecutivo e indicadores MGD-PCM', 'GLOBAL'),
    ('REPORTE_EXPORTAR', 'Exportar analítica ejecutiva a Excel y reportes mínimos PDF', 'GLOBAL'),
    ('AUDITORIA_VER', 'Consultar bitácora inmutable WORM de auditoría institucional', 'GLOBAL'),
    ('AUDITORIA_CONSULTAR', 'Búsqueda forense contextual por correlation-id', 'GLOBAL'),
    ('AUDITORIA_EXPORTAR', 'Exportar pistas y bitácoras de auditoría forense', 'GLOBAL'),
    ('REALTIME_STREAM', 'Suscripción al streaming Server-Sent Events (SSE)', 'GLOBAL')
ON CONFLICT (codigo) DO UPDATE
    SET nombre = EXCLUDED.nombre,
        ambito = EXCLUDED.ambito;

-- -----------------------------------------------------------------------------
-- 5. Asignación total de TODOS los privilegios a SUPER_ADMIN y ADMINISTRADOR
-- -----------------------------------------------------------------------------
INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
FROM sigd_org.rol_sistema r
CROSS JOIN sigd_org.permiso_sistema p
WHERE r.codigo IN ('SUPER_ADMIN', 'ADMINISTRADOR')
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

-- Asignación de permisos al rol DIRECTOR
INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
FROM sigd_org.rol_sistema r
JOIN sigd_org.permiso_sistema p ON p.codigo IN (
    'AUTH_LOGIN', 'AUTH_PERFIL', 'CASILLA_ACCEDER', 'CASILLA_NOTIFICAR', 'CASILLA_ACUSE',
    'EXPEDIENTE_LEER', 'EXPEDIENTE_VER', 'EXPEDIENTE_CREAR', 'EXPEDIENTE_EDITAR',
    'EXPEDIENTE_DERIVAR', 'EXPEDIENTE_RESOLVER', 'EXPEDIENTE_OBSERVAR', 'EXPEDIENTE_SUBSANAR',
    'EXPEDIENTE_ACUMULAR', 'EXPEDIENTE_ARCHIVAR', 'EXPEDIENTE_EXPORTAR', 'FOLIADO_GESTIONAR',
    'DOCUMENTO_VER', 'DOCUMENTO_CREAR', 'DOCUMENTO_EDITAR', 'DOCUMENTO_DERIVAR',
    'DOCUMENTO_ARCHIVAR', 'DOCUMENTO_EXPORTAR', 'FIRMA_FIRMAR', 'FIRMA_VALIDAR', 'FIRMA_LOTE',
    'ADMIN_VER', 'ADMIN_EXPORTAR', 'REPORTE_LEER', 'REPORTE_EXPORTAR',
    'AUDITORIA_VER', 'AUDITORIA_CONSULTAR', 'AUDITORIA_EXPORTAR', 'REALTIME_STREAM'
)
WHERE r.codigo = 'DIRECTOR'
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

-- Asignación de permisos al rol DOCENTE
INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
FROM sigd_org.rol_sistema r
JOIN sigd_org.permiso_sistema p ON p.codigo IN (
    'AUTH_LOGIN', 'AUTH_PERFIL', 'CASILLA_ACCEDER', 'CASILLA_ACUSE',
    'EXPEDIENTE_LEER', 'EXPEDIENTE_VER', 'EXPEDIENTE_CREAR', 'EXPEDIENTE_EDITAR',
    'EXPEDIENTE_DERIVAR', 'EXPEDIENTE_OBSERVAR', 'EXPEDIENTE_SUBSANAR', 'EXPEDIENTE_EXPORTAR',
    'DOCUMENTO_VER', 'DOCUMENTO_CREAR', 'DOCUMENTO_EDITAR', 'DOCUMENTO_DERIVAR',
    'DOCUMENTO_EXPORTAR', 'FIRMA_VALIDAR', 'REALTIME_STREAM'
)
WHERE r.codigo = 'DOCENTE'
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

-- Asignación de permisos al rol MESA_PARTES
INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
FROM sigd_org.rol_sistema r
JOIN sigd_org.permiso_sistema p ON p.codigo IN (
    'AUTH_LOGIN', 'AUTH_PERFIL', 'CASILLA_ACCEDER', 'CASILLA_ACUSE', 'REGISTRO_CIUDADANO',
    'TRAMITE_RADICAR', 'TRAMITE_VENTANILLA', 'TRAMITE_CONSULTAR', 'TRAMITE_TUPA',
    'EXPEDIENTE_LEER', 'EXPEDIENTE_VER', 'EXPEDIENTE_CREAR', 'EXPEDIENTE_EDITAR',
    'EXPEDIENTE_DERIVAR', 'EXPEDIENTE_EXPORTAR', 'FOLIADO_GESTIONAR',
    'DOCUMENTO_VER', 'DOCUMENTO_CREAR', 'DOCUMENTO_DERIVAR', 'FIRMA_VALIDAR', 'REALTIME_STREAM'
)
WHERE r.codigo = 'MESA_PARTES'
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

-- Asignación de permisos a CIUDADANO y ESTUDIANTE
INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
FROM sigd_org.rol_sistema r
JOIN sigd_org.permiso_sistema p ON p.codigo IN (
    'AUTH_LOGIN', 'AUTH_PERFIL', 'CASILLA_ACCEDER', 'CASILLA_ACUSE',
    'TRAMITE_RADICAR', 'TRAMITE_CONSULTAR', 'EXPEDIENTE_LEER', 'EXPEDIENTE_VER',
    'DOCUMENTO_VER', 'FIRMA_VALIDAR'
)
WHERE r.codigo IN ('CIUDADANO', 'ESTUDIANTE')
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 6. Asignación de TODOS los roles al usuario "admin"
-- -----------------------------------------------------------------------------
-- Asignamos todos los roles en el área Dirección General (DIR_GEN)
INSERT INTO sigd_org.usuario_rol (id_usuario, rol_id, area_id, vigente_desde, vigente_hasta)
SELECT
    '00000000-0000-0000-0000-000000000001',
    r.rol_id,
    a.area_id,
    now(),
    NULL
FROM sigd_org.rol_sistema r
CROSS JOIN (SELECT area_id FROM sigd_org.area WHERE codigo = 'DIR_GEN' LIMIT 1) a
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- 7. Perfil y facultades de despacho directoral para el usuario "admin"
-- -----------------------------------------------------------------------------
INSERT INTO sigd_auth.perfil_usuario (
    id_usuario, cargo_id, area_id, telefono, firma_electronica_habilitada, actualizado_en
)
SELECT
    '00000000-0000-0000-0000-000000000001',
    c.cargo_id,
    a.area_id,
    '961234567',
    TRUE,
    now()
FROM (SELECT cargo_id FROM sigd_org.cargo WHERE codigo = 'ADMINISTRADOR_SISTEMA' LIMIT 1) c
CROSS JOIN (SELECT area_id FROM sigd_org.area WHERE codigo = 'DIR_GEN' LIMIT 1) a
ON CONFLICT (id_usuario) DO UPDATE
    SET cargo_id = EXCLUDED.cargo_id,
        area_id = EXCLUDED.area_id,
        firma_electronica_habilitada = TRUE,
        actualizado_en = now();

-- Habilitación de firma en despacho directoral
INSERT INTO sigd_org.facultad_despacho (usuario_id, cargo_id, tipo_resolucion, vigente, emitido_en)
SELECT
    '00000000-0000-0000-0000-000000000001',
    c.cargo_id,
    t.tipo,
    TRUE,
    now()
FROM (SELECT cargo_id FROM sigd_org.cargo WHERE codigo = 'DIRECTOR_GENERAL' LIMIT 1) c
CROSS JOIN (VALUES
    ('DIRECTORAL_TITULACION'),
    ('DIRECTORAL_CONVALIDACION'),
    ('DIRECTORAL_ADMINISTRATIVA')
) AS t(tipo)
ON CONFLICT DO NOTHING;
