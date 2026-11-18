-- ============================================================================
-- ROLLBACK MIGRACIÓN 51: Limpieza y normalización de textos en requisitos TUPA
-- ============================================================================

BEGIN;

UPDATE sigd_doc.tupa_requisito_documental
   SET descripcion = 'Actuación o verificación interna del despacho o secretaría técnica.'
 WHERE tipo_requisito = 'INTERNO'
   AND descripcion = 'Actuación o verificación interna institucional. No requiere trámite del administrado.';

UPDATE sigd_doc.tupa_requisito_documental
   SET descripcion = 'Requisito financiero liquidado mediante orden de pago oficial de Tesorería.'
 WHERE tipo_requisito = 'FINANCIERO'
   AND descripcion = 'Tasa oficial liquidada mediante orden de pago en Tesorería.';

UPDATE sigd_doc.tupa_requisito_documental
   SET descripcion = 'Requisito administrativo del catálogo TUPA 2026.'
 WHERE descripcion = 'Requisito administrativo del catálogo TUPA institucional.';

COMMIT;
