INSERT INTO sigd_tra.tramite (expediente_id, codigo_tramite, asunto, estado)
SELECT e.expediente_id, e.codigo_expediente, asiento.asunto, 'REGISTRADO'
  FROM sigd_tra.expediente e
  JOIN LATERAL (
    SELECT ar.asunto
      FROM sigd_tra.asiento_registro ar
     WHERE ar.expediente_id = e.expediente_id
     ORDER BY ar.fecha_ingreso DESC
     LIMIT 1
  ) asiento ON TRUE
 WHERE e.estado = 'RECEPCIONADO'
   AND NOT EXISTS (
     SELECT 1 FROM sigd_tra.tramite t WHERE t.expediente_id = e.expediente_id
   );
