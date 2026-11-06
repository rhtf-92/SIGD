-- El actor de IdentiCore es UUID. No existe conversion de IDs numericos.
-- Solo se corrige automaticamente una tabla aun sin solicitudes; una instalacion
-- con datos requiere una correspondencia explicita con las cuentas existentes.
DO $actor_uuid$
BEGIN
    IF (SELECT data_type FROM information_schema.columns
        WHERE table_schema = 'sigd_rut' AND table_name = 'solicitud_compensacion_folios'
          AND column_name = 'actor_id') <> 'uuid' THEN
        IF EXISTS (SELECT 1 FROM sigd_rut.solicitud_compensacion_folios) THEN
            RAISE EXCEPTION 'Solicitudes existentes: se requiere correspondencia explicita de actor_id a IdentiCore UUID';
        END IF;
        ALTER TABLE sigd_rut.solicitud_compensacion_folios
            ALTER COLUMN actor_id TYPE UUID USING NULL::UUID;
    END IF;
END;
$actor_uuid$;
