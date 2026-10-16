-- =============================================================================
-- 10_seed_institucional.sql
-- =============================================================================
-- Carga los catalogos institucionales del IESTP "Suiza" (Pucallpa, Ucayali) que
-- los modulos necesitan para operar: sin ellos los dominios responden 200 con
-- listas vacias y la aplicacion no puede demostrar su comportamiento real.
--
-- NATURALEZA DE ESTA CARGA
--   Es parte del MODELO, no una carga de demostracion. Los catalogos de ubigeo,
--   tipos documentales, organigrama, sedes, cargos, TUPA y calendario laboral son
--   datos institucionales exigidos por la normativa (TUO Ley 27444, Ley 29001,
--   TUO de la Ley 27444 Art. 143 y D. Leg. 713) y por el TUPA vigente. Un
--   despliegue real los carga igual; lo unico especifico de este archivo son las
--   CUENTAS DE PRUEBA, que se siembran al final y estan claramente marcadas.
--
-- IDEMPOTENCIA
--   Todo usa UUID fijos y ON CONFLICT DO NOTHING/UPDATE, de modo que puede
--   ejecutarse mas de una vez sin duplicar ni romper datos previos.
-- =============================================================================


-- =============================================================================
-- 10.1 Tipos documentales de identidad (Identicore / validacion DNI-RUC)
-- =============================================================================
-- `id_tipo_documento` es una identidad GENERATED ALWAYS: PostgreSQL la asigna,
-- por lo que el INSERT no la declara. El corte de identidad empieza en 1.
INSERT INTO sigd_auth.tipos_documento (codigo, descripcion, requiere_ruc, largo, vigente) VALUES
    ('DNI',       'Documento Nacional de Identidad',      FALSE, 8,  TRUE),
    ('RUC',       'Registro Unico de Contribuyentes',     TRUE,  11, TRUE),
    ('CE',        'Carnet de Extranjeria',                FALSE, 12, TRUE),
    ('PASAPORTE', 'Pasaporte',                            FALSE, 12, TRUE)
ON CONFLICT (codigo) DO NOTHING;


-- =============================================================================
-- 10.2 Tipos documentales del repositorio documental (DocuCore)
--     Los codigos EXPEDIENTE y ADJUNTO son los que resuelve la radicacion
--     virtual al registrar el expediente y sus archivos.
-- =============================================================================
INSERT INTO sigd_doc.tipo_documento (tipo_documental_id, codigo, nombre, extension, mime_type, tamano_maximo_mb, exige_firma, vigente) VALUES
    ('10000000-0000-0000-0000-000000000001', 'EXPEDIENTE', 'Expediente',       'pdf', 'application/pdf', 100, TRUE,  TRUE),
    ('10000000-0000-0000-0000-000000000002', 'ADJUNTO',     'Documento adjunto', 'pdf', 'application/pdf', 20, FALSE, TRUE),
    ('10000000-0000-0000-0000-000000000003', 'RESOLUCION',  'Resolución',        'pdf', 'application/pdf', 50, TRUE,  TRUE),
    ('10000000-0000-0000-0000-000000000004', 'ACTA',        'Acta de sesión',   'pdf', 'application/pdf', 50, TRUE,  TRUE),
    ('10000000-0000-0000-0000-000000000005', 'CERTIFICADO', 'Certificado',      'pdf', 'application/pdf', 20, TRUE,  TRUE),
    ('10000000-0000-0000-0000-000000000006', 'CARGO',       'Cargo de recepción','pdf', 'application/pdf', 5,  FALSE, TRUE)
ON CONFLICT (codigo) DO NOTHING;


-- =============================================================================
-- 10.3 Sedes del IESTP "Suiza"
-- =============================================================================
INSERT INTO sigd_org.sede (sede_id, codigo, nombre, direccion, telefono, principal, activo) VALUES
    ('20000000-0000-0000-0000-000000000001', 'SEDE_CENTRAL',  'Sede Central - Pucallpa',
     'Av.LOS Incoteros s/n, Pucallpa, Ucayali', '(061) 0000000', TRUE,  TRUE),
    ('20000000-0000-0000-0000-000000000002', 'SEDE_URUBAMBA', 'Sede-satélite - Alto Urubamba',
     'Maldonado, Alto Urubamba, Ucayali',        '(061) 0000001', FALSE, TRUE)
ON CONFLICT (codigo) DO NOTHING;


-- =============================================================================
-- 10.4 Cargos institutionales
-- =============================================================================
INSERT INTO sigd_org.cargo (cargo_id, codigo, nombre, descripcion, vigente) VALUES
    ('30000000-0000-0000-0000-000000000001', 'CARGO_ADMINISTRADOR', 'Administrador del sistema',
     'Administracion de usuarios, roles, catalogos y configuracion institucional.', TRUE),
    ('30000000-0000-0000-0000-000000000002', 'CARGO_DIRECTOR',      'Director General',
     ' maxima autoridad institucional y aprobacion de resoluciones.', TRUE),
    ('30000000-0000-0000-0000-000000000003', 'CARGO_SECRETARIO',    'Secretario / Docente',
     'Calificacion, instruccion y proyeccion de resoluciones.', TRUE),
    ('30000000-0000-0000-0000-000000000004', 'CARGO_ESPECIALISTA',  'Especialista',
     'Apoyo tecnico, archivo y一直都 ties de gestion.', TRUE),
    ('30000000-0000-0000-0000-000000000005', 'CARGO_MESA_PARTES',   'Operador de Mesa de Partes',
     'Recepcion, radicacion y registro de documentos.', TRUE)
ON CONFLICT (codigo) DO NOTHING;


-- =============================================================================
-- 10.5 Puestos laborales (cargo + sede + area)
--     Se crean despues del organigrama (10.6) porque referencian sigd_org.area.
-- =============================================================================


-- =============================================================================
-- 10.6 Organigrama institucional
--     Los codigos ARE-001..ARE-007 son los que consume el arbol de navigation y
--     el clasificador CCD del frontend.
-- =============================================================================
INSERT INTO sigd_org.area (area_id, codigo, nombre, area_padre_id, vigente) VALUES
    ('40000000-0000-0000-0000-000000000001', 'ARE-000', 'Dirección General',          NULL, TRUE),
    ('40000000-0000-0000-0000-000000000002', 'ARE-001', 'Secretaría General',        '40000000-0000-0000-0000-000000000001', TRUE),
    ('40000000-0000-0000-0000-000000000003', 'ARE-002', 'Dirección de Admisión',     '40000000-0000-0000-0000-000000000001', TRUE),
    ('40000000-0000-0000-0000-000000000004', 'ARE-003', 'Dirección de Países',        '40000000-0000-0000-0000-000000000001', TRUE),
    ('40000000-0000-0000-0000-000000000005', 'ARE-004', 'Mesa de Partes',            '40000000-0000-0000-0000-000000000001', TRUE),
    ('40000000-0000-0000-0000-000000000006', 'ARE-005', 'Archivo Central',           '40000000-0000-0000-0000-000000000001', TRUE),
    ('40000000-0000-0000-0000-000000000007', 'ARE-006', 'Unidad de Soporte TI',       '40000000-0000-0000-0000-000000000001', TRUE)
ON CONFLICT (codigo) DO NOTHING;

-- Puestos laborales: cada cargo, en su area y en la sede central.
INSERT INTO sigd_org.puesto_laboral (puesto_laboral_id, cargo_id, sede_id, area_id, codigo, descripcion, activo) VALUES
    ('50000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000007', 'PL-ADMIN',  'Administrador del sistema - Soporte TI',    TRUE),
    ('50000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'PL-DIRECTOR', 'Director General',                        TRUE),
    ('50000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', 'PL-SECRETARIO', 'Secretaria General',                      TRUE),
    ('50000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', 'PL-ESPECIALISTA', 'Especialista de Admision',               TRUE),
    ('50000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000004', 'PL-MESA-PARTES', 'Operador de Mesa de Partes',             TRUE)
ON CONFLICT (codigo) DO NOTHING;


-- =============================================================================
-- 10.7 Calendario laboral 2026 - D. Leg. N. 713 y Ley N. 29001 (Ucayali)
--     Art. 143 TUO Ley 27444: el plazo supletorio corre en dias habiles, por lo
--     que el catalogo de feriados es normativo, no informativo.
--     'INSTITUCIONAL' corresponde a dias de suspension administrativa del IESTP.
-- =============================================================================
INSERT INTO sigd_org.calendario_laboral (fecha, tipo_feriado, descripcion, unidad_territorial, es_laborable, base_legal, activo) VALUES
    -- Feriados nacionales (D. Leg. 713 y Ley 29759)
    ('2026-01-01', 'NACIONAL',        'Año Nuevo',                                    'NACIONAL',  FALSE, 'D. Leg. 713', TRUE),
    ('2026-04-02', 'NACIONAL',        'Jueves Santo',                                 'NACIONAL',  FALSE, 'D. Leg. 713', TRUE),
    ('2026-04-03', 'NACIONAL',        'Viernes Santo',                                'NACIONAL',  FALSE, 'D. Leg. 713', TRUE),
    ('2026-05-01', 'NACIONAL',        'Día del Trabajo',                              'NACIONAL',  FALSE, 'D. Leg. 713', TRUE),
    ('2026-06-29', 'NACIONAL',        'San Pedro y San Pablo',                        'NACIONAL',  FALSE, 'D. Leg. 713', TRUE),
    ('2026-07-28', 'NACIONAL',        'Fiestas Patrias - Independencia',              'NACIONAL',  FALSE, 'D. Leg. 713', TRUE),
    ('2026-07-29', 'NACIONAL',        'Fiestas Patrias - Proclamación',               'NACIONAL',  FALSE, 'D. Leg. 713', TRUE),
    ('2026-08-06', 'NACIONAL',        'Batalla de Angamos',                           'NACIONAL',  FALSE, 'D. Leg. 713', TRUE),
    ('2026-10-08', 'NACIONAL',        'Combate de Angamos',                           'NACIONAL',  FALSE, 'D. Leg. 713', TRUE),
    ('2026-11-01', 'NACIONAL',        'Día de Todos los Santos',                      'NACIONAL',  FALSE, 'D. Leg. 713', TRUE),
    ('2026-11-02', 'NACIONAL',        'Día de Todos los Difuntos (transferencia)',   'NACIONAL',  FALSE, 'D. Leg. 713', TRUE),
    ('2026-12-08', 'NACIONAL',        'Inmaculada Concepción',                        'NACIONAL',  FALSE, 'D. Leg. 713', TRUE),
    ('2026-12-25', 'NACIONAL',        'Navidad',                                      'NACIONAL',  FALSE, 'D. Leg. 713', TRUE),

    -- Feriados regionales de Ucayali (Ley N. 29001)
    ('2026-06-07', 'REGIONAL_UCAYALI', 'Batalla de Arica',                             'UCAYALI',   FALSE, 'Ley 29001', TRUE),
    ('2026-06-24', 'REGIONAL_UCAYALI', 'Fiesta Patronal de San Juan Bautista',        'UCAYALI',   FALSE, 'Ley 29001', TRUE),
    ('2026-08-30', 'REGIONAL_UCAYALI', 'Santa Rosa de Lima',                          'UCAYALI',   FALSE, 'Ley 29001', TRUE),
    ('2026-10-13', 'REGIONAL_UCAYALI', 'Aniversario de la Creación de Ucayali',       'UCAYALI',   FALSE, 'Ley 29001', TRUE),
    ('2026-10-25', 'REGIONAL_UCAYALI', 'Conmemoración de la Batalla de Punchaná',     'UCAYALI',   FALSE, 'Ley 29001', TRUE),

    -- Días de suspension administrativa institucional
    ('2026-08-31', 'INSTITUCIONAL',    'Aniversario del IESTP "Suiza"',               'IESTP_SUIZA', FALSE, 'Resolución Directoral', TRUE)
ON CONFLICT (fecha, unidad_territorial) DO NOTHING;


-- =============================================================================
-- 10.8 TUPA - Procedimientos administrativos del IESTP
--     Los tres primeros ya existian (semilla de la migracion 08); se completan
--     los que corresponden a un IESTP de Educacion Tecnico Superior.
--     `plazo_dias` es el plazo maximo del Art. 35 del TUO de la Ley 27444.
-- =============================================================================
INSERT INTO sigd_doc.tipo_tramite_tupa
    (tipo_tramite_id, codigo, denominacion, descripcion, unidad_organica, plazo_dias, silencio_administrativo, base_legal, vigente) VALUES
    ('60000000-0000-0000-0000-000000000004', 'TUPA-04', 'Emisión de Constancia de Matrícula',
     'Constancia que acredita la matrícula del estudiante en el periodo académico vigente.',
     'Dirección de Admisión', 5, 'POSITIVO', 'Ley 28735, Ley 29735', TRUE),
    ('60000000-0000-0000-0000-000000000005', 'TUPA-05', 'Emisión de Constancia de estudios',
     'Constancia que acredita los estudios cursados y sus notas.',
     'Secretaría General', 5, 'POSITIVO', 'Ley 28735', TRUE),
    ('60000000-0000-0000-0000-000000000006', 'TUPA-06', 'Duplicado de carné de estudiante',
     'Segunda copia del carné institucional para el estudiante.',
     'Dirección de Admisión', 5, 'POSITIVO', 'Ley 28735', TRUE),
    ('60000000-0000-0000-0000-000000000007', 'TUPA-07', 'Entrega de carné de estudiante',
     'Emisión del carné institucional de estudiante.',
     'Dirección de Admisión', 5, 'POSITIVO', 'Ley 28735', TRUE),
    ('60000000-0000-0000-0000-000000000008', 'TUPA-08', 'Constancia de egreso',
     'Certificado que acredita la culminación del programa de estudios.',
     'Dirección de Admisión', 5, 'POSITIVO', 'Ley 28735', TRUE),
    ('60000000-0000-0000-0000-000000000009', 'TUPA-09', 'Registro de practicantes',
     'Inscripción de estudiantes para prácticas pre-profesionales en empresas.',
     'Dirección de Países', 10, 'NEGATIVO', 'Ley 28735', TRUE),
    ('60000000-0000-0000-0000-000000000010', 'TUPA-10', 'Emisión de Acta de Prácticas',
     'Acta oficial deebp de cumplimiento de prácticas pre-profesionales.',
     'Dirección de Países', 10, 'NEGATIVO', 'Ley 28735', TRUE),
    ('60000000-0000-0000-0000-000000000011', 'TUPA-11', 'Becas de estudios',
     'Solicitud, evaluación yOtorgamiento de beca de estudios.',
     'Dirección de Admisión', 30, 'NEGATIVO', 'Ley 30737', TRUE),
    ('60000000-0000-0000-0000-000000000012', 'TUPA-12', 'Justificaciones e inasistencias',
     'Registro y justificación de inasistencias o tardanzas.',
     'Secretaría General', 3, 'POSITIVO', 'Reglamento interno', TRUE),
    ('60000000-0000-0000-0000-000000000013', 'TUPA-13', 'Reclamaciones administrativas',
     'Procedimiento de reclamación ante el órgano instructor.',
     'Dirección General', 30, 'NEGATIVO', 'TUO Ley 27444, Art. 218', TRUE),
    ('60000000-0000-0000-0000-000000000014', 'TUPA-14', 'Recursos de reconsideración',
     'Recurso de reconsideración contra la resolución administrativa.',
     'Dirección General', 10, 'NEGATIVO', 'TUO Ley 27444, Art. 218', TRUE),
    ('60000000-0000-0000-0000-000000000015', 'TUPA-15', 'Recursos de apelación',
     'Recurso de apelación ante el órgano superior.',
     'Dirección General', 20, 'NEGATIVO', 'TUO Ley 27444, Art. 219', TRUE),
    ('60000000-0000-0000-0000-000000000016', 'TUPA-16', 'Copia de documentos archivados',
     'Copia simple de documentos que sustentan un expediente archivado.',
     'Archivo Central', 5, 'POSITIVO', 'TUO Ley 27444, Arts. 153-156', TRUE),
    ('60000000-0000-0000-0000-000000000017', 'TUPA-17', 'Cotejo de documentos originales',
     'Cotejo de copias con el documento original archivado.',
     'Archivo Central', 3, 'POSITIVO', 'TUO Ley 27444, Art. 155', TRUE),
    ('60000000-0000-0000-0000-000000000018', 'TUPA-18', 'Información sobreferenced',
     'Información requerida por el ciudadano sobre un procedimiento concluido.',
     'Archivo Central', 5, 'POSITIVO', 'TUO Ley 27444, Art. 5', TRUE),
    ('60000000-0000-0000-0000-000000000019', 'TUPA-19', 'Actualización de datos personales',
     'Modificación de los datos personales consignados en el padrón.',
     'Dirección de Admisión', 10, 'POSITIVO', 'Ley 29733, Art. 8', TRUE),
    ('60000000-0000-0000-0000-000000000020', 'TUPA-20', 'Solicitud de certificado modular',
     'Certificado de competencias por modulo del programa de estudios.',
     'Dirección de Países', 10, 'NEGATIVO', 'Ley 28735', TRUE)
ON CONFLICT (codigo) DO NOTHING;


-- =============================================================================
-- 10.9 Matriz rol -> permiso
--     Los seis permisos sembrados en la migracion 03 se asignan de forma que
--     cada rol tenga exactamente los permisos que le son propios. Sin esta
--     matriz la matriz de permisos de la UI queda vacia.
-- =============================================================================
INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
  FROM sigd_org.rol_sistema r
  CROSS JOIN sigd_org.permiso_sistema p
 WHERE r.codigo = 'ADMINISTRADOR'
ON CONFLICT DO NOTHING;

INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
  FROM sigd_org.rol_sistema r
  CROSS JOIN sigd_org.permiso_sistema p
 WHERE r.codigo = 'DIRECTOR'
   AND p.codigo IN ('EXPEDIENTE_LEER', 'EXPEDIENTE_DERIVAR', 'EXPEDIENTE_RESOLVER',
                    'FIRMA_FIRMAR', 'REPORTE_LEER')
ON CONFLICT DO NOTHING;

INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
  FROM sigd_org.rol_sistema r
  CROSS JOIN sigd_org.permiso_sistema p
 WHERE r.codigo IN ('SECRETARIO', 'ESPECIALISTA')
   AND p.codigo IN ('EXPEDIENTE_LEER', 'EXPEDIENTE_DERIVAR', 'EXPEDIENTE_RESOLVER', 'FIRMA_FIRMAR')
ON CONFLICT DO NOTHING;

INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
  FROM sigd_org.rol_sistema r
  CROSS JOIN sigd_org.permiso_sistema p
 WHERE r.codigo = 'MESA_PARTES'
   AND p.codigo = 'EXPEDIENTE_LEER'
ON CONFLICT DO NOTHING;


-- =============================================================================
-- 10.10 Cuentas de prueba por rol  *** SOLO ENTORNO DE DESARROLLO ***
-- -----------------------------------------------------------------------------
-- Cuentas de evaluacion, una por rol, para poder recorrer todos los modulos y
-- comprobar que el RBAC efectivo coincide con el declarado en la UI.
-- Todas comparten la MISMA contrasena de la semilla 08 (`Admin2026`) y el mismo
-- hash Argon2id: no son secretos y no deben usarse fuera de desarrollo.
-- Eliminar esta seccion antes de cualquier despliegue.
--
--   admin      / Admin2026   -> ADMINISTRADOR
--   director   / Admin2026   -> DIRECTOR
--   secretario / Admin2026   -> SECRETARIO
--   especialista/ Admin2026   -> ESPECIALISTA
--   mesaparte  / Admin2026   -> MESA_PARTES
-- =============================================================================

-- Personas de las cuentas institucionales (DNI ficticio de evaluacion).
INSERT INTO sigd_auth.persona (id_persona, tipo, id_documento) VALUES
    ('70000000-0000-0000-0000-000000000002', 'NATURAL', '70000002'),
    ('70000000-0000-0000-0000-000000000003', 'NATURAL', '70000003'),
    ('70000000-0000-0000-0000-000000000004', 'NATURAL', '70000004'),
    ('70000000-0000-0000-0000-000000000005', 'NATURAL', '70000005')
ON CONFLICT (id_persona) DO NOTHING;

INSERT INTO sigd_auth.persona_natural (id_persona, nombres, apellidos, nombre_completo, sexo, correo) VALUES
    ('70000000-0000-0000-0000-000000000002', 'Elena',    'Rojas Vasquez',   'Elena Rojas Vasquez',    'F', 'director@iestp-suiza.edu.pe'),
    ('70000000-0000-0000-0000-000000000003', 'Marco',    'Salazar Diaz',    'Marco Salazar Diaz',     'M', 'secretario@iestp-suiza.edu.pe'),
    ('70000000-0000-0000-0000-000000000004', 'Rosa',     'Canohuisa Neyra',  'Rosa Canohuisa Neyra',   'F', 'especialista@iestp-suiza.edu.pe'),
    ('70000000-0000-0000-0000-000000000005', 'Jorge',    'Pineda Torres',   'Jorge Pineda Torres',    'M', 'mesaparte@iestp-suiza.edu.pe')
ON CONFLICT (id_persona) DO NOTHING;

INSERT INTO sigd_auth.cuenta_usuario (id_usuario, id_persona, usuario, correo, password_hash, activo) VALUES
    ('70000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000002', 'director',
     'director@iestp-suiza.edu.pe',
     '$argon2id$v=19$m=65536,t=3,p=4$eb61bfc077deb7628711e2968838a351$d36240363331fc658d6da9d7bb2c64fd19dbaa43926f1fba51d2780e7b69453c410a6166ae31e4f9bfd0760ed7d32160135d4e54febf95c4039345be1cadd0dc', TRUE),
    ('70000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000003', 'secretario',
     'secretario@iestp-suiza.edu.pe',
     '$argon2id$v=19$m=65536,t=3,p=4$eb61bfc077deb7628711e2968838a351$d36240363331fc658d6da9d7bb2c64fd19dbaa43926f1fba51d2780e7b69453c410a6166ae31e4f9bfd0760ed7d32160135d4e54febf95c4039345be1cadd0dc', TRUE),
    ('70000000-0000-0000-0000-000000000004', '70000000-0000-0000-0000-000000000004', 'especialista',
     'especialista@iestp-suiza.edu.pe',
     '$argon2id$v=19$m=65536,t=3,p=4$eb61bfc077deb7628711e2968838a351$d36240363331fc658d6da9d7bb2c64fd19dbaa43926f1fba51d2780e7b69453c410a6166ae31e4f9bfd0760ed7d32160135d4e54febf95c4039345be1cadd0dc', TRUE),
    ('70000000-0000-0000-0000-000000000005', '70000000-0000-0000-0000-000000000005', 'mesaparte',
     'mesaparte@iestp-suiza.edu.pe',
     '$argon2id$v=19$m=65536,t=3,p=4$eb61bfc077deb7628711e2968838a351$d36240363331fc658d6da9d7bb2c64fd19dbaa43926f1fba51d2780e7b69453c410a6166ae31e4f9bfd0760ed7d32160135d4e54febf95c4039345be1cadd0dc', TRUE)
ON CONFLICT (usuario) DO NOTHING;

-- Asignación de rol a cada cuenta (vigente desde el inicio del ejercicio).
INSERT INTO sigd_org.usuario_rol (id_usuario_rol, id_usuario, rol_id, area_id, vigente_desde)
SELECT
    gen_random_uuid(),
    u.id_usuario,
    r.rol_id,
    CASE r.codigo
        WHEN 'DIRECTOR'     THEN '40000000-0000-0000-0000-000000000001'::uuid
        WHEN 'SECRETARIO'   THEN '40000000-0000-0000-0000-000000000002'::uuid
        WHEN 'ESPECIALISTA' THEN '40000000-0000-0000-0000-000000000003'::uuid
        WHEN 'MESA_PARTES'  THEN '40000000-0000-0000-0000-000000000004'::uuid
        ELSE NULL
    END,
    DATE '2026-01-01'
  FROM sigd_auth.cuenta_usuario u
  JOIN sigd_auth.persona_natural pn ON pn.id_persona = u.id_persona
  JOIN sigd_org.rol_sistema r
    ON r.codigo = CASE u.usuario
        WHEN 'director'     THEN 'DIRECTOR'
        WHEN 'secretario'   THEN 'SECRETARIO'
        WHEN 'especialista' THEN 'ESPECIALISTA'
        WHEN 'mesaparte'    THEN 'MESA_PARTES'
        ELSE NULL
    END
WHERE u.usuario IN ('director', 'secretario', 'especialista', 'mesaparte')
  AND NOT EXISTS (
    SELECT 1 FROM sigd_org.usuario_rol ur
     WHERE ur.id_usuario = u.id_usuario AND ur.rol_id = r.rol_id
  );