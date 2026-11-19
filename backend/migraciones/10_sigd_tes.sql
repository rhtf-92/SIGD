-- M10 v1. Additive only. No tariffs, role assignments, accounts or financial facts are seeded.
CREATE SCHEMA sigd_tes;
CREATE TABLE sigd_tes.documento (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), propietario_id uuid NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario),
 nombre varchar(255) NOT NULL, bucket varchar(128) NOT NULL, clave varchar(512) NOT NULL UNIQUE,
 sha256 char(64) NOT NULL CHECK(sha256 ~ '^[0-9a-f]{64}$'), bytes integer NOT NULL CHECK(bytes BETWEEN 1 AND 20971520),
 creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sigd_tes.tarifa (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tipo_tramite_id uuid NOT NULL REFERENCES sigd_doc.tipo_tramite_tupa(tipo_tramite_id),
 importe numeric(14,2) NOT NULL CHECK(importe>=0), moneda char(3) NOT NULL DEFAULT 'PEN' CHECK(moneda='PEN'),
 concepto varchar(300) NOT NULL, fuente varchar(500) NOT NULL, evidencia_id uuid NOT NULL REFERENCES sigd_tes.documento(id),
 vigente_desde date NOT NULL, vigente_hasta date CHECK(vigente_hasta IS NULL OR vigente_hasta>=vigente_desde),
 estado varchar(16) NOT NULL DEFAULT 'PROPUESTA' CHECK(estado IN('PROPUESTA','VALIDADA','RECHAZADA')),
 creada_por uuid NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario), validada_por uuid REFERENCES sigd_auth.cuenta_usuario(id_usuario),
 validada_en timestamptz, creado_en timestamptz NOT NULL DEFAULT now(),
 CHECK((estado='PROPUESTA' AND validada_por IS NULL AND validada_en IS NULL) OR
       (estado<>'PROPUESTA' AND validada_por IS NOT NULL AND validada_en IS NOT NULL AND validada_por<>creada_por))
);
CREATE INDEX tarifa_procedimiento ON sigd_tes.tarifa(tipo_tramite_id,estado,vigente_desde,vigente_hasta);
CREATE TABLE sigd_tes.orden_pago (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), codigo varchar(50) NOT NULL UNIQUE,
 ciudadano_id uuid NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario), persona_id uuid NOT NULL REFERENCES sigd_auth.persona(id_persona),
 tarifa_id uuid NOT NULL REFERENCES sigd_tes.tarifa(id), tipo_tramite_id uuid NOT NULL REFERENCES sigd_doc.tipo_tramite_tupa(tipo_tramite_id),
 importe numeric(14,2) NOT NULL CHECK(importe>=0), moneda char(3) NOT NULL DEFAULT 'PEN' CHECK(moneda='PEN'),
 concepto varchar(300) NOT NULL, clave_solicitud uuid NOT NULL, creado_en timestamptz NOT NULL DEFAULT now(),
 UNIQUE(ciudadano_id,clave_solicitud)
);
CREATE INDEX orden_persona ON sigd_tes.orden_pago(persona_id,creado_en DESC);
CREATE TABLE sigd_tes.pago (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), orden_id uuid NOT NULL UNIQUE REFERENCES sigd_tes.orden_pago(id),
 medio varchar(24) NOT NULL CHECK(medio IN('CAJA','BANCO_NACION','TRANSFERENCIA')),
 entidad varchar(100) NOT NULL, referencia varchar(120) NOT NULL, fecha_operacion timestamptz NOT NULL,
 documento_id uuid NOT NULL REFERENCES sigd_tes.documento(id), registrado_por uuid NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario),
 estado varchar(24) NOT NULL DEFAULT 'REGISTRADO' CHECK(estado IN('REGISTRADO','EN_VERIFICACION','VERIFICADO','OBSERVADO','RECHAZADO','ANULADO')),
 verificado_por uuid REFERENCES sigd_auth.cuenta_usuario(id_usuario), verificado_en timestamptz,
 creado_en timestamptz NOT NULL DEFAULT now(), UNIQUE(entidad,referencia),
 CHECK((estado='VERIFICADO' AND verificado_por IS NOT NULL AND verificado_en IS NOT NULL AND verificado_por<>registrado_por) OR estado<>'VERIFICADO')
);
CREATE TABLE sigd_tes.aplicacion_pago (
 orden_id uuid PRIMARY KEY REFERENCES sigd_tes.orden_pago(id), expediente_id uuid NOT NULL UNIQUE REFERENCES sigd_doc.expediente(expediente_id),
 creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sigd_tes.devolucion (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), codigo varchar(50) NOT NULL UNIQUE,
 pago_id uuid NOT NULL REFERENCES sigd_tes.pago(id), ciudadano_id uuid NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario),
 importe numeric(14,2) NOT NULL CHECK(importe>0), motivo varchar(40) NOT NULL CHECK(motivo IN('TRAMITE_EQUIVOCADO','PAGO_DUPLICADO','PAGO_EXCESO','PAGO_INDEBIDO','CANCELACION','ERROR_OPERACION','OTRO')),
 sustento varchar(2000) NOT NULL, documento_id uuid REFERENCES sigd_tes.documento(id), clave_solicitud uuid NOT NULL,
 estado varchar(30) NOT NULL DEFAULT 'SOLICITADA' CHECK(estado IN('SOLICITADA','EN_EVALUACION','OBSERVADA','PENDIENTE_APROBACION','APROBADA','RECHAZADA','EN_PROCESO_DEVOLUCION','DEVUELTA','CERRADA')),
 evaluada_por uuid REFERENCES sigd_auth.cuenta_usuario(id_usuario), aprobada_por uuid REFERENCES sigd_auth.cuenta_usuario(id_usuario),
 creada_en timestamptz NOT NULL DEFAULT now(), UNIQUE(ciudadano_id,clave_solicitud),
 CHECK(aprobada_por IS NULL OR (evaluada_por IS NOT NULL AND aprobada_por<>evaluada_por AND aprobada_por<>ciudadano_id))
);
CREATE UNIQUE INDEX devolucion_activa_pago ON sigd_tes.devolucion(pago_id) WHERE estado NOT IN('RECHAZADA','DEVUELTA','CERRADA');
CREATE TABLE sigd_tes.ejecucion_devolucion (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), devolucion_id uuid NOT NULL UNIQUE REFERENCES sigd_tes.devolucion(id),
 importe numeric(14,2) NOT NULL CHECK(importe>0), entidad varchar(100) NOT NULL, referencia varchar(120) NOT NULL,
 fecha_operacion timestamptz NOT NULL, documento_id uuid NOT NULL REFERENCES sigd_tes.documento(id),
 ejecutada_por uuid NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario), creada_en timestamptz NOT NULL DEFAULT now(), UNIQUE(entidad,referencia)
);
CREATE TABLE sigd_tes.historial (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), orden_id uuid NOT NULL REFERENCES sigd_tes.orden_pago(id),
 devolucion_id uuid REFERENCES sigd_tes.devolucion(id), actor_id uuid NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario),
 accion varchar(64) NOT NULL, motivo varchar(2000) NOT NULL, creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX historial_orden ON sigd_tes.historial(orden_id,creado_en);
CREATE INDEX devolucion_estado ON sigd_tes.devolucion(estado,creada_en);
CREATE INDEX pago_estado ON sigd_tes.pago(estado,fecha_operacion);
CREATE FUNCTION sigd_tes.proteger_registro() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP IN('DELETE','TRUNCATE') THEN RAISE EXCEPTION 'Los registros financieros no se eliminan' USING ERRCODE='23001'; END IF;
 IF TG_TABLE_NAME IN('documento','orden_pago','aplicacion_pago','ejecucion_devolucion','historial') THEN
  RAISE EXCEPTION 'Hecho financiero inmutable' USING ERRCODE='23001';
 END IF;
 IF TG_TABLE_NAME='tarifa' AND (to_jsonb(NEW)-ARRAY['estado','validada_por','validada_en']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['estado','validada_por','validada_en']) THEN
  RAISE EXCEPTION 'No se altera la versión de tarifa' USING ERRCODE='23001';
 END IF;
 IF TG_TABLE_NAME='pago' AND (to_jsonb(NEW)-ARRAY['estado','verificado_por','verificado_en']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['estado','verificado_por','verificado_en']) THEN
  RAISE EXCEPTION 'No se modifica la operación original' USING ERRCODE='23001';
 END IF;
 IF TG_TABLE_NAME='devolucion' AND (to_jsonb(NEW)-ARRAY['estado','evaluada_por','aprobada_por']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['estado','evaluada_por','aprobada_por']) THEN
  RAISE EXCEPTION 'No se altera la solicitud original' USING ERRCODE='23001';
 END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['documento','tarifa','orden_pago','pago','aplicacion_pago','devolucion','ejecucion_devolucion','historial'] LOOP
  EXECUTE format('CREATE TRIGGER proteger_%I BEFORE UPDATE OR DELETE ON sigd_tes.%I FOR EACH ROW EXECUTE FUNCTION sigd_tes.proteger_registro()',t,t);
  EXECUTE format('CREATE TRIGGER proteger_truncate_%I BEFORE TRUNCATE ON sigd_tes.%I FOR EACH STATEMENT EXECUTE FUNCTION sigd_tes.proteger_registro()',t,t);
 END LOOP;
END $$;
-- Existing RBAC; no automatic grants or modification of the role-code constraint.
INSERT INTO sigd_org.permiso_sistema(codigo,nombre,ambito) VALUES
 ('TESORERIA_LEER','Consultar operaciones financieras','GLOBAL'),
 ('TESORERIA_TARIFA_PROPONER','Proponer tarifa documentada','GLOBAL'),
 ('TESORERIA_TARIFA_VALIDAR','Validar tarifa documentada','GLOBAL'),
 ('TESORERIA_PAGO_REGISTRAR','Registrar operaciones de caja','GLOBAL'),
 ('TESORERIA_PAGO_VERIFICAR','Verificar evidencia de pago','GLOBAL'),
 ('TESORERIA_DEVOLUCION_EVALUAR','Evaluar devoluciones','GLOBAL'),
 ('TESORERIA_DEVOLUCION_APROBAR','Aprobar devoluciones','GLOBAL'),
 ('TESORERIA_DEVOLUCION_EJECUTAR','Registrar devolución ejecutada externamente','GLOBAL'),
 ('TESORERIA_REPORTES','Consultar reportes financieros','GLOBAL');
REVOKE ALL ON ALL TABLES IN SCHEMA sigd_tes FROM PUBLIC;
REVOKE ALL ON SCHEMA sigd_tes FROM PUBLIC;
