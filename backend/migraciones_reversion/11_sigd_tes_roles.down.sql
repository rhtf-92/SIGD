DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM sigd_org.usuario_rol ur JOIN sigd_org.rol_sistema r USING(rol_id)
  WHERE r.codigo IN('CAJERO','TESORERO','SUPERVISOR_TESORERIA','APROBADOR_DEVOLUCIONES')) THEN
  RAISE EXCEPTION 'Hay asignaciones financieras; no se permite revocar roles como efecto de una reversión';
 END IF;
END $$;
DELETE FROM sigd_org.rol_permiso WHERE rol_id IN(SELECT rol_id FROM sigd_org.rol_sistema WHERE codigo IN('CAJERO','TESORERO','SUPERVISOR_TESORERIA','APROBADOR_DEVOLUCIONES'));
DELETE FROM sigd_org.rol_sistema WHERE codigo IN('CAJERO','TESORERO','SUPERVISOR_TESORERIA','APROBADOR_DEVOLUCIONES');
ALTER TABLE sigd_org.rol_sistema DROP CONSTRAINT chk_rol_codigo;
ALTER TABLE sigd_org.rol_sistema ADD CONSTRAINT chk_rol_codigo CHECK(codigo IN('ADMINISTRADOR','DIRECTOR','SECRETARIO','ESPECIALISTA','MESA_PARTES','CIUDADANO'));
