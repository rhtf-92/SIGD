-- Reversión segura: se rechaza si eliminar las columnas destruiría datos.
BEGIN;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM sigd_auth.perfil_usuario
    WHERE direccion IS NOT NULL OR ubigeo_distrito IS NOT NULL OR referencia IS NOT NULL) THEN
    RAISE EXCEPTION 'Reversion rechazada: respaldar y aprobar el tratamiento de los domicilios existentes';
  END IF;
END $$;
ALTER TABLE sigd_auth.perfil_usuario DROP CONSTRAINT ck_perfil_domicilio_completo;
ALTER TABLE sigd_auth.perfil_usuario DROP COLUMN direccion, DROP COLUMN ubigeo_distrito, DROP COLUMN referencia;
COMMIT;
