ALTER TABLE sigd_tra.asiento_registro
    DROP CONSTRAINT IF EXISTS chk_asiento_canal;

ALTER TABLE sigd_tra.asiento_registro
    ADD CONSTRAINT chk_asiento_canal
    CHECK (canal_ingreso IN ('MESA_VIRTUAL', 'MESA_PRESENCIAL', 'VENTANILLA_PRESENCIAL'));
