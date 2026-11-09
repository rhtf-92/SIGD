-- =============================================================================
-- Rollback Migración 39 · Esquema sigd_doc · Procedimientos TUPA No Determinados
-- =============================================================================

BEGIN;

-- 1. Revertir genera_expediente a false para los 5 procedimientos en TUPA-2026
UPDATE sigd_doc.tupa_procedimiento
   SET genera_expediente = false,
       actualizado_en = now()
 WHERE id_version = (SELECT id_version FROM sigd_doc.tupa_version WHERE codigo = 'TUPA-2026')
   AND codigo_ref IN ('p4-fila-16', 'p5-fila-05', 'p5-fila-08', 'p6-fila-02', 'p6-fila-03');

-- 2. Eliminar los registros de proveniencia asociados creados por la migración 39
DELETE FROM sigd_doc.tupa_campo_procedencia
 WHERE campo_nombre = 'genera_expediente'
   AND id_procedimiento IN (
       SELECT id_procedimiento
         FROM sigd_doc.tupa_procedimiento
        WHERE id_version = (SELECT id_version FROM sigd_doc.tupa_version WHERE codigo = 'TUPA-2026')
          AND codigo_ref IN ('p4-fila-16', 'p5-fila-05', 'p5-fila-08', 'p6-fila-02', 'p6-fila-03')
   );

COMMIT;
