-- =============================================================================
-- Migración 39 · Esquema sigd_doc · Procedimientos TUPA No Determinados
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
-- -----------------------------------------------------------------------------
-- Autor     : Geric (B_GERIC)
-- Marco     : Ajuste semántico de genera_expediente a NULL (NO_DETERMINADO) para
--             los 5 procedimientos pendientes de homologación institucional y
--             registro explícito de proveniencia con salvaguarda fail-closed.
-- Depende de: 38_sigd_tupa_ajustes_operativos_complementarios.sql
-- =============================================================================

BEGIN;

-- 1. Actualización semántica a NULL (NO_DETERMINADO) restringido a TUPA-2026
UPDATE sigd_doc.tupa_procedimiento
   SET genera_expediente = NULL,
       actualizado_en = now()
 WHERE id_version = (SELECT id_version FROM sigd_doc.tupa_version WHERE codigo = 'TUPA-2026')
   AND codigo_ref IN ('p4-fila-16', 'p5-fila-05', 'p5-fila-08', 'p6-fila-02', 'p6-fila-03');

-- 2. Registro canónico de proveniencia por campo con fuente NO_DETERMINADO
INSERT INTO sigd_doc.tupa_campo_procedencia (
    id_procedimiento,
    id_registro_version,
    campo_nombre,
    valor,
    fuente,
    evidencia
)
SELECT p.id_procedimiento,
       p.registro_version_id,
       'genera_expediente',
       'NULL',
       'NO_DETERMINADO',
       CASE p.codigo_ref
           WHEN 'p4-fila-16' THEN 'CP-GERIC-011/012: Pendiente determinar si es derecho puramente económico o trámite documentario de duplicado de título.'
           WHEN 'p5-fila-05' THEN 'CP-GERIC-011/012: Pendiente determinar si es derecho puramente económico o procedimiento administrativo de reincorporación.'
           WHEN 'p5-fila-08' THEN 'CP-GERIC-011/012: Agrupa múltiples tipos de constancias sin catálogo oficial de variantes aprobado.'
           WHEN 'p6-fila-02' THEN 'CP-GERIC-011/012: Contradicción económica y de unidad en fuente documental oficial (S/.10 por hoja vs S/.10.50).'
           WHEN 'p6-fila-03' THEN 'CP-GERIC-011/012: Agrupación mixta de boletas, sílabos y otros trámites; pendiente decisión de separación institucional.'
       END
  FROM sigd_doc.tupa_procedimiento p
 WHERE p.id_version = (SELECT id_version FROM sigd_doc.tupa_version WHERE codigo = 'TUPA-2026')
   AND p.codigo_ref IN ('p4-fila-16', 'p5-fila-05', 'p5-fila-08', 'p6-fila-02', 'p6-fila-03')
ON CONFLICT (id_procedimiento, id_registro_version, campo_nombre)
DO UPDATE SET
    valor = EXCLUDED.valor,
    fuente = EXCLUDED.fuente,
    evidencia = EXCLUDED.evidencia;

COMMIT;
