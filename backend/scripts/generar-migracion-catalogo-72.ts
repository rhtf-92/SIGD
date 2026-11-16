import { writeFileSync } from 'node:fs';
import { CATALOGO_TUPA_2026 } from '../src/domains/tramicore/catalogoTupa2026.js';

// Solo genera SQL revisable. No conecta a PostgreSQL ni ejecuta la migración.
const fuente = JSON.stringify(CATALOGO_TUPA_2026);
const sql = `-- Catálogo completo Suiza 2026. Aplicación manual exclusiva en B_JACOBO demo.
-- Conserva UUID, nombres y datos previos. No inserta tarifas validadas ni hechos financieros.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $$ BEGIN
 IF current_database() <> 'sigd_jacobo_demo' THEN RAISE EXCEPTION 'Base no autorizada'; END IF;
END $$;
LOCK TABLE sigd_doc.tipo_tramite_tupa IN SHARE ROW EXCLUSIVE MODE;
-- La fuente no establece plazo ni silencio individual para los conceptos nuevos.
-- Los valores históricos permanecen intactos; NULL expresa información no especificada.
ALTER TABLE sigd_doc.tipo_tramite_tupa ALTER COLUMN plazo_dias DROP NOT NULL;
ALTER TABLE sigd_doc.tipo_tramite_tupa ALTER COLUMN silencio_administrativo DROP NOT NULL;
ALTER TABLE sigd_doc.tipo_tramite_tupa ADD COLUMN IF NOT EXISTS tupa_fuente jsonb;
DO $catalogo$
DECLARE fila jsonb;
BEGIN
 FOR fila IN SELECT value FROM jsonb_array_elements($fuente$${fuente}$fuente$::jsonb) LOOP
  INSERT INTO sigd_doc.tipo_tramite_tupa
   (codigo,denominacion,descripcion,unidad_organica,plazo_dias,silencio_administrativo,vigente,tupa_fuente)
  VALUES (fila->>'codigoInterno',fila->>'nombre',
   'Fuente: TUPA Suiza 2026. Derecho de pago según documento: ' || (fila->>'costoFuente'),
   'No especificada individualmente en la fuente',NULL,NULL,TRUE,fila)
  ON CONFLICT(codigo) DO NOTHING;
  -- Metadatos de fuente independientes de los nombres y UUID históricos.
  UPDATE sigd_doc.tipo_tramite_tupa SET tupa_fuente=fila
   WHERE codigo=fila->>'codigoInterno' AND tupa_fuente IS DISTINCT FROM fila;
 END LOOP;
 IF (SELECT count(*) FROM sigd_doc.tipo_tramite_tupa WHERE vigente AND codigo IN
  (SELECT value->>'codigoInterno' FROM jsonb_array_elements($fuente$${fuente}$fuente$::jsonb))) <> 72
 THEN RAISE EXCEPTION 'El catálogo no contiene 72 conceptos vigentes; revisar conflictos sin reactivar registros'; END IF;
END $catalogo$;
COMMIT;
`;
writeFileSync('migraciones/pendientes/14_catalogo_tupa_72.sql', sql, 'utf8');
console.log('Migración 14 generada; no aplicada.');
