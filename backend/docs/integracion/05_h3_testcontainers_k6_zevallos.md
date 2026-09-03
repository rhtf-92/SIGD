SUITE DE PRUEBAS DE INTEGRACIÓN CON TESTCONTAINERS Y PRUEBAS DE CARGA CON k6
Grupo 6 "CoreLink" · Integración, Calidad y Pruebas del Backend — SIGD
Proyecto: Sistema Integral de Gestión Documentaria (SIGD)
Institución: IESTP "Suiza" (Pucallpa, Ucayali, Perú) — PE DSI
Área: Backend — CoreLink
Responsable del entregable: Zevallos · `B_ZEVALLOS`
Documento: `03_suite_pruebas_testcontainers_k6.md`
Fecha: 3 de septiembre de 2026
Versión: 1.0 (Fase 2 — Levantamiento de Observaciones)
---
1. Propósito y Problema que Resuelve
Definir la infraestructura de aseguramiento de calidad automatizado del backend del SIGD eliminando el uso de mocks en la capa de datos. En lugar de bases de datos locales compartidas o simulaciones, se levanta una infraestructura de pruebas de integración basada en contenedores efímeros mediante Testcontainers (PostgreSQL 18 en Docker), y se definen pruebas de carga y rendimiento con k6 para validar la aptitud del sistema antes del paso a producción.
El objetivo es garantizar que las pruebas sean 100% reproducibles y autónomas, sin depender de datos precargados manualmente, y que el rendimiento cumpla umbrales de aceptación objetivos.
---
2. Alcance y Elementos Fuera de Alcance
Dentro del alcance
Configuración del entorno de testing con Testcontainers (PostgreSQL 18 en Docker).
Ejecución automática de las migraciones DDL de los 6 esquemas.
Matriz de 10 casos de prueba de integración E2E intermodulares.
Scripts de prueba de carga con k6 y umbrales de aceptación (Thresholds).
Fuera de alcance
Middleware de errores RFC 7807 (entregable 01 de Azareño).
Arquitectura de auditoría y AsyncLocalStorage (entregable 02 de Reátegui).
Contratos intermodulares y matriz Productor-Consumidor (entregable 04 de Ricardo).
---
3. Definiciones y Convención de Esquemas
Los esquemas lógicos usan la nomenclatura consolidada del Plan de Mejora Backend SIGD:
Esquema	Módulo / Subdominio
`sigd_auth`	IdentiCore (Personas, Cuentas)
`sigd_org`	OrganiCore (Áreas, Roles)
`sigd_doc`	DocuCore (Tipos Documentales, Adjuntos)
`sigd_tra`	TramiCore (Trámite, Expediente)
`sigd_rut`	RutaDoc (Trazabilidad, Movimientos)
`sigd_audit`	CoreLink (Bitácora, Outbox)
> Nota: Esta nomenclatura reemplaza cualquier variante anterior (`sigd_identi`, `sigd_tramite`, `sigd_docu`, `sigd_organi`, `sigd_ruta`) para alinearse con el estándar corporativo.
Término	Definición
Testcontainers	Librería que permite levantar contenedores Docker efímeros dentro de la suite de pruebas.
E2E	End-to-End: prueba que atraviesa la integración real de varios módulos.
k6	Herramienta open source de pruebas de carga y rendimiento (Grafana).
Umbral (Threshold)	Condición de aprobación/fallo de una métrica en k6.
---
4. Arquitectura de la Suite de Pruebas (Testcontainers)
La estrategia elimina los dobles de prueba en la capa de datos: cada ejecución levanta una base de datos real y aislada.
4.1 Ciclo de Vida del Contenedor de Base de Datos
Aislamiento total: Antes de la suite, el entorno levanta un contenedor Docker independiente con PostgreSQL 18 (Alpine).
Aprovisionamiento automático: Al levantar el contenedor se ejecutan las migraciones DDL de los 6 esquemas (`sigd_auth`, `sigd_org`, `sigd_doc`, `sigd_tra`, `sigd_rut`, `sigd_audit`).
Limpieza entre escenarios: Al finalizar cada caso se aplica `TRUNCATE ... CASCADE` para garantizar independencia y ausencia de contaminación de datos.
Destrucción efímera: Al terminar la ejecución global, el contenedor se destruye automáticamente y libera los recursos.
4.2 Configuración de Testcontainers + Vitest/Supertest
```typescript
// test/setup.testcontainers.ts
import { GenericContainer, StartedTestContainer } from "testcontainers";
import { readFileSync } from "node:fs";

let postgres: StartedTestContainer;
export const pgConfig = { host: "", port: 0, user: "postgres", password: "test", database: "sigd" };

// Migraciones DDL de los 6 esquemas
const DDL_FILES = [
    "sql/sigd_auth.sql",
    "sql/sigd_org.sql",
    "sql/sigd_doc.sql",
    "sql/sigd_tra.sql",
    "sql/sigd_rut.sql",
    "sql/sigd_audit.sql",
];

export async function startTestDatabase(): Promise<void> {
    postgres = await new GenericContainer("postgres:18-alpine")
        .withEnvironment({ POSTGRES_USER: pgConfig.user, POSTGRES_PASSWORD: pgConfig.password, POSTGRES_DB: pgConfig.database })
        .withExposedPorts(5432)
        .start();

    pgConfig.host = postgres.getHost();
    pgConfig.port = postgres.getMappedPort(5432);
    await runMigrations();
}

async function runMigrations(): Promise<void> {
    const { Client } = await import("pg");
    const client = new Client(pgConfig);
    await client.connect();
    for (const file of DDL_FILES) {
        await client.query(readFileSync(file, "utf8"));
    }
    await client.end();
}

export async function cleanDatabase(): Promise<void> {
    const { Client } = await import("pg");
    const client = new Client(pgConfig);
    await client.connect();
    await client.query(
        "TRUNCATE sigd_audit.evento_outbox, sigd_audit.bitacora_auditoria, sigd_rut.movimiento_tramite, sigd_tra.asiento_registro, sigd_tra.expediente, sigd_tra.tramite CASCADE",
    );
    await client.end();
}

export async function stopTestDatabase(): Promise<void> {
    await postgres.stop();
}
```
```typescript
// test/global-setup.ts (Vitest)
import { startTestDatabase } from "./setup.testcontainers";

export default async function setup(): Promise<void> {
    await startTestDatabase();
}
```
---
5. Matriz de 10 Casos de Prueba de Integración E2E Intermodulares
Cada caso verifica la integración entre módulos, la propagación de contexto con `AsyncLocalStorage`, el manejo de excepciones RFC 7807 y la generación de auditoría.
ID	Módulo	Descripción	Resultado Esperado	Taxonomía
E2E-01	Mesa de Partes	Envío de solicitud con datos válidos de un ciudadano.	HTTP `201 Created` y persistencia del expediente con `correlation_id` asignado.	CONFIRMADO
E2E-02	Mesa de Partes / Middleware	Envío de JSON con campos faltantes o formato incorrecto (ej. DNI inválido, folios negativos).	HTTP `400` estructurado bajo RFC 7807 con lista de `invalid_params`.	CONFIRMADO
E2E-03	IdentiCore / Middleware	Registro de usuario con correo o DNI ya existente.	Captura de excepción PostgreSQL `23505` y mapeo a HTTP `409 Conflict`.	CONFIRMADO
E2E-04	TramiCore / Middleware	Asignar/derivar trámite hacia un área que no existe.	Intercepción de violación `23503` y respuesta JSON indicando recurso inválido (`400/404`).	CONFIRMADO
E2E-05	TramiCore / OrganiCore	Transición de estado desde Mesa de Partes hacia la jefatura.	HTTP `200 OK` y actualización correcta de la ubicación del documento.	CONFIRMADO
E2E-06	Observabilidad / AsyncLocalStorage	Ejecutar una mutación verificando la captura de metadatos.	En `sigd_audit.bitacora_auditoria` constan `usuario_id`, `ip_origen` y `correlation_id` capturados automáticamente sin pasarlos en el código de negocio.	CONFIRMADO
E2E-07	Observabilidad / Outbox	Radicar un expediente verificando atomicidad.	En la misma transacción se registran el expediente y el evento en `sigd_audit.evento_outbox` para su procesamiento asíncrono.	CONFIRMADO
E2E-08	Seguridad / Middleware	Petición a ruta protegida sin token de autenticación.	HTTP `401 Unauthorized` en RFC 7807, bloqueando el acceso a la base de datos.	CONFIRMADO
E2E-09	Seguridad / Middleware	Usuario con rol de operador intenta una acción de administrador.	HTTP `403 Forbidden` indicando privilegios insuficientes.	CONFIRMADO
E2E-10	Middleware de Errores	Inducción deliberada de una falla crítica (ej. pérdida de conexión).	HTTP `500` estandarizado bajo RFC 7807 con ocultamiento total del stack trace.	CONFIRMADO
5.1 Ejemplo de caso de prueba ejecutable (E2E-02)
```typescript
// test/e2e/validacion-zod.test.ts
import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app";
import { startTestDatabase, cleanDatabase, stopTestDatabase } from "../setup.testcontainers";

beforeAll(startTestDatabase);
afterEach(cleanDatabase);
afterAll(stopTestDatabase);

describe("E2E-02 · Validación de entrada (Zod → RFC 7807)", () => {
    it("devuelve 400 con invalid_params cuando faltan campos", async () => {
        const res = await request(app).post("/api/expedientes").send({ numero_documento: "" });
        expect(res.status).toBe(400);
        expect(res.body).toMatchObject({ status: 400, code: "VALIDATION_ERROR" });
        expect(Array.isArray(res.body.invalid_params)).toBe(true);
        expect(res.body.correlation_id).toBeDefined();
    });
});
```
---
6. Especificación de Pruebas de Carga y Rendimiento con k6
Las pruebas de carga evalúan el comportamiento del backend bajo uso simultáneo intensivo antes del pase a producción.
6.1 Criterios de Aceptación (Thresholds)
Métrica	Umbral	Expresión k6
Latencia P95	< 200 ms	`http_req_duration: ['p(95)<200']`
Tasa de errores	< 0.1%	`http_req_failed: ['rate<0.001']`
6.2 Escenarios de Simulación de Carga
Escenario 1: Radicación Masiva en Mesa de Partes (100 VU simultáneos)
Rampa de subida progresiva en 30 s hasta 100 usuarios virtuales.
Mantenimiento de la carga pico durante 1 minuto.
Rampa de descenso gradual de 30 s.
Acción: enviar solicitudes de registro de trámites con identificadores únicos y datos dinámicos.
Escenario 2: Operación Simultánea de Derivación (50 VU)
50 usuarios virtuales constantes consultando y actualizando (derivación de expedientes) durante 1 minuto y medio.
6.3 Script k6 completo
```javascript
// load/load-test.js
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
    scenarios: {
        radicacion: {
            executor: "ramping-vus",
            startVUs: 0,
            stages: [
                { duration: "30s", target: 100 }, // subida a 100 VU
                { duration: "1m", target: 100 },  // pico sostenido
                { duration: "30s", target: 0 },   // descenso
            ],
        },
        derivacion: {
            executor: "constant-vus",
            vus: 50,           // operadores constantes
            duration: "1m30s", // 1 minuto y medio
        },
    },
    thresholds: {
        http_req_duration: ["p(95)<200"], // P95 < 200ms
        http_req_failed: ["rate<0.001"],  // tasa de errores < 0.1%
    },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

export default function () {
    const payload = {
        numero_documento: `DNI-${__VU}-${Date.now()}`,
        tipo_tramite: "SOLICITUD",
        asunto: "Prueba de carga",
    };
    const res = http.post(`${BASE_URL}/api/expedientes`, JSON.stringify(payload), {
        headers: { "Content-Type": "application/json" },
    });
    check(res, { "status es 201": (r) => r.status === 201 });
    sleep(1);
}
```
---
7. Reproducibilidad y Autonomía
Toda prueba de integración es 100% reproducible y autónoma, sin datos precargados manualmente.
Cada escenario limpia el estado mediante `TRUNCATE ... CASCADE`, evitando contaminación entre ejecuciones.
El script k6 genera datos dinámicos (`__VU`, timestamps) para evitar colisiones y dependencias de estado.
---
8. Criterios de Validación Cumplidos
#	Criterio	Cumple
1	La suite de pruebas de integración utiliza Testcontainers para levantar PostgreSQL efímero en Docker.	✅
2	Se ejecutan automáticamente las migraciones DDL de los 6 esquemas.	✅
3	Se definen 10 casos de prueba E2E intermodulares.	✅
4	Se definen scripts de prueba de carga con k6 con umbrales (P95 < 200ms y errores < 0.1%).	✅
5	Las pruebas son 100% reproducibles y autónomas.	✅
---
9. Dependencias y Decisiones
Dependencia (Azareño): Los casos E2E-02, 03, 04, 08, 09 y 10 validan la especificación RFC 7807 del entregable 01.
Dependencia (Reátegui): Los casos E2E-06 y 07 validan la bitácora y el outbox del entregable 02.
Taxonomía: `CONFIRMADO` — requisitos de la suite y umbrales del plan; `PROPUESTO` — detalles de configuración del runner; `EJEMPLO` — datos y urls de prueba.
---
Documento elaborado por Zevallos (`B_ZEVALLOS`) como entregable de Fase 2 — Levantamiento de Observaciones del Grupo 6 CoreLink.