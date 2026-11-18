# CP-GERIC-017 — Demo base sin S3

## Estado

**DEMO BASE CERTIFICADA SIN S3**, con alcance limitado al arranque y disponibilidad del stack base. Esta certificación no sustituye pruebas E2E de cada función de negocio ni certifica el flujo documental binario.

- Fecha de validación: 2026-10-18
- Rama: `B_GERIC`
- HEAD: `4e06e512fe08d01712bc0b6feb33e95ca28c1b10`

## Cambio aditivo de infraestructura

El servicio `minio` se conserva completo en `docker-compose.yml`, con su imagen temporal declarada, comando, variables, puertos, volumen y healthcheck. Se agregó el perfil `object-storage`, por lo que no se resuelve ni inicia durante la demo base.

El backend conserva `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` y `S3_BUCKET`. Se retiró únicamente su dependencia obligatoria de `minio: service_healthy`; mantiene las dependencias saludables de PostgreSQL y Redis.

Servicios activos sin perfil:

- `postgres`
- `redis`
- `backend`
- `frontend`

MinIO no fue creado ni iniciado. Para una futura prueba S3 deberá existir primero una imagen Community oficial con tag fijo y verificado; no se autoriza AIStor ni una imagen de terceros.

## Evidencia de configuración

- `docker compose config --quiet`: PASS.
- `docker compose config --services`: `postgres`, `redis`, `backend`, `frontend`.
- `docker compose config --profiles`: `object-storage`.
- Dependencias resueltas del backend: `postgres`, `redis`.
- `docker compose up -d --build`: exit code 0.

## Evidencia de ejecución

| Servicio | Estado observado | Evidencia |
|---|---|---|
| PostgreSQL | `Up (healthy)` | Contenedor `sigd_postgres`, imagen `postgres:18-alpine` |
| Redis | `Up (healthy)` | Contenedor `sigd_redis`, imagen `redis:7-alpine` |
| Backend | `Up (healthy)` | Contenedor `sigd_backend`; puerto 3000 |
| Frontend | `Up (healthy)` | Contenedor `sigd_frontend`; Node `24.19.0-alpine`; puerto 5173 |
| MinIO | No iniciado | No existe contenedor `sigd_minio`; perfil inactivo |

El backend inició mediante `npm run dev`. Con `MIGRATE_ON_BOOT=true` y `SIGD_MIGRATION_PROFILE=BASELINE_2026_V1`, el log registró esta secuencia:

1. `01_sigd_audit.sql`
2. `02_sigd_auth.sql`
3. `03_sigd_org.sql`
4. `04_sigd_doc.sql`
5. `05_sigd_tra.sql`
6. `BASELINE_2026_V1.sql`
7. `08_sigd_tupa_acoplamiento.sql`

El pipeline informó siete migraciones aplicadas. No se ejecutaron `06_sigd_rut.sql` ni `07_sigd_reportes.sql`.

Respuestas observadas:

- `GET http://localhost:3000/health`: HTTP 200, `status="ok"`, `estado="UP"`.
- `GET http://localhost:3000/ready`: HTTP 200, `status="ok"`, `estado="READY"`.
- `GET http://localhost:5173/`: HTTP 200.

No aparecieron mensajes S3, `ECONNREFUSED` ni errores de MinIO en el arranque. La cadena `sigd_evento_dominio` contiene accidentalmente la subcadena `minio`; no es una referencia ni un error de MinIO.

## Alcance certificado

La validación certifica que el stack base arranca y queda disponible con:

- PostgreSQL;
- Redis;
- backend;
- frontend;
- infraestructura requerida por TUPA;
- Calendarización informativa;
- arranque y persistencia básica de RutaDoc.

No se ejecutaron en esta fase pruebas E2E específicas de TUPA, Calendarización o RutaDoc. Por tanto, “certificada” significa disponibilidad de la demo base y no certificación funcional integral de esos módulos.

## Fuera de certificación

Sin un servicio S3 real no están certificados:

- carga binaria real;
- descarga real;
- existencia, integridad o permanencia de objetos;
- firma documental basada en un archivo almacenado;
- flujo documental completo con S3;
- una URL prefirmada como evidencia de que el objeto o bucket existe.

## Advertencias no bloqueantes

- El backend intenta iniciar un proceso Vite adicional y registra `spawn /usr/local/bin/node ENOENT`; el frontend independiente permanece healthy y responde HTTP 200.
- Vite intenta ejecutar `xdg-open` dentro del contenedor frontend y registra `ENOENT`; el servidor permanece healthy.
- `npm ci` reportó 13 vulnerabilidades en backend (6 moderadas, 5 altas y 2 críticas) y una vulnerabilidad alta en frontend. No bloquearon el arranque, pero requieren revisión separada y no se corrigieron en esta fase.

## Rehabilitación futura de S3

El soporte no fue eliminado. Cuando exista un tag Community oficial fijo y verificado, la validación deberá ejecutarse expresamente con el perfil `object-storage` y deberá incluir una operación S3 real de subida, lectura y eliminación temporal. Hasta entonces, el flujo documental completo debe presentarse como no certificado.
