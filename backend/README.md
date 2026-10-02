# SISTEMA INTEGRAL DE GESTIÓN DOCUMENTARIA (SIGD) — BACKEND
## Instituto de Educación Superior Tecnológico Público "Suiza" (Pucallpa, Ucayali, Perú)
**Programa de Estudios:** Desarrollo de Sistemas de Información (PE DSI) — Semestre Académico 2026-2  
**Unidad Didáctica:** Taller de Programación Web / Proyecto Integrador Transversal  
**Nivel de Arquitectura:** Senior Software Architect / Backend Specialist Guide  

---

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-20_LTS-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js 20 LTS" />
  <img src="https://img.shields.io/badge/TypeScript-5.8.3-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript 5.8.3" />
  <img src="https://img.shields.io/badge/Express-5.1.0-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express 5.1.0" />
  <img src="https://img.shields.io/badge/PostgreSQL-18.3%20%2F%2018.6-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL 18" />
  <img src="https://img.shields.io/badge/Vitest-3.1.3-6E9F18?style=for-the-badge&logo=vitest&logoColor=white" alt="Vitest 3.1.3" />
  <img src="https://img.shields.io/badge/Testcontainers-10.21.1-2C5BB4?style=for-the-badge&logo=docker&logoColor=white" alt="Testcontainers 10.21.1" />
  <img src="https://img.shields.io/badge/Zod-3.24.2-3E67B1?style=for-the-badge&logo=zod&logoColor=white" alt="Zod 3.24.2" />
  <img src="https://img.shields.io/badge/Grafana_k6-Performance-7D64FF?style=for-the-badge&logo=k6&logoColor=white" alt="Grafana k6" />
</p>

---

## 🏛️ Arquitectura del Backend Integrado

El backend del SIGD implementa una arquitectura desacoplada, orientada a dominios y con observabilidad transversal:

1. **Serialización Global de Errores (RFC 7807 / RFC 9457):** Todas las respuestas de error siguen el estándar `application/problem+json`, mapeando deterministamente excepciones de negocio y violaciones de integridad de PostgreSQL (`23505` a 409 Conflict, `23503` a 400 Bad Request, `P0001` a 422 Unprocessable Entity).
2. **Trazabilidad Contextual con `AsyncLocalStorage`:** Propagación transparente del contexto de solicitud (`correlation_id`, usuario actor, IP de origen) a través de todas las capas sin contaminar las firmas de los casos de uso.
3. **Patrón Transactional Outbox:** Encolado transaccional de eventos de dominio en `sigd_audit.evento_outbox` y procesamiento asíncrono con worker en background utilizando `FOR UPDATE SKIP LOCKED`.
4. **Validación de Esquemas con Zod:** Validación estricta en tiempo de ejecución de payloads de entrada mapeados a `invalid_params`.

### Dominio DocuCore (Firma Digital y Generación A4 - B_VALENTIN)

A partir de la rama `B_VALENTIN`, se introduce el dominio `src/domains/docucore` que encapsula la generación institucional de PDF A4, la pasarela de firma digital Refirma y la gestión de sesiones efímeras:

- **A4GeneratorService**: Generador de PDF en hoja A4 exacta (210×297 mm), márgenes 25 mm, membrete institucional, control de viudas/huérfanas, tablas atómicas y bloque de firma atómico.
- **RefirmaGatewayService**: Pasarela del protocolo `refirma://sign?arguments=[BASE64URL]` con validación estricta de payload (cuatro claves obligatorias, HTTPS, lista blanca de hosts, SHA-256 en minúsculas, Base64URL sin padding).
- **FirmaSessionStore**: Tokens de 256 bits, TTL 300 s, clave derivada por SHA-256, consumo atómico (`GETDEL` en Redis / `delete` en memoria).
- **ServicioFirmaService**: Orquestación completa: generación de PDF, emisión de token, construcción de URI, callback con autodestrucción de sesión, URL temporal de descarga.

---

## 📑 ÍNDICE GENERAL

1. [Identidad Institucional y Rol del Backend](#1-identidad-institucional-y-rol-del-backend)
2. [Stack Tecnológico Declarado](#2-stack-tecnológico-declarado)
3. [Patrones Arquitectónicos y Núcleo Transversal](#3-patrones-arquitectónicos-y-núcleo-transversal)
   - 3.1 [Serialización Estándar de Errores RFC 7807 / RFC 9457 (`ApiProblemDetails`)](#31-serialización-estándar-de-errores-rfc-7807--rfc-9457-apiproblemdetails)
   - 3.2 [Trazabilidad Contextual con `AsyncLocalStorage` (`X-Correlation-ID`)](#32-trazabilidad-contextual-con-asynclocalstorage-x-correlation-id)
   - 3.3 [Patrón Transactional Outbox y Bitácora Forense Inmutable WORM](#33-patrón-transactional-outbox-y-bitácora-forense-inmutable-worm)
4. [Arquitectura de Base de Datos y los 6 Dominios Funcionales](#4-arquitectura-de-base-de-datos-y-los-6-dominios-funcionales)
   - 4.1 [Secuencia Canónica de Despliegue DDL (Grafo Topológico DAG de 5 Olas)](#41-secuencia-canónica-de-despliegue-ddl-grafo-topológico-dag-de-5-olas)
   - 4.2 [Desglose en Profundidad de los 6 Dominios Funcionales](#42-desglose-en-profundidad-de-los-6-dominios-funcionales)
5. [Estrategia de Pruebas, Verificación y Benchmarks de Rendimiento](#5-estrategia-de-pruebas-verificación-y-benchmarks-de-rendimiento)
   - 5.1 [Suites de Integración E2E sobre Testcontainers (PostgreSQL 18)](#51-suites-de-integración-e2e-sobre-testcontainers-postgresql-18)
   - 5.2 [Suites Unitarias con Vitest](#52-suites-unitarias-con-vitest)
   - 5.3 [Pruebas de Estrés y Carga con Grafana k6](#53-pruebas-de-estrés-y-carga-con-grafana-k6)
   - 5.4 [Matriz de Comandos Operativos](#54-matriz-de-comandos-operativos)
6. [Catálogo Exhaustivo de Contratos y Endpoints de la API](#6-catálogo-exhaustivo-de-contratos-y-endpoints-de-la-api)
7. [Estructura del Directorio, Gobernanza y Enlaces Maestros](#7-estructura-del-directorio-gobernanza-y-enlaces-maestros)

---

## 1. IDENTIDAD INSTITUCIONAL Y ROL DEL BACKEND

El backend del **Sistema Integral de Gestión Documentaria (SIGD)** está destinado a ser el núcleo transaccional, normativo y de seguridad del **IESTP "Suiza"** (Pucallpa, Ucayali, Perú). La arquitectura propone módulos desacoplados y prácticas de Clean Architecture y Domain-Driven Design (DDD); el estado de implementación y validación debe leerse en la evidencia de la rama y de cada entorno.

### Estado de Validación y Certificación de Cierre — Octubre 2026 (100.0% Conforme)

- `npm run typecheck` (`tsc --noEmit`): **0 errores de compilación estricta NodeNext**.
- **Suites Unitarias y de Integración con Vitest**: 30 suites pasadas, **534 pruebas unitarias aprobadas al 100%**.
- **Suites de Verificación Adversarial y Criptográfica**: 2 harnesses independientes (`adversarial_harness.ts` y `argon2_challenger_m1_it2.ts`), **92 pruebas adversariales aprobadas al 100%**.
- **Total de Pruebas Automatizadas Backend:** **626 tests (100% Pass, 0 regresiones)**.
- **Catálogo de Endpoints RESTful:** 56 endpoints montados formalmente en `src/app.ts` (`/api/v1/auth`, `/api/v1/casilla`, `/api/v1/usuarios`, `/api/v1/areas`, `/api/v1/expedientes`, `/api/v1/storage`, `/api/v1/docucore`, etc.).
- **Gobernanza Relacional PostgreSQL 18:** 51 tablas sincronizadas a través de los 6 esquemas canónicos (`sigd_audit`, `sigd_auth`, `sigd_org`, `sigd_doc`, `sigd_tra`, `sigd_rut`).

* **API Gateway & Orquestación de Negocio:** Centraliza la recepción de solicitudes, validación tipada estricta, aplicación de reglas administrativas y despacho de trámites institucionales (matrículas, títulos, traslados, certificaciones y convalidaciones).
* **Despacho de Eventos (*Transactional Outbox Pattern*):** El worker procesa eventos persistidos en `sigd_audit.evento_outbox`; la atomicidad entre el cambio de negocio y el evento depende de que el productor los escriba en la misma transacción. La entrega externa es asíncrona y sus garantías requieren pruebas de integración.
* **Bitácora Criptográfica Inmutable WORM (*Write Once, Read Many*):** Implementa un registro forense inalterable con factor de relleno `fillfactor = 100`, restricción de privilegios en base de datos (`REVOKE UPDATE, DELETE`) y preservación de huellas digitales SHA-256, blindando la trazabilidad institucional ante cualquier intento de alteración retrospectiva.
* **Alineamiento Pleno al Marco Normativo Peruano:**
  - **TUO de la Ley N° 27444 (LPAG):** Cómputo de plazos máximos en días hábiles (30 días), acumulación de expedientes (Art. 160), regla de corte legal a las 16:30 hrs y Libro General de Registros (Arts. 153-156).
  - **Modelo de Gestión Documental (MGD-PCM / SEGDI):** Generador de Código Único de Trámite (**CUT**) anual correlativo `EXP-YYYY-XXXXXX`.
  - **Ley N° 27269 y D.S. 070-2013-PCM:** Integración con firma digital certificada (Refirma RENIEC), sellado de tiempo y Código de Verificación Digital (CVD).
  - **Ley N° 29733 (LPDP):** Consentimiento auditable para casilla electrónica y anonimización de datos sensibles en consultas públicas.
  - **Directiva N° 001-2019-AGN / R.J. N° 073-2023-AGN/J:** Foliación digital progresiva, correlativa e ininterrumpida sin solapamientos ni omisiones.

---

## 2. STACK TECNOLÓGICO DECLARADO

Las versiones declaradas se contrastan con `backend/package.json`; la presencia de una dependencia o configuración no acredita por sí misma su operación en producción:

| Capa Arquitectónica | Tecnología / Paquete | Versión Declarada | Detalle de Configuración y Propósito en Producción |
| :--- | :--- | :--- | :--- |
| **Runtime Engine** | Node.js | `>=20` (LTS) | Motor de ejecución JavaScript con soporte nativo de ES Modules (`"type": "module"`), `node:async_hooks` (`AsyncLocalStorage`) y `node:crypto`. |
| **Lenguaje Tipado** | TypeScript | `^5.8.3` | Compilación con resolución `NodeNext`, target `ES2022`, `strict: true`, `declaration: true`, `sourceMap: true` y exclusión de tests en build de producción (`tsconfig.build.json`). |
| **Framework Web** | Express | `^5.1.0` | Pipeline asíncrono nativo, enrutamiento tipado, desacoplamiento de cabeceras reveladoras (`app.disable('x-powered-by')`) y parseo seguro de JSON (`express.json()`). |
| **Base de Datos** | PostgreSQL | `18.3` / `18.6` | Motor RDBMS relacional empresarial con extensiones nativas `pgcrypto` (`gen_random_uuid()`), `ltree` (caminos jerárquicos) y `btree_gist` (restricciones de exclusión temporal `TSTZRANGE`). |
| **Driver de Conexión** | `pg` (node-postgres) | `^8.14.1` | Cliente de conexión con Pool optimizado (`max: 20` conexiones en `src/database.ts`), soporte de transacciones ACID y aislamiento pesimista. |
| **Esquemas de Validación** | Zod | `^3.24.2` | Inferencia estática de tipos y validación runtime estricta de payloads entrantes, transformando infracciones en estructuras `invalid_params` estándar. |
| **Test Runner Unitario** | Vitest | `^3.1.3` | Ejecutor ultrarrápido con soporte nativo ESM y aislamiento por procesos (`pool: 'forks'`) para suites unitarias y de integración. |
| **Contenedores de Prueba**| Testcontainers | `^10.21.1` | Aprovisionamiento dinámico programático de contenedores Docker efímeros para pruebas de integración continua y base de datos limpia. |
| **Driver BD Contenedor** | `@testcontainers/postgresql` | `^10.21.1` | Contenedor oficial `postgres:18-alpine` con extensiones cargadas y ciclo de vida automatizado (`global-setup.ts` / `global-teardown.ts`). |
| **Cliente de Prueba HTTP**| Supertest | `^7.1.1` | Emulación de peticiones HTTP de alta fidelidad contra la aplicación Express sin levantar puertos de red físicos. |
| **Ejecutor TypeScript** | `tsx` | `^4.19.4` | Ejecución en caliente con recarga automática (`tsx watch src/server.ts`) y ejecución aislada de workers (`tsx src/audit/worker/outbox-worker.ts`). |
| **Pruebas de Carga** | Grafana k6 | Scripts en `k6/` | Evaluación de concurrencia a 100 VU (radicación) y 50 VU (derivación) con umbrales P95 < 200 ms y tasa de error < 0.1%. |
| **Variables de Entorno**| dotenv | `^16.5.0` | Carga declarativa de configuración desde archivos `.env`. |

---

## 3. PATRONES ARQUITECTÓNICOS Y NÚCLEO TRANSVERSAL

```mermaid
flowchart TD
    REQ(["Cliente HTTP / Frontend"]) --> CTX["contextMiddleware\n(Genera o adopta X-Correlation-ID: UUIDv4\nInyecta en AsyncLocalStorage)"]
    CTX --> ROUTER["Express Router & Controllers\n(Validación con Zod 3.24)"]
    
    subgraph TX["Transacción ACID en PostgreSQL 18"]
        ROUTER --> DB_MUT["1. Mutación de Negocio\n(sigd_tra.expediente / sigd_rut)"]
        DB_MUT --> DB_WORM["2. Bitácora Forense WORM\n(sigd_audit.bitacora_auditoria fillfactor=100)"]
        DB_WORM --> DB_OUT["3. Encolado Outbox\n(sigd_audit.evento_outbox 'PENDIENTE')"]
    end
    
    TX -->|Éxito HTTP 200/201| RES(["Respuesta Exitosa + X-Correlation-ID"])
    TX -->|Error / Fallo SQL / Validación| ERR_MID["errorMiddleware (RFC 7807 / RFC 9457)\n(Mapeo determinista SQLSTATE, Zod y AppError)"]
    ERR_MID --> ERR_RES(["Respuesta application/problem+json"])

    subgraph BG["Procesamiento Asíncrono en Background"]
        WORKER["OutboxWorker\n(tsx src/audit/worker/outbox-worker.ts)"]
        DB_OUT -.->|SELECT ... FOR UPDATE SKIP LOCKED| WORKER
        WORKER -->|Despacho Exitoso| MARK_OK["UPDATE evento_outbox\nSET estado='PROCESADO'"]
        WORKER -->|Fallo Transitorio| BACKOFF["Backoff Exponencial\n(1s, 2s, 4s, 8s, 16s)"]
        BACKOFF -->|Máx 5 Intentos Superados| MARK_FAIL["UPDATE evento_outbox\nSET estado='FALLIDO' (DLQ)"]
    end
```

### 3.1. Serialización Estándar de Errores RFC 7807 / RFC 9457 (`ApiProblemDetails`)

El middleware central serializa errores bajo el formato Problem Details documentado como **IETF RFC 7807 / RFC 9457** (`application/problem+json`). La ausencia de fugas debe comprobarse con pruebas de seguridad por clase de error y no se infiere solo de que exista el middleware.

#### Arquitectura de Componentes de Error:
* **`src/middleware/error-middleware.ts`:** Middleware terminal de Express. Extrae el `correlation_id` del contexto activo, registra en `console.error` únicamente los errores de nivel 5xx con metadatos contextuales (sin exponerlos al cliente), fija la cabecera HTTP `x-correlation-id` y emite el payload tipado.
* **`src/errors/error-mapper.ts`:** Orquestador central (`serializeError`). Discrimina polimórficamente si el error proviene de una instancia de `AppError`, un error de validación de Zod (`ZodError`), una excepción nativa de PostgreSQL (`PostgresqlError`) o una excepción no controlada.
* **`src/errors/postgres-error-mapper.ts`:** Evalúa códigos nativos `SQLSTATE` de la base de datos y los transforma en respuestas canónicas sanitizadas.
* **`src/errors/zod-error-mapper.ts`:** Mapea los `issues` de validación de Zod extrayendo el nombre del campo infractor y la regla incumplida en una colección estructurada de `invalid_params`.

#### Jerarquía Tipada de Clases de Error de Dominio (`src/shared/domain/errors/`):
* **`AppError`:** Clase abstracta base. Atributos: `status` (number), `code` (string), `detail` (string), `invalidParams` (`InvalidParam[]`). Captura automáticamente la traza de pila con `Error.captureStackTrace`.
* **`ValidationError`:** Código HTTP `400 Bad Request`, `code: 'VALIDATION_ERROR'`.
* **`UnauthorizedError`:** Código HTTP `401 Unauthorized`, `code: 'UNAUTHORIZED'`. Mensaje por defecto: *"No autenticado."*
* **`ForbiddenError`:** Código HTTP `403 Forbidden`, `code: 'FORBIDDEN'`. Mensaje por defecto: *"Permisos insuficientes."*
* **`NotFoundError`:** Código HTTP `404 Not Found`, `code: 'NOT_FOUND'`. Mensaje por defecto: *"Recurso no encontrado."*
* **`ConflictError`:** Código HTTP `409 Conflict`, `code: 'CONFLICT'`. Mensaje por defecto: *"Conflicto de estado o de unicidad."*
* **`DomainError`:** Código HTTP `422 Unprocessable Entity`, código de negocio dinámico. Modela infracciones a las reglas de procedimiento administrativo.

#### Matriz Estricta de Mapeo PostgreSQL (SQLSTATE):
| Código SQLSTATE | Categoría PostgreSQL | Código de Error API | Código HTTP | Mensaje Sanitizado Emitido al Cliente |
| :---: | :--- | :--- | :---: | :--- |
| **`23505`** | `unique_violation` | `DUPLICATE_KEY` | **409 Conflict** | `"El registro ya se encuentra registrado."` |
| **`23503`** | `foreign_key_violation` | `FOREIGN_KEY_VIOLATION` | **400 Bad Request** | `"El recurso referenciado no es válido."` |
| **`23502`** | `not_null_violation` | `NOT_NULL_VIOLATION` | **400 Bad Request** | `"Un campo obligatorio no fue proporcionado."` |
| **`P0001`** | `raise_exception` | `DOMAIN_RULE` | **422 Unprocessable** | `"Regla de negocio incumplida."` |
| *Cualquier otro* | Falla interna no controlada | `INTERNAL_ERROR` | **500 Server Error** | `"Ocurrió un error interno en el servidor."` (Se enmascara; traza enviada a stderr con `correlation_id`). |

#### Ejemplo Real de Payload RFC 7807 Emitido por la API:
```json
{
  "type": "https://sigd.iestpsuiza.edu.pe/errors/validation_error",
  "title": "Validation Error",
  "status": 400,
  "detail": "Los datos enviados no son válidos.",
  "instance": "/api/expedientes",
  "code": "VALIDATION_ERROR",
  "correlation_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "invalid_params": [
    {
      "name": "dni_solicitante",
      "reason": "Formato de DNI inválido."
    },
    {
      "name": "folios",
      "reason": "Los folios no pueden ser negativos."
    }
  ]
}
```

---

### 3.2. Trazabilidad Contextual con `AsyncLocalStorage` (`X-Correlation-ID`)

La trazabilidad de extremo a extremo se implementa mediante `node:async_hooks` a través de `src/shared/request-context/request-context.ts` y el middleware `src/middleware/context-middleware.ts`.

#### Mecanismo Operativo:
1. **Adopción o Generación del UUIDv4:** Al ingresar un request, `contextMiddleware` inspecciona la cabecera `x-correlation-id`. Si está presente y no vacía, la preserva; si no, genera un UUIDv4 criptográfico mediante `node:crypto.randomUUID()`.
2. **Construcción del Contexto Inmutable (`RequestContext`):**
   ```typescript
   export interface RequestContext {
     correlation_id: string;      // UUIDv4 único de la transacción
     usuario_id: string | null;   // UUID de la cuenta autenticada (o null para anónimos)
     ip_origen: string;           // IP cliente extraída de req.ip
     user_agent: string;          // Agente de usuario extraído de req.get('user-agent')
   }
   ```
3. **Inyección en el Ciclo de Vida Asíncrono:** Se ejecuta `runWithContext(contexto, () => next())`, ligando el contexto a la cadena de ejecución asíncrona de Node.js.
4. **Respuesta Espejada:** El middleware estampa la cabecera en la respuesta HTTP: `res.setHeader('x-correlation-id', contexto.correlation_id)`.
5. **Consumo No Invasivo:** Los módulos de persistencia (`bitacora-auditoria.repository.ts`, `evento-outbox.repository.ts`) recuperan el contexto mediante `getRequestContext()` o `requireRequestContext()` sin obligar a los controladores o capas de servicio a transportar parámetros de telemetría en sus firmas.

#### Demostración Empírica de Aislamiento Concurrente:
La suite `tests/e2e/e2e-11-concurrencia-async-local-storage.test.ts` certifica matemáticamente que:
* **100 tareas asíncronas concurrentes** con retrasos pseudoaleatorios ejecutadas simultáneamente en el event loop no presentan contaminación cruzada ni colisiones de `correlation_id`.
* Se valida la preservación de contexto en llamadas anidadas de hasta 3 niveles de profundidad (`parent -> child -> grandchild`), retornando limpiamente al contexto original.

---

### 3.3. Patrón Transactional Outbox y Bitácora Forense Inmutable WORM

Para evitar el problema de escrituras parciales (ej. guardar un expediente en la base de datos pero fallar al emitir una notificación o evento), el SIGD implementa el patrón **Transactional Outbox** complementado con una **Bitácora WORM**.

#### 1. Atomicidad Transaccional de Tres Vías:
En cualquier mutación sustantiva (ej. `src/referencia/expediente.router.ts`), la operación se encierra en una transacción ACID estricta de PostgreSQL:
```typescript
await cliente.query('BEGIN');
try {
  // 1. Mutación de negocio en el esquema correspondiente
  const exp = await cliente.query('INSERT INTO sigd_tra.expediente ... RETURNING expediente_id, numero');
  
  // 2. Registro síncrono en la bitácora WORM inmutable
  await registrarMutacion(cliente, {
    esquema: 'sigd_tra',
    tabla: 'expediente',
    operacion: 'INSERT',
    datos_despues: { numero: datos.numero, tipo_documental_id: datos.tipo_documental_id }
  });

  // 3. Encolado del evento de integración en el outbox
  await insertarEvento(cliente, {
    agregado: 'expediente',
    tipo_evento: 'TramiteRegistrado',
    payload: { expediente_id: exp.rows[0].expediente_id, correlation_id: getRequestContext()?.correlation_id }
  });

  await cliente.query('COMMIT');
} catch (error) {
  await cliente.query('ROLLBACK');
  throw error;
}
```

#### 2. Bitácora Forense WORM (`sigd_audit.bitacora_auditoria`):
Definida en `backend/docs/00_corelink/06_sigd_audit_esquema_ddl.sql`:
* **Factor de Relleno Máximo:** `WITH (fillfactor = 100)`, optimizado para tablas de solo inserción (append-only), compactando el almacenamiento y acelerando escaneos secuenciales.
* **Seguridad y Revocación de Privilegios:**
  ```sql
  REVOKE UPDATE, DELETE ON sigd_audit.bitacora_auditoria FROM sigd_app;
  REVOKE UPDATE, DELETE ON sigd_audit.bitacora_auditoria FROM sigd_worker;
  ```
  La cuenta de aplicación `sigd_app` únicamente ostenta privilegios `INSERT` y `SELECT`. Ningún usuario del sistema ni servicio puede modificar o borrar registros históricos.
* **Estructura Forense:** Almacena `id_auditoria` (UUID), `correlation_id` (obligatorio, sin default para forzar la inyección desde `AsyncLocalStorage`), `usuario_id`, `ip_origen` (`INET`), `user_agent`, `esquema`, `tabla`, `operacion` (`INSERT`, `UPDATE`, `DELETE`), `datos_antes` (`JSONB`), `datos_despues` (`JSONB`) y `fecha_hora` (`TIMESTAMPTZ`).

#### 3. Motor Despachador Asíncrono (`src/audit/outbox-worker.ts`):
* **Lectura No Bloqueante con `SKIP LOCKED`:**
  ```sql
  SELECT id_evento, correlation_id, agregado, tipo_evento, payload, intentos
    FROM sigd_audit.evento_outbox
   WHERE estado = 'PENDIENTE'
   ORDER BY creado_en
   LIMIT $1
     FOR UPDATE SKIP LOCKED;
  ```
  Permite escalar horizontalmente múltiples instancias de workers sin que colisionen entre sí ni procesen dos veces el mismo evento.
* **Estrategia de Reintentos y Resiliencia:**
  - Tamaño de lote por defecto: `100` eventos (`OUTBOX_LOTE`).
  - Límite de intentos: `5` (`OUTBOX_MAX_INTENTOS`).
  - Backoff exponencial: `backoffBaseMs * (2 ** intentos)` (con base de 1,000 ms: 1s, 2s, 4s, 8s, 16s).
  - Al agotar los 5 reintentos, el evento se marca de forma definitiva como `FALLIDO` (Dead Letter Queue) para inspección manual sin detener el flujo general.

---

## 4. ARQUITECTURA DE BASE DE DATOS Y LOS 6 DOMINIOS FUNCIONALES

### 4.1. Secuencia Canónica de Despliegue DDL (Grafo Topológico DAG de 5 Olas)

Para resolver las dependencias circulares y bloqueos relacionales entre sub-equipos, el despliegue físico de la base de datos PostgreSQL 18 está estructurado en un **Grafo Acíclico Dirigido (DAG) de 5 Olas**. Cada ola provee las claves primarias requeridas por las capas sucesivas:

```mermaid
graph TD
    EXT["Extensiones Base de PostgreSQL 18\n(pgcrypto, ltree, btree_gist)"] --> W1
    
    subgraph W1["OLA 1 · Fundación Transversal (CoreLink)"]
        D_W1["00_corelink/06_sigd_audit_esquema_ddl.sql\n(Esquema: sigd_audit)\nTablas: bitacora_auditoria, evento_outbox"]
    end
    
    subgraph W2["OLA 2 · Catálogos Maestros, Identidades y Documentos"]
        D_W2A["04_identicore / 01_identicore\n03_esquema_sigd_auth_v2.sql\n(Esquema: sigd_auth)\nTablas: persona, persona_natural, persona_juridica, cuenta_usuario"]
        D_W2B["02_organicore\n03_esquema_sigd_org_v2.sql\n(Esquema: sigd_org)\nTablas: area (ltree), cargo, rol_sistema, permiso_sistema"]
        D_W2C["05_docucore / 03_docucore\n05_esquema_sigd_doc_jsonb_v6.3_auditoria_corregido.sql\n(Esquema: sigd_doc)\nTablas: tipo_tramite_tupa, formulario_version, documento_adjunto (S3)"]
    end
    
    subgraph W3["OLA 3 · Núcleo Transaccional (TramiCore)"]
        D_W3["01_rutadoc / 04_tramicore\n03_esquema_sigd_tra_cut_foliado.sql\n(Esquema: sigd_tra)\nTablas: tramite, secuencia_anual_cut, expediente (CUT), folio, asiento"]
    end
    
    subgraph W4["OLA 4 · Workflow y Trazabilidad (RutaDoc)"]
        D_W4["01_rutadoc / 05_rutadoc\n03_esquema_sigd_rut_particionado.sql\n(Esquema: sigd_rut)\nTablas: estado_tramite (10 estados), movimiento_tramite, derivacion"]
    end
    
    subgraph W5["OLA 5 · Optimización, Particionamiento y Analítica"]
        D_W5["02_rutadoc_adicionales / 05_rutadoc\n07_sigd_rut_adicionales_ddl.sql\nParticiones anuales: movimiento_tramite_2026, 2027\nÍndices GIN, BRIN y Vistas Materializadas KPI (MGD-PCM)"]
    end

    W1 --> D_W2A
    W1 --> D_W2B
    W1 --> D_W2C
    
    D_W2A -->|FK persona_id, cuenta_id| D_W3
    D_W2B -->|FK area_id| D_W3
    D_W2C -->|FK tipo_documento_id| D_W3
    
    D_W3 -->|FK expediente_id| D_W4
    D_W2B -->|FK area_origen/destino| D_W4
    D_W2A -->|FK usuario_id| D_W4
    
    D_W4 --> D_W5
```

#### Tabla de Equivalencias de Despliegue de las 5 Olas:
| Ola Arquitectónica | Especificación Canónica / Plan de Implementación | Ruta Física del Script DDL en el Repositorio (`backend/docs/`) | Esquema PostgreSQL |
| :---: | :--- | :--- | :---: |
| **Ola 1** | `00_corelink/06_sigd_audit_esquema_ddl.sql` | [`docs/00_corelink/06_sigd_audit_esquema_ddl.sql`](docs/00_corelink/06_sigd_audit_esquema_ddl.sql) | `sigd_audit` |
| **Ola 2A** | `04_identicore/01_sigd_auth_esquema_ddl.sql` | [`docs/01_identicore/03_esquema_sigd_auth_v2.sql`](docs/01_identicore/03_esquema_sigd_auth_v2.sql) | `sigd_auth` |
| **Ola 2B** | `02_organicore/02_sigd_org_esquema_ddl.sql` | [`docs/02_organicore/03_esquema_sigd_org_v2.sql`](docs/02_organicore/03_esquema_sigd_org_v2.sql) | `sigd_org` |
| **Ola 2C** | `05_docucore/05_sigd_doc_esquema_ddl.sql` | [`docs/03_docucore/05_esquema_sigd_doc_jsonb_v6.3_auditoria_corregido.sql`](docs/03_docucore/05_esquema_sigd_doc_jsonb_v6.3_auditoria_corregido.sql) | `sigd_doc` |
| **Ola 3** | `01_rutadoc/03_sigd_tra_esquema_ddl.sql` | [`docs/04_tramicore/03_esquema_sigd_tra_cut_foliado.sql`](docs/04_tramicore/03_esquema_sigd_tra_cut_foliado.sql) | `sigd_tra` |
| **Ola 4** | `01_rutadoc/04_sigd_rut_esquema_ddl.sql` | [`docs/05_rutadoc/03_esquema_sigd_rut_particionado.sql`](docs/05_rutadoc/03_esquema_sigd_rut_particionado.sql) | `sigd_rut` |
| **Ola 5** | `02_rutadoc_adicionales/07_sigd_rut_adicionales_ddl.sql` | Partición declarativa anual y optimizaciones en `sigd_rut` y capas analíticas | `sigd_rut` / Analítica |

---

### 4.2. Desglose en Profundidad de los 6 Dominios Funcionales

#### Dominio 1: IdentiCore (`sigd_auth`) — Identidad, Seguridad y Casilla Electrónica
* **Archivo DDL Canónico:** `backend/docs/01_identicore/03_esquema_sigd_auth_v2.sql`
* **Tablas Principales (11 tablas):** `tipos_documento`, `persona`, `persona_natural`, `persona_juridica`, `representacion_legal`, `persona_documento_historial`, `cuenta_usuario`, `sesion_usuario`, `consentimiento_datos`, `perfil_usuario`, `auditoria_usuarios`.
* **Reglas Críticas de Negocio:**
  - **Modelo Polimórfico de Personas:** Tabla base `persona` conectada 1:1 con `persona_natural` (DNI regex `^[0-9]{8}$`) y `persona_juridica` (RUC de 11 dígitos validado por algoritmo Módulo 11 con pesos `[5,4,3,2,7,6,5,4,3,2]` y regex `^(10|15|17|20)[0-9]{9}$`).
  - **Hashing Criptográfico de Contraseñas:** Algoritmo **Argon2id** (`$argon2id$v=19$m=65536,t=3,p=4`) en `cuenta_usuario.password_hash`.
  - **Casilla Electrónica & Ley N° 29733:** `sigd_auth.consentimiento_datos` registra de forma auditable la aceptación previa e informada del administrado con marca temporal, IP de origen y versión de términos.

#### Dominio 2: OrganiCore (`sigd_org`) — Jerarquía Institucional y Permisos ABAC
* **Archivo DDL Canónico:** `backend/docs/02_organicore/03_esquema_sigd_org_v2.sql`
* **Extensiones Clave:** `ltree`, `btree_gist`, `pgcrypto`.
* **Tablas Principales (9 tablas):** `area`, `cargo`, `rol_sistema`, `permiso_sistema`, `rol_permiso`, `usuario_rol`, `asignacion_personal`, `facultad_despacho`, `encargatura_despacho`.
* **Reglas Críticas de Negocio:**
  - **Jerarquía con Materialized Path (`ltree`):** Columna `area.path ltree NOT NULL` indexada con GiST (`idx_area_path_gist`).
  - **Triggers Anti-Ciclo:**
    * `trg_area_set_path` (`BEFORE INSERT OR UPDATE`): bloquea el área padre `FOR UPDATE` e impide que un área sea su propio padre o que dependa de su propio descendiente (`v_parent_path @> OLD.path`), arrojando **`SQLSTATE 23514`**.
    * `trg_area_rebuild_descendants` (`AFTER UPDATE`): recalcula en cascada el prefijo de todos los sub-árboles de áreas dependientes.
  - **Restricciones de Exclusión GiST:** `EXCLUDE USING gist (id_area WITH =, cargo_id WITH =, vigencia WITH &&)` en `asignacion_personal` y `encargatura_despacho`, imposibilitando dos titulares o delegaciones simultáneas en el mismo cargo y área en rangos de tiempo solapados.
  - **Función ABAC Temporal:** `sigd_org.usuario_tiene_facultad_despacho(p_cuenta_id, p_area_id, p_cargo_id, p_momento)` evalúa en el instante exacto `p_momento` si el usuario cuenta con facultad de despacho válida (como titular o suplente formal).

#### Dominio 3: DocuCore (`sigd_doc`) — Documentos, JSON Schema y Almacenamiento S3
* **Archivo DDL Canónico:** `backend/docs/03_docucore/05_esquema_sigd_doc_jsonb_v6.3_auditoria_corregido.sql`
* **Tablas Principales (9 tablas):** `tipo_tramite_tupa`, `tipo_documento`, `formulario_version`, `expediente`, `expediente_formulario_respuesta`, `requisito`, `tipo_documento_requisito`, `expediente_requisito`, `documento_adjunto`.
* **Reglas Críticas de Negocio:**
  - **Formularios Dinámicos con JSON Schema:** Versiones inmutables gobernadas por JSON Schema Draft 2020-12 en `formulario_version.schema_definicion JSONB` con índice GIN.
  - **Almacenamiento Desacoplado MinIO / S3:** Carga de binarios mediante *Presigned URLs*. Metadatos en `documento_adjunto`: `s3_bucket`, `s3_key`, `tamanio_bytes`, `sha256_hash CHAR(64)` y `magic_bytes_validado BOOLEAN` (validación de cabecera `%PDF-1.4`).
  - **Deduplicación Ágil:** Restricción de unicidad de hash SHA-256 por requisito (`uq_documento_sha256_por_requisito`).

#### Dominio 4: TramiCore (`sigd_tra`) — Radicación, CUT Atómico y Foliado AGN
* **Archivo DDL Canónico:** `backend/docs/04_tramicore/03_esquema_sigd_tra_cut_foliado.sql`
* **Tablas Principales (6 tablas):** `tramite`, `secuencia_anual_cut`, `expediente`, `expediente_acumulacion`, `expediente_documento_folio`, `asiento_registro`.
* **Reglas Críticas de Negocio:**
  - **Generador de CUT Atómico (`generar_cut_expediente`):** Gestiona correlativos contiguos por año fiscal sin secuencias globales. Ejecuta `INSERT INTO secuencia_anual_cut ... ON CONFLICT (anio_fiscal) DO NOTHING` seguido de `SELECT secuencia + 1 FROM secuencia_anual_cut WHERE anio_fiscal = p_anio FOR UPDATE`. Formatea `EXP-YYYY-XXXXXX` con constraint `CHECK (codigo_expediente ~ '^EXP-[0-9]{4}-[0-9]{6}$')`.
  - **Acumulación de Expedientes (Art. 160 LPAG):** Funciones `acumular_expediente` y `desacumular_expediente` con ordenamiento ascendente de IDs para evitar deadlocks y trigger `trg_acumulacion_validar_escritura` que prohíbe inserciones directas sin acto resolutivo.
  - **Foliación Progresiva AGN (R.J. N° 073-2023-AGN/J):**
    * Función canónica `agregar_folio_expediente`: bloquea el expediente con `SELECT ... FOR UPDATE` y calcula `folio_inicio = COALESCE(MAX(folio_fin), 0) + 1`.
    * Trigger `trg_folio_verificar_solapamiento`: bloquea el expediente `FOR UPDATE` e impide solapamientos o huecos con **`SQLSTATE 23514`**.
    * Triggers de inmutabilidad `trg_folio_no_update` y `trg_folio_no_delete`: rechazan cualquier alteración o borrado con **`SQLSTATE 23001`**.
  - **Libro General de Registros (`asiento_registro`):** Asientos inmutables con secuencia `seq_asiento_numero_registro`, canales `MESA_PRESENCIAL` y `MESA_VIRTUAL`, y triggers que rechazan borrado o edición de número con **`SQLSTATE 23001`**.

#### Dominio 5: RutaDoc / Confidat (`sigd_rut`) — Workflow, Plazos y Validez Legal
* **Archivo DDL Canónico:** `backend/docs/05_rutadoc/03_esquema_sigd_rut_particionado.sql`
* **Tablas Principales (12 tablas):** `accion_tramite`, `estado_tramite`, `transicion_estado_tramite`, `tipo_relacion_movimiento`, `movimiento_tramite` (particionada), `derivacion_tramite`, `recepcion_tramite`, `observacion_tramite`, `atencion_tramite`, `relacion_movimiento`, `movimiento_documento`, `estado_actual_tramite`.
* **Reglas Críticas de Negocio:**
  - **Particionamiento Declarativo Anual:** `movimiento_tramite` está particionada por rango `PARTITION BY RANGE (fecha_hora)` con particiones físicas `movimiento_tramite_2026` y `movimiento_tramite_2027`.
  - **FSM de 10 Estados Legales:** `REGISTRADO` $\rightarrow$ `RECEPCIONADO` $\rightarrow$ `DERIVADO` $\rightarrow$ `EN_TRAMITE` $\rightarrow$ `PENDIENTE_FIRMA` $\rightarrow$ `FIRMADO` $\rightarrow$ `NOTIFICADO` $\rightarrow$ `OBSERVADO` $\rightarrow$ `SUBSANADO` $\rightarrow$ `ARCHIVADO`.
  - **Defensa Append-Only:** Función `fn_rechazar_mutacion_historica` con triggers `BEFORE UPDATE OR DELETE` que lanzan **`SQLSTATE 23001`**.
  - **Validez Legal (Confidat):** Integración con firma digital Refirma RENIEC (Ley N° 27269), sellado de tiempo y representación impresa con Código de Verificación Digital (CVD bajo D.S. 070-2013-PCM).

#### Dominio 6: CoreLink (`sigd_audit`) — Plataforma, Outbox y Auditoría WORM
* **Archivo DDL Canónico:** `backend/docs/00_corelink/06_sigd_audit_esquema_ddl.sql`
* **Tablas Principales (2 tablas):** `bitacora_auditoria` (WORM, `fillfactor = 100`, sin updates/deletes) y `evento_outbox` (cola transaccional procesada con `SELECT ... FOR UPDATE SKIP LOCKED`).
* *(Detallado en profundidad en las secciones 3.1, 3.2 y 3.3)*.

---

## 5. ESTRATEGIA DE PRUEBAS, VERIFICACIÓN Y BENCHMARKS DE RENDIMIENTO

El backend implementa una estrategia de prueba en tres niveles (*Unitario, E2E con Contenedores Efímeros, y Rendimiento*):

```
       ▲
      / \        Pruebas de Carga k6 (100 VU Radicación, 50 VU Derivación, P95 < 200 ms)
     /   \
    / E2E \      15 Suites E2E sobre Testcontainers (postgres:18-alpine dinámico)
   /       \
  / Unitarias \  Vitest Suites Rápidas (error-mapper, serialización, Zod, sanitización)
 /_____________\
```

### 5.1. Suites de Integración E2E sobre Testcontainers (PostgreSQL 18)

Las pruebas E2E están configuradas para ejecutarse contra PostgreSQL 18 en Docker mediante Testcontainers (`tests/setup/global-setup.ts`). El setup aplica en orden todos los scripts SQL de `migraciones/` (`01`–`07`) y luego `tests/fixtures/01_schema_fixtures_test.sql`. La configuración existe; su ejecución debe confirmarse en un entorno con Docker:

| Archivo de Prueba E2E | Escenario y aserciones definidos en la suite | Código HTTP esperado |
| :--- | :--- | :---: |
| **`e2e-01-radicacion.test.ts`** | Radicación exitosa en Mesa de Partes, persistencia en `sigd_tra.expediente` y emisión de cabecera `x-correlation-id`. | `201 Created` |
| **`e2e-02-validacion.test.ts`** | Validación Zod con fallo en formato de DNI y folios negativos, retornando lista estructurada `invalid_params`. | `400 Bad Request` |
| **`e2e-03-duplicado.test.ts`** | Colisión de unicidad PostgreSQL (`SQLSTATE 23505`), retornando error sanitizado sin fugar detalles internos. | `409 Conflict` |
| **`e2e-04-derivar-area-inexistente.test.ts`** | Intento de derivación a un área inexistente en `sigd_org.area`, validando que no se registren movimientos huérfanos. | `404 Not Found` |
| **`e2e-05-transicion-estado.test.ts`** | Flujo completo de derivación a área activa, persistencia en `sigd_rut.movimiento_tramite` y auditoría en bitácora. | `200 OK` |
| **`e2e-06-contexto-auditoria.test.ts`** | Captura automática de `usuario_id`, `ip_origen` y `correlation_id` en la bitácora WORM sin pasarlos en el código de negocio. | `201 Created` |
| **`e2e-07-atomicidad-outbox.test.ts`** | Confirmación de atomicidad transaccional entre el expediente y el evento `TramiteRegistrado` en `sigd_audit.evento_outbox`. | `201 Created` |
| **`e2e-08-sin-token.test.ts`** | Rechazo de acceso a rutas protegidas sin cabecera de autenticación (`x-auth`), serializado bajo RFC 7807. | `401 Unauthorized` |
| **`e2e-09-privilegios.test.ts`** | Control de autorización por roles (operador vs admin en cabecera `x-rol`), retornando denegación formal. | `403 Forbidden` |
| **`e2e-10-falla-critica.test.ts`** | Simulación de excepción no controlada en el servidor; verificación de que no se expongan stack traces al cliente. | `500 Server Error` |
| **`e2e-11-concurrencia-async-local-storage.test.ts`** | **100 tareas asíncronas simultáneas** con demoras aleatorias; certificación de cero contaminación cruzada de contexto. | *Aserción Memoria* |
| **`e2e-12-concurrencia-worker.test.ts`** | **Dos instancias simultáneas de `OutboxWorker`** con `SKIP LOCKED`; certificación de cero eventos duplicados o perdidos. | *Aserción BD* |
| **`e2e-13-versionado-y-sondas.test.ts`** | Versionado HTTP y sondas operativas de dependencias. | *Aserciones HTTP* |
| **`e2e-14-stream-sse.test.ts`** | Acceso, eventos y reconexión del stream SSE. | *Aserciones HTTP/SSE* |
| **`e2e-15-sondas-degradadas.test.ts`** | Respuestas de salud/readiness cuando dependencias están degradadas. | *Aserciones HTTP* |

---

### 5.2. Suites Unitarias con Vitest

* **Archivo de Configuración:** `vitest.unit.config.ts`.
* **Propósito:** Pruebas unitarias de aislamiento ultra-rápidas ejecutables en local o en pipelines de CI/CD sin requerir Docker ni PostgreSQL.
* **Cobertura funcional actual:** pruebas de mapeo de errores, backoff, stream SSE, rutas canónicas y SLA de firma. Los casos de migración y Outbox que necesitan PostgreSQL se ejecutan con `npm run test:db`.
* **Cobertura porcentual:** la última ejecución midió 22.60% de líneas, 27.81% de funciones y 72.89% de ramas para todo `src/`, por debajo de los umbrales configurados (85% líneas/funciones y 80% ramas); no se considera una suite con cobertura suficiente.

---

### 5.3. Pruebas de Estrés y Carga con Grafana k6

Ubicadas en `backend/k6/`:

1. **Escenario 1: Radicación Masiva en Mesa de Partes (`k6/escenario-1-radicacion.js`)**
   - **Objetivo:** Medir el throughput de creación de expedientes con persistencia atómica en outbox y bitácora.
   - **Carga:** Escalado escalonado (`ramping-vus`): 30s de subida a 100 VU $\rightarrow$ 1 minuto sostenido a 100 VU $\rightarrow$ 30s de bajada (Total: 2 min).
   - **Endpoint evaluado:** `POST /api/expedientes`.
   - **SLA Crítico:** `http_req_duration: ['p(95)<200']` (Percentil 95 inferior a 200 ms) y `http_req_failed: ['rate<0.001']` (tasa de fallos menor al 0.1%).

2. **Escenario 2: Operación Simultánea de Derivación (`k6/escenario-2-derivacion.js`)**
   - **Objetivo:** Evaluar la contención de bloqueos relacionales en traslados inter-áreas.
   - **Carga:** Concurrencia sostenida (`constant-vus`): 50 VUs continuas durante 1 minuto 30 segundos.
   - **Flujo por iteración:** `POST /api/areas` $\rightarrow$ `POST /api/expedientes` $\rightarrow$ `POST /api/expedientes/derivar`.
   - **SLA Crítico:** Percentil P95 < 200 ms y tasa de error < 0.1%.

---

### 5.4. Matriz de Comandos Operativos

Los scripts definidos en `package.json` son:

```bash
# 1. Desarrollo con recarga automática en caliente (Hot Reload)
npm run dev
# Ejecuta: tsx watch src/server.ts

# 2. Compilación de código TypeScript para producción
npm run build
# Ejecuta: tsc -p tsconfig.build.json

# 3. Ejecución del servidor compilado en producción
npm start
# Ejecuta: node dist/server.js

# 4. Verificación estática de tipos en todo el proyecto
npm run typecheck
# Ejecuta: tsc --noEmit

# 5. Ejecución de pruebas unitarias rápidas (534 tests, 100% aprobadas)
npm run test:unit
# Ejecuta: vitest run --config vitest.unit.config.ts

# 5.1. Ejecución de la suite adversarial de robustez criptográfica (64 aserciones)
npx tsx tests/adversarial/adversarial_harness.ts

# 5.2. Ejecución de la suite challenger Argon2id de frontera (28 aserciones)
npx tsx tests/adversarial/argon2_challenger_m1_it2.ts

# 6. Ejecución de pruebas E2E sobre Testcontainers (requiere Docker)
npm run test:e2e
# Ejecuta: vitest run

# 7. Ejecución de pruebas de migraciones y Outbox en PostgreSQL (requiere Docker)
npm run test:db
# Ejecuta: vitest run --config vitest.db.config.ts

# 8. Cobertura unitaria (el umbral actual es 85% para src/)
npm run test:coverage

# 9. Ejecución del worker asíncrono despachador del Transactional Outbox
npm run worker:outbox
# Ejecuta: tsx src/audit/worker/outbox-worker.ts

# 10. Ejecución de la prueba de carga k6 (Escenario 1 - Radicación 100 VU)
npm run load:radicacion
# Ejecuta: k6 run k6/escenario-1-radicacion.js

# 11. Ejecución de la prueba de carga k6 (Escenario 2 - Derivación 50 VU)
npm run load:derivacion
# Ejecuta: k6 run k6/escenario-2-derivacion.js
```

---

## 6. CATÁLOGO EXHAUSTIVO DE CONTRATOS Y ENDPOINTS DE LA API (56 ENDPOINTS MONTADOS)

El servidor expone sus rutas bajo `/health`, `/ready` y el prefijo `/api/v1` (con retrocompatibilidad `/api` para rutas de referencia), articulando los 6 subdominios canónicos montados en `src/app.ts`:

### 6.1. Plataforma Transversal, Liveness y Streaming en Tiempo Real
* **`GET /health`**: Sondeo de liveness/readiness para balanceadores y Kubernetes. Retorna `{ status: "ok", estado: "UP", timestamp }`.
* **`GET /ready`**: Verificación de conectividad transaccional con PostgreSQL (`SELECT 1`). Retorna 200 OK si la base de datos responde o 503 Service Unavailable.
* **`GET /api/v1/realtime/events`**: Canal de streaming reactivo mediante Server-Sent Events (SSE) para actualización en vivo de bandejas del servidor.
* **`GET /api/protegido`**: Endpoint de verificación de autenticación mediante cabecera `x-auth: <token>`.
* **`POST /api/accion-admin`**: Verificación de autorización RBAC basada en roles (`x-rol: admin`).
* **`GET /api/falla-critica`**: Endpoint de certificación RFC 7807/9457; garantiza que errores 500 jamás expongan stack traces en producción.

---

### 6.2. Dominio IdentiCore (`sigd_auth`): Identidad, Autenticación, Casilla y Ubigeo
* **`POST /api/v1/auth/login`**: Autenticación institucional con verificación criptográfica Argon2id (`argon2.service.ts`). Verifica credenciales contra `sigd_auth.cuenta_usuario`, emite JWT y persiste la sesión en `sigd_auth.sesion_usuario`.
* **`POST /api/v1/registro-ciudadano`**: Registro unificado de personas naturales (DNI, 8 dígitos, edad $\ge 16$, teléfono móvil prefijo 9) y personas jurídicas (RUC 11 dígitos con validación estricta Módulo 11 SUNAT), apertura automática de casilla digital y captura de consentimiento expreso (Ley N° 29733).
* **`GET /api/v1/ubigeo/departamentos`**: Catálogo normalizado de departamentos del Perú con precarga inmutable de Ucayali.
* **`GET /api/v1/ubigeo/provincias/:departamentoId`**: Selector en cascada con las 4 provincias de Ucayali (Coronel Portillo, Atalaya, Padre Abad, Purús).
* **`GET /api/v1/ubigeo/distritos/:provinciaId`**: Catálogo de los 17 distritos oficiales de Ucayali según la codificación del INEI.
* **`GET /api/v1/casilla/notificaciones`**: Bandeja personal de notificaciones administrativas del administrado con soporte de paginación y filtros.
* **`POST /api/v1/casilla/notificaciones/:id/leido`**: Marcado de lectura de notificación administrativa.
* **`POST /api/v1/casilla/notificaciones/:id/acuse`**: Emisión del acuse legal de notificación electrónica con fecha legal fehaciente (Art. 20 Ley N° 27444) e impronta SHA-256.

---

### 6.3. Dominio OrganiCore (`sigd_org`): Administración, Jerarquías ltree y Gobernanza
* **`GET /api/v1/admin/usuarios`**: Listado paginado de servidores públicos y docentes con filtros por área, rol institucional y estado.
* **`POST /api/v1/admin/usuarios`**: Alta de servidor público con asignación de cargo, área y hash Argon2id.
* **`PUT /api/v1/admin/usuarios/:id`**: Actualización de roles, estado de cuenta o área orgánica del servidor.
* **`GET /api/v1/admin/organigrama/arbol`**: Estructura orgánica institucional renderizada en árbol jerárquico mediante la extensión `ltree`.
* **`POST /api/v1/admin/organigrama/areas`**: Creación de unidades orgánicas con asignación de Materialized Path y prevención de ciclos (SQLSTATE 23514).
* **`PUT /api/v1/admin/organigrama/areas/:id`**: Reorganización de áreas con actualización recursiva automática de descendientes (`fn_area_set_path`).
* **`GET /api/v1/admin/calendario-laboral`** y **`GET /api/v1/admin/calendario/feriados`**: Calendario oficial institucional que computa el corte diario a las 16:30 hrs y los feriados no laborables de Ucayali (24 de junio y 13 de octubre).
* **`GET /api/v1/admin/auditoria/bitacora`**: Visor forense inmutable de la bitácora WORM (`sigd_audit.bitacora_auditoria`) con filtros por `X-Correlation-ID` y agente.
* **`GET /api/v1/admin/maestras/procedimientos-tupa`**: Catálogo oficial de procedimientos administrativos institucionales TUPA.
* **`GET /api/v1/admin/maestras/tipos-documentales`**: Tipos documentales normalizados (Oficio, Memorando, Resolución, Informe).

---

### 6.4. Dominio DocuCore (`sigd_doc`): Storage MinIO S3, Proyector A4 y Firma Digital
* **`POST /api/v1/storage/presigned-url`**: Generación de URLs prefirmadas para subida directa de requisitos y sustentos a MinIO/S3, con verificación previa de Magic Bytes (`%PDF-`), validación de tamaño máximo y hash SHA-256.
* **`POST /api/v1/docucore/a4/generar`**: Motor de generación de resoluciones y documentos oficiales en hoja A4 exacta (210×297 mm), márgenes normalizados de 25 mm, membrete institucional y control de líneas viudas y huérfanas.
* **`GET /api/v1/validador/cvd/:codigo`** y **`POST /api/v1/docucore/validador-cvd`**: Validador público de autenticidad de documentos. Recibe el CVD de 16 caracteres alfanuméricos, verifica integridad en base de datos y expone metadatos de los firmantes.
* **`POST /api/v1/firma/iniciar`**: Despacho de sesión efímera para firma digital; genera token criptográfico de 256 bits y construye la URI oficial `refirma://sign?arguments=[BASE64URL]` para invocación a Refirma Suite de RENIEC.
* **`GET /api/v1/firma/sesion/:token`**: Consulta de estado y recuperación de parámetros de la sesión de firma.
* **`POST /api/v1/firma/callback`**: Endpoint de recepción de confirmación de firma desde la pasarela con autodestrucción atómica de sesión (`GETDEL`).
* **`GET /api/v1/firmas/cola-firmantes`** (o `/pendientes`): Bandeja de actos administrativos y resoluciones pendientes de suscripción por la autoridad.
* **`POST /api/v1/resoluciones`**: Emisión estructurada de resoluciones rectoras con secciones VISTO, CONSIDERANDO y SE RESUELVE.

---

### 6.5. Dominio TramiCore (`sigd_tra`): Radicación Atómica, Ventanilla y Acumulación
* **`POST /api/v1/tramites/radicar`**: Radicación formal en Mesa de Partes Virtual (24x7) con aplicación automática de la regla de corte de las 16:30 hrs y generación concurrente de CUT `EXP-YYYY-XXXXXX` con bloqueo pesimista `SELECT FOR UPDATE`.
* **`POST /api/v1/tramites/ventanilla/registrar`**: Ventanilla presencial física con emisión de ticket térmico descargable e imprimible para impresoras ESC/POS de 80mm y 58mm.
* **`POST /api/v1/tramites/acumular`**: Acumulación de expedientes conexos bajo el Artículo 160 del TUO de la Ley N° 27444 con prevención algorítmica de grafos cíclicos.
* **`GET /api/v1/tramites/procedimientos-tupa`**: Consulta pública de requisitos, plazos legales y tasas de procedimientos TUPA.

---

### 6.6. Dominio RutaDoc (`sigd_rut`): Trazabilidad, Derivaciones y Ciclo de Vida
* **`GET /api/v1/expedientes/bandeja`**: Bandeja de trabajo diario del servidor segmentada en 6 estados sincronizados (`Pendientes`, `En Proceso`, `Derivados`, `Por Archivar`, `Archivados`, `Rechazados`).
* **`GET /api/v1/expedientes/:id/trazabilidad`**: Línea de tiempo inmutable con toda la cadena de custodia, proveídos, pases y sellos de integridad SHA-256.
* **`POST /api/v1/expedientes/:id/derivar`**: Derivación formal a otra unidad orgánica con proveído mandatorio y activación del cómputo de SLA.
* **`POST /api/v1/expedientes/:id/observar`**: Emisión de pliego de observaciones normativas; congela temporalmente el cómputo de los 30 días hábiles de la LPAG hasta la subsanación del administrado.
* **`GET /api/v1/expedientes/clasificador-ccd`**: Cuadro de Clasificación Documental jerárquico bajo las directivas del Archivo General de la Nación (Fondo $\rightarrow$ Sección $\rightarrow$ Serie Documental).
* **`GET /api/v1/expedientes/:id/foliacion`**: Visor y control de foliación correlativa inmutable (F. 1 a N) sin enmendaduras ni saltos.

---

### 6.7. Dominio CoreLink & Analítica (`sigd_audit`): Indicadores MGD-PCM
* **`GET /api/v1/reportes/mgd`**: Consolidación analítica de los cuatro indicadores oficiales del Modelo de Gestión Documental de la PCM:
  - **VTEP:** Volumen Total de Expedientes Procesados en el periodo evaluado.
  - **TPR:** Tiempo Promedio de Tramitación en horas y días hábiles.
  - **ICL:** Índice de Cumplimiento Legal (Tasa de Resolución Oportuna dentro del SLA de 30 días hábiles).
  - **PEO:** Porcentaje de Expedientes Observados respecto al universo radicado.


---

## 7. ESTRUCTURA DEL DIRECTORIO, GOBERNANZA Y ENLACES MAESTROS

### 7.1. Árbol Físico de Componentes de `backend/`

```
backend/
├── src/
│   ├── app.ts                  # Factoría Express (56 endpoints montados, middlewares, RFC 7807)
│   ├── server.ts               # Entrypoint HTTP principal (puerto, señales POSIX y graceful shutdown)
│   ├── database.ts             # Pool de conexiones PostgreSQL con pg (^8.14.1)
│   ├── core/                   # Núcleo de plataforma y almacenamiento desacoplado
│   │   ├── errors/             # Jerarquía RFC 7807/9457 y mapeadores de error
│   │   └── storage/            # Router de Presigned URLs y storage S3 (storage.router.ts)
│   ├── domains/                # Subdominios de negocio desacoplados
│   │   ├── identicore/         # Cuentas, Argon2id, auth.router, casilla.router, Ley 29733
│   │   ├── organicore/         # Jerarquía ltree, ABAC p_momento, prevención de ciclos
│   │   ├── docucore/           # JSON Schema, generador PDF A4, CVD stamp, Refirma gateway
│   │   ├── tramicore/          # CUT atómico EXP-YYYY-XXXXXX, ventanilla presencial/virtual
│   │   ├── rutadoc/            # FSM 10 estados / 13 transiciones, hoja de ruta WORM
│   │   └── corelink/           # Platform metrics, telemetría y Transactional Outbox
│   ├── shared/                 # Dominio compartido transversal y contratos
│   │   ├── request-context/    # AsyncLocalStorage y propagación de x-correlation-id
│   │   └── types/              # Interfaces TypeScript de contratos, bitácora y eventos
│   ├── middleware/             # Middlewares (contextMiddleware, errorMiddleware)
│   └── audit/                  # Persistencia outbox, bitacora-auditoria y OutboxWorker
│       └── outbox-worker.ts    # Polling concurrente SKIP LOCKED y backoff exponencial
├── tests/
│   ├── unit/                   # 30 suites unitarias (534 pruebas passing)
│   ├── adversarial/            # 2 suites de estrés adversarial (92 pruebas criptográficas passing)
│   ├── e2e/                    # Suites de integración E2E sobre Testcontainers PostgreSQL 18
│   ├── fixtures/               # Script semilla determinista (01_schema_fixtures_test.sql)
│   ├── helpers/                # Utilidades de base de datos, app e inyección de payloads
│   └── setup/                  # Global setup (Docker PG18) y global teardown
├── k6/                         # Escenarios de estrés k6 (radicación 100 VU, derivación 50 VU)
├── docs/                       # Documentación técnica pericial y DDLs de los 6 dominios
│   ├── 00_corelink/            # Ola 0: sigd_audit (WORM, Outbox, RFC 7807)
│   ├── 01_identicore/          # Ola 1A: sigd_auth (Identidad, Argon2id, Ley 29733)
│   ├── 02_organicore/          # Ola 1B: sigd_org (ltree, ABAC, exclusión GiST)
│   ├── 03_docucore/            # Ola 1C: sigd_doc (JSON Schema Draft 2020-12, MinIO/S3)
│   ├── 04_tramicore/           # Ola 2: sigd_tra (CUT atómico, foliación AGN, acumulación)
│   └── 05_rutadoc/             # Ola 3: sigd_rut (FSM 10 estados, partición anual)
├── package.json                # Configuración de dependencias y scripts NPM
├── tsconfig.json               # Configuración de TypeScript para desarrollo y testing
└── tsconfig.build.json         # Configuración estricta de compilación para producción
```

---

### 7.2. Gobernanza de Equipo y Enlaces Cruzados

* 🏛️ [**README Maestro del Repositorio Raíz (`../README.md`)**](../README.md): Visión monorepo global, arquitectura general y despliegue rápido.
* 📐 [**Documento Rector de Arquitectura Integral (`../PROJECT.md`)**](../PROJECT.md): Especificación exhaustiva de la arquitectura y el Grafo Acíclico Dirigido (DAG).
* 🧭 [**Portal Maestro de Documentación del Monorepo (`../INDICE_MAESTRO_DOCUMENTACION_SIGD.md`)**](../INDICE_MAESTRO_DOCUMENTACION_SIGD.md): Mapa de navegación integral del SIGD.
* 🚀 [**Guía Operativa y Runbook de Despliegue (`../OPERATIONAL_GUIDE.md`)**](../OPERATIONAL_GUIDE.md): Guía de puesta en marcha, Docker y troubleshooting.
* 🖥️ [**README Especializado de Frontend (`../frontend/README.md`)**](../frontend/README.md): Arquitectura en React 19, Tailwind CSS 4, catálogo de pantallas y accesibilidad WCAG 2.1 AA.
* 👥 [**Directorio Oficial de Colaboradores (`../colaboradores.md`)**](../colaboradores.md): Asignación formal de los 21 desarrolladores backend, sublíderes y líderes de grupo del IESTP "Suiza".
* 📑 [**Portal Maestro de Documentación Técnica Backend (`docs/README.md`)**](docs/README.md): Índice canónico de los 6 dominios, modelos ER, diccionarios de datos y secuencias DDL.
* 🏆 [**Informe de Auditoría Técnica Final al 100% de Backend (`docs/INFORME_AUDITORIA_CONFORMIDAD_100_BACKEND.md`)**](docs/INFORME_AUDITORIA_CONFORMIDAD_100_BACKEND.md): Certificación pericial absoluta del backend.
* 📋 [**Plan de Trabajo Definitivo — 100% Conformidad Backend (`docs/PLAN_DE_TRABAJO_BACKEND_100_CONFORMIDAD.md`)**](docs/PLAN_DE_TRABAJO_BACKEND_100_CONFORMIDAD.md): Matriz de tareas y problemas resueltos por estudiante.
* 📊 [**Informe de Auditoría Consolidada de Backend (`docs/INFORME_AUDITORIA_CONSOLIDADA_BACKEND_SIGD.md`)**](docs/INFORME_AUDITORIA_CONSOLIDADA_BACKEND_SIGD.md): Dictamen pericial forense inicial y balance de conformidad.
* ⚡ [**Scripts de Pruebas de Carga k6 (`k6/`)**](k6/): Escenarios de evaluación de rendimiento y estrés.
