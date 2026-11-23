# SIGD IESTP PÚB. «SUIZA» — TSK-1.2 (FASE 0)
# INFORME DE PREIMPLEMENTACIÓN Y PREPARACIÓN TÉCNICA DEL CATÁLOGO INSTITUCIONAL RBAC

**Institución:** Instituto de Educación Superior Tecnológico Público «Suiza» — Pucallpa, Ucayali  
**Rama Git exclusiva:** `B_JACOBO`  
**Entorno único:** Entorno aislado `B_JACOBO`  
**Base de datos oficial:** `sigd_jacobo_demo` (PostgreSQL 18.6 Alpine)  
**Fecha de corte:** 2026-11-12  
**Estado:** **FASE 0 CONCLUIDA — DETENIDO EN PUNTO DE AUTORIZACIÓN OBLIGATORIO (CERO MUTACIONES EN BD Y CÓDIGO)**

---

## CERTIFICACIÓN PREVIA DE INMUTABILIDAD EN FASE 0

> [!IMPORTANT]
> **CUMPLIMIENTO ESTRICTO DE RESTRICCIONES:**
> - **PostgreSQL (`sigd_jacobo_demo`):** Cero sentencias DDL, cero DML, cero migraciones ejecutadas. Solo consultas `SELECT` y `pg_dump` lógico externo.
> - **Código fuente (`backend/`, `frontend/`):** Cero archivos modificados, creados o eliminados.
> - **Git:** Cero `reset`, `clean`, `checkout`, `rebase`, `merge`, `commit` o `push`.
> - **Docker / Entorno:** Cero reinicios de contenedores, cero bases paralelas, cero clones, cero entornos adicionales.
> - **Credenciales:** Cero contraseñas o cadenas de conexión sensibles expuestas.

---

## 0. VERIFICACIÓN EFECTIVA DE POSTGRESQL (SECCIÓN 6.1)

| Parámetro | Valor verificado en solo lectura |
|---|---|
| **Archivo de configuración backend** | [`backend/.env`](file:///c:/Users/Liz/Desktop/SIGD/SIGD/backend/.env) (credenciales omitidas) |
| **Motor efectivo** | PostgreSQL 18.6 (`x86_64-pc-linux-musl`, Alpine Linux 64-bit) |
| **Contenedor Docker** | `sigd-postgres-1` (`Up`, estado `healthy`) |
| **Host / Puerto externo** | `127.0.0.1:5433` (interno contenedor: `172.20.0.3:5432`) |
| **Base de datos efectiva (`current_database()`)** | `sigd_jacobo_demo` (correspondencia 100 % con `B_JACOBO`) |
| **Esquemas existentes** | `public`, `sigd_audit`, `sigd_auth`, `sigd_doc`, `sigd_org`, `sigd_rut`, `sigd_tes`, `sigd_tra` |
| **Áreas vigentes en `sigd_org.area`** | `3` áreas nivel 1: `DG` (Dirección General), `MP` (Mesa de Partes), `SEC` (Secretaría Académica) |
| **Tablas de capacidades / evaluadores en BD** | `sigd_org.capacidad_sistema` = `null`, `sigd_org.capacidad_permiso` = `null`, `sigd_org.usuario_capacidad` = `null`, `sigd_rut.expediente_evaluador` = `null`, `sigd_doc.expediente_asignacion` = `null` |

---

## 1. ROLES EXISTENTES Y ROLES FALTANTES (CONCILIACIÓN CONTRA CATÁLOGO CANÓNICO DE 10 ROLES)

De la consulta directa a `sigd_org.rol_sistema` en `sigd_jacobo_demo`, existen **10 filas totales** (7 con `vigente = TRUE` y 3 con `vigente = FALSE`):

### 1.1. Roles Canónicos Ya Existentes en BD (6 de 10)

| # | Código | Tipo | Nombre actual en BD | `vigente` | Asignaciones totales / vigentes |
|---:|---|---|---|---|---:|
| 1 | `ADMINISTRADOR` | Interno | Administrador del Sistema | `TRUE` | 4 / 4 |
| 2 | `DIRECTOR` | Interno | Director | `TRUE` | 3 / 3 |
| 3 | `SECRETARIO` | Interno | Secretario Académico | `TRUE` | 1 / 1 |
| 4 | `MESA_PARTES` | Interno | Mesa de Partes | `TRUE` | 1 / 1 |
| 5 | `TESORERO` | Interno | Tesorero | `TRUE` | 1 / 1 |
| 6 | `CIUDADANO` | Externo | Ciudadano | `TRUE` | 36 / 36 |

### 1.2. Roles Canónicos Faltantes en BD (4 de 10 — Verificado por `SELECT`)

Los **cuatro (4) roles** que realmente faltan insertar en `sigd_org.rol_sistema` son exactamente:

1. **`JEFE_UNIDAD_ACADEMICA`** (Interno — Supervisión de Unidad Académica; ámbito `AREA` obligatorio de unidad académica).
2. **`COORDINADOR_AREA`** (Interno — Coordinador de programa de estudios / área académica; ámbito `AREA` obligatorio).
3. **`DOCENTE`** (Interno — Personal docente evaluador o solicitante interno; ámbito `AREA` obligatorio).
4. **`ESTUDIANTE`** (Interno — Estudiante del IESTP «Suiza»; **rol interno** con acceso por titularidad `solicitante_id` / `area_id IS NULL`).

### 1.3. Roles Históricos No Canónicos Presentes en BD (4 filas)

| Código | Nombre en BD | `vigente` actual | Asignaciones totales / vigentes | Estado frente al catálogo aprobado |
|---|---|---|---:|---|
| `ESPECIALISTA` | Especialista | `TRUE` | 6 / 4 | **Debe pasar a `vigente = FALSE`** (sujeto a tratamiento de sus 6 asignaciones por Dirección; nunca `DELETE`). |
| `CAJERO` | Cajero | `FALSE` | 0 / 0 | Ya inactivo (`vigente = FALSE`). Conservar fila histórica sin borrar. |
| `APROBADOR_DEVOLUCIONES` | Aprobador de devoluciones | `FALSE` | 0 / 0 | Ya inactivo (`vigente = FALSE`). Conservar fila histórica sin borrar. |
| `SUPERVISOR_TESORERIA` | Supervisor de Tesorería | `FALSE` | 0 / 0 | Ya inactivo (`vigente = FALSE`). Conservar fila histórica sin borrar. |

### 1.4. Hallazgo Crítico de Restricción de Catálogo (`chk_rol_codigo`)

La tabla `sigd_org.rol_sistema` posee la restricción vigente:
```sql
CONSTRAINT chk_rol_codigo CHECK (
  codigo::text = ANY (ARRAY[
    'ADMINISTRADOR', 'DIRECTOR', 'SECRETARIO', 'ESPECIALISTA', 'MESA_PARTES', 'CIUDADANO',
    'CAJERO', 'TESORERO', 'SUPERVISOR_TESORERIA', 'APROBADOR_DEVOLUCIONES'
  ]::text[])
)
```
**Consecuencia:** Cualquier `INSERT` de `JEFE_UNIDAD_ACADEMICA`, `COORDINADOR_AREA`, `DOCENTE` o `ESTUDIANTE` **fallará con error SQL `23514`** mientras no se amplíe `chk_rol_codigo` conservando los códigos históricos para las filas inactivas.

---

## 2. UUID QUE DEBEN CONSERVARSE INTEGRALMENTE

Ninguna migración debe reemplazar ni regenerar los UUID existentes en `sigd_jacobo_demo`:

### 2.1. UUID de `sigd_org.rol_sistema` (Todos los 10 roles existentes)

| Código | `rol_id` (UUID oficial en `sigd_jacobo_demo`) | Acción en Fase A |
|---|---|---|
| `ADMINISTRADOR` | `d8cfb14a-efbf-4808-b25f-041681e04710` | Conservar UUID y `vigente = TRUE` |
| `DIRECTOR` | `bdb75c0c-6d3a-4801-8d3a-41084b26f926` | Conservar UUID y `vigente = TRUE` |
| `SECRETARIO` | `094f11be-e747-4da4-a3aa-170e721ded8c` | Conservar UUID y `vigente = TRUE` |
| `MESA_PARTES` | `7692b3dc-4066-4184-a052-dd715b5eb9e2` | Conservar UUID y `vigente = TRUE` |
| `TESORERO` | `9b5471ec-6901-4d92-893f-ed51a90fe9d4` | Conservar UUID y `vigente = TRUE` |
| `CIUDADANO` | `97069c21-17c5-4438-b0d0-293aac2c18e9` | Conservar UUID y `vigente = TRUE` |
| `ESPECIALISTA` | `94ae72fb-0b86-4a6f-ba78-69b19bc888e7` | Conservar UUID (histórico; transición a `vigente = FALSE` cuando Dirección autorice) |
| `CAJERO` | `aa1a372e-296c-487f-9f0a-86ef68d45741` | Conservar UUID con `vigente = FALSE` |
| `APROBADOR_DEVOLUCIONES` | `444b6f5d-6c69-4edd-b641-c6b2c357d268` | Conservar UUID con `vigente = FALSE` |
| `SUPERVISOR_TESORERIA` | `c86ad9e6-1391-4a5f-b2b6-d447826914a8` | Conservar UUID con `vigente = FALSE` |

### 2.2. UUID de `sigd_org.permiso_sistema` (Todos los 16 permisos reales)

| Código | `permiso_id` (UUID oficial en `sigd_jacobo_demo`) | `ambito` |
|---|---|---|
| `ADMIN_USUARIOS` | `ef5b2eff-caff-4479-a88a-c497eed32a2f` | `GLOBAL` |
| `EXPEDIENTE_DERIVAR` | `0c89fdb7-687c-4e0d-ab70-9423e3c9a05f` | `AREA` |
| `EXPEDIENTE_LEER` | `e6066e88-c8a5-4219-9526-87a2ac5253ae` | `GLOBAL` |
| `EXPEDIENTE_RESOLVER` | `797a084e-6c20-491d-83bf-e5c9fddaa6ab` | `AREA` |
| `FIRMA_FIRMAR` | `ce9e31be-9118-4960-b4ea-7c3e4340fb95` | `GLOBAL` |
| `REPORTE_LEER` | `20be03cf-f5b5-47dd-85ff-05456284e56f` | `GLOBAL` |
| `TRAMICORE_DEVOLUCION_EVALUAR` | `ef2d638c-a0a2-41b2-9047-e9b8a9f320ea` | `GLOBAL` |
| `TESORERIA_DEVOLUCION_APROBAR` | `b622ee1f-8a4a-48c8-9d60-6a5ebf0c7594` | `GLOBAL` |
| `TESORERIA_DEVOLUCION_EJECUTAR` | `0c93586b-1758-4710-8999-7eb8994a9913` | `GLOBAL` |
| `TESORERIA_DEVOLUCION_EVALUAR` | `ec5d0774-b080-458e-8862-acec3cd8e7ef` | `GLOBAL` |
| `TESORERIA_LEER` | `922f42fa-a7ee-45b0-a568-ffa57e210714` | `GLOBAL` |
| `TESORERIA_PAGO_REGISTRAR` | `35945cdd-401f-4582-b7fa-c3d19275a576` | `GLOBAL` |
| `TESORERIA_PAGO_VERIFICAR` | `b0c26b70-fc34-4359-b3b1-96a1c17f9202` | `GLOBAL` |
| `TESORERIA_REPORTES` | `9a71a1fe-0c2e-4c13-9c65-067a2bb6bf4b` | `GLOBAL` |
| `TESORERIA_TARIFA_PROPONER` | `dff4e592-1299-49ad-a860-9eab151be203` | `GLOBAL` |
| `TESORERIA_TARIFA_VALIDAR` | `a06cdc2b-3ffb-420e-961c-ef2a5899d944` | `GLOBAL` |

### 2.3. UUID de `sigd_org.area` y de Asignaciones Históricas `ESPECIALISTA`

- **Áreas vigentes:** `DG` (`05f2ee8f-c90f-4239-898c-3ac113afc424`), `MP` (`a1a3a496-ff7f-45d8-b63c-3e54fcf79de1`), `SEC` (`2b147b0d-7c8f-434f-b75a-598a1ccb855b`).
- **Las 6 filas `id_usuario_rol` de `ESPECIALISTA`:** Se listan en la sección 3 y **se conservan intactas como historial**.

---

## 3. MATRIZ DE IMPACTO DE LAS SEIS (6) ASIGNACIONES `ESPECIALISTA`

> [!NOTE]
> En Fase 0 **no se reasignó ni desactivó** ninguna asignación ni el rol `ESPECIALISTA`. Se realizó un escaneo forense de todas las columnas UUID de todos los esquemas `sigd_*`: ninguna tabla apunta por FK o UUID a `id_usuario_rol`; todas las dependencias documentales/auditoría apuntan a `id_usuario`.

| # | `id_usuario_rol` | Usuario (`id_usuario`) | Área | Vigencia temporal real | Estado cuenta | Otros roles activos | Sesiones no revocadas | Dependencias reales en BD | Contextos afectados y consecuencia al desactivar `ESPECIALISTA` |
|---:|---|---|---|---|---|---|---|---|---|
| 1 | `ecb124c5-577d-4838-a3f0-5e343960b0e4` | `operador.demo` (`00000000-0000-0000-0000-000000000030`) | `SEC` | `2026-10-26T12:54:07Z` → `NULL` (**VIGENTE**) | `ACTIVA` | `1` (`SECRETARIO` en `SEC`, `id_usuario_rol = 2957a90a-72fd-4263-a222-3e4d51301157`) | 90 (0 sin expirar) | `sigd_doc.documento_adjunto`: 3; `sigd_doc.resolucion` (`proyectado_por`): 4; `sigd_audit.bitacora_auditoria`: 4; `operador_identidad`, `perfil_usuario`, `persona_natural` | Baja de **2 contextos a 1** (`SECRETARIO` en `SEC`). Sigue operativa sin bloqueo. Sus documentos y resoluciones proyectadas conservan autoría intacta en `id_usuario`. |
| 2 | `cbd75b3a-62b5-43eb-9780-989116c04ec4` | `especialista.demo` (`00000000-0000-0000-0000-000000000060`) | `SEC` | `2026-10-28T18:57:59Z` → `NULL` (**VIGENTE**) | `ACTIVA` | **0** | 17 (0 sin expirar) | `0` documentos, `0` resoluciones, `0` movimientos, `0` auditoría de negocio; solo identidad base | Pasa de **1 contexto a 0 contextos**. Al autenticar o renovar, `POST /api/v1/auth/login` devolverá **`403 ACCOUNT_WITHOUT_ROLES`** y su sesión actual fallará con `403 CONTEXT_REVOKED`. **Requiere decisión de Dirección** (asignar `DOCENTE`/`COORDINADOR_AREA`/`GESTOR_APOYO_AREA` o inactivar cuenta). |
| 3 | `bd029454-d24b-4a81-b497-a95c40ff562a` | `trabajador.h2.test` (`f6905305-582a-4871-af75-c8b961d70a9e`) | `DG` | `2026-11-04T13:03:56Z` → `2026-11-04T13:03:57Z` (**HISTÓRICA VENCIDA**) | `ACTIVA` | Solo la asignación #4 (`ESPECIALISTA` en `MP`) | 0 | `asignacion_personal` vencida (`DG`) y vigente (`MP`); 0 refs documentales | **Sin impacto en sesión** porque ya estaba vencida; debe preservarse para trazabilidad histórica. |
| 4 | `fabad752-6a79-40f4-ad26-f9809b4498e2` | `trabajador.h2.test` (`f6905305-582a-4871-af75-c8b961d70a9e`) | `MP` | `2026-11-04T13:03:57Z` → `NULL` (**VIGENTE**) | `ACTIVA` | **0** distintos a `ESPECIALISTA` | 0 | `asignacion_personal` activa (`18b17d04-...`, cargo `DIR_GEN` en `MP`); 0 refs documentales | Cuenta de prueba H2 queda **ACTIVA con 0 roles válidos** (`403 ACCOUNT_WITHOUT_ROLES` al autenticar). Dirección debe decidir si asigna `MESA_PARTES`/`COORDINADOR_AREA` o inactiva la cuenta de prueba. |
| 5 | `e3b2d13b-1d04-46f1-9e85-3ecd593bb8ff` | `trabajador.h2.5079` (`32a76ac3-31d4-40e0-9994-95a459ed5b01`) | `DG` | `2026-11-04T13:05:15Z` → `2026-11-04T13:05:15Z` (**HISTÓRICA VENCIDA**) | `INACTIVA` | Solo la asignación #6 (`ESPECIALISTA` en `MP`) | 0 | `asignacion_personal` vencida (`DG`) y vigente (`MP`); 0 refs documentales | **Sin impacto operativo** (asignación vencida y cuenta ya inactiva). Preservar historial. |
| 6 | `4bbd6ab4-5b53-4820-8f83-7e014bf62de4` | `trabajador.h2.5079` (`32a76ac3-31d4-40e0-9994-95a459ed5b01`) | `MP` | `2026-11-04T13:05:15Z` → `NULL` (**VIGENTE** en rango, rol a retirar) | `INACTIVA` | **0** | 0 | `asignacion_personal` activa (`a1d1b4b7-...`, cargo `DIR_GEN` en `MP`); 0 refs documentales | La cuenta ya está `INACTIVA`. Si se inactiva `ESPECIALISTA`, **no podrá reactivarse** (`400 ACTIVACION_SIN_ROLES`) sin que Dirección le asigne primero un rol del catálogo vigente. |

---

## 4. PERMISOS EXISTENTES Y MAPEO ACTUAL EN `rol_permiso`

En `sigd_jacobo_demo` existen exactamente **16 permisos** en `sigd_org.permiso_sistema`:

- **Administración y Documental Base (7):**
  - `ADMIN_USUARIOS` (`GLOBAL`)
  - `EXPEDIENTE_LEER` (`GLOBAL` en tabla, acotado contextualmente por `area_id` o titularidad)
  - `EXPEDIENTE_DERIVAR` (`AREA`)
  - `EXPEDIENTE_RESOLVER` (`AREA`)
  - `FIRMA_FIRMAR` (`GLOBAL`)
  - `REPORTE_LEER` (`GLOBAL`)
  - `TRAMICORE_DEVOLUCION_EVALUAR` (`GLOBAL`)
- **Tesorería (9 — exclusivos del dominio financiero M10):**
  - `TESORERIA_LEER`, `TESORERIA_REPORTES`, `TESORERIA_PAGO_REGISTRAR`, `TESORERIA_PAGO_VERIFICAR`, `TESORERIA_TARIFA_PROPONER`, `TESORERIA_TARIFA_VALIDAR`, `TESORERIA_DEVOLUCION_EVALUAR`, `TESORERIA_DEVOLUCION_APROBAR`, `TESORERIA_DEVOLUCION_EJECUTAR` (todos `GLOBAL`).

### Mapeo actual verificado en `sigd_org.rol_permiso`

| Rol | Cantidad | Permisos asignados actualmente en BD |
|---|---:|---|
| `ADMINISTRADOR` | 6 | `ADMIN_USUARIOS`, `EXPEDIENTE_DERIVAR`, `EXPEDIENTE_LEER`, `EXPEDIENTE_RESOLVER`, `FIRMA_FIRMAR`, `REPORTE_LEER` *(sin `TRAMICORE_DEVOLUCION_EVALUAR` ni `TESORERIA_*`)* |
| `DIRECTOR` | 4 | `EXPEDIENTE_LEER`, `EXPEDIENTE_RESOLVER`, `FIRMA_FIRMAR`, `REPORTE_LEER` |
| `SECRETARIO` | 3 | `EXPEDIENTE_DERIVAR`, `EXPEDIENTE_LEER`, `EXPEDIENTE_RESOLVER` |
| `ESPECIALISTA` *(hist.)* | 3 | `EXPEDIENTE_DERIVAR`, `EXPEDIENTE_LEER`, `EXPEDIENTE_RESOLVER` |
| `MESA_PARTES` | 3 | `EXPEDIENTE_DERIVAR`, `EXPEDIENTE_LEER`, `TRAMICORE_DEVOLUCION_EVALUAR` |
| `TESORERO` | 9 | Los 9 permisos `TESORERIA_*` *(**cero** `EXPEDIENTE_*`; aislado fuera de RutaDoc/DocuCore)* |
| `CIUDADANO` | 1 | `EXPEDIENTE_LEER` *(restringido por titularidad `solicitante_id` en backend)* |
| `CAJERO`, `APROBADOR_DEVOLUCIONES`, `SUPERVISOR_TESORERIA` | 2 / 3 / 4 | Permisos históricos `TESORERIA_*` sobre roles con `vigente = FALSE` |

---

## 5. EVALUACIÓN DE PERMISOS NUEVOS (3 FALTANTES + 7 CANDIDATOS + NOTA `EXPEDIENTE_ADJUNTAR`)

Ningún permiso nuevo ha sido creado aún en PostgreSQL. A continuación se evalúan los **3 permisos faltantes**, los **7 candidatos de granularización** y `EXPEDIENTE_ADJUNTAR` (ya referenciado en código existente), cumpliendo los **9 campos obligatorios** por permiso y evitando usar `EXPEDIENTE_RESOLVER` como comodín universal.

### 5.1. Evaluación de los 3 Permisos Faltantes (Brechas TSK-1.1B)

#### 1) `EXPEDIENTE_REGISTRAR`
- **Justificación:** Separa la radicación y registro formal de trámites en ventanilla/mesa virtual del enrutamiento (`EXPEDIENTE_DERIVAR`), eliminando validaciones frágiles por nombre de rol.
- **Operación correspondiente:** Radicación presencial en Mesa de Partes y registro autenticado de solicitudes.
- **Roles que lo necesitan:** `MESA_PARTES`, `ADMINISTRADOR` (en ventanilla); `DOCENTE`, `ESTUDIANTE`, `CIUDADANO` (para radicación autenticada propia vía titularidad, manteniendo el canal público anónimo PoW separado).
- **Ámbito:** `AREA` (ventanilla `MP` para operadores) / `GLOBAL` condicionado a autogeneración como titular (`solicitante_id = persona.id_persona`) para usuarios finales.
- **Endpoints afectados:** `POST /api/v1/tramites/ventanilla` (y alias `POST /api/v1/expedientes/radicar-presencial`), `POST /api/v1/tramites/radicacion-virtual`, `POST /api/v1/storage/presigned-url` (`EXPEDIENTE_INGRESO`).
- **Servicio que debe verificarlo:** `tramites.controller.ts` (`exigirOperadorVentanilla` → reemplazar check literal `MESA_PARTES`/`ADMINISTRADOR` por verificación de permiso; validar titularidad en `radicarVirtual`).
- **Riesgo de mantener el permiso actual:** Hoy `tramites.controller.ts` autoriza por `roles.includes('MESA_PARTES')` (ignorando capacidad delegada o cambios en la matriz RBAC) y `radicacion-virtual` no verifica permiso explícito del catálogo.
- **Riesgo de crear un permiso nuevo:** Mínimo; requiere mapearlo en `rol_permiso` para no bloquear ventanilla presencial ni radicación autenticada tras el despliegue de Fase B.
- **Recomendación técnica:** **APROBADO — CREAR EN FASE A E IMPLEMENTAR EN FASE B.**

#### 2) `DOCUMENTO_EDITAR`
- **Justificación:** Hoy la proyección y actualización de borradores de resoluciones y piezas documentales no suscritas comparten control laxo con `EXPEDIENTE_RESOLVER` / `EXPEDIENTE_DERIVAR`. Desacoplar `DOCUMENTO_EDITAR` impide confundir proyección/redacción con aprobación jurídica.
- **Operación correspondiente:** Proyección, actualización de contenido HTML/A4 y edición de metadatos de borradores en estado no firmado (`BORRADOR` / `BORRADOR_PENDIENTE_FIRMA`).
- **Roles que lo necesitan:** `SECRETARIO`, `COORDINADOR_AREA`, `JEFE_UNIDAD_ACADEMICA`, `DIRECTOR`, `ADMINISTRADOR` *(prohibido para `GESTOR_APOYO_AREA`, `DOCENTE`, `ESTUDIANTE`, `CIUDADANO`, `TESORERO`)*.
- **Ámbito:** `AREA` (o `GLOBAL` para `DIRECTOR`/`ADMINISTRADOR`).
- **Endpoints afectados:** `POST /api/v1/resoluciones/proyectar`, `PUT /api/v1/resoluciones/:id` (y futuro `PATCH` de `edicionResoluciones.service.ts`), `POST /api/v1/resoluciones/:id/reconstruir-pdf`.
- **Servicio que debe verificarlo:** `resoluciones.controller.ts` (`autorizarOperadorResolucion` + `obtenerProyecto`), `docucore.router.ts`, `resoluciones.service.ts`, `edicionResoluciones.service.ts`.
- **Riesgo de mantener el permiso actual:** Quien solo debe redactar o corregir un borrador hereda o depende de `EXPEDIENTE_RESOLVER` / `EXPEDIENTE_DERIVAR`, dificultando restringir la aprobación o el cierre definitivo.
- **Riesgo de crear un permiso nuevo:** Bajo; debe bloquearse explícitamente edición sobre documentos con `estado IN ('FIRMADA', 'FIRMADO_DIGITALMENTE', 'NOTIFICADA')` sin importar el rol.
- **Recomendación técnica:** **APROBADO — CREAR EN FASE A E IMPLEMENTAR EN FASE B.**

#### 3) `EXPEDIENTE_SUBSANAR`
- **Justificación:** En el código actual, `POST /api/v1/expedientes/:id/subsanar` cae bajo el middleware genérico de `derivaciones` en `rutadoc.router.ts` línea 117 que exige `EXPEDIENTE_RESOLVER` en área. Esto impide que ciudadanos, estudiantes o Mesa de Partes registren una subsanación.
- **Operación correspondiente:** Levantar observaciones (`OBSERVADO` → `SUBSANADO` / `EN_TRAMITE`) adjuntando descargos dentro del plazo legal.
- **Roles que lo necesitan:** `CIUDADANO` y `ESTUDIANTE` (exclusivamente sobre expedientes donde son `solicitante_id`), `MESA_PARTES` (recepción de subsanación presencial en área `MP`), `SECRETARIO`, `COORDINADOR_AREA`, `JEFE_UNIDAD_ACADEMICA`, `ADMINISTRADOR`.
- **Ámbito:** `AREA` (operadores en ventanilla/área del expediente) / **Titularidad estricta (`solicitante_id`)** para `CIUDADANO` y `ESTUDIANTE`.
- **Endpoints afectados:** `POST /api/v1/expedientes/:id/subsanar`, `POST /api/v1/expedientes/:id/movimientos/subsanar`.
- **Servicio que debe verificarlo:** `rutadoc.router.ts` (middleware específico separado de `EXPEDIENTE_RESOLVER`) + `derivaciones.controller.ts` (`handlerSubsanar`, que además debe validar titularidad u operador de área y estado `OBSERVADO`).
- **Riesgo de mantener el permiso actual:** **CRÍTICO.** Mantiene roto o inseguro el flujo de subsanación ciudadana/estudiantil (403 a solicitantes reales o exposición indebida de `EXPEDIENTE_RESOLVER`).
- **Riesgo de crear un permiso nuevo:** Mínimo; requiere en backend validar simultáneamente `EXPEDIENTE_SUBSANAR` y (`solicitante_id = personaId` para externos/estudiantes OR pertenencia al área del expediente para internos).
- **Recomendación técnica:** **APROBADO URGENTE — CREAR EN FASE A Y CORREGIR MIDDLEWARE EN FASE B.**

---

### 5.2. Evaluación de los 7 Candidatos de Granularización (+ `EXPEDIENTE_ADJUNTAR`)

#### 4) `EXPEDIENTE_RECEPCIONAR`
- **Justificación:** La recepción formal en área destino (`REGISTRADO` → `RECEPCIONADO` o `DERIVADO` → `EN_REVISION`) es una operación administrativa de cargo y apertura de plazo, distinta a derivar o resolver el fondo. Además ya está referenciada en `auth.guard.ts`, `contexto.service.ts` y `pendientes/20261111_tsk1_0_rbac_contextual.sql`.
- **Operación correspondiente:** Confirmación formal de ingreso físico/digital a la bandeja de la unidad orgánica.
- **Roles / Capacidad que lo necesitan:** `DIRECTOR`, `JEFE_UNIDAD_ACADEMICA`, `COORDINADOR_AREA`, `SECRETARIO`, `MESA_PARTES`, `ADMINISTRADOR`, y capacidad `GESTOR_APOYO_AREA`.
- **Ámbito:** `AREA`.
- **Endpoints afectados:** `POST /api/v1/expedientes/:id/recepcionar`, `POST /api/v1/expedientes/:id/movimientos/recepcionar`.
- **Servicio que debe verificarlo:** `rutadoc.router.ts` (línea 113 actualmente acepta `['EXPEDIENTE_DERIVAR', 'EXPEDIENTE_RESOLVER']`), `derivaciones.service.ts` (`recepcionarExpediente`).
- **Riesgo de mantener el permiso actual:** Obliga a asignar `EXPEDIENTE_DERIVAR` o `EXPEDIENTE_RESOLVER` a perfiles que solo deben acusar recibo de expedientes en su área (como `GESTOR_APOYO_AREA` o asistentes).
- **Riesgo de crear un permiso nuevo:** Muy bajo; debe actualizarse el botón visual en `ExpedienteDetallePage.tsx` línea 823 y el filtro de `rutadoc.router.ts` línea 113 al mismo tiempo.
- **Recomendación técnica:** **APROBADO — CREAR EN FASE A E IMPLEMENTAR EN FASE B.**

#### 5) `EXPEDIENTE_ASIGNAR`
- **Justificación:** La designación de un evaluador técnico (`DOCENTE`) sobre un expediente (`sigd_rut.expediente_evaluador`) es una atribución de jefatura/coordinación distinta a la resolución técnica o jurídica del trámite.
- **Operación correspondiente:** Asignación inicial de docente/responsable evaluador dentro de la unidad o programa formativo.
- **Roles que lo necesitan:** `DIRECTOR`, `JEFE_UNIDAD_ACADEMICA`, `COORDINADOR_AREA`, `ADMINISTRADOR` *(prohibido a `DOCENTE`, `MESA_PARTES`, `GESTOR_APOYO_AREA`, `TESORERO`, `ESTUDIANTE`, `CIUDADANO`)*.
- **Ámbito:** `AREA`.
- **Endpoints afectados:** Endpoints de asignación de evaluadores / `POST /api/v1/expedientes/:id/asignar-evaluador` (sobre `sigd_rut.expediente_evaluador`).
- **Servicio que debe verificarlo:** Servicio de asignación de evaluadores (RutaDoc) y `contexto.service.ts` (control de visibilidad por asignación).
- **Riesgo de mantener el permiso actual:** Reutilizar `EXPEDIENTE_RESOLVER` permitiría potencialmente que quien solo tiene facultad de resolver en un área interfiera con asignación académica o viceversa, además de violar la regla de no usar `EXPEDIENTE_RESOLVER` como comodín.
- **Riesgo de crear un permiso nuevo:** Bajo; permite matriz limpia para los nuevos roles `JEFE_UNIDAD_ACADEMICA` y `COORDINADOR_AREA`.
- **Recomendación técnica:** **APROBADO — CREAR EN FASE A E IMPLEMENTAR EN FASE B.**

#### 6) `EXPEDIENTE_REASIGNAR`
- **Justificación:** Retirar un expediente ya asignado a un evaluador y transferirlo a otro tiene impacto procesal, de trazabilidad de plazos y riesgo de manipulación; exige jerarquía y justificación obligatoria en bitácora WORM (`motivo_desasignacion`).
- **Operación correspondiente:** Reemplazo o retiro de evaluador activo en `sigd_rut.expediente_evaluador` con justificación obligatoria.
- **Roles que lo necesitan:** `DIRECTOR`, `JEFE_UNIDAD_ACADEMICA`, `COORDINADOR_AREA` (solo dentro de su ámbito/unidad) y `ADMINISTRADOR` *(prohibido a `SECRETARIO`, `DOCENTE`, `MESA_PARTES`, `GESTOR_APOYO_AREA`)*.
- **Ámbito:** `AREA` (para Jefes/Coordinadores dentro de su área) / `GLOBAL` solo `DIRECTOR`/`ADMINISTRADOR`.
- **Endpoints afectados:** `POST /api/v1/expedientes/:id/reasignar-evaluador` / endpoints de relevo de evaluación.
- **Servicio que debe verificarlo:** Servicio de evaluación/reasignación RutaDoc (exigiendo `motivo_desasignacion` no vacío y registro WORM en `sigd_audit.bitacora_auditoria`).
- **Riesgo de mantener el permiso actual:** Sin separación respecto a `EXPEDIENTE_RESOLVER` o `EXPEDIENTE_ASIGNAR`, cualquier operador con resolución de área podría reasignar evaluadores sin trazabilidad reforzada.
- **Riesgo de crear un permiso nuevo:** Bajo; mantiene trazabilidad clara del escenario 4 de TSK-1.1B ("Coordinador que intenta reasignar fuera de su ámbito").
- **Recomendación técnica:** **APROBADO — CREAR EN FASE A E IMPLEMENTAR EN FASE B.**

#### 7) `EXPEDIENTE_EVALUAR`
- **Justificación:** Un `DOCENTE` designado para emitir opinión/informe técnico sobre un expediente NO resuelve ni aprueba el acto administrativo; necesita permiso específico condicionado a asignación activa en `sigd_rut.expediente_evaluador`. Reemplaza además el nombre provisional `DOCENTE_EVALUAR` que aparecía como placeholder en `contexto.service.ts` y `auth.guard.ts`.
- **Operación correspondiente:** Emisión de informe técnico, calificación o dictamen de evaluación docente/académica.
- **Roles que lo necesitan:** `DOCENTE` (condicionado obligatoriamente a estar asignado activamente en `sigd_rut.expediente_evaluador`), `COORDINADOR_AREA`, `JEFE_UNIDAD_ACADEMICA`, `DIRECTOR` *(prohibido a `GESTOR_APOYO_AREA`, `MESA_PARTES`, `ESTUDIANTE`, `CIUDADANO`, `TESORERO`)*.
- **Ámbito:** `AREA` + regla relacional obligatoria de asignación activa para `DOCENTE`.
- **Endpoints afectados:** Endpoints de evaluación técnica / dictamen académico y validación contextual en `contexto.service.ts` (`puedeDocenteAccederExpediente`).
- **Servicio que debe verificarlo:** `contexto.service.ts`, `auth.guard.ts`, servicio de evaluación/observación técnica.
- **Riesgo de mantener el permiso actual:** Si se usara `EXPEDIENTE_RESOLVER`, un docente quedaría facultado para elevar a firma (`atender`), observar como despacho o archivar expedientes completos de su área, rompiendo el principio de menor privilegio.
- **Riesgo de crear un permiso nuevo:** Muy bajo y altamente beneficioso; alinea el placeholder `DOCENTE_EVALUAR` con el estándar `EXPEDIENTE_*`.
- **Recomendación técnica:** **APROBADO — CREAR EN FASE A E IMPLEMENTAR EN FASE B.**

#### 8) `EXPEDIENTE_APROBAR`
- **Justificación:** La aprobación sustantiva de proyectos de resolución o actos administrativos finales (pase a despacho / conformidad resolutiva) pertenece a la autoridad competente (`DIRECTOR` o `JEFE_UNIDAD_ACADEMICA` según alcance), y debe distinguirse de proyectar (`DOCUMENTO_EDITAR`), evaluar (`EXPEDIENTE_EVALUAR`) o firmar criptográficamente (`FIRMA_FIRMAR`).
- **Operación correspondiente:** Aprobación sustantiva del resultado o elevación formal a firma resolutiva (`EN_REVISION` → `EN_FIRMA` en `/atender` cuando existe proyecto en DocuCore, o conformidad administrativa).
- **Roles que lo necesitan:** `DIRECTOR`, `JEFE_UNIDAD_ACADEMICA` *(prohibido a `DOCENTE`, `MESA_PARTES`, `GESTOR_APOYO_AREA`, `ESTUDIANTE`, `CIUDADANO`, `TESORERO`)*. *(Nota: si `SECRETARIO` solo proyecta y prepara el expediente para firma, usará `DOCUMENTO_EDITAR` y `EXPEDIENTE_DERIVAR`, reservando `EXPEDIENTE_APROBAR` a autoridades con facultad decisoria).*
- **Ámbito:** `AREA` (para `JEFE_UNIDAD_ACADEMICA` en su unidad) / `GLOBAL` para `DIRECTOR` (con comprobación adicional de `facultad_despacho`/`encargatura_despacho` para actos resolutivos directorales).
- **Endpoints afectados:** `POST /api/v1/expedientes/:id/atender` (etapa de aprobación / envío a firma), endpoints de aprobación resolutiva en DocuCore.
- **Servicio que debe verificarlo:** `derivaciones.service.ts` (`atenderExpediente`), `rutadoc.router.ts`, `resoluciones.controller.ts`.
- **Riesgo de mantener el permiso actual:** `EXPEDIENTE_RESOLVER` mezcla en un solo permiso aprobar resoluciones, observar trámites y archivar físicamente.
- **Riesgo de crear un permiso nuevo:** Medio si no se coordina con tests existentes de `/atender` (`EXPEDIENTE_RESOLVER`); se mitiga en Fase B aceptando durante la transición reglas explícitas por etapa o manteniendo `EXPEDIENTE_RESOLVER` únicamente para el rol directivo/resolutivo mientras se migran los endpoints de `/atender`.
- **Recomendación técnica:** **APROBADO — CREAR EN FASE A Y DESPLEGAR EN FASE B CON VERIFICACIÓN EN `atenderExpediente` + `facultad_despacho`.**

#### 9) `EXPEDIENTE_CERRAR`
- **Justificación:** En la FSM actual (`rutadoc.fsm.ts`), la transición `EN_FIRMA` + `FIRMA` → `RESUELTO` ocurre tras validar la firma digital PAdES en DocuCore (`callbackRefirma.service.ts` / `atenderExpediente`), y la transición final a archivo es `RESUELTO` + `CIERRE` → `ARCHIVADO` (`archivarExpediente`). No existe hoy una operación HTTP independiente de "cierre sin archivo" distinta de `/atender` (en `EN_FIRMA`) y `/archivar` (en `RESUELTO`).
- **Operación correspondiente:** Cierre administrativo definitivo del expediente tras acto resolutivo o conclusión del procedimiento (previo o conjunto al archivo).
- **Roles que lo necesitan:** `DIRECTOR`, `JEFE_UNIDAD_ACADEMICA`, `SECRETARIO` (solo cierre administrativo verificado tras firma/resolución, sin facultades de firma).
- **Ámbito:** `AREA`.
- **Endpoints afectados:** `POST /api/v1/expedientes/:id/atender` (rama `EN_FIRMA` → `RESUELTO`) y futura ruta dedicada `/cerrar` si se desdobla de `/atender` y `/archivar`.
- **Servicio que debe verificarlo:** `derivaciones.service.ts` (`atenderExpediente`, rama `EN_FIRMA` + verificación obligatoria de `r.estado = 'FIRMADA'` y firma digital PAdES).
- **Riesgo de mantener el permiso actual:** Moderado; hoy la rama `EN_FIRMA` → `RESUELTO` exige `EXPEDIENTE_RESOLVER`, aunque está fuertemente protegida por la invariante de firma digital previa en BD (`FIRMADO_DIGITALMENTE`).
- **Riesgo de crear un permiso nuevo:** Riesgo de redundancia operativa si coexiste sin endpoint propio junto a `EXPEDIENTE_APROBAR` y `EXPEDIENTE_ARCHIVAR`, añadiendo complejidad innecesaria a la matriz para los administradores.
- **Recomendación técnica:** **APROBADO COMO PERMISO DE CIERRE CONTROLADO O CONSOLIDABLE CON `EXPEDIENTE_ARCHIVAR` / `EXPEDIENTE_APROBAR` SEGÚN DECISIÓN DE DIRECCIÓN.** *(Recomendación de arquitectura: crear `EXPEDIENTE_CERRAR` si Dirección desea distinguir explícitamente "concluir trámite administrativo" de "custodiar en archivo físico"; de lo contrario, mantener el cierre ligado a `EXPEDIENTE_APROBAR` / verificación automática de firma digital y usar `EXPEDIENTE_ARCHIVAR` para la custodia final. En el SQL propuesto de la sección 7 se incluye como **opcional comentable**, priorizando la tabla de permisos limpios).*

#### 10) `EXPEDIENTE_ARCHIVAR`
- **Justificación:** Archivar un expediente ya `RESUELTO` registrando estante, balda y caja (`CIERRE` → `ARCHIVADO`) es una operación de gestión documental/archivo, no de resolución jurídica del fondo. Hoy exige `EXPEDIENTE_RESOLVER` tanto en `rutadoc.router.ts` como en `ExpedienteDetallePage.tsx` línea 1057.
- **Operación correspondiente:** Archivo físico y digital definitivo de expedientes con estado `RESUELTO`.
- **Roles que lo necesitan:** `DIRECTOR`, `SECRETARIO`, `MESA_PARTES` *(cuando cumple custodia de archivo de trámite)*, `ADMINISTRADOR` *(prohibido a `DOCENTE`, `ESTUDIANTE`, `CIUDADANO`, `TESORERO`, `GESTOR_APOYO_AREA`)*.
- **Ámbito:** `AREA`.
- **Endpoints afectados:** `POST /api/v1/expedientes/:id/archivar`.
- **Servicio que debe verificarlo:** `rutadoc.router.ts` (middleware específico de `/archivar`), `derivaciones.service.ts` (`archivarExpediente`), `ExpedienteDetallePage.tsx` línea 1057.
- **Riesgo de mantener el permiso actual:** Obliga a otorgar `EXPEDIENTE_RESOLVER` al personal encargado de archivo solo para poder guardar estante/balda/caja, exponiendo innecesariamente las acciones `/atender`, `/observar` y `/acumular`.
- **Riesgo de crear un permiso nuevo:** Nulo si se actualiza simultáneamente `ExpedienteDetallePage.tsx` y `rutadoc.router.ts`; la FSM ya protege que solo expedientes `RESUELTO` puedan archivarse.
- **Recomendación técnica:** **APROBADO — CREAR EN FASE A E IMPLEMENTAR EN FASE B.**

#### Nota de Conciliación: `EXPEDIENTE_ADJUNTAR` (Ya referenciado en código)
- **Situación real:** Tanto `auth.guard.ts` (línea 228) como `contexto.service.ts` (línea 13) y `pendientes/20261111_tsk1_0_rbac_contextual.sql` ya asignan `EXPEDIENTE_ADJUNTAR` a `SECRETARIO` y `GESTOR_APOYO_AREA` para respaldar la digitalización (`POST /api/v1/expedientes/:id/documentos`), mientras que hoy `ExpedienteDetallePage.tsx` (línea 832) usa `EXPEDIENTE_LEER` o `EXPEDIENTE_DERIVAR`.
- **Recomendación técnica:** **APROBADO — CREAR EN FASE A** para eliminar el descalce entre los `try/catch` actuales del backend y PostgreSQL, y vincularlo en Fase B a `digitalizacion.service.ts` + `ExpedienteDetallePage.tsx`.

### 5.3. Resumen de Permisos Recomendados para Crear en Fase A

| Código nuevo propuesto | Ámbito | Prioridad | Decisión |
|---|---|---:|---|
| `EXPEDIENTE_REGISTRAR` | `AREA` | Alta | Crear e implementar |
| `DOCUMENTO_EDITAR` | `AREA` | Alta | Crear e implementar |
| `EXPEDIENTE_SUBSANAR` | `AREA` | Crítica | Crear e implementar |
| `EXPEDIENTE_RECEPCIONAR` | `AREA` | Alta | Crear e implementar |
| `EXPEDIENTE_ADJUNTAR` | `AREA` | Alta | Crear e implementar (ya en `auth.guard.ts`) |
| `EXPEDIENTE_ASIGNAR` | `AREA` | Media-Alta | Crear e implementar |
| `EXPEDIENTE_REASIGNAR` | `AREA` | Media-Alta | Crear e implementar |
| `EXPEDIENTE_EVALUAR` | `AREA` | Alta | Crear e implementar (reemplaza `DOCENTE_EVALUAR`) |
| `EXPEDIENTE_APROBAR` | `AREA` | Alta | Crear e implementar |
| `EXPEDIENTE_ARCHIVAR` | `AREA` | Media-Alta | Crear e implementar |
| `EXPEDIENTE_CERRAR` | `AREA` | Media | Opcional: consolidar en flujo firma/archivo o incluir si Dirección exige separación explícita |

*(Se conserva `EXPEDIENTE_RESOLVER` en `ADMINISTRADOR`, `DIRECTOR`, `JEFE_UNIDAD_ACADEMICA`, `COORDINADOR_AREA`, `SECRETARIO` solo mientras transiciona o para actos específicos autorizados como observación/acumulación, prohibiéndolo tajantemente en `DOCENTE`, `MESA_PARTES`, `TESORERO`, `ESTUDIANTE`, `CIUDADANO` y `GESTOR_APOYO_AREA`.)*

---

## 6. DISEÑO DEFINITIVO DE `GESTOR_APOYO_AREA`

`GESTOR_APOYO_AREA` se implementa estrictamente como una **capacidad operativa delegada** (`CAPACIDAD`), **nunca como un 11.° rol**.

### 6.1. Estructuras en PostgreSQL (`sigd_org`)

1. **`sigd_org.capacidad_sistema`**: Catálogo maestro (`id_capacidad`, `codigo`, `nombre`, `descripcion`, `vigente`), con registro semilla `GESTOR_APOYO_AREA`.
2. **`sigd_org.capacidad_permiso`**: Relación normalizada hacia `sigd_org.permiso_sistema` *(cero JSONB de permisos)*.
   - **Permisos permitidos únicamente:** `EXPEDIENTE_LEER`, `EXPEDIENTE_RECEPCIONAR`, `EXPEDIENTE_DERIVAR`, `EXPEDIENTE_ADJUNTAR` (todos ejecutados estrictamente bajo el `area_id` de la asignación de capacidad).
   - **Protección física en BD (`TRIGGER` `BEFORE INSERT OR UPDATE`):** Bloquea en PostgreSQL que cualquier capacidad reciba permisos prohibidos: `EXPEDIENTE_RESOLVER`, `EXPEDIENTE_EVALUAR`, `EXPEDIENTE_APROBAR`, `EXPEDIENTE_CERRAR`, `EXPEDIENTE_ARCHIVAR`, `EXPEDIENTE_ASIGNAR`, `EXPEDIENTE_REASIGNAR`, `FIRMA_FIRMAR`, `ADMIN_USUARIOS`, `TRAMICORE_DEVOLUCION_EVALUAR` o cualquier `TESORERIA_*`.
3. **`sigd_org.usuario_capacidad`**: Asignación contextual obligatoria (`id_usuario_capacidad`, `id_usuario`, `id_capacidad`, `area_id NOT NULL`, `justificacion NOT NULL`, `asignado_por`, `activo`, `vigente_desde`, `vigente_hasta`, `desactivado_por`, `desactivado_en`, `motivo_desactivacion`).
   - Restricciones: `chk_usuario_capacidad_vigencia`, `uq_usuario_capacidad_activa` (índice único parcial `WHERE activo = TRUE`) y `ex_usuario_capacidad_vigencia` (exclusión temporal GiST impidiendo intervalos activos solapados para el mismo usuario/capacidad/área).

### 6.2. Reglas de Seguridad en Backend y Revocación Inmediata

- Cada asignación de capacidad genera **su propio contexto elegible** (`tipo: 'CAPACIDAD'`, `idAsignacion: id_usuario_capacidad`, `areaId: uc.area_id`), **nunca fusiona sus permisos con otros roles del usuario** ni crea una sesión super-acumulada.
- En [`auth.guard.ts`](file:///c:/Users/Liz/Desktop/SIGD/SIGD/backend/src/core/auth/auth.guard.ts) y [`contexto.service.ts`](file:///c:/Users/Liz/Desktop/SIGD/SIGD/backend/src/core/auth/contexto.service.ts): eliminar los bloques `try/catch` con arreglos quemados y consultar directamente `capacidad_sistema` + `capacidad_permiso` + `usuario_capacidad` validando `activo = TRUE AND vigente_desde <= now() AND (vigente_hasta IS NULL OR vigente_hasta > now())`.
- **Revocación inmediata (Política B):** Al revocar o vencer una capacidad (`DELETE/PATCH /api/v1/admin/usuarios/:id/capacidades/:usuarioCapacidadId`), se invalida la sesión/caché del contexto en PostgreSQL/Redis y cualquier petición protegida posterior con ese `claims.ctx` devuelve **`403 CONTEXT_REVOKED`** de inmediato.
- **Auditoría WORM:** Toda asignación y desactivación de capacidad llama a `registrarMutacion(...)` sobre `sigd_audit.bitacora_auditoria` con `justificacion` / `motivo_desactivacion`.

---

## 7. MIGRACIONES QUE SE NECESITAN Y SQL PROPUESTO (`NO EJECUTADO`)

### 7.1. Estado de Migraciones Existentes

En `public.sigd_migraciones` de `sigd_jacobo_demo` están registradas las migraciones `01` a `12` y `16` a `21`. En [`backend/migraciones/pendientes/`](file:///c:/Users/Liz/Desktop/SIGD/SIGD/backend/migraciones/pendientes) existen `13`, `14`, `15` y el borrador `20261111_tsk1_0_rbac_contextual.sql` (no ejecutado).
Según [`backend/src/db/migrate.ts`](file:///c:/Users/Liz/Desktop/SIGD/SIGD/backend/src/db/migrate.ts), el runner valida prefijos numéricos correlativos sin duplicados y verifica estrictamente el hash SHA-256 de cada archivo en `backend/migraciones/*.sql`.

- El borrador `20261111_tsk1_0_rbac_contextual.sql` **no debe ejecutarse tal cual** porque: (a) omite los permisos nuevos aprobados en TSK-1.1B/1.2 (`EXPEDIENTE_REGISTRAR`, `DOCUMENTO_EDITAR`, `EXPEDIENTE_SUBSANAR`, `EXPEDIENTE_ASIGNAR`, `EXPEDIENTE_REASIGNAR`, `EXPEDIENTE_EVALUAR`, `EXPEDIENTE_APROBAR`, `EXPEDIENTE_ARCHIVAR`); (b) carece de `CHECK` de fechas y `EXCLUDE USING gist` en `usuario_capacidad`, y de trigger de lista negra en `capacidad_permiso`; (c) no sigue el prefijo numérico `22_` requerido tras `21_`; (d) desactivaría `ESPECIALISTA` y abortaría si Dirección aún evalúa asignaciones.
- **Migración a crear en Fase A:**
  1. `backend/migraciones/22_sigd_org_catalogo_rbac_institucional.sql` (migración principal idempotente y transaccional).
  2. `backend/migraciones/pendientes/22_sigd_org_catalogo_rbac_institucional_rollback.sql` (script manual de reversión, ubicado en `pendientes/` para que `migrate.ts` no lo auto-ejecute).

### 7.2. SQL Propuesto — **`NO EJECUTADO`**

> [!CAUTION]
> **ESTADO: `NO EJECUTADO`.** El siguiente SQL es únicamente una propuesta técnica para revisión y autorización expresa antes de iniciar la Fase A. No ha sido ejecutado contra `sigd_jacobo_demo`.

```sql
-- ============================================================================
-- PROPUESTA TÉCNICA — ESTADO: NO EJECUTADO
-- Archivo futuro: backend/migraciones/22_sigd_org_catalogo_rbac_institucional.sql
-- Rama: B_JACOBO | Base: sigd_jacobo_demo (PostgreSQL 18.6)
-- ============================================================================

BEGIN;

-- 1. Verificaciones previas de entorno y tablas base
DO $$
BEGIN
  IF current_database() <> 'sigd_jacobo_demo' THEN
    RAISE EXCEPTION 'Migración restringida exclusivamente a sigd_jacobo_demo (actual: %)', current_database();
  END IF;
  IF to_regclass('sigd_org.rol_sistema') IS NULL OR to_regclass('sigd_org.permiso_sistema') IS NULL THEN
    RAISE EXCEPTION 'Faltan tablas base en sigd_org. Abortando.';
  END IF;
END $$;

-- 2. Ampliar CHECK constraint chk_rol_codigo conservando históricos (para integridad referencial)
ALTER TABLE sigd_org.rol_sistema DROP CONSTRAINT IF EXISTS chk_rol_codigo;
ALTER TABLE sigd_org.rol_sistema ADD CONSTRAINT chk_rol_codigo CHECK (
  codigo::text = ANY (ARRAY[
    -- 10 Roles Canónicos Activos
    'ADMINISTRADOR', 'DIRECTOR', 'JEFE_UNIDAD_ACADEMICA', 'COORDINADOR_AREA',
    'SECRETARIO', 'MESA_PARTES', 'DOCENTE', 'TESORERO', 'ESTUDIANTE', 'CIUDADANO',
    -- 4 Roles Históricos Preservados (vigente = FALSE)
    'ESPECIALISTA', 'CAJERO', 'APROBADOR_DEVOLUCIONES', 'SUPERVISOR_TESORERIA'
  ]::text[])
);

-- 3. Insertar exclusivamente los 4 roles faltantes (conservando los 6 UUID canónicos ya existentes)
INSERT INTO sigd_org.rol_sistema (codigo, nombre, descripcion, vigente)
VALUES
  ('JEFE_UNIDAD_ACADEMICA', 'Jefe de Unidad Académica',
   'Supervisión directiva y tramitación dentro de su Unidad Académica asignada.', TRUE),
  ('COORDINADOR_AREA', 'Coordinador de Área / Programa',
   'Coordinación académica y gestión operativa de expedientes en su área o programa formativo.', TRUE),
  ('DOCENTE', 'Docente',
   'Personal docente institucional; evalúa únicamente expedientes formalmente asignados.', TRUE),
  ('ESTUDIANTE', 'Estudiante',
   'Integrante interno de la comunidad estudiantil; acceso restringido a sus propios trámites y casilla.', TRUE)
ON CONFLICT (codigo) DO UPDATE
  SET nombre = EXCLUDED.nombre,
      descripcion = EXCLUDED.descripcion,
      vigente = TRUE;

-- 4. Catálogo de permisos atómicos aprobados (conservando los 16 UUID existentes)
INSERT INTO sigd_org.permiso_sistema (codigo, nombre, ambito)
VALUES
  ('EXPEDIENTE_REGISTRAR',   'Registrar y radicar expedientes',                     'AREA'),
  ('DOCUMENTO_EDITAR',       'Proyectar y editar borradores documentales no firmados', 'AREA'),
  ('EXPEDIENTE_SUBSANAR',    'Presentar o recibir subsanación de observaciones',    'AREA'),
  ('EXPEDIENTE_RECEPCIONAR', 'Recepcionar expedientes en bandeja de área',          'AREA'),
  ('EXPEDIENTE_ADJUNTAR',    'Adjuntar documentos digitalizados al expediente',     'AREA'),
  ('EXPEDIENTE_ASIGNAR',     'Asignar evaluador técnico dentro del área',           'AREA'),
  ('EXPEDIENTE_REASIGNAR',   'Reasignar evaluador técnico con justificación WORM',  'AREA'),
  ('EXPEDIENTE_EVALUAR',     'Emitir evaluación o dictamen técnico asignado',       'AREA'),
  ('EXPEDIENTE_APROBAR',     'Aprobar resultado o elevar proyecto a firma',         'AREA'),
  ('EXPEDIENTE_CERRAR',      'Cerrar procedimiento concluido',                      'AREA'),
  ('EXPEDIENTE_ARCHIVAR',    'Archivar expediente resuelto en repositorio físico',  'AREA')
ON CONFLICT (codigo) DO NOTHING;

-- 5. Matriz de permisos por rol (protegiendo estricto aislamiento de TESORERO y externos/estudiantes)
-- 5.1 ADMINISTRADOR (mantiene los 6 previos + gestión documental operativa requerida por matriz, sin tesorería transaccional salvo lectura si aplica)
INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
FROM sigd_org.rol_sistema r CROSS JOIN sigd_org.permiso_sistema p
WHERE r.codigo = 'ADMINISTRADOR'
  AND p.codigo IN (
    'EXPEDIENTE_REGISTRAR', 'DOCUMENTO_EDITAR', 'EXPEDIENTE_SUBSANAR',
    'EXPEDIENTE_RECEPCIONAR', 'EXPEDIENTE_ADJUNTAR', 'EXPEDIENTE_ASIGNAR',
    'EXPEDIENTE_REASIGNAR', 'EXPEDIENTE_APROBAR', 'EXPEDIENTE_CERRAR', 'EXPEDIENTE_ARCHIVAR'
  )
ON CONFLICT DO NOTHING;

-- 5.2 DIRECTOR (autoridad institucional máxima; firma digital y aprobación)
INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
FROM sigd_org.rol_sistema r CROSS JOIN sigd_org.permiso_sistema p
WHERE r.codigo = 'DIRECTOR'
  AND p.codigo IN (
    'EXPEDIENTE_LEER', 'EXPEDIENTE_RECEPCIONAR', 'EXPEDIENTE_DERIVAR', 'EXPEDIENTE_ADJUNTAR',
    'DOCUMENTO_EDITAR', 'EXPEDIENTE_ASIGNAR', 'EXPEDIENTE_REASIGNAR',
    'EXPEDIENTE_EVALUAR', 'EXPEDIENTE_APROBAR', 'EXPEDIENTE_RESOLVER',
    'EXPEDIENTE_CERRAR', 'EXPEDIENTE_ARCHIVAR', 'FIRMA_FIRMAR', 'REPORTE_LEER'
  )
ON CONFLICT DO NOTHING;

-- 5.3 JEFE_UNIDAD_ACADEMICA (ámbito de su Unidad Académica; sin firma digital ni administración de usuarios)
INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
FROM sigd_org.rol_sistema r CROSS JOIN sigd_org.permiso_sistema p
WHERE r.codigo = 'JEFE_UNIDAD_ACADEMICA'
  AND p.codigo IN (
    'EXPEDIENTE_LEER', 'EXPEDIENTE_RECEPCIONAR', 'EXPEDIENTE_DERIVAR', 'EXPEDIENTE_ADJUNTAR',
    'DOCUMENTO_EDITAR', 'EXPEDIENTE_SUBSANAR', 'EXPEDIENTE_ASIGNAR', 'EXPEDIENTE_REASIGNAR',
    'EXPEDIENTE_EVALUAR', 'EXPEDIENTE_APROBAR', 'EXPEDIENTE_RESOLVER', 'REPORTE_LEER'
  )
ON CONFLICT DO NOTHING;

-- 5.4 COORDINADOR_AREA (ámbito de su área o programa formativo; sin firma digital ni aprobación directiva global)
INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
FROM sigd_org.rol_sistema r CROSS JOIN sigd_org.permiso_sistema p
WHERE r.codigo = 'COORDINADOR_AREA'
  AND p.codigo IN (
    'EXPEDIENTE_LEER', 'EXPEDIENTE_RECEPCIONAR', 'EXPEDIENTE_DERIVAR', 'EXPEDIENTE_ADJUNTAR',
    'DOCUMENTO_EDITAR', 'EXPEDIENTE_SUBSANAR', 'EXPEDIENTE_ASIGNAR', 'EXPEDIENTE_REASIGNAR',
    'EXPEDIENTE_EVALUAR', 'EXPEDIENTE_RESOLVER'
  )
ON CONFLICT DO NOTHING;

-- 5.5 SECRETARIO (fe administrativa, proyección documental, despacho, cierre y archivo; sin firma digital)
INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
FROM sigd_org.rol_sistema r CROSS JOIN sigd_org.permiso_sistema p
WHERE r.codigo = 'SECRETARIO'
  AND p.codigo IN (
    'EXPEDIENTE_LEER', 'EXPEDIENTE_RECEPCIONAR', 'EXPEDIENTE_DERIVAR', 'EXPEDIENTE_ADJUNTAR',
    'DOCUMENTO_EDITAR', 'EXPEDIENTE_SUBSANAR', 'EXPEDIENTE_RESOLVER',
    'EXPEDIENTE_CERRAR', 'EXPEDIENTE_ARCHIVAR'
  )
ON CONFLICT DO NOTHING;

-- 5.6 MESA_PARTES (ventanilla, registro, recepción, subsanación presencial, derivación, devolución documental)
INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
FROM sigd_org.rol_sistema r CROSS JOIN sigd_org.permiso_sistema p
WHERE r.codigo = 'MESA_PARTES'
  AND p.codigo IN (
    'EXPEDIENTE_LEER', 'EXPEDIENTE_REGISTRAR', 'EXPEDIENTE_RECEPCIONAR',
    'EXPEDIENTE_DERIVAR', 'EXPEDIENTE_ADJUNTAR', 'EXPEDIENTE_SUBSANAR',
    'EXPEDIENTE_ARCHIVAR', 'TRAMICORE_DEVOLUCION_EVALUAR'
  )
ON CONFLICT DO NOTHING;

-- 5.7 DOCENTE (lectura y evaluación únicamente de expedientes asignados + radicación propia)
INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
FROM sigd_org.rol_sistema r CROSS JOIN sigd_org.permiso_sistema p
WHERE r.codigo = 'DOCENTE'
  AND p.codigo IN ('EXPEDIENTE_LEER', 'EXPEDIENTE_EVALUAR', 'EXPEDIENTE_REGISTRAR', 'EXPEDIENTE_ADJUNTAR')
ON CONFLICT DO NOTHING;

-- 5.8 ESTUDIANTE y CIUDADANO (estricta titularidad solicitante_id en backend)
INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
FROM sigd_org.rol_sistema r CROSS JOIN sigd_org.permiso_sistema p
WHERE r.codigo IN ('ESTUDIANTE', 'CIUDADANO')
  AND p.codigo IN ('EXPEDIENTE_LEER', 'EXPEDIENTE_REGISTRAR', 'EXPEDIENTE_SUBSANAR')
ON CONFLICT DO NOTHING;

-- 5.9 TESORERO: mantiene exclusivamente los 9 permisos TESORERIA_* (nunca EXPEDIENTE_*)
DELETE FROM sigd_org.rol_permiso rp
USING sigd_org.rol_sistema r, sigd_org.permiso_sistema p
WHERE rp.rol_id = r.rol_id AND rp.permiso_id = p.permiso_id
  AND r.codigo = 'TESORERO' AND p.codigo NOT LIKE 'TESORERIA_%';

-- 6. Modelo normalizado de Capacidades Operativas (GESTOR_APOYO_AREA)
CREATE TABLE IF NOT EXISTS sigd_org.capacidad_sistema (
  id_capacidad UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(64) NOT NULL UNIQUE,
  nombre VARCHAR(120) NOT NULL,
  descripcion TEXT NULL,
  vigente BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sigd_org.capacidad_permiso (
  id_capacidad UUID NOT NULL REFERENCES sigd_org.capacidad_sistema(id_capacidad) ON DELETE CASCADE,
  permiso_id UUID NOT NULL REFERENCES sigd_org.permiso_sistema(permiso_id) ON DELETE RESTRICT,
  PRIMARY KEY (id_capacidad, permiso_id)
);

-- Salvaguarda física en PostgreSQL: prohíbe asignar permisos resolutivos, de firma, admin o tesorería a capacidades operativas
CREATE OR REPLACE FUNCTION sigd_org.fn_validar_permiso_capacidad()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_permiso_codigo TEXT;
BEGIN
  SELECT codigo INTO v_permiso_codigo FROM sigd_org.permiso_sistema WHERE permiso_id = NEW.permiso_id;
  IF v_permiso_codigo IN (
    'EXPEDIENTE_RESOLVER', 'EXPEDIENTE_EVALUAR', 'EXPEDIENTE_APROBAR',
    'EXPEDIENTE_CERRAR', 'EXPEDIENTE_ARCHIVAR', 'EXPEDIENTE_ASIGNAR', 'EXPEDIENTE_REASIGNAR',
    'FIRMA_FIRMAR', 'ADMIN_USUARIOS', 'REPORTE_LEER', 'TRAMICORE_DEVOLUCION_EVALUAR'
  ) OR v_permiso_codigo LIKE 'TESORERIA_%' THEN
    RAISE EXCEPTION 'El permiso % está prohibido para capacidades operativas delegadas.', v_permiso_codigo
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_validar_permiso_capacidad ON sigd_org.capacidad_permiso;
CREATE TRIGGER tr_validar_permiso_capacidad
  BEFORE INSERT OR UPDATE ON sigd_org.capacidad_permiso
  FOR EACH ROW EXECUTE FUNCTION sigd_org.fn_validar_permiso_capacidad();

INSERT INTO sigd_org.capacidad_sistema (codigo, nombre, descripcion, vigente)
VALUES (
  'GESTOR_APOYO_AREA',
  'Gestor de Apoyo de Área',
  'Capacidad operativa delegada de asistencia documental restringida estrictamente al área orgánica asignada.',
  TRUE
)
ON CONFLICT (codigo) DO UPDATE
  SET nombre = EXCLUDED.nombre,
      descripcion = EXCLUDED.descripcion,
      vigente = TRUE;

INSERT INTO sigd_org.capacidad_permiso (id_capacidad, permiso_id)
SELECT cs.id_capacidad, p.permiso_id
FROM sigd_org.capacidad_sistema cs CROSS JOIN sigd_org.permiso_sistema p
WHERE cs.codigo = 'GESTOR_APOYO_AREA'
  AND p.codigo IN ('EXPEDIENTE_LEER', 'EXPEDIENTE_RECEPCIONAR', 'EXPEDIENTE_DERIVAR', 'EXPEDIENTE_ADJUNTAR')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS sigd_org.usuario_capacidad (
  id_usuario_capacidad UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_usuario UUID NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
  id_capacidad UUID NOT NULL REFERENCES sigd_org.capacidad_sistema(id_capacidad) ON DELETE RESTRICT,
  area_id UUID NOT NULL REFERENCES sigd_org.area(area_id) ON DELETE RESTRICT,
  justificacion TEXT NOT NULL,
  asignado_por UUID NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  vigente_desde TIMESTAMPTZ NOT NULL DEFAULT now(),
  vigente_hasta TIMESTAMPTZ NULL,
  desactivado_por UUID NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
  desactivado_en TIMESTAMPTZ NULL,
  motivo_desactivacion TEXT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_usuario_capacidad_vigencia CHECK (vigente_hasta IS NULL OR vigente_hasta > vigente_desde),
  CONSTRAINT chk_usuario_capacidad_justificacion CHECK (length(btrim(justificacion)) >= 5)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_usuario_capacidad_activa
  ON sigd_org.usuario_capacidad (id_usuario, id_capacidad, area_id)
  WHERE activo = TRUE;

ALTER TABLE sigd_org.usuario_capacidad DROP CONSTRAINT IF EXISTS ex_usuario_capacidad_vigencia;
ALTER TABLE sigd_org.usuario_capacidad ADD CONSTRAINT ex_usuario_capacidad_vigencia
  EXCLUDE USING gist (
    id_usuario WITH =,
    id_capacidad WITH =,
    area_id WITH =,
    tstzrange(vigente_desde, COALESCE(vigente_hasta, 'infinity'::timestamptz), '[)') WITH &&
  ) WHERE (activo = TRUE);

CREATE INDEX IF NOT EXISTS idx_usuario_capacidad_usuario ON sigd_org.usuario_capacidad (id_usuario) WHERE activo = TRUE;
CREATE INDEX IF NOT EXISTS idx_usuario_capacidad_area ON sigd_org.usuario_capacidad (area_id) WHERE activo = TRUE;

-- 7. Tabla de asignación trazable de evaluadores docentes (sigd_rut.expediente_evaluador)
CREATE TABLE IF NOT EXISTS sigd_rut.expediente_evaluador (
  id_asignacion UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id UUID NOT NULL REFERENCES sigd_tra.expediente(expediente_id) ON DELETE RESTRICT,
  id_usuario_docente UUID NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
  area_id UUID NOT NULL REFERENCES sigd_org.area(area_id) ON DELETE RESTRICT,
  asignado_por UUID NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
  motivo_asignacion TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  asignado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  desactivado_por UUID NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
  desactivado_en TIMESTAMPTZ NULL,
  motivo_desasignacion TEXT NULL,
  observaciones TEXT NULL,
  evidencias JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_expediente_evaluador_activo
  ON sigd_rut.expediente_evaluador (expediente_id)
  WHERE activo = TRUE;

CREATE INDEX IF NOT EXISTS idx_expediente_evaluador_docente ON sigd_rut.expediente_evaluador (id_usuario_docente) WHERE activo = TRUE;
CREATE INDEX IF NOT EXISTS idx_expediente_evaluador_area ON sigd_rut.expediente_evaluador (area_id);

-- 8. Retiro normativo de ESPECIALISTA (SUJETO A CONFIRMACIÓN PREVIA DE DIRECCIÓN SOBRE LOS 6 UUID DE LA SECCIÓN 3)
-- Nota: No elimina ni modifica filas de sigd_org.usuario_rol.
-- Descomentar / ejecutar únicamente cuando Dirección apruebe el tratamiento de especialista.demo y cuentas H2:
-- UPDATE sigd_org.rol_sistema SET vigente = FALSE WHERE codigo = 'ESPECIALISTA';

-- 9. Validaciones finales de integridad dentro de la transacción
DO $$
DECLARE
  v_tes_no_tesoreria INT;
  v_tes_permisos INT;
  v_esp_rows INT;
BEGIN
  SELECT count(*) INTO v_tes_permisos
  FROM sigd_org.rol_permiso rp JOIN sigd_org.rol_sistema r ON r.rol_id = rp.rol_id
  JOIN sigd_org.permiso_sistema p ON p.permiso_id = rp.permiso_id
  WHERE r.codigo = 'TESORERO' AND p.codigo LIKE 'TESORERIA_%';
  IF v_tes_permisos <> 9 THEN
    RAISE EXCEPTION 'TESORERO debe conservar exactamente sus 9 permisos financieros (actual: %)', v_tes_permisos;
  END IF;

  SELECT count(*) INTO v_tes_no_tesoreria
  FROM sigd_org.rol_permiso rp JOIN sigd_org.rol_sistema r ON r.rol_id = rp.rol_id
  JOIN sigd_org.permiso_sistema p ON p.permiso_id = rp.permiso_id
  WHERE r.codigo = 'TESORERO' AND p.codigo NOT LIKE 'TESORERIA_%';
  IF v_tes_no_tesoreria <> 0 THEN
    RAISE EXCEPTION 'TESORERO no puede poseer permisos documentales fuera de Tesorería';
  END IF;

  SELECT count(*) INTO v_esp_rows
  FROM sigd_org.usuario_rol ur JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id
  WHERE r.codigo = 'ESPECIALISTA';
  IF v_esp_rows < 6 THEN
    RAISE EXCEPTION 'Se detectó pérdida de registros históricos de ESPECIALISTA (esperados >= 6, encontrados %)', v_esp_rows;
  END IF;
END $$;

COMMIT;
```

---

## 8. ARCHIVOS BACKEND AFECTADOS (LISTADO EXHAUSTIVO PARA FASE B)

1. **`backend/src/core/auth/auth.guard.ts`**:
   - Eliminar el bloque `try/catch` con fallback en memoria para capacidades.
   - Consultar `sigd_org.capacidad_sistema` + `sigd_org.capacidad_permiso` + `sigd_org.usuario_capacidad` validando vigencia y `activo = TRUE`.
   - Soportar `ESTUDIANTE` como rol interno por titularidad (`solicitante_id = persona.id_persona`) y `TESORERO` exclusivamente `GLOBAL` en dominio `TESORERIA_*`.
2. **`backend/src/core/auth/contexto.service.ts` y `contexto.types.ts`**:
   - Reemplazar `DOCENTE_EVALUAR` por `EXPEDIENTE_EVALUAR` y consultar `sigd_rut.expediente_evaluador` real sin fallback silencioso.
   - Asegurar que al seleccionar contexto (`POST /api/v1/auth/seleccionar-contexto`), todo endpoint verifique el **`claims.ctx` activo únicamente** (nunca acumular permisos de otros roles).
   - Mantener revocación inmediata (`403 CONTEXT_REVOKED`) ante revocación de `usuario_rol` o `usuario_capacidad`.
3. **`backend/src/app.ts`**:
   - **Corregir brecha crítica en líneas 210 (`puedeVerExpediente`) y 263 (`obtenerAlcanceBandeja`)**: actualmente, cuando `requiereSeleccionContexto === false` o al consultar BD, **ignoran `claims.ctx` y no consultan `sigd_org.usuario_capacidad`**, devolviendo acceso desde `usuario_rol` completo. Debe filtrar estrictamente por `claims.ctx` (`usuario_rol` o `usuario_capacidad`) cuando existe contexto activo, y nunca dar acceso global a `TESORERO` sobre `rutadoc`.
   - Actualizar el mapeo de módulos/descripciones (`GET /api/v1/admin/roles-permisos`, líneas 433–462) para los permisos nuevos y catálogo de 10 roles.
4. **`backend/src/domains/organicore/usuariosAdmin.service.ts`, `usuariosAdmin.controller.ts`, `usuariosAdmin.routes.ts`, `dto/usuarioAdmin.dto.ts`**:
   - **Alinear `ROLES_EXTERNOS_PROHIBIDOS` (línea 103):** Solo `CIUDADANO` es externo; definir tratamiento de `ESTUDIANTE` (interno sin exigir cargo administrativo en `asignacion_personal` si no aplica, o con asignación de programa).
   - **Corregir `esRolGlobal` (líneas 278, 295, 486):** Hoy solo evalúa `rolCodigo === 'ADMINISTRADOR'`. Debe tratar correctamente `ADMINISTRADOR`, `DIRECTOR` y `TESORERO` como globales (`area_id = NULL`), y `ESTUDIANTE`/`CIUDADANO` sin `area_id`, mientras exige `area_id` obligatorio en `JEFE_UNIDAD_ACADEMICA`, `COORDINADOR_AREA`, `SECRETARIO`, `MESA_PARTES`, `DOCENTE` y `GESTOR_APOYO_AREA`.
   - Integrar `capacidades` en `SELECT_USUARIOS`, `listarUsuarios`, `asignarCapacidad` (validar tabla real, rechazar conflictos temporales `409`, auditar en `sigd_audit.bitacora_auditoria` WORM, y **revocar sesiones/tokens** al asignar/revocar rol o capacidad según Política B).
   - Exponer catálogo de capacidades en respuesta administrativa.
5. **`backend/src/domains/organicore/adminMaestras.routes.ts`**:
   - Eliminar comentarios y referencias obsoletas a `SUPER_ADMIN` (exigir `ADMINISTRADOR` o permiso `ADMIN_USUARIOS`).
6. **`backend/src/domains/tramicore/tramites.controller.ts`**:
   - Reemplazar `exigirOperadorVentanilla` basado en nombres de rol (`MESA_PARTES || ADMINISTRADOR`) por permiso atómico `EXPEDIENTE_REGISTRAR` (`AREA`), y validar permiso + titularidad en `radicacion-virtual`.
7. **`backend/src/domains/rutadoc/rutadoc.router.ts`, `derivaciones.controller.ts`, `derivaciones.service.ts`, `digitalizacion.service.ts`, `lecturas.controller.ts`**:
   - Separar middlewares de autorización en `rutadoc.router.ts` (líneas 107–120):
     - `/recepcionar` → `EXPEDIENTE_RECEPCIONAR` (`AREA`)
     - `/derivar` y `/derivar-lote` → `EXPEDIENTE_DERIVAR` (`AREA`)
     - `/documentos` → `EXPEDIENTE_ADJUNTAR` (`AREA`)
     - `/subsanar` → `EXPEDIENTE_SUBSANAR` (`AREA` o **titularidad `solicitante_id`** para `ESTUDIANTE`/`CIUDADANO`)
     - `/atender` → `EXPEDIENTE_APROBAR` (en `EN_REVISION`) / `EXPEDIENTE_CERRAR` o firma verificada (en `EN_FIRMA`)
     - `/archivar` → `EXPEDIENTE_ARCHIVAR` (`AREA`)
     - `/observar` y `/acumular` → `EXPEDIENTE_RESOLVER` / `EXPEDIENTE_EVALUAR` según regla de etapa
   - Actualizar `ROLES_CCD` en `lecturas.controller.ts` (línea 12: retirar `SUPER_ADMIN`, incluir roles académicos/administrativos vigentes).
8. **`backend/src/domains/docucore/resoluciones.controller.ts`, `docucore.router.ts`, `edicionResoluciones.service.ts`**:
   - Usar `DOCUMENTO_EDITAR` para proyección/edición de borradores y corregir `obtenerProyecto` (línea 208) para filtrar por `claims.ctx` y soportar `usuario_capacidad` donde corresponda (nunca `ESPECIALISTA` como vigente ni `SUPER_ADMIN`).
9. **`backend/src/domains/corelink/reportes.controller.ts` y `backend/src/modules/reportes/reportes.routes.ts`**:
   - Eliminar `SUPER_ADMIN` y consolidar la validación en `REPORTE_LEER` / `ADMIN_USUARIOS` (`GLOBAL`).
10. **`backend/src/core/storage/storage.router.ts`**:
    - Extender `autorizarDocumento` (líneas 102–136) para reconocer contexto activo `claims.ctx` y asignaciones de `usuario_capacidad` (`EXPEDIENTE_LEER` en `area_id`) y `expediente_evaluador` para `DOCENTE`.

---

## 9. ARCHIVOS FRONTEND AFECTADOS (LISTADO EXHAUSTIVO PARA FASE C)

1. **`frontend/src/types/rbacRoles.ts`**: Actualizar roles canónicos exactos (10 roles: retirar `SUPER_ADMIN` y `ESPECIALISTA`; incluir `JEFE_UNIDAD_ACADEMICA`, `COORDINADOR_AREA`, `TESORERO`, `DOCENTE`, `ESTUDIANTE`, `CIUDADANO`) y permisos reales actualizados.
2. **`frontend/src/types/usuarioAdmin.ts` y `frontend/src/services/adminUsuariosService.ts`**: Incorporar esquema Zod y mutaciones/queries para `capacidades` (`asignarCapacidad`, `revocarCapacidad`) y catálogo de capacidades.
3. **`frontend/src/hooks/useUsuariosAdmin.ts`**: Exponer acciones y estados de carga de capacidades y filtros/validaciones para los 10 roles.
4. **`frontend/src/components/administracion/CrearUsuarioModal.tsx`**:
   - Actualizar `ROLES_EXTERNOS` (solo `CIUDADANO`; `ESTUDIANTE` es rol interno).
   - Reemplazar `PERMISOS_DEFAULT_POR_ROL` obsoletos (`DIRECTOR_GENERAL`, `SECRETARIO_GENERAL`, `JEFE_UNIDAD`, `ESPECIALISTA`, `SECRETARIA`, `OPERADOR_TRAMITE`, `ARCHIVO_CENTRAL`) por los 10 códigos canónicos y exigir `areaId` según ámbito del rol.
5. **`frontend/src/components/administracion/UserEditModal.tsx` y `frontend/src/pages/administracion/UsuariosPage.tsx`**:
   - Agregar sección/panel para asignar y revocar capacidad operativa `GESTOR_APOYO_AREA` con área obligatoria, vigencia y justificación.
   - Mostrar advertencias claras ante cambios de cargo o área (recordando revocación inmediata de contexto/sesión si cambia ámbito) y mostrar historial de asignaciones vigentes y concluidas.
   - Retirar `ESTUDIANTE` de `ROLES_EXTERNOS` para permitir gestionarlo como rol interno (respetando reglas de área).
6. **`frontend/src/hooks/useRbacConfig.ts` y `frontend/src/pages/administracion/RolesPermisosPage.tsx`**:
   - Actualizar `resolverModulo` y `resolverDescripcion` para cubrir los nuevos permisos `EXPEDIENTE_REGISTRAR`, `DOCUMENTO_EDITAR`, `EXPEDIENTE_SUBSANAR`, `EXPEDIENTE_RECEPCIONAR`, `EXPEDIENTE_ADJUNTAR`, `EXPEDIENTE_ASIGNAR`, `EXPEDIENTE_REASIGNAR`, `EXPEDIENTE_EVALUAR`, `EXPEDIENTE_APROBAR`, `EXPEDIENTE_ARCHIVAR` (+ `EXPEDIENTE_CERRAR` si aplica).
   - Mostrar claramente que `ESPECIALISTA`, `CAJERO`, `APROBADOR_DEVOLUCIONES` y `SUPERVISOR_TESORERIA` son históricos no asignables y `TESORERO` está aislado a Tesorería.
7. **`frontend/src/routes/AppRouter.tsx` y `frontend/src/routes/ProtectedRoute.tsx`**:
   - Retirar `SUPER_ADMIN` y `ESPECIALISTA` de los arreglos `requiredRoles` (líneas 49, 104, 112, 150, 158) e incorporar `JEFE_UNIDAD_ACADEMICA`, `COORDINADOR_AREA`, `DOCENTE` y `GESTOR_APOYO_AREA` donde corresponda por contexto activo (o migrar guards hacia verificación de permiso contextual).
8. **`frontend/src/components/HeaderInstitucional.tsx`, `frontend/src/pages/HomePage.tsx` y `frontend/src/pages/LoginPage.tsx`**:
   - Retirar `SUPER_ADMIN` y `ESPECIALISTA` de checks visuales y `DESTINOS_POR_ROL`.
   - Soportar navegación por permisos contextuales y `GESTOR_APOYO_AREA`, `JEFE_UNIDAD_ACADEMICA`, `COORDINADOR_AREA`, `TESORERO`, `ESTUDIANTE`.
9. **`frontend/src/pages/expedientes/ExpedienteDetallePage.tsx`**:
   - Actualizar `puedeRecepcionar` (línea 823) a `EXPEDIENTE_RECEPCIONAR`, `puedeDigitalizar` (línea 830) a `EXPEDIENTE_ADJUNTAR` (retirando `ESPECIALISTA`), y botón Archivar (línea 1057) a `EXPEDIENTE_ARCHIVAR`.
10. **`frontend/src/pages/administracion/TablasMaestrasPage.tsx`**: Retirar `SUPER_ADMIN` en línea 11.
11. **`frontend/src/components/auth/SelectorContextoModal.tsx` y `SelectorContextoPill.tsx`**: Validar visualización diferenciada de área y vigencia para `ROL` vs `CAPACIDAD` (`GESTOR_APOYO_AREA`).
12. *(Nota de limpieza segura)*: Se detectaron dos archivos aparentemente heredados/duplicados con roles obsoletos (`frontend/src/components/admin/RbacPermissionMatrix.tsx` y `frontend/src/pages/admin/TablasMaestrasPage.tsx`): verificar en Fase C si tienen consumidores antes de tocarlos.

---

## 10. RESPALDO LÓGICO REALIZADO Y VERIFICADO (SECCIÓN 7)

Se generó el respaldo lógico completo mediante `pg_dump` utilizando la conexión oficial de `B_JACOBO` (`sigd_jacobo_demo`) **fuera del repositorio Git** y sin crear ninguna base adicional:

| Atributo | Evidencia verificada |
|---|---|
| **Base respaldada** | `sigd_jacobo_demo` (`PostgreSQL 18.6`) |
| **Ruta absoluta del archivo (fuera del repo)** | `C:\Users\Liz\Backups\SIGD\pre_tsk12\sigd_jacobo_demo_pre_tsk12_2026-11-12T17-29-27.dump` |
| **Formato** | PostgreSQL Custom Archive (`--format=custom --no-owner --no-acl`) |
| **Tamaño real en disco** | `662,972 bytes` (`0.632 MiB`) |
| **Fecha y hora** | `2026-11-12 12:29:28 -05:00` (`2026-11-12T17:29:28.000Z`) |
| **SHA-256 verificada** | `1a8b845a53e7c2ea609ec989b8508d300392992e2c07b221429a1c98c9ed2bcc` |
| **Verificación `pg_restore --list`** | **APROBADA:** `673` objetos catalogados en esquemas `sigd_audit`, `sigd_auth`, `sigd_doc`, `sigd_org`, `sigd_rut`, `sigd_tes`, `sigd_tra` + extensiones `btree_gist`, `ltree`, `pgcrypto`. |

---

## 11. RIESGOS IDENTIFICADOS Y CONTROLES

1. **Bloqueo de cuentas `ESPECIALISTA` sin otro rol (`especialista.demo`, `trabajador.h2.test`):** Al inactivar `ESPECIALISTA`, estas cuentas quedan con `0` roles vigentes y recibirán `403 ACCOUNT_WITHOUT_ROLES`. *Mitigación:* No ejecutar el `UPDATE` sobre `ESPECIALISTA` hasta recibir decisión expresa de Dirección en la autorización de Fase A (si reasignar primero o desactivar).
2. **Omisión de `claims.ctx` en `app.ts` y `resoluciones.controller.ts`:** Actualmente, un usuario con un único rol o contexto podría saltarse el aislamiento de capacidades o ver expedientes fuera de su contexto seleccionado. *Mitigación:* Corregir ambos puntos en Fase B antes de declarar funcional `GESTOR_APOYO_AREA`.
3. **Bloqueo actual de `POST /api/v1/expedientes/:id/subsanar`:** Pide `EXPEDIENTE_RESOLVER`, impidiendo subsanar a ciudadanos y estudiantes. *Mitigación:* Alta prioridad en Fase A (`EXPEDIENTE_SUBSANAR`) y Fase B.
4. **Exclusión de `ESTUDIANTE` en `usuariosAdmin.service.ts` y `CrearUsuarioModal.tsx`:** Hoy está listado en `ROLES_EXTERNOS_PROHIBIDOS`. *Mitigación:* Tratar `ESTUDIANTE` como rol interno institucional manteniendo `CIUDADANO` como único externo.
5. **Organigrama actual limitado a 3 áreas (`DG`, `MP`, `SEC`):** No existen aún las áreas de Unidades Académicas ni Programas de Estudios para asignar `JEFE_UNIDAD_ACADEMICA` / `COORDINADOR_AREA` en producción. *Mitigación:* No inventar áreas en Fase A; preparar el catálogo RBAC y permitir incorporar áreas cuando Dirección confirme la estructura orgánica.
6. **Checksums estrictos en `migrate.ts`:** Cualquier cambio posterior en un `.sql` ya aplicado rompe el pipeline de migraciones (`Error de Integridad DDL`). *Mitigación:* Consolidar completamente `22_sigd_org_catalogo_rbac_institucional.sql` antes de ejecutarla una sola vez y dejar el rollback en `pendientes/`.
7. **Volumen de cambios previos en Git (`548` archivos en working tree):** *Mitigación:* Inventario preservado íntegramente sin `git checkout`/`reset`/`clean`.

---

## 12. ORDEN EXACTO DE EJECUCIÓN PROPUESTO (CUANDO SE AUTORICE)

1. **Pre-verificación de decisiones de Dirección:** Confirmar tratamiento de las cuentas `especialista.demo` y `trabajador.h2.*`, y confirmar inclusión o consolidación de `EXPEDIENTE_CERRAR`.
2. **FASE A — PostgreSQL (`sigd_jacobo_demo`):**
   - Crear `backend/migraciones/22_sigd_org_catalogo_rbac_institucional.sql` y `backend/migraciones/pendientes/22_sigd_org_catalogo_rbac_institucional_rollback.sql`.
   - Ejecutar `migrate.ts --archivo 22_sigd_org_catalogo_rbac_institucional.sql` sobre `sigd_jacobo_demo`.
   - Verificar tablas, constraints, UUID preservados, 10 roles canónicos, permisos, `capacidad_sistema` y `sigd_rut.expediente_evaluador`.
3. **FASE B — Backend (Node/Express/TypeScript):**
   - Actualizar `auth.guard.ts`, `contexto.service.ts`, `app.ts`, `storage.router.ts`.
   - Actualizar `usuariosAdmin.*`, `adminMaestras.routes.ts`.
   - Actualizar `tramites.controller.ts`, `rutadoc.router.ts`, `derivaciones.*`, `resoluciones.controller.ts`, `lecturas.controller.ts`, `reportes.controller.ts`.
   - Compilar `tsc --noEmit` y validar sin errores de tipos.
4. **FASE C — Frontend (React/TypeScript):**
   - Actualizar tipos, hooks, servicios, modales (`CrearUsuarioModal`, `UserEditModal`), páginas (`UsuariosPage`, `RolesPermisosPage`, `ExpedienteDetallePage`, `LoginPage`, `HomePage`, `TablasMaestrasPage`), rutas (`AppRouter`) y header (`HeaderInstitucional`).
   - Compilar `vite build` / `tsc` sin errores.
5. **FASE D — Pruebas y Verificación Automatizada:**
   - Preservar y re-ejecutar todas las suites anteriores (`TSK-1.0C`, `TSK-1.0C-R`, etc.).
   - Implementar y ejecutar pruebas reales para los **15 escenarios funcionales de TSK-1.1B** sobre el entorno autorizado sin declarar certificación sin ejecución real.

---

## 13. ESTRATEGIA DE REVERSIÓN

La reversión opera en **dos niveles no destructivos**:

1. **Nivel 1 — Reversión SQL transaccional (`22_sigd_org_catalogo_rbac_institucional_rollback.sql`, `NO EJECUTADO`):**
   - Elimina asignaciones en `rol_permiso` únicamente de los permisos nuevos o de los 4 roles recién creados si no tienen `usuario_rol` activos.
   - Revierte `vigente = TRUE` sobre `ESPECIALISTA` si hubiese sido desactivado.
   - Elimina `sigd_rut.expediente_evaluador`, `sigd_org.usuario_capacidad`, `sigd_org.capacidad_permiso`, `sigd_org.capacidad_sistema` y la función/trigger `fn_validar_permiso_capacidad` (si no hay datos históricos que Dirección ordene preservar; en su defecto inactiva `vigente = FALSE`).
   - Elimina de `sigd_org.permiso_sistema` únicamente los códigos nuevos agregados por la migración `22_`, y de `sigd_org.rol_sistema` los 4 roles nuevos **solo si no tienen filas en `usuario_rol`** (de existir asignaciones, marca `vigente = FALSE` para no violar FK).
   - Restaura el `CHECK chk_rol_codigo` si no hay filas de los 4 roles en tabla, y limpia la fila de `22_sigd_org_catalogo_rbac_institucional.sql` en `public.sigd_migraciones`.
2. **Nivel 2 — Restauración ante desastre desde respaldo verificado:**
   - Restauración controlada desde `C:\Users\Liz\Backups\SIGD\pre_tsk12\sigd_jacobo_demo_pre_tsk12_2026-11-12T17-29-27.dump` (SHA-256 `1a8b845a53e7c2ea609ec989b8508d300392992e2c07b221429a1c98c9ed2bcc`) exclusivamente sobre `sigd_jacobo_demo` bajo ventana autorizada, sin crear bases adicionales.

---

## 14. RESULTADO DE GIT Y DOCUMENTOS IDENTIFICADOS

### 14.1. Rama y Estado del Repositorio

- **`git branch --show-current`:** `B_JACOBO`
- **`git status --short` (antes de crear este informe de Fase 0):**
  - Total de entradas: **548** (`207 M` modificados, `164 D` eliminados heredados del estado previo en rama, `177 ??` no rastreados).
  - Ninguno de esos cambios acumulados fue alterado, revertido, eliminado ni consolidado en commits durante la Fase 0.

### 14.2. Documentos Rectores Identificados de TSK-1.1, TSK-1.1A y TSK-1.1B en `docs/`

1. [`docs/SIGD_B_JACOBO_CATALOGO_ROLES_INSTITUCIONALES_V1.md`](file:///c:/Users/Liz/Desktop/SIGD/SIGD/docs/SIGD_B_JACOBO_CATALOGO_ROLES_INSTITUCIONALES_V1.md)
2. [`docs/SIGD_B_JACOBO_MATRIZ_ROLES_PERMISOS_AMBITOS_V1.md`](file:///c:/Users/Liz/Desktop/SIGD/SIGD/docs/SIGD_B_JACOBO_MATRIZ_ROLES_PERMISOS_AMBITOS_V1.md)
3. [`docs/SIGD_B_JACOBO_MATRIZ_CAPACIDADES_OPERATIVAS_V1.md`](file:///c:/Users/Liz/Desktop/SIGD/SIGD/docs/SIGD_B_JACOBO_MATRIZ_CAPACIDADES_OPERATIVAS_V1.md)
4. [`docs/SIGD_B_JACOBO_MODELO_ASIGNACIONES_MULTICONTEXTO_V1.md`](file:///c:/Users/Liz/Desktop/SIGD/SIGD/docs/SIGD_B_JACOBO_MODELO_ASIGNACIONES_MULTICONTEXTO_V1.md)
5. [`docs/SIGD_B_JACOBO_CONCILIACION_ROLES_HISTORICOS_V1.md`](file:///c:/Users/Liz/Desktop/SIGD/SIGD/docs/SIGD_B_JACOBO_CONCILIACION_ROLES_HISTORICOS_V1.md)
6. [`docs/SIGD_B_JACOBO_DISENO_MIGRACION_RBAC_TSK_1_1.md`](file:///c:/Users/Liz/Desktop/SIGD/SIGD/docs/SIGD_B_JACOBO_DISENO_MIGRACION_RBAC_TSK_1_1.md)
7. [`docs/INFORME_TSK_1_1_PREPARACION_CATALOGO_ROLES.md`](file:///c:/Users/Liz/Desktop/SIGD/SIGD/docs/INFORME_TSK_1_1_PREPARACION_CATALOGO_ROLES.md)
8. [`docs/INFORME_TSK_1_1B_CIERRE_BRECHAS_RBAC.md`](file:///c:/Users/Liz/Desktop/SIGD/SIGD/docs/INFORME_TSK_1_1B_CIERRE_BRECHAS_RBAC.md)

---

## CONDICIÓN DE PARADA — PUNTO DE AUTORIZACIÓN OBLIGATORIO

> [!CAUTION]
> **FASE 0 CONCLUIDA Y DETENIDA.**
> - No se ejecutó DDL ni DML en `sigd_jacobo_demo`.
> - No se modificó código fuente de backend ni de frontend.
> - Se espera tu **autorización expresa** para iniciar las Fases **A (PostgreSQL)**, **B (Backend)**, **C (Frontend)** y **D (Pruebas)**, junto con tu decisión sobre:
>   1. **Tratamiento de `ESPECIALISTA`** (y especialmente las cuentas `especialista.demo`, `trabajador.h2.test` y `trabajador.h2.5079`).
>   2. **Inclusión explícita o consolidación de `EXPEDIENTE_CERRAR`** en Fase A.
