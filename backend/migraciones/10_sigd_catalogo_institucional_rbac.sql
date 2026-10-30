DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='sigd_app') THEN RAISE EXCEPTION 'El rol sigd_app es obligatorio' USING ERRCODE='42704'; END IF;
  IF NOT EXISTS(SELECT 1 FROM sigd_org.rol_sistema WHERE codigo='ADMINISTRADOR' AND vigente) OR NOT EXISTS(SELECT 1 FROM sigd_org.rol_sistema WHERE codigo='DIRECTOR' AND vigente) THEN RAISE EXCEPTION 'Faltan roles administrativos requeridos' USING ERRCODE='23503'; END IF;
END $$;
INSERT INTO sigd_org.permiso_sistema(codigo,nombre,ambito) VALUES
('CATALOGO_ADMIN_LEER','Consultar catalogo institucional administrativo','GLOBAL'),('CATALOGO_CONCEPTO_CREAR','Crear conceptos del catalogo institucional','GLOBAL'),('CATALOGO_METADATOS_EDITAR','Editar metadatos del catalogo institucional','GLOBAL'),('CATALOGO_VERSION_CREAR','Crear versiones del catalogo institucional','GLOBAL'),('CATALOGO_PUBLICACION_GESTIONAR','Publicar o retirar publicaciones del catalogo institucional','GLOBAL'),('CATALOGO_ESTADO_GESTIONAR','Activar o desactivar conceptos del catalogo institucional','GLOBAL') ON CONFLICT(codigo) DO NOTHING;
WITH a(rol,permiso) AS (VALUES
('ADMINISTRADOR','CATALOGO_ADMIN_LEER'),('ADMINISTRADOR','CATALOGO_CONCEPTO_CREAR'),('ADMINISTRADOR','CATALOGO_METADATOS_EDITAR'),('ADMINISTRADOR','CATALOGO_VERSION_CREAR'),('ADMINISTRADOR','CATALOGO_PUBLICACION_GESTIONAR'),('ADMINISTRADOR','CATALOGO_ESTADO_GESTIONAR'),('DIRECTOR','CATALOGO_ADMIN_LEER'),('DIRECTOR','CATALOGO_PUBLICACION_GESTIONAR'))
INSERT INTO sigd_org.rol_permiso(rol_id,permiso_id) SELECT r.rol_id,p.permiso_id FROM a JOIN sigd_org.rol_sistema r ON r.codigo=a.rol JOIN sigd_org.permiso_sistema p ON p.codigo=a.permiso ON CONFLICT(rol_id,permiso_id) DO NOTHING;
GRANT USAGE ON SCHEMA sigd_org TO sigd_app;
GRANT SELECT ON sigd_org.usuario_rol,sigd_org.rol_sistema,sigd_org.rol_permiso,sigd_org.permiso_sistema TO sigd_app;
