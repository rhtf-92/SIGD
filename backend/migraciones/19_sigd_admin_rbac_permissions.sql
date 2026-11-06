-- Permisos editables para guards administrativos. Las migraciones históricas
-- 15 y 16 ya están aplicadas en instalaciones existentes y no se reescriben.
INSERT INTO sigd_org.permiso_sistema (codigo, nombre, ambito)
VALUES
    ('admin:acceso', 'Acceso a rutas administrativas', 'GLOBAL'),
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
