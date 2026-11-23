# SIGD IESTP SUIZA 2026 — INFORME DE AUDITORÍA INTEGRAL DE ROLES, JERARQUÍA INSTITUCIONAL Y AUTORIZACIONES (RBAC/ABAC)

**Fecha:** 27 de Octubre de 2026  
**Rama:** `B_JACOBO`  
**Commit de referencia:** `bf30d8a0c85e266a86381fb10bf3740a8451c032`  
**Entorno auditado:** Prototipo SIGD IESTP Suiza 2026  
**PostgreSQL:** `127.0.0.1:5433/sigd_jacobo_demo` (Docker: `sigd-postgres-1`)  
**Backend:** `http://127.0.0.1:3008` (Express / Node.js)  
**Frontend:** `http://127.0.0.1:5178` (React / Vite)  
**Tipo de auditoría:** Inspección técnica integral, estricta de solo lectura (CERO escrituras, CERO regresión).

---

## 1. CONTROL DE INTEGRIDAD Y ESTADO PREVIO DEL ENTORNO

Antes de iniciar la investigación técnica, se verificó el estado inmutable del espacio de trabajo:
- **Rama Git:** `B_JACOBO` confirmada.
- **HEAD del repositorio:** `bf30d8a0c85e266a86381fb10bf3740a8451c032`.
- **Archivos modificados preexistentes:** 146 archivos de código y documentación preservados intactos.
- **Contenedores Docker:**
  - `sigd-postgres-1` (puerto 5433): Operativo y saludable.
  - `sigd-redis-1` (puerto 6379): Operativo y saludable.
  - `sigd-minio-1` (puertos 9000/9001): Operativo y saludable.
- **Procesos locales:** Backend en puerto 3008 y Frontend en puerto 5178 activos y saludables.
- **Base protegida:** `sigd_prueba` preservada con 0 escrituras.

---

## 2. RESUMEN EJECUTIVO DE LA AUDITORÍA

La presente auditoría técnica evaluó exhaustivamente la implementación del modelo de autenticación, control de acceso basado en roles (RBAC), control de acceso basado en atributos/propiedad (ABAC) y la jerarquía institucional en el sistema SIGD IESTP Suiza 2026.

### Hallazgos Principales:
1. **Filosofía Arquitectónica del Backend (Sólida):**  
   El backend implementa el principio de que *"El JWT únicamente identifica la cuenta; las facultades proceden del RBAC vigente persistido en PostgreSQL"*. Los roles afirmados en el payload del token JWT no otorgan privilegios por sí mismos en endpoints críticos; el backend consulta dinámicamente las tablas `sigd_org.usuario_rol`, `sigd_org.rol_sistema`, `sigd_org.rol_permiso` y `sigd_org.permiso_sistema`, verificando vigencia temporal (`vigente_desde <= now() AND (vigente_hasta IS NULL OR vigente_hasta > now())`) y estado activo de la cuenta.
2. **Jerarquía Institucional y ltree:**  
   La estructura orgánica se modela en `sigd_org.area` mediante la extensión `ltree` de PostgreSQL (`path`) y un disparador `BEFORE INSERT OR UPDATE` (`sigd_org.fn_area_set_path()`). Actualmente existen 3 unidades orgánicas canónicas de nivel 1: Dirección General (`DG`), Mesa de Partes (`MP`) y Secretaría Académica (`SEC`).
3. **Roles y Permisos Canónicos en Base de Datos:**  
   En PostgreSQL existen exactamente 6 roles canónicos y 6 permisos del sistema. Sin embargo, en el frontend (`rbacRoles.ts`) existe una discrepancia nominal histórica donde se definieron tipos como `SUPER_ADMIN`, `DOCENTE` y `ESTUDIANTE`, los cuales no existen en la base de datos real.
4. **Vulnerabilidades y Brechas Críticas Detectadas:**
   - **Falta de guardias de autenticación en DocuCore:** El endpoint de proyección y actualización de resoluciones directorales (`POST /api/v1/resoluciones/proyectar` y `GET /api/v1/resoluciones/:id`) carece de middleware de autenticación, permitiendo peticiones no autenticadas.
   - **Foliación sin autenticación:** `POST /api/v1/expedientes/:id/foliar-documento` carece de guardias JWT/RBAC.
   - **Rutas del Frontend desprotegidas:** En `AppRouter.tsx`, páginas sensibles como `/expedientes`, `/expedientes/:id`, `/casilla`, `/flujos/proyector-resoluciones`, `/flujo-validez-legal/firma` y `/administracion/seguridad` no están encapsuladas con `ProtectedRoute`.
   - **Defecto en Reversión de RutaDoc:** `rutadoc.reversion.service.ts` valida `esIdNumericoPositivo(actor.id)`, pero `actor.id` es un UUID (`claims.sub`), impidiendo por completo la reversión de actuaciones administrativas con un error 401.

---

## 3. DIAGNÓSTICO DE LA ARQUITECTURA DE AUTENTICACIÓN Y AUTORIZACIÓN

### 3.1. Autenticación (IdentiCore / Auth)
- **Hashing de contraseñas:** Implementado con `Argon2id` (vía `Argon2Service`), garantizando resistencia contra ataques de fuerza bruta y GPU/ASIC.
- **Emisión Dual de Tokens:**
  - **Access Token:** JWT firmado con algoritmo `HS256`, expiración corta de 15 minutos (900 segundos). Payload estándar: `{ sub: idUsuario, roles: string[], iat, exp, typ: 'access' }`. El secreto se obtiene de `AUTH_JWT_SECRET` (mínimo 32 caracteres).
  - **Refresh Token:** Cadena criptográfica aleatoria de 64 caracteres hexadecimales (256 bits), expiración de 7 días, persistida en `sigd_auth.sesion_usuario`.
- **Rotación y Cierre de Sesión:**
  - Rotación atómica con revocación en la misma transacción (`UPDATE ... RETURNING ... INSERT`).
  - Cierre de sesión explícito (`POST /api/v1/auth/logout`) que establece `revocado_en = now()`.

### 3.2. Modelo de Autorización RBAC / ABAC
- **RBAC Persistido:**
  - `sigd_org.rol_sistema`: Define los roles institucionales.
  - `sigd_org.permiso_sistema`: Define las operaciones protegidas y su ámbito (`GLOBAL` o `AREA`).
  - `sigd_org.rol_permiso`: Tabla de unión entre roles y permisos.
  - `sigd_org.usuario_rol`: Asignación de rol a una cuenta con vigencia temporal (`vigente_desde`, `vigente_hasta`) y asociación opcional a un área (`area_id`).
- **ABAC y Aislamiento por Área:**
  - **Permiso de Ámbito AREA:** Si un usuario tiene `EXPEDIENTE_DERIVAR` o `EXPEDIENTE_RESOLVER` con ámbito `AREA`, la guardia verifica que el `area_actual_id` del expediente coincida con el `area_id` del usuario.
  - **Fórmula de Área Efectiva:** Para expedientes recién radicados que aún no tienen derivación en `sigd_rut.estado_actual_expediente`, el sistema calcula deterministamente que pertenecen a Mesa de Partes (`codigo = 'MP'`).
  - **Propiedad de Datos (Casilla y Storage):** Los endpoints de Casilla Electrónica (`/api/v1/casilla/*`) verifican estrictamente `notificacion.usuario_id === usuarioId`. En Storage (`/api/v1/storage/*`), se verifica si `expediente.solicitante_id === cuenta.id_persona` o si el usuario cuenta con permiso global de lectura.
- **Facultades Legales de Firma:**
  - Implementado en `verificarFacultadFirma()` de `auth.guard.ts`.
  - Verifica roles globales de firma (`DIRECTOR`, `ADMINISTRADOR`) o facultades delegadas en `sigd_org.facultad_despacho` y suplencias en `sigd_org.encargatura_despacho`.

---

## 4. ESTRUCTURA ORGÁNICA Y JERARQUÍA INSTITUCIONAL DESCUBIERTA

### 4.1. Esquema y Manejo de Rutas Jerárquicas
PostgreSQL gestiona la jerarquía en la tabla `sigd_org.area`:
- **Extensión:** `ltree`.
- **Columnas clave:** `area_id` (UUID), `codigo` (VARCHAR), `nombre` (VARCHAR), `area_padre_id` (UUID), `nivel` (SMALLINT), `path` (LTREE), `vigente` (BOOLEAN).
- **Trigger `tr_area_set_path`:** Ejecuta `sigd_org.fn_area_set_path()` antes de inserciones o actualizaciones:
  - Si `area_padre_id IS NULL`, genera `path = 'a.' || codigo` y `nivel = 1`.
  - Si tiene padre, concatena el path del padre con `a.<codigo>` e incrementa el nivel en 1.

### 4.2. Unidades Orgánicas Registradas en la Base de Datos

| Área ID | Código | Nombre | Nivel | Path | Padre ID | Vigente |
| :--- | :---: | :--- | :---: | :---: | :---: | :---: |
| `05f2ee8f-c90f-4239-898c-3ac113afc424` | **DG** | Dirección General | 1 | `a.DG` | *null* | `true` |
| `a1a3a496-ff7f-45d8-b63c-3e54fcf79de1` | **MP** | Mesa de Partes | 1 | `a.MP` | *null* | `true` |
| `2b147b0d-7c8f-434f-b75a-598a1ccb855b` | **SEC** | Secretaría Académica | 1 | `a.SEC` | *null* | `true` |

*Observación:* Todas las áreas registradas se encuentran en nivel 1 como unidades raíz. No se han dado de alta aún subdirecciones, coordinaciones ni áreas dependientes en el prototipo demo.

### 4.3. Cargos Institucionales (`sigd_org.cargo`)

| Cargo ID | Código | Nombre | Vigente |
| :--- | :---: | :--- | :---: |
| `6f06fabf-8c1e-4956-9936-296d8a9da2cb` | **DIR_GEN** | Director General | `true` |
| `28838da3-fd7c-4016-8b4b-2f4ed66effa7` | **OP_MP** | Operador Mesa de Partes | `true` |
| `c5430f9a-16f2-4244-a20e-601743e50d10` | **SEC_ACAD** | Secretario Académico | `true` |

### 4.4. Asignaciones de Personal y Facultades de Despacho
- **`sigd_org.asignacion_personal`:** Contiene **0 registros**. El sistema opera vinculando el área directamente a la cuenta a través de `sigd_org.usuario_rol.area_id`.
- **`sigd_org.facultad_despacho`:** Contiene 3 asignaciones vigentes vinculadas al cargo `DIR_GEN` para los usuarios `admin`, `admin.demo` y `director.demo`.
- **`sigd_org.encargatura_despacho`:** Contiene **0 registros** (las suplencias temporales se encuentran soportadas en la estructura pero vacías en el seed demo).

---

## 5. ROLES CANÓNICOS Y CATÁLOGO DE PERMISOS

### 5.1. Catálogo Canónico de Permisos (`sigd_org.permiso_sistema`)

| Código del Permiso | Ámbito | Descripción Operativa |
| :--- | :---: | :--- |
| **`ADMIN_USUARIOS`** | `GLOBAL` | Gestión de cuentas, roles, organigrama, feriados y bitácora de auditoría. |
| **`EXPEDIENTE_LEER`** | `GLOBAL` / `AREA` | Lectura de expedientes y trazabilidad. Global para Directivos/Admin; por área para operadores; personal para administrados. |
| **`EXPEDIENTE_DERIVAR`** | `AREA` | Enviar y remitir expedientes entre unidades orgánicas. |
| **`EXPEDIENTE_RESOLVER`** | `AREA` | Resolver actos y concluir expedientes en el área competente. |
| **`FIRMA_FIRMAR`** | `GLOBAL` | Acceso a la pasarela de firma electrónica/digital y despacho de resoluciones. |
| **`REPORTE_LEER`** | `GLOBAL` | Lectura del Dashboard Ejecutivo y analítica institucional MGD-PCM/SEGDI. |

### 5.2. Matriz de Roles y Permisos en Base de Datos (`sigd_org.rol_permiso`)

| Rol Canónico | `ADMIN_USUARIOS` | `EXPEDIENTE_LEER` | `EXPEDIENTE_DERIVAR` | `EXPEDIENTE_RESOLVER` | `FIRMA_FIRMAR` | `REPORTE_LEER` |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **`ADMINISTRADOR`** | ✅ Global | ✅ Global | ✅ Área | ✅ Área | ✅ Global | ✅ Global |
| **`DIRECTOR`** | ❌ | ✅ Global | ❌ | ✅ Área | ✅ Global | ✅ Global |
| **`SECRETARIO`** | ❌ | ✅ Global | ✅ Área | ✅ Área | ❌ | ❌ |
| **`ESPECIALISTA`** | ❌ | ✅ Global | ✅ Área | ✅ Área | ❌ | ❌ |
| **`MESA_PARTES`** | ❌ | ✅ Global | ✅ Área | ❌ | ❌ | ❌ |
| **`CIUDADANO`** | ❌ | ✅ Global* | ❌ | ❌ | ❌ | ❌ |

*\*Nota sobre CIUDADANO:* Aunque en base de datos figura con `EXPEDIENTE_LEER`, la guardia en `app.ts` y RutaDoc restringe al ciudadano (`e.solicitante_id = cu.id_persona`) de modo que únicamente visualiza sus propios expedientes presentados.

### 5.3. Mapeo de Cuentas Demo y Roles Asignados

| Usuario | Correo | Rol Asignado | Área Vinculada | Ámbito Efectivo |
| :--- | :--- | :--- | :--- | :--- |
| `admin` | `admin@iestp-suiza.edu.pe` | `ADMINISTRADOR` / `DIRECTOR` | Global y MP | Superadministrador con facultades directivas |
| `admin.demo` | `admin.demo@sandbox.invalid` | `ADMINISTRADOR` | DG (Dirección General) | Administrador institucional |
| `director.demo` | `director.demo@sandbox.invalid` | `DIRECTOR` | DG (Dirección General) | Titular del despacho institucional / Firmante |
| `operador.demo` | `operador.demo@sandbox.invalid` | `ESPECIALISTA` / `SECRETARIO` | SEC (Secretaría Académica) | Operador de trámite y derivación académica |
| `ventanilla.demo`| `ventanilla.demo@sandbox.invalid` | `MESA_PARTES` | MP (Mesa de Partes) | Recepción presencial y derivación inicial |
| `ciudadano.demo` | `ciudadano.demo@sandbox.invalid` | `CIUDADANO` | *Ninguna (Externo)* | Administrado / Radicación y Casilla |

---

## 6. MATRIZ DE CLASIFICACIÓN DE ACCESOS POR MÓDULO (9 MÓDULOS)

La siguiente matriz clasifica exhaustivamente los accesos a los 9 módulos lógicos del SIGD según su nivel de protección: **Público (Sin Auth)**, **Autenticado (Cualquier cuenta activa)** y **Restringido (RBAC/ABAC por Rol, Permiso o Área)**.

| ID | Módulo Lógico | Operación / Endpoint / Ruta | Nivel de Acceso | Control Implementado | Estado de Protección |
| :---: | :--- | :--- | :---: | :--- | :---: |
| **M1** | **IdentiCore** | `POST /api/v1/auth/login` | **Público** | Valida credenciales con Argon2id | Correcto |
| **M1** | **IdentiCore** | `POST /api/v1/auth/logout` | **Autenticado** | Revoca `refresh_token` en BD | Correcto |
| **M1** | **IdentiCore** | `POST /api/v1/auth/refresh` | **Autenticado** | Rotación atómica de tokens | Correcto |
| **M1** | **IdentiCore** | `GET /api/v1/auth/me` | **Autenticado** | Token Bearer JWT válido | Correcto |
| **M1** | **IdentiCore** | `GET /api/v1/auth/validar-documento` | **Público** | Validador algorítmico Módulo 11 | Correcto |
| **M1** | **IdentiCore** | `POST /api/v1/auth/registro-ciudadano` | **Público** | Registro externo de administrados | Correcto |
| **M1** | **IdentiCore** | `POST /api/v1/auth/registro-persona-juridica`| **Público** | Registro externo de personas jurídicas | Correcto |
| **M1** | **IdentiCore** | `GET /api/v1/ubigeo/distritos-ucayali` | **Público** | Catálogo geográfico de Ucayali | Correcto |
| **M1** | **IdentiCore** | `GET /api/v1/casilla/notificaciones` | **Restringido** | ABAC: Solo notificaciones de `usuario_id` | Correcto |
| **M1** | **IdentiCore** | `GET /api/v1/casilla/notificaciones/:id` | **Restringido** | ABAC: 403 si el documento no es propio | Correcto |
| **M1** | **IdentiCore** | `PATCH /api/v1/casilla/notificaciones/:id/lectura`| **Restringido** | ABAC: Registro fehaciente primera lectura | Correcto |
| **M1** | **IdentiCore** | `POST /api/v1/casilla/notificaciones/:id/acuse` | **Restringido** | ABAC: Generación sellada de acuse digital | Correcto |
| **M1** | **IdentiCore** | Frontend: `/casilla`, `/casilla-electronica` | **Autenticado** | Router Frontend: **Sin ProtectedRoute** | ⚠️ **Brecha Frontend** |
| **M2** | **OrganiCore** | `GET /api/v1/admin/usuarios` | **Restringido** | RBAC: `ADMIN_USUARIOS` (GLOBAL) | Correcto |
| **M2** | **OrganiCore** | `POST /api/v1/admin/usuarios` | **Restringido** | RBAC: `ADMIN_USUARIOS` (GLOBAL) | Correcto |
| **M2** | **OrganiCore** | `PUT /api/v1/admin/usuarios/:id` | **Restringido** | RBAC: `ADMIN_USUARIOS` (GLOBAL) | Correcto |
| **M2** | **OrganiCore** | `GET /api/v1/admin/roles-permisos` | **Restringido** | RBAC: `ADMIN_USUARIOS` (GLOBAL) | Correcto |
| **M2** | **OrganiCore** | `PUT /api/v1/roles/:id/permisos` | **Restringido** | RBAC: `ADMIN_USUARIOS` (GLOBAL) | Correcto |
| **M2** | **OrganiCore** | `GET /api/v1/admin/auditoria/bitacora` | **Restringido** | RBAC: `ADMIN_USUARIOS` (GLOBAL) | Correcto |
| **M2** | **OrganiCore** | `POST /api/v1/admin/organigrama/areas` | **Restringido** | RBAC: `ADMIN_USUARIOS` (GLOBAL) | Correcto |
| **M2** | **OrganiCore** | `PUT /api/v1/admin/organigrama/areas/:id` | **Restringido** | RBAC: `ADMIN_USUARIOS` (GLOBAL) | Correcto |
| **M2** | **OrganiCore** | `POST /api/v1/admin/calendario-laboral/feriado-excepcional` | **Restringido** | RBAC: `ADMIN_USUARIOS` (GLOBAL) | Correcto |
| **M2** | **OrganiCore** | `GET /api/v1/admin/tablas-maestras` | **Público** | Sin guardia en router Express | ⚠️ **Brecha Backend** |
| **M2** | **OrganiCore** | `GET /api/v1/admin/calendario-laboral` | **Público** | Sin guardia en router Express | ⚠️ **Brecha Backend** |
| **M2** | **OrganiCore** | `GET /api/v1/admin/organigrama` | **Público** | Sin guardia en router Express | ⚠️ **Brecha Backend** |
| **M2** | **OrganiCore** | Frontend: `/administracion` | **Restringido** | `ProtectedRoute`: `requiredModule="Administración"` | Correcto |
| **M2** | **OrganiCore** | Frontend: `/administracion/seguridad` | **Restringido** | Ruta top-level: **Sin ProtectedRoute** | ⚠️ **Brecha Frontend** |
| **M3** | **TramiCore** | `POST /api/v1/tramites/radicacion-virtual` | **Autenticado** | Bearer JWT obligatorio (Cualquier usuario activo) | Correcto |
| **M3** | **TramiCore** | `POST /api/v1/tramites/ventanilla-presencial`| **Restringido** | Rol `MESA_PARTES` obligatorio en JWT | Correcto |
| **M3** | **TramiCore** | `GET /api/v1/tramites/tipos` y `/tupa` | **Público** | Catálogo oficial de procedimientos y requisitos | Correcto |
| **M3** | **TramiCore** | `GET /api/v1/tramites/consulta-publica/:cut` | **Público** | Seguimiento ciudadano de estado por CUT | Correcto |
| **M3** | **TramiCore** | `GET /api/v1/tramites/ventanilla/cargo/:cut` | **Restringido** | Rol `MESA_PARTES` obligatorio en JWT | Correcto |
| **M3** | **TramiCore** | Frontend: `/tramite/ventanilla-presencial` | **Restringido** | `ProtectedRoute`: `requiredRoles={["MESA_PARTES"]}` | Correcto |
| **M4** | **RutaDoc** | `GET /api/v1/expedientes` | **Restringido** | ABAC/RBAC: Scoping Global vs Área vs Solicitante | Correcto |
| **M4** | **RutaDoc** | `GET /api/v1/expedientes/:id` | **Restringido** | `puedeVerExpediente`: Global / Área / Solicitante | Correcto |
| **M4** | **RutaDoc** | `POST /api/v1/expedientes/:id/derivar` | **Restringido** | RBAC/ABAC: `EXPEDIENTE_DERIVAR` coincidente con área | Correcto |
| **M4** | **RutaDoc** | `POST /api/v1/expedientes/:id/resolver` | **Restringido** | RBAC/ABAC: `EXPEDIENTE_RESOLVER` coincidente con área | Correcto |
| **M4** | **RutaDoc** | `POST /api/v1/expedientes/:id/revertir-actuacion` | **Restringido** | Fallo técnico: Valida ID numérico sobre UUID | ❌ **Defecto Lógico** |
| **M4** | **RutaDoc** | Frontend: `/expedientes` y `/expedientes/:id` | **Restringido** | Router Frontend: **Sin ProtectedRoute** | ⚠️ **Brecha Frontend** |
| **M5** | **Archivo Central**| `POST /api/v1/expedientes/:id/foliar-documento`| **Restringido** | **Sin guardia de autenticación en router** | 🔴 **Brecha Crítica** |
| **M5** | **Archivo Central**| `GET /api/v1/expedientes/:id/foliacion` | **Restringido** | `puedeVerExpediente` a nivel de servicio | Correcto |
| **M6** | **DocuCore** | `POST /api/v1/resoluciones/proyectar` | **Restringido** | **Sin guardia de autenticación en router** | 🔴 **Brecha Crítica** |
| **M6** | **DocuCore** | `GET /api/v1/resoluciones/:id` | **Restringido** | **Sin guardia de autenticación en router** | 🔴 **Brecha Crítica** |
| **M6** | **DocuCore** | Frontend: `/flujos/proyector-resoluciones` | **Restringido** | Router Frontend: **Sin ProtectedRoute** | ⚠️ **Brecha Frontend** |
| **M7** | **FirmaDigital** | `GET /api/v1/firma/pendientes` | **Restringido** | RBAC/Facultad: 403 `USER_CANNOT_SIGN` | Correcto |
| **M7** | **FirmaDigital** | `POST /api/v1/firma/invocar-refirma` | **Restringido** | RBAC/Facultad: `verificarFacultadFirma` | Correcto |
| **M7** | **FirmaDigital** | `POST /api/v1/firma/callback-refirma` | **M2M / Webhook**| Firma HMAC SHA-256 (`x-refirma-signature`) | Correcto |
| **M7** | **FirmaDigital** | `GET /api/v1/validador-cvd/verificar/:cvd` | **Público** | Verificación pública ciudadana de CVD | Correcto |
| **M7** | **FirmaDigital** | Frontend: `/flujo-validez-legal/firma` | **Restringido** | Router Frontend: **Sin ProtectedRoute** | ⚠️ **Brecha Frontend** |
| **M8** | **CoreLink** | `GET /api/v1/realtime/stream` (SSE) | **Autenticado** | Bearer JWT o `?token=<jwt>` verificado | Correcto |
| **M9** | **Reportes** | `GET /api/v1/reportes/dashboard/resumen` | **Restringido** | RBAC: `REPORTE_LEER` (GLOBAL) persistido | Correcto |
| **M9** | **Reportes** | `GET /api/v1/reportes/dashboard/cuellos-botella`| **Restringido**| RBAC: `REPORTE_LEER` (GLOBAL) persistido | Correcto |
| **M9** | **Reportes** | Frontend: `/reportes`, `/reportes/dashboard` | **Restringido** | `ProtectedRoute`: `requiredModule="Reportes"` | Correcto |
| **Core**| **Storage S3** | `POST /api/v1/storage/presigned-url` | **Autenticado** | Token Bearer JWT de cuenta activa | Correcto |
| **Core**| **Storage S3** | `GET /api/v1/storage/download/:bucket/:key` | **Restringido** | ABAC: Propietario o `EXPEDIENTE_LEER` Global | Correcto |

---

## 7. MATRIZ DE RIESGOS, VULNERABILIDADES Y BRECHAS DETECTADAS

| ID | Módulo | Componente Afectado | Control Encontrado | Evidencia en Código | Riesgo Técnico e Impacto | Prioridad | Recomendación Técnica |
| :---: | :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **V-01** | **DocuCore** | `POST /api/v1/resoluciones/proyectar` | **Ninguno.** La ruta carece de guardia de autenticación o token Bearer. | `resoluciones.controller.ts:73` ejecuta `proyectar()` tomando `contexto?.usuario_id ?? null`. | **Crítico:** Cualquier solicitante anónimo puede redactar o modificar borradores de resoluciones directorales institucionales. | **ALTA** | Incorporar middleware de autenticación y validar facultad de redacción o permiso de trámite antes de proyectar. |
| **V-02** | **Archivo Central** | `POST /api/v1/expedientes/:id/foliar-documento` | **Ninguno.** La ruta toma el parámetro `:id` y ejecuta la foliación directa en BD. | `docucore.router.ts:44` conecta directamente a `pool.connect()` sin verificar JWT ni permisos. | **Crítico:** Alteración no autorizada de la foliación continua oficial de expedientes administrativos. | **ALTA** | Incorporar guardia que exija autenticación y rol `ADMINISTRADOR`, `MESA_PARTES` o permiso en el área del expediente. |
| **V-03** | **Frontend (Router)** | Rutas `/expedientes` y `/expedientes/:id` | **Ninguno a nivel de Router.** Se cargan directamente sin `ProtectedRoute`. | `AppRouter.tsx:105-106`: `<Route path="/expedientes" element={<BandejaExpedientesPage />} />`. | **Medio:** Aunque el backend rechaza peticiones con 401 si no hay token, la interfaz del cliente renderiza componentes antes del fallo. | **MEDIA** | Envolver las rutas en `ProtectedRoute` con `requiredModule="Expedientes"`. |
| **V-04** | **Frontend (Router)** | Rutas `/casilla` y `/casilla-electronica` | **Ninguno a nivel de Router.** | `AppRouter.tsx:35-39`: `<Route path="/casilla" element={<CasillaElectronicaPage />} />`. | **Medio:** Exposición visual de la bandeja de casilla antes de redirigir o fallar por API. | **MEDIA** | Envolver las rutas de Casilla en `ProtectedRoute`. |
| **V-05** | **Frontend (Router)** | Ruta `/administracion/seguridad` | **Ruta duplicada desprotegida.** Está declarada como ruta raíz fuera del layout admin. | `AppRouter.tsx:71`: `<Route path="/administracion/seguridad" element={<SeguridadPage />} />`. | **Medio:** Bypass de la guardia del módulo Administración (`AppRouter.tsx:90-99`). | **MEDIA** | Eliminar la ruta raíz duplicada y conservar únicamente la subruta protegida dentro de `AdminRoutes.tsx`. |
| **V-06** | **RutaDoc** | `POST /api/v1/expedientes/:id/revertir-actuacion` | **Validación tipológica incompatible.** | `rutadoc.reversion.service.ts:50`: `esIdNumericoPositivo(actor.id)` vs UUID de `claims.sub`. | **Alto:** Bloqueo operacional. Los administradores no pueden revertir actuaciones erróneas legítimas (falla siempre con 401). | **ALTA** | Modificar la validación en `esIdNumericoPositivo` para admitir UUID o validar mediante Zod UUID. |
| **V-07** | **Storage S3** | `GET /api/v1/storage/download/:bucket/:key` | **Exclusión de Operadores de Área.** Solo autoriza solicitante o `area_id IS NULL`. | `storage.router.ts:106`: `AND p.codigo = 'EXPEDIENTE_LEER' AND p.ambito = 'GLOBAL' AND ur.area_id IS NULL`. | **Medio:** Especialistas y Secretarios con asignación a un área no pueden descargar adjuntos de expedientes radicados en su área. | **MEDIA** | Ampliar `autorizarDocumento` para verificar si `ur.area_id` coincide con el área actual del expediente. |
| **V-08** | **OrganiCore** | `GET /api/v1/admin/tablas-maestras`, `/calendario-laboral`, `/organigrama` | **Sin autenticación.** Rutas bajo `/api/v1/admin/` accesibles sin cabecera `Authorization`. | `adminMaestras.routes.ts:41-42` y `app.ts:327`. | **Bajo:** Fuga de metadatos institucionales y estructura interna del instituto a usuarios no autenticados. | **BAJA** | Homogeneizar las lecturas administrativas bajo guardia mínima de autenticación institucional. |
| **V-09** | **Frontend (Tipos)** | `types/rbacRoles.ts` | **Desalineación nominal de roles.** Declara `SUPER_ADMIN`, `DOCENTE`, `ESTUDIANTE`. | `rbacRoles.ts:4-9` vs PostgreSQL `sigd_org.rol_sistema`. | **Medio:** Riesgo de fallas en comprobaciones estáticas de frontend al comparar roles no existentes en la BD real. | **MEDIA** | Alinear el tipo `RolCanonicoId` con los 6 roles de base de datos (`ADMINISTRADOR`, `DIRECTOR`, `SECRETARIO`, etc.). |

---

## 8. PROPUESTA DE PLAN DE PRUEBAS DE AUTORIZACIÓN (SOLO PLANIFICACIÓN)

Se formula a continuación la matriz de 10 pruebas técnicas estructuradas para validar exhaustivamente los controles de acceso sin ejecutarlas en esta fase:

1. **PA-01: Rechazo de radicación presencial a usuario Ciudadano**
   - **Precondición:** Token Bearer emitido para cuenta `ciudadano.demo` (rol `CIUDADANO`).
   - **Acción:** Petición `POST /api/v1/tramites/ventanilla-presencial` enviando payload de ventanilla física.
   - **Resultado esperado:** HTTP 403 Forbidden (`El registro presencial requiere el rol MESA_PARTES`).
   - **Evidencia requerida:** Código de estado HTTP 403 y payload RFC 9457 confirmando denegación.
2. **PA-02: Aislamiento estricto de Casilla Electrónica entre usuarios**
   - **Precondición:** Existe notificación dirigida a `ciudadano.demo` (ID `N-01`). Sesión iniciada como `ventanilla.demo`.
   - **Acción:** Petición `GET /api/v1/casilla/notificaciones/N-01` con token de `ventanilla.demo`.
   - **Resultado esperado:** HTTP 403 Forbidden (ABAC: usuario no es el titular destinatario).
   - **Evidencia requerida:** Bloqueo de acceso y cero filtración del contenido de la notificación.
3. **PA-03: Rechazo de acceso a Panel de Administración sin permiso `ADMIN_USUARIOS`**
   - **Precondición:** Token Bearer para `director.demo` (cuenta activa, rol `DIRECTOR`, sin permiso `ADMIN_USUARIOS`).
   - **Acción:** Petición `GET /api/v1/admin/usuarios`.
   - **Resultado esperado:** HTTP 403 Forbidden emitido por `exigirAdministracionUsuarios`.
   - **Evidencia requerida:** HTTP 403 y registro en bitácora sin acceso a la lista de usuarios.
4. **PA-04: Bloqueo de Dashboard Ejecutivo a Operadores de Área**
   - **Precondición:** Token Bearer para `operador.demo` (rol `SECRETARIO` / `ESPECIALISTA`, área `SEC`).
   - **Acción:** Petición `GET /api/v1/reportes/dashboard/resumen`.
   - **Resultado esperado:** HTTP 403 Forbidden (ausencia de permiso persistido `REPORTE_LEER` global).
   - **Evidencia requerida:** HTTP 403 sin exposición de métricas analíticas ni tiempos de atención.
5. **PA-05: Autorización de consulta de cola de firma a Director Titular**
   - **Precondición:** Token Bearer para `director.demo` con facultad vigente en `sigd_org.facultad_despacho`.
   - **Acción:** Petición `GET /api/v1/firma/pendientes`.
   - **Resultado esperado:** HTTP 200 OK con listado de documentos pendientes y `puedeFirmar: true`.
   - **Evidencia requerida:** Lista paginada y generación de URLs prefirmadas de previsualización MinIO.
6. **PA-06: Denegación de invocación de firma a funcionario sin facultad de despacho**
   - **Precondición:** Token Bearer para `operador.demo` (sin asignación en `facultad_despacho` ni `encargatura`).
   - **Acción:** Petición `POST /api/v1/firma/invocar-refirma` con documento de prueba.
   - **Resultado esperado:** HTTP 403 Forbidden (`USER_CANNOT_SIGN`).
   - **Evidencia requerida:** Mensaje de error formal indicando ausencia de facultad legal de despacho.
7. **PA-07: Control de derivación de expediente limitado al área competente**
   - **Precondición:** Expediente radicado actualmente en Mesa de Partes (`MP`). Operador autenticado en Secretaría Académica (`SEC`).
   - **Acción:** Petición `POST /api/v1/expedientes/:id/derivar` firmada por operador de `SEC`.
   - **Resultado esperado:** HTTP 403 Forbidden (el expediente no se encuentra en el área del operador).
   - **Evidencia requerida:** HTTP 403 impidiendo la transición de estado en `sigd_rut.movimiento_expediente`.
8. **PA-08: Validación de descarga segura de adjunto por Administrado Titular**
   - **Precondición:** Expediente registrado por `ciudadano.demo`. Token activo de `ciudadano.demo`.
   - **Acción:** Petición `GET /api/v1/storage/download/:bucket/:key` solicitando el archivo del expediente propio.
   - **Resultado esperado:** HTTP 200 OK con `downloadUrl` prefirmada válida por 900 segundos.
   - **Evidencia requerida:** Emisión exitosa de URL prefirmada GET de MinIO.
9. **PA-09: Rechazo de descarga de adjunto ajeno entre ciudadanos**
   - **Precondición:** Archivo perteneciente a trámite de Ciudadano A. Petición realizada con token de Ciudadano B.
   - **Acción:** Petición `GET /api/v1/storage/download/:bucket/:key` con credenciales de Ciudadano B.
   - **Resultado esperado:** HTTP 403 Forbidden emitido por `autorizarDocumento`.
   - **Evidencia requerida:** Bloqueo estricto sin generación de URL prefirmada S3.
10. **PA-10: Expiración de sesión y revocación en tiempo real**
    - **Precondición:** Sesión activa con `accessToken` y `refreshToken`.
    - **Acción:** Invocación de `POST /api/v1/auth/logout` seguida inmediatamente de `POST /api/v1/auth/refresh`.
    - **Resultado esperado:** HTTP 401 Unauthorized en el refresco debido a sesión revocada (`revocado_en IS NOT NULL`).
    - **Evidencia requerida:** Rechazo con mensaje formal `El token de refresco es inválido o ha expirado`.

---

## 9. RECOMENDACIONES DE INGENIERÍA Y PLAN DE FORTALECIMIENTO PRIORIZADO

### Fase 1: Remediaciones de Seguridad Inmediata (Prioridad Alta)
1. **Blindaje de Proyección de Resoluciones (DocuCore):**  
   Incorporar en `resoluciones.controller.ts` la guardia de identidad `resolverIdentidad` y verificar que el usuario cuente con permiso de proyección institucional o rol directivo/especialista.
2. **Blindaje de Foliación Documental (DocuCore / Archivo):**  
   Proteger `POST /api/v1/expedientes/:id/foliar-documento` mediante `resolverIdentidad` y validación de competencia sobre el expediente.
3. **Corrección de Tipo en Reversión (RutaDoc):**  
   Corregir `rutadoc.reversion.service.ts` sustituyendo `esIdNumericoPositivo(actor.id)` por validación de UUID (`z.string().uuid()`), restituyendo la funcionalidad de reversión de actuaciones para administradores.

### Fase 2: Robustecimiento de Rutas y Frontend (Prioridad Media)
4. **Protección Integral de Navegación en `AppRouter.tsx`:**  
   Envolver en `ProtectedRoute` las rutas cliente `/expedientes`, `/expedientes/:id`, `/casilla`, `/flujo-validez-legal/firma` y eliminar la ruta raíz no protegida `/administracion/seguridad`.
5. **Habilitación de Descarga de Adjuntos para Operadores de Área:**  
   Actualizar la consulta de `autorizarDocumento` en `storage.router.ts` para que un operador con `EXPEDIENTE_LEER` en su área asignada pueda descargar los documentos de los expedientes que se encuentran en su bandeja.
6. **Alineación Nominal de Tipos en Frontend:**  
   Actualizar `frontend/src/types/rbacRoles.ts` para sincronizar `RolCanonicoId` con los valores reales de base de datos (`ADMINISTRADOR`, `DIRECTOR`, `SECRETARIO`, `ESPECIALISTA`, `MESA_PARTES`, `CIUDADANO`).

### Fase 3: Gobierno Institucional y Maestras (Prioridad Baja)
7. **Poblado Gradual de la Jerarquía Institucional:**  
   Dar de alta en `sigd_org.area` las áreas de nivel 2 y 3 (Coordinaciones Académicas, Jefaturas de Área, etc.) aprovechando el cálculo automático de jerarquía con `ltree`.
8. **Protección de Catálogos Administrativos:**  
   Aplicar guardia de autenticación institucional básica en `/api/v1/admin/tablas-maestras` y `/api/v1/admin/organigrama` para evitar raspado anónimo de metadatos.

---
*Informe técnico elaborado bajo estrictos estándares de ingeniería de software, seguridad de aplicaciones y aseguramiento de calidad QA para el proyecto SIGD IESTP Suiza 2026.*
