# 07_borrador_middleware_rfc7807_trazabilidad_corelink.md

- **Grupo:** Grupo 6 — Coordinación de Integración
- **Documento de referencia:** `06_plan_levantamiento_observaciones_grupo_6_corelink.md` (Hito H1)
- **Tipo:** **BORRADOR TÉCNICO PRELIMINAR DE CONTINGENCIA**
- **Estado:** PROPUESTA / PENDIENTE — sujeta a revisión y validación del proyecto
- **Propósito:** Proporcionar a la coordinación del Grupo 6 una especificación preliminar de contingencia para no bloquear el sprint si los entregables asignados al Hito H1 no estuvieran disponibles a tiempo.
- **Taxonomía:** `PROPUESTA` (diseño del equipo por validar), `PENDIENTE` (sujeto a confirmación), `SUPUESTO` (referencia de trabajo), `EJEMPLO` (fragmento ficticio de demostración).

> [!IMPORTANT]
> Este documento es un **plan de contingencia mantenido en aislamiento en `B_AREVALO`**. No sustituye el entregable oficial del Hito H1 ni implica autoría sobre el mismo. Solo se activará y oficializará si la coordinación lo requiere.

---

## 1. Objetivo

Definir, a nivel de diseño preliminar, la implementación de un **Middleware Global de Manejo de Errores** bajo el estándar **RFC 7807 / RFC 9457** para Express 5, junto con la **propagación de contexto distribuido mediante `AsyncLocalStorage`** de Node.js, de modo que los módulos del SIGD dispongan de una base técnica común, trazable y auditada.

## 2. Alcance

### Dentro de alcance
- Jerarquía de excepciones de dominio (`AppError` y subclases).
- Mapeo de errores nativos de PostgreSQL y validaciones de Zod a la respuesta RFC 7807 / RFC 9457.
- Módulo `RequestContext` con `AsyncLocalStorage` para propagar `correlation_id`, `usuario_id`, `ip_origen` y `user_agent`.
- Esquema referencial de la bitácora `sigd_audit.bitacora_auditoria` y del `evento_outbox`.

### Fuera de alcance (PENDIENTE)
- Implementación definitiva y firma técnica del responsable del Hito H1.
- Almacenamiento final y políticas de retención de la bitácora (institucional).
- Integración con el pipeline de pruebas Testcontainers (Hito H3).

> Todas las propuestas son de nivel `PROPUESTA`. Ninguna debe tratarse como `CONFIRMADO` sin aprobación.

## 3. Jerarquía de excepciones de dominio (PROPUESTA)

```ts
export type ErrorCategory =
  | "Validation" | "Authorization" | "Conflict" | "NotFound" | "Internal";

export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly title: string,
    readonly category: ErrorCategory,
    readonly detail?: string,
    readonly instance?: string,
    readonly invalidParams?: Array<{ field: string; issue: string }>,
    readonly retryable: boolean = false,
  ) {
    super(detail ?? title);
    this.name = new.target.name;
  }
}

export class DomainError extends AppError {}      // base para errores de dominio
export class ValidationError extends AppError {}
export class AuthenticationError extends AppError {}
export class NotFoundError extends AppError {}
export class ConflictError extends AppError {}
export class UnauthorizedError extends AppError {}
```

Clases concretas recomendadas para el mapeo (PROPUESTA):

| Clase | Uso de ejemplo |
| :--- | :--- |
| `ValidationError` (422) | Regla de negocio o esquema no cumplido. |
| `AuthenticationError` (401) | Credenciales ausentes/inválidas/vencidas. |
| `UnauthorizedError` (403) | Identidad reconocida sin permiso para la acción. |
| `NotFoundError` (404) | Recurso o ruta no encontrada. |
| `ConflictError` (409) | Conflicto de estado, ej. violación de unicidad. |
| `DomainError` o `AppError` (500/502/504) | Fallo interno, bad gateway o timeout. |

## 4. Mapeo de errores externos (PROPUESTA)

### 4.1. Códigos de error de PostgreSQL

| Código PG | Descripción | Estado HTTP propuesto | Categoría |
| :--- | :--- | :---: | :--- |
| `23505` | Violación de unicidad | 409 | Conflict |
| `23503` | Violación de llave foránea | 400 | Validation |
| `23502` | Violación de not null | 400 | Validation |
| `22xxx` | Error de datos | 400 | Validation |
| `P0001` | Excepción de negocio | 422 | Validation |

### 4.2. Validaciones de Zod

- Error resultante: `ValidationError` (HTTP 422).
- Se propone propagar cada problema como `invalid_params` con `{ field, issue }`.

## 5. Respuesta estandarizada RFC 7807 / RFC 9457 (PROPUESTA)

```json
{
  "type": "https://sigd.iestpsuiza.edu.pe/errors/validation",
  "title": "La solicitud no es válida",
  "status": 422,
  "detail": "El campo usuarioFicticio no puede realizar esta acción en este estado",
  "instance": "/api/v1/recursos-ficticios",
  "code": "ERR-VAL-001",
  "correlation_id": "abc-123-def-456",
  "invalid_params": [
    { "field": "usuarioFicticio", "issue": "Acción no permitida en este estado" }
  ]
}
```

- `type`: URI de la categoría de error (Relación: `02_catalogo_errores_backend.md`).
- `title`: mensaje legible, `status`: código HTTP, `detail`: detalle seguro (sin stack traces ni SQL).
- `instance`: recurso afectado, `code`: código interno estable.
- `correlation_id`: enlace de trazabilidad (snake_case en persistencia y transporte externo).
- `invalid_params`: arreglo opcional de detalles controlados.

## 6. Middleware de errores para Express 5 (PROPUESTA)

```ts
import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export function errorHandlerMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const body = toErrorResponse(err, req);
  res.status(body.status).json(body);
}

export function toErrorResponse(err: unknown, req: Request): ErrorResponse {
  const ctx = getRequestContext(); // desde AsyncLocalStorage (sección 7)

  if (err instanceof AppError) {
    return {
      type: `https://sigd.iestpsuiza.edu.pe/errors/${err.category.toLowerCase()}`,
      title: err.title,
      status: err.status,
      detail: err.detail ?? err.message,
      instance: err.instance ?? req.originalUrl,
      code: err.code,
      correlation_id: ctx?.correlationId,
      invalid_params: err.invalidParams,
    };
  }

  if (err instanceof ZodError) {
    return {
      type: "https://sigd.iestpsuiza.edu.pe/errors/validation",
      title: "La solicitud no es válida",
      status: 422,
      detail: "Los parámetros de entrada no cumplen el contrato",
      instance: req.originalUrl,
      code: "ERR-VAL-001",
      correlation_id: ctx?.correlationId,
      invalid_params: err.issues.map((i) => ({ field: String(i.path[0] ?? ""), issue: i.message })),
    };
  }

  // Códigos de error de PostgreSQL (PostgresError) → sección 4.1
  // Registrar aquí la traza interna ligada a correlation_id (sección 8)

  return {
    type: "https://sigd.iestpsuiza.edu.pe/errors/internal",
    title: "Error interno no esperado",
    status: 500,
    detail: "Ocurrió un error inesperado",
    instance: req.originalUrl,
    code: "ERR-INT-000",
    correlation_id: ctx?.correlationId,
  };
}
```

## 7. Contexto distribuido con `AsyncLocalStorage` (PROPUESTA)

### 7.1. Tipo de contexto

```ts
export interface RequestContext {
  correlationId: string;
  usuarioId?: string;
  ipOrigen?: string;
  userAgent?: string;
}
```

### 7.2. Módulo de contexto

```ts
import { AsyncLocalStorage } from "node:async_hooks";

export const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

export function runWithContext<T>(
  ctx: RequestContext,
  fn: () => T,
): T {
  return asyncLocalStorage.run(ctx, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return asyncLocalStorage.getStore();
}
```

### 7.3. Middleware de contexto

```ts
export function contextMiddleware(req, res, next) {
  const correlationId =
    (req.get("X-Correlation-ID") as string | undefined) ?? randomUUID();
  const ctx: RequestContext = {
    correlationId,
    usuarioId: (req as any).auth?.usuarioId,
    ipOrigen: req.ip,
    userAgent: req.get("user-agent"),
  };
  res.setHeader("X-Correlation-ID", correlationId);
  runWithContext(ctx, () => next());
}
```

### 7.4. Orden de aplicación (PROPUESTA)

```text
app.use(contextMiddleware);        // 1) inyecta contexto
app.use(routes...);                // 2) rutas y casos de uso
app.use(securityMiddleware);       // 3) seguridad (si aplica después)
app.use(notFoundMiddleware);       // 4) 404
app.use(errorHandlerMiddleware);   // 5) errores al final
```

## 8. Bitácora de auditoría y desacoplamiento (PROPUESTA)

### 8.1. Esquema referencial `sigd_audit.bitacora_auditoria`

> [!NOTE]
> Esquema de **referencia**. La definición DDL final pertenece a la especificación de auditoría del Hito H1.

| Columna | Tipo propuesto | Detalle |
| :--- | :--- | :--- |
| `id_auditoria` | `UUID` | PK técnica. |
| `correlation_id` | `UUID` | Vinculación forense de la operación. |
| `usuario_id` | `UUID` | Identidad del actor (FK → `sigd_auth`). |
| `esquema` | `text` | Esquema afectado. |
| `tabla` | `text` | Tabla afectada. |
| `operacion` | `text` | `INSERT`, `UPDATE`, `DELETE`, `SELECT` sensible. |
| `datos_antes` | `jsonb` | Estado anterior (mutaciones). |
| `datos_despues` | `jsonb` | Estado posterior (mutaciones). |
| `fecha_hora` | `timestamptz` | Sello de tiempo. |
| `ip_origen` | `inet` | Dirección de origen. |

### 8.2. Despacho asíncrono `sigd_audit.evento_outbox`

- Todo evento que requiera efecto secundario o notificación se inserta transaccionalmente en `evento_outbox` y se despacha por un worker, evitando acoplar la transacción a servicios externos.
- Envelope de evento conforme a `04_contratos_intermodulares_unificados.md` (sección 4.1).

## 9. Criterios de aceptación del borrador (PENDIENTE)

1. La jerarquía de errores y el middleware serializan a RFC 7807 / RFC 9457.
2. El `correlation_id` fluye de extremo a extremo sin acoplar firmas de métodos.
3. No se exponen stack traces, contraseñas, tokens ni detalles internos de BD en producción.
4. Las mutaciones alimentan la bitácora; los eventos sensibles se despachan por outbox.

## 10. Limitaciones y activación

- **Estado:** PROPUESTA / PENDIENTE. No activado.
- **Activación:** solo por decisión de la coordinación del Grupo 6 y validación del proyecto.
- **Aislamiento:** mantenido únicamente en `B_AREVALO`; sin merge ni PR hacia `main` o `B_GERIC` sin indicación previa.
- **Autoría:** documento de contingencia del equipo; no reemplaza el entregable oficial del Hito H1 ni atribuye autoría personal.

## 11. Referencias técnicas

- RFC 7807 / RFC 9457 (Problem Details for HTTP APIs): https://www.rfc-editor.org/info/rfc9457/
- `backend/docs/integracion/02_catalogo_errores_backend.md`.
- `backend/docs/integracion/04_contratos_y_decisiones_pendientes.md`.
- `backend/docs/levantamiento_de_observaciones/04_contratos_intermodulares_unificados.md`.
- `backend/docs/Plan_de_mejora_nivel_backend_SIGD.md` (secciones 2.6, 6 y 5.8).

## 12. Registro de revisiones

| Versión | Fecha | Responsable | Cambio | Estado |
| :--- | :--- | :--- | :--- | :--- |
| 0.1 | 2026-08-30 | Grupo 6 | Borrador técnico preliminar de contingencia (Middleware RFC 7807/9457 y trazabilidad AsyncLocalStorage). | **BORRADOR — PROPUESTA / PENDIENTE** |