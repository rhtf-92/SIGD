# CP-GERIC-001 — Levantamiento controlado de demo

## Alcance y base

- Rama: `B_GERIC`; HEAD antes de estos cambios: `6b6f18619a763b73dfe6f6afde51db5cef4d60bb`.
- Objetivo: mostrar PostgreSQL, Redis, Express y Vite sin presentar RutaDoc, S3 ni autenticación real como funciones certificadas.
- Infraestructura local: `docker-compose.demo.yml` usa `postgres:18-alpine`, `redis:7-alpine`, `backend/Dockerfile.demo` basado en Node 20 Alpine y frontend `node:24.19.0-alpine`.
- El Dockerfile instala `python3`, `make` y `g++` para compilar `argon2`. Los `node_modules` viven en volúmenes Docker. Backend usa `MIGRATE_ON_BOOT=false`, no depende de MinIO y frontend usa `VITE_ENABLE_MOCKS=false`.
- Los valores de conexión del archivo Compose son **solo para la base local de demo**. No reutilizarlos en otros entornos.

## Comandos reproducibles y evidencia observada

Ejecutar desde la raíz del repositorio. La base local se preparó previamente con las migraciones 01–05; no desactivar migraciones sobre una base vacía.

```powershell
docker compose -f docker-compose.demo.yml config --quiet
docker compose -f docker-compose.demo.yml build backend
docker compose -f docker-compose.demo.yml up -d postgres redis backend frontend
docker compose -f docker-compose.demo.yml ps -a
curl.exe -i http://localhost:3000/health
curl.exe -i http://localhost:3000/ready
curl.exe -I http://localhost:5173/
```

Resultado comprobado el 08/10/2026: `ps -a` mostró `sigd-geric-demo-postgres-1` y `sigd-geric-demo-redis-1` **healthy**, y `sigd-geric-demo-backend-1` y `sigd-geric-demo-frontend-1` **Up**. Puertos publicados: PostgreSQL `55432`, Redis `56379`, backend `3000` y frontend `5173`. `/health`, `/ready` y `/` respondieron HTTP **200**. El log confirmó `SIGD Backend escuchando en http://localhost:3000` y `VITE v6.4.3 ready` en `http://localhost:5173/`.

Consulta de lectura ejecutada:

```powershell
docker compose -f docker-compose.demo.yml exec -T postgres psql -X -U postgres -d sigd_demo -v ON_ERROR_STOP=1 -c "SELECT nspname FROM pg_namespace WHERE nspname IN ('sigd_audit','sigd_auth','sigd_org','sigd_doc','sigd_tra','sigd_rut') ORDER BY nspname;"
```

Resultado: `sigd_audit`, `sigd_auth`, `sigd_doc`, `sigd_org` y `sigd_tra` (5 filas); `sigd_rut` ausente. Esto corrobora la preparación 01–05 y que la migración 06 no quedó aplicada a esta base. `/ready` solo prueba `SELECT 1`, no la conformidad del esquema.

Los logs históricos aún incluyen un fallo previo de `npm ci` frontend y avisos `spawn xdg-open ENOENT` de Vite y `spawn /usr/local/bin/node ENOENT` del intento del backend de abrir Vite. El frontend y backend quedaron sirviendo por separado; conservar esos mensajes en la evidencia evita confundir intentos anteriores con el estado final.

## Revisión visual en navegador

Se abrió cada ruta en Edge headless, inspeccionando DOM, captura, consola y respuestas de red. HTTP 200 de una SPA no se tomó como prueba de funcionamiento del componente.

| Ruta | Resultado | Evidencia y límite |
| --- | --- | --- |
| `/` | PASS, demo visual | Portada renderizada; sin error observado de consola o red. |
| `/login` | PARTIAL | Selector de rol e ingreso demo; crea `demo-jwt-*` en `localStorage`, sin llamar a login real. |
| `/tramite` | PARTIAL | Renderiza paso 1 del asistente; radicación completa no probada. |
| `/tramite/mesa-partes-virtual` | PARTIAL | Renderiza simulación de carga/horario; red registra HTTP 404 a `/api/v1`; subida S3 no probada. |
| `/expedientes` | BLOCKED / NO MOSTRAR | API `GET /api/v1/expedientes` devuelve 401, refresh 400 y redirige a `/login`. |
| `/reportes` y `/reportes/dashboard` | BLOCKED / NO MOSTRAR | Dashboard API devuelve 401, refresh 400 y redirige a `/login`. |

Ingreso demo comprobado: `SUPER_ADMIN` navega a `/administracion` y `MESA_PARTES` a `/tramite/ventanilla-presencial`. Abrir expedientes o reportes con el token demo también termina en 401/400 y limpia la sesión local. No se observaron excepciones JavaScript en las seis visitas; los fallos de red sí constan arriba.

## Mensaje honesto para la revisión

Se puede mostrar la portada, el ingreso **demo**, el panel visual y las pantallas de trámite sin enviar solicitudes ni archivos. **No se certifican** autenticación real, RutaDoc 06, consultas de expedientes, reportes con datos reales ni S3/MinIO. La migración 06 conserva una incompatibilidad de integración conocida y no se modificó. Ningún HTTP 200 de `/health` o `/ready` sustituye pruebas funcionales.
