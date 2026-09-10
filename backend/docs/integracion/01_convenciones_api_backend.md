# 01_convenciones_api_backend.md

> **Estado documental:** Documento base de coordinación preparado para la integración del backend. Su contenido permanece sujeto a revisión y validación del proyecto.

- **Estado:** BORRADOR PENDIENTE DE VALIDACIÓN DEL PROYECTO
- **Alcance:** Nomenclatura de URIs y JSON, métodos HTTP, paginación, identificadores y encabezados para el ecosistema Node.js/Express/TypeScript del SIGD.
- **Dependencias:** Revisión y aprobación del líder y los equipos afectados (Grupos 1 al 5).
- **Fecha de revisión:** 29 de agosto de 2026

## Propósito y problema que resuelve
El propósito es proponer un estándar de diseño para las APIs del backend. De aprobarse, busca resolver la inconsistencia en los contratos para que el frontend y los distintos módulos se comuniquen bajo reglas uniformes.

## Alcance y elementos fuera de alcance
**Alcance:**
- Propuestas de reglas de nombres (URI, JSON vs BD).
- Uso semántico propuesto de métodos HTTP y parámetros (paginación).
- Identificadores y encabezados sugeridos.

**Fuera de alcance:**
- Implementación de controladores, middlewares o sentencias SQL.
- Definición de tablas en TypeScript de otros grupos.

## Definiciones
- **Kebab-case:** Palabras separadas por guiones (`mi-recurso`).
- **CamelCase:** Primera letra en minúscula, siguientes con mayúscula (`miPropiedad`).
- **Snake_case:** Palabras separadas por guion bajo (`mi_columna`).

## Propuesta principal y reglas aplicables
1. **Nomenclatura [PROPUESTA]:**
   - **URIs:** `kebab-case`.
   - **JSON (API):** `camelCase` para propiedades de requests/responses.
   - **Base de Datos (PostgreSQL):** `snake_case`. Se propone que la transformación de `snake_case` a `camelCase` ocurra en el backend.
2. **Métodos HTTP [PROPUESTA]:**
   - `GET`: Lectura.
   - `POST`: Creación.
   - `PUT`/`PATCH`: Actualización total/parcial.
   - `DELETE`: Eliminación (Pendiente de validar si cada módulo optará por borrado lógico o físico).
3. **Identificadores y Valores [PENDIENTE DE VALIDACIÓN]:**
   - Se registra como PENDIENTE la elección entre usar UUID, identificadores secuenciales u otra alternativa.
   - Políticas de nulidad (Pendiente seleccionar una unificada):
     - Alternativa A: Enviar valores `null` de forma explícita.
     - Alternativa B: Omitir la propiedad de la carga útil.
4. **Fechas [PROPUESTA]:**
   - Formato estándar sugerido pendiente de validación (ej. ISO-8601).
5. **Paginación [PROPUESTA]:**
   - Uso de `page` y `limit`. Límite máximo pendiente de definición técnica.
6. **Identificador de Correlación [PROPUESTA]:**
   - Se propone que el backend acepte un identificador recibido o genere uno cuando no exista, lo propague y lo devuelva en la respuesta. Pendiente de aprobación. En JSON se nombrará como `correlationId` y en HTTP header como `X-Correlation-ID`.

## Ejemplos ficticios marcados como [EJEMPLO]
**[EJEMPLO] Petición GET Paginada:**
```http
GET /api/v1/recursos-ficticios?estado=ACTIVO&page=1&limit=50
X-Correlation-ID: 123e4567-e89b-12d3-a456-426614174000
```

## Dependencias con otros módulos
- De ser aprobado, impactaría en la exposición de rutas de todos los módulos (RutaDoc, Usuarios, etc.).

## Decisiones y Estado
| Decisión | Estado | Fuente o evidencia de la decisión |
| :--- | :--- | :--- |
| Métodos HTTP semánticos | PROPUESTA | RFC 9110 |
| Elección de identificador (UUID vs Secuencial) | PENDIENTE | Ninguna |
| Política para atributos vacíos (null vs omitir) | PENDIENTE | Ninguna |
| Estrategia de Versionado | PENDIENTE | Ninguna |

## Fuentes técnicas consultadas
- RFC 9110 (HTTP Semantics): https://www.rfc-editor.org/rfc/rfc9110.html

## Fuentes o decisiones pendientes de comprobar
- Límite máximo de paginación adecuado para la memoria de Node/Express.
- Costo de rendimiento al aplicar un mapeo global `camelCase` <-> `snake_case`.

## Criterios de aceptación

Criterios verificables derivados de las propuestas de este documento:

- Consistencia de nombres y rutas según la nomenclatura propuesta (`kebab-case` en URIs, `camelCase` en JSON, `snake_case` en BD).
- Estructura JSON uniforme en las cargas de requests y responses.
- Uso coherente de identificadores y fechas conforme a las alternativas y formatos propuestos, validados por el proyecto.
- Paginación uniforme mediante `page` y `limit` cuando corresponda.
- Propagación del identificador de correlación (`correlationId` / `X-Correlation-ID`) en las respuestas.
- Documentación explícita de excepciones y decisiones pendientes.
- Validación del proyecto antes de considerar oficiales las propuestas.
