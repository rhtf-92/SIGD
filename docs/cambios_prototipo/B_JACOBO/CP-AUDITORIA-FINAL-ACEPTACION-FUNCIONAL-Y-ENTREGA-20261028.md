# SIGD B_JACOBO — AUDITORÍA FINAL DE ACEPTACIÓN FUNCIONAL POR ROL Y VALIDACIÓN DE ENTREGA

**Fecha de emisión:** 28 de octubre de 2026  
**Proyecto:** Sistema Integral de Gestión Documentaria (SIGD) — IESTP Suiza 2026  
**Rama de trabajo:** `B_JACOBO`  
**HEAD histórico auditado:** `bf30d8a0c85e266a86381fb10bf3740a8451c032`  
**Base de datos de desarrollo y pruebas:** `sigd_jacobo_demo` (PostgreSQL 16 en puerto 5433)  
**Base de datos institucional protegida:** `sigd_prueba` (**ZERO TOUCH**, estrictamente intacta)  
**Servicios verificados en vivo:** Backend Express en `http://127.0.0.1:3008` (PID 3548), Frontend Vite en `http://127.0.0.1:5178` (PID 6400)

---

## 1. RAMA, HEAD HISTÓRICO Y ESTADO GIT (FASE A)

- **Rama activa:** `B_JACOBO`
- **HEAD verificado:** `bf30d8a0c85e266a86381fb10bf3740a8451c032`
- **Integridad del árbol de trabajo (`git diff --check`):** Código de salida `0` (limpio, sin errores de espaciado, sin caracteres de salto de línea incompatibles ni conflictos de fusión).
- **Procesos e Infraestructura Activa:**
  - Contenedor PostgreSQL (`sigd-postgres-1`): Puerto 5433 (saludable, UP > 5 horas).
  - Contenedor Redis (`sigd-redis-1`): Puerto 6379 (saludable, UP > 5 horas).
  - Contenedor MinIO S3 (`sigd-minio-1`): Puertos 9000-9001 (saludable, UP > 5 horas).
  - Proceso Backend Node/Express: PID 3548 en `127.0.0.1:3008` (`/health` responde HTTP 200 `UP`).
  - Proceso Frontend Vite: PID 6400 en `127.0.0.1:5178` (HTTP 200).
- **Aislamiento de Servidores:** No se reiniciaron procesos operativos existentes ni se duplicaron workers.

---

## 2. RELACIÓN EXACTA DE ARCHIVOS MODIFICADOS Y NUEVOS

### 2.1 Archivos Principales de Remediación y Autorización
- `backend/src/domains/rutadoc/rutadoc.router.ts`: Endurecimiento de la comprobación de coherencia entre `GLOBAL` (`areaId: null`) y `AREA` (`areaId !== null`), evitando fallas internas 500 y garantizando HTTP 403 Forbidden. Implementación de resolución defensiva de competencia de área para permitir al despacho instructor archivar resoluciones en estado `RESUELTO`.
- `backend/src/domains/docucore/verificadorPades.service.ts`: Verificación criptográfica PAdES, análisis de `/ByteRange`, extracción de atributos CMS y soporte de validación offline/demo.
- `backend/src/domains/docucore/validadorCvd.controller.ts`: Endpoint público de verificación CVD con emisión de URLs prefirmadas de descarga en MinIO S3.
- `backend/src/domains/organicore/usuariosAdmin.routes.ts`: Enrutamiento protegido para la gestión de usuarios institucionales con guardia `exigirAdministracionUsuarios` sujeta a PostgreSQL.
- `frontend/src/routes/ProtectedRoute.tsx`: Unificación de la comprobación de tokens y tolerancia a claves del cliente API institucional.
- `frontend/src/components/HeaderInstitucional.tsx`: Restricción dinámica de menús y paneles de navegación según el rol autenticado.

### 2.2 Suites de Pruebas Unitarias y de Integración Añadidas
- `backend/tests/unit/matriz-autorizacion-roles.spec.ts`: 15 pruebas unitarias de cruce positivo y negativo de roles vs. endpoints sensibles.
- `backend/tests/unit/domains/corelink/reportes-rbac.spec.ts`: 7 pruebas del permiso `REPORTE_LEER` para analítica ejecutiva.
- `frontend/tests/unit/routes/rbacRoleGuardRoutes.test.tsx`: 23 pruebas de bloqueo de navegación directa no autorizada.
- `frontend/tests/unit/components/HeaderInstitucional.test.tsx`: 11 pruebas de visibilidad condicional de menús.

---

## 3. MATRIZ DEFINITIVA DE ROLES, MÓDULOS, RUTAS Y PERMISOS (FASE B)

Contrastado contra el commit original `2099b26` (*Carlos Perea*) y los catálogos institucionales en `sigd_org.rol_sistema` y `sigd_org.permiso_sistema`:

| Rol Canónico | Módulos Visibles | Rutas Frontend Permitidas | Endpoints Backend Autorizados | Restricciones por Área / Titularidad | Operaciones Expresamente Denegadas | Prueba de Demostración |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`ADMINISTRADOR`** | IdentiCore, OrganiCore, RutaDoc, Archivo Central, Reportes MGD | `/bandeja`, `/admin/usuarios`, `/admin/organigrama`, `/admin/maestras`, `/dashboard` | `GET/POST/PUT /api/v1/admin/usuarios`<br>`GET /api/v1/expedientes`<br>`GET /api/v1/reportes/dashboard-ejecutivo` | Permiso `ADMIN_USUARIOS` transversal (`GLOBAL`, `areaId: null`). | Radicación de trámites ordinarios de ventanilla; emisión de resoluciones directoriales. | `matriz-autorizacion-roles.spec.ts` (test 1, 10)<br>`rbacRoleGuardRoutes.test.tsx` (test 1, 7) |
| **`DIRECTOR`** | IdentiCore, RutaDoc, Archivo Central, DocuCore (Aprobación), FirmaDigital, Reportes MGD | `/bandeja`, `/despacho/resoluciones`, `/pasarela-firma`, `/dashboard` | `GET /api/v1/expedientes`<br>`GET /api/v1/firma/pendientes`<br>`GET /api/v1/reportes/dashboard-ejecutivo`<br>`POST /api/v1/firma/iniciar` | Supervisión global (`GLOBAL`). Potestad legal de firma en `sigd_org.facultad_despacho`. | Administración de usuarios institucionales (HTTP 403 forzoso). | `matriz-autorizacion-roles.spec.ts` (test 2, 7, 11)<br>`rbacRoleGuardRoutes.test.tsx` (test 2, 8) |
| **`SECRETARIO`** | IdentiCore, RutaDoc, Archivo Central, DocuCore (Proyector) | `/bandeja`, `/despacho/resoluciones` | `GET /api/v1/expedientes?pestana=...`<br>`POST /api/v1/expedientes/:id/derivar`<br>`POST /api/v1/resoluciones/proyectar` | Restringido a Secretaría Académica (`SEC`, `areaId !== null`). | Firma digital titular; administración de usuarios; analítica global ejecutiva (HTTP 403). | `matriz-autorizacion-roles.spec.ts` (test 4, 8)<br>`rbacRoleGuardRoutes.test.tsx` (test 3, 9) |
| **`ESPECIALISTA`** | IdentiCore, RutaDoc, Archivo Central | `/bandeja` | `GET /api/v1/expedientes?pestana=...`<br>`POST /api/v1/expedientes/:id/derivar` | Restringido al área asignada (`areaId !== null`). | Firma digital; proyección de resoluciones; administración de usuarios (HTTP 403). | `matriz-autorizacion-roles.spec.ts` (test 5, 12)<br>`rbacRoleGuardRoutes.test.tsx` (test 4, 10) |
| **`MESA_PARTES`** | IdentiCore, TramiCore (Ventanilla), RutaDoc | `/bandeja`, `/tramite/radicacion`, `/mesa-partes/recepcion` | `GET /api/v1/expedientes?pestana=...`<br>`POST /api/v1/tramites/radicar-presencial` | Restringido a Mesa de Partes (`MP`). | Firma digital; proyección de resoluciones; administración de usuarios (HTTP 403). | `matriz-autorizacion-roles.spec.ts` (test 3, 13)<br>`rbacRoleGuardRoutes.test.tsx` (test 5, 11) |
| **`CIUDADANO`** | IdentiCore (Casilla Personal), TramiCore (Virtual) | `/casilla`, `/tramite/nuevo` | `GET /api/v1/expedientes?pestana=...`<br>`POST /api/v1/tramites/radicar-virtual`<br>`GET /api/v1/casilla/notificaciones` | Restricción absoluta por titularidad (`solicitante_id = persona_id`). | Acceso a bandejas internas; gestión de usuarios; firma; resoluciones (HTTP 403). | `matriz-autorizacion-roles.spec.ts` (test 6, 9, 14)<br>`rbacRoleGuardRoutes.test.tsx` (test 6, 12) |
| **`ANÓNIMO`** | Público (Consulta Externa / CVD) | `/consulta`, `/validar-cvd`, `/login` | `GET /api/v1/validador/cvd/:codigo`<br>`GET /api/v1/consulta-publica/:cut` | Libre acceso sin credenciales. | Toda ruta o endpoint privado sin token Bearer válido (HTTP 401 Unauthorized forzoso). | `matriz-autorizacion-roles.spec.ts` (test 15)<br>`rbacRoleGuardRoutes.test.tsx` (test 13-16) |

---

## 4. RESULTADOS DE PRUEBAS EN VIVO POR ROL (FASE C)

Se ejecutó una batería de pruebas de integración HTTP directa contra el servidor en vivo (`http://127.0.0.1:3008`), utilizando las identidades reales del catálogo `sigd_jacobo_demo`:

```text
=== TEST EN VIVO DE MATRIZ DE AUTORIZACION BACKEND (127.0.0.1:3008) ===

[✓ PASS] ANONIMO        -> GET /api/v1/auth/me                            Esperado: 401 | Obtenido: 401
[✓ PASS] ANONIMO        -> GET /api/v1/admin/usuarios                     Esperado: 401 | Obtenido: 401
[✓ PASS] ANONIMO        -> GET /api/v1/reportes/dashboard-ejecutivo       Esperado: 401 | Obtenido: 401
[✓ PASS] ANONIMO        -> GET /api/v1/validador/cvd/... (PUBLICO)        Esperado: 200 | Obtenido: 200
[✓ PASS] ADMINISTRADOR  -> GET /api/v1/auth/me                            Esperado: 200 | Obtenido: 200
[✓ PASS] ADMINISTRADOR  -> GET /api/v1/admin/usuarios                     Esperado: 200 | Obtenido: 200
[✓ PASS] ADMINISTRADOR  -> GET /api/v1/reportes/dashboard-ejecutivo       Esperado: 200 | Obtenido: 200
[✓ PASS] ADMINISTRADOR  -> GET /api/v1/expedientes (Bandeja)              Esperado: 200 | Obtenido: 200
[✓ PASS] DIRECTOR       -> GET /api/v1/auth/me                            Esperado: 200 | Obtenido: 200
[✓ PASS] DIRECTOR       -> GET /api/v1/admin/usuarios (DENIED)            Esperado: 403 | Obtenido: 403
[✓ PASS] DIRECTOR       -> GET /api/v1/reportes/dashboard-ejecutivo       Esperado: 200 | Obtenido: 200
[✓ PASS] DIRECTOR       -> GET /api/v1/expedientes (Bandeja Global)       Esperado: 200 | Obtenido: 200
[✓ PASS] DIRECTOR       -> GET /api/v1/firma/pendientes                   Esperado: 200 | Obtenido: 200
[✓ PASS] SECRETARIO     -> GET /api/v1/auth/me                            Esperado: 200 | Obtenido: 200
[✓ PASS] SECRETARIO     -> GET /api/v1/admin/usuarios (DENIED)            Esperado: 403 | Obtenido: 403
[✓ PASS] SECRETARIO     -> GET /api/v1/reportes/dashboard-ejecutivo (DENIED) Esperado: 403 | Obtenido: 403
[✓ PASS] SECRETARIO     -> GET /api/v1/expedientes (Bandeja SEC)          Esperado: 200 | Obtenido: 200
[✓ PASS] SECRETARIO     -> GET /api/v1/firma/pendientes (DENIED)          Esperado: 403 | Obtenido: 403
[✓ PASS] MESA_PARTES    -> GET /api/v1/auth/me                            Esperado: 200 | Obtenido: 200
[✓ PASS] MESA_PARTES    -> GET /api/v1/admin/usuarios (DENIED)            Esperado: 403 | Obtenido: 403
[✓ PASS] MESA_PARTES    -> GET /api/v1/reportes/dashboard-ejecutivo (DENIED) Esperado: 403 | Obtenido: 403
[✓ PASS] MESA_PARTES    -> GET /api/v1/firma/pendientes (DENIED)          Esperado: 403 | Obtenido: 403
[✓ PASS] CIUDADANO      -> GET /api/v1/auth/me                            Esperado: 200 | Obtenido: 200
[✓ PASS] CIUDADANO      -> GET /api/v1/admin/usuarios (DENIED)            Esperado: 403 | Obtenido: 403
[✓ PASS] CIUDADANO      -> GET /api/v1/reportes/dashboard-ejecutivo (DENIED) Esperado: 403 | Obtenido: 403
[✓ PASS] CIUDADANO      -> GET /api/v1/firma/pendientes (DENIED)          Esperado: 403 | Obtenido: 403
[✓ PASS] CIUDADANO      -> GET /api/v1/expedientes (Bandeja Personal)     Esperado: 200 | Obtenido: 200

Resumen: 27/27 pruebas pasadas (100% Satisfactorio).
```

---

## 5. DIFERENCIAS ENTRE PERMISOS DEL FRONTEND Y DEL BACKEND

1. **Principio de Autoridad:**  
   El backend es la única fuente de verdad autoritativa. Toda petición operativa sensible en RutaDoc, DocuCore, OrganiCore y CoreLink evalúa la base de datos PostgreSQL (`sigd_org.usuario_rol`) en vivo con `vigente_desde <= now() AND (vigente_hasta IS NULL OR vigente_hasta > now())`.
2. **Rol del Token JWT:**  
   El token JWT actúa exclusivamente como portador de identidad autenticada (`claims.sub`). No se otorgan permisos irrevocables a través del token.
3. **Rol de la Interfaz Frontend:**  
   El frontend gestiona la experiencia de usuario (ocultamiento de opciones de menú en `HeaderInstitucional.tsx` y redirección en `ProtectedRoute.tsx`), pero cualquier intento de omitir el frontend mediante peticiones directas de red es invariablemente interceptado y bloqueado por los guardias del backend con HTTP 401 o 403.

---

## 6. VERIFICACIÓN INDEPENDIENTE DEL EXPEDIENTE EXP-2026-000017 (FASE D)

Se verificó el estado inmutable del expediente de demostración en modo de solo lectura:
- **Expediente / CUT:** `EXP-2026-000017`
- **Procedimiento:** Certificado de Estudios Superiores (`SUZ26-035`)
- **Estado en RutaDoc:** `ARCHIVADO` (Secuencia 7 en `sigd_rut.estado_actual_expediente`)
- **Resolución Asociada:** `RD-2026-000011` (`sigd_doc.resolucion`) en estado `FIRMADA`
- **Almacenamiento S3 (MinIO):** `s3://sigd-sandbox-e2e/resoluciones/RD-2026-000011.signed.pdf`
- **Tamaño del PDF Firmado:** `25,607 bytes`
- **Hash SHA-256 Calculado:** `6e79ce927f845c2a4accd60cb1d89d9dc5651e79148ac7df5c71955785d525bc`
- **Hash SHA-256 en Base de Datos:** `6e79ce927f845c2a4accd60cb1d89d9dc5651e79148ac7df5c71955785d525bc` (Coincidencia exacta).
- **`/ByteRange` en Estructura PDF:** `[0, 8593, 24979, 628]`, cubriendo íntegramente los 25,607 bytes con hueco CMS aislado para `/Contents`.
- **Sello de Tiempo (TSA):** `2026-10-28T17:22:42.235Z`.
- **Código de Verificación Digital (CVD):** `CVD-2026-D5CC813731BBDC16`.
- **Casilla Electrónica:** Notificación ID `3b8decca-dbda-4766-9abd-6a6ef2a06a2c` con acuse `ACU-2026-3B8DECCA`.
- **Outbox Worker:** 5 eventos procesados (`PROCESADO`) en `sigd_audit.evento_outbox`.
- **Auditoría WORM:** Registro inmutable asegurado por trigger `tr_bitacora_append_only`.

---

## 7. CLASIFICACIÓN EXACTA DE LA FIRMA DIGITAL

Conforme a las directrices de auditoría criptográfica:
1. **Integridad Matemática de la Firma:** **SÍ**. Los algoritmos criptográficos RSA y SHA-256 validan la integridad del contenido protegido sin alteraciones posteriores.
2. **Certificado Confiable en PKI Oficial:** **NO**. El certificado no emana de una Entidad de Certificación acreditada ante INDECOPI (RENIEC / ECEP).
3. **Firma Institucional Auténtica:** **NO**. No posee efectos jurídicos oficiales frente al Estado peruano.
4. **Firma Sintética de Demostración:** **SÍ**. El certificado expedido (`CN=DIRECTOR GENERAL - SIGD DEMO - SIN VALIDEZ LEGAL`) está claramente clasificado y rotulado para fines de validación técnica de software en entorno de laboratorio.
5. **Transparencia en la API y Frontend:** El dictamen público emitido por el validador CVD advierte expresamente al usuario: *"El CVD tiene un registro de firma y el PDF almacenado coincide con su SHA-256. Esta consulta no comprueba la vigencia del certificado ni sustituye la validación criptográfica de la firma."*

---

## 8. RESULTADOS DE PRUEBAS AUTOMATIZADAS Y TYPECHECK (FASE E)

| Suite de Pruebas | Archivos Ejecutados | Pruebas Pasadas | Pruebas Omitidas | Pruebas Fallidas | Código de Salida | Errores TypeCheck (`tsc`) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Backend Unit Tests** | 76 (75 ejecutados) | **1,287** | 10 | **0** | `0` | **0 errores** |
| **Frontend Unit Tests** | 65 | **748** | 1 | **0** | `0` | **0 errores** |
| **Matriz Autorización Backend** | 1 | **15** | 0 | **0** | `0` | **0 errores** |
| **Rutas Protegidas Frontend** | 2 | **34** | 0 | **0** | `0` | **0 errores** |
| **Pruebas en Vivo (Live HTTP)** | 1 | **27** | 0 | **0** | `0` | **0 errores** |
| **Total Global Integrado** | **145 suites** | **2,111 pasadas** | **11** | **0** | `0` | **0 errores** |

---

## 9. CONFIRMACIÓN DE AISLAMIENTO ZERO-TOUCH SOBRE `sigd_prueba`

Se revalidó mediante consulta directa al motor PostgreSQL en el contenedor `sigd-postgres-1`:
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
- Inmutabilidad estricta: Cero escrituras, cero mutaciones de esquema, cero migraciones aplicadas. Política ZERO TOUCH cumplida al 100%.

---

## 10. DEFECTOS CORREGIDOS Y EVIDENCIA ASOCIADA (FASE F)

1. **Defecto de Coherencia de Ámbito en Permisos RBAC:**
   - *Ubicación:* `backend/src/domains/rutadoc/rutadoc.router.ts`.
   - *Causa:* Tratamiento como global de permisos de área sin identificador (`areaId: null`), causando error 500 en la base de datos.
   - *Corrección:* Validación estricta que exige `areaId === null` para `GLOBAL` y `areaId !== null` para `AREA`. Rechazo con HTTP 403 Forbidden.
   - *Evidencia:* `matriz-autorizacion-roles.spec.ts` y pruebas en vivo aprobadas.
2. **Defecto de Competencia de Área al Archivar Resoluciones Resueltas:**
   - *Ubicación:* `backend/src/domains/rutadoc/rutadoc.router.ts`.
   - *Causa:* Pérdida de `area_actual_id` tras webhook de firma, impidiendo el archivado a Secretaría Académica.
   - *Corrección:* Búsqueda defensiva en el historial de derivaciones para validar la competencia orgánica instructora del operador.
   - *Evidencia:* `EXP-2026-000017` archivado exitosamente (Secuencia 7).

---

## 11. LIMITACIONES PENDIENTES Y RECOMENDACIÓN PARA ENTREGA DOCENTE

### 11.1 Limitaciones Externas Pendientes (Fuera del Alcance de Software)
1. **Infraestructura PKI Nacional:**  
   Para la validez legal del trámite en producción se requiere un certificado digital institucional emitido por RENIEC/ECEP en token criptográfico FIPS 140-2 Nivel 3 y la integración con la URL oficial de la Autoridad de Sellado de Tiempo (TSA) de RENIEC.
2. **Cliente Nativo ReFirma PC:**  
   En producción, el docente o funcionario utilizará el protocolo de escritorio `refirma://` con la aplicación oficial de RENIEC. El software SIGD se encuentra completamente listo para recibir las llamadas de dicho cliente a través de `callbackRefirma.service.ts`.

### 11.2 Recomendación para la Demostración Docente
- **Demostración de Control de Acceso:** Iniciar sesión con `admin.demo` para exhibir el módulo de administración de usuarios y organigrama; contrastar iniciando sesión con `ciudadano.demo` o `operador.demo` y evidenciar que los módulos administrativos y de firma están estrictamente bloqueados (HTTP 403 en red y menús ausentes).
- **Demostración de Trazabilidad:** Consultar el expediente `EXP-2026-000017` en la pestaña de `ARCHIVADOS` para mostrar la línea de tiempo completa de 7 secuencias, la resolución `RD-2026-000011` y la verificación pública del `CVD-2026-D5CC813731BBDC16`.
- **Veredicto:** **SISTEMA TÉCNICAMENTE ACEPTADO Y LISTO PARA ENTREGA**.
