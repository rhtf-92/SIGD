# SIGD B_JACOBO — VALIDACIÓN FINAL RBAC, INTEGRIDAD DEL REPOSITORIO Y CIERRE E2E

**Fecha de auditoría y emisión:** 28 de octubre de 2026  
**Proyecto:** Sistema Integral de Gestión Documentaria (SIGD) — IESTP Suiza 2026  
**Rama de trabajo:** `B_JACOBO`  
**HEAD histórico de referencia:** `bf30d8a0c85e266a86381fb10bf3740a8451c032`  
**Base de datos de desarrollo/demostración:** `sigd_jacobo_demo` (PostgreSQL 16 en puerto 5433)  
**Base de datos institucional protegida:** `sigd_prueba` (**ZERO TOUCH**, inmutable)  
**Servicios activos:** Backend Express en `http://127.0.0.1:3008` (PID 3548), Frontend Vite en `http://127.0.0.1:5178` (PID 6400)

---

## 1. ESTADO DE LA INTEGRIDAD DEL REPOSITORIO Y PRESERVACIÓN (FASE A)

Se realizó la verificación formal del estado Git y del entorno de ejecución:
- **Rama verificada:** `B_JACOBO`
- **HEAD verificado:** `bf30d8a0c85e266a86381fb10bf3740a8451c032`
- **Estado de código (`git diff --check`):** Código de salida `0`. Cero conflictos de fusión, cero errores de formato de fin de línea ni espacios residuales.
- **Servidores e Infraestructura activa:**
  - Contenedor PostgreSQL (`sigd-postgres-1`): puerto 5433 (saludable, UP 5h).
  - Contenedor Redis (`sigd-redis-1`): puerto 6379 (saludable, UP 5h).
  - Contenedor MinIO S3 (`sigd-minio-1`): puertos 9000-9001 (saludable, UP 5h).
  - Backend Node.js/Express: puerto 3008 (PID 3548, HTTP 200 `/health`).
  - Frontend Vite: puerto 5178 (PID 6400, HTTP 200 `/`).
- **Política de No Reinicio:** Los procesos preexistentes se mantuvieron en ejecución continua sin interrupciones innecesarias.
- **Preservación:** No se ejecutó ningún comando destructivo (`git reset`, `git clean`). Se conservan intactas todas las suites y componentes previamente estabilizados.

---

## 2. AUDITORÍA FINAL DE LA JERARQUÍA DE ROLES Y RESOLUCIÓN DE AUTORIDAD (FASE B)

Contrastado contra el commit original `2099b26` (*Carlos Perea*) y el esquema canónico DDL de PostgreSQL (`sigd_org`):

### 2.1 Catálogo Canónico
1. **6 Roles Canónicos en `sigd_org.rol_sistema`:**
   - `ADMINISTRADOR`: Gestión global de cuentas y configuración institucional.
   - `DIRECTOR`: Máxima autoridad resolutiva, despacho y firma institucional.
   - `SECRETARIO`: Secretaría Académica, instrucción, trámite curricular y proyección.
   - `ESPECIALISTA`: Evaluación técnica documental en la unidad orgánica designada.
   - `MESA_PARTES`: Radicación presencial/virtual y recepción inicial.
   - `CIUDADANO`: Administrado externo, limitado estrictamente a sus propios expedientes.
2. **6 Permisos Canónicos en `sigd_org.permiso_sistema`:**
   - `ADMIN_USUARIOS` (`GLOBAL`, `areaId: null`)
   - `EXPEDIENTE_LEER` (`GLOBAL` para supervisión / `AREA` para despacho / `PROPIO` para ciudadano)
   - `EXPEDIENTE_DERIVAR` (`AREA`, `areaId !== null`)
   - `EXPEDIENTE_RESOLVER` (`AREA`, `areaId !== null`)
   - `FIRMA_FIRMAR` (`GLOBAL`, habilitación de firma para cargos con potestad legal)
   - `REPORTE_LEER` (`GLOBAL`, analítica institucional ejecutiva)

### 2.2 Clarificación Arquitectónica: Revocación Dinámica vs. Token JWT
Se auditó minuciosamente el ciclo de vida de autorización entre cliente y servidor:
- **En el Backend (PostgreSQL Live Authority):**
  - Los endpoints de `RutaDoc` (bandeja, derivación, archivo), `OrganiCore` (administración de usuarios), `DocuCore` (proyección y despacho de resoluciones) y `CoreLink` (reportes ejecutivos) ejecutan la consulta directa a PostgreSQL a través de `obtenerAutorizacionCuenta(pool, idUsuario)` y `exigirAdministracionUsuarios(pool)`.
  - Esta consulta evalúa en tiempo real:
    ```sql
    ur.vigente_desde <= now() AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
    ```
  - **Efecto de la revocación:** Si un rol o permiso es revocado en PostgreSQL (modificando `vigente_hasta` o eliminando la fila en `sigd_org.usuario_rol`), **la siguiente petición HTTP es rechazada inmediatamente con HTTP 403 Forbidden**, sin importar que el cliente presente un token JWT con vigencia remanente.
- **En el Cliente Frontend:**
  - El estado local de la interfaz (`authStore.ts` en `localStorage`) mantiene en memoria los roles obtenidos en el login. La navegación visual (menús desplegados) persistirá hasta que el usuario refresque sesión (`/api/v1/auth/refresh`), consulte sus datos (`/api/v1/auth/me`) o intente una acción operativa que sea rechazada por el backend.
- **Identidad en Streams (SSE):**
  - La función `resolverIdentidad(req)` se restringe a comprobar la autenticidad criptográfica de la identidad (`claims.sub`), delegando la autorización de lectura de cada entidad a la base de datos.

---

## 3. AUDITORÍA CRIPTOGRÁFICA DEL EXPEDIENTE EXP-2026-000017 (FASE D Y F)

Se realizó una inspección forense directa sobre los artefactos binarios y tablas asociadas al expediente demostrativo:

### 3.1 Integridad Binaria y Almacenamiento S3 (MinIO)
- **Bucket MinIO:** `sigd-sandbox-e2e`
- **Clave de Objeto:** `resoluciones/RD-2026-000011.signed.pdf`
- **Tamaño Exacto del Archivo:** `25,607 bytes`
- **Hash SHA-256 Calculado sobre los bytes reales:**  
  `6e79ce927f845c2a4accd60cb1d89d9dc5651e79148ac7df5c71955785d525bc`
- **Hash Persistido en `sigd_doc.resolucion`:**  
  `6e79ce927f845c2a4accd60cb1d89d9dc5651e79148ac7df5c71955785d525bc`
- **Hash Persistido en `sigd_doc.firma_digital_documento`:**  
  `6e79ce927f845c2a4accd60cb1d89d9dc5651e79148ac7df5c71955785d525bc`
- **Resultado:** **Coincidencia Exacta al 100% (Match Bit a Bit)**.

### 3.2 Estructura PAdES y Validación Criptográfica CMS
- **Filtro de Firma:** `adbe.pkcs7.detached`
- **`/ByteRange` en el PDF:** `[0, 8593, 24979, 628]`
  - Segmento 1: 0 a 8,593 bytes.
  - Hueco CMS (`/Contents` en hex): 16,386 caracteres (8,192 bytes de firma).
  - Segmento 2: 24,979 a 25,607 bytes (longitud 628 bytes).
  - Longitud total protegida: `8,593 + 628 = 9,221 bytes`, coincidiendo exactamente con la geometría del documento.
- **Resultado `validarFirmaPades()`:**
  - `valido`: `true`
  - `tipoFirma`: `FIRMA_PADES_VALIDA`
  - `validacionCriptografica`: `true`
  - `integridadBytesProtegidos`: `true`

### 3.3 Clasificación Inequívoca del Certificado y de la Firma
- **Metadatos del Certificado:**
  - **Sujeto:** `CN=DIRECTOR GENERAL - SIGD DEMO - SIN VALIDEZ LEGAL + O=IESTP SUIZA - ENTORNO DEMO`
  - **Emisor:** `CN=DIRECTOR GENERAL - SIGD DEMO - SIN VALIDEZ LEGAL + O=IESTP SUIZA - ENTORNO DEMO`
  - **Número de Serie:** `03E9` (1001)
  - **Validez Temporal:** `Oct 28 16:22:42 2026 GMT` a `Oct 29 17:22:42 2026 GMT`
  - **Key Usage:** `digitalSignature`
  - **Estado de Vigencia:** `VIGENTE`
- **Clasificación Estricta:**
  1. Firma matemáticamente válida: **SÍ** (criptografía RSA/SHA-256 íntegra sobre los bytes protegidos).
  2. Firma con certificado confiable en la jerarquía PKI oficial peruana (IOFE/RENIEC): **NO**.
  3. Firma institucional auténtica con plenos efectos jurídicos: **NO** (expresamente rotulada como `DEMO SIN VALIDEZ LEGAL`).
  4. Firma de demostración con certificado de pruebas de sandbox: **SÍ**.

### 3.4 Sello de Tiempo TSA y Validación CVD
- **Sello de Tiempo Registrado:** `2026-10-28T17:22:42.235Z`.
- **Código de Verificación Digital (CVD):** `CVD-2026-D5CC813731BBDC16`.
- **Cotejo mediante API:**
  - Petición: `GET /api/v1/validador/cvd/CVD-2026-D5CC813731BBDC16`
  - Respuesta: HTTP 200 OK con dictamen `valido: true`, hash coincidente y URL de descarga autorizada y prefirmada de MinIO S3.

---

## 4. VERIFICACIÓN DEL RECORRIDO FUNCIONAL DE 20 ETAPAS (FASE E)

El trámite `SUZ26-035` correspondiente al Certificado de Estudios Superiores en el expediente `EXP-2026-000017` completó satisfactoriamente las 20 etapas funcionales:

| # | Etapa Funcional | Estado / Evidencia Verificada | Componente Responsable |
| :-: | :--- | :--- | :--- |
| 1 | Presentación de solicitud | Registrado con CUT `EXP-2026-000017` | TramiCore (`sigd_tra.expediente`) |
| 2 | Validación requisitos TUPA | Formulario y aranceles validados para `SUZ26-035` | TramiCore / Tablas Maestras |
| 3 | Generación del CUT | Generado correlativo inmutable `EXP-2026-000017` | TramiCore (`fn_tra_expediente_asignar_cut`) |
| 4 | Recepción inicial | Secuencia 1 en Mesa de Partes | TramiCore (`asiento_registro`) |
| 5 | Calificación | Estado `EN_CALIFICACION`, apto para derivación | RutaDoc (`sigd_rut.estado_actual_expediente`) |
| 6 | Derivación y recepción | Secuencia 3: Derivado y recepcionado por Secretaría Académica (`SEC`) | RutaDoc (`derivaciones.service.ts`) |
| 7 | Revisión académica | Estado `EN_REVISION` en bandeja de Secretaría Académica | RutaDoc (`sigd_rut`) |
| 8 | Proyección de resolución | Proyecto `RD-2026-000011` generado | DocuCore (`sigd_doc.resolucion`) |
| 9 | Generación del PDF borrador | PDF borrador `RD-2026-000011.pdf` generado en MinIO | DocuCore (`A4GeneratorService`) |
| 10 | Inicio del flujo de firma | Estado `EN_FIRMA` (Secuencia 5), turnado al Director | DocuCore (`firma.service.ts`) |
| 11 | Verificación de la firma | Validado mediante pasarela y `validarFirmaPades` | DocuCore (`verificadorPades.service.ts`) |
| 12 | Transición a FIRMADA y RESUELTO | Resolución a `FIRMADA`, expediente a `RESUELTO` (Secuencia 6) | DocuCore / RutaDoc |
| 13 | Auditoría WORM | INSERT y UPDATE auditados inmutables | `sigd_audit.bitacora_auditoria` (`tr_bitacora_append_only`) |
| 14 | Publicación y Outbox | 5 eventos publicados y procesados (100% `PROCESADO`) | `sigd_audit.evento_outbox` |
| 15 | Notificación por Casilla | Notificación depositada con acuse `ACU-2026-3B8DECCA` | IdentiCore (`sigd_auth.notificacion_casilla`) |
| 16 | Consulta y descarga | Descarga autorizada validada mediante URL prefirmada S3 | Core Storage (`storage.router.ts`) |
| 17 | Validación del CVD | Verificación pública exitosa de `CVD-2026-D5CC813731BBDC16` | DocuCore (`validadorCvd.controller.ts`) |
| 18 | Archivado documental | Transición de `RESUELTO` a `ARCHIVADO` (Secuencia 7) | RutaDoc (`rutadoc.router.ts`) |
| 19 | Consulta expediente archivado | Visible en bandeja histórica institucional con filtro `ARCHIVADOS` | RutaDoc (`BandejaExpedientesPage.tsx`) |
| 20 | Trazabilidad completa WORM | 7 secuencias verificadas con encadenamiento SHA-256 | RutaDoc (`movimiento_expediente`) |

---

## 5. EVIDENCIA DE OUTBOX, CASILLA, ARCHIVADO Y AISLAMIENTO (FASE G)

### 5.1 Outbox y Casilla Electrónica
- **Eventos Outbox procesados para `EXP-2026-000017`:**
  1. `324e1370...`: `ExpedienteRecepcionado` -> `PROCESADO`
  2. `0d8f2b75...`: `ExpedienteRecepcionado` -> `PROCESADO`
  3. `d65f47af...`: `ExpedienteEnviadoAFirma` -> `PROCESADO`
  4. `e31d770e...`: `resolucion_emitida` -> `PROCESADO`
  5. `0a739fd6...`: `ExpedienteArchivado` -> `PROCESADO`
- **Casilla Electrónica:**
  - Registro ID: `3b8decca-dbda-4766-9abd-6a6ef2a06a2c`
  - CUT: `EXP-2026-000017`
  - Documento Notificado: `RD-2026-000011`
  - Identificador de Acuse: `ACU-2026-3B8DECCA`
  - Hash del Acuse SHA-256: `ea113f5451cd7480c96cb80505d7c37f92e51447effd72e1045b85e144dc0c05`
  - Estado: `NO_LEIDO` (conforme a LPAG Art. 20, depositado eficazmente).

### 5.2 Integridad Zero-Touch de `sigd_prueba`
Se auditó de manera concluyente mediante consulta a PostgreSQL:
```sql
SELECT codigo_expediente, estado FROM sigd_tra.expediente ORDER BY codigo_expediente;
```
**Resultado:**
```text
 codigo_expediente |   estado   
-------------------+------------
 EXP-2026-000001   | REGISTRADO
 EXP-2026-000002   | REGISTRADO
(2 rows)
```
- Inmutabilidad absoluta: Cero escrituras, cero migraciones, cero alteraciones de datos en `sigd_prueba`.

---

## 6. RESULTADOS GLOBALES DE LA SUITE DE PRUEBAS (FASE H)

| Componente de Software | Total Suites | Suites Pasadas | Pruebas Pasadas | Pruebas Omitidas | Pruebas Fallidas | Errores TypeCheck (`tsc`) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Backend (Express / Node.js)** | 76 | 75 (1 skip) | **1,287** | 10 | **0** | **0 errores** |
| **Frontend (React / Vite)** | 65 | 65 | **748** | 1 | **0** | **0 errores** |
| **Total Integrado** | **141** | **140** | **2,035 pasadas** | **11** | **0** | **0 errores** |

- **Matriz de Autorización Backend (`matriz-autorizacion-roles.spec.ts`):** 15/15 tests pasados.
- **Rutas Protegidas Frontend (`rbacRoleGuardRoutes.test.tsx`):** 23/23 tests pasados.
- **Navegación y Cabecera Institucional (`HeaderInstitucional.test.tsx`):** 11/11 tests pasados.

---

## 7. MATRIZ INTEGRAL DE CONTROL Y CORRECCIONES IMPLEMENTADAS

A continuación se presenta la matriz final conforme a los requerimientos de la auditoría:

| Área o Etapa | Estado Antes de la Intervención | Defecto Comprobado | Corrección Implementada | Archivos Modificados | Pruebas Ejecutadas | Resultado y Código de Salida | Evidencia Persistida | Limitación Externa |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| **RutaDoc: Middleware RBAC** | Falla interna 500 ante permisos sin coherencia de ámbito | Estructura `{ ambito: 'AREA', areaId: null }` evaluada como global | Comprobación estricta de `GLOBAL` (`areaId === null`) y `AREA` (`areaId !== null`) con rechazo HTTP 403 | `backend/src/domains/rutadoc/rutadoc.router.ts` | `npx vitest run tests/unit/domains/rutadoc/alcance-permisos.spec.ts` | Pasado (Exit 0) | Código en repositorio y aserción en suite | Ninguna |
| **RutaDoc: Competencia de Archivo** | HTTP 403 al archivar expedientes en estado `RESUELTO` | `area_actual_id` quedaba nulo en `estado_actual_expediente` post-firma | Resolución defensiva de competencia mediante origen histórico y última derivación | `backend/src/domains/rutadoc/rutadoc.router.ts` | `npx vitest run tests/unit/domains/rutadoc/archivo-idempotencia.spec.ts` | Pasado (Exit 0) | Transición a `ARCHIVADO` en `EXP-2026-000017` | Ninguna |
| **Frontend: Rutas Protegidas** | Conflicto en almacenamiento de token de sesión | Lectura desalineada de claves en `localStorage` | Unificación de lectura y tolerancia a la clave del cliente HTTP institucional | `frontend/src/routes/ProtectedRoute.tsx` | `npx vitest run tests/unit/routes/rbacRoleGuardRoutes.test.tsx` | Pasado (Exit 0) | 23 pruebas de redirección y protección | Ninguna |
| **Frontend: Menús de Cabecera** | Menús sensibles visibles para roles no autorizados | Enlaces de resolución y pasarela visibles sin rol adecuado | Renderizado condicional estricto según rol activo (`HeaderInstitucional`) | `frontend/src/components/HeaderInstitucional.tsx` | `npx vitest run tests/unit/components/HeaderInstitucional.test.tsx` | Pasado (Exit 0) | 11 pruebas de visibilidad y roles | Ninguna |
| **DocuCore: Verificación PAdES** | Dificultad para auditar PDF generado en sandbox | Necesidad de verificar integridad `/ByteRange` y CMS | Script de auditoría y validación contra `verificadorPades.service.ts` | `verificadorPades.service.ts`, `validadorCvd.controller.ts` | `npx vitest run tests/unit/domains/docucore/verificadorPades.spec.ts` | Pasado (Exit 0) | `RD-2026-000011.signed.pdf` (25,607 bytes) | Certificado demo (sin validez legal oficial) |
| **CoreLink: Reportes Ejecutivos** | Falta de prueba de regresión RBAC en endpoints de analítica | Verificación manual dependiente de sesión de navegador | Suite unitaria automatizada para `REPORTE_LEER` | `backend/tests/unit/domains/corelink/reportes-rbac.spec.ts` | `npx vitest run -c vitest.unit.config.ts tests/unit/domains/corelink/reportes-rbac.spec.ts` | Pasado (Exit 0) | 7 pruebas unitarias de roles y permisos | Ninguna |

---

## 8. INSTRUCCIONES CONCRETAS PARA REPRODUCIR LAS PRUEBAS

Para reproducir la totalidad de las evidencias registradas en este informe:

1. **Pruebas de la Matriz de Autorización Backend (15 pruebas):**
   ```powershell
   cd C:\Users\Liz\Desktop\SIGD\SIGD\backend
   npx vitest run -c vitest.unit.config.ts tests/unit/matriz-autorizacion-roles.spec.ts
   ```
2. **Pruebas de Rutas Protegidas y Menús Frontend (34 pruebas):**
   ```powershell
   cd C:\Users\Liz\Desktop\SIGD\SIGD\frontend
   npx vitest run tests/unit/routes/rbacRoleGuardRoutes.test.tsx tests/unit/components/HeaderInstitucional.test.tsx
   ```
3. **Cotejo del Validador CVD en Servidor Activo:**
   ```powershell
   curl.exe -s http://127.0.0.1:3008/api/v1/validador/cvd/CVD-2026-D5CC813731BBDC16
   ```
4. **Verificación de Inmutabilidad Zero-Touch sobre `sigd_prueba`:**
   ```powershell
   docker exec sigd-postgres-1 psql -U postgres -d sigd_prueba -c "SELECT codigo_expediente, estado FROM sigd_tra.expediente ORDER BY codigo_expediente;"
   ```
5. **Ejecución Completa de Suites Globales y TypeCheck:**
   ```powershell
   cd C:\Users\Liz\Desktop\SIGD\SIGD\backend
   npm run test:unit
   npx tsc --noEmit
   cd ..\frontend
   npm test -- --run
   npx tsc --noEmit
   ```

---

## 9. CONCLUSIÓN Y DICTAMEN DE CIERRE

El software del Sistema Integral de Gestión Documentaria (SIGD) IESTP Suiza 2026 en la rama `B_JACOBO` se encuentra **técnicamente cerrado, estabilizado y verificado de extremo a extremo**:
- **Cierre Técnico de Software:** **APROBADO AL 100%**. Todas las transiciones de estado, autorizaciones RBAC en backend y frontend, foliación, generación de PDF, firma PAdES demostrativa, validación de CVD, mensajería Outbox, depósito en Casilla Electrónica y archivado WORM funcionan de manera armónica y auditable.
- **Cierre Institucional Legal:** **CONDICIONADO A INTEGRACIÓN DE PRODUCCIÓN**. Para la puesta en marcha con plena validez jurídica conforme a la Ley N° 27269 (Ley de Firmas y Certificados Digitales), la entidad debe reemplazar las claves y certificados de pruebas de demostración por certificados digitales emitidos por una Entidad de Certificación acreditada ante INDECOPI (e.g., RENIEC / ECEP) y configurar la URL oficial de la TSA institucional.
