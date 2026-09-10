# PLAN Y ESPECIFICACIÓN DE PRUEBAS DE INTEGRACIÓN (TESTCONTAINERS) Y DE RENDIMIENTO (k6)
## Grupo 6 "CoreLink" · Integración, Calidad y Pruebas del Backend — SIGD

**Proyecto:** Sistema Integral de Gestión Documentaria (SIGD)
**Institución:** IESTP "Suiza" (Pucallpa, Ucayali, Perú) — PE DSI
**Área:** Backend — CoreLink
**Responsable del entregable:** Zevallos · `B_ZEVALLOS`
**Documento:** `03_suite_pruebas_testcontainers_k6.md`
**Fecha:** 9 de septiembre de 2026
**Versión:** 1.4 (Revisión del Liderazgo — PR #79 · veredicto `REQUIERE CORRECCIONES`: evidencia en
PG16 local → casos `PARCIAL`; alcance de prototipo explícito; pendiente ejecución Testcontainers/PG18)

> [!NOTE]
> Este documento es una **especificación de referencia**. No contiene scripts ejecutables ni código
> listo para correr; describe de forma completa y detallada la estrategia de aseguramiento de calidad,
> los casos de prueba de integración (E2E), el ciclo de vida del entorno de pruebas y los escenarios y
> umbrales de carga que el encargado de Calidad debe implementar y validar antes del paso a producción.
>
> **Revisión v1.2 (Liderazgo — PR #79):** los casos E2E-06 y E2E-07 deben validar el **envelope
> normalizado** del entregable 02 v1.2 (`schema_version`, `id_expediente`, `id_movimiento`,
> `ocurrido_en`, `correlation_id`, `clave_idempotencia`) y el esquema `06_sigd_audit_esquema_ddl.sql`
> (bitácora con `fecha_hora`). El contrato de los eventos de RutaDoc (E-01, E-02, E-06, E-07) se
> define en el entregable 04 §6.2 y su aprobación bilateral es requisito para el cierre del PR.

---

## 1. Propósito y Problema que Resuelve

Definir la infraestructura de **aseguramiento de calidad automatizado** del backend del SIGD,
eliminando el uso de *mocks* en la capa de datos. En lugar de bases de datos locales compartidas o
simulaciones, se levanta un **entorno de pruebas efímero basado en contenedores** mediante
**Testcontainers** (PostgreSQL en Docker) y se definen **pruebas de carga y rendimiento con k6** para
validar la aptitud del sistema antes del paso a producción.

El objetivo es garantizar que las pruebas sean **100 % reproducibles y autónomas**, sin depender de
datos precargados manualmente, y que el rendimiento cumpla umbrales de aceptación objetivos.

### 1.1. Propuesta de valor
- Pruebas de integración contra una **base de datos real y aislada**, no contra simulaciones.
- Un solo comando reproduce el entorno completo de principio a fin.
- Validación de la interacción entre módulos (no solo unitaria por módulo).
- Medición objetiva del rendimiento con umbrales de aceptación.
- Puerto de entrada obligatorio antes del paso a producción.

---

## 2. Alcance y Elementos Fuera de Alcance

### Dentro del alcance
- Estrategia del entorno de pruebas de integración con Testcontainers (PostgreSQL en Docker).
- Ejecución automática de las migraciones DDL de los 6 esquemas del plan de mejora.
- Matriz detallada de **10 casos de prueba de integración E2E intermodulares**.
- Especificación de pruebas de carga con **k6**, escenarios y umbrales de aceptación (*Thresholds*).

### Fuera de alcance
- Middleware de errores RFC 7807 (entregable 01 — Duque).
- Arquitectura de auditoría y AsyncLocalStorage (entregable 02 — Reátegui).
- Contratos intermodulares y matriz Productor-Consumidor (entregable 04 — Ricardo).

> Los casos E2E **validan** los entregables 01 y 02, pero su diseño no pertenece a este documento.

---

## 3. Definiciones y Convención de Esquemas

### 3.1. Nomenclatura consolidada de esquemas

Los esquemas lógicos usan la nomenclatura consolidada del Plan de Mejora Backend SIGD:

| Esquema | Módulo / Subdominio |
| :--- | :--- |
| `sigd_auth` | IdentiCore (Personas, Cuentas) |
| `sigd_org` | OrganiCore (Áreas, Roles) |
| `sigd_doc` | DocuCore (Tipos Documentales, Adjuntos) |
| `sigd_tra` | TramiCore (Trámite, Expediente) |
| `sigd_rut` | RutaDoc (Trazabilidad, Movimientos) |
| `sigd_audit` | CoreLink (Bitácora, Outbox) |

> ⚠️ **Importante:** esta nomenclatura **reemplaza cualquier variante anterior** (`sigd_identi`,
> `sigd_tramite`, `sigd_docu`, `sigd_organi`, `sigd_ruta`) para alinearse con el estándar corporativo.
> Todos los archivos DDL, pruebas y referencias deben usar estos nombres.

### 3.2. Definiciones

| Término | Definición |
| :--- | :--- |
| **Testcontainers** | Librería que permite levantar y destruir contenedores Docker efímeros dentro de la suite de pruebas. |
| **E2E** | End-to-End: prueba que atraviesa la integración real de varios módulos (HTTP → caso de uso → base de datos). |
| **k6** | Herramienta open source de pruebas de carga y rendimiento (Grafana). |
| **Umbral (Threshold)** | Condición de aprobación/fallo de una métrica en k6. Si se incumple, la prueba se considera fallida. |
| **VU (Virtual User)** | Usuario virtual simulado por k6 que ejecuta iteraciones del escenario. |
| **Backoff** | Política de espera creciente entre reintentos (no aplica a k6; sí al worker del entregable 02). |

---

## 4. Estrategia de Pruebas de Integración con Testcontainers

### 4.1. Concepto central

En vez de usar una base de datos compartida precargada a mano (frágil y poco reproducible), cada
ejecución de la suite levanta una **base de datos PostgreSQL real, efímera y aislada** dentro de un
contenedor Docker. Las pruebas se ejecutan contra esa instancia real, lo que ejercita el mismo motor
de base de datos que se usará en producción (incluidos constraints, restricciones `CHECK`, índices,
tipos `INET`/`JSONB` y funciones como `gen_random_uuid()`).

### 4.2. Requisitos del entorno de pruebas

| Requisito | Descripción |
| :--- | :--- |
| **Docker Engine** | Disponible y en funcionamiento en el runner de pruebas (local o CI). |
| **Runner de pruebas** | Framework de pruebas del backend (recomendado: Vitest + Supertest para pruebas HTTP). |
| **Conector PostgreSQL** | Driver oficial `pg` (node-postgres) para ejecutar migraciones y consultas de verificación. |
| **Archivos DDL** | Los 6 archivos de migración (`sigd_auth`, `sigd_org`, `sigd_doc`, `sigd_tra`, `sigd_rut`, `sigd_audit`) disponibles en la ruta acordada del repositorio. |

### 4.3. Ciclo de vida del entorno de pruebas

| Fase | Acción | Responsabilidad |
| :--- | :--- | :--- |
| **1. Aislamiento total** | Antes de la suite se levanta un contenedor Docker independiente con **PostgreSQL 18 (Alpine)**, puerto aleatorio mapeado, y credenciales de prueba. | Configuración global de la suite (`global-setup`). |
| **2. Aprovisionamiento automático** | Al levantar el contenedor se ejecutan en orden las migraciones DDL de los **6 esquemas** (`sigd_auth`, `sigd_org`, `sigd_doc`, `sigd_tra`, `sigd_rut`, `sigd_audit`). | Ejecutor de migraciones de la suite. |
| **3. Limpieza entre escenarios** | Al finalizar cada caso se vacía el estado con un limpiado determinista de tablas (ver 4.4) para garantizar independencia y ausencia de contaminación de datos. | Hook posterior a cada prueba. |
| **4. Destrucción efímera** | Al terminar la ejecución global, el contenedor se detiene y destruye automáticamente, liberando puertos, memoria y disco. | Configuración global de la suite (`global-teardown`). |

### 4.4. Limpieza entre escenarios

Para que cada prueba parta de un estado conocido, el limpiado debe eliminar los datos de las tablas
de negocio y de auditoría creadas por las pruebas. Las tablas declaradas para el vaciado son:

| Orden lógico | Tabla | Esquema |
| :--- | :--- | :--- |
| 1 | `evento_outbox` | `sigd_audit` |
| 2 | `bitacora_auditoria` | `sigd_audit` |
| 3 | `movimiento_tramite` | `sigd_rut` |
| 4 | `asiento_registro` | `sigd_tra` |
| 5 | `expediente` | `sigd_tra` |
| 6 | `tramite` | `sigd_tra` |

- El vaciado se ejecuta con la sentencia `TRUNCATE ... CASCADE` para respetar las dependencias por
  llaves foráneas.
- Si en el futuro se agregan tablas de negocio sujetas a pruebas E2E, **deben añadirse a esta lista**
  para mantener la no-contaminación.

### 4.5. Reglas de no-contaminación

- Ninguna prueba debe depender de datos dejados por otra; cada caso prepara sus propios datos o usa
  el limpiado previo.
- No se permiten seeds manuales en la base de pruebas: todo dato de prueba se crea por HTTP o por
  repositorios dentro del caso.
- El orden de ejecución de los casos no debe afectar el resultado (aislamiento total).

---

## 5. Matriz de los 10 Casos de Prueba de Integración E2E

Cada caso verifica la **integración entre módulos**, la **propagación de contexto**
(AsyncLocalStorage), el **manejo de excepciones RFC 7807** (entregable 01) y la generación de
**auditoría** (entregable 02), según corresponda.

| ID | Módulo | Descripción | Resultado Esperado | Taxonomía |
| :--- | :--- | :--- | :--- | :---: |
| **E2E-01** | Mesa de Partes | Envío de solicitud con datos válidos de un ciudadano. | HTTP `201 Created` y persistencia del expediente con `correlation_id` asignado. | PARCIAL (PG16 local) |
| **E2E-02** | Mesa de Partes / Middleware | Envío de JSON con campos faltantes o formato incorrecto (p. ej. DNI inválido, folios negativos). | HTTP `400` estructurado bajo RFC 7807 con lista de `invalid_params`. | PARCIAL (PG16 local) |
| **E2E-03** | IdentiCore / Middleware | Registro de usuario con correo o DNI ya existente. | Captura de excepción PostgreSQL `23505` y mapeo a HTTP `409 Conflict`. | PARCIAL (PG16 local) |
| **E2E-04** | TramiCore / Middleware | Asignar/derivar trámite hacia un área que no existe. | Intercepción de violación `23503` y respuesta JSON indicando recurso inválido (`400/404`). | PARCIAL (PG16 local) |
| **E2E-05** | TramiCore / OrganiCore | Transición de estado desde Mesa de Partes hacia la jefatura. | HTTP `200 OK` y actualización correcta de la ubicación del documento. | PARCIAL (PG16 local) |
| **E2E-06** | Observabilidad / Contexto | Ejecutar una mutación verificando la captura de metadatos. | En `sigd_audit.bitacora_auditoria` constan `usuario_id`, `ip_origen` y `correlation_id` capturados automáticamente sin pasarlos en el código de negocio. | PARCIAL (PG16 local) |
| **E2E-07** | Observabilidad / Outbox | Radicar un expediente verificando atomicidad. | En la misma transacción se registran el expediente y el evento en `sigd_audit.evento_outbox` para su procesamiento asíncrono. | PARCIAL (PG16 local) |
| **E2E-08** | Seguridad / Middleware | Petición a ruta protegida sin token de autenticación. | HTTP `401 Unauthorized` en RFC 7807, bloqueando el acceso a la base de datos. | PARCIAL (PG16 local) |
| **E2E-09** | Seguridad / Middleware | Usuario con rol de operador intenta una acción de administrador. | HTTP `403 Forbidden` indicando privilegios insuficientes. | PARCIAL (PG16 local) |
| **E2E-10** | Middleware de Errores | Inducción deliberada de una falla crítica (p. ej. pérdida de conexión). | HTTP `500` estandarizado bajo RFC 7807 con ocultamiento total del *stack trace*. | PARCIAL (PG16 local) |

> **Nota (v1.4):** los casos E2E-01…E2E-10 están implementados y **ejecutados** con la evidencia de
> `implementacion/` (runbook 08): suite E2E con `TEST_DATABASE_URL` (12/12 archivos · 23/23 casos ·
> EXIT_CODE=0, `evidencia/e2e-20260909-204737/`) y carga k6 dentro de umbrales (P95 < 200 ms ·
> 0 % errores, `evidencia/k6-20260909-145820/`). Su estado es **`PARCIAL`** y NO `CONFIRMADO`
> porque la ejecución se realizó contra **PostgreSQL 16 local**, y la ejecución exigida en el plan
> (PostgreSQL 18 vía **Testcontainers/Docker**, con las migraciones reales de los 6 módulos) queda
> **`PENDIENTE`** por no disponer de Docker en el entorno de esta máquina.
>
> **Alcance de la suite ejecutable (prototipo CoreLink):** la suite carga **únicamente** el DDL real
> de `sigd_audit` (`integracion/06_sigd_audit_esquema_ddl.sql`) y **fixtures provisionales** para los
> 5 esquemas de los restantes módulos (`tests/fixtures/01_schema_fixtures_test.sql`). **No ejecuta las
> migraciones reales de los 6 módulos**; por tanto, la conformidad intermodular se valida contra los
> contratos aprobados (04) y stubs provisionales, y queda **`PARCIAL`/`PENDIENTE`** hasta que cada
> grupo entregue y la suite consuma sus migraciones reales. El mensaje de arranque de la suite lo
> declara explícitamente (sección §4.3).

### 5.1. Especificación detallada de cada caso

> Cada caso se describe con: **Objetivo**, **Precondiciones**, **Pasos**, **Resultado esperado** y
> **Salidas verificadas**. Esta especificación es la guía para redactar las pruebas automatizadas.

#### E2E-01 · Radicación exitosa en Mesa de Partes
- **Objetivo:** validar el flujo feliz de radicación de un expediente con datos válidos.
- **Precondiciones:** esquemas creados (migraciones ejecutadas), Mesa de Partes disponible.
- **Pasos:** (1) enviar una solicitud a `POST /api/expedientes` con datos de un ciudadano válidos;
  (2) esperar la respuesta; (3) consultar el expediente persistido.
- **Resultado esperado:** HTTP `201 Created`; el expediente queda persistido y cuenta con un
  `correlation_id` asignado (persistido en la bitácora si aplica).
- **Salidas verificadas:** `status = 201`; existencia del expediente en BD; `correlation_id` presente
  y no nulo.

#### E2E-02 · Validación de entrada (Zod → RFC 7807)
- **Objetivo:** validar que los errores de validación se serializan bajo RFC 7807 (entregable 01).
- **Precondiciones:** esquemas creados; ruta `POST /api/expedientes` con validación de esquema Zod.
- **Pasos:** (1) enviar un payload incompleto (p. ej. `numero_documento` vacío) o con datos inválidos
  (DNI malformado, folios negativos); (2) capturar la respuesta de error.
- **Resultado esperado:** HTTP `400` con `code = VALIDATION_ERROR`, campo `invalid_params` como
  arreglo con el detalle campo-por-campo (`name`/`reason`), y `correlation_id` definido.
- **Salidas verificadas (checklist de la aserción, no script):**
  - `status` es `400`.
  - `body.code` es `VALIDATION_ERROR`.
  - `body.invalid_params` es un arreglo no vacío (para este escenario) con las claves esperadas.
  - `body.correlation_id` está definido y coincide con el header `x-correlation-id` de respuesta.

#### E2E-03 · Registro duplicado (PostgreSQL `23505` → 409)
- **Objetivo:** validar el mapeo determinista de violación de unicidad a `409 Conflict`.
- **Precondiciones:** existe un usuario/registro previo con el mismo correo o DNI.
- **Pasos:** (1) crear un primer registro; (2) intentar crear un segundo con la misma clave única;
  (3) capturar la respuesta.
- **Resultado esperado:** HTTP `409` con `code = DUPLICATE_KEY`, sin exponer el mensaje interno de
  PostgreSQL.
- **Salidas verificadas:** `status = 409`; `code` correcto; el `detail` no contiene texto del motor.

#### E2E-04 · Derivación a área inexistente (PostgreSQL `23503`)
- **Objetivo:** validar el manejo de violación de llave foránea al derivar a un área inexistente.
- **Precondiciones:** un trámite radicado; el área de destino **no** existe.
- **Pasos:** (1) solicitar la derivación del trámite hacia el área inexistente; (2) capturar respuesta.
- **Resultado esperado:** intercepción de la violación `23503` y respuesta JSON indicando recurso
  inválido (`400` o `404` según la regla del módulo).
- **Salidas verificadas:** `status` en `{400, 404}`; `code` coherente con la matriz del entregable 01.

#### E2E-05 · Transición de estado Mesa de Partes → Jefatura
- **Objetivo:** validar la integración TramiCore–OrganiCore en la transición de ubicación del
  documento.
- **Precondiciones:** expediente radicado; área de jefatura existente en `sigd_org`.
- **Pasos:** (1) ejecutar la transición de estado desde Mesa de Partes hacia jefatura; (2) verificar.
- **Resultado esperado:** HTTP `200 OK` y la ubicación del documento actualizada correctamente.
- **Salidas verificadas:** `status = 200`; el registro de ubicación del documento quedó actualizado.

#### E2E-06 · Captura automática de contexto en la bitácora
- **Objetivo:** validar que la auditoría captura el contexto sin pasarlo en el código de negocio
  (entregable 02).
- **Precondiciones:** un usuario autenticado que ejecuta una mutación.
- **Pasos:** (1) ejecutar una mutación válida; (2) consultar `sigd_audit.bitacora_auditoria`.
- **Resultado esperado:** en la fila de auditoría constan `correlation_id` (igual al de la solicitud),
  `usuario_id`, `ip_origen` y `user_agent`, sin que el caso de uso los haya recibido por parámetros.
- **Salidas verificadas:** existencia de la fila de auditoría y coincidencia de sus metadatos con el
  contexto de la solicitud.

#### E2E-07 · Atomicidad expediente + evento outbox
- **Objetivo:** validar el patrón Transactional Outbox (entregable 02).
- **Precondiciones:** esquemas creados; worker opcionalmente detenido.
- **Pasos:** (1) radicar un expediente; (2) verificar que en la **misma transacción** quedó el
  expediente y el evento en `sigd_audit.evento_outbox`.
- **Resultado esperado:** el evento existe con estado `PENDIENTE` y su `correlation_id` coincide con el
  del expediente; si el expediente fallara, el evento no debería existir.
- **Salidas verificadas:** `id` del expediente y `id_evento` registrados; `estado = 'PENDIENTE'`.

#### E2E-08 · Acceso a ruta protegida sin token
- **Objetivo:** validar la respuesta de autenticación bajo RFC 7807 (entregable 01).
- **Precondiciones:** la ruta pertenece a un punto protegido por autenticación.
- **Pasos:** (1) enviar la petición sin token; (2) capturar respuesta; (3) confirmar que no se accedió
  a la base de datos (la protección ocurre antes del caso de uso).
- **Resultado esperado:** HTTP `401 Unauthorized` en formato RFC 7807, bloqueando el acceso a la BD.
- **Salidas verificadas:** `status = 401`; `code` coherente; no se produjeron mutaciones.

#### E2E-09 · Privilegios insuficientes (operador → acción de administrador)
- **Objetivo:** validar la respuesta de autorización bajo RFC 7807.
- **Precondiciones:** usuario autenticado con rol `operador`.
- **Pasos:** (1) que el operador intente una acción exclusiva de administrador; (2) capturar respuesta.
- **Resultado esperado:** HTTP `403 Forbidden` indicando privilegios insuficientes.
- **Salidas verificadas:** `status = 403`; `code` coherente; la acción no se ejecutó.

#### E2E-10 · Falla crítica inducida (errores 500 seguros)
- **Objetivo:** validar que una falla interna se serializa como `500` sin filtrar detalles.
- **Precondiciones:** escenario controlado de pérdida de conexión o error de runtime inducido
  únicamente en entorno de pruebas.
- **Pasos:** (1) inducir la falla; (2) capturar la respuesta de error.
- **Resultado esperado:** HTTP `500` estandarizado bajo RFC 7807, con ocultamiento total del
  *stack trace* y mensaje genérico.
- **Salidas verificadas:** `status = 500`; `code = INTERNAL_ERROR`; el cuerpo no contiene rastro de
  pila, rutas internas ni credenciales.

---

## 6. Especificación de Pruebas de Carga y Rendimiento con k6

Las pruebas de carga evalúan el comportamiento del backend bajo uso simultáneo intensivo antes del
pase a producción.

### 6.1. Métricas y umbrales de aceptación (Thresholds)

El resultado de la prueba de carga se considera **aprobado** solo si se cumplen **ambos** umbrales
simultáneamente:

| Métrica | Umbral | Interpretación |
| :--- | :--- | :--- |
| **Latencia P95** | `< 200 ms` | El 95 % de las solicitudes debe responder en menos de 200 ms. |
| **Tasa de errores** | `< 0.1 %` | Menos de 1 solicitud de cada 1000 puede fallar (`rate < 0.001`). |

> Si cualquier umbral se incumple, la prueba de carga **falla** y el sistema **no** está apto para
> pasar a producción; el informe debe señalar qué métrica y en qué escenario se incumplió.

### 6.2. Escenario 1 · Radicación Masiva en Mesa de Partes (100 VU)

Simula una ráfaga intensa de radicaciones desde Mesa de Partes.

| Parámetro | Valor |
| :--- | :--- |
| Ejecutor | Rampa de usuarios virtuales (`ramping-vus`) |
| Subida | 0 → 100 VU progresivo en **30 s** |
| Pico | Carga sostenida de **100 VU durante 1 minuto** |
| Descenso | 100 → 0 VU gradual en **30 s** |
| Acción | Envío de solicitudes de registro de trámites con identificadores únicos y datos dinámicos |

- **Objetivo medible:** verificar que el pico de 100 usuarios simultáneos no degrada la latencia por
  encima del umbral ni produce errores.
- **Datos:** se generan números de documento e identificadores únicos por iteración (ver 6.4) para
  evitar colisiones de unicidad entre iteraciones.

### 6.3. Escenario 2 · Operación Simultánea de Derivación (50 VU)

Simula la operación concurrente de operadores derivando expedientes.

| Parámetro | Valor |
| :--- | :--- |
| Ejecutor | Usuarios virtuales constantes (`constant-vus`) |
| Carga | **50 VU** constantes |
| Duración | **1 minuto con 30 segundos** |
| Acción | Mezcla de consulta y actualización: derivación de expedientes |

- **Objetivo medible:** confirmar que la operación mixta (lecturas + escrituras) se mantiene dentro de
  los umbrales bajo carga sostenida.

### 6.4. Generación de datos dinámicos

Para que la prueba de carga sea reproducible y no dependa de estado previo:

- Cada iteración genera **identificadores únicos** (p. ej. número de documento compuesto por un
  prefijo, el número de VU y el timestamp).
- No se reutilizan claves únicas entre iteraciones, evitando errores de duplicidad (`23505`) que
  alterarían la métrica de tasa de errores.
- La URL base del ambiente bajo prueba se configura por variable de entorno (recomendado:
  `BASE_URL`), con valor por defecto `http://localhost:3000` para pruebas locales.

### 6.5. Cómo se evalúa el resultado

1. Ejecutar ambos escenarios contra el ambiente de prueba.
2. Comparar las métricas reportadas con los umbrales de la sección 6.1.
3. Generar un informe con: ejecución (P95 y tasa de errores por escenario), violaciones de umbral si
   existieran y conclusión de aptitud (aprobado / no aprobado).
4. Documentar el informe dentro del entregable de calidad para evidencia del pase a producción.
5. **Semántica de los `*-summary.json` de k6:** la clave `"thresholds"` no almacena el resultado del
   umbral sino la bandera interna de k6 de **violación en el momento final** (`true` = incumplido,
   `false` = cumplido). La señal autoritativa de aprobación es la columna de estados en consola
   (marca de ✓ en la sección THRESHOLDS del log) más el **código de salida 0** del proceso. Ver
   runbook 08 §5.3.

---

## 7. Reproducibilidad y Autonomía

- Toda prueba de integración es **100 % reproducible y autónoma**: un solo flujo realiza la
  preparación del contenedor, las migraciones, la ejecución y la destrucción.
- No existen datos precargados manualmente; cada caso construye sus propios datos o parte del estado
  limpio.
- Cada escenario limpia el estado con `TRUNCATE ... CASCADE` sobre las tablas de la sección 4.4,
  evitando contaminación entre ejecuciones y entre casos.
- La prueba de carga genera datos dinámicos (identificadores únicos, timestamps) para evitar
  colisiones y dependencias de estado entre iteraciones.
- Si Docker no está disponible en el entorno, la suite no debe fallar silenciosamente: la ejecución
  debe quedar marcada como error de infraestructura con un mensaje claro.

---

## 8. Guía de Avance para el Equipo de Calidad (Lista de Verificación)

1. [ ] **Levantar el punto de entrada del entorno:** preparar la configuración global de la suite que
       usa Testcontainers para levantar el PostgreSQL efímero (sección 4).
2. [ ] **Conectar la ejecución de migraciones** al arranque del contenedor, recorriendo los 6 DDL en
       orden (sección 4.2).
3. [ ] **Implementar el limpiado entre escenarios** con `TRUNCATE ... CASCADE` sobre la lista de la
       sección 4.4.
4. [ ] **Redactar los 10 casos E2E** siguiendo la especificación de la sección 5 (un archivo por caso
       o por área temática, con aserciones alineadas a las salidas verificadas).
5. [ ] **Configurar el teardown global** para destruir el contenedor al finalizar.
6. [ ] **Implementar el script de carga k6** con los dos escenarios de la sección 6 (rampa 100 VU y
       carga constante 50 VU) y los umbrales de la sección 6.1.
7. [ ] **Configurar la URL base** del ambiente bajo prueba por variable de entorno.
8. [ ] **Ejecutar local y en CI** y adjuntar el informe de carga (P95 y tasa de errores) al entregable.
9. [ ] **Sincronizar dependencias:** coordinar con Duque (entregable 01), Reátegui (entregable 02)
       y Ricardo (entregable 04) los códigos esperados en las respuestas, los nombres de tablas de la
       sección 4.4 y el envelope de los eventos (schema_version, id_expediente, clave_idempotencia).
10. [ ] **Validar el envelope de los eventos** en los casos que tocan RutaDoc (E-01, E-02, E-06, E-07)
       contra el contrato formal del entregable 04 §6.2, junto con la prueba unitaria del mapeador.

---

## 9. Criterios de Validación Cumplidos

| # | Criterio | Cumple |
| :---: | :--- | :---: |
| 1 | La estrategia de pruebas de integración utiliza **Testcontainers** para levantar PostgreSQL efímero en Docker. | ✅ |
| 2 | Se define la ejecución automática de las migraciones DDL de los 6 esquemas en el plan; la suite **ejecutable actual valida solo el prototipo CoreLink** (DDL real de `sigd_audit` + fixtures provisionales de 5 esquemas) → estado `PARCIAL/PENDIENTE` (ver §5). | ⚠️ PARCIAL |
| 3 | Se especifican los **10 casos de prueba E2E** intermodulares con su resultado esperado. | ✅ |
| 4 | Se especifican las pruebas de carga con **k6** con umbrales (P95 < 200 ms y errores < 0.1 %). | ✅ |
| 5 | Las pruebas son 100 % reproducibles y autónomas (sin datos precargados manualmente). | ✅ |
| 6 | La documentación queda lista para que el equipo de calidad implemente la suite. | ✅ |
| 7 | Los casos E2E-06/E2E-07 y de RutaDoc validan el envelope v1.2 y el esquema DDL con `fecha_hora` (revisión PR #79). | ✅ |

---

## 10. Dependencias y Decisiones

- **Dependencia (Duque):** los casos E2E-02, 03, 04, 08, 09 y 10 validan la especificación RFC 7807
  del entregable 01 (responsable: Duque).
- **Dependencia (Reátegui):** los casos E2E-06 y E2E-07 validan la bitácora y el outbox del entregable
  02 (responsable: Reátegui).
- **Decisiones registradas:**
  - Se adopta la imagen base de PostgreSQL en su variante **Alpine** por tamaño y velocidad de
    arranque en runners.
  - Los valores de los umbrales k6 (P95 < 200 ms, errores < 0.1 %) son los definidos en el plan;
    cualquier ajuste debe autorizarse por el equipo y registrarse aquí.
  - El punto de entrada (set-up) valida la disponibilidad de Docker y falla de forma explícita si no
    está disponible (no falla en silencio).
- **Taxonomía:** `CONFIRMADO` — requisitos de la suite y umbrales del plan; `PROPUESTO` — detalles de
  configuración del runner (imagen, tamaños de lote); `PARCIAL` — implementado y ejecutado pero en
  entorno no exigido (PostgreSQL 16 local, sin Testcontainers/PG18) o contra stubs provisionales;
  `PENDIENTE` — bloquear hacia `CONFIRMADO` (re-ejecución Testcontainers, migraciones reales de los
  6 módulos, aprobación bilateral); `EJEMPLO` — datos y URLs de prueba.

---

*Documento elaborado por Zevallos (`B_ZEVALLOS`) como entregable de Fase 2 — Levantamiento de
Observaciones del Grupo 6 CoreLink. Revisión 1.2: alinea la suite con la v1.2 del entregable 02
(envelope normalizado e idempotencia) y con el contrato de eventos RutaDoc del entregable 04 §6.2
para el cierre del PR #79. Revisión 1.3: los 10 casos pasan a `CONFIRMADO` con la evidencia ejecutable
E2E (12/12) y de carga k6 (P95 < 200 ms, 0 % errores) registrada en `implementacion/evidencia/`.
Revisión 1.4 (veredicto `REQUIERE CORRECCIONES`): los casos vuelven a **`PARCIAL`** porque la
evidencia se generó en PostgreSQL 16 local y la ejecución exigida (Testcontainers/PG18 + migraciones
reales de los 6 módulos) queda `PENDIENTE`; se declara explícitamente el **alcance de prototipo**
(§5) y la **semántica de los umbrales k6** (§6.5 y resumen.txt).*