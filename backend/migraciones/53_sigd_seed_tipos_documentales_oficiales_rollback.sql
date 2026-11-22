-- ==============================================================================
-- ROLLBACK MIGRACIÓN 53: Semilla Oficial de Tipos Documentales Institucionales
-- ARCHIVO: 53_sigd_seed_tipos_documentales_oficiales_rollback.sql
-- ==============================================================================

BEGIN;

DELETE FROM sigd_doc.tipo_documento
 WHERE codigo IN ('SOLICITUD', 'OFICIO', 'INFORME', 'MEMORANDO', 'RESOLUCION', 'CERTIFICADO', 'PROVEIDO', 'CARTA')
   AND NOT EXISTS (
     SELECT 1 FROM sigd_tra.expediente e WHERE e.tipo_documental_id = sigd_doc.tipo_documento.tipo_documental_id
   );

COMMIT;
