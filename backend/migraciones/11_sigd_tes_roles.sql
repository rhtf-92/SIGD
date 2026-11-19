-- Add financial role definitions only. Never assign a financial role to a user.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM sigd_org.rol_sistema WHERE codigo NOT IN('ADMINISTRADOR','DIRECTOR','SECRETARIO','ESPECIALISTA','MESA_PARTES','CIUDADANO')) THEN
  RAISE EXCEPTION 'El catálogo de roles cambió: revisar antes de ampliar la restricción';
 END IF;
END $$;
ALTER TABLE sigd_org.rol_sistema DROP CONSTRAINT chk_rol_codigo;
ALTER TABLE sigd_org.rol_sistema ADD CONSTRAINT chk_rol_codigo CHECK(codigo IN(
 'ADMINISTRADOR','DIRECTOR','SECRETARIO','ESPECIALISTA','MESA_PARTES','CIUDADANO',
 'CAJERO','TESORERO','SUPERVISOR_TESORERIA','APROBADOR_DEVOLUCIONES'));
INSERT INTO sigd_org.rol_sistema(codigo,nombre,descripcion) VALUES
 ('CAJERO','Cajero','Registra operaciones de caja; no verifica sus registros ni aprueba devoluciones.'),
 ('TESORERO','Tesorero','Verifica pagos de terceros, propone tarifas y evalúa devoluciones.'),
 ('SUPERVISOR_TESORERIA','Supervisor de Tesorería','Valida tarifas de otro funcionario y registra ejecuciones externas de devolución; no aprueba devoluciones.'),
 ('APROBADOR_DEVOLUCIONES','Aprobador de devoluciones','Aprueba o rechaza solicitudes evaluadas por otro funcionario; no ejecuta reembolsos.');
INSERT INTO sigd_org.rol_permiso(rol_id,permiso_id)
SELECT r.rol_id,p.permiso_id FROM sigd_org.rol_sistema r CROSS JOIN sigd_org.permiso_sistema p
WHERE (r.codigo='CAJERO' AND p.codigo IN('TESORERIA_LEER','TESORERIA_PAGO_REGISTRAR'))
 OR (r.codigo='TESORERO' AND p.codigo IN('TESORERIA_LEER','TESORERIA_PAGO_VERIFICAR','TESORERIA_DEVOLUCION_EVALUAR','TESORERIA_TARIFA_PROPONER'))
 OR (r.codigo='SUPERVISOR_TESORERIA' AND p.codigo IN('TESORERIA_LEER','TESORERIA_REPORTES','TESORERIA_TARIFA_VALIDAR','TESORERIA_DEVOLUCION_EJECUTAR'))
 OR (r.codigo='APROBADOR_DEVOLUCIONES' AND p.codigo IN('TESORERIA_LEER','TESORERIA_REPORTES','TESORERIA_DEVOLUCION_APROBAR'));
