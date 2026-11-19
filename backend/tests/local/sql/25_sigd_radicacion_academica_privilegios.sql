BEGIN;
-- PROTECCION: migracion exclusiva del entorno academico F_BARTRA.
DO $$
BEGIN
  IF current_database() <> 'sigd_fbartra_demo_20261030' THEN
    RAISE EXCEPTION
      'Migracion 25 exclusiva de sigd_fbartra_demo_20261030';
  END IF;
END $$;
-- Radicacion virtual academica: privilegios completos y de minimo alcance.
-- PostgreSQL 18. No desactiva triggers, restricciones ni validaciones.

-- Las dos funciones invocadas expresamente por el backend encapsulan escrituras
-- internas. SECURITY DEFINER evita conceder UPDATE global solo para tomar un
-- bloqueo FOR UPDATE y evita exponer la tabla del correlativo anual.
ALTER FUNCTION sigd_tra.fn_generar_cut(integer) SECURITY DEFINER;
ALTER FUNCTION sigd_tra.fn_generar_cut(integer)
  SET search_path = pg_catalog, sigd_tra, pg_temp;
ALTER FUNCTION sigd_tra.generar_cut_expediente(integer)
  SET search_path = pg_catalog, sigd_tra, pg_temp;

ALTER FUNCTION sigd_tra.agregar_folio_expediente(uuid, uuid, integer, uuid)
  SECURITY DEFINER;
ALTER FUNCTION sigd_tra.agregar_folio_expediente(uuid, uuid, integer, uuid)
  SET search_path = pg_catalog, sigd_tra, pg_temp;

REVOKE EXECUTE ON FUNCTION sigd_tra.fn_generar_cut(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION sigd_tra.generar_cut_expediente(integer) FROM PUBLIC, sigd_app;
REVOKE EXECUTE ON FUNCTION sigd_tra.agregar_folio_expediente(uuid, uuid, integer, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sigd_tra.fn_generar_cut(integer) TO sigd_app;
GRANT EXECUTE ON FUNCTION sigd_tra.agregar_folio_expediente(uuid, uuid, integer, uuid) TO sigd_app;

-- Los triggers se ejecutan con el propietario de sus funciones. Sus search_path
-- quedan fijados para impedir sustitucion de objetos en funciones privilegiadas.
ALTER FUNCTION sigd_tra.fn_tra_expediente_asignar_cut() SECURITY DEFINER;
ALTER FUNCTION sigd_tra.fn_tra_expediente_asignar_cut()
  SET search_path = pg_catalog, sigd_tra, pg_temp;
ALTER FUNCTION sigd_tra.exigir_adjunto_virtual() SECURITY DEFINER;
ALTER FUNCTION sigd_tra.exigir_adjunto_virtual()
  SET search_path = pg_catalog, sigd_tra, sigd_doc, pg_temp;
ALTER FUNCTION sigd_tra.fn_verificar_continuidad_folio() SECURITY DEFINER;
ALTER FUNCTION sigd_tra.fn_verificar_continuidad_folio()
  SET search_path = pg_catalog, sigd_tra, pg_temp;
ALTER FUNCTION sigd_tra.fn_rechazar_mutacion_folio() SECURITY DEFINER;
ALTER FUNCTION sigd_tra.fn_rechazar_mutacion_folio()
  SET search_path = pg_catalog, sigd_tra, pg_temp;

ALTER FUNCTION sigd_rut.registrar_movimiento_identidad() SECURITY DEFINER;
ALTER FUNCTION sigd_rut.registrar_movimiento_identidad()
  SET search_path = pg_catalog, sigd_rut, pg_temp;
ALTER FUNCTION sigd_rut.actualizar_estado_actual_expediente() SECURITY DEFINER;
ALTER FUNCTION sigd_rut.actualizar_estado_actual_expediente()
  SET search_path = pg_catalog, sigd_rut, pg_temp;
ALTER FUNCTION sigd_rut.actualizar_contador_pestana_local() SECURITY DEFINER;
ALTER FUNCTION sigd_rut.actualizar_contador_pestana_local()
  SET search_path = pg_catalog, sigd_rut, pg_temp;
ALTER FUNCTION sigd_rut.actualizar_contador_expediente_externo() SECURITY DEFINER;
ALTER FUNCTION sigd_rut.actualizar_contador_expediente_externo()
  SET search_path = pg_catalog, sigd_rut, pg_temp;

REVOKE EXECUTE ON FUNCTION sigd_tra.fn_tra_expediente_asignar_cut() FROM PUBLIC, sigd_app;
REVOKE EXECUTE ON FUNCTION sigd_tra.exigir_adjunto_virtual() FROM PUBLIC, sigd_app;
REVOKE EXECUTE ON FUNCTION sigd_tra.fn_verificar_continuidad_folio() FROM PUBLIC, sigd_app;
REVOKE EXECUTE ON FUNCTION sigd_tra.fn_rechazar_mutacion_folio() FROM PUBLIC, sigd_app;
REVOKE EXECUTE ON FUNCTION sigd_rut.registrar_movimiento_identidad() FROM PUBLIC, sigd_app;
REVOKE EXECUTE ON FUNCTION sigd_rut.actualizar_estado_actual_expediente() FROM PUBLIC, sigd_app;
REVOKE EXECUTE ON FUNCTION sigd_rut.actualizar_contador_pestana_local() FROM PUBLIC, sigd_app;
REVOKE EXECUTE ON FUNCTION sigd_rut.actualizar_contador_expediente_externo() FROM PUBLIC, sigd_app;

-- Operaciones directas de la transaccion y de la carga previa del PDF.
GRANT USAGE ON SCHEMA sigd_audit, sigd_auth, sigd_doc, sigd_org, sigd_rut, sigd_tra TO sigd_app;
GRANT SELECT ON TABLE sigd_doc.tipo_tramite_tupa, sigd_doc.tipo_documento TO sigd_app;
GRANT SELECT ON TABLE sigd_org.calendario_laboral TO sigd_app;
GRANT SELECT, INSERT, UPDATE ON TABLE sigd_doc.carga_documento TO sigd_app;
GRANT SELECT, INSERT ON TABLE sigd_doc.documento_adjunto TO sigd_app;
GRANT INSERT ON TABLE sigd_doc.expediente TO sigd_app;
GRANT SELECT, INSERT ON TABLE sigd_tra.expediente TO sigd_app;
GRANT SELECT, INSERT ON TABLE sigd_tra.tramite TO sigd_app;
GRANT INSERT ON TABLE sigd_tra.asiento_registro TO sigd_app;
GRANT USAGE ON SEQUENCE sigd_tra.seq_asiento_numero_registro TO sigd_app;
GRANT SELECT ON TABLE sigd_tra.expediente_documento_folio TO sigd_app;
GRANT SELECT, INSERT ON TABLE sigd_rut.movimiento_tramite TO sigd_app;
GRANT SELECT ON TABLE sigd_rut.estado_actual_expediente, sigd_rut.contador_pestana_local TO sigd_app;
GRANT INSERT ON TABLE sigd_audit.evento_outbox TO sigd_app;
GRANT INSERT ON TABLE sigd_tra.cargo_digital TO sigd_app;

-- Tablas internas: solo las funciones privilegiadas anteriores pueden mutarlas.
REVOKE ALL ON TABLE sigd_tra.secuencia_anual_cut FROM sigd_app;
REVOKE INSERT, UPDATE, DELETE ON TABLE sigd_tra.expediente_documento_folio FROM sigd_app;
REVOKE INSERT, UPDATE, DELETE ON TABLE sigd_rut.movimiento_secuencia FROM sigd_app;
REVOKE INSERT, UPDATE, DELETE ON TABLE sigd_rut.movimiento_identidad FROM sigd_app;
REVOKE INSERT, UPDATE, DELETE ON TABLE sigd_rut.estado_actual_expediente FROM sigd_app;
REVOKE INSERT, UPDATE, DELETE ON TABLE sigd_rut.contador_pestana_local FROM sigd_app;

COMMENT ON FUNCTION sigd_tra.fn_generar_cut(integer) IS
  'API privilegiada minima para reservar el CUT anual desde sigd_app.';
COMMENT ON FUNCTION sigd_tra.agregar_folio_expediente(uuid, uuid, integer, uuid) IS
  'API privilegiada minima para bloquear el expediente y registrar foliacion continua.';

-- Permisos complementarios de lectura validados en la base academica.
-- Requeridos por ConsultaPublicaService y docucore.security.ts.
-- No conceden permisos de escritura.

GRANT SELECT ON TABLE
  sigd_doc.expediente,
  sigd_tra.asiento_registro,
  sigd_rut.movimiento_compensatorio,
  sigd_auth.cuenta_usuario,
  sigd_org.asignacion_personal,
  sigd_org.usuario_rol,
  sigd_org.rol_sistema
TO sigd_app;
COMMIT;
