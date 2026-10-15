# CP-GERIC-002 — Seed inválido de autenticación en base de demo

## Error original y causa

La primera aplicación de `backend/migraciones/02_sigd_auth.sql` con `psql -X -v ON_ERROR_STOP=1 --single-transaction` falló por la FK `notificacion_casilla_usuario_id_fkey`. El seed de `sigd_auth.notificacion_casilla` referenciaba `usuario_id = 00000000-0000-0000-0000-000000000001`, inexistente en `sigd_auth.cuenta_usuario`. PostgreSQL rechazó la inserción y `--single-transaction` revirtió esa migración. Este es el fragmento del error preservado de la ejecución original; la salida completa de aquel proceso no se guardó, por lo que no se reproduce aquí como si estuviera disponible.

## Cambio exacto

Se desactivó únicamente el `INSERT` de demostración. Diff de la migración 02 (las líneas vacías de contexto se muestran sin su espacio inicial para evitar whitespace en Markdown; `git diff -- backend/migraciones/02_sigd_auth.sql` reproduce el diff byte a byte):

```diff
diff --git a/backend/migraciones/02_sigd_auth.sql b/backend/migraciones/02_sigd_auth.sql
index 1116e6f..84f28f1 100644
--- a/backend/migraciones/02_sigd_auth.sql
+++ b/backend/migraciones/02_sigd_auth.sql
@@ -201,7 +201,9 @@ CREATE INDEX IF NOT EXISTS idx_notif_casilla_cut
 CREATE INDEX IF NOT EXISTS idx_notif_casilla_fecha
     ON sigd_auth.notificacion_casilla (fecha_deposito DESC);

--- Semilla inicial determinista para pruebas y desarrollo
+-- Seed de demostración desactivado: usuario_id 00000000-0000-0000-0000-000000000001
+-- no existe en cuenta_usuario y viola la FK de notificacion_casilla.
+/*
 INSERT INTO sigd_auth.notificacion_casilla (
     id, usuario_id, cut, asunto, tipo_acto, numero_documento,
     estado, fecha_deposito, hash_sha256, cvd
@@ -217,4 +219,5 @@ INSERT INTO sigd_auth.notificacion_casilla (
     'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
     'CVD-2026-RD-000142-A4F2'
 ) ON CONFLICT (id) DO NOTHING;
+*/

```

No se cambió DDL, FK, tabla, rol ni autenticación; tampoco se creó una cuenta artificial. El resto de los seeds quedó intacto.

## Reproducción y comprobación

La ejecución aislada utilizó archivos montados de solo lectura en `/demo-migraciones` y `--single-transaction`. Comandos reproducibles para una **base demo nueva**, en orden (no repetir a ciegas sobre una base ya preparada):

```powershell
docker compose -f docker-compose.demo.yml exec -T postgres psql -X -v ON_ERROR_STOP=1 --single-transaction -U postgres -d sigd_demo -f /demo-migraciones/01_sigd_audit.sql
docker compose -f docker-compose.demo.yml exec -T postgres psql -X -v ON_ERROR_STOP=1 --single-transaction -U postgres -d sigd_demo -f /demo-migraciones/02_sigd_auth.sql
docker compose -f docker-compose.demo.yml exec -T postgres psql -X -v ON_ERROR_STOP=1 --single-transaction -U postgres -d sigd_demo -f /demo-migraciones/03_sigd_org.sql
docker compose -f docker-compose.demo.yml exec -T postgres psql -X -v ON_ERROR_STOP=1 --single-transaction -U postgres -d sigd_demo -f /demo-migraciones/04_sigd_doc.sql
docker compose -f docker-compose.demo.yml exec -T postgres psql -X -v ON_ERROR_STOP=1 --single-transaction -U postgres -d sigd_demo -f /demo-migraciones/05_sigd_tra.sql
```

Resultado histórico registrado en el levantamiento: migraciones **01 PASS, 02 PASS tras el cambio, 03 PASS, 04 PASS y 05 PASS**, ejecutadas una a una. Consulta posterior de `pg_namespace` confirmó los cinco esquemas `sigd_audit`, `sigd_auth`, `sigd_org`, `sigd_doc` y `sigd_tra`. La 06 **no se ejecutó para esta demo**; `sigd_rut` no figura en esa consulta. El cambio es local al seed de la 02 y no prueba el módulo RutaDoc.
