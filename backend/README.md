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

## 🏛️ Arquitectura del Backend Integrado

El backend del SIGD implementa una arquitectura desacoplada, orientada a dominios y con observabilidad transversal:

1. **Serialización Global de Errores (RFC 7807 / RFC 9457):** Todas las respuestas de error siguen el estándar `application/problem+json`, mapeando deterministamente excepciones de negocio y violaciones de integridad de PostgreSQL (`23505` a 409 Conflict, `23503` a 400 Bad Request, `P0001` a 422 Unprocessable Entity).
2. **Trazabilidad Contextual con `AsyncLocalStorage`:** Propagación transparente del contexto de solicitud (`correlation_id`, usuario actor, IP de origen) a través de todas las capas sin contaminar las firmas de los casos de uso.
3. **Patrón Transactional Outbox:** Encolado transaccional de eventos de dominio en `sigd_audit.evento_outbox` y procesamiento asíncrono con worker en background utilizando `FOR UPDATE SKIP LOCKED`.
4. **Validación de Esquemas con Zod:** Validación estricta en tiempo de ejecución de payloads de entrada mapeados a `invalid_params`.

---

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

