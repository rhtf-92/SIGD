-- ============================================================================
-- MIGRACIÓN 51: Limpieza y normalización de textos en requisitos TUPA
-- ============================================================================
-- Corrige caracteres dañados (?) por codificación histórica y simplifica textos
-- descriptivos de requisitos financieros, internos y declarativos.
-- ============================================================================

BEGIN;

-- 1. Normalización y simplificación de requisitos INTERNOS
UPDATE sigd_doc.tupa_requisito_documental
   SET descripcion = 'Actuación o verificación interna institucional. No requiere trámite del administrado.'
 WHERE tipo_requisito = 'INTERNO'
   AND (descripcion LIKE '%?%' OR descripcion LIKE '%Actuaci%interna del despacho%');

-- 2. Normalización y simplificación de requisitos FINANCIEROS
UPDATE sigd_doc.tupa_requisito_documental
   SET descripcion = 'Tasa oficial liquidada mediante orden de pago en Tesorería.'
 WHERE tipo_requisito = 'FINANCIERO'
   AND (descripcion LIKE '%?%' OR descripcion LIKE '%liquidado mediante orden de pago%');

-- 3. Normalización y simplificación de requisitos DECLARATIVOS / AMBIGUOS
UPDATE sigd_doc.tupa_requisito_documental
   SET descripcion = 'Condición declarativa o contractual previa requerida por la institución.'
 WHERE (tipo_requisito = 'DECLARATIVO' OR tipo_requisito = 'AMBIGUO')
   AND (descripcion LIKE '%Condici?n%' OR descripcion LIKE '%instituci?n%');

UPDATE sigd_doc.tupa_requisito_documental
   SET descripcion = 'Requisito administrativo del catálogo TUPA institucional.'
 WHERE descripcion LIKE '%cat?logo%' OR descripcion LIKE '%catálogo TUPA 2026%';

-- 4. Sustitución preventiva de cualquier residuo de interrogación en nombres o descripciones
UPDATE sigd_doc.tupa_requisito_documental
   SET descripcion = REPLACE(
       REPLACE(
       REPLACE(
       REPLACE(
       REPLACE(
       REPLACE(
       REPLACE(
       REPLACE(descripcion,
         'Tesorer?a', 'Tesorería'),
         'Actuaci?n', 'Actuación'),
         'verificaci?n', 'verificación'),
         'secretar?a', 'secretaría'),
         't?cnica', 'técnica'),
         'cat?logo', 'catálogo'),
         'Condici?n', 'Condición'),
         'instituci?n', 'institución')
 WHERE descripcion LIKE '%?%';

COMMIT;
