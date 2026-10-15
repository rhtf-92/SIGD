-- Permisos de autorización para los endpoints administrativos.
-- Los permisos existentes de la plataforma se conservan; estas filas sólo
-- conectan el guard de API con las asignaciones editables en PostgreSQL.

INSERT INTO sigd_org.permiso_sistema (codigo, nombre, ambito)
VALUES
    ('admin:acceso', 'Acceso al módulo de administración', 'GLOBAL'),
    ('usuarios:leer', 'Consultar usuarios', 'GLOBAL'),
    ('usuarios:gestionar', 'Crear y actualizar usuarios', 'GLOBAL'),
    ('roles:leer', 'Consultar roles y permisos', 'GLOBAL'),
    ('auditoria:leer', 'Consultar auditoría', 'GLOBAL'),
    ('organigrama:leer', 'Consultar organigrama', 'GLOBAL'),
    ('organigrama:gestionar', 'Gestionar organigrama', 'GLOBAL'),
    ('maestras:leer', 'Consultar tablas maestras', 'GLOBAL'),
    ('maestras:gestionar', 'Gestionar tablas maestras', 'GLOBAL'),
    ('calendario:leer', 'Consultar calendario laboral', 'GLOBAL'),
    ('calendario:gestionar', 'Gestionar calendario laboral', 'GLOBAL')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
  FROM sigd_org.rol_sistema r
 CROSS JOIN sigd_org.permiso_sistema p
 WHERE r.codigo = 'ADMINISTRADOR'
   AND p.codigo IN (
       'admin:acceso', 'usuarios:leer', 'usuarios:gestionar', 'roles:leer',
       'auditoria:leer', 'organigrama:leer', 'organigrama:gestionar',
       'maestras:leer', 'maestras:gestionar', 'calendario:leer', 'calendario:gestionar'
   )
ON CONFLICT DO NOTHING;

INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
  FROM sigd_org.rol_sistema r
  JOIN sigd_org.permiso_sistema p
    ON p.codigo IN ('admin:acceso', 'organigrama:leer', 'calendario:leer')
 WHERE r.codigo = 'DIRECTOR'
ON CONFLICT DO NOTHING;
