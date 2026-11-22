-- ============================================================================
-- MIGRACIÓN 55: SINCRONIZACIÓN DE PROYECCIÓN DE ESTADO ACTUAL EN EXPEDIENTES RESUELTOS
-- ============================================================================

DO $$
BEGIN
    -- Sincronizar estado_nuevo en sigd_rut.estado_actual_expediente con sigd_tra.expediente
    UPDATE sigd_rut.estado_actual_expediente u
       SET estado_nuevo = e.estado,
           area_actual_id = CASE
             WHEN e.estado = 'RESUELTO' AND (u.area_actual_id IS NULL OR u.area_actual_id = (SELECT area_id::text FROM sigd_org.area WHERE codigo = 'DIR'))
             THEN 'a0000000-0000-0000-0000-000000000002'
             ELSE u.area_actual_id
           END,
           evento = CASE
             WHEN e.estado = 'RESUELTO' THEN 'RESOLUCION_FIRMA_DIGITAL'
             ELSE u.evento
           END,
           fecha_hora = now()
      FROM sigd_tra.expediente e
     WHERE u.expediente_id = e.expediente_id
       AND e.estado IN ('RESUELTO', 'ARCHIVADO')
       AND (u.estado_nuevo IS NULL OR u.estado_nuevo <> e.estado);
END $$;
