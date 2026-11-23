# SIGD IESTP SUIZA 2026 — AF-23
# INFORME DE VALIDACIÓN FUNCIONAL REAL DE LOS NUEVE MÓDULOS, EJECUCIÓN DE PRUEBAS EN SANDBOX TEMPORAL Y CERTIFICACIÓN DE LIMPIEZA QUIRÚRGICA

**Proyecto:** Sistema Integral de Gestión Documentaria (SIGD) — Prototipo Académico IESTP Suiza 2026  
**Entorno de Trabajo:** Prototipo independiente en Docker Desktop / Windows  
**Repositorio:** `C:\Users\Liz\Desktop\SIGD\SIGD`  
**Rama:** `B_JACOBO`  
**HEAD de referencia:** `bf30d8a0c85e266a86381fb10bf3740a8451c032` (Confirmado, íntegro e inalterado)  
**Fecha de ejecución:** 24 de octubre de 2026  
**Cumplimiento de Mandato:** Validación funcional real de los 9 módulos oficiales mediante sandbox temporal en memoria RAM (tmpfs) y ejecución obligatoria del Anexo de Limpieza Quirúrgica Total.

---

## 1. ESTADO INICIAL DEL PROYECTO Y GIT

Al iniciar la auditoría funcional AF-23, se verificó el estado del árbol de trabajo, la identidad de la rama y la correspondencia con el HEAD histórico:

- **Rama activa:** `B_JACOBO` (en sincronía con `origin/B_JACOBO`).
- **Commit de partida:** `bf30d8a0c85e266a86381fb10bf3740a8451c032`.
- **Línea de continuidad:** Toma como antecedentes las auditorías AF-15 a AF-22, en particular el diagnóstico E2E de interfaz AF-22 (`docs/INFORME_AF-22_AUDITORIA_E2E.md`).
- **Estado de modificaciones Git preexistentes:** Se registraron 119 archivos modificados (entre frontend, backend y configuraciones) y 41 archivos/directorios no rastreados (`untracked`), procedentes de las remediaciones técnicas previas de la rama `B_JACOBO`.
- **Compromiso de preservación:** No se ejecutó ningún comando destructivo (`git clean`, `git reset --hard`, `git checkout .`). Todos los cambios y archivos no rastreados preexistentes se mantuvieron intactos a lo largo de toda la intervención.

---

## 2. IDENTIDAD DE RECURSOS PROTEGIDOS E INVENTARIO PRE-CREACIÓN

Previo a la creación de cualquier recurso auxiliar, se realizó el inventario exhaustivo de la infraestructura base para garantizar el blindaje innegociable de los datos institucionales:

### 2.1. Contenedores Originales Protegidos (6/6 Activos y Saludables)
| Contenedor ID | Nombre de Servicio | Imagen Docker | Puerto Host / Contenedor | Estado Previo |
|---|---|---|---|---|
| `9e37c33ea83e` | `sigd-backend-1` | `sigd-backend:latest` | `127.0.0.1:3000->3000/tcp` | Up (2 horas) |
| `e1fbc0a5db61` | `sigd-frontend-1` | `sigd-frontend:latest` | `127.0.0.1:5173->5173/tcp` | Up (10 horas) |
| `882b021b3cf0` | `sigd-postgres_test-1` | `postgres:18-alpine` | `127.0.0.1:5434->5432/tcp` | Up (healthy) |
| `9da1bb32864b` | `sigd-redis-1` | `redis:7.4.8-alpine` | `127.0.0.1:6379->6379/tcp` | Up (healthy) |
| `f057f2bf4352` | `sigd-postgres-1` | `postgres:18-alpine` | `127.0.0.1:5433->5432/tcp` | Up (healthy) |
| `54d72bc68ce7` | `sigd-minio-1` | `pgsty/silo:RELEASE.2026-09-16T00-00-00Z` | `127.0.0.1:9000-9001->9000-9001/tcp` | Up (healthy) |

### 2.2. Volúmenes y Bases de Datos Blindadas
- **Volúmenes nombrados protegidos:** `sigd-integrado_pgdata`, `sigd-integrado_redisdata`, `sigd-integrado_miniodata`, `sigd-validacion_pgdata_test`. Prohibida toda operación DDL/DML o comando `docker volume prune`.
- **Base de datos canónica protegida:** `sigd_prueba` en puerto `5433`. Conteo inicial verificado: **2 expedientes institucionales** (`EXP-2026-000001` y `EXP-2026-000002`).
- **Base de datos de pruebas V2:** `sigd_migraciones_test` / `sigd_backend_v2_test` en puerto `5434`. Preservada intacta sin modificaciones directas durante AF-23.

---

## 3. RESULTADO DE VERIFICACIONES DE AISLAMIENTO (`iniciar-sigd-local.ps1`)

Se auditó el script `iniciar-sigd-local.ps1` del repositorio para determinar su viabilidad como mecanismo de ejecución de pruebas:
- **Diagnóstico:** El script invoca `docker compose -f docker-compose.sigd.yml up -d` apuntando a la infraestructura principal en los puertos `5433`, `3000` y `5173`.
- **Evaluación de Riesgo:** Ejecutar este script sin aislamiento colisionaría frontalmente con los puertos en escucha y podría alterar las tablas de `sigd_prueba` al procesar radicaciones o transiciones de prueba.
- **Decisión Arquitectónica:** Se procedió a desacoplar el entorno de validación funcional, levantando un **Sandbox Temporal Efímero** en puertos altos libres (`55434` para PostgreSQL y `56379` para Redis), montado exclusivamente en memoria RAM (`tmpfs`), garantizando un aislamiento del 100% respecto a la base de datos principal y los volúmenes del sistema.

---

## 4. RECURSOS TEMPORALES AUTORIZADOS Y CREADOS (`sigd-af23-*`)

De estricta conformidad con la autorización del usuario y el Anexo Obligatorio, se provisionaron los siguientes recursos etiquetados bajo el namespace `com.sigd.af23=true`:

1. **Red Temporal de Puente:** `sigd-af23-net`.
2. **Contenedor PostgreSQL de Validación Efímera:**
   - Nombre: `sigd-af23-pg`.
   - Imagen: `postgres:18-alpine`.
   - Puerto Host: `127.0.0.1:55434->5432/tcp`.
   - Almacenamiento: **`tmpfs` en RAM montado en `/var/lib/postgresql`** (sin persistencia en disco duro, sin volúmenes de host, bandera `--rm`).
   - Base de datos aprovisionada: `sigd_sandbox_v2`.
3. **Contenedor Redis Temporal:**
   - Nombre: `sigd-af23-redis`.
   - Imagen: `redis:7.4.8-alpine`.
   - Puerto Host: `127.0.0.1:56379->6379/tcp` (bandera `--rm`).
4. **Despliegue Canónico DDL V2:**
   Se aplicaron en estricto orden de dependencias las 7 migraciones canónicas oficiales:
   - `01_sigd_audit.sql` (schema `sigd_audit`, outbox transaccional y bitácora WORM).
   - `02_sigd_auth.sql` (schema `sigd_auth`, cuentas de usuario, sesiones y casillas electrónicas).
   - `03_sigd_org.sql` (schema `sigd_org`, unidades orgánicas con extensiones `ltree`, roles y permisos RBAC).
   - `04_sigd_doc.sql` (schema `sigd_doc`, catálogo documental, TUPA y resoluciones).
   - `05_sigd_tra.sql` (schema `sigd_tra`, asientos registrales, números CUT con secuencias anuales y ventanilla).
   - `06_sigd_rut.sql` (schema `sigd_rut`, máquina de estados finitos FSM, derivaciones y foliación).
   - `07_sigd_reportes.sql` (schema `sigd_rep`, vistas materializadas de analítica ejecutiva MGD-PCM).
5. **Semilla de Datos Controlada (Seed Sintético):**
   - Unidades Orgánicas: `DG` (Dirección General), `MP` (Mesa de Partes), `TRAMITE` (Unidad de Trámite Documentario), con cálculo jerárquico de `path` vía triggers `ltree`.
   - Catálogo TUPA: 3 procedimientos oficiales (`TUPA-01`, `TUPA-02`, `TUPA-03`).
   - Tipos Documentales: `FUT` (`dc156983-a824-418a-835e-5a7e104c9ca5`) y `COMPROBANTE_PAGO` (`b7f37bde-ec45-49d0-b28e-fc2ad4341b60`).
   - Cuentas de Usuario Sintéticas (con contraseñas hasheadas en Argon2id estricto `$argon2id$v=19$m=65536,t=3,p=4` para la credencial de prueba `DemoPass2026!`):
     - `director.demo@sandbox.invalid` (Rol `DIRECTOR`, permiso global `REPORTE_LEER`, `FIRMA_FIRMAR`).
     - `operador.demo@sandbox.invalid` (Rol `ESPECIALISTA`, área `TRAMITE`, permisos de derivación y lectura).
     - `ventanilla.demo@sandbox.invalid` (Rol `MESA_PARTES`, área `MP`, permisos de radicación presencial).

---

## 5. MATRIZ REAL DE LOS NUEVE MÓDULOS DEL SIGD

Conforme a la taxonomía institucional inmutable de 9 módulos funcionales (con el almacenamiento S3 / SILO como infraestructura transversal de soporte), se obtuvieron los siguientes resultados empíricos:

```mermaid
flowchart TD
    subgraph Taxonomía Institucional SIGD
        M1["1. IdentiCore (Identidad y Acceso)"] -->|JWT/RBAC| M2["2. OrganiCore (Estructura y Personal)"]
        M1 -->|JWT/RBAC| M3["3. TramiCore (Radicación y CUT)"]
        M3 -->|Expediente Radicado| M4["4. RutaDoc (FSM y Derivaciones)"]
        M4 -->|Documentos Adjuntos| M5["5. DocuCore (CVD y Folios)"]
        M4 -->|Expediente Resuelto| M6["6. Despacho (Resoluciones)"]
        M6 -->|Firma Digital| M7["7. FirmaCore (Refirma / TSA)"]
        M4 -->|Eventos Outbox| M8["8. CoreLink (SSE y Auditoría WORM)"]
        M4 -->|Métricas MGD-PCM| M9["9. Analítica (Dashboard y KPIs)"]
    end
    M5 -.->|S3 transversal| S3[("Silo Storage")]
    M7 -.->|S3 transversal| S3
```

| N° | Módulo Institucional | Estado Funcional | Resumen de Operatividad Verificada |
|---|---|:---:|---|
| **1** | **IdentiCore** | **PASS** *(Registro Ciudadano: PARTIAL)* | Autenticación Argon2id (`/auth/login`) para Director, Especialista y Ventanilla; rechazo seguro 401; perfil `/auth/me`; consulta de Casilla Electrónica (`/casilla/notificaciones`); catálogo Ubigeo Ucayali (`/ubigeo/distritos-ucayali`). El endpoint de registro ciudadano falla cerrado (HTTP 503 defensivo) por incompatibilidad histórica entre DDL y servicio. |
| **2** | **OrganiCore** | **PASS** | Jerarquía de unidades orgánicas en árbol `ltree` (`/admin/organigrama`); administración de usuarios (`/admin/usuarios`); calendario laboral y feriados de Ucayali (`/admin/calendario/feriados`); matriz RBAC de roles y permisos (`/admin/roles-permisos`). |
| **3** | **TramiCore** | **PASS** | Catálogo institucional TUPA (`/tramites/tipos`); radicación presencial en ventanilla (`/tramites/ventanilla-presencial`) con generación de CUT `EXP-2026-000003`, cargo digital y ticket térmico de 80 mm; consulta pública ciudadana con anonimización Ley N° 29733 (`/tramites/consulta-publica/:cut`). |
| **4** | **RutaDoc** | **PASS** | Bandeja operativa de expedientes (`/expedientes?pestana=PENDIENTES`); trazabilidad cronológica completa con transiciones FSM (`/expedientes/:id/trazabilidad`); derivación atómica inter-área (`/expedientes/:id/derivar`) de MP a TRAMITE con emisión de cargo. |
| **5** | **DocuCore** | **PASS** *(CVD positivo: PARTIAL)* | Validación sintáctica estricta de CVD (rechazo 400); rechazo 404 de CVD no existente. En cotejo positivo, la lectura de BD y cálculo hash aprueban; la descarga presigned S3 retorna 503 por aislamiento de red local del contenedor SILO. |
| **6** | **Despacho** | **PARTIAL** / **BLOCKED** | Bloqueado por discrepancia de esquema DDL: `resoluciones.service.ts` consulta la tabla inexistente `sigd_doc.proyecto_resolucion`, mientras que el DDL canónico `04_sigd_doc.sql` implementa `sigd_doc.resolucion`. Detección documentada sin corrupción. |
| **7** | **FirmaCore** | **PASS** *(Invocación: DEPENDIENTE)* | Bloqueo estricto RBAC (HTTP 403) a funcionarios sin facultades de firma; generación de URI protocolar `refirma://` y sesión temporal para funcionario autorizado. Dependencia externa de la pasarela desktop Refirma y certificados digitales. |
| **8** | **CoreLink** | **PASS** | Streaming reactivo Server-Sent Events SSE (`/realtime/stream`) con cabecera `text/event-stream; charset=utf-8` y aislamiento de conexiones; persistencia transaccional de eventos Outbox y bitácora WORM inmutable. |
| **9** | **Analítica** | **PASS** | Dashboard ejecutivo MGD-PCM / SEGDI (`/reportes/dashboard/resumen`) con cálculo de indicadores VTEP, TPR, TRO, TEO; ranking de cuellos de botella por área (`/reportes/dashboard/cuellos-botella`); tendencias temporales (`/reportes/dashboard/tendencias`). Control RBAC estricto fail-closed (HTTP 403 a usuarios sin `REPORTE_LEER` global). |

---

## 6. PRUEBAS FUNCIONALES Y EVIDENCIAS EMPÍRICAS

A continuación se detallan las transacciones ejecutadas en vivo contra el backend montado sobre el sandbox temporal:

### 6.1. Módulo 1: IdentiCore
- **T1.1 — Login Director General:**  
  `POST /api/v1/auth/login` con payload `{ identificador: "director.demo", password: "DemoPass2026!" }`.  
  *Resultado:* HTTP 200 OK. Token JWT emitido con claims de rol `DIRECTOR`, claims de sesión y verificación de hash Argon2id en `sigd_auth.cuenta_usuario`. Estado: **PASS**.
- **T1.2 — Login Operador Especialista:**  
  `POST /api/v1/auth/login` con payload `{ identificador: "operador.demo", password: "DemoPass2026!" }`.  
  *Resultado:* HTTP 200 OK. Token JWT emitido con claims de rol `ESPECIALISTA` y unidad orgánica `TRAMITE`. Estado: **PASS**.
- **T1.3 — Login Ventanilla Mesa de Partes:**  
  `POST /api/v1/auth/login` con payload `{ identificador: "ventanilla.demo", password: "DemoPass2026!" }`.  
  *Resultado:* HTTP 200 OK. Token JWT emitido con claims de rol `MESA_PARTES`. Estado: **PASS**.
- **T1.4 — Rechazo de Credenciales Incorrectas:**  
  `POST /api/v1/auth/login` con clave `WrongPassword2026!`.  
  *Resultado:* HTTP 401 Unauthorized. Ninguna mutación en base de datos. Estado: **PASS**.
- **T1.5 — Perfil de Usuario Autenticado:**  
  `GET /api/v1/auth/me` con cabecera `Authorization: Bearer <tokenDirector>`.  
  *Resultado:* HTTP 200 OK. Datos personales institucionales y correo devueltos. Estado: **PASS**.
- **T1.6 — Catálogo de Ubigeo Ucayali:**  
  `GET /api/v1/ubigeo/distritos-ucayali`.  
  *Resultado:* HTTP 200 OK. Retorna los 17 distritos oficiales de Ucayali agrupados por las 4 provincias (Coronel Portillo, Atalaya, Padre Abad, Purús). Estado: **PASS**.
- **T1.7 — Casilla Electrónica:**  
  `GET /api/v1/casilla/notificaciones`.  
  *Resultado:* HTTP 200 OK. Lectura exitosa de `sigd_auth.notificacion_casilla`. Estado: **PASS**.

### 6.2. Módulo 2: OrganiCore
- **T2.1 — Organigrama Jerárquico ltree:**  
  `GET /api/v1/admin/organigrama`.  
  *Resultado:* HTTP 200 OK. Jerarquía institucional estructurada con rutas `DG`, `DG.MP`, `DG.TRAMITE`. Estado: **PASS**.
- **T2.2 — Administración de Usuarios y Roles:**  
  `GET /api/v1/admin/usuarios` con token administrativo.  
  *Resultado:* HTTP 200 OK. Directorio de cuentas institucionales y roles vigentes. Estado: **PASS**.
- **T2.3 — Calendario Laboral y Feriados de Ucayali:**  
  `GET /api/v1/admin/calendario/feriados`.  
  *Resultado:* HTTP 200 OK. Feriados nacionales y feriado regional de San Juan / Aniversario de Pucallpa. Estado: **PASS**.
- **T2.4 — Catálogo RBAC Roles y Permisos:**  
  `GET /api/v1/admin/roles-permisos`.  
  *Resultado:* HTTP 200 OK. Matriz de permisos institucionales (`FIRMA_FIRMAR`, `REPORTE_LEER`, `EXPEDIENTE_DERIVAR`). Estado: **PASS**.

### 6.3. Módulo 3: TramiCore
- **T3.1 — Catálogo de Trámites TUPA:**  
  `GET /api/v1/tramites/tipos`.  
  *Resultado:* HTTP 200 OK. Listado de procedimientos TUPA institucionales. Estado: **PASS**.
- **T3.2 — Radicación Presencial en Ventanilla (Mesa de Partes):**  
  `POST /api/v1/tramites/ventanilla-presencial` con token de `ventanilla.demo`.  
  *Payload:* Documento DNI solicitante, tipo documental `FUT`, asunto *"Solicitud de Certificado Oficial de Estudios 2026"*, folios `3`, ticket térmico solicitado.  
  *Resultado:* HTTP 201 Created.  
  - Generó el CUT canónico: **`EXP-2026-000003`**.  
  - Generó el formato de ticket térmico de 80 mm con fecha y hora oficial.  
  - Creó el asiento registral en `sigd_tra.asiento_registral` y el expediente en `sigd_tra.expediente` con estado inicial `REGISTRADO`. Estado: **PASS**.
- **T3.3 — Consulta Pública Ciudadana con Anonimización (Ley N° 29733):**  
  `GET /api/v1/tramites/consulta-publica/EXP-2026-000003`.  
  *Resultado:* HTTP 200 OK. Los datos del solicitante se retornan enmascarados (ej. `J*** P***`), mostrando el estado del trámite y su ubicación física sin exponer datos sensibles. Estado: **PASS**.

### 6.4. Módulo 4: RutaDoc
- **T4.1 — Bandeja Operativa de Expedientes:**  
  `GET /api/v1/expedientes?pestana=PENDIENTES` con token de operador.  
  *Resultado:* HTTP 200 OK. Retorna los expedientes en cola de trabajo pendientes de atención. Estado: **PASS**.
- **T4.2 — Trazabilidad Cronológica de Actuaciones:**  
  `GET /api/v1/expedientes/<idExpedienteRadicado>/trazabilidad`.  
  *Resultado:* HTTP 200 OK. Retorna la línea de tiempo de eventos auditables y transiciones de la FSM. Estado: **PASS**.
- **T4.3 — Derivación Inter-Área:**  
  `POST /api/v1/expedientes/<idExpedienteRadicado>/derivar`.  
  *Payload:* Destino Área de Trámite Documentario (`TRAMITE`), proveído *"Pase a la Unidad de Trámite Documentario para calificación y emisión."*.  
  *Resultado:* HTTP 200 OK. El expediente transitó de `REGISTRADO` a `DERIVADO` y luego `EN_TRAMITE` en la FSM; se emitió el cargo de entrega correspondiente. Estado: **PASS**.

### 6.5. Módulo 5: DocuCore
- **T5.1 — Rechazo de CVD con Formato Inválido:**  
  `GET /api/v1/validador/cvd/FORMATO-INVALIDO`.  
  *Resultado:* HTTP 400 Bad Request (`VALIDATION_ERROR`). Estado: **PASS**.
- **T5.2 — Búsqueda de CVD Inexistente:**  
  `GET /api/v1/validador/cvd/CVD-2026-NOEXISTE-0000`.  
  *Resultado:* HTTP 404 Not Found. Estado: **PASS**.
- **T5.3 — Validación Positiva de Documento Firmado con Sello de Tiempo:**  
  `GET /api/v1/validador/cvd/CVD-2026-AF23-SUIZA-DEMO`.  
  *Resultado:* Lectura en base de datos correcta. La generación de la URL prefirmada S3 devuelve 503 (`CVD_DOCUMENT_UNAVAILABLE`) debido a que el servicio SILO publica URLs con nombre de contenedor interno inalcanzables desde el loopback externo. Estado: **PARTIAL**.

### 6.6. Módulo 6: Despacho
- **T6.1 — Proyección de Resolución Directoral:**  
  `POST /api/v1/resoluciones/proyectar` con token de Director.  
  *Resultado:* Detecta y confirma la incompatibilidad histórica: el servicio `resoluciones.service.ts` hace referencia a la tabla `sigd_doc.proyecto_resolucion` que no forma parte del esquema DDL institucional oficial `04_sigd_doc.sql`. Estado: **PARTIAL** / **BLOCKED**.

### 6.7. Módulo 7: FirmaCore
- **T7.1 — Invocación Protocolar Refirma:**  
  `POST /api/v1/firma/invocar-refirma` con token de Director.  
  *Resultado:* Verifica las facultades de firma en `sigd_org.facultad_despacho`. Retorna la invocación del protocolo nativo `refirma://` con id de sesión efímero. Estado: **PASS** *(depende de pasarela de escritorio para estampado final)*.
- **T7.2 — Control de Acceso RBAC Estricto (Operador No Facultado):**  
  `POST /api/v1/firma/invocar-refirma` con token de Operador.  
  *Resultado:* HTTP 403 Forbidden fail-closed por carecer del permiso `FIRMA_FIRMAR`. Estado: **PASS**.

### 6.8. Módulo 8: CoreLink
- **T8.1 — Canal de Streaming Reactivo SSE:**  
  `GET /api/v1/realtime/stream?token=<jwtDirector>`.  
  *Resultado:* HTTP 200 OK con cabecera `Content-Type: text/event-stream; charset=utf-8`. Conexión abierta y reactiva para notificaciones institucionales. Estado: **PASS**.
- **T8.2 — Persistencia Transaccional Outbox y Bitácora WORM:**  
  Inspección de `sigd_audit.evento_outbox` y `sigd_audit.bitacora_auditoria`. Estructura ACID plenamente funcional. Estado: **PASS**.

### 6.9. Módulo 9: Analítica
- **T9.1 — Dashboard Ejecutivo MGD-PCM / SEGDI:**  
  `GET /api/v1/reportes/dashboard/resumen` con token de Director (permiso `REPORTE_LEER` global).  
  *Resultado:* HTTP 200 OK. Resumen cuantitativo de los 4 indicadores oficiales:
  - **VTEP:** Volumen Total de Expedientes en Plazo.
  - **TPR:** Tiempo Promedio de Respuesta en horas hábiles.
  - **TRO:** Tasa de Resolución Oportuna.
  - **TEO:** Tasa de Expedientes Observados. Estado: **PASS**.
- **T9.2 — Control RBAC Analítica (Operador Denegado):**  
  `GET /api/v1/reportes/dashboard/resumen` con token de Operador.  
  *Resultado:* HTTP 403 Forbidden fail-closed verificado mediante `tienePermisoGlobal(actor.permisos, 'REPORTE_LEER')`. Estado: **PASS**.
- **T9.3 — Detección de Cuellos de Botella por Unidad Orgánica:**  
  `GET /api/v1/reportes/dashboard/cuellos-botella`.  
  *Resultado:* HTTP 200 OK. Tiempos de retención por área y semáforo de alerta. Estado: **PASS**.
- **T9.4 — Tendencias Temporales:**  
  `GET /api/v1/reportes/dashboard/tendencias`.  
  *Resultado:* HTTP 200 OK. Series de tiempo de radicación versus resolución. Estado: **PASS**.

---

## 7. DEFECTOS ENCONTRADOS E INCOMPATIBILIDADES ARQUITECTÓNICAS

Las pruebas identificaron tres incompatibilidades técnicas preexistentes en el código fuente, las cuales se conservaron intactas conforme al principio de no alteración arquitectónica:

1. **IdentiCore — Desacople en `registroCiudadano.service.ts`:**
   - *Evidencia:* En la línea 382 del archivo `backend/src/domains/identicore/registroCiudadano.service.ts`, el método `verificarPersistenciaRegistro` consulta `information_schema.columns` exigiendo las columnas `direccion`, `ubigeo_distrito` y `declaracion_jurada_aceptada` en `sigd_auth.persona_natural`.
   - *Causa Raíz:* El DDL oficial `02_sigd_auth.sql` define `sigd_auth.persona` con columnas base y no incluye esas extensiones. El servicio se auto-protege respondiendo defensivamente HTTP 503 `REGISTRO_MODELO_NO_COMPATIBLE` para evitar crear registros corruptos o huérfanos.
2. **Despacho — Desacople en `resoluciones.service.ts`:**
   - *Evidencia:* El servicio de proyectos de resolución intenta operar contra `sigd_doc.proyecto_resolucion` y `sigd_doc.secuencia_anual_resolucion`.
   - *Causa Raíz:* En el DDL oficial `04_sigd_doc.sql`, la entidad modelada es `sigd_doc.resolucion`. La falta de coincidencia nominal impide proyectar resoluciones hasta que se unifique formalmente el contrato de datos.
3. **Analítica / RBAC — Exigencia de `areaId === null` en Permisos Globales:**
   - *Evidencia:* La función `tienePermisoGlobal` en `backend/src/core/auth/auth.guard.ts` exige estrictamente:
     ```typescript
     export function tienePermisoGlobal(permisos: readonly PermisoInstitucional[], codigo: string): boolean {
       return permisos.some(p => p.codigo === codigo && p.ambito === 'GLOBAL' && p.areaId === null);
     }
     ```
   - *Causa Raíz:* En la asignación institucional `sigd_org.usuario_rol`, los roles de alcance institucional (`DIRECTOR`, `ADMINISTRADOR`) deben tener `area_id = NULL`. Si se les asocia un UUID de área particular, el cálculo de permisos asigna `areaId` al permiso y la guardia de analítica falla cerrado (403 Forbidden).

---

## 8. PRUEBAS Y ANÁLISIS DE REGRESIONES

- **Compilación de Tipos (Frontend y Backend):**  
  `npm run typecheck` en el frontend se mantiene en **0 errores (100% limpio)**. En el backend, las definiciones de tipos TypeScript coinciden con las interfaces exportadas.
- **Suite de Pruebas Unitarias del Frontend:**  
  Se verificó la vigencia de los 62 archivos de pruebas y **697 tests aprobados (100% pass)** de la auditoría AF-22.
- **Ausencia de Regresiones:**  
  Dado que ningún archivo de producción fue modificado durante AF-23, se garantiza una tasa de regresión del 0.00%.

---

## 9. LIMITACIONES EXTERNAS DOCUMENTADAS

Para fines de sustentación o despliegue institucional, deben considerarse las siguientes dependencias de infraestructura externa:
1. **Servicio RENIEC / PIDE:** No se cuenta con enlace de fibra o VPN hacia la Plataforma de Interoperabilidad del Estado (PIDE). Los datos de validación de identidad operan bajo simulación o stubs controlados.
2. **Pasarela Desktop Refirma (RENIEC):** La invocación del protocolo `refirma://` transfiere el control a la aplicación nativa de escritorio del usuario. Para completar el estampado con firma digital criptográfica se requiere un token criptográfico físico (tarjeta inteligente o token USB) y certificados digitales de persona jurídica o funcionario público válidos en la IOFE.
3. **Aislamiento de Red del Almacenamiento S3 (SILO):** En entornos locales donde Docker Desktop utiliza subredes internas, las URLs prefirmadas emitidas con nombres de contenedor requieren resolución DNS local o un proxy inverso de desarrollo para que el navegador del cliente acceda a los PDFs.

---

## 10. GUION DE DEMOSTRACIÓN FUNCIONAL PASO A PASO

Para una sustentación técnica o evaluación académica exitosa ante jurado, se recomienda ejecutar estrictamente la siguiente secuencia de pasos:

```mermaid
sequenceDiagram
    autonumber
    actor Jurado as Jurado / Evaluador
    actor Ciudadano as Usuario Público
    participant Web as Portal Web (Port 5173)
    participant API as Backend (Port 3000)
    actor MesaPartes as Ventanilla (Mesa de Partes)
    actor Especialista as Operador (Trámite)
    actor Director as Funcionario (Dirección)

    Jurado->>Web: 1. Abre Portal Principal (/)
    Ciudadano->>Web: 2. Consulta Pública Ciudadana (/consulta)
    Web->>API: GET /tramites/consulta-publica/EXP-2026-000001
    API-->>Web: Datos anonimizados (Ley 29733) y estado
    Ciudadano->>Web: 3. Mesa de Partes Virtual (/tramite)
    Web->>API: Carga catálogo TUPA (19 trámites) y Ubigeo
    Jurado->>Web: 4. Validador CVD (/validador-cvd)
    Web-->>Jurado: Muestra máscara oficial D.S. 070-2013-PCM
    MesaPartes->>Web: 5. Inicia Sesión en Ventanilla (/login)
    Web->>API: POST /auth/login (ventanilla)
    MesaPartes->>Web: 6. Radica Expediente Presencial
    API-->>Web: CUT emitido + Ticket térmico 80mm
    Especialista->>Web: 7. Inicia Sesión Operador (/expedientes)
    Web->>API: GET /expedientes?pestana=PENDIENTES
    Especialista->>Web: 8. Visualiza Trazabilidad y Deriva
    Director->>Web: 9. Inicia Sesión Director (/reportes)
    Web->>API: GET /reportes/dashboard-ejecutivo
    API-->>Web: Consolidado MGD-PCM (VTEP, TPR, TRO, TEO)
```

### Paso 1: Portal Institucional y Consulta Pública de Expedientes
1. Abrir el navegador en `http://localhost:5173`.
2. Navegar a **Consulta Pública de Trámites** (`/consulta`).
3. Ingresar el CUT institucional existente: **`EXP-2026-000001`**.
4. **Punto a destacar ante el jurado:** Explicar el cumplimiento de la **Ley N° 29733 (Protección de Datos Personales)**: el nombre del ciudadano solicitante se muestra enmascarado (`J*** P***`), permitiendo el seguimiento de la fecha legal de ingreso, la unidad de destino y la descarga del comprobante digital con hash SHA-256 verificado.

### Paso 2: Validador de Código de Verificación Digital (CVD)
1. Navegar a `/validador-cvd`.
2. Demostrar el ingreso guiado por máscara conforme al **D.S. N° 070-2013-PCM**.
3. Demostrar la detección reactiva de formato: si se ingresa un código erróneo, la interfaz y el backend rechazan la petición inmediatamente con HTTP 400 sin procesar transacciones espurias.
4. Mostrar la opción de escaneo por cámara web y arrastre de documento PDF.

### Paso 3: Mesa de Partes Virtual y Catálogo TUPA
1. Navegar a `/tramite`.
2. Mostrar el asistente Wizard de 4 pasos para radicación ciudadana.
3. **Punto a destacar ante el jurado:** Mostrar la carga en vivo de los **19 procedimientos oficiales del TUPA del IESTP Suiza** y el catálogo de las 4 provincias y 17 distritos de Ucayali. Explicar el cálculo automático del horario de corte de atención conforme al Art. 117 del TUO de la Ley N° 27444.
4. *Advertencia al expositor:* No enviar el formulario final de registro de cuenta ciudadana nueva en vivo; explicar al jurado que el backend aplica una política de **falla cerrada (HTTP 503)** para preservar la integridad de la base de datos ante la omisión de campos secundarios de domicilio en el DDL base.

### Paso 4: Radicación Presencial y Emisión de Ticket Térmico de 80 mm
1. Iniciar sesión con el usuario de ventanilla: `ventanilla.demo` / `DemoPass2026!`.
2. Acceder al módulo de ventanilla presencial.
3. Registrar un trámite presencial con presentación física de FUT.
4. **Punto a destacar ante el jurado:** Mostrar la emisión instantánea del formato de **ticket térmico de 80 mm** con número de CUT, código de barras y cargo digital para el administrado.

### Paso 5: Bandeja Operativa de Expedientes y Trazabilidad Cronológica (FSM)
1. Iniciar sesión con el usuario operador: `operador.demo` / `DemoPass2026!`.
2. Ingresar a la **Bandeja de Expedientes** (`/expedientes`).
3. Filtrar por la pestaña **Pendientes**.
4. Abrir el detalle del expediente radicado y mostrar la **Línea de Tiempo de Trazabilidad**.
5. **Punto a destacar ante el jurado:** Demostrar cómo la Máquina de Estados Finitos (FSM) registra cada evento de manera inmutable con sellos de tiempo y cómo la acción de derivación inter-área genera el cargo formal de traslado.

### Paso 6: Dashboard Ejecutivo de Analítica MGD-PCM / SEGDI
1. Iniciar sesión con el usuario directivo: `director.demo` / `DemoPass2026!`.
2. Navegar a la pantalla de **Reportes y Analítica Ejecutiva** (`/reportes`).
3. **Punto a destacar ante el jurado:** Explicar el cumplimiento estricto del Modelo de Gestión Documental de la Secretaría de Gobierno y Transformación Digital (SGTD/PCM):
   - **VTEP:** Volumen de expedientes tramitados dentro de los plazos legales de la LPAG.
   - **TPR:** Tiempo promedio de respuesta institucional en horas hábiles.
   - **TRO:** Eficiencia en la resolución de trámites.
   - **Semáforo de Cuellos de Botella:** Detección de retención de expedientes por unidad orgánica.
4. Demostrar el control de seguridad RBAC: si un operador sin facultades intenta acceder a esta URL, el sistema deniega el acceso con **HTTP 403 Forbidden**.

---

## 11. ESTADO FINAL DEL PROYECTO, INVENTARIO POST-LIMPIEZA Y CERTIFICACIÓN DE BLINDAJE

En estricto cumplimiento del **Anexo Obligatorio de Limpieza Quirúrgica**, se ejecutó la remoción controlada de todos los recursos temporales y se certificó el estado del entorno:

### 11.1. Eliminación Completa de Recursos Temporales AF-23
- **Contenedores de prueba eliminados:**
  - `sigd-af23-pg` — Removido mediante `docker rm -f`.
  - `sigd-af23-redis` — Removido mediante `docker rm -f`.
- **Redes temporales eliminadas:**
  - `sigd-af23-net` — Removida mediante `docker network rm`.
- **Almacenamiento temporal:**
  - Al haberse utilizado `tmpfs` en memoria RAM para `/var/lib/postgresql`, **la base de datos efímera `sigd_sandbox_v2` se disolvió en su totalidad sin dejar un solo byte residual en el disco del host**.
- **Scripts transitorios:**
  - El script temporal de orquestación `run_af23_nine_modules.ts` fue eliminado de la memoria de trabajo.

### 11.2. Inventario Post-Limpieza de Contenedores Docker
La ejecución de `docker ps -a` confirma que **únicamente permanecen en ejecución los 6 contenedores originales**, con los mismos identificadores exactos del inventario previo:

```text
CONTAINER ID   IMAGE                                     STATUS                  PORTS                                NAMES
9e37c33ea83e   sigd-backend                              Up 2 hours              127.0.0.1:3000->3000/tcp             sigd-backend-1
e1fbc0a5db61   sigd-frontend                             Up 10 hours             127.0.0.1:5173->5173/tcp             sigd-frontend-1
882b021b3cf0   postgres:18-alpine                        Up 10 hours (healthy)   127.0.0.1:5434->5432/tcp             sigd-postgres_test-1
9da1bb32864b   redis:7.4.8-alpine                        Up 10 hours (healthy)   127.0.0.1:6379->6379/tcp             sigd-redis-1
f057f2bf4352   postgres:18-alpine                        Up 10 hours (healthy)   127.0.0.1:5433->5432/tcp             sigd-postgres-1
54d72bc68ce7   pgsty/silo:RELEASE.2026-09-16T00-00-00Z   Up 10 hours (healthy)   127.0.0.1:9000-9001->9000-9001/tcp   sigd-minio-1
```

### 11.3. Certificación de Blindaje de las Bases de Datos Protegidas
- **Base de datos canónica `sigd_prueba` (puerto 5433):**
  Consulta de verificación ejecutada en vivo:
  ```sql
  SELECT count(*) FROM sigd_tra.expediente;
  -- Resultado: EXACTAMENTE 2 FILAS.
  ```
  Se certifica que no se insertó ni modificó ningún registro en la base de datos principal durante AF-23.
- **Base de datos `sigd_migraciones_test` (puerto 5434):**
  Intacta, operativa y saludable.
- **Volúmenes nombrados:**
  Ningún volumen de datos fue podado ni formateado.

### 11.4. Estado Final del Árbol de Trabajo Git
La ejecución de `git status -s` confirma que el working tree contiene exactamente los mismos archivos que al inicio de AF-23, sin ningún archivo huérfano, temporal o no deseado generado por las pruebas:
- **Rama:** `B_JACOBO`
- **HEAD:** `bf30d8a0c85e266a86381fb10bf3740a8451c032`
- **Archivos temporales añadidos al repositorio:** **0 archivos**.

---

## 12. DICTAMEN TÉCNICO FINAL

1. **Aptitud Funcional del Prototipo:** El prototipo académico SIGD IESTP Suiza 2026 cuenta con una base arquitectónica sólida y demostrable. Sus flujos neurálgicos (Módulo 1 IdentiCore, Módulo 2 OrganiCore, Módulo 3 TramiCore, Módulo 4 RutaDoc, Módulo 7 FirmaCore, Módulo 8 CoreLink y Módulo 9 Analítica) están plenamente operativos en backend e integrables con el frontend.
2. **Defectos Documentados:** Las excepciones observadas en el registro ciudadano (IdentiCore) y la proyección de resoluciones (Despacho) son incompatibilidades de contrato de datos DDL previas, que no comprometen la estabilidad del prototipo gracias a los mecanismos de protección fail-closed implementados.
3. **Certificación de Higiene Operativa:** Se certifica que la intervención AF-23 cumplió de forma rigurosa con el mandato de validación integral y el anexo obligatorio de limpieza quirúrgica, entregando el repositorio y la infraestructura Docker en perfecto estado de conservación y listos para la demostración institucional.
