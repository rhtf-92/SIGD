# Resumen de pruebas — demo B_GERIC

Fecha de comprobación: 08/10/2026. Base: `6b6f18619a763b73dfe6f6afde51db5cef4d60bb`. Estados: PASS, FAIL, BLOCKED, PARTIAL, NOT TESTED. Las ejecuciones históricas se distinguen de las comprobaciones repetidas para este cierre.

| ID | Prueba | Comando o método | Resultado | Estado | Observación |
| --- | --- | --- | --- | --- | --- |
| D01 | Config Compose | `docker compose -f docker-compose.demo.yml config --quiet` | Configuración válida en levantamiento | PASS | Sin MinIO obligatorio para backend. |
| D02 | PostgreSQL | `docker compose -f docker-compose.demo.yml ps -a` | `Up (healthy)` | PASS | Imagen `postgres:18-alpine`. |
| D03 | Redis | Mismo `ps -a` | `Up (healthy)` | PASS | Imagen `redis:7-alpine`. |
| D04 | Migración 01 | `psql -X -v ON_ERROR_STOP=1 --single-transaction -f /demo-migraciones/01_sigd_audit.sql` | Aplicación aislada previa PASS | PASS | Esquema `sigd_audit` presente. |
| D05 | Migración 02 | Mismo patrón con `02_sigd_auth.sql` | Primer intento: FK FAIL; tras desactivar solo seed: PASS | PASS | Detalle en CP-GERIC-002. |
| D06 | Migración 03 | Mismo patrón con `03_sigd_org.sql` | Aplicación aislada previa PASS | PASS | Esquema `sigd_org` presente. |
| D07 | Migración 04 | Mismo patrón con `04_sigd_doc.sql` | Aplicación aislada previa PASS | PASS | Esquema `sigd_doc` presente. |
| D08 | Migración 05 | Mismo patrón con `05_sigd_tra.sql` | Aplicación aislada previa PASS | PASS | Esquema `sigd_tra` presente. |
| D09 | Build backend | `docker compose -f docker-compose.demo.yml build backend` | Imagen demo creada | PASS | Dockerfile instala toolchain. |
| D10 | `argon2` | `docker compose -f docker-compose.demo.yml logs backend` | `npm ci` completó y Express arrancó | PASS | Compilación dejó de bloquear; no se hizo prueba criptográfica individual. |
| D11 | Backend startup | `docker compose -f docker-compose.demo.yml ps -a` y `logs backend` | `Up`, puerto 3000; log «escuchando» | PASS | `MIGRATE_ON_BOOT=false`. |
| D12 | `/health` | `curl.exe -i http://localhost:3000/health` | HTTP 200 | PASS | Sonda de proceso. |
| D13 | `/ready` | `curl.exe -i http://localhost:3000/ready` | HTTP 200 | PASS | No certifica migración 06. |
| D14 | Frontend `npm ci` | Comando de arranque en `docker-compose.demo.yml` | Fallo previo por lockfile; instalación posterior PASS | PASS | Node `24.19.0`; módulos aislados. |
| D15 | Vite | `docker compose -f docker-compose.demo.yml logs frontend` | Vite `6.4.3 ready` | PASS | Aviso `xdg-open ENOENT` no impide servir. |
| D16 | `localhost:5173` | `curl.exe -I http://localhost:5173/` | HTTP 200 | PASS | HTML no prueba render; se inspeccionó navegador. |
| D17 | `/` | Edge: captura, DOM, consola, red | Portada renderizada | PASS | Sin errores observados. |
| D18 | `/login` | Edge: selección de rol y clic | Navega con `demo-jwt-*` local | PARTIAL | No usa login real. |
| D19 | `/tramite` | Edge: captura, DOM, consola, red | Paso 1 renderizado | PARTIAL | No se radicó solicitud. |
| D20 | `/tramite/mesa-partes-virtual` | Edge: captura, DOM, red | Pantalla visible; `/api/v1` devuelve 404 | PARTIAL | Sin prueba de subida. |
| D21 | `/expedientes` | Edge: red y redirección | 401 + refresh 400 → `/login` | BLOCKED | No mostrar como módulo funcional. |
| D22 | `/reportes` | Edge: red y redirección | 401 + refresh 400 → `/login` | BLOCKED | No mostrar como dashboard real. |
| D23 | RutaDoc 06 | Consulta `pg_namespace` en demo | `sigd_rut` ausente | BLOCKED | No se ejecutó ni certificó migración 06. |
| D24 | S3/MinIO | Compose demo y revisión de ruta documental | Sin servicio MinIO certificado | BLOCKED | No afirmar carga funcional. |
| D25 | `git diff --check` | `git diff --check` y, tras staging, `git diff --cached --check` | Sin error de whitespace; aviso de conversión LF/CRLF | PASS | Se repite antes de commit. |

Resultado anterior de `npm ci` y fallo FK permanecen documentados; PASS representa el estado posterior verificado, no borra esos intentos. `docker compose ps`, sondas y revisión visual se repiten antes de publicar.

Total de la tabla: **18 PASS, 3 PARTIAL y 4 BLOCKED**; 25 comprobaciones. En la repetición final, `/health`, `/ready` y `localhost:5173/` devolvieron HTTP 200. Edge volvió a mostrar los encabezados y contenido de `/`, `/login` y `/tramite` sin excepciones JavaScript observadas. Las capturas de trabajo quedaron fuera del repositorio, en el directorio temporal del equipo, y no forman parte del commit.
