# Operación local de SIGD

Estado certificado: **2026-10-09**. El entorno reproducible usa Docker Compose,
Node.js 24.19, PostgreSQL 18, Redis 7 y almacenamiento S3 compatible SeaweedFS
4.17. Los cinco contenedores disponen de sondas de salud reales.

## Arranque recomendado

Desde PowerShell, en la raíz del repositorio:

```powershell
docker compose config --quiet
docker compose up -d --build
docker compose ps
Invoke-RestMethod http://localhost:3000/ready
```

Todos los servicios deben quedar `healthy`:

- Frontend: http://127.0.0.1:5173/login
- Backend/API: http://localhost:3000/api/v1
- Readiness: http://localhost:3000/ready
- PostgreSQL 18: `localhost:5432`, base `sigd_prueba`
- Redis 7: `localhost:6379`
- S3: http://localhost:9000
- Consola SeaweedFS: http://localhost:8888

El backend aplica automáticamente las **14 migraciones** bajo advisory lock. No
se debe usar `docker compose down -v`, porque esa opción elimina los volúmenes
persistentes de PostgreSQL, Redis y S3.

## Arquitectura de endpoints S3

Docker utiliza dos direcciones deliberadamente distintas:

- `S3_ENDPOINT=http://s3:8333`: tráfico privado backend → S3 en la red Compose.
- `S3_PUBLIC_ENDPOINT=http://localhost:9000`: URLs SigV4 que recibe el navegador.

No se debe sustituir una por la otra: el host forma parte de la firma SigV4.
La sonda `/ready` usa el endpoint interno autenticado y el navegador usa el
endpoint público para PUT/GET prefirmados.

## Variables y credenciales locales

Los secretos y cuentas de demostración permanecen en archivos `.env` excluidos
de Git. La cuenta principal se prepara con:

```powershell
Set-Location backend
$env:DATABASE_URL='postgres://postgres:postgres_password@localhost:5432/sigd_prueba'
npm exec -- tsx tests/local/demo-account.ts
```

El usuario se guarda en `backend/.env.demo.local`. No se documenta ni imprime la
contraseña en archivos versionados. La cuenta usa Argon2id nativo y rol DIRECTOR.

## Ejecución sin Docker para depuración

Backend:

```powershell
Set-Location backend
$env:DATABASE_URL='postgres://postgres:postgres_password@localhost:5432/sigd_prueba'
$env:PORT='3000'
$env:START_FRONTEND='false'
npm run migrate
npm run dev
```

Frontend, en otra terminal:

```powershell
Set-Location frontend
$env:VITE_API_BASE_URL='http://localhost:3000/api/v1'
$env:VITE_ENABLE_MOCKS='false'
npm exec -- vite --host 127.0.0.1 --port 5173 --strictPort
```

## Compuerta de calidad certificada

```powershell
# backend
npm run typecheck
npm run build
npm run test:unit
npm run smoke:conmutation
npm audit

# frontend
npm run typecheck
npm run lint
npm run build
npm test
npm audit --omit=dev
```

Resultados del 2026-10-09:

- Backend: 535 pruebas unitarias aprobadas; 9 omitidas; 0 fallos.
- Seguridad adversarial: 64/64 + Argon2 28/28.
- Smoke HTTP/CORS/SSE/M01–M06: 33/33.
- Frontend: 424/424 pruebas aprobadas.
- TypeScript backend/frontend: 0 errores; ESLint frontend: 0 errores.
- Builds backend/frontend: exitosos.
- npm audit backend completo y frontend producción: 0 vulnerabilidades.
- Docker: PostgreSQL, Redis, S3, backend y frontend `healthy`.

## Evidencia end-to-end

Los arneses en `backend/tests/local` prueban servicios reales, sin interceptar
HTTP ni sustituir PostgreSQL/S3:

- `browser-flow.cjs`: login → PDF S3 → radicación → consulta → trazabilidad.
- `browser-review.cjs`: detalle, descarga autenticada/hash y reportes.
- `browser-bandeja.cjs`: búsquedas, pestañas, fechas, detalle y adjunto.
- `browser-pendientes.cjs`: autorregistro natural, 401/403/409, PDF/XML.
- `browser-persona-juridica.cjs`: RUC Módulo 11, representante y rollback.
- `browser-workflow-academico.cjs`: UI → API → FSM PostgreSQL.

La última ejecución Docker creó `EXP-2026-000003`, expediente
`12ff999c-b7e9-4b77-a0f1-d84957e5aa58`, sin errores JavaScript ni respuestas
fallidas. Las capturas y JSON están bajo
`frontend/node_modules/.cache/sigd-browser/evidence` y no contienen tokens ni
contraseñas.

## Alcance externo

La operación local certifica los adaptadores y contratos de los seis módulos.
La firma con certificado oficial ReFirma/RENIEC, consultas RENIEC/SUNAT/SUNARP,
SMTP y otros servicios institucionales requieren credenciales, certificados y
endpoints del organismo correspondiente; no deben presentarse como certificados
externamente hasta disponer de esos insumos.
