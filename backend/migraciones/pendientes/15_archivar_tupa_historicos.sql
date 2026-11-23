-- Conservación histórica independiente del catálogo operativo. Aplicación manual demo.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $$ BEGIN IF current_database()<>'sigd_jacobo_demo' THEN RAISE EXCEPTION 'Base no autorizada'; END IF; END $$;
LOCK TABLE sigd_doc.tipo_tramite_tupa,sigd_doc.expediente,sigd_doc.requisito,
 sigd_doc.tipo_documento_requisito,sigd_doc.expediente_requisito,sigd_doc.formulario_version,
 sigd_tes.tarifa,sigd_tes.orden_pago IN SHARE ROW EXCLUSIVE MODE;

-- La cuenta no tiene REFERENCES sobre auditoría. El trigger inferior valida pertenencia
-- y la bitácora WORM impide retirar o modificar la evidencia, sin ampliar privilegios.
ALTER TABLE sigd_doc.expediente ADD COLUMN IF NOT EXISTS tupa_historico_auditoria_id uuid;
ALTER TABLE sigd_doc.expediente ALTER COLUMN tipo_tramite_id DROP NOT NULL;

DO $archivo$
DECLARE t record; evidencia uuid; correlacion uuid:=gen_random_uuid(); requisitos jsonb; relaciones jsonb;
BEGIN
 IF (SELECT count(*) FROM sigd_doc.tipo_tramite_tupa WHERE vigente)<>72 THEN RAISE EXCEPTION 'Vigentes inesperados'; END IF;
 IF EXISTS(SELECT 1 FROM sigd_doc.tipo_tramite_tupa WHERE NOT vigente AND codigo NOT IN('TUPA-01','TUPA-02','TUPA-03')) THEN RAISE EXCEPTION 'Históricos no previstos'; END IF;
 FOR t IN SELECT * FROM sigd_doc.tipo_tramite_tupa WHERE codigo IN('TUPA-01','TUPA-02','TUPA-03') ORDER BY codigo LOOP
  IF t.vigente OR t.tipo_tramite_id<>('00000000-0000-0000-0000-'||lpad(right(t.codigo,2),12,'0'))::uuid THEN RAISE EXCEPTION 'Tipo histórico incompatible'; END IF;
  IF EXISTS(SELECT 1 FROM sigd_doc.formulario_version WHERE tipo_tramite_id=t.tipo_tramite_id)
   OR EXISTS(SELECT 1 FROM sigd_tes.tarifa WHERE tipo_tramite_id=t.tipo_tramite_id)
   OR EXISTS(SELECT 1 FROM sigd_tes.orden_pago WHERE tipo_tramite_id=t.tipo_tramite_id)
   OR EXISTS(SELECT 1 FROM sigd_doc.expediente_requisito x JOIN sigd_doc.requisito r USING(requisito_id) WHERE r.tipo_tramite_id=t.tipo_tramite_id)
   THEN RAISE EXCEPTION 'Dependencia adicional: detener y revisar %',t.codigo; END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.requisito_id),'[]') INTO requisitos FROM sigd_doc.requisito r WHERE tipo_tramite_id=t.tipo_tramite_id;
  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id_relacion),'[]') INTO relaciones FROM sigd_doc.tipo_documento_requisito x JOIN sigd_doc.requisito r USING(requisito_id) WHERE r.tipo_tramite_id=t.tipo_tramite_id;
  INSERT INTO sigd_audit.bitacora_auditoria(correlation_id,esquema,tabla,operacion,datos_antes,datos_despues)
   VALUES(correlacion,'sigd_doc','tupa_historico','DELETE',to_jsonb(t),jsonb_build_object(
    'version',1,'migracion','15_archivar_tupa_historicos','motivo','Retiro del catálogo operativo sin reclasificar expedientes',
    'requisitos',requisitos,'tipos_documento_requisito',relaciones,
    'expedientes',coalesce((SELECT jsonb_agg(to_jsonb(e)-'tupa_historico_auditoria_id' ORDER BY e.expediente_id) FROM sigd_doc.expediente e WHERE e.tipo_tramite_id=t.tipo_tramite_id),'[]')))
   RETURNING id_auditoria INTO evidencia;
  UPDATE sigd_doc.expediente SET tipo_tramite_id=NULL,tupa_historico_auditoria_id=evidencia WHERE tipo_tramite_id=t.tipo_tramite_id;
  DELETE FROM sigd_doc.tipo_documento_requisito x USING sigd_doc.requisito r WHERE x.requisito_id=r.requisito_id AND r.tipo_tramite_id=t.tipo_tramite_id;
  DELETE FROM sigd_doc.requisito WHERE tipo_tramite_id=t.tipo_tramite_id;
  DELETE FROM sigd_doc.tipo_tramite_tupa WHERE tipo_tramite_id=t.tipo_tramite_id;
 END LOOP;
 IF (SELECT count(*) FROM sigd_doc.tipo_tramite_tupa)<>72 THEN RAISE EXCEPTION 'El catálogo final no tiene 72 filas'; END IF;
END $archivo$;

DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='sigd_doc.expediente'::regclass AND conname='expediente_tupa_origen_unico') THEN
 ALTER TABLE sigd_doc.expediente ADD CONSTRAINT expediente_tupa_origen_unico
 CHECK(num_nonnulls(tipo_tramite_id,tupa_historico_auditoria_id)=1);
 END IF;
END $$;
CREATE OR REPLACE FUNCTION sigd_doc.fn_validar_tupa_historico() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.tupa_historico_auditoria_id IS NOT NULL AND
 (NEW.tupa_historico_auditoria_id IS DISTINCT FROM OLD.tupa_historico_auditoria_id OR NEW.tipo_tramite_id IS DISTINCT FROM OLD.tipo_tramite_id)
 THEN RAISE EXCEPTION 'La referencia histórica es inmutable'; END IF;
 IF NEW.tupa_historico_auditoria_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM sigd_audit.bitacora_auditoria a
  WHERE a.id_auditoria=NEW.tupa_historico_auditoria_id AND a.esquema='sigd_doc' AND a.tabla='tupa_historico'
   AND a.datos_despues->>'migracion'='15_archivar_tupa_historicos'
   AND EXISTS(SELECT 1 FROM jsonb_array_elements(a.datos_despues->'expedientes') x WHERE x->>'expediente_id'=NEW.expediente_id::text))
 THEN RAISE EXCEPTION 'Evidencia histórica incompatible con el expediente'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER validar_tupa_historico BEFORE INSERT OR UPDATE ON sigd_doc.expediente
 FOR EACH ROW EXECUTE FUNCTION sigd_doc.fn_validar_tupa_historico();

CREATE OR REPLACE VIEW sigd_doc.expediente_tipo_tramite AS
 SELECT e.expediente_id,coalesce(t.codigo,a.datos_antes->>'codigo') codigo,
 coalesce(t.denominacion,a.datos_antes->>'denominacion') denominacion,
 coalesce(t.descripcion,a.datos_antes->>'descripcion') descripcion,
 e.tupa_historico_auditoria_id IS NOT NULL historico
 FROM sigd_doc.expediente e LEFT JOIN sigd_doc.tipo_tramite_tupa t USING(tipo_tramite_id)
 LEFT JOIN sigd_audit.bitacora_auditoria a ON a.id_auditoria=e.tupa_historico_auditoria_id;
COMMIT;
