# 02_catalogo_errores_backend.md

- **Responsable previsto:** B_REATEGUI
- **Rama prevista:** B_REATEGUI
- **Estado:** BORRADOR PENDIENTE DE REVISIÓN DEL RESPONSABLE
- **Alcance:** Formato propuesto unificado de respuesta de error, taxonomía de códigos y seguridad de mensajes.
- **Dependencias:** Revisión y aprobación del líder y los equipos afectados; coordinación con Frontend.
- **Fecha de revisión:** 29 de agosto de 2026

## Propósito y problema que resuelve
Plantear un formato estandarizado para reportar errores en las APIs de Express, con el objetivo de facilitar la lectura por el frontend y sugerir pautas para evitar fugas de información sensible.

## Alcance y elementos fuera de alcance
**Alcance:** 
- Taxonomía conceptual de códigos HTTP.
- Estructura JSON unificada propuesta.
- Registro interno (`correlationId`).

**Fuera de alcance:** 
- Implementar código ejecutable del middleware de errores en Express (solo se aborda a nivel conceptual).

## Definiciones
- **Fuga de información:** Riesgo de seguridad donde mensajes del sistema exponen arquitecturas internas.

## Propuesta principal y reglas aplicables
1. **Códigos HTTP [PROPUESTA]:**
   - `400`: Error de sintaxis o esquema de datos enviado.
   - `401`: No autenticado (credenciales ausentes, inválidas o vencidas).
   - `403`: No autorizado (identidad reconocida, pero sin permisos para la acción).
   - `404`: Recurso o ruta no encontrada.
   - `409`: Conflicto de estado (ej. validación contra registros existentes).
   - `422`: Regla de negocio o semántica no cumplida.
   - `500`: Error interno inesperado (se sugiere devolver mensaje genérico).
   - `502`: Bad Gateway (el módulo recibió respuesta inválida de un tercero).
   - `504`: Gateway Timeout (el módulo no recibió respuesta a tiempo).
2. **Estructura JSON de Error Única [PROPUESTA]:**
   - `code`: Código alfanumérico interno.
   - `message`: Mensaje descriptivo.
   - `category`: Clasificación del error (ej. Validation, Authorization).
   - `details`: Arreglo opcional con detalles específicos.
   - `retryable`: Booleano para indicar si se puede reintentar.
   - `correlationId`: Para trazar el error interno.
3. **Seguridad y Trazabilidad [PROPUESTA]:**
   - Se recomienda como regla de seguridad no utilizar datos personales reales en ambientes de prueba, ni exponer stack traces o SQL en producción. Las trazas técnicas deberían registrarse internamente ligadas al `correlationId`.
4. **Comparativa con Estándares [PENDIENTE DE VALIDACIÓN]:**
   - Queda pendiente validar si el SIGD adoptará el estándar oficial `RFC 9457 (Problem Details)` o si se empleará la estructura personalizada propuesta en el punto 2.

## Ejemplos ficticios marcados como [EJEMPLO]
**[EJEMPLO] Estructura Personalizada de Error de Campo (422 Unprocessable Entity):**
```json
{
  "code": "ERR-VAL-001",
  "message": "Validación de negocio fallida",
  "category": "Validation",
  "details": [
    {
      "field": "usuarioFicticio",
      "issue": "El usuario no puede realizar esta acción en este estado"
    }
  ],
  "retryable": false,
  "correlationId": "abc-123-def-456"
}
```

## Dependencias con otros módulos
- Pendiente de coordinar si el equipo de Frontend utilizará este formato exacto para mostrar mensajes o alertas en pantalla.

## Decisiones y Estado
| Decisión | Estado | Fuente o evidencia de la decisión |
| :--- | :--- | :--- |
| Taxonomía de códigos HTTP | PROPUESTA | RFC 9110 |
| Estructura JSON personalizada vs RFC 9457 | PENDIENTE | Ninguna |
| Inclusión del campo `retryable` | PROPUESTA | Ninguna |

## Fuentes técnicas consultadas
- RFC 9457 (Problem Details for HTTP APIs): https://www.rfc-editor.org/info/rfc9457/
- Express 5 Error Handling: https://expressjs.com/en/5x/guide/error-handling/
- OWASP API Security: https://owasp.org/www-project-api-security/

## Fuentes o decisiones pendientes de comprobar
- Viabilidad de que el frontend estandarice la lectura del arreglo `details` y del campo `retryable`.
