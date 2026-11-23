-- Explicit operator action only. Refuse rollback when financial evidence exists.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM sigd_tes.orden_pago) OR EXISTS(SELECT 1 FROM sigd_tes.documento) OR EXISTS(SELECT 1 FROM sigd_tes.tarifa) THEN
  RAISE EXCEPTION 'M10 contiene evidencia; no se permite perderla en una reversión';
 END IF;
 IF EXISTS(SELECT 1 FROM sigd_org.rol_permiso rp JOIN sigd_org.permiso_sistema p USING(permiso_id) WHERE p.codigo LIKE 'TESORERIA_%') THEN
  RAISE EXCEPTION 'Retire las asignaciones M10 autorizadamente antes de revertir';
 END IF;
END $$;
DROP SCHEMA sigd_tes CASCADE;
DELETE FROM sigd_org.permiso_sistema WHERE codigo IN('TESORERIA_LEER','TESORERIA_TARIFA_PROPONER','TESORERIA_TARIFA_VALIDAR','TESORERIA_PAGO_REGISTRAR','TESORERIA_PAGO_VERIFICAR','TESORERIA_DEVOLUCION_EVALUAR','TESORERIA_DEVOLUCION_APROBAR','TESORERIA_DEVOLUCION_EJECUTAR','TESORERIA_REPORTES');
