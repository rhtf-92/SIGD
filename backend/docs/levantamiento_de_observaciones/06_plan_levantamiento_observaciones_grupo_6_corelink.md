# PLAN DE TRABAJO: LEVANTAMIENTO DE OBSERVACIONES
## Grupo 6 “CoreLink” · Integración, Calidad y Pruebas del Backend

**Proyecto:** Sistema Integral de Gestión Documentaria (SIGD)  
**Institución:** IESTP "Suiza" (Pucallpa, Ucayali, Perú) — PE DSI  
**Área:** Backend  
**Líder General:** Geric · `B_GERIC` | **Sublíder:** Ricardo · `B_AREVALO`  
**Integrantes:** Ricardo (`B_AREVALO`), Duque (`B_DUQUE`), Reátegui (`B_REATEGUI`), Zevallos (`B_ZEVALLOS`)  
**Fecha:** 30 de agosto de 2026  
**Versión:** 2.0 (Fase 2 — Middleware RFC 7807, AsyncLocalStorage y Testcontainers)  
**Ubicación:** `backend/docs/levantamiento_de_observaciones/06_plan_levantamiento_observaciones_grupo_6_corelink.md`

---

## 1. Objetivo del Levantamiento de Observaciones

Subsanar las observaciones arquitecturales identificadas en el diagnóstico senior, diseñando la implementación técnica del **Middleware Global de Manejo de Errores** bajo el estándar internacional **RFC 7807 / RFC 9457** para Express 5, estructurando la propagación de contexto distribuido mediante **`AsyncLocalStorage`** de Node.js para alimentar la bitácora de auditoría forense (`sigd_audit.bitacora_auditoria`), y estableciendo la infraestructura automatizada de pruebas de integración intermodulares con **Testcontainers** (PostgreSQL 18 en Docker) y pruebas de carga con **k6**.

---

## 2. Alcance Específico de las Mejoras

1. **Middleware Global de Errores RFC 7807 / RFC 9457 en Express 5:**
   - Jerarquía de excepciones de dominio: `AppError`, `DomainError`, `NotFoundError`, `ConflictError`, `UnauthorizedError`, `ValidationError`.
   - Interceptor automático que mapea errores nativos de PostgreSQL (violaciones de unicidad `23505`, llaves foráneas `23503`, excepciones de negocio `P0001`) y validaciones de Zod a la respuesta JSON estandarizada con `type`, `title`, `status`, `detail`, `instance`, `code`, `correlation_id` e `invalid_params`.
2. **Propagación de Contexto Asíncrono (`AsyncLocalStorage`):**
   - Crear el módulo `RequestContext` para inyectar automáticamente `correlation_id`, `usuario_id`, `ip_origen` y `user_agent` en cualquier capa de la aplicación (casos de uso, servicios y repositorios) sin ensuciar las firmas de los métodos.
   - Alimentar de forma transparente la tabla `sigd_audit.bitacora_auditoria` ante cada mutación de datos.
3. **Pipeline Automatizado de Pruebas de Integración con Testcontainers:**
   - Configuración de suite de pruebas con Vitest/Supertest que levanta automáticamente un contenedor Docker limpio de PostgreSQL 18, ejecuta las migraciones DDL de los 6 esquemas y corre escenarios E2E completos.
4. **Pruebas de Carga y Rendimiento con k6:**
   - Diseñar scripts k6 para simular 100 usuarios concurrentes radicando trámites en Mesa de Partes y 50 operadores derivando expedientes simultáneamente, midiendo latencia (P95 < 200ms) y tasa de errores (< 0.1%).

---

## 3. Límites y Criterios de Validación

- Las respuestas de error nunca expondrán trazas de pila (*Stack Traces*), contraseñas, tokens ni detalles internos de la base de datos en entornos de producción.
- Toda prueba de integración debe ser 100% reproducible y autónoma, sin depender de datos precargados manualmente.
- Toda decisión técnica se etiquetará según la taxonomía oficial: `CONFIRMADO`, `PROPUESTO`, `PENDIENTE` o `EJEMPLO`.

---

## 4. Organización del Equipo y Ramas Git

| Integrante | Rama Personal | Rol / Responsabilidad en Levantamiento | Entregable Principal |
| :--- | :--- | :--- | :--- |
| **Ricardo** | `B_AREVALO` | Sublíder y Coordinador de Integración | Contratos intermodulares unificados, matriz de eventos Outbox y consolidación. |
| **Duque** | `B_DUQUE` | Especialista en API y Middleware | Especificación técnica del Middleware RFC 7807 y jerarquía de excepciones. |
| **Reátegui** | `B_REATEGUI` | Especialista en Observabilidad y Auditoría | Arquitectura de contexto con AsyncLocalStorage y esquema `sigd_audit`. |
| **Zevallos** | `B_ZEVALLOS` | Especialista en QA y Pruebas Automatizadas | Suite de pruebas Testcontainers, escenarios E2E y scripts de carga k6. |

---

## 5. Responsabilidades Individuales Detalladas

### Duque (`B_DUQUE`)
- Redactar `01_especificacion_middleware_rfc7807.md` detallando:
  - Estructura de clases de error en TypeScript (`AppError`, `ValidationError`, etc.).
  - Mapeo determinista de códigos de error PostgreSQL a códigos HTTP (ej. `23505` $\to$ 409 Conflict, `23503` $\to$ 400 Bad Request).
  - Ejemplos completos de payloads de respuesta JSON para cada escenario de error.

### Reátegui (`B_REATEGUI`)
- Redactar `02_arquitectura_auditoria_contexto_asynclocalstorage.md` documentando:
  - Uso de `AsyncLocalStorage` para trazabilidad de solicitudes HTTP.
  - Esquema DDL de `sigd_audit.bitacora_auditoria` (`id_auditoria`, `correlation_id`, `usuario_id`, `esquema`, `tabla`, `operacion`, `datos_antes JSONB`, `datos_despues JSONB`, `fecha_hora`, `ip_origen`).
  - Worker asíncrono para el despacho de la tabla `sigd_audit.evento_outbox`.

### Zevallos (`B_ZEVALLOS`)
- Redactar `03_suite_pruebas_testcontainers_k6.md` especificando:
  - Configuración del entorno de testing con Testcontainers (PostgreSQL 18 en Docker).
  - 10 casos de prueba de integración E2E que atraviesen los 6 módulos.
  - Script de prueba de carga en k6 con umbrales de aceptación (*Thresholds*).

### Ricardo (`B_AREVALO`)
- Redactar `04_contratos_intermodulares_unificados.md` consolidando:
  - Matriz final Productor-Consumidor de interfaces y eventos Outbox.
  - Contratos de tipos compartidos (`shared/types`).
- Redactar `05_decisiones_levantamiento_corelink.md` y consolidar en `B_AREVALO`.

---

## 6. Cronograma de Trabajo (Sprint de 2 Semanas)

| Hito | Actividad | Responsable | Plazo |
| :---: | :--- | :---: | :---: |
| **H1** | Especificación de Middleware RFC 7807 y AsyncLocalStorage | Duque / Reátegui | Días 1 - 4 |
| **H2** | Contratos Intermodulares Unificados y Matriz Outbox | Ricardo | Días 5 - 7 |
| **H3** | Suite de Testcontainers y Scripts de Carga k6 | Zevallos | Días 8 - 10 |
| **H4** | Ejecución de Pruebas de Integración y Simulación de Carga | Zevallos | Días 11 - 12 |
| **H5** | Integración en `B_AREVALO` y PR hacia `B_GERIC` | Ricardo | Días 13 - 14 |

---

## 7. Dependencias y Contratos con Otros Grupos

- **Todos los Grupos (1 al 5):** Deben utilizar la clase `AppError` para lanzar excepciones de dominio y respetar los contratos definidos en `04_contratos_intermodulares_unificados.md`.

---

## 8. LISTA DE VERIFICACIÓN PARA LA ENTREGA DEL LEVANTAMIENTO DE OBSERVACIONES

| Estado | Criterio de Verificación Técnico y Metodológico | Responsable | Evidencia Requerida |
| :---: | :--- | :---: | :--- |
| ☐ | La jerarquía de errores y el Middleware capturan excepciones de Postgres/Zod y serializan a **RFC 7807 / RFC 9457**. | Duque | `01_especificacion_middleware_rfc7807.md` |
| ☐ | El diseño de `AsyncLocalStorage` permite propagar `correlation_id` e identidad de usuario sin acoplar parámetros. | Reátegui | `02_arquitectura_auditoria...md` |
| ☐ | Se define el esquema completo de la bitácora forense `sigd_audit.bitacora_auditoria` con almacenamiento `JSONB`. | Reátegui | DDL y especificación en `02_arquitectura...md` |
| ☐ | Se especifica la arquitectura del procesador asíncrono para la tabla `sigd_audit.evento_outbox`. | Reátegui / Ricardo | Flujo en `02_arquitectura...md` |
| ☐ | La suite de pruebas de integración utiliza **Testcontainers** para levantar PostgreSQL efímero en Docker. | Zevallos | `03_suite_pruebas_testcontainers_k6.md` |
| ☐ | Se definen scripts de prueba de carga con **k6** con umbrales de rendimiento (P95 < 200ms). | Zevallos | Scripts en `03_suite_pruebas...md` |
| ☐ | La matriz de contratos intermodulares unifica las interfaces y eventos compartidos entre los 6 módulos. | Ricardo | `04_contratos_intermodulares_unificados.md` |
| ☐ | Decisiones técnicas registradas en el log de decisiones de CoreLink. | Ricardo | `05_decisiones_levantamiento_corelink.md` |
| ☐ | Commits individuales verificables en `B_DUQUE`, `B_REATEGUI`, `B_ZEVALLOS` y `B_AREVALO`. | Todos | Historial de Git |
| ☐ | Sublíder integró formalmente mediante Pull Request hacia `B_GERIC`. | Ricardo | PR en GitHub |

---

## 9. Resultado Esperado

Al finalizar este plan, el Grupo 6 entregará el marco de gobernanza, observabilidad, calidad automatizada y manejo uniforme de errores que garantizará la estabilidad y robustez empresarial del backend del SIGD.

| Líder General Backend | Sublíder Responsable CoreLink | Fecha de Conformidad |
| :---: | :---: | :---: |
| **Geric** · `B_GERIC` | **Ricardo** · `B_AREVALO` | Pendiente de Revisión |
