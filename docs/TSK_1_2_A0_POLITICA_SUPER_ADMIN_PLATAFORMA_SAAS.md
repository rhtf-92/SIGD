# SIGD SUIZA — TSK-1.2 FASE A0
# POLÍTICA DE PRIVILEGIOS GLOBALES Y AUDITORÍA DEL `SUPER_ADMIN_PLATAFORMA` (DOMINIO SAAS)

**Institución:** Instituto de Educación Superior Tecnológico Público «Suiza» — Pucallpa, Ucayali  
**Rama Git exclusiva:** `B_JACOBO` | **Base de referencia:** `sigd_jacobo_demo` (PostgreSQL 18.6)  
**Estado documental:** Diseño Arquitectónico Consolidado Pre-Implementación — **Cero SQL ejecutado (ni `SELECT`), cero código modificado**

---

> [!IMPORTANT]
> **CLASIFICACIÓN ESTRICTA DE ESTADOS EN ESTE DOCUMENTO:**
> - **`CONFIRMADO`:** Decisión institucional y arquitectónica **cerrada definitivamente** en Fase A0 (`SUPER_ADMIN_PLATAFORMA` como identidad SaaS independiente, acceso global multi-institución, visualización y descarga vía streaming backend, MFA obligatorio, auditoría independiente y revocación Política B).
> - **`IMPLEMENTADO`:** Componente existente y verificado estáticamente en el repositorio actual (`B_JACOBO`).
> - **`PARCIAL`:** Componente existente que requiere ajuste o endurecimiento en Fases B/C.
> - **`PROPUESTO`:** Diseño técnico completo y cerrado (esquema `sigd_saas` **dentro de la misma base `sigd_jacobo_demo`**, `sigd_audit.bitacora_superadmin_saas` en `23_`, endpoints `/api/v1/saas/*`, MFA) aún no ejecutado en PostgreSQL ni en código fuente (`NO EJECUTADO`).
> - **Ejecución diferida controlada (`24_+`):** Las relaciones referenciales (`FK`) hacia tablas de identidad `sigd_saas.*` solo se incorporarán en migraciones posteriores controladas (`24_+`), cuando dichas estructuras existan; `23_` opera autónomamente sin dependencias obligatorias hacia tablas SaaS todavía inexistentes.

---

## 1. DECISIÓN DEFINITIVA Y NOMENCLATURA OFICIAL (`CONFIRMADO`)

- **Nombre oficial definitivo:** **`SUPER_ADMIN_PLATAFORMA`**
- **Denominación descriptiva:** **Superadministrador de Plataforma**
- **Justificación del nombre:** Este perfil administra, opera y supervisa globalmente toda la plataforma SaaS (alcance administrativo, operativo, tecnológico y de seguridad), no únicamente su infraestructura técnica.

El operador **`SUPER_ADMIN_PLATAFORMA`** posee **acceso global e integral a toda la plataforma SaaS**:
- Acceso global a **todas las instituciones registradas**.
- Consulta de **todos los expedientes**.
- Acceso global a **todas las bandejas y módulos**.
- **Visualización de documentos** y **descarga de documentos de cualquier institución** mediante streaming backend.
- **Administración global de usuarios y cuentas de plataforma**, configuraciones SaaS, consulta de auditorías y trazabilidad global, y supervisión de operaciones y servicios de plataforma.
- **Acceso privilegiado propio de plataforma:** Consulta y descarga técnica de cualquier expediente para soporte, auditoría de infraestructura y fiscalización bajo MFA y bitácora SaaS, sin requerir asignación de `#32` en el catálogo institucional ni autorización del `DIRECTOR`.
- **Separación innegociable entre acceso privilegiado propio y concesión institucional:** La facultad de acceso técnico global propio **NO significa autorización institucional automática para conceder discrecionalmente el permiso #32 a cuentas institucionales** de cualquier usuario. La concesión de `#32` a funcionarios internos es una competencia privativa de gobierno del `DIRECTOR` (o Autoridad Superior acreditada), ejecutada técnicamente por el `ADMINISTRADOR`. Si el Superadministrador interviene en la tabla operativa de autorizaciones institucionales por contingencia de plataforma (`es_superadmin_saas = TRUE`), lo hace delimitando estrictamente el `institucion_id` específico (cero comodines/wildcards), respetando la elegibilidad de roles y motivando formalmente la causa, sin asumir funciones directivas institucionales.

**Límites confirmados (`CONFIRMADO`):**
- **No está limitado** por los ámbitos institucionales `AREA`, `UNIDAD`, `TITULAR` ni `INSTITUCIÓN` del RBAC institucional.
- **No depende de autorización previa emitida por el `DIRECTOR`** de cada institución para ejercer sus facultades globales confirmadas.
- **Cero competencia jurídica institucional:** El acceso global de plataforma **NO concede facultad ni autoridad jurídica para aprobar trámites institucionales, proyectar ni firmar digitalmente Resoluciones Directorales ni ejecutar cierres administrativos de expedientes** (`EXPEDIENTE_APROBAR`, `RESOLUCION_FIRMAR`, `FIRMA_FIRMAR`, `EXPEDIENTE_CERRAR`, `EXPEDIENTE_ARCHIVAR`). No es un rol legal sustituto ni se crea ningún rol #11 superior.

---

## 2. BRECHAS VERIFICADAS Y DOCUMENTACIÓN DE NOMENCLATURA HEREDADA (CERO INVENCIÓN)

La inspección estática de [`backend/migraciones/01`..`21`](file:///c:/Users/Liz/Desktop/SIGD/SIGD/backend/migraciones/02_sigd_auth.sql) y [`backend/src`](file:///c:/Users/Liz/Desktop/SIGD/SIGD/backend/src/core/auth/jwt.service.ts) demuestra:

1. **Inexistencia actual de esquema `sigd_saas` y tabla multi-tenant (`PROPUESTO` / brecha verificada):** No existen actualmente en PostgreSQL el esquema `sigd_saas`, tablas de instituciones/tenants (`institucion`), columnas `institucion_id` en tablas institucionales, ni tablas de cuentas/MFA dedicadas para operadores de plataforma SaaS. **Regla obligatoria de base de datos:** cuando `sigd_saas` se implemente, deberá pertenecer **a la misma base de datos `sigd_jacobo_demo`** como un esquema separado (prohibido crear una segunda base de datos).
2. **Inexistencia actual de MFA y separación JWT de plataforma (`PARCIAL` / brecha verificada):** [`02_sigd_auth.sql:91-103`](file:///c:/Users/Liz/Desktop/SIGD/SIGD/backend/migraciones/02_sigd_auth.sql#L91-L103) modela `sigd_auth.cuenta_usuario` ligada obligatoriamente a `sigd_auth.persona (id_persona NOT NULL)` y sin campos MFA/TOTP; [`jwt.service.ts:4-12`](file:///c:/Users/Liz/Desktop/SIGD/SIGD/backend/src/core/auth/jwt.service.ts#L4-L12) (`ClaimsJwt`, `IMPLEMENTADO`) solo transporta `sub`, `roles[]`, `ctx`, `rol` y `typ: 'access'`, sin claim de dominio (`scope: 'SAAS_PLATFORM'`) ni estado `mfaVerificado`.
3. **Nomenclatura heredada en código fuente y evidencias anteriores (sin modificar código en Fase A0):**
   - En código fuente (`IMPLEMENTADO` / `PARCIAL`) existen únicamente referencias residuales heredadas al literal `'SUPER_ADMIN'` en [`reportes.controller.ts:49,145`](file:///c:/Users/Liz/Desktop/SIGD/SIGD/backend/src/domains/corelink/reportes.controller.ts#L49), [`tesoreria.rules.ts:31`](file:///c:/Users/Liz/Desktop/SIGD/SIGD/backend/src/domains/tesoreria/tesoreria.rules.ts#L31), [`lecturas.controller.ts:12`](file:///c:/Users/Liz/Desktop/SIGD/SIGD/backend/src/domains/rutadoc/lecturas.controller.ts#L12) y componentes frontend heredados (`AppRouter.tsx`, `ProtectedRoute.tsx`, `rbacRoles.ts`, `LoginPage.tsx`, `HeaderInstitucional.tsx`, `HomePage.tsx`), mientras [`adminMaestras.routes.ts:50`](file:///c:/Users/Liz/Desktop/SIGD/SIGD/backend/src/domains/organicore/adminMaestras.routes.ts#L50) ya rechaza explícitamente `'SUPER_ADMIN'` como rol ficticio inexistente en `sigd_org.rol_sistema`. Estas referencias heredadas deben erradicarse del RBAC institucional en **Fases B y C** sin alterar código durante Fase A0.
   - En evidencias históricas anteriores a esta consolidación (`V1.2.1`, `DEC-02`, borradores previos) figuran menciones históricas a denominaciones hoy superadas; se conservan intactas únicamente como registro documental histórico heredado y quedan sustituidas en toda especificación vigente por **`SUPER_ADMIN_PLATAFORMA`**.
4. **Incompatibilidad de `sigd_audit.bitacora_auditoria` y alcance de `bitacora_acceso_documental`:** [`01_sigd_audit.sql:27-29`](file:///c:/Users/Liz/Desktop/SIGD/SIGD/backend/migraciones/01_sigd_audit.sql#L27-L29) restringe `bitacora_auditoria` a `INSERT`/`UPDATE`/`DELETE` sobre tablas, mientras la bitácora documental institucional propuesta (`bitacora_acceso_documental`) exige `rol_activo` y `usuario_id` en `sigd_auth.cuenta_usuario`.

---

## 3. SEPARACIÓN ARQUITECTÓNICA RESPECTO AL RBAC INSTITUCIONAL (`PROPUESTO`)

### 3.1. Principios Estructurales Innegociables (`CONFIRMADO`)

El dominio de autorización de **`SUPER_ADMIN_PLATAFORMA`** pertenece exclusivamente a la **capa global de plataforma SaaS** y **NUNCA**:
1. Es el rol institucional número `11`.
2. Debe insertarse en `sigd_org.rol_sistema` ni modificar `chk_rol_codigo` (cerrado en `10` roles institucionales vigentes + `4` históricos).
3. Utiliza `sigd_org.rol_permiso` ni depende del permiso institucional `#32 EXPEDIENTE_DESCARGAR`.
4. Hereda privilegios institucionales mediante acumulación automática de roles o `usuario_capacidad`.
5. Utiliza un contexto institucional `claims.ctx` (`sigd_org.usuario_rol`) para obtener o escalar privilegios globales SaaS.
6. Puede aprobar trámites institucionales, firmar resoluciones institucionales ni cerrar expedientes por competencia administrativa.

### 3.2. Arquitectura Propuesta del Dominio SaaS (`PROPUESTO` dentro de `sigd_jacobo_demo`)

1. **Esquema y catálogo de plataforma independiente (`sigd_saas` en `sigd_jacobo_demo` — `PROPUESTO`):**
   - `sigd_saas.institucion`: registro maestro multi-institución (`institucion_id UUID PK`, código modular/RUC, razón social, estado `ACTIVA`/`SUSPENDIDA`).
   - `sigd_saas.cuenta_super_admin_plataforma`: identidades globales independientes (`id_super_admin UUID PK`, usuario, correo corporativo, `password_hash` Argon2id, `activo BOOLEAN`, `mfa_obligatorio BOOLEAN NOT NULL DEFAULT TRUE`, `mfa_secreto_cifrado TEXT`, `mfa_habilitado BOOLEAN`, fechas de creación/desactivación/revocación). Separada de `sigd_auth.cuenta_usuario` para aislar compromisos entre plataforma y tenant institucional.
   - `sigd_saas.sesion_super_admin_plataforma`: sesiones de plataforma con revocación en vivo (`id_sesion_saas UUID PK`, `id_super_admin FK`, `refresh_token_hash`, `mfa_verificado BOOLEAN NOT NULL`, `mfa_verificado_en TIMESTAMPTZ`, `ip_origen`, `user_agent`, `expira_en`, `revocado_en`, `motivo_revocacion`).
   - `sigd_saas.alcance_privilegio_plataforma`: matriz declarativa de capacidades globales SaaS (`PLATAFORMA_TENANTS_ADMIN`, `PLATAFORMA_LECTURA_GLOBAL`, `PLATAFORMA_DESCARGA_GLOBAL`, `PLATAFORMA_CONFIG_GLOBAL`, `PLATAFORMA_USUARIOS_GLOBAL`, `PLATAFORMA_AUDITORIA_GLOBAL`, `PLATAFORMA_MONITOREO_SERVICIOS`), **nunca** códigos de `sigd_org.permiso_sistema`.
   - **Decisión cerrada de alcance en migraciones (`22_` -> `23_` -> `24_+`, sin FKs rotas):** Ni `22_` ni `23_` crean todavía el esquema `sigd_saas.*` ni sus endpoints; `23_` incorpora únicamente `sigd_audit.bitacora_superadmin_saas` (`PROPUESTO` / `NO EJECUTADO`), registrando el actor SaaS mediante `super_admin_id UUID NOT NULL`, `sesion_saas_id UUID`, `institucion_id UUID` y atributos escalares validados por backend **sin claves foráneas ni dependencias DDL hacia tablas inexistentes de `sigd_saas.*`**. La creación del esquema `sigd_saas.*` (cuentas de plataforma, sesiones SaaS, MFA, tenants, endpoints `/api/v1/saas/*`) y las claves foráneas correspondientes hacia sus tablas de identidad quedan cerradas para migraciones controladas posteriores (`24_+`) dentro de la misma base `sigd_jacobo_demo` (prohibida una segunda base de datos).
2. **Emisión y validación de token SaaS en Backend (`PROPUESTO`, Política B estricta):**
   - El endpoint dedicado de autenticación SaaS (`/api/v1/saas/auth/login` + paso obligatorio `/api/v1/saas/auth/mfa/verify`) exige verificación MFA antes de emitir token con claim explícito `scope: 'SAAS_PLATFORM'` y `sid` (ID de `sesion_super_admin_plataforma`).
   - El middleware dedicado `exigirSuperAdminPlataforma` **NO reutiliza** `obtenerAutorizacionCuenta` del RBAC institucional; en **cada petición protegida** consulta PostgreSQL (`sigd_saas.cuenta_super_admin_plataforma` + `sigd_saas.sesion_super_admin_plataforma`) verificando `activo = TRUE`, `mfa_verificado = TRUE`, `revocado_en IS NULL`, `expira_en > now()` y privilegio vigente (`Política B`: cualquier desactivación de cuenta o revocación bloquea al instante la siguiente petición protegida con `401`/`403`).
3. **Acceso documental vía Backend Streaming (`CONFIRMADO` + `PROPUESTO`):**
   - Las consultas multi-institución (`/api/v1/saas/instituciones/:instId/expedientes`), visualizaciones (`/api/v1/saas/documentos/:docId/visualizar`) y descargas (`/api/v1/saas/documentos/:docId/download`) pasan **obligatoriamente por backend con streaming/proxy S3 directo** (`Content-Disposition: inline` / `attachment`, `Cache-Control: no-store`), **prohibiendo emitir URLs prefirmadas MinIO hacia el cliente** y aplicando auditoría previa en `sigd_audit.bitacora_superadmin_saas`.

---

## 4. MATRIZ COMPARATIVA: `SUPER_ADMIN_PLATAFORMA` VS. `ADMINISTRADOR` (`CONFIRMADO`)

| Facultad / Dimensión | `SUPER_ADMIN_PLATAFORMA` *(Dominio Plataforma SaaS)* | `ADMINISTRADOR` *(Rol #1 RBAC Institucional)* |
|---|---|---|
| **Ámbito** | **Toda la plataforma SaaS** (multi-institución sin restricción `AREA`/`UNIDAD`/`INSTITUCION`). | **Exclusivamente su propia institución (`institucion_id`)**, sin acceso cruzado a otras instituciones. |
| **Fuente de autorización** | Esquema independiente `sigd_saas` dentro de `sigd_jacobo_demo` + MFA verificado (`PROPUESTO`). | `sigd_org.usuario_rol` + `rol_permiso` + `claims.ctx = ADMINISTRADOR` (`IMPLEMENTADO` / `PARCIAL`). |
| **Consultar expedientes** | **Todos** (de cualquier institución registrada en la plataforma). | **Todos los de su propia institución** (`EXPEDIENTE_LEER` con `ambito = 'GLOBAL'` en el catálogo relacional institucional acotado estrictamente a su propia institución, sin acceso cruzado a otros tenants, sin alterar custodio/responsable/estado). |
| **Visualizar documentos** | **Todos** (streaming backend `/saas/documentos/:id/visualizar`, auditado en bitácora SaaS). | **Todos los de su institución** (streaming backend `/storage/documentos/:id/visualizar` + bitácora institucional). |
| **Descargar documentos** | **Sí — globalmente** vía streaming backend + auditoría SaaS obligatoria + justificación si confidencial. No usa `#32` ni `autorizacion_descarga_excepcional`. | **NO por defecto** (`EXPEDIENTE_DESCARGAR` ausente); solo mediante `autorizacion_descarga_excepcional` otorgada por tercero competente (`<= 15 min`), prohibida la auto-autorización. |
| **Administración global de plataforma** | **Sí** (cuentas/usuarios de plataforma, tenants, configuraciones SaaS, auditorías globales, monitoreo de operaciones y servicios). | **No**. |
| **Administración institucional** | **Según ámbito global de plataforma** (soporte, aprovisionamiento y supervisión multi-institución). | **Según facultades institucionales** (`ADMIN_USUARIOS`, catálogos, TUPA, asignación de roles/capacidades dentro de su institución). |
| **Aprobación/firma/cierre institucional** | **No** (sin competencia jurídica institucional). | **No** (`FIRMA_FIRMAR` y `EXPEDIENTE_RESOLVER` retirados explícitamente en `22_`). |

---

## 5. SEGURIDAD OBLIGATORIA Y AUDITORÍA PRIVILEGIADA SAAS (`CONFIRMADO` + `PROPUESTO`)

### 5.1. Controles de Seguridad Obligatorios (`CONFIRMADO`)
1. **MFA obligatorio:** Todo acceso de `SUPER_ADMIN_PLATAFORMA` requiere segundo factor verificado (`TOTP` / hardware key) vinculado a la sesión activa (`mfa_verificado = TRUE`).
2. **Identificación inequívoca:** La cuenta de plataforma (`id_super_admin`, `usuario_plataforma`, huella de sesión) nunca comparte credenciales ni identidad genérica.
3. **Justificación obligatoria para documentos/información confidencial:** Si el expediente o documento posee marca de reserva/confidencialidad, el endpoint `/saas/documentos/:id/visualizar`, `/download` o consulta confidencial rechaza con `400`/`422` si no se envía `motivo_acceso_confidencial` válido (`>= 15` caracteres), registrándolo íntegramente en bitácora.
4. **Revocación inmediata (Política B):** Desactivar la cuenta de plataforma (`activo = FALSE`), revocar un privilegio SaaS o revocar su sesión invalida la sesión de inmediato; toda nueva petición HTTP protegida posterior queda bloqueada al instante en PostgreSQL (sin poder recuperar bytes ya entregados al navegador antes de la revocación).
5. **Alertas ante descargas masivas o actividades anómalas (`PROPUESTO`):** Detección automática en worker/SIEM sobre umbrales de descargas por ventana temporal, acceso multi-institución atípico fuera de horario o descarga secuencial masiva con notificación a Oficial de Seguridad / Compliance.

### 5.2. Decisión Arquitectónica: Separación de Auditoría Institucional vs. Auditoría Privilegiada SaaS (`PROPUESTO` en `23_`)

**Se resuelve separar físicamente ambas bitácoras en dos tablas dedicadas dentro de `sigd_audit`**, en lugar de mezclarlas en una sola tabla:

| Criterio | `sigd_audit.bitacora_acceso_documental` *(Auditoría Institucional — `23_`)* | `sigd_audit.bitacora_superadmin_saas` *(Auditoría Privilegiada SaaS — `23_`)* |
|---|---|---|
| **Público y actor** | Usuarios institucionales y externos (`sigd_auth.cuenta_usuario`: 10 roles + `GESTOR_APOYO_AREA`). | Exclusivamente operadores `SUPER_ADMIN_PLATAFORMA` (`super_admin_id`). |
| **Integridad referencial** | FK estricta a `cuenta_usuario`, `sesion_usuario`, `rol_activo` e `id_usuario_rol` / `contexto_activo_id` institucional. | Identidad independiente de plataforma (`super_admin_id`, `usuario_plataforma`, `sesion_saas_id`, `mfa_verificado`), sin falsificar `rol_activo` institucional. |
| **Campos obligatorios específicos** | `autorizacion_excepcional_id`, `motivo_autorizacion_excepcional`, `expediente_id`, `documento_id`, `s3_bucket`, `s3_key`. | **Institución visitada (`institucion_id` + código), expediente consultado, documento visualizado/descargado, `justificacion_confidencial`, `indicador_anomalia`, `mfa_verificado`, `correlation_id`, `fecha_hora`, `resultado`, `codigo_http`**. |
| **Consultabilidad e independencia** | Consultable por `ADMINISTRADOR`/`DIRECTOR` dentro de su institución (nunca ve otros tenants). | Retención aislada de alto privilegio para auditoría global, alertas SIEM y trazabilidad por institución visitada sin contaminar métricas/bandejas ni exponer PII entre tenants. |

### 5.3. Limitación Técnica Honesta sobre Inmutabilidad frente a Superusuarios (`CONFIRMADO`)
- Aunque `sigd_audit.bitacora_superadmin_saas` y `sigd_audit.bitacora_acceso_documental` incorporan triggers `BEFORE UPDATE OR DELETE OR TRUNCATE` y revocación de `UPDATE`/`DELETE`/`TRUNCATE` para los roles de aplicación, **PostgreSQL por sí solo no garantiza inmutabilidad absoluta frente a un superusuario de base de datos o administrador de infraestructura del host**.
- Para mitigar la alteración privilegiada en servidor, el diseño exige **replicación asíncrona continua (shipping append-only) hacia un almacenamiento WORM/SIEM externo** fuera del alcance administrativo de las credenciales de base de datos, además de correlación por `correlation_id` y alertas en tiempo real.

### 5.4. Procedimiento y Auditoría de Otorgamiento y Revocación del Permiso #32 por SaaS (`CONFIRMADO` — Diseñado / Propuesto)
- Cuando `SUPER_ADMIN_PLATAFORMA` realiza directamente asignaciones, modificaciones o revocaciones de `EXPEDIENTE_DESCARGAR` para un rol en cualquier institución registrada de la plataforma, la operación se ejecuta en `sigd_org.autorizacion_rol_permiso_institucional` marcando `es_superadmin_saas = TRUE`, `tipo_autoridad_otorgante = 'SUPER_ADMIN_PLATAFORMA'`, consignando su identificador de plataforma `super_admin_id`, y dejando `autoridad_otorgante_id = NULL` y `ejecutor_tecnico_id = NULL` (dado que el operador SaaS no posee ni requiere cuenta en `sigd_auth.cuenta_usuario`).
- **Aislamiento Multi-tenant Estricto (Sin Comodines / Wildcards):** Toda operación del Superadministrador sobre `#32` se delimita estrictamente a nivel de la institución beneficiaria específica (`institucion_id`). Queda prohibida la creación de asignaciones transversales o comodín que apliquen indistintamente a múltiples instituciones.
- **Requisitos obligatorios innegociables:**
  1. Identificación unívoca del actor privilegiado (`super_admin_id`).
  2. Delimitación exacta por institución (`institucion_id UUID NOT NULL`, en mono-tenant actual almacena el ID de Suiza sin FK a tabla inexistente; la FK a `sigd_saas.institucion` es propuesta futura para `24_+`), rol (`rol_id`), permiso (`permiso_id = 5b010000-0000-4000-8000-000000000016`) y contexto orgánico (`contexto_autorizado_id` en `sigd_org.area`).
  3. Respeto de los dos índices de unicidad parciales propuestos (`uq_auth_rol_permiso_activa_ctx` y `uq_auth_rol_permiso_activa_global`) y del mecanismo de serialización concurrente de 64 bits con llave común unificada mediante `pg_advisory_xact_lock(hashtextextended('auth_rol_permiso:' || rol_id || ':' || permiso_id, 0::bigint))` en el trigger propuesto `tr_validar_autorizacion_rol_permiso_inst` (ejecutado antes de comprobar incompatibilidades, protegiendo INSERT, UPDATE y DELETE, con inmutabilidad de identidad).
  4. Justificación institucional/técnica obligatoria ($\ge 15$ caracteres).
  5. Verificación obligatoria de segundo factor MFA comprobada estrictamente en el servidor desde su fuente de autenticación confiable (nunca a partir de un valor booleano o cabecera enviado por el frontend). La tabla `sigd_audit.bitacora_superadmin_saas` es una estructura propuesta en `23_` (no implementada) que persistirá la evidencia obligatoria: identidad autenticada (`super_admin_id`, `usuario_plataforma`), método MFA (`metodo_mfa`), timestamp de verificación (`mfa_verificado_en`), sesión privilegiada (`sesion_saas_id`) y referencia o huella del evento de autenticación en servidor (`mfa_evento_ref`), reconociendo que un `CHECK (mfa_verificado = TRUE)` no constituye por sí solo una prueba criptográfica de MFA. La tabla operativa `sigd_org.autorizacion_rol_permiso_institucional` no posee la columna `mfa_verificado`.
  6. Registro append-only en `sigd_audit.bitacora_superadmin_saas` bajo los tipos de evento `'SAAS_OTORGAMIENTO_PERMISO_GLOBAL'` o `'SAAS_REVOCACION_PERMISO_GLOBAL'`.
  7. Captura del estado anterior y posterior en payload de auditoría (`datos_antes`, `datos_despues`).
  8. Trazabilidad suficiente para reconstruir cronológicamente cada paso de la operación sin depender de la intervención del `DIRECTOR` ni del `ADMINISTRADOR`.
  9. Cero atribución de facultades legales para firmar resoluciones institucionales o resolver expedientes administrativos.
