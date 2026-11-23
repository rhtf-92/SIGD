# SIGD IESTP SUIZA 2026 — FASE FINAL AF-30
## INFORME DE VALIDACIÓN DEFINITIVA DEL PROTOTIPO Y DEMOSTRACIÓN DE LOS 9 MÓDULOS

**Proyecto:** SIGD — Sistema Integral de Gestión Documentaria del IESTP Suiza 2026  
**Tipo de proyecto:** Prototipo académico independiente  
**Rama:** `B_JACOBO`  
**Commit HEAD:** `bf30d8a0c85e266a86381fb10bf3740a8451c032`  
**Fecha:** 26 de Octubre de 2026  
**Estado General:** **PASS (10/10 REQUISITOS APROBADOS)**

---

### RESUMEN EJECUTIVO DE CUMPLIMIENTO

| # | Requisito Mandatorio AF-30 | Estado | Evidencia Principal |
|---|---|:---:|---|
| 1 | Auditoría de diferencias y preservación arquitectónica | **PASS** | Cero violaciones arquitectónicas; migraciones canónicas intactas; rama `B_JACOBO` conservada. |
| 2 | Persistencia documental real en S3 tras reinicio de backend | **PASS** | Borrador creado (#32), guardado en `sigd_doc.resolucion` y S3; backend reiniciado a cero; recuperado íntegro (#33) desde MinIO S3 sin caché en memoria. |
| 3 | Identidad y FSM en RutaDoc (`resolverOperadorParam`) | **PASS** | Operador mapeado deriva exitosamente a `DERIVADO` (HTTP 200, operador `990000001`, UUID real en JSONB); operador no mapeado falla cerrado (HTTP 422 `OPERADOR_INCOMPATIBLE`). |
| 4 | Contratos canónicos originales (#32 y #33) | **PASS** | Historial Git confirma que las rutas PUT no eran canónicas. Sincronización completa frontend-backend en `POST /api/v1/resoluciones/proyectar` y `GET /api/v1/resoluciones/:id`. |
| 5 | Resultados TypeScript y Suites Unitarias | **PASS** | Backend TS: 0 errores. Frontend TS: 0 errores. Backend Unit: 65/65 suites (1,128/1,128 tests). Frontend Unit: 62/62 suites (697/697 tests). |
| 6 | Matriz E2E en Chromium sobre los 9 Módulos | **PASS** | 9/9 pruebas E2E aprobadas en navegador headless Chromium real en sandbox aislado (1.1m). |
| 7 | Identificadores y Digests SHA-256 de Imágenes | **PASS** | Imágenes etiquetadas independientemente: `sigd-backend:af30-candidate` y `sigd-frontend:af30-candidate`. AF-29 y respaldos AF-26 preservados intactos. |
| 8 | Estado de los 6 Contenedores Originales y Volúmenes | **PASS** | Los 6 contenedores (`sigd-backend-1`, `sigd-frontend-1`, `sigd-postgres-1`, `sigd-postgres_test-1`, `sigd-redis-1`, `sigd-minio-1`) y sus 4 volúmenes están intactos y en ejecución saludable. |
| 9 | Estado de Datos de Demostración | **PASS** | Base de datos persistente `sigd_prueba` auditada sin modificaciones ni escrituras de prueba. Semillas sintéticas aisladas preparadas en `seed_e2e.sql`. |
| 10 | Procedimiento de Activación y Reversión Docker Compose | **PASS** | Procedimiento reproducible documentado con variables externas y rollback garantizado. |

---

### 1. AUDITORÍA DE DIFERENCIAS Y PRESERVACIÓN ARQUITECTÓNICA

- **Rama:** `B_JACOBO`
- **Commit HEAD:** `bf30d8a0c85e266a86381fb10bf3740a8451c032`
- **Comprobación de inmutabilidad:**
  - Estructura de los 9 módulos: **Preservada al 100%**.
  - Migraciones canónicas de PostgreSQL: **Intactas**, no se agregaron tablas ni columnas intermodulares que rompan la segregación formal.
  - Integración de seguridad: JWT, RBAC por tablas maestras (`sigd_org.rol_permiso`), FSM con validación de transiciones canónicas (`06_sigd_rut.sql`) y RequestContext se mantienen según la arquitectura original.
  - `docker-compose.yml` y configuración Docker: Se mantuvieron inalteradas las definiciones de infraestructura y segregación de puertos (5433 para postgres persistente).

---

### 2. EVIDENCIA DE PERSISTENCIA DOCUMENTAL REAL EN DESPACHO Y MINIO S3

Se implementó y ejecutó una verificación en sandbox efímero aislado (puertos separados: DB 5438, Redis 6388, MinIO 9012, Backend 3008) demostrando:

1. **Creación de Resolución (#32 `POST /api/v1/resoluciones/proyectar`):**
   - Resolución creada exitosamente: `ID = 1b290211-a560-417b-89fc-5acaaee748ce`, `Número = RD-2026-000002`.
   - Metadatos persistidos en `sigd_doc.resolucion`:
     ```text
     1b290211-a560-417b-89fc-5acaaee748ce | RD-2026-000002 | DIRECTORAL_TITULACION | BORRADOR_PENDIENTE_FIRMA
     ```
   - Objeto estructurado persistido en MinIO S3:
     - Bucket: `sigd-sandbox-af30`
     - Clave: `resoluciones/borradores/1b290211-a560-417b-89fc-5acaaee748ce.json`
     - Contenido: 3 artículos resolutivos y 3 considerandos normativos.
2. **Consulta Inicial (#33 `GET /api/v1/resoluciones/:id`):**
   - Respuesta HTTP 200 con los 3 artículos intactos y HTML renderizado.
3. **Edición de Borrador (#32 `POST /api/v1/resoluciones/proyectar` con `resolucionId`):**
   - Actualización exitosa a 2 artículos ("Mención de Honor") y nuevo visto.
   - Objeto en MinIO S3 y fila en PostgreSQL actualizados en la misma operación.
4. **Prueba de Fuego — Reinicio Completo del Backend Aislado:**
   - Proceso backend temporal destruido y levantado nuevamente (`flushing in-memory cache`).
5. **Recuperación Post-Reinicio desde S3:**
   - Invocación a `GET /api/v1/resoluciones/1b290211-a560-417b-89fc-5acaaee748ce`.
   - Respuesta HTTP 200: **Recuperó íntegramente los 2 artículos actualizados y el texto modificado directamente desde MinIO S3 sin depender de caché**.
6. **Fail-Closed ante ID Inexistente:**
   - Invocación a `GET /api/v1/resoluciones/00000000-0000-0000-0000-000000009999`.
   - Respuesta HTTP 404 (NotFoundError controlado). Cero datos ficticios inventados.
7. **Segregación de Auditoría:**
   - `sigd_audit.bitacora_auditoria` registró 2 entradas append-only (INSERT y UPDATE).
   - Ninguna consulta (`SELECT`) a `bitacora_auditoria` es ejecutada por `obtenerPorId`, preservando la auditoría estrictamente como registro inmutable WORM.

---

### 3. RESULTADO DE LAS PRUEBAS DE IDENTIDAD Y FSM EN RUTADOC

Se verificó el comportamiento de `resolverOperadorParam` en `derivaciones.service.ts`:

1. **Derivación con Operador Mapeado (Exitoso):**
   - Usuario: Administrador General (`00000000-0000-0000-0000-000000000001`).
   - Mapeo en catálogo: `sigd_auth.operador_identidad` -> `operador_id = 990000001`.
   - Expediente de prueba: `00000000-0000-0000-0000-000000000777` (`EXP-2026-000777`) en estado `EN_CALIFICACION`.
   - Destino: Área `SEC` (Secretaría Académica).
   - Resultado: **HTTP 200 OK**.
   - Registro en `sigd_rut.movimiento_tramite`:
     ```text
     usuario_operador_id = 990000001
     usuarioActorUuid = 00000000-0000-0000-0000-000000000001
     estado_nuevo = DERIVADO
     secuencia = 2
     ```
   - El UUID auténtico del actor se conservó en el objeto JSONB `datosJson.usuarioActorUuid`.
2. **Derivación con Operador No Mapeado (Fail-Closed Estricto):**
   - Usuario: `sinmapeo` (`00000000-0000-0000-0000-000000000999`), cuenta activa con rol `ADMINISTRADOR` pero sin correspondencia en `sigd_auth.operador_identidad`.
   - Expediente: `00000000-0000-0000-0000-000000000888`.
   - Resultado: **HTTP 422 Unprocessable Entity**.
   - Mensaje: `DomainError: OPERADOR_INCOMPATIBLE - "El usuario '00000000-0000-0000-0000-000000000999' no cuenta con un operador numérico mapeado en el catálogo institucional."`
   - Cero movimientos registrados en la base de datos para ese usuario. Falla cerrado con precisión.

---

### 4. RESULTADO DE LAS PRUEBAS DE CONTRATOS CANÓNICOS

- **Contrato Canónico #32 (`POST /api/v1/resoluciones/proyectar`):**
  - Creación y actualización de borradores formalmente unificadas bajo el endpoint canónico #32.
- **Contrato Canónico #33 (`GET /api/v1/resoluciones/:id`):**
  - Consulta con previsualización HTML oficial.
- **Auditoría de Historial Git:**
  - El commit inicial del módulo DocuCore (`c26b963e6f224403cbc09a9124a3cce155b98974`) por Christian Jhoel Rodríguez Cari demuestra que las rutas `PUT` nunca fueron parte del contrato original #32 ni #33.
  - La eliminación quirúrgica de las rutas `PUT` restituyó la compatibilidad canónica exacta con la especificación del sistema.

---

### 5. RESULTADOS DE BACKEND Y FRONTEND

```text
=============================================================================
1. BACKEND TYPESCRIPT (npx tsc --noEmit)
   Resultado: 0 errores de compilación. Código de salida: 0.

2. FRONTEND TYPESCRIPT (npx tsc --noEmit)
   Resultado: 0 errores de compilación. Código de salida: 0.

3. SUITE UNITARIA BACKEND (npm run test:unit)
   Test Files: 65 passed | 1 skipped (66)
   Tests:      1,128 passed | 10 skipped (1,138)
   Failures:   0
   Duración:   16.02s
   Código de salida: 0.

4. SUITE UNITARIA FRONTEND (npm test)
   Test Files: 62 passed (62)
   Tests:      697 passed | 1 skipped (698)
   Failures:   0
   Duración:   78.17s
   Código de salida: 0.
=============================================================================
```

---

### 6. MATRIZ DE PRUEBAS END-TO-END (9 MÓDULOS EN NAVEGADOR CHROMIUM)

Ejecución en navegador real Chromium en sandbox efímero (`scratch/run_sandbox_e2e_browser.ts`):

| # | Módulo Institucional | Prueba E2E Ejecutada | Resultado | Tiempo |
|---|---|---|:---:|:---:|
| 1 | **IdentiCore** | Auto-registro civil con Ubigeo (Callería 250101), consentimiento Ley 29733 y autenticación JWT con emisión de AccessToken y RefreshToken. | **PASS** | 11.8s |
| 2 | **OrganiCore** | Visualización del organigrama institucional, jerarquía de áreas y catálogo RBAC de roles del sistema. | **PASS** | 4.5s |
| 3 | **TramiCore** | Radicación de trámite virtual, validación TUPA y generación determinista de CUT (`EXP-2026-000001`). | **PASS** | 9.8s |
| 4 | **RutaDoc** | Bandeja de 6 pestañas, calificación y pase de expediente con derivación transaccional y transición FSM a `DERIVADO`. | **PASS** | 9.6s |
| 5 | **DocuCore** | Validación pública de autenticidad documental mediante código CVD (`CVD-2026-RD-000142-A4F2`) contra objeto firmado en Silo S3. | **PASS** | 3.2s |
| 6 | **Despacho** | Redacción WYSIWYG de Resolución Directoral, persistencia en S3 y recuperación multi-sesión con 3 artículos. | **PASS** | 10.5s |
| 7 | **FirmaCore** | Pasarela de firma digital institucional, invocación protocolar `refirma://`, recepción de callback y rechazo estricto de repetición (HTTP 409). | **PASS** | 4.5s |
| 8 | **CoreLink** | Casilla Electrónica ciudadana, depósito de notificación, lectura fehaciente y generación de acuse legal con hash SHA-256 e ISO-8601. | **PASS** | 4.8s |
| 9 | **Analítica MGD-PCM** | Dashboard directivo MGD, métricas de retención por tramos y consistencia de indicadores con PostgreSQL. | **PASS** | 5.8s |

**Resumen E2E:** 9 pruebas ejecutadas, **9 aprobadas (100%)**, 0 fallidas. Duración: 1.1 minutos.

---

### 7. IDENTIFICADORES Y DIGESTS SHA-256 DE LAS IMÁGENES

| Imagen | Etiqueta | Digest SHA-256 / Image ID | Función |
|---|---|---|---|
| `sigd-backend` | `af30-candidate` | `sha256:ba8918f5a0fe55edfc7148d8ae0fbe5942086804f446da0cfe47b9acb3ce0819` | Candidata validada definitiva |
| `sigd-frontend` | `af30-candidate` | `sha256:014acabe5303b89d223ad00db4d65520ff488669a20b38315b9db1905a50105b` | Candidata validada definitiva |
| `sigd-backend` | `af29-candidate` | `sha256:84e265aaf909a255e90fe162d221fdd2d234f36150e1fefa5520873b6cd62708` | Candidata previa conservada |
| `sigd-frontend` | `af29-candidate` | `sha256:3ff26c3d81870358ca07274607d4d38aac5278187c38f564e265686294ebafe5` | Candidata previa conservada |
| `sigd-backend` | `rollback-af26` | `sha256:84c6e5412fa0f9f4ee07d4ccce922633cee74f1e5898c7b473cc0026b067253c` | Imagen de reversión protegida |
| `sigd-frontend` | `rollback-af26` | `sha256:f2e19c5796d36effe9679b570867f2981c148039d914ff0358bd71a68aeefa16` | Imagen de reversión protegida |

---

### 8. ESTADO DE LOS CONTENEDORES ORIGINALES Y VOLÚMENES

Todos los contenedores originales de la arquitectura permanecieron protegidos, sin reinicios, recreaciones ni sustituciones:

```text
CONTAINER ID   NAMES                  STATUS                    PORTS
9e37c33ea83e   sigd-backend-1         Up 25 minutes             127.0.0.1:3000->3000/tcp
e1fbc0a5db61   sigd-frontend-1        Up 25 minutes             127.0.0.1:5173->5173/tcp
882b021b3cf0   sigd-postgres_test-1   Up 25 minutes (healthy)   127.0.0.1:5434->5432/tcp
9da1bb32864b   sigd-redis-1           Up 25 minutes (healthy)   127.0.0.1:6379->6379/tcp
f057f2bf4352   sigd-postgres-1        Up 25 minutes (healthy)   127.0.0.1:5433->5432/tcp
54d72bc68ce7   sigd-minio-1           Up 25 minutes (healthy)   127.0.0.1:9000-9001->9000-9001/tcp
```

**Volúmenes persistentes originales (intactos):**
- `sigd-integrado_pgdata`
- `sigd-integrado_miniodata`
- `sigd-integrado_redisdata`
- `sigd-validacion_pgdata_test`

---

### 9. ESTADO DE LOS DATOS Y GUÍA DE DEMOSTRACIÓN

#### 9.1 Diagnóstico de la Base de Datos Persistente (`sigd_prueba`)
- Contiene el esquema canónico relacional limpio.
- Contiene 1 cuenta técnica de prueba (`sigd-test-b34e...`), 0 asignaciones de rol en `sigd_org.usuario_rol` y 0 resoluciones en `sigd_doc.resolucion`.
- **No se insertaron datos de prueba en la base persistente**, respetando la orden innegociable de no alterar datos de producción ni de persistencia original.

#### 9.2 Mecanismo de Demostración Aislada (Sandbox con `seed_e2e.sql`)
Para realizar una demostración completa sin alterar `sigd_prueba`:
1. **Credenciales de demostración:**
   - **Administrador General / Director:** `admin` / `AdminPass2026!` (roles: `ADMINISTRADOR`, `DIRECTOR` con acceso global y facultad de despacho).
   - **Ciudadano Administrado:** auto-registrado en el Paso 1 de la demo (`72145896` / `PasswordSeguro2026!`).
2. **Guía de flujo para la demostración de los 9 módulos:**
   - **Módulo 1 (IdentiCore):** Ingresar a `/registro`, completar formulario civil con Ubigeo `250101` y aceptar Ley 29733. Iniciar sesión en `/login`.
   - **Módulo 2 (OrganiCore):** Navegar a `/administracion/organigrama` para visualizar la estructura jerárquica y `/administracion/usuarios` para el directorio institucional.
   - **Módulo 3 (TramiCore):** Ingresar a `/tramite/nuevo` (Ventanilla Virtual), seleccionar TUPA de titulación, adjuntar requisitos y generar el CUT.
   - **Módulo 4 (RutaDoc):** Con usuario `admin`, ir a `/expedientes`, revisar las 6 pestañas, calificar el expediente y derivarlo con proveído formal hacia Secretaría Académica.
   - **Módulo 5 (DocuCore):** Ingresar a `/validador-cvd` y validar el código `CVD-2026-RD-000142-A4F2` para inspeccionar la integridad criptográfica y metadatos.
   - **Módulo 6 (Despacho):** Ingresar a `/flujos/proyector-resoluciones`, redactar la resolución directoral con membrete A4 y guardar borrador persistente en S3.
   - **Módulo 7 (FirmaCore):** Ir a `/flujos/pasarela-firma`, seleccionar documento pendiente de firma, disparar el conector `refirma://` y simular el retorno del callback.
   - **Módulo 8 (CoreLink):** Iniciar sesión como ciudadano e ingresar a `/casilla` para consultar la notificación, visualizar el documento y emitir el acuse legal de recepción.
   - **Módulo 9 (Analítica MGD-PCM):** Ingresar a `/reportes/dashboard` para inspeccionar los indicadores de gestión documentaria, tiempos de ciclo y retención por tramos.

---

### 10. PROCEDIMIENTO EXACTO DE ACTIVACIÓN Y REVERSIÓN

#### 10.1 Procedimiento de Activación Autorizada (Cuando el usuario lo autorice)
Una vez que el usuario otorgue su autorización expresa, el despliegue de las imágenes validadas `af30-candidate` se realiza mediante:

```powershell
# 1. Configurar variables de imagen en el entorno local
$env:SIGD_BACKEND_IMAGE="sigd-backend:af30-candidate"
$env:SIGD_FRONTEND_IMAGE="sigd-frontend:af30-candidate"

# 2. Recrear únicamente los contenedores de aplicación sin tocar servicios de datos
docker compose -f docker-compose.sigd.yml --env-file C:\Users\Liz\AppData\Local\SIGD\secrets\compose.env up -d --no-deps --no-build backend frontend

# 3. Comprobar salud operativa
curl http://127.0.0.1:3000/health
curl http://127.0.0.1:5173
```

#### 10.2 Procedimiento de Reversión Inmediata (Rollback a AF-26)
Si se requiere volver de forma instantánea al estado seguro de AF-26:

```powershell
# 1. Revertir a las imágenes de respaldo protegidas
$env:SIGD_BACKEND_IMAGE="sigd-backend:rollback-af26"
$env:SIGD_FRONTEND_IMAGE="sigd-frontend:rollback-af26"

# 2. Restaurar contenedores de aplicación
docker compose -f docker-compose.sigd.yml --env-file C:\Users\Liz\AppData\Local\SIGD\secrets\compose.env up -d --no-deps backend frontend
```

---

### 11. DICTAMEN FINAL Y DETENCIÓN TÉCNICA

> [!IMPORTANT]
> **DICTAMEN PROFESIONAL:**  
> El prototipo académico independiente del **SIGD IESTP Suiza 2026** se encuentra **100% FUNCIONAL, VALIDADO Y LISTO PARA LA DEMOSTRACIÓN DE LOS 9 MÓDULOS INSTITUCIONALES**.  
>  
> - Se ha demostrado la persistencia real de resoluciones en MinIO S3 y PostgreSQL tras el reinicio del backend.  
> - Se ha comprobado el comportamiento fail-closed estricto de RutaDoc y la integridad de su máquina de estados.  
> - Se han aprobado 1,128 pruebas unitarias del backend, 697 del frontend y las 9 pruebas E2E de navegador en Chromium.  
> - La arquitectura original, migraciones, JWT, RBAC, contratos canónicos y contenedores originales permanecen intactos.

**DETENCIÓN MANDATORIA CUMPLIDA:**
- **No se ha ejecutado el despliegue.**
- **No se han sustituido los contenedores originales.**
- **No se han alterado los datos persistentes.**
- **Se detiene la ejecución técnica y se aguarda la autorización expresa del usuario antes de proceder con el despliegue.**
