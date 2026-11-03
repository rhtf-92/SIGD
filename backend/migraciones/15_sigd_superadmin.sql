-- Migración 15 · Cuenta inicial de superadministración
-- La contraseña se generó aleatoriamente para el entorno local F_BARTRA;
-- entregar al operador y cambiarla al primer acceso.

BEGIN;

INSERT INTO sigd_auth.persona (tipo, id_documento)
VALUES ('NATURAL', 'SIGD-SUPERADMIN')
ON CONFLICT (tipo, id_documento) DO NOTHING;

INSERT INTO sigd_auth.persona_natural (
    id_persona, nombres, apellidos, nombre_completo, correo
)
SELECT id_persona, 'Administrador', 'del Sistema', 'Administrador del Sistema', 'superadmin@sigd.local'
  FROM sigd_auth.persona
 WHERE tipo = 'NATURAL'
   AND id_documento = 'SIGD-SUPERADMIN'
ON CONFLICT (id_persona) DO NOTHING;

INSERT INTO sigd_auth.cuenta_usuario (
    id_persona, usuario, correo, password_hash
)
SELECT id_persona, 'superadmin', 'superadmin@sigd.local',
       '$argon2id$v=19$m=65536,p=4,t=3$h7QPMcdMfloBVRu4qHVGLA$ivV2Z5qhD70jArzGKM/A6NCgEiz1+m697hOYKhKHRJM'
  FROM sigd_auth.persona
 WHERE tipo = 'NATURAL'
   AND id_documento = 'SIGD-SUPERADMIN'
ON CONFLICT (usuario) DO NOTHING;

-- ADMINISTRADOR es el rol persistido que la API presenta como SUPER_ADMIN.
INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
  FROM sigd_org.rol_sistema AS r
 CROSS JOIN sigd_org.permiso_sistema AS p
 WHERE r.codigo = 'ADMINISTRADOR'
ON CONFLICT DO NOTHING;

INSERT INTO sigd_org.usuario_rol (id_usuario, rol_id)
SELECT c.id_usuario, r.rol_id
  FROM sigd_auth.cuenta_usuario AS c
 CROSS JOIN sigd_org.rol_sistema AS r
 WHERE c.usuario = 'superadmin'
   AND r.codigo = 'ADMINISTRADOR'
   AND NOT EXISTS (
       SELECT 1
         FROM sigd_org.usuario_rol AS ur
        WHERE ur.id_usuario = c.id_usuario
          AND ur.rol_id = r.rol_id
          AND ur.vigente_desde <= now()
          AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
   );

COMMIT;
