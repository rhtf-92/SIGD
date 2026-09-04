# ESPECIFICACIÓN DEL MIDDLEWARE RFC 7807 / RFC 9457 Y ASYNCLOCALSTORAGE
## Grupo 6 "CoreLink" · Integración, Calidad y Pruebas del Backend — SIGD

**Proyecto:** Sistema Integral de Gestión Documentaria (SIGD)
**Institución:** IESTP "Suiza" (Pucallpa, Ucayali, Perú) — PE DSI
**Área:** Backend — CoreLink
**Responsable del entregable:** Azareño · `B_AZAREÑO`
**Documento:** `01_especificacion_middleware_rfc7807.md`
**Fecha:** 3 de septiembre de 2026
**Versión:** 1.0 (Fase 2 — Levantamiento de Observaciones)

---

## 1. Propósito y Problema que Resuelve

Definir y documentar la solución técnica para el **manejo centralizado de errores**, la **trazabilidad de las solicitudes** y la **obtención automática del contexto del usuario** dentro del backend del SIGD.

El objetivo es que **todos los módulos del backend** utilicen un mismo mecanismo para responder ante errores y registrar información de las operaciones realizadas, evitando implementaciones diferentes y divergentes en cada módulo. Sin este componente, cada grupo implementaría su propio formato de error, dificultando la depuración, la auditoría forense y la comunicación uniforme con los consumidores de la API.

---

## 2. Alcance y Elementos Fuera de Alcance

### Dentro del alcance
- Jerarquía de excepciones de dominio en TypeScript.
- Middleware global de manejo de errores para Express 5.
- Mapeo determinista de errores de PostgreSQL y Zod a respuestas RFC 7807 / RFC 9457.
- Propagación de contexto (`correlation_id`, `usuario_id`, `ip_origen`, `user_agent`) mediante `AsyncLocalStorage`.
- Integración con la bitácora de auditoría forense (`sigd_audit.bitacora_auditoria`).

### Fuera de alcance
- Implementación de endpoints de negocio de los otros módulos.
- Diseño completo del esquema `sigd_audit` (es parte del entregable 02 de Reátegui).
- Pruebas de integración con Testcontainers (entregable 03 de Zevallos).

---

## 3. Definiciones Necesarias

| Término | Definición |
| :--- | :--- |
| **RFC 7807** | *Problem Details for HTTP APIs* — estándar IETF para describir errores HTTP de forma uniforme. |
| **RFC 9457** | Revisión actualizada del RFC 7807. Compatible y vigente (2023). |
| **`correlation_id`** | Identificador único (UUIDv4) que asocia todas las operaciones de una misma solicitud. |
| **AsyncLocalStorage** | API de Node.js que permite propagar estado de forma asíncrona a través de toda la pila de llamadas sin pasarlo por parámetros. |
| **Middleware** | Función de Express que intercepta y procesa las solicitudes/respuestas en la cadena HTTP. |

---

## 4. Jerarquía de Excepciones de Dominio en TypeScript

Se establece una jerarquía base sobre la cual todos los módulos lanzan sus excepciones de negocio, manteniendo un contrato común.

```typescript

export type ErrorCode = string;

export class AppError extends Error {
    public readonly status: number;
    public readonly code: ErrorCode;
    public readonly detail: string;
    public readonly invalidParams: Array<{ name: string; reason: string }> = [];

    constructor(options: {
        status: number;
        code: ErrorCode;
        message: string;
        detail?: string;
        invalidParams?: Array<{ name: string; reason: string }>;
    }) {
        super(options.message);
        this.name = "AppError";
        this.status = options.status;
        this.code = options.code;
        this.detail = options.detail ?? options.message;
        this.invalidParams = options.invalidParams ?? [];
    }
}

export class DomainError extends AppError {
    constructor(code: string, message: string, detail?: string) {
        super({ status: 422, code, message, detail });
        this.name = "DomainError";
    }
}

export class NotFoundError extends AppError {
    constructor(code: string, message: string, detail?: string) {
        super({ status: 404, code, message, detail });
        this.name = "NotFoundError";
    }
}

export class ConflictError extends AppError {
    constructor(code: string, message: string, detail?: string) {
        super({ status: 409, code, message, detail });
        this.name = "ConflictError";
    }
}

export class UnauthorizedError extends AppError {
    constructor(code: string, message: string, detail?: string) {
        super({ status: 401, code, message, detail });
        this.name = "UnauthorizedError";
    }
}

export class ValidationError extends AppError {
    constructor(code: string, message: string, detail: string, invalidParams: Array<{ name: string; reason: string }>) {
        super({ status: 400, code, message, detail, invalidParams });
        this.name = "ValidationError";
    }
}
```

### Criterio de uso
Los módulos no deben responder errores HTTP directamente; deben **lanzar** `AppError` (o sus subclases) y dejar que el middleware global los serialice.

---

## 5. Matriz de Mapeo Determinista de Errores PostgreSQL y Zod a Códigos HTTP

Se establece una traducción explícita de los errores nativos a respuestas estándar, para que el comportamiento sea **predecible en todos los módulos**.

| Origen | Código / Condición | Código HTTP | `code` interno sugerido |
| :--- | :--- | :---: | :--- |
| PostgreSQL | `23505` — violación de unicidad | **409** | `DUPLICATE_KEY` |
| PostgreSQL | `23503` — violación de llave foránea | **400** | `FOREIGN_KEY_VIOLATION` |
| PostgreSQL | `23502` — violación de `NOT NULL` | **400** | `NOT_NULL_VIOLATION` |
| PostgreSQL | `P0001` — excepción de negocio (RAISE) | **422** | `DOMAIN_RULE` |
| PostgreSQL | Otros errores internos | **500** | `INTERNAL_ERROR` |
| Zod | Error de validación de esquema | **400** | `VALIDATION_ERROR` |
| Dominio | Regla de negocio incumplida | **422** | código del dominio |
| No encontrado | Recurso inexistente | **404** | `NOT_FOUND` |
| Autenticación | Credenciales inválidas / token expirado | **401** | `UNAUTHORIZED` |
| Autorización | Sin permiso sobre el recurso | **403** | `FORBIDDEN` |

---

## 6. Formato de Respuesta de Error RFC 7807 / RFC 9457

Todo error serializado por el middleware debe contener los siguientes campos:

| Campo | Tipo | Descripción |
| :--- | :--- | :--- |
| `type` | string | URI que identifica el tipo de problema. |
| `title` | string | Resumen legible del tipo de problema. |
| `status` | number | Código HTTP del error. |
| `detail` | string | Explicación específica del error para el solicitante. |
| `instance` | string | Ruta del endpoint donde ocurrió el error. |
| `code` | string | Código interno de negocio (único por tipo de error). |
| `correlation_id` | string | UUIDv4 que identifica la solicitud completa. |
| `invalid_params` | array | Detalle de campos que no cumplieron la validación. |

---

## 7. Middleware Global de Manejo de Errores (Express 5)

El middleware se registra **después** de todas las rutas y captura cualquier excepción síncrona o asíncrona, traduciéndola al formato RFC 7807/9457.

```typescript

import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../domain/errors/app-error";
import { getRequestContext } from "../infrastructure/request-context";

const POSTGRES_MAP: Record<string, { status: number; code: string }> = {
    "23505": { status: 409,  code: "DUPLICATE_KEY" },
    "23503": { status: 400,  code: "FOREIGN_KEY_VIOLATION" },
    "23502": { status: 400,  code: "NOT_NULL_VIOLATION" },
    "P0001": { status: 422,  code: "DOMAIN_RULE" },
};

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
    const ctx = getRequestContext();
    const correlationId = ctx?.correlation_id;

    let status = 500;
    let code = "INTERNAL_ERROR";
    let detail = "Ocurrió un error interno en el servidor.";
    let invalidParams: Array<{ name: string; reason: string }> = [];

    if (err instanceof AppError) {
        status = err.status;
        code = err.code;
        detail = err.detail;
        invalidParams = err.invalidParams;
    } else if (err instanceof ZodError) {
        status = 400;
        code = "VALIDATION_ERROR";
        detail = "Los datos enviados no son válidos.";
        invalidParams = err.issues.map((issue) => ({
            name: issue.path.join("."),
            reason: issue.message,
        }));
    } else if (err instanceof Error && (err as any).code && POSTGRES_MAP[(err as any).code]) {
        const map = POSTGRES_MAP[(err as any).code];
        status = map.status;
        code = map.code;
        detail = "La operación no pudo completarse por una restricción de base de datos.";
    }

    if (status >= 500) {
        
        console.error("[ERROR]", correlationId, err);
    }

    res.status(status).json({
        type: `https://sigd.iestpsuiza.edu.pe/errors/${code.toLowerCase()}`,
        title: getTitle(status),
        status,
        detail,
        instance: req.originalUrl,
        code,
        correlation_id: correlationId,
        invalid_params: invalidParams,
    });
}
```

> [!IMPORTANT]
> **Seguridad:** Nunca se exponen *Stack Traces*, contraseñas, tokens, datos personales, rutas internas ni detalles internos de PostgreSQL en producción.

---

## 8. RequestContext con AsyncLocalStorage

Se emplea `AsyncLocalStorage` de Node.js para propagar el contexto de cada solicitud a través de **todas las capas** (casos de uso, servicios y repositorios) sin ensuciar las firmas de los métodos.

```typescript

import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestContextData {
    correlation_id: string;
    usuario_id: string | null;
    ip_origen: string;
    user_agent: string;
}

export const requestContext = new AsyncLocalStorage<RequestContextData>();

export function runWithContext<T>(data: RequestContextData, fn: () => T): T {
    return requestContext.run(data, fn);
}

export function getRequestContext(): RequestContextData | undefined {
    return requestContext.getStore();
}
```

### Middleware que inicializa el contexto por solicitud

```typescript

import { randomUUID } from "node:crypto";
import { Request, Response, NextFunction } from "express";
import { runWithContext } from "../infrastructure/request-context";

export function contextMiddleware(req: Request, res: Response, next: NextFunction): void {
    const correlationId = (req.header("x-correlation-id") as string) ?? randomUUID();
    res.setHeader("x-correlation-id", correlationId);

    runWithContext(
        {
            correlation_id: correlationId,
            usuario_id: (req as any).usuario_id ?? null,
            ip_origen: req.ip,
            user_agent: req.header("user-agent") ?? "",
        },
        () => next(),
    );
}
```

### Cómo alimenta la bitácora de auditoría
El `RequestContext` proporciona `correlation_id`, `usuario_id`, `ip_origen` y `user_agent` de forma transparente a cualquier repositorio, permitiendo que los *Use Cases* registren mutaciones en `sigd_audit.bitacora_auditoria` **sin pasar estos datos por cada parámetro**. El esquema y el flujo completo de auditoría y el worker de outbox se detallan en el entregable 02 (Reátegui).

---

## 9. Ejemplos de Respuestas JSON

### 9.1 Ante un registro duplicado en PostgreSQL (`23505` → 409)

```json
{
  "type": "https://sigd.iestpsuiza.edu.pe/errors/duplicate_key",
  "title": "Conflict",
  "status": 409,
  "detail": "El documento ya se encuentra registrado.",
  "instance": "/api/documentos",
  "code": "DUPLICATE_KEY",
  "correlation_id": "8f4c2a10-7b21-4d55-8f2a-1c9d3e7b5a01",
  "invalid_params": []
}
```

### 9.2 Ante una validación de Zod (`400`)

```json
{
  "type": "https://sigd.iestpsuiza.edu.pe/errors/validation_error",
  "title": "Validation Error",
  "status": 400,
  "detail": "Los datos enviados no son válidos.",
  "instance": "/api/documentos",
  "code": "VALIDATION_ERROR",
  "correlation_id": "8f4c2a10-7b21-4d55-8f2a-1c9d3e7b5a01",
  "invalid_params": [
    { "name": "numero_documento", "reason": "El campo es obligatorio." },
    { "name": "correo", "reason": "Formato de correo inválido." }
  ]
}



