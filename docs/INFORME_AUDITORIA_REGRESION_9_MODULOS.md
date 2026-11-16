# SIGD IESTP SUIZA 2026 — AUDITORÍA INTEGRAL DE REGRESIÓN DE LOS 9 MÓDULOS

**Proyecto:** Sistema Integral de Gestión Documentaria (SIGD) — IESTP Suiza 2026  
**Rama de trabajo auditada:** `B_JACOBO`  
**Referencia arquitectónica canónica:** Commit `8d3bc10` (rama `main`)  
**Commit HEAD auditado:** `bf30d8a0c85e266a86381fb10bf3740a8451c032`  
**Fecha de auditoría:** 26 de octubre de 2026  
**Responsable técnico:** Especialista QA / DevOps y Arquitecto de Software Senior  

---

## 1. RESUMEN EJECUTIVO

Se ha ejecutado una **Auditoría Integral de Regresión** sobre el prototipo consolidado del SIGD en la rama `B_JACOBO`, bajo estrictas reglas de no modificación de código, preservación de datos preexistentes, transacciones de solo lectura y protección absoluta de los recursos del docente.

### Veredicto Técnico: **PROTOTIPO ESTABLE Y VERIFICADO EN SUS 9 MÓDULOS**

1. **Estado Funcional Global:** Los **nueve módulos institucionales (M1 a M9)** continúan plenamente operativos. No se han detectado regresiones funcionales ni roturas de contratos de API.
2. **Distinción de Niveles de Comprobación:**
   - **Comprobado nuevamente en esta auditoría:** Todas las rutas de Frontend (HTTP 200), endpoints REST del Backend en vivo, autenticación de las 5 cuentas demo con Argon2id, RBAC restrictivo (403 verificado), consultas al Catálogo TUPA 2026, validación de Ubigeo Ucayali, cotejo público CVD, verificación de persistencia E2E en navegador con Playwright (M4, M6, M9), y chequeo estático de tipos TypeScript (0 errores en backend y frontend).
   - **Previamente comprobado y preservado:** Pruebas E2E de inserción viva (M1 registro ciudadano, M3 radicación con subida de PDF a MinIO, M4 derivación con despacho Outbox, M6 proyección de borrador). Se conservan los registros reales creados en la corrida previa (`EXP-2026-000005`, `RD-2026-000008`, PDF con hash `024d45aeb370...`).
   - **Regresiones actuales:** **CERO (0)**.
   - **Limitaciones / Pruebas pendientes:** Las operaciones de firma digital positiva PAdES-B-LTA (M7) y consumo de acuses sin eventos oficiales previos (M8) no se ejecutaron con simulación artificial para respetar el mandato de no adulterar el estado legal sin proveedor acreditado ni certificados reales.
3. **Preservación de Infraestructura:**
   - Base de datos docente `sigd_prueba`: **100% INTACTA** (31 tablas originales, 1 usuario, cero modificaciones).
   - Base prototipo `sigd_jacobo_demo`: 56 tablas canónicas en 6 esquemas, usuario técnico `sigd_jacobo_user` (`rolsuper = false`).
   - Cero contenedores de prueba redundantes; los 3 contenedores canónicos Docker (`sigd-postgres-1`, `sigd-redis-1`, `sigd-minio-1`) permanecen saludables.

---

## 2. CONFIRMACIÓN DE LA RAMA Y ESTADO DE GIT

- **Rama actual:** `B_JACOBO` (confirmado mediante `git branch --show-current`).
- **Commit HEAD:** `bf30d8a0c85e266a86381fb10bf3740a8451c032`.
- **Integridad de Git:** No se realizaron merges, commits, resets ni rebase. Todos los cambios preexistentes en `B_JACOBO` se han conservado intactos sin sobrescrituras ni reversiones.
- **Rama `main`:** El commit `8d3bc10` se mantiene intacto y sin ninguna operación de escritura.

---

## 3. INVENTARIO DE LOS NUEVE MÓDULOS REALES Y SUS RUTAS

| Módulo | Dominio Backend | Rutas UI (Frontend) | Endpoints REST Principales (Backend) | Esquemas y Tablas en PostgreSQL |
| :--- | :--- | :--- | :--- | :--- |
| **M1: Identidad, Autenticación y Registro Ciudadano** | `identicore` | `/registro`<br>`/login`<br>`/acceso-denegado` | `POST /api/v1/auth/login`<br>`GET /api/v1/auth/me`<br>`POST /api/v1/auth/registro-ciudadano`<br>`GET /api/v1/ubigeo/distritos-ucayali` | `sigd_auth.cuenta_usuario`<br>`sigd_auth.persona`<br>`sigd_auth.persona_natural`<br>`sigd_auth.auditoria_usuarios` |
| **M2: Organización, Directorio de Usuarios y RBAC** | `organicore` | `/administracion/usuarios`<br>`/administracion/roles-permisos`<br>`/administracion/organigrama` | `GET /api/v1/admin/usuarios`<br>`GET /api/v1/admin/roles-permisos`<br>`PUT /api/v1/roles/:id/permisos`<br>`GET /api/v1/admin/organigrama` | `sigd_org.rol_sistema`<br>`sigd_org.permiso_sistema`<br>`sigd_org.rol_permiso`<br>`sigd_org.usuario_rol`<br>`sigd_org.area` |
| **M3: Mesa de Partes Virtual y Ventanilla Presencial** | `tramicore` | `/tramite/mesa-partes-virtual`<br>`/tramite/ventanilla-presencial`<br>`/consulta`<br>`/consulta/:cut` | `GET /api/v1/tramites/tipos`<br>`POST /api/v1/tramites/radicacion-virtual`<br>`GET /api/v1/tramites/consulta-publica/:cut` | `sigd_tra.expediente`<br>`sigd_tra.tramite`<br>`sigd_tra.asiento_registro`<br>`sigd_doc.documento_adjunto` (MinIO) |
| **M4: RutaDoc / Gestión de Expedientes, Derivación y FSM** | `rutadoc` | `/expedientes`<br>`/expedientes/:id` | `GET /api/v1/expedientes?pestana=...`<br>`GET /api/v1/expedientes/:id`<br>`POST /api/v1/expedientes/:id/derivar`<br>`GET /api/v1/expedientes/:id/trazabilidad` | `sigd_rut.movimiento_tramite`<br>`sigd_rut.estado_actual_expediente`<br>`sigd_audit.evento_outbox` |
| **M5: DocuCore / Validador Público de Integridad CVD** | `docucore` | `/validador-cvd`<br>`/flujo-validez-legal/visor-cvd` | `GET /api/v1/validador/cvd/:codigo` | `sigd_doc.firma_digital_documento`<br>`sigd_doc.documento_adjunto` |
| **M6: Despacho y Proyección de Resoluciones Académicas** | `docucore` | `/flujos/proyector-resoluciones`<br>`/flujos/titulacion` | `POST /api/v1/resoluciones/proyectar`<br>`GET /api/v1/resoluciones/:id`<br>`GET /api/v1/resoluciones/expediente/:expedienteId` | `sigd_doc.resolucion` |
| **M7: Pasarela de Firma Digital Institucional (ReFirma)** | `docucore` | `/flujo-validez-legal/firma`<br>`/flujo-validez-legal` | `GET /api/v1/firma/pendientes`<br>`GET /api/v1/firma/documento/:id/estado`<br>`POST /api/v1/firma/iniciar` | `sigd_doc.documento_adjunto`<br>`sigd_doc.firma_digital_documento` |
| **M8: Notificaciones Oficiales en Casilla Electrónica** | `identicore` | `/casilla`<br>`/casilla-electronica` | `GET /api/v1/casilla/notificaciones`<br>`POST /api/v1/casilla/notificaciones/:id/acuse` | `sigd_auth.notificacion_casilla`<br>`sigd_auth.casilla_electronica` |
| **M9: CoreLink / Tablero Analítico y Reportes MGD** | `corelink` | `/reportes/dashboard`<br>`/reportes` | `GET /api/v1/reportes/dashboard/resumen`<br>`GET /api/v1/reportes/vistas-materializadas/refresh`<br>`GET /api/v1/reportes/kpis-mensuales` | `sigd_tra.mv_kpis_mgd_mensual`<br>`sigd_tra.mv_kpis_mgd_general` |

---

## 4. ESTADO DE INFRAESTRUCTURA Y CONECTIVIDAD

| Componente | Configuración y Puerto | Estado Operativo | Evidencia Técnica |
| :--- | :--- | :--- | :--- |
| **PostgreSQL (Docker)** | Contenedor `sigd-postgres-1`, puerto local `5433` | Saludable (Up > 3 horas) | `docker ps` healthy. Conexión TCP establecida. |
| **Base de Datos Demo** | `sigd_jacobo_demo` | Activa | 56 tablas de usuario validadas en 6 esquemas. |
| **Usuario DB Técnico** | `sigd_jacobo_user` | Activo | Permisos DML/DDL restringidos (`rolsuper = false`). |
| **Base Original Docente** | `sigd_prueba` (puerto 5433) | **INTACTA** | 31 tablas de esquema original, 1 usuario, 0 registros de test. |
| **Redis (Docker)** | Contenedor `sigd-redis-1`, puerto `6379`, DB `1` | Saludable | `ioredis.ping()` -> `PONG`, `dbsize: 0`. |
| **MinIO S3 (Docker)** | Contenedor `sigd-minio-1`, puertos `9000` / `9001` | Saludable | `/minio/health/live` -> HTTP 200. Bucket `sigd-sandbox-e2e`. |
| **Backend Local** | Node.js en `http://127.0.0.1:3008` (PID `11064`) | Activo (Desacoplado) | `/health` -> 200 (`"estado":"UP"`), `/ready` -> 200 (`"estado":"READY"`). |
| **Frontend Local** | Vite / React en `http://127.0.0.1:5178` (PID `17304`) | Activo (Desacoplado) | `GET /` -> HTTP 200. Proxy `/api` -> 3008 verificado. |
| **Procesos Duplicados** | Puertos 3008 y 5178 | **CERO DUPLICADOS** | Exactamente 1 proceso en escucha por puerto. |
| **Worker Outbox** | Backend integrado (`OUTBOX_WORKER_ENABLED=true`) | Activo | Instancia única procesando eventos transaccionales. |

---

## 5. MATRIZ DE PRUEBAS DE REGRESIÓN POR MÓDULO

| Módulo | Estado de Regresión | Prueba Ejecutada en esta Auditoría | Evidencia Técnica Actual | Limitaciones y Aislamiento |
| :--- | :---: | :--- | :--- | :--- |
| **M1: Identidad y Registro** | **APROBADO** | - Login con 5 cuentas demo.<br>- Login negativo (password erróneo).<br>- Consulta Ubigeo Ucayali y Coronel Portillo.<br>- Verificación UI `/registro` y `/login`. | - Login 5/5 OK (`admin`, `director`, `operador`, `ventanilla`, `ciudadano`).<br>- Login erróneo: HTTP 401.<br>- Ubigeo: HTTP 200 (4 provincias, 7 distritos en Coronel Portillo).<br>- UI `/registro` y `/login`: HTTP 200. | Inserción de ciudadano omitida para no crear filas en DB; validada en lectura sobre registros previos (`98767973`). |
| **M2: Directorio y RBAC** | **APROBADO** | - `GET /api/v1/admin/usuarios` con `admin.demo`.<br>- RBAC negativo con `ciudadano.demo`.<br>- Consulta de roles y permisos.<br>- Consulta de organigrama.<br>- Verificación UI `/administracion/usuarios`. | - Admin: HTTP 200 (Total 9 usuarios con UUID canónico).<br>- Ciudadano: **HTTP 403 Forbidden** estricto.<br>- Roles: HTTP 200 (6 roles canónicos devueltos).<br>- Organigrama: HTTP 200.<br>- UI: HTTP 200. | Ninguna. |
| **M3: Mesa de Partes y TUPA** | **APROBADO** | - `GET /api/v1/tramites/tipos` (Catálogo TUPA).<br>- Consulta pública de CUT existente (`EXP-2026-000005`).<br>- Consulta de CUT no existente (`EXP-2026-999999`).<br>- Consulta de CUT con formato inválido.<br>- Verificación UI `/tramite/mesa-partes-virtual` y `/consulta`. | - TUPA: HTTP 200 (19 procedimientos vigentes).<br>- Consulta pública: HTTP 200 (devuelve estado procesal del CUT).<br>- No existente: HTTP 404 RFC 7807.<br>- Formato inválido: HTTP 400 RFC 7807.<br>- UI: HTTP 200. | Radicación de nuevos expedientes omitida para cumplir regla de no creación; validada en lectura contra `EXP-2026-000005`. |
| **M4: RutaDoc y FSM** | **APROBADO** | - `GET /api/v1/expedientes?pestana=DERIVADOS`.<br>- `GET /api/v1/expedientes/:id` (con `admin.demo`).<br>- `GET /api/v1/expedientes/:id/trazabilidad`.<br>- Intento sin token a `:id`.<br>- Playwright E2E focalizado (`verificar_persistencia.spec.ts`).<br>- Verificación UI `/expedientes`. | - Bandeja: HTTP 200.<br>- Detalle: HTTP 200 (`EXP-2026-000005`).<br>- Trazabilidad: HTTP 200.<br>- Sin token: HTTP 401.<br>- Playwright: **ok 1 (22.9s)** con validación de FSM, Outbox procesado y hash SHA-256 en visor PDF verificado.<br>- UI: HTTP 200. | Derivación viva de nuevos expedientes omitida; verificada en lectura y mediante prueba E2E Playwright existente. |
| **M5: Validador CVD** | **APROBADO** | - `GET /api/v1/validador/cvd/CVD-2026-RD-000142-A4F2`.<br>- `GET /api/v1/validador/cvd/invalido`.<br>- Verificación UI `/validador-cvd`. | - CVD válido: HTTP 200 (`valido: true`, cotejo SHA-256).<br>- CVD inválido: HTTP 400 Bad Request RFC 7807.<br>- UI: HTTP 200 (renderiza cláusula legal de reserva). | Validación en tiempo real opera por cotejo de huella SHA-256 y metadatos persistidos. |
| **M6: Despacho Resoluciones** | **APROBADO** | - `GET /api/v1/resoluciones/3d75f058-6d10-469d-8f35-2a5f5394de5b`.<br>- Playwright E2E focalizado (`verificar_persistencia.spec.ts`).<br>- Verificación UI `/flujos/proyector-resoluciones`. | - API: HTTP 200 (borrador `RD-2026-000008`, 3 artículos).<br>- Playwright: **ok 2 (10.8s)** recuperando borrador y articulado en 2 sesiones independientes.<br>- UI: HTTP 200. | Proyección de nuevos borradores omitida; verificada en lectura y recuperación multisession. |
| **M7: Firma Digital** | **APROBADO** *(Control arquitectónico y de seguridad)* | - `GET /api/v1/firma/pendientes` con `admin.demo`.<br>- `GET /api/v1/firma/documento/:id/estado`.<br>- Verificación UI `/flujo-validez-legal/firma`. | - Pendientes: HTTP 200.<br>- Estado documento: HTTP 200 (documento no marcado como firmado sin certificado).<br>- UI: HTTP 200. | Firma PAdES positiva omitida deliberadamente: requiere certificado y token criptográfico legal de INDECOPI/RENIEC. |
| **M8: Casilla Electrónica** | **APROBADO** *(Recepción e infraestructura)* | - `GET /api/v1/casilla/notificaciones` con `ciudadano.demo`.<br>- Verificación UI `/casilla`. | - Notificaciones: HTTP 200 (Array institucional devuelto).<br>- UI: HTTP 200 (Bandeja y badge en tiempo real). | Emisión de acuses omitida: la cuenta demo no registra notificaciones pendientes y no se inyectan datos vía SQL artificial. |
| **M9: Tablero Analítico MGD** | **APROBADO** | - `GET /api/v1/reportes/dashboard/resumen` con `director.demo`.<br>- Refresco de vistas materializadas con `admin.demo`.<br>- RBAC de refresco con `director.demo`.<br>- Playwright E2E focalizado (`verificar_persistencia.spec.ts`).<br>- Verificación UI `/reportes/dashboard`. | - Dashboard: HTTP 200 (`nRadicados = 5`).<br>- Admin refresh: HTTP 200.<br>- Director refresh: **HTTP 403 Forbidden**.<br>- Playwright: **ok 3 (7.0s)** (métricas exactas, cálculo de VTEP, gráfico SVG).<br>- UI: HTTP 200. | Ninguna. |

---

## 6. RESULTADOS DE TYPECHECK, TESTS UNITARIOS Y E2E

### 6.1. Verificación Estática de Tipos TypeScript (`tsc --noEmit`)
- **Backend:** `sigd-backend@1.0.0 typecheck` -> **0 errores** (Exit code `0`).
- **Frontend:** `sigd-frontend@0.1.0 typecheck` -> **0 errores** (Exit code `0`).

### 6.2. Pruebas Unitarias Canónicas del Backend (Vitest)
```text
Test Files  65 passed | 1 skipped (66 total)
     Tests  1128 passed | 10 skipped (1138 total)
  Duration  16.35s
```
- Cobertura validada: Argon2id, RBAC por unidad orgánica, FSM de transiciones de expedientes, foliación AGN, validación CVD, Outbox transaccional y analítica MGD.

### 6.3. Pruebas Automatizadas E2E de Playwright (Verificación de Persistencia)
Ejecución de `verificar_persistencia.spec.ts`:
```text
Running 3 tests using 1 worker
  ok 1 M4 existente: FSM, Outbox, Bandeja, Detalle y PDF protegido (22.9s)
  ok 2 M6 existente: resolución PostgreSQL/Storage recuperada en dos sesiones independientes (10.8s)
  ok 3 M9: refresco institucional autorizado y métricas coincidentes en React (7.0s)
  3 passed (54.3s)
Playwright exit code: 0
```

---

## 7. COMPARACIÓN DE EVIDENCIAS: ANTES VS AHORA

| Aspecto Evaluado | Evidencia Previa (Auditoría de Cierre) | Evidencia Actual (Auditoría de Regresión) | Estado de Regresión |
| :--- | :--- | :--- | :---: |
| **Backend /health y /ready** | HTTP 200 OK | HTTP 200 OK | **Sin cambios (Estable)** |
| **Frontend UI Loading** | HTTP 200 OK en puerto 5178 | HTTP 200 OK en puerto 5178 | **Sin cambios (Estable)** |
| **Autenticación Demo** | 5 cuentas demo autenticadas | 5 cuentas demo autenticadas + negativo 401 | **Sin cambios (Estable)** |
| **RBAC Directorio M2** | Admin 200, Ciudadano 403 | Admin 200 (9 usuarios), Ciudadano 403 | **Sin cambios (Estable)** |
| **Catálogo TUPA M3** | 19 procedimientos | 19 procedimientos + consulta CUT 200/404/400 | **Sin cambios (Estable)** |
| **FSM & Outbox M4** | `DERIVADO`, evento en `PROCESADO` | `DERIVADO`, Outbox `PROCESADO`, visor PDF hash OK | **Sin cambios (Estable)** |
| **Validador CVD M5** | CVD `CVD-2026-RD-000142-A4F2` OK | CVD válido 200, CVD inválido 400 | **Sin cambios (Estable)** |
| **Resoluciones M6** | Borrador `RD-2026-000008` (3 arts) | Borrador persistido y recuperado multisession | **Sin cambios (Estable)** |
| **Firma Digital M7** | Endpoint 200, estado no adulterado | Cola pendientes 200, estado documento 200 | **Sin cambios (Estable)** |
| **Casilla M8** | Notificaciones 200 | Notificaciones 200 | **Sin cambios (Estable)** |
| **Tablero M9** | 5 radicados, Admin 200, Director 403 | 5 radicados, Admin 200, Director 403, VTEP 0% | **Sin cambios (Estable)** |
| **TypeScript Compilation** | 0 errores en backend y frontend | 0 errores en backend y frontend | **Sin cambios (Estable)** |

---

## 8. LISTA DE FALLOS, RIESGOS Y PRUEBAS PENDIENTES

1. **Fallos detectados:** **NINGUNO**. No existen errores de ejecución ni regresiones en los servicios activos.
2. **Riesgos controlados:**
   - *Concurrencia en pruebas pesadas:* Ejecutar suites masivas de `vitest` en el frontend simultáneamente con tests de navegador puede causar demoras por uso de CPU en jsdom; esto no afecta el runtime real de producción ni los navegadores Playwright.
   - *Protección de base docente:* El backend del prototipo está configurado estrictamente con `sigd_jacobo_user` hacia `sigd_jacobo_demo`, garantizando que bajo ninguna circunstancia se toquen las tablas de `sigd_prueba`.
3. **Pruebas pendientes para integración con el profesor:**
   - Conexión de token criptográfico físico para firma PAdES-B-LTA y validación de CRL/OCSP de RENIEC/INDECOPI (M7).
   - Depósito de notificación formal desde el módulo de despacho para comprobar el acuse firmado de casilla en un flujo institucional completo de extremo a extremo (M8).

---

## 9. CONFIRMACIÓN DE NO ALTERACIÓN DE DATOS NI ARQUITECTURA

- **Base `sigd_prueba`:** Verificada con 31 tablas de esquema original y 1 único usuario (`sigd-test-b34e916da66442e387827a8b7f5fa0cf@example.invalid`), totalmente inalterada.
- **Base `sigd_jacobo_demo`:** Mantiene exactamente 56 tablas canónicas en 6 esquemas, sin migraciones adicionales ni truncados.
- **Volúmenes Docker:** Cero recreaciones, cero borrados (`docker compose down -v` o `prune` no fueron ejecutados).
- **Arquitectura canónica de `main`:** Respetada al 100% (commit base `8d3bc10`).

---

## 10. DICTAMEN FINAL

| Módulo | Dictamen de Auditoría | Justificación Técnica |
| :--- | :---: | :--- |
| **M1: Identidad y Registro** | **COMPROBADO** | Login Argon2id 5/5, Ubigeo Ucayali 200, UI 200, datos previamente persistidos intactos. |
| **M2: Directorio y RBAC** | **COMPROBADO** | Listado paginado de 9 usuarios UUID 200, RBAC negativo 403, roles y organigrama 200. |
| **M3: Mesa de Partes y TUPA** | **COMPROBADO** | 19 procedimientos TUPA 200, consulta pública 200/404/400, CUT previo y PDF en MinIO intactos. |
| **M4: RutaDoc y FSM** | **COMPROBADO** | Bandeja 200, detalle 200, trazabilidad 200, FSM `DERIVADO` y Playwright E2E aprobado. |
| **M5: Validador CVD** | **COMPROBADO** | Cotejo documental SHA-256 positivo 200, control negativo 400, UI y cláusula legal 200. |
| **M6: Despacho Resoluciones** | **COMPROBADO** | Borrador en DB 200, articulado íntegro, recuperación multisession con Playwright aprobada. |
| **M7: Firma Digital** | **COMPROBADO (Control)** | Endpoints 200, preservación de estado sin simulación artificial de certificados reales. |
| **M8: Casilla Electrónica** | **COMPROBADO (Recepción)** | Consulta de notificaciones 200, UI y badge 200, sin inyecciones arbitrarias de datos. |
| **M9: Tablero Analítico MGD** | **COMPROBADO** | Resumen 200, coincidencia de 5 expedientes, RBAC de refresco 403, Playwright E2E aprobado. |

**Conclusión:** El prototipo del SIGD en la rama `B_JACOBO` se encuentra en estado **óptimo, estable y sin regresiones**.
