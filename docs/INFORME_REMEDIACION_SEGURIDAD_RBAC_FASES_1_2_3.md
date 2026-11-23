# INFORME TÉCNICO: REMEDIACIÓN DE ROLES, PERMISOS Y SEGURIDAD RBAC / ABAC (FASES 1, 2 Y 3)
**Sistema Integrado de Gestión Documental — IESTP Suiza 2026**  
**Fecha:** 27 de Octubre de 2026  
**Rama:** `B_JACOBO` | **Commit Base:** `bf30d8a0c85e266a86381fb10bf3740a8451c032`  
**Autor:** Especialista Full Stack / Arquitectura de Software y QA  

---

## 1. RESUMEN EJECUTIVO

El presente informe documenta la verificación, implementación y validación técnica integral del blindaje de seguridad, autenticación y autorización por roles/área (RBAC / ABAC) en el prototipo **SIGD IESTP Suiza 2026**.

Siguiendo el principio de mínima intervención arquitectónica y preservación estricta del entorno:
1. **Cero modificaciones en Base de Datos:** No se ejecutó ningún DDL ni DML en `sigd_jacobo_demo` ni en `sigd_prueba`. Los conteos de expedientes (`10`), asientos (`9`) y secuencias se mantuvieron estrictamente inalterados.
2. **Preservación de 149 archivos preexistentes:** Se mantuvieron todos los avances previos de los 9 módulos, la remediación TUPA, la foliación múltiple y la Mesa de Partes Virtual.
3. **Cierre de Brechas Críticas de Autorización:**
   - **DocuCore (Proyección de Resoluciones):** Se incorporó `resolverIdentidad` y `autorizarOperadorResolucion` en `resoluciones.controller.ts`, exigiendo autenticación válida y facultades normativas (`ADMINISTRADOR`, `DIRECTOR` o permisos de área acordes al expediente).
   - **Archivo Central (Foliación Documental):** Se blindó `POST /v1/expedientes/:id/foliar-documento` en `docucore.router.ts`, requiriendo credenciales institucionales y roles autorizados (`ADMINISTRADOR`, `DIRECTOR`, `MESA_PARTES`, `SECRETARIO`, `ESPECIALISTA` con competencia en el área).
   - **Storage (Descarga de Adjuntos):** Se corrigió la consulta de autorización en `storage.router.ts` para que los operadores de área legítimos puedan descargar anexos de expedientes pertenecientes a su unidad orgánica.
   - **RutaDoc (Reversión de Actuaciones):** Se amplió `esIdentificadorActorValido` en `rutadoc.reversion.service.ts` para aceptar identificadores canónicos UUID (`claims.sub`), además de IDs numéricos para retrocompatibilidad, y se activó la política institucional en `rutadoc.router.ts`.
   - **Frontend (Rutas Protegidas y Tipos Canónicos):** Se blindaron las rutas sensibles (`/expedientes`, `/expedientes/:id`, `/flujos/...`, `/reportes`) con `<ProtectedRoute>`, se eliminó la ruta duplicada sin protección de `/administracion/seguridad` y se alineó `RolCanonicoId` con los 6 roles canónicos de PostgreSQL (`ADMINISTRADOR`, `DIRECTOR`, `SECRETARIO`, `ESPECIALISTA`, `MESA_PARTES`, `CIUDADANO`).
4. **Validación y Compilación Limpias:**
   - Backend Typecheck: **0 errores**.
   - Frontend Typecheck & Build: **0 errores** (build de producción generado en 6.55s).
   - Regresión de Mesa de Partes y TUPA: **100% verde** (`TramiteWizard`: 46 tests pasados; `radicacion-tupa-ddl`: 45 tests pasados).

---

## 2. MATRIZ DE HALLAZGOS Y REMEDIACIONES IMPLEMENTADAS

| ID | Módulo | Componente Afectado | Estado Inicial (Vulnerabilidad) | Corrección Aplicada | Prueba Automatizada Asociada | Estado Final |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **V-01** | DocuCore | `resoluciones.controller.ts` | Peticiones anónimas o sin credenciales podían proyectar y modificar borradores de resoluciones directorales institucionales. | Inyección de `resolverIdentidad` y `autorizarOperadorResolucion`. Valida token Bearer, cuenta activa en BD, roles directivos o coincidencia de área del expediente. | `tests/unit/domains/docucore/resoluciones.spec.ts` (10/10) | **REMEDIADO** |
| **V-02** | Archivo Central | `docucore.router.ts` | `POST /v1/expedientes/:id/foliar-documento` no validaba autenticación JWT ni competencia del operador sobre el expediente. | Inyección de guardia con `resolverIdentidad` y validación de competencia administrativa o de área sobre el expediente. Rechazo 401 si no hay token y 403 si es rol `CIUDADANO` o sin facultades. | `tests/unit/domains/docucore/docucore.router.adversarial.spec.ts` (12/12) | **REMEDIADO** |
| **V-03** | Storage | `storage.router.ts` | `autorizarDocumento` exigía `ur.area_id IS NULL`, bloqueando la descarga de adjuntos a especialistas legítimos asignados a unidades orgánicas. | Inclusión de cláusula con `estado_actual_expediente` y `asiento_registro` para validar competencia en el área actual del expediente. | `tests/unit/s3-storage.spec.ts` (7/7) | **REMEDIADO** |
| **V-04** | RutaDoc | `rutadoc.reversion.service.ts` y `rutadoc.router.ts` | `esIdNumericoPositivo(actor.id)` rechazaba el UUID del token (`claims.sub`), impidiendo la reversión a administradores con error 401. Además, el router no inyectaba política por defecto. | Función `esIdentificadorActorValido` soporta UUID y string numérico. Se inyectó `politicaReversionPredeterminada(pool)` en el router. | `tests/unit/domains/rutadoc/reversion.spec.ts` (19/19) | **REMEDIADO** |
| **V-05** | Frontend Router | `AppRouter.tsx` | Rutas de expedientes y flujos de proyector/firma/validez se cargaban sin `ProtectedRoute`. Ruta duplicada `/administracion/seguridad` sin guardia. | Envoltura de `/expedientes`, `/expedientes/:id`, `/flujos/...` con `<ProtectedRoute>`. Protección estricta de `/flujo-validez-legal/firma` con `requiredRoles={["DIRECTOR", "ADMINISTRADOR"]}`. Eliminación de ruta raíz desprotegida. | `tests/unit/routes/ventanillaRoutes.test.tsx` (24/24), `tests/unit/pages/ProyectorResolucionesIsolation.test.tsx` (17/17) | **REMEDIADO** |
| **V-06** | Frontend RBAC | `rbacRoles.ts` | Discrepancia nominal entre PostgreSQL (6 roles canónicos) y frontend (`SUPER_ADMIN`, `DOCENTE`, `ESTUDIANTE`). | Ampliación de `RolCanonicoId` incluyendo `ADMINISTRADOR`, `DIRECTOR`, `SECRETARIO`, `ESPECIALISTA`, `MESA_PARTES`, `CIUDADANO` preservando aliases de interfaz. | `tests/unit/hooks/rbacRolesCanonicos.test.ts` (4/4), Frontend Typecheck (0 errores) | **REMEDIADO** |
| **V-07** | Frontend Asistente | `StepDocumentos.tsx` | Falta de propiedad `tipos_documentales` en interfaz `TipoTramiteFormal`, produciendo fallos de compilación TS en catálogo TUPA. | Declaración de `TipoDocumentalFormal` e incorporación en `TipoTramiteFormal` con parseo defensivo. | Frontend Typecheck (0 errores), `TramiteWizard.test.tsx` (46/46) | **REMEDIADO** |

---

## 3. ARCHIVOS EXACTOS MODIFICADOS EN ESTA EJECUCIÓN

| N° | Componente | Ruta del Archivo | Tipo de Cambio |
| :---: | :---: | :---: | :---: |
| 1 | Backend | `backend/src/domains/rutadoc/rutadoc.reversion.service.ts` | Soporte de UUID en validación de identidad del actor de reversión |
| 2 | Backend | `backend/src/domains/rutadoc/rutadoc.router.ts` | Inyección de política predeterminada de reversión y tipado estricto |
| 3 | Backend Tests | `backend/tests/unit/domains/rutadoc/reversion.spec.ts` | Casos de prueba para UUID de actor y rechazo de identificador inválido |
| 4 | Backend | `backend/src/domains/docucore/resoluciones.controller.ts` | Guardias de autenticación y autorización por rol/área en proyector |
| 5 | Backend Tests | `backend/tests/unit/domains/docucore/resoluciones.spec.ts` | Pruebas de denegación 401 anónimo y 403 ciudadano en resoluciones |
| 6 | Backend | `backend/src/domains/docucore/docucore.router.ts` | Guardias de autenticación y rol administrativo en foliación de expediente |
| 7 | Backend Tests | `backend/tests/unit/domains/docucore/docucore.router.adversarial.spec.ts` | Pruebas de rechazo 401/403 y compatibilidad de foliación continua |
| 8 | Backend | `backend/src/core/storage/storage.router.ts` | Autorización por área efectiva del expediente para operadores de área |
| 9 | Frontend | `frontend/src/routes/AppRouter.tsx` | Envoltura con ProtectedRoute de rutas sensibles y eliminación de ruta insegura |
| 10 | Frontend | `frontend/src/types/rbacRoles.ts` | Alineación de roles canónicos institucionales con PostgreSQL |
| 11 | Frontend | `frontend/src/components/tramite/WizardSteps/StepDocumentos.tsx` | Tipado de tipos documentales clasificados en catálogo formal TUPA |

---

## 4. RESULTADOS DE PRUEBAS Y COMPILACIÓN

### 4.1. Backend
- **Typecheck (`tsc --noEmit`):**
  - Resultado: **EXIT CODE 0 (Sin errores)**.
- **Pruebas Unitarias de Seguridad y Dominios Modificados:**
  - `tests/unit/s3-storage.spec.ts`: **7/7 pasados**.
  - `tests/unit/domains/rutadoc/reversion.spec.ts`: **19/19 pasados**.
  - `tests/unit/domains/docucore/resoluciones.spec.ts`: **10/10 pasados**.
  - `tests/unit/domains/docucore/docucore.router.adversarial.spec.ts`: **12/12 pasados**.
  - `tests/unit/auth-rbac-persistido.spec.ts`: **19/19 pasados**.
  - `tests/unit/domains/rutadoc/area-efectiva-rbac.spec.ts`: **7/7 pasados**.
  - `tests/unit/domains/tramicore/radicacion-tupa-ddl.spec.ts`: **45/45 pasados**.
  - Total pruebas ejecutadas en la suite directa: **119 pasados, 0 fallados**.

### 4.2. Frontend
- **Typecheck (`tsc --noEmit`):**
  - Resultado: **EXIT CODE 0 (Sin errores)**.
- **Build de Producción (`vite build`):**
  - Resultado: **EXIT CODE 0 (Compilado en 6.55s sin advertencias críticas)**.
  - Artefactos: `dist/index.html`, `dist/assets/index-C3A1BYyy.css`, `dist/assets/index-fAqT2GJj.js`.
- **Pruebas de Componentes y Páginas Afectadas:**
  - `tests/unit/routes/ventanillaRoutes.test.tsx`: **24/24 pasados**.
  - `tests/unit/routes/usuariosAdminRoutes.test.tsx`: **6/6 pasados**.
  - `tests/unit/pages/BandejaExpedientesPage.test.tsx`: **35/35 pasados**.
  - `tests/unit/pages/ProyectorResolucionesIsolation.test.tsx`: **17/17 pasados**.
  - `tests/unit/pages/PasarelaFirmaPage.test.tsx`: **24/24 pasados**.
  - `tests/unit/pages/ValidadorCvdBackend.test.tsx`: **11/11 pasados**.
  - `tests/integration/m1/casillaElectronica.test.tsx`: **22/22 pasados**.
  - `tests/unit/components/TramiteWizard.test.tsx`: **46 pasados, 1 saltado (47 total)**.

---

## 5. ESTADO DE MESA DE PARTES Y TUPA TRAS LA REGRESIÓN

La verificación de no-regresión confirmó la integridad total de la Mesa de Partes Virtual y el catálogo TUPA:
1. **Catálogo TUPA Suiza 2026:** Los 19 procedimientos vigentes continúan plenamente disponibles y radicables.
2. **Requisitos y Validación en Cascada:**
   - TramiteWizard valida DNI (8 dígitos), selección de procedimiento TUPA, obligatoriedad de términos LPAG y adjuntos documentales.
   - Manejo de fallos con degradación controlada: ante 401 o 403, el asistente conserva el borrador en memoria y no emite cargos apócrifos.
3. **Persistencia y Aislamiento:** Cero consumo anticipado de secuencias CUT ni generación de expedientes durante las pruebas automatizadas.

---

## 6. ESTADO DE GIT Y PRESERVACIÓN DEL PROYECTO

- **Rama Activa:** `B_JACOBO`
- **Commit HEAD:** `bf30d8a0c85e266a86381fb10bf3740a8451c032`
- **Cambios preexistentes:** Preservados íntegramente (149 archivos rastreados).
- **Archivos nuevos en esta tarea:** 11 archivos tocados con correcciones quirúrgicas mínimas.
- **Acciones destructivas ejecutadas:** **0**. No se realizó `git reset`, `git checkout`, `git clean` ni commit.

---

## 7. RIESGOS PENDIENTES Y RECOMENDACIONES DE TRANSICIÓN

1. **Esquema DDL de Resoluciones (`sigd_doc.resolucion`):**
   - Aunque el controlador `resoluciones.controller.ts` está blindado con 401/403, cuando un usuario administrativo autorizado intenta proyectar una resolución, el servicio `resoluciones.service.ts` activa el mecanismo de detección defensiva *Fail-Closed* retornando HTTP 503 (`DESPACHO_MODELO_NO_COMPATIBLE`) debido a que la tabla institucional `sigd_doc.resolucion` aún no existe en el esquema DDL oficial.
   - *Recomendación:* Mantener el comportamiento Fail-Closed hasta que una migración oficial aprobada incorpore la tabla de resoluciones.
2. **Firma Digital ReFirma Local:**
   - La invocación a la pasarela de firma requiere el conector local ReFirma (`PC_JACOBO`). Las pruebas unitarias confirman la protección del endpoint con rol `DIRECTOR`/`ADMINISTRADOR`, pero el despacho en producción dependerá de la instalación del certificado digital en la estación del firmante.
3. **Sincronización de Sesión Frontend en Storage:**
   - Las URLs pre-firmadas emitidas para subida S3/MinIO se ajustan dinámicamente entre loopback (`127.0.0.1`) y la red Docker interna (`minio`). La verificación criptográfica del hash SHA-256 en backend protege la integridad del documento antes de persistir el registro.

---

## 8. CONFIRMACIÓN FINAL DE INTEGRIDAD DE BASE DE DATOS

- **Base de Datos `sigd_jacobo_demo` (Puerto 5433):**
  - Total expedientes: `10` (Idéntico al valor previo).
  - Total asientos: `9` (Idéntico al valor previo).
  - Último valor secuencia `seq_asiento_numero_registro`: `10009` (Cero avances).
- **Base de Datos `sigd_prueba` (Puerto 5433):**
  - Total expedientes: `2` (Prístina, cero lecturas/escrituras en la tarea).
- **Contenedores Docker:**
  - `sigd-postgres-1` (5433): Saludable (Up).
  - `sigd-redis-1` (6379): Saludable (Up).
  - `sigd-minio-1` (9000/9001): Saludable (Up).
