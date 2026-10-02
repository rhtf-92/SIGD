# SISTEMA INTEGRAL DE GESTIÓN DOCUMENTARIA (SIGD) — BACKEND
## Instituto de Educación Superior Tecnológico Público "Suiza" (Pucallpa, Perú)
**Programa de Estudios:** Desarrollo de Sistemas de Información (PE DSI) — Semestre Académico 2026-2

---

## 📑 Documentación Técnica y Dictamen Pericial

Para consultar la documentación exhaustiva de análisis funcional, modelos de datos, esquemas relacionales en PostgreSQL 18, matrices de conformidad y el dictamen de auditoría, consulte:

- 📑 [**Portal Maestro de Documentación Técnica (`docs/README.md`)**](docs/README.md)
- 📄 [**Informe de Auditoría Consolidada de Backend (`docs/INFORME_AUDITORIA_CONSOLIDADA_BACKEND_SIGD.md`)**](docs/INFORME_AUDITORIA_CONSOLIDADA_BACKEND_SIGD.md)
- 📊 [**Plan de Mejora Integral a Nivel Backend (`docs/Plan_de_mejora_nivel_backend_SIGD.md`)**](docs/Plan_de_mejora_nivel_backend_SIGD.md)

---

<<<<<<< HEAD
La arquitectura incorpora también servicios y repositorios para separar, respectivamente, la lógica de aplicación y el acceso a PostgreSQL.

### Dominio DocuCore (Grupo 5)

A partir de la rama `B_VALENTIN`, se introduce el dominio `src/domains/docucore` que encapsula la generación institucional de PDF A4, la pasarela de firma digital Refirma y la gestión de sesiones efímeras. Este dominio convive con la estructura MVC clásica y proporciona:

- **A4GeneratorService**: Generador de PDF en hoja A4 exacta (210×297 mm), márgenes 25 mm, membrete institucional, control de viudas/huérfanas, tablas atómicas y bloque de firma atómico.
- **RefirmaGatewayService**: Pasarela del protocolo `refirma://sign?arguments=[BASE64URL]` con validación estricta de payload (cuatro claves obligatorias, HTTPS, lista blanca de hosts, SHA-256 en minúsculas, Base64URL sin padding).
- **FirmaSessionStore**: Tokens de 256 bits, TTL 300 s, clave derivada por SHA-256, consumo atómico (`GETDEL` en Redis / `delete` en memoria).
- **ServicioFirmaService**: Orquestación completa: generación de PDF, emisión de token, construcción de URI, callback con autodestrucción de sesión, URL temporal de descarga.
=======
## 🏛️ Arquitectura del Backend Integrado
>>>>>>> 110b9d0ab4e1f8c7e20d4b7f0874a93079d9be09

El backend del SIGD implementa una arquitectura desacoplada, orientada a dominios y con observabilidad transversal:

<<<<<<< HEAD
- Node.js 24.19.0 LTS como entorno de ejecución.
- TypeScript 7.0.2 para el desarrollo con tipado estático.
- Express 5.2.1 para la aplicación HTTP y la futura API.
- PostgreSQL 18.6 como sistema gestor de base de datos.
- node-postgres 8.23.0 como cliente de PostgreSQL para Node.js.
- dotenv y tsx como dependencias de apoyo para la configuración del entorno y la ejecución durante el desarrollo.
- **pdf-lib 1.17.1** para generación de PDF.
- **ioredis 5.11.1** para cliente Redis 7.
=======
1. **Serialización Global de Errores (RFC 7807 / RFC 9457):** Todas las respuestas de error siguen el estándar `application/problem+json`, mapeando deterministamente excepciones de negocio y violaciones de integridad de PostgreSQL (`23505` a 409 Conflict, `23503` a 400 Bad Request, `P0001` a 422 Unprocessable Entity).
2. **Trazabilidad Contextual con `AsyncLocalStorage`:** Propagación transparente del contexto de solicitud (`correlation_id`, usuario actor, IP de origen) a través de todas las capas sin contaminar las firmas de los casos de uso.
3. **Patrón Transactional Outbox:** Encolado transaccional de eventos de dominio en `sigd_audit.evento_outbox` y procesamiento asíncrono con worker en background utilizando `FOR UPDATE SKIP LOCKED`.
4. **Validación de Esquemas con Zod:** Validación estricta en tiempo de ejecución de payloads de entrada mapeados a `invalid_params`.
>>>>>>> 110b9d0ab4e1f8c7e20d4b7f0874a93079d9be09

---

<<<<<<< HEAD
- `src/config`: configuración técnica de la aplicación y sus conexiones.
- `src/controllers`: controladores encargados de coordinar solicitudes y respuestas HTTP.
- `src/models`: representaciones de los datos y conceptos del dominio, una vez validados.
- `src/routes`: definición y agrupación futura de rutas de la API.
- `src/services`: coordinación de casos de uso y lógica de aplicación.
- `src/repositories`: abstracción futura del acceso y persistencia de datos.
- `src/middlewares`: funciones transversales del ciclo de solicitud y respuesta.
- `src/validators`: validación futura de los datos de entrada.
- `src/types`: tipos e interfaces compartidos de TypeScript.
- `src/utils`: utilidades técnicas reutilizables.
- `src/domains/docucore`: dominio DocuCore (Grupo 5) — PDF A4, Refirma, sesiones de firma.
- `tests`: pruebas automatizadas (Node.js `node:test` + `tsx`).
- `src/app.ts`: creación y configuración de la aplicación Express, cableado de dominios.
- `src/server.ts`: punto de entrada que lee el puerto e inicia el servidor HTTP.

## Endpoints DocuCore (Grupo 5)

Base path: `/api/v1/firma`

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/invocar-refirma` | Genera PDF A4, emite token, devuelve URI `refirma://`, URL de documento y callback. |
| `POST` | `/callback-refirma/:sesionId` | Recibe callback del agente Refirma; valida hash, destruye sesión, confirma firma. |
| `GET` | `/documento/:documentoId?token=...` | Descarga temporal del PDF firmado (300 s de vigencia). |

### Ejemplo de invocación

```bash
curl -X POST http://localhost:3000/api/v1/firma/invocar-refirma \
  -H "Content-Type: application/json" \
  -d '{
    "contenido": {
      "titulo": "RESOLUCION DIRECTORAL N.° 001-2026",
      "bloques": [
        { "tipo": "parrafo", "texto": "Considerando que..." },
        { "tipo": "articulo", "numero": "Articulo 1.-", "texto": "Declarar..." },
        { "tipo": "firma", "cargo": "DIRECTOR [EJEMPLO]", "nombre": "APELLIDO NOMBRE [EJEMPLO]" }
      ]
    },
    "firmante": { "id": "usr_001", "nombre": "APELLIDO NOMBRE [EJEMPLO]", "documento": "00000000" },
    "hostPublico": "https://sigd.iestp-suiza.edu.pe"
  }'
```

### Respuesta exitosa

```json
{
  "token": "a1b2c3...",
  "uriProtocolar": "refirma://sign?arguments=[eyJ1cmxEb2N1bWVudG8iOiJodHRwcy...]",
  "urlDocumento": "https://sigd.iestp-suiza.edu.pe/api/v1/firma/documento/doc_abc123?token=a1b2c3...",
  "hashDocumento": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "sesionId": "ses_0123456789abcdef0123456789abcdef",
  "expiraEn": "2026-09-30T10:05:00.000Z",
  "ttlSegundos": 300
}
```

## Pruebas

```bash
npm test
# 102 pruebas en 6 suites: A4, TTL/Redis, Refirma Gateway, Servicio de Firma
```

Cobertura:
- `tests/unit/domains/docucore/a4Generator.spec.ts` — geometría A4, paginación, hash SHA-256.
- `tests/unit/domains/docucore/firmaSession.spec.ts` — TTL 300s, consumo atómico (GETDEL), concurrencia.
- `tests/unit/domains/docucore/refirmaGateway.spec.ts` — URI, Base64URL, validación payload, seguridad.
- `tests/unit/domains/docucore/firma.service.spec.ts` — integración completa, callback, descarga, reuso.

## Configuración local

Copie `.env.example` a `.env` y ajuste:

```bash
cp .env.example .env
```

Variables clave:
- `REDIS_URL` — conexión a Redis 7 (si no está, usa almacen en memoria).
- `HOST_PUBLICO` — host público para URLs en el payload Refirma.
- `REFIRMA_HOSTS_PERMITIDOS` — lista blanca de hosts (coma-separada).
- `REFIRMA_EXIGIR_HTTPS` — `true` en producción.

## Alcance actual

El backend incluye ahora el dominio DocuCore completo (Grupo 5) con generación PDF A4, pasarela Refirma y sesiones de firma. La estructura MVC base permanece para futuros grupos. No incluye autenticación, modelos de negocio generales, tablas ni migraciones.
=======
## 🛠️ Stack Tecnológico

- **Entorno de Ejecución:** Node.js ≥ 20 LTS (ES Modules nativos).
- **Lenguaje:** TypeScript 5.8+ con tipado estricto y resolución `NodeNext`.
- **Framework Web:** Express 5.
- **Base de Datos:** PostgreSQL 18.3 / 18.6 con extensiones `pgcrypto` y `ltree`.
- **Cliente de Base de Datos:** `pg` (node-postgres 8.14+ con pooling optimizado).
- **Validación de Datos:** Zod 3.24+.
- **Suites de Pruebas:** Vitest 3.1+ y Testcontainers 10.21+ (PostgreSQL efímero en Docker).
- **Pruebas de Carga y Estrés:** Grafana k6.

---

## 📂 Estructura del Directorio `backend/`

```
backend/
├── src/
│   ├── app.ts                  # Factoría de la aplicación Express y pipeline de middlewares
│   ├── server.ts               # Punto de entrada y levantamiento del servidor HTTP
│   ├── database.ts             # Factoría y pool de conexiones PostgreSQL
│   ├── shared/                 # Dominio compartido, jerarquía de errores y tipos unificados
│   │   ├── domain/errors/      # AppError, DomainError, ConflictError, NotFoundError...
│   │   ├── request-context/    # AsyncLocalStorage y contexto de solicitud
│   │   └── types/              # Contratos de eventos, outbox, expedientes y paginación
│   ├── middleware/             # Middlewares transversales (contextMiddleware, errorMiddleware)
│   ├── errors/                 # Mapeadores de error (PostgreSQL, Zod, ErrorMapper)
│   ├── audit/                  # Repositorios de auditoría, evento_outbox y OutboxWorker
│   └── referencia/             # Router y controladores de referencia (Mesa de Partes)
├── tests/
│   ├── e2e/                    # 12 casos de prueba E2E sobre PostgreSQL efímero en Testcontainers
│   ├── unit/                   # Pruebas unitarias de mapeadores de error con Vitest
│   ├── fixtures/               # Scripts SQL semilla para pruebas
│   ├── helpers/                # Utilidades de aserción y payloads de prueba
│   └── setup/                  # Global setup y teardown de contenedores Docker
├── k6/                         # Escenarios de carga para radicación (100 VU) y derivación (50 VU)
├── docs/                       # Documentación técnica, DDLs SQL, análisis y planes por módulo
├── package.json                # Configuración unificada de dependencias y scripts
├── tsconfig.json               # Configuración TypeScript (desarrollo y pruebas)
└── tsconfig.build.json         # Configuración TypeScript para build de producción
```

---

## 🚀 Guía de Ejecución

### 1. Variables de Entorno
Copie el archivo de plantilla y ajuste los parámetros de conexión:
```bash
cp .env.example .env
```

### 2. Instalación de Dependencias
```bash
npm install
```

### 3. Scripts Disponibles

| Comando | Descripción |
| :--- | :--- |
| `npm run dev` | Inicia el servidor de desarrollo con recarga en caliente (`tsx watch`). |
| `npm run build` | Compila el código TypeScript a JavaScript en `dist/` para producción. |
| `npm start` | Ejecuta el servidor compilado en producción (`node dist/server.js`). |
| `npm run typecheck` | Valida el tipado estático del proyecto sin emitir archivos (`tsc --noEmit`). |
| `npm run test:unit` | Ejecuta las pruebas unitarias rápidas con Vitest (sin requerir Docker). |
| `npm run test:e2e` | Ejecuta las 12 pruebas E2E levantando PostgreSQL en Testcontainers. |
| `npm run worker:outbox` | Ejecuta el worker asíncrono para despachar eventos de la tabla outbox. |
| `npm run load:radicacion` | Ejecuta la prueba de carga k6 para el flujo de radicación (100 VU). |
| `npm run load:derivacion` | Ejecuta la prueba de carga k6 para el flujo de derivación (50 VU). |

>>>>>>> 110b9d0ab4e1f8c7e20d4b7f0874a93079d9be09
