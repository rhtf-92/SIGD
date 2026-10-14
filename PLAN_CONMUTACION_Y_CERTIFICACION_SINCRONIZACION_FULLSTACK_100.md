# PLAN DE CONMUTACIÓN INTEGRAL Y CERTIFICACIÓN DE SINCRONIZACIÓN FULLSTACK 100% (SIGD)

**Institución:** IESTP "Suiza" — Pucallpa, Ucayali  
**Sistema:** Sistema Integral de Gestión Documentaria (SIGD)  
**Entorno Operativo:** Backend Node.js 24.19 + Express 5 + PostgreSQL 18 ↔ Frontend React 19 + Vite 6 + Tailwind CSS
**Fecha de Certificación Local:** 2026-10-09
**Estado:** **APROBADO — CONMUTACIÓN LOCAL DB/API/UI Y S3 100% OPERATIVA**
**Compuerta de Validación:** typecheck + lint + build + unitarias + adversariales + smoke + Edge E2E + Docker health + npm audit.

---

## 1. RESUMEN EJECUTIVO Y DICTAMEN DE CONMUTACIÓN

El Sistema Integral de Gestión Documentaria (SIGD) del IESTP "Suiza" ha completado satisfactoriamente su proceso de **conmutación física, arquitectónica y operativa**, erradicando de manera total y definitiva la dependencia de fixtures o mocks en tiempo de ejecución. 

El enlace de red, CORS, el proxy de Vite, los contratos HTTP REST, SSE y las reglas
de negocio de los **seis (6) módulos institucionales (M01 a M06)** operan de
manera sincronizada contra PostgreSQL 18 y almacenamiento S3 compatible SeaweedFS
4.17. La URL interna de S3 y la pública prefirmada están separadas para conservar
la validez SigV4 dentro y fuera de Docker.

### Métricas Consolidadas de Calidad y Verificación:
1. **Compilación y Tipado Estático:**
   - Backend (`tsc --noEmit`): **0 errores** (código de salida 0).
   - Frontend (`tsc --noEmit`): **0 errores** (código de salida 0).
2. **Suites de Pruebas Automatizadas:**
   - Backend Unitario (`npm run test:unit`): **535 pruebas aprobadas** (9 omitidas, 0 fallos).
   - Backend Adversarial (`adversarial_harness.ts` + `argon2_challenger`): **92 aserciones aprobadas**.
   - Subtotal Backend: **626 pruebas aprobadas (100%)**.
   - Frontend Unitario y Componentes (`npm test`): **424 pruebas aprobadas (100%)**.
   - **Gran Total Unitario + Adversarial:** **1,051 pruebas/aserciones aprobadas (0 fallos)**.
3. **Arnés de Smoke Test de Conmutación en Vivo (`npm run smoke:conmutation`):**
   - **33 de 33 aserciones empíricas aprobadas (100%)**.
   - Desmontaje limpio de sockets y cierre graceful en menos de 1.5 segundos.
4. **Empaquetado y Builds de Producción:**
   - Backend (`npm run build`): Artefacto ejecutable `backend/dist/src/server.js` generado limpiamente.
   - Frontend (`npm run build`): Bundle optimizado `frontend/dist/index.html` y assets generados exitosamente.
5. **Auditoría de Integridad:**
   - `npm audit`: backend completo **0 vulnerabilidades**; frontend producción **0 vulnerabilidades**.
   - PostgreSQL, Redis, S3, backend y frontend reportan **healthy**.

---

## 2. ARQUITECTURA DE RED Y CONMUTACIÓN (R1)

### 2.1 Políticas CORS Nativas en Express 5 (`backend/src/middleware/cors.middleware.ts`)
Se implementó un middleware nativo en TypeScript puro sin dependencias externas en `backend/package.json`:
- **Orígenes Permitidos:** `http://localhost:5173`, `http://127.0.0.1:5173` y evaluación dinámica en desarrollo.
- **Métodos Permitidos:** `GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD`.
- **Preflight `OPTIONS`:** Retorno determinista de código HTTP `204 No Content` sin cuerpo de respuesta.
- **Cabeceras Permitidas:** `Authorization`, `Content-Type`, `X-Correlation-ID`, `x-correlation-id`, `X-Usuario-ID`, `x-usuario-id`, `Accept`.
- **Cabeceras Expuestas:** `X-Correlation-ID`, `x-correlation-id`, `Date`.
  * *Justificación Normativa:* La exposición de la cabecera `Date` permite que el hook `useHorarioCorte.ts` en el cliente sincronice fehacientemente el reloj legal del Estado Peruano para el cómputo de corte administrativo a las **16:30 hrs** (TUO Ley N° 27444).

### 2.2 Proxy Inverso de Desarrollo en Vite 6 (`frontend/vite.config.ts`)
Se configuró la directiva `server.proxy`:
- Rutas con prefijo `/api` son redirigidas a `http://localhost:3000` con `changeOrigin: true` y `secure: false`.
- Permite la emisión de peticiones relativas directas desde la aplicación React eludiendo restricciones de puertos en navegadores.

### 2.3 Desacoplamiento Integral de Mocks en Runtime
- En `backend/src/server.ts`: Se corrigió el subproceso concurrente de Vite para transmitir por defecto `VITE_ENABLE_MOCKS: process.env.VITE_ENABLE_MOCKS ?? 'false'`.
- En `frontend/.env` y `frontend/.env.example`: Se definió `VITE_ENABLE_MOCKS=false` y `VITE_API_BASE_URL=http://localhost:3000/api/v1`.
- En `frontend/src/hooks/useTitulacionBackend.ts`: Se erradicó la condición bypass `|| env.isDevelopment`, asegurando que la conexión a la API permanezca activa en desarrollo.
- La pantalla académica dejó de mutar datos demo en producción: lista, detalle,
  requisitos y transiciones se leen/escriben en `sigd_doc.workflow_academico`
  mediante una API autenticada y transaccional.
- La matriz RBAC dejó de guardar únicamente en `localStorage`: carga
  `rol_sistema`/`rol_permiso` y escribe con autorización `ADMIN_USUARIOS`.

### 2.4 Sincronización de Variables de Entorno (`.env`)
- Se inyectó `AUTH_JWT_SECRET` institucional con 67 caracteres de entropía criptográfica, eliminando el fallo 500 en el inicio de sesión.
- Se eliminaron y resolvieron todos los marcadores de conflicto Git residuales en `backend/.env.example`.

---

## 3. MATRIZ DE SINCRONIZACIÓN FUNCIONAL DE LOS 6 MÓDULOS (R2)

### M01 — IdentiCore & Casilla Digital
1. **Autenticación y Sesiones:**
   - Login y Refresh Token con rotación RTR contra `sigd_auth.cuenta_usuario` y `sigd_auth.sesion_usuario`.
   - Persistencia reactiva en `localStorage` de `sigd_token`, `token`, `sigd_rol` y `sigd_permisos`.
2. **Registro de Administrados:**
   - Registro de personas naturales y jurídicas con soporte de casing dual (camelCase / snake_case).
   - Consulta de Ubigeo Ucayali en `ubigeoService.ts` adaptada a la estructura de provincias del backend.
3. **Casilla Electrónica y Acuse de Notificación:**
   - Bandeja unificada en `/api/v1/casilla/notificaciones` con soporte dual de parámetros de paginación (`pagina`/`porPagina` y `page`/`limit`) y envelope envolvente `{ notificaciones, data, meta }`.
   - Generación de acuse digital con sellado de tiempo ISO-8601 y hash criptográfico SHA-256.
   - **Inmutabilidad Legal (TUO Ley N° 27444 Art. 20):** Si un acuse ya ha sido emitido, la re-consulta devuelve de forma idempotente el registro original sin re-sellar el timestamp, preservando la fecha cierta del acto administrativo.

### M02 — TramiCore & Ventanilla Institucional
1. **Radicación Virtual:**
   - Asignación atómica del Código Único de Trámite (CUT) bajo formato canónico `EXP-YYYY-XXXXXX`.
   - Resolución de UUIDs de tipos de trámite TUPA reales desde `/api/v1/tramites/tipos` en `StepConfirmacion.tsx`.
2. **Ventanilla Presencial:**
   - Generación de cargo de recepción con hash WebCrypto SHA-256 e impresión térmica ESC/POS.
3. **Consulta Pública de Expedientes (Ley N° 29733):**
   - Implementación de la vista React `frontend/src/pages/tramite/ConsultaPublicaPage.tsx` bajo la ruta `/consulta/:cut`.
   - Consumo de `/api/v1/tramites/consulta-publica/:cut` con disociación y enmascaramiento de datos personales sensibles (LPDP).

### M03 — RutaDoc & Gestión de Expedientes
1. **Bandeja Unificada y Movimientos:**
   - Eliminación del bloqueo 401 mediante la inyección del middleware `jwtActorProvider` en `backend/src/app.ts`.
   - Soporte de rutas canónicas y alias de derivación (`/:id/derivar` y `/:id/movimientos/derivar`).
2. **Suspensión de Plazos SLA y Subsanaciones:**
   - Retorno explícito de `slaPaused: true` al asentar observaciones en `handlerObservar`.
   - Reanudación procesal del cómputo de plazos en `handlerSubsanar`.
3. **Endurecimiento Transaccional:**
   - Eliminación de la captura silenciosa de excepciones `.catch(() => {})`. Todas las operaciones de base de datos se ejecutan dentro de transacciones atómicas `BEGIN ... COMMIT` con rollback protegido y verificación de `rowCount`.

### M04 — DocuCore & Firma Digital
1. **Almacenamiento Desacoplado S3-compatible:**
   - Obtención de URLs prefirmadas en `/api/v1/storage/presigned-url` con soporte dual para `sha256Hash` y `checksumSha256`.
   - Invocación automática de confirmación a `/api/v1/storage/confirmar-carga` tras la subida exitosa a MinIO.
2. **Validación de Autenticidad CVD/QR:**
   - Compatibilidad dual de atributos `valido` y `esValido` con metadatos estructurados en `useCvdPublicVerification.ts` y `validadorCvd.controller.ts`.
3. **Pasarela Refirma Suite RENIEC:**
   - Soporte del esquema URI `refirma://` y autorización de hosts locales en `REFIRMA_HOSTS_PERMITIDOS`.
4. **Workflow Académico Persistente:**
   - Migración 14 con cuatro workflows y cinco etapas canónicas en PostgreSQL.
   - Bloqueo `FOR UPDATE`, transiciones FSM, requisitos obligatorios,
     observación/subsanación y generación SHA-256/CVD al resolver.

### M05 — OrganiCore & Estructura Organizacional
1. **Jerarquía Institucional y Usuarios:**
   - Soporte de unidades orgánicas mediante PostgreSQL `LTREE`.
   - Conexión del frontend a los endpoints reales de `/api/v1/admin/organigrama` y `/api/v1/admin/usuarios`.
2. **Calendario Laboral de Ucayali:**
   - Sincronización del calendario institucional y feriados regionales en `useCalendarioLaboral.ts`.

### M06 — CoreLink & Analítica Ejecutiva
1. **Streaming en Tiempo Real (SSE):**
   - Reutilización del singleton `BusSse` compartido entre el despachador Outbox, el puente de notificaciones de PostgreSQL y el servidor Express.
   - Ruta `/api/v1/realtime/stream` con cabeceras `text/event-stream` y autenticación vía Bearer JWT o query token.
2. **Indicadores MGD-PCM y Bitácora WORM:**
   - Consulta de indicadores VTEP, TPR, ICL y PEO.
   - Bitácora inmutable WORM en `sigd_audit.bitacora_auditoria`.

---

## 4. RESILIENCIA DE SESIONES Y MANEJO DE ERRORES RFC 7807/9457 (R3)

1. **Estandarización de Errores Problem Details:**
   - El middleware `backend/src/middleware/error-middleware.ts` emite simultáneamente propiedades en camelCase y snake_case:
     * `code` y `codigo`
     * `correlation_id` y `correlationId`
     * `invalid_params` y `invalidParams`
     * `timestamp` en formato ISO-8601
2. **Ciclo de Vida de Sesión y Expiración 401:**
   - En `frontend/src/stores/authStore.ts`, el cierre de sesión (`logout`) y las respuestas 401 de Axios limpian de manera exhaustiva todas las credenciales en `localStorage` y ejecutan una redirección limpia hacia `/login`.
3. **Empaquetado de Producción:**
   - Se corrigieron los puntos de entrada `main` y `start` en `backend/package.json` para apuntar a `dist/src/server.js`.
   - En `backend/src/db/migrate.ts`, se implementó una resolución dual de rutas que soporta tanto la ejecución en desarrollo como el entorno empaquetado `dist/`.
4. **Subsanación de Tipado Estricto en Express 5 (Iteración 3):**
   - En `backend/src/domains/rutadoc/derivaciones.controller.ts`, se estrechó de forma determinista `req.params.id` hacia `string` (`String(req.params.id)`) en todos los controladores (`handlerDerivar`, `atender`, `archivar`, `acumular`, `observar`, `subsanar`).
   - Resultado: Eliminación del 100% de errores `TS2345: Argument of type 'string | string[]' is not assignable to parameter of type 'string'`, garantizando `tsc --noEmit` con 0 errores y compilación `npm run build` con código de salida 0.

---

## 5. RESULTADOS DE LA CERTIFICACIÓN DE PRUEBAS (R4)

| Categoría | Suite / Script | Pruebas Ejecutadas | Resultado | Tasa de Éxito |
|---|---|---|---|---|
| **Backend Unit** | `vitest run` (`backend/tests/unit`) | 535 | **535 PASS** (9 skipped) | **100%** |
| **Backend Adversarial** | `adversarial_harness.ts` | 64 | **64 PASS** | **100%** |
| **Backend Security** | `argon2_challenger_m1_it2.ts` | 28 | **28 PASS** | **100%** |
| **Frontend Unit & Component** | `vitest run` (`frontend/src`) | 424 | **424 PASS** | **100%** |
| **Unitarias + Adversariales** | **Suites Consolidadas** | **1,051** | **1,051 PASS** | **100%** |
| **Smoke Test Conmutación** | `smoke_conmutation_test.ts` | 33 | **33 PASS** | **100%** |
| **Compilación Backend** | `tsc --noEmit` (backend) | N/A | **0 ERRORES** | **100%** |
| **Compilación Frontend** | `tsc --noEmit` (frontend) | N/A | **0 ERRORES** | **100%** |
| **Build Backend** | `npm run build` (backend) | `dist/src/server.js` | **EXITOSO** | **100%** |
| **Build Frontend** | `npm run build` (frontend) | `dist/index.html` | **EXITOSO** | **100%** |

---

## 6. DICTAMEN DE CONFORMIDAD INSTITUCIONAL

Se emite la **CERTIFICACIÓN FORMAL DE SINCRONIZACIÓN Y CONMUTACIÓN FULLSTACK 100%** para el Sistema Integral de Gestión Documentaria (SIGD) del IESTP "Suiza". 

El sistema local se encuentra física, arquitectónica y operativamente enlazado,
con rutas productivas configuradas con `VITE_ENABLE_MOCKS=false`, políticas de
red, persistencia y transacciones verificadas. La última ejecución Docker en
Microsoft Edge creó `EXP-2026-000003` y validó PDF S3, consulta, trazabilidad,
descarga, reportes y workflow académico sin errores JavaScript.

### Límite explícito de la certificación

La certificación cubre el sistema local y sus adaptadores. La firma oficial con
certificados ReFirma/RENIEC, consultas RENIEC/SUNAT/SUNARP, SMTP y servicios de
terceros requieren credenciales, certificados y endpoints institucionales. No se
declara certificación externa hasta disponer de esos insumos; esta salvedad evita
confundir un adaptador operativo con una integración oficial autorizada.
