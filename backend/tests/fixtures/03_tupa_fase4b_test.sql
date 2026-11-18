UPDATE sigd_doc.tupa_procedimiento p
SET
    plazo_fuente = 'DEFAULT',
    calificacion_fuente = 'DEFAULT',
    canal_presentacion = 'NO_DETERMINADO',
    unidad_receptora_id = NULL,
    unidad_responsable_id = NULL,
    unidad_resolutiva_id = NULL
FROM sigd_doc.tupa_version v
WHERE p.id_version = v.id_version
  AND v.codigo = 'TUPA-2026'
  AND p.codigo_ref = 'p1-fila-06';
