# ESPECIFICACIÓN DEL MIDDLEWARE DE MANEJO DE ERRORES RFC 7807 / RFC 9457 Y CONTEXTO DE SOLICITUD
## Grupo 6 "CoreLink" · Integración, Calidad y Pruebas del Backend — SIGD

**Proyecto:** Sistema Integral de Gestión Documentaria (SIGD)
**Institución:** IESTP "Suiza" (Pucallpa, Ucayali, Perú) — PE DSI
**Área:** Backend — CoreLink
**Responsable del entregable:** Duque · `B_DUQUE`
**Documento:** `01_especificacion_middleware_rfc7807.md`
**Fecha:** 3 de septiembre de 2026
**Versión:** 1.2 (Fase 2 — Levantamiento de Observaciones · corrección de autoría)

> [!NOTE]
> Este documento es una **especificación de referencia**. No contiene instrucciones ejecutables ni código
> listo para correr; describe de forma completa y detallada el diseño, los contratos, las reglas y las
> decisiones que los equipos de implementación deben seguir para construir el manejo centralizado de
> errores y la trazabilidad de solicitudes del backend SIGD.

---

## 1. Propósito y Problema que Resuelve

Definir y documentar la solución técnica para el **manejo centralizado de errores**, la **trazabilidad
de las solicitudes** y la **obtención automática del contexto del usuario** dentro del backend del SIGD.

El objetivo es que **todos los módulos del backend** (IdentiCore, OrganiCore, DocuCore, TramiCore,
RutaDoc y CoreLink) respondan ante errores con un mismo mecanismo, formato y criterio, y que toda
operación quede identificada de forma única. Sin este componente, cada grupo implementaría su propio
formato de error, lo que dificultaría:

- **La depuración:** al no existir un formato común, cada error requeriría un análisis diferente.
- **La auditoría forense:** sin un identificador de correlación compartido (`correlation_id`) sería
  imposible reconstruir la cadena completa de operaciones de una solicitud.
- **La comunicación uniforme con los consumidores de la API:** los clientes (frontend, otros servicios,
  lotes externos) necesitan un contrato de error predecible para procesarlo correctamente.

### 1.1. Propuesta de valor
- Un único punto de serialización de errores a nivel de aplicación.
- Respuestas de error estandarizadas bajo RFC 7807 / RFC 9457.
- Trazabilidad de punta a punta mediante `correlation_id` (UUIDv4).
- Contexto del usuario disponible en todas las capas sin modificar firmas de métodos.
- Seguridad por diseño: nunca se exponen detalles internos en producción.

---

## 2. Alcance y Elementos Fuera de Alcance

### Dentro del alcance
- Diseño de la jerarquía de excepciones de dominio en TypeScript (contrato, no implementación).
- Especificación del middleware global de manejo de errores para Express 5.
- Mapeo determinista de errores de PostgreSQL y Zod a respuestas RFC 7807 / RFC 9457.
- Contrato de propagación de contexto (`correlation_id`, `usuario_id`, `ip_origen`, `user_agent`)
  mediante `AsyncLocalStorage`.
- Reglas de integración del contexto con la bitácora de auditoría forense
  (`sigd_audit.bitacora_auditoria`, detallada en el entregable 02).

### Fuera de alcance
- Implementación de endpoints de negocio de los demás módulos (cada módulo implementa sus propias
  reglas y reutiliza esta especificación).
- Diseño completo del esquema `sigd_audit` (entregable 02 — Reátegui).
- Diseño de la suite de pruebas de integración y carga (entregable 03 — Zevallos).
- Contratos intermodulares y matriz Productor-Consumidor (entregable 04 — Ricardo).

---

## 3. Definiciones Necesarias

| Término | Definición |
| :--- | :--- |
| **RFC 7807** | *Problem Details for HTTP APIs* — estándar IETF para describir errores HTTP de forma uniforme y legible tanto para humanos como para máquinas. |
| **RFC 9457** | Revisión actualizada y vigente del RFC 7807 (publicada en 2023). Compatible hacia atrás; los consumidores implementados bajo RFC 7807 siguen funcionando. |
| **`correlation_id`** | Identificador único (UUIDv4) que asocia todas las operaciones de una misma solicitud. Permite reconstruir la cadena completa de eventos. |
| **AsyncLocalStorage** | API de Node.js que permite propagar estado de forma asíncrona a través de toda la pila de llamadas sin pasarlo explícitamente por parámetros. |
| **Middleware** | Función de Express que intercepta y procesa las solicitudes/respuestas en la cadena HTTP. |
| **Serialización de error** | Conversión de una excepción interna en una respuesta HTTP estructurada según el formato del estándar. |
| **`invalid_params`** | Lista de campos que no cumplieron la validación, con el motivo específico de cada uno. |

---

## 4. Diseño de la Jerarquía de Excepciones de Dominio

### 4.1. Regla de diseño fundamental
> Los módulos **nunca responden errores HTTP directamente**. Toda situación de error se comunica
> **lanzando una excepción** de la jerarquía definida aquí; el middleware global es el único
> responsable de convertir esa excepción en una respuesta HTTP con formato RFC 7807 / RFC 9457.

Esto garantiza que la serialización sea uniforme, centralizada y reutilizable, y que los casos de uso
permanezcan desacoplados de la capa HTTP.

### 4.2. Clase base `AppError`

Toda excepción de negocio debe extender la clase base `AppError`, la cual define el contrato común
de atributos. Los campos que transporta son:

| Campo | Tipo | Descripción |
| :--- | :--- | :--- |
| `status` | number | Código HTTP que se devolverá en la respuesta. |
| `code` | string | Identificador interno del error, único por tipo. Se usa como valor del campo `code` de la respuesta y para construir la URI `type`. |
| `message` | string | Mensaje corto de carácter técnico para logs internos. |
| `detail` | string | Explicación específica y legible del error, dirigida al solicitante. Si no se provee, toma el valor de `message`. |
| `invalidParams` | array | Lista de objetos `{ name, reason }` que describen los campos que no pasaron la validación. Vacía por defecto. |

### 4.3. Subclases previstas y su uso

La jerarquía se mantiene **plana** (todas las subclases heredan directamente de `AppError`) y define
un código HTTP fijo por clase, para que el resultado sea predecible:

| Clase de excepción | HTTP | Uso previsto |
| :--- | :---: | :--- |
| `DomainError` | `422` | Regla de negocio incumplida (plazos vencidos, estados incompatibles, transiciones no permitidas, etc.). |
| `NotFoundError` | `404` | Recurso inexistente o no localizable (expediente, trámite, área, usuario). |
| `ConflictError` | `409` | Conflicto de estado o de unicidad a nivel de dominio (duplicados lógicos, versiones en conflicto). |
| `UnauthorizedError` | `401` | Sin autenticación, credenciales inválidas o token expirado. |
| `ValidationError` | `400` | Datos de entrada inválidos. **Requiere obligatoriamente** la lista `invalidParams`. |

### 4.4. Guía de implementación para los equipos

- **Ubicación sugerida del código:** ruta compartida como `shared/domain/errors/`, de forma que
  cualquier módulo pueda importarla sin dependencias cruzadas.
- **Convención de `code`:** usar *UPPER_SNAKE_CASE* descriptivo (p. ej. `DOCUMENTO_DUPLICADO`,
  `EXPEDIENTE_NO_ENCONTRADO`, `TRAMITE_NO_DERIVABLE`). Debe ser único y estable.
- **Jerarquía plana:** solo se crean nuevas subclases si representan un código HTTP distinto o un
  caso de uso muy específico; de lo contrario, usar `DomainError` con distintos `code`.
- **Persistencia de `name`:** cada clase debe asignar su nombre en la propiedad `name` del error
  para facilitar el diagnóstico en logs.
- **Cero lógica HTTP en los módulos:** los módulos lanzan excepciones; no construyen respuestas.

---

## 5. Formato de Respuesta de Error RFC 7807 / RFC 9457

Todo error serializado por el middleware debe contener **exclusivamente** los siguientes campos.
Este formato es el contrato público del SIGD para respuestas de error.

| Campo | Tipo | Descripción | Regla |
| :--- | :--- | :--- | :--- |
| `type` | string | URI que identifica el tipo de problema. | Construida como `https://sigd.iestpsuiza.edu.pe/errors/{code en minúsculas}`. |
| `title` | string | Resumen legible del tipo de problema. | Frase corta y estable (p. ej. "Conflict", "Validation Error"). |
| `status` | number | Código HTTP del error. | Debe coincidir con el código HTTP real de la respuesta. |
| `detail` | string | Explicación específica del error para el solicitante. | Texto accionable; nunca incluye rastros ni datos internos. |
| `instance` | string | Ruta del endpoint donde ocurrió el error. | Corresponde a la URL original de la solicitud. |
| `code` | string | Código interno de negocio, único por tipo de error. | Ver convención en la sección 4.4. |
| `correlation_id` | string | UUIDv4 que identifica la solicitud completa. | Tomado del contexto de la solicitud. |
| `invalid_params` | array | Detalle de campos que no cumplieron la validación. | Cada elemento es `{ name, reason }`. Vacío cuando no aplica. |

### 5.1. Reglas adicionales
- **Único emisor:** la respuesta RFC 7807 solo la genera el middleware global; los módulos no deben
  fabricarla manualmente.
- `invalid_params` siempre debe estar presente en el JSON, aunque sea vacío (contrato estable).
- El campo `correlation_id` de la respuesta debe coincidir con el header `x-correlation-id` enviado
  en la misma respuesta HTTP, para que el consumidor pueda correlacionar sin abrir el cuerpo.

---

## 6. Matriz de Mapeo Determinista de Errores

Se establece una traducción explícita y documentada de los errores nativos a respuestas estándar,
para que el comportamiento sea **igual en todos los módulos** y no dependa de criterios particulares.

| Origen | Código / Condición | Código HTTP | `code` interno sugerido | Observación |
| :--- | :--- | :---: | :--- | :--- |
| PostgreSQL | `23505` — violación de unicidad | **409** | `DUPLICATE_KEY` | El mensaje interno no se expone; se informa de forma genérica. |
| PostgreSQL | `23503` — violación de llave foránea | **400** | `FOREIGN_KEY_VIOLATION` | Indica que el recurso referenciado no es válido. |
| PostgreSQL | `23502` — violación de `NOT NULL` | **400** | `NOT_NULL_VIOLATION` | Campo obligatorio ausente a nivel de BD. |
| PostgreSQL | `P0001` — excepción de negocio (`RAISE`) | **422** | `DOMAIN_RULE` | Regla de negocio evaluada en la BD. |
| PostgreSQL | Otros errores internos | **500** | `INTERNAL_ERROR` | Respuesta genérica; detalle solo a logs. |
| Zod | Error de validación de esquema | **400** | `VALIDATION_ERROR` | Se mapean los `issues` de Zod a `invalid_params`. |
| Dominio | Regla de negocio incumplida | **422** | Código del dominio | Lanzado por los casos de uso con la jerarquía de la sección 4. |
| No encontrado | Recurso inexistente | **404** | `NOT_FOUND` | Aplicable a cualquier recurso de negocio. |
| Autenticación | Credenciales inválidas / token expirado | **401** | `UNAUTHORIZED` | Nunca distingue si falló el usuario o la contraseña. |
| Autorización | Sin permiso sobre el recurso | **403** | `FORBIDDEN` | El usuario está autenticado pero no tiene privilegio. |

### 6.1. Notas de diseño del mapeo
- Los mensajes del estándar de la matriz son **genéricos y seguros**: no filtran el texto del motor
  de BD, rutas internas ni datos sensibles.
- La matriz debe mantenerse en un solo lugar y ser la referencia única; cualquier error nuevo debe
  primero documentarse aquí y luego implementarse.

---

## 7. Especificación del Middleware Global de Manejo de Errores

### 7.1. Ubicación y orden de registro
- Se registra **después de todas las rutas** de la aplicación, como el último eslabón de la cadena.
- Destinado expressamente a **Express 5**, que propaga automáticamente a este middleware los errores
  lanzados en handlers asíncronos (no es necesario un wrapper adicional por ruta).
- Su firma es obligatoria de **cuatro argumentos** `(error, req, res, next)`; omitir el primer
  parámetro rompería la detección de Express como manejador de errores.

### 7.2. Comportamiento esperado (contrato)

1. **Leer el contexto de la solicitud** para obtener el `correlation_id`. Si el contexto no existe
   (procesos aislados), el middleware debe tolerarlo y continuar sin romper la serialización.
2. **Clasificar el error** según el siguiente orden de prioridad:
   a. Es instancia de la jerarquía `AppError` → se usan directamente `status`, `code`, `detail` e
      `invalidParams` que transporta la excepción.
   b. Es un error de validación de Zod → respuesta `400 VALIDATION_ERROR`. Cada `issue` de Zod se
      convierte en un elemento `invalid_params`: el *path* del campo (unido con puntos) como `name`,
      y el mensaje del issue como `reason`.
   c. Es un error de PostgreSQL que trae un código nativo presente en la matriz (sección 6) → se
      aplica la regla de la matriz con un `detail` genérico.
   d. Cualquier otro error → `500 INTERNAL_ERROR` con mensaje genérico de servidor.
3. **Tratamiento de errores 5xx:** se registra en consola/logger la pila completa junto con el
   `correlation_id` para diagnóstico interno. **Esta información jamás viaja en la respuesta.**
4. **Serializar la respuesta** con el payload del estándar (sección 5) y el código HTTP calculado.

### 7.3. Tabla de decisión resumida

| Condición detectada | `status` | `code` | `detail` |
| :--- | :---: | :--- | :--- |
| Instancia de `AppError` | El de la excepción | El de la excepción | El de la excepción |
| `ZodError` | `400` | `VALIDATION_ERROR` | "Los datos enviados no son válidos." |
| PostgreSQL mapeado | Según matriz | Según matriz | Genérico, seguro |
| Cualquier otro error | `500` | `INTERNAL_ERROR` | "Ocurrió un error interno en el servidor." |

### 7.4. Reglas de seguridad obligatorias

- **Nunca** exponer en producción: *stack traces*, contraseñas, tokens, datos personales, rutas
  internas de archivos ni mensajes internos de PostgreSQL.
- El `detail` producido a partir de errores de BD es siempre genérico, salvo que un mapeo explícito
  defina otra cosa.
- Los valores de `usuario_id`, IP y `user_agent` no se incluyen en la respuesta de error (solo en la
  bitácora de auditoría interna).
- En entornos de desarrollo se permite loguear más detalle; en producción solo a través del logger
  con el `correlation_id` como llave.

---

## 8. Contrato del Contexto de Solicitud con AsyncLocalStorage

### 8.1. Qué datos transporta el contexto

| Campo | Tipo | Descripción |
| :--- | :--- | :--- |
| `correlation_id` | string (UUIDv4) | Identificador único de la solicitud. |
| `usuario_id` | string \| null | Identidad del usuario autenticado, si existe. |
| `ip_origen` | string | Dirección IP del cliente que originó la solicitud. |
| `user_agent` | string | Cadena del navegador/cliente que originó la solicitud. |

### 8.2. Contrato funcional del contexto

- **Creación por solicitud:** antes de que la cadena de handlers procese la petición, un middleware
  de contexto crea el almacén y ejecuta `next()` dentro de él. Cada solicitud tiene su propio almacén,
  aislado de las demás (no son variables globales).
- **Propagación automática:** cualquier capa (caso de uso, servicio, repositorio) lee el contexto con
  `getStore()` **sin recibir estos datos por parámetros**. Las firmas de los métodos de negocio se
  mantienen limpias.
- **Correlación hacia el cliente:** el `correlation_id` se acepta de entrada si el cliente ya lo
  envía en el header `x-correlation-id` (para encadenar con sistemas externos); si no, se genera uno
  nuevo (UUIDv4). En ambos casos, la respuesta devuelve el header `x-correlation-id` con el valor
  efectivamente usado, para que el consumidor pueda correlacionar respuestas y errores.
- **Identidad del usuario:** la autenticación se puede completar después de que el contexto se cree.
  Para que la auditoría capture la identidad real, el flujo recomendado es: (1) el middleware de
  contexto genera el `correlation_id`; (2) el middleware de autenticación valida el token y deja el
  `usuario_id` disponible en la solicitud; (3) el `usuario_id` debe quedar incorporado al almacén del
  contexto antes de que los casos de uso auditen, de forma que `getStore()` siempre refleje la
  identidad vigente. Si no hay autenticación, `usuario_id` se conserva como `null`.
- **Lectura desde la respuesta de error:** el middleware de errores usa el mismo contexto para poblar
  el `correlation_id` de la respuesta RFC 7807.

### 8.3. Ciclo de vida del contexto

1. Llega la solicitud HTTP al middleware de contexto.
2. Se obtiene o se genera el `correlation_id` (UUIDv4).
3. Se crea el almacén con `correlation_id`, `ip_origen`, `user_agent` y `usuario_id` (inicialmente
   `null` o fijado por el flujo de autenticación).
4. Se ejecuta el resto de la cadena (rutas, casos de uso, repositorios) dentro de ese almacén.
5. Al finalizar la respuesta, el almacén queda descartado; la siguiente solicitud crea uno nuevo.

### 8.4. Consumo transparente (ejemplo documental)

Cuando un caso de uso o repositorio necesita auditar una mutación o registrar un evento, **lee** el
contexto y lo proporciona a la bitácora. A modo de ilustración, el objeto que recibe el repositorio
de auditoría contiene estos valores (ya descritos en la sección 8.1):

```json
{
  "correlation_id": "8f4c2a10-7b21-4d55-8f2a-1c9d3e7b5a01",
  "usuario_id": "3a1b2c3d-0000-0000-0000-000000000001",
  "ip_origen": "190.42.1.13",
  "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
}
```

El detalle del esquema de la bitácora y del worker de outbox se encuentra en el entregable 02.

### 8.5. Reglas de implementación para los equipos

- **Generar siempre UUIDv4** como `correlation_id`; no usar fechas, secuencias ni correlativos.
- **No almacenar el contexto en variables globales** ni en el ámbito de módulo: usar exclusivamente
  `AsyncLocalStorage` para respetar el aislamiento entre solicitudes concurrentes.
- **Tolerancia en contextos sin HTTP:** en procesos programados o workers, `getStore()` puede devolver
  `undefined`; todo consumidor debe manejarlo (p. ej. decisiones de auditoría distintas, o un contexto
  de sistema).
- **Una sola instancia del almacén** por aplicación Node, compartida entre módulos a través de la
  carpeta `shared`.

---

## 9. Ejemplos de Respuestas JSON (Documentación)

Ejemplos ilustrativos del formato final que los consumidores de la API recibirán. No son código
ejecutable; son el resultado esperado del contrato.

### 9.1. Registro duplicado en PostgreSQL (`23505` → `409 DUPLICATE_KEY`)

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

### 9.2. Validación de entrada fallida (`400 VALIDATION_ERROR`)

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
```

> 💡 **Uso de estos ejemplos:** sirven como referencia para redactar pruebas manuales, documentar la
> API y acordar el contrato con los consumidores (frontend, servicios externos). Si un módulo requiere
> otro `code`, se propone primero en la matriz de la sección 6.

---

## 10. Criterios de Aceptación de la Especificación

| # | Criterio | Cumple |
| :---: | :--- | :---: |
| 1 | La jerarquía de errores y el middleware contemplan excepciones de PostgreSQL y Zod y las serializan a **RFC 7807 / RFC 9457**. | ✅ |
| 2 | El diseño de `AsyncLocalStorage` permite propagar `correlation_id` e identidad de usuario sin acoplar parámetros en las firmas. | ✅ |
| 3 | No se exponen *stack traces*, contraseñas, tokens ni información interna de PostgreSQL en producción. | ✅ |
| 4 | Cada solicitud puede ser identificada mediante un `correlation_id` (UUIDv4), reflejado también en el header `x-correlation-id`. | ✅ |
| 5 | El formato de respuesta define los ocho campos del estándar con reglas claras para cada uno. | ✅ |
| 6 | La documentación queda lista para que los equipos continúen con la implementación e integración. | ✅ |

---

## 11. Guía de Avance para los Equipos (Lista de Verificación)

Para que los demás grupos avancen de forma consistente, se recomienda ejecutar estas tareas en orden:

1. [ ] **Crear la jerarquía de errores** en `shared/domain/errors/` siguiendo la sección 4.
2. [ ] **Crear el módulo de contexto** (`request-context`) siguiendo la sección 8 (una sola instancia).
3. [ ] **Crear el middleware de contexto** y registrarlo como el primero de la cadena HTTP.
4. [ ] **Crear el middleware de manejo de errores** y registrarlo después de todas las rutas.
5. [ ] **Implementar la matriz de mapeo** de la sección 6 en un único lugar reutilizable.
6. [ ] **Ajustar el flujo de autenticación** para que el `usuario_id` quede disponible en el contexto.
7. [ ] **Verificar la seguridad** (no exponer rastros ni datos internos) en cada módulo.
8. [ ] **Documentar los códigos de error nuevos** en la matriz antes de implementarlos.
9. [ ] **Pasar a validación** con los casos E2E del entregable 03 (Zevallos).

---

## 12. Dependencias y Decisiones

- **Dependencia (Reátegui):** el esquema completo `sigd_audit.bitacora_auditoria` y el worker
  `sigd_audit.evento_outbox` se documentan en `02_arquitectura_auditoria_contexto_asynclocalstorage.md`.
  Este documento consume el contexto definido aquí.
- **Dependencia (Zevallos):** la validación de esta especificación mediante pruebas de integración y de
  carga se documenta en `03_suite_pruebas_testcontainers_k6.md` (casos E2E-02, 03, 04, 08, 09 y 10).
- **Decisiones registradas:**
  - Se adopta **RFC 9457** (vigente) manteniendo compatibilidad con RFC 7807.
  - Los códigos internos son una convención del proyecto (**`PROPUESTO`**) y pueden ajustarse siempre
    que se actualice esta matriz.
  - El `correlation_id` es la llave maestra de trazabilidad; no se permite que un módulo lo reemplace.
- **Taxonomía:** `CONFIRMADO` — requisitos del estándar RFC 7807/9457; `PROPUESTO` — códigos internos
  y tamaños de columna de ejemplo; `EJEMPLO` — payloads de respuesta mostrados.

---

*Documento elaborado por Duque (`B_DUQUE`) como entregable de Fase 2 — Levantamiento de
Observaciones del Grupo 6 CoreLink. Revisión 1.1: convertido a especificación de documentación pura,
sin código ejecutable, para guiar a los equipos de implementación.
Corrección de autoría (Revisión 1.2): la titularidad del entregable 01 se atribuye a Duque; ver
`07_evidencia_autorias_y_aprobaciones.md` §1.*