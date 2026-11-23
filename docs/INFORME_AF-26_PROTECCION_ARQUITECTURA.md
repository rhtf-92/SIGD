# INFORME TÉCNICO AF-26-P
## PROTOCOLO DE PROTECCIÓN ABSOLUTA DE ARQUITECTURA, CÓDIGO, BASES DE DATOS Y ENTORNO DOCKER

**Proyecto:** Sistema Integral de Gestión Documentaria (SIGD) — IESTP Suiza 2026  
**Entorno:** Prototipo Académico Independiente  
**Fecha de ejecución:** 2026-10-24T21:55:00-05:00  
**Autor:** Ingeniero Fullstack Senior / Arquitecto de Software / QA Specialist  
**Estado de la fase:** CANDIDATO CONSTRUIDO Y VERIFICADO — EN ESPERA DE AUTORIZACIÓN (DETENCIÓN FASE 16)

---

### 1. IDENTIDAD DEL REPOSITORIO Y DE LA RAMA

| Parámetro | Valor Verificado | Estado de Cumplimiento |
|---|---|---|
| **Ruta del repositorio** | `C:\Users\Liz\Desktop\SIGD\SIGD` | Conforme |
| **Rama de trabajo exclusiva** | `B_JACOBO` | Conforme (única rama autorizada) |
| **Commit de referencia histórico** | `bf30d8a0c85e266a86381fb10bf3740a8451c032` | Conforme (HEAD local alineado) |
| **Docker Compose en uso** | `docker-compose.sigd.yml` | Conforme |
| **Archivo de entorno sensible** | `C:\Users\Liz\AppData\Local\SIGD\secrets\compose.env` | Protegido (no copiado ni expuesto) |

---

### 2. ESTADO INICIAL Y FINAL DE GIT

La política de protección estricta exige que no se asuma un árbol de trabajo limpio, preservando todo el trabajo acumulado de las fases AF-15 a AF-25 sin sobrescrituras, restauraciones masivas ni pérdidas de código.

```powershell
# Comprobación de integridad ejecutada:
git branch --show-current  # Resultado: B_JACOBO
git rev-parse HEAD         # Resultado: bf30d8a0c85e266a86381fb10bf3740a8451c032
git diff --check           # Resultado: Código de salida 0 (0 errores de espacios en blanco o formato)
```

- **Archivos modificados rastreados (67 archivos):** Corresponden íntegramente a las remediaciones funcionales, adaptaciones de pasarela S3/SigV4, validador CVD, defensas DDL en resoluciones, interfaces frontend y suites de pruebas acumuladas.
- **Archivos no rastreados (41 archivos):** Suites unitarias especializadas (`validadorCvd.spec.ts`, `resoluciones.spec.ts`, `s3-storage.spec.ts`, etc.), documentación técnica consolidada en `docs/` y configuración de soporte.
- **Acciones prohibidas evitadas al 100%:**
  - Cero ejecuciones de `git reset --hard`
  - Cero ejecuciones de `git clean`
  - Cero ejecuciones de `git stash`
  - Cero commits automáticos
  - Cero operaciones de push, pull, merge o rebase
  - Cero modificaciones a los archivos fuente durante el protocolo de protección

---

### 3. INVENTARIO DE LOS SEIS CONTENEDORES ORIGINALES

Se verificó el estado inicial y final de los seis servicios Docker. **Ninguno de los contenedores fue detenido, reiniciado, sustituido o eliminado durante esta fase.**

| Servicio | Contenedor ID | Imagen en Ejecución | SHA-256 de Imagen Activa | Estado Operativo | Puertos Mapeados |
|---|---|---|---|---|---|
| **Backend** | `9e37c33ea83e` | `sigd-backend` | `sha256:84c6e5412fa0f9f4ee07d4ccce922633cee74f1e5898c7b473cc0026b067253c` | Up 4 hours | `127.0.0.1:3000->3000/tcp` |
| **Frontend** | `e1fbc0a5db61` | `sigd-frontend` | `sha256:f2e19c5796d36effe9679b570867f2981c148039d914ff0358bd71a68aeefa16` | Up 12 hours | `127.0.0.1:5173->5173/tcp` |
| **PostgreSQL Principal** | `f057f2bf4352` | `postgres:18-alpine` | `sha256:77f585114c32fbca283dc835b0596f4e52b51b4c6662d7810b2f4084f60a1873` | Up 12 hours (healthy) | `127.0.0.1:5433->5432/tcp` |
| **PostgreSQL Test** | `882b021b3cf0` | `postgres:18-alpine` | `sha256:77f585114c32fbca283dc835b0596f4e52b51b4c6662d7810b2f4084f60a1873` | Up 12 hours (healthy) | `127.0.0.1:5434->5432/tcp` |
| **Redis** | `9da1bb32864b` | `redis:7.4.8-alpine` | `sha256:7aec734b2bb298a1d769fd8729f13b8514a41bf90fcdd1f38ec52267fbaa8ee6` | Up 12 hours (healthy) | `127.0.0.1:6379->6379/tcp` |
| **SILO / S3** | `54d72bc68ce7` | `pgsty/silo:RELEASE.2026-09-16T00-00-00Z` | `sha256:635197cb9f36d01bee221d34d1c7d7960f6a95c48b0b6c01d99cd13bdae51a46` | Up 12 hours (healthy) | `127.0.0.1:9000-9001->9000-9001/tcp` |

**Volúmenes persistentes externos preservados intactos:**
- `sigd-integrado_pgdata`
- `sigd-integrado_redisdata`
- `sigd-integrado_miniodata`
- `sigd-validacion_pgdata_test`

---

### 4. ARQUITECTURA Y ELEMENTOS INMUTABLES REVISADOS

Se certifica que la arquitectura institucional original no ha sufrido alteración alguna:

1. **IdentiCore:** Conserva su responsabilidad única sobre identidad, autenticación JWT, Argon2id/scrypt y casillas.
2. **OrganiCore:** Mantiene estructura jerárquica con PostgreSQL `ltree`, roles RBAC, sedes y organigrama.
3. **TramiCore:** Mantiene trámites, catálogo TUPA versionado, radicación virtual, ventanilla presencial y CUT.
4. **RutaDoc:** Mantiene bandejas (recepción, derivación), máquina de estados FSM, reversión compensatoria y foliación.
5. **DocuCore:** Mantiene gestión documental, cálculo SHA-256, validación de magic bytes `%PDF-` y validación CVD.
6. **Despacho:** Mantiene proyectos de resolución administrativa sin invadir contratos ni inventar esquemas.
7. **FirmaCore:** Mantiene pasarela ReFirma, callbacks asíncronos y firma electrónica.
8. **CoreLink:** Mantiene pipeline transaccional Outbox, atomicity y eventos asíncronos de integración.
9. **Analítica:** Mantiene consultas agregadas operativas y directivas con control RBAC.

PostgreSQL, Redis y SILO/S3 continúan estrictamente como capas de infraestructura transversal, sin ser convertidos en dominios funcionales.

---

### 5. CAMBIOS DETECTADOS EN EL CONTEXTO DE CONSTRUCCIÓN

- **Contexto evaluado:** `./backend` (`C:\Users\Liz\Desktop\SIGD\SIGD\backend`).
- **Dockerfile analizado:** `Dockerfile.sigd` basado en `node:24.19.0-bookworm-slim`.
- **Reglas de exclusión (`backend/.dockerignore`):**
  - `.git`, `node_modules`, `dist`, `coverage`, `.env`, `.env.*`, `*.log`.
- **Auditoría de empaquetado de secretos:**
  - Inspección estática del contenedor efímero candidato: `docker inspect sigd-backend:af26-candidate --format '{{json .Config.Env}}'`.
  - Variables de entorno presentes en la imagen: Únicamente variables del sistema base Debian (`PATH`, `NODE_VERSION=24.19.0`, `YARN_VERSION=1.22.22`).
  - No existe ningún archivo `.env` en `/app` dentro de la imagen candidata.
  - El archivo sensible de producción `compose.env` reside fuera del contexto de construcción (`C:\Users\Liz\AppData\Local\SIGD\secrets\compose.env`) y no fue leído ni empaquetado por Docker.

---

### 6. VERIFICACIÓN DE CONTRATOS Y REGLAS DE SEGURIDAD

Se validaron las tres remediaciones incorporadas en el backend:

1. **Storage S3 / AWS SigV4 (`storage.router.ts`):**
   - El método `generarDescargaAutorizada` inspecciona defensivamente el encabezado `Origin` de la solicitud.
   - Si la llamada proviene de un navegador en `localhost` o `127.0.0.1`, el hostname del endpoint S3 se ajusta antes de la firma SigV4, garantizando que el `Host` firmado coincida con el `Host` de la petición HTTP del cliente y evitando el error `SignatureDoesNotMatch` (HTTP 403) de MinIO.
   - Si la llamada es interna (backend-a-minio sin header `Origin`), se preserva de manera intacta `http://minio:9000`.
   - Se mantiene la autenticación Bearer JWT obligatoria y la autorización RBAC con permiso `EXPEDIENTE_LEER`.

2. **Validador CVD (`validadorCvd.controller.ts`):**
   - Realiza verificación física de magic bytes `%PDF-` en los primeros 1024 bytes del objeto recuperado desde SILO/S3.
   - Calcula el hash SHA-256 sobre el contenido íntegro y lo coteja contra el campo `sha256_firmado` registrado en base de datos.
   - Si el objeto S3 no existe o SILO no está disponible, responde de forma cerrada (fail-closed) con HTTP 503 formato RFC 7807 (`CVD_DOCUMENT_UNAVAILABLE`), evitando falsos positivos.

3. **Despacho y Resoluciones (`resoluciones.service.ts`):**
   - Ejecuta una comprobación defensiva preliminar mediante `to_regclass('sigd_doc.proyecto_resolucion')` y `to_regclass('sigd_doc.secuencia_anual_resolucion')`.
   - Al constatar que el esquema canónico no dispone de dichas tablas para el articulado normativo, falla cerrado con HTTP 503 RFC 7807 (`DESPACHO_MODELO_NO_COMPATIBLE`), impidiendo excepciones no controladas o escrituras corruptas en PostgreSQL.

---

### 7. RESULTADO DE LAS PRUEBAS

Todas las verificaciones se ejecutaron en contenedores efímeros aislados con `--network none`, garantizando cero impacto sobre las bases de datos de producción y los servicios activos:

1. **TypeScript Typecheck (`npm run typecheck` / `tsc --noEmit`):**
   - Código de salida: `0` (0 errores en todo el proyecto backend).

2. **Batería Dirigida de Remediaciones (30 pruebas):**
   - `s3-storage.spec.ts`: 7 tests aprobados (100%).
   - `corelink-e2e-pipeline.spec.ts`: 8 tests aprobados (100%).
   - `validadorCvd.spec.ts`: 9 tests aprobados (100%).
   - `resoluciones.spec.ts`: 6 tests aprobados (100%).

3. **Suite Completa de Pruebas Unitarias (`npm run test:unit`):**
   - **Archivos de prueba:** 65 aprobados, 1 omitido intencionalmente (66 archivos evaluados).
   - **Pruebas unitarias totales:** **1,126 aprobadas**, 0 fallidas, 10 omitidas (1,136 pruebas en total).
   - **Tiempo de ejecución:** 20.44 segundos.
   - **Tasa de éxito:** 100% de las pruebas ejecutables aprobadas.

---

### 8. IDENTIDAD DE LA IMAGEN ACTUAL

- **Nombre y etiqueta:** `sigd-backend:latest`
- **Identificador SHA-256:** `sha256:84c6e5412fa0f9f4ee07d4ccce922633cee74f1e5898c7b473cc0026b067253c`
- **Contenedor en ejecución:** `sigd-backend-1` (ID `9e37c33ea83e...`)
- **Estado:** Activo e inalterado en el puerto `127.0.0.1:3000`.

---

### 9. IDENTIDAD DE LA IMAGEN DE REVERSIÓN

- **Nombre y etiqueta:** `sigd-backend:rollback-af26`
- **Identificador SHA-256:** `sha256:84c6e5412fa0f9f4ee07d4ccce922633cee74f1e5898c7b473cc0026b067253c`
- **Garantía de reversibilidad:** Idéntica bit a bit a la imagen activa original. Si tras un despliegue futuro se requiere revertir, basta re-etiquetar o apuntar a `sigd-backend:rollback-af26`.

---

### 10. IDENTIDAD DE LA NUEVA IMAGEN CANDIDATA

- **Nombre y etiqueta:** `sigd-backend:af26-candidate`
- **Identificador SHA-256:** `sha256:7da558b782ce19084bafd35cb86e606bfddb4150127f3bef34056fd149cf416a`
- **Tamaño:** 643 MB
- **Configuración de entrada:** `Entrypoint: [docker-entrypoint.sh]`, `CMD: ["npm", "run", "dev"]`
- **Estado de despliegue:** **NO DESPLEGADA.** La imagen reside únicamente en el registro local de Docker sin sustituir al contenedor en producción.

---

### 11. CONFIRMACIÓN DE QUE NO SE SUSTITUYÓ NINGÚN CONTENEDOR

- Se ejecutó `docker ps` antes, durante y después del proceso.
- El contenedor `sigd-backend-1` conserva su ID original `9e37c33ea83e` y su tiempo de actividad continuo (`Up 4 hours`).
- Ninguno de los 6 contenedores fue reiniciado, pausado, recreado ni sustituido.

---

### 12. CONFIRMACIÓN DE QUE NO SE MODIFICÓ POSTGRESQL

- Se inspeccionó la base de datos principal `sigd_prueba` alojada en `sigd-postgres-1` (puerto 5433).
- **Cola transaccional Outbox (`sigd_audit.evento_outbox`):** 0 registros totales, 0 pendientes, 0 fallidos.
- **Esquema `sigd_doc`:** Mantiene exactamente sus 11 tablas canónicas originales. No se crearon tablas auxiliares ni se ejecutaron scripts DDL o DML.

---

### 13. CONFIRMACIÓN DE QUE NO SE ALTERARON MIGRACIONES NI DATOS

- Los archivos canónicos en `backend/migraciones/` permanecen protegidos.
- No se ejecutó ningún comando `knex migrate`, `psql` de alteración o inicialización de seeds.
- El valor `MIGRATE_ON_BOOT="false"` y `SIGD_SAFE_BOOT="true"` permanece en vigor en la configuración.

---

### 14. RIESGOS O INCOMPATIBILIDADES DETECTADOS

Conforme a las instrucciones del protocolo, los siguientes módulos presentan limitaciones estructurales que se mantienen bajo la clasificación oficial:

#### Estado: `BLOCKED_BY_SCHEMA`

1. **IdentiCore — Registro Ciudadano Autónomo:**
   - **Hallazgo:** La tabla `sigd_auth.persona_natural` del DDL canónico no contiene las columnas `direccion`, `ubigeo_distrito` ni `declaracion_jurada_aceptada`. La tabla `sigd_auth.cuenta_usuario` carece de `acepta_notificaciones`.
   - **Comportamiento defensivo:** El endpoint `POST /api/v1/auth/registro-ciudadano` detecta esta ausencia y responde HTTP 503 RFC 7807 (`REGISTRO_MODELO_NO_COMPATIBLE`) sin corromper la base ni emitir tokens inválidos.

2. **Despacho — Proyector de Resoluciones Directorales:**
   - **Hallazgo:** La tabla canónica `sigd_doc.resolucion` almacena únicamente metadatos básicos y carece de campos estructurados para visto, considerandos, artículos normativos, distribución o secuencia anual.
   - **Comportamiento defensivo:** El servicio `resoluciones.service.ts` comprueba mediante `to_regclass` y responde HTTP 503 RFC 7807 (`DESPACHO_MODELO_NO_COMPATIBLE`) sin intentar crear tablas ni generar escrituras fallidas.

---

### 15. PROCEDIMIENTO PROPUESTO PARA UN DESPLIEGUE POSTERIOR

> [!IMPORTANT]
> Este procedimiento **NO** ha sido ejecutado. Requiere autorización expresa y deliberada del usuario antes de proceder.

En caso de que el usuario decida promover la imagen candidata a producción en una fase posterior, el procedimiento seguro, determinista y reversible es:

1. **Paso 1: Re-etiquetado atómico de la imagen candidata como activa:**
   ```powershell
   docker tag sigd-backend:af26-candidate sigd-backend:latest
   ```
2. **Paso 2: Reemplazo controlado del contenedor backend:**
   ```powershell
   docker compose -f docker-compose.sigd.yml up -d --no-deps backend
   ```
3. **Paso 3: Verificación de salud posterior al arranque:**
   - Comprobar logs: `docker logs sigd-backend-1 --tail 50`
   - Comprobar health HTTP: `curl.exe -i http://127.0.0.1:3000/api/v1/salud`
4. **Paso 4: Procedimiento de rollback inmediato (en caso de fallo):**
   ```powershell
   docker tag sigd-backend:rollback-af26 sigd-backend:latest
   docker compose -f docker-compose.sigd.yml up -d --no-deps backend
   ```

---

### 16. RECURSOS TEMPORALES ELIMINADOS Y RECURSOS CONSERVADOS

- **Recursos temporales eliminados:**
  - Contenedores efímeros creados con flag `--rm` para la ejecución estática de pruebas y typechecking fueron eliminados automáticamente por Docker al terminar cada comando.
- **Recursos conservados:**
  - Imagen candidata: `sigd-backend:af26-candidate` (`sha256:7da558b782ce...`)
  - Imagen de reversión: `sigd-backend:rollback-af26` (`sha256:84c6e5412fa0...`)
  - Imagen actual activa: `sigd-backend:latest` (`sha256:84c6e5412fa0...`)
  - Los 6 contenedores originales con sus IDs y estados activos
  - Todos los volúmenes de datos persistentes
  - Estado completo del repositorio Git en la rama `B_JACOBO`

---

## 17. PUNTO FINAL DE AUTORIZACIÓN (DETENCIÓN FASE 16)

De estricto acuerdo con la Sección 16 del mandato:

> **LA OPERACIÓN SE HA DETENIDO COMPLETAMENTE.**  
> No se ha sustituido el contenedor `sigd-backend-1`.  
> No se ha modificado el entorno operativo.  
> Se presentan los identificadores y resultados para decisión del usuario.
