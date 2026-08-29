# 03_plan_pruebas_integracion.md

- **Responsable previsto:** B_ZEBALLOS
- **Rama prevista:** B_ZEBALLOS
- **Estado:** BORRADOR PENDIENTE DE REVISIÓN DEL RESPONSABLE
- **Alcance:** Estrategia propuesta de pruebas inter-módulos, matriz de casos y criterios de severidad.
- **Dependencias:** Revisión y aprobación del líder y los equipos afectados.
- **Fecha de revisión:** 29 de agosto de 2026

## Propósito y problema que resuelve
Sugerir un estándar formal para probar los contratos entre módulos. De aprobarse, busca detectar incompatibilidades y reducir riesgos de fallas al integrar el ecosistema.

## Alcance y elementos fuera de alcance
**Alcance:** 
- Criterios propuestos de severidad de defectos.
- Matriz unificada de Casos de Prueba ficticios.

**Fuera de alcance:** 
- Escribir código de pruebas ejecutables.
- Simular flujos internos que no dependan de otros módulos.

## Definiciones
- **Resiliencia:** Capacidad del sistema para tolerar latencia o caídas temporales de servicios externos sin degradar toda la aplicación.

## Propuesta principal y reglas aplicables
1. **Herramienta y Datos [PROPUESTA]:**
   - Herramienta de pruebas pendiente de decisión.
   - Se recomienda como regla de seguridad no utilizar datos personales reales en los casos, apoyándose en cambio en datos ficticios controlados.
2. **Matriz de Severidad de Defectos [PROPUESTA]:**
   - **CRÍTICA:** El flujo está totalmente roto o hay error 500/Timeout sin recuperación. Criterio de cierre: Corrección inmediata bloqueante.
   - **ALTA:** El flujo principal está bloqueado, pero existen alternativas. Criterio de cierre: Corrección antes del pase a producción.
   - **MEDIA:** Fallo de validación que se maneja mal, pero no detiene la operación. Criterio de cierre: Corrección programada.
   - **BAJA:** Error cosmético, de convenciones o formato. Criterio de cierre: Backlog de mejoras.
3. **Idempotencia [PROPUESTA]:**
   - La idempotencia solo se probará en operaciones cuyo contrato la defina, posiblemente mediante una clave de idempotencia. El mecanismo permanece PENDIENTE.
4. **Criterios de Entrada y Salida [PROPUESTA]:**
   - **Entrada:** Contratos debidamente documentados y aceptados.
   - **Salida:** Resolución de defectos calificados como CRÍTICA o ALTA.

## Ejemplos ficticios marcados como [EJEMPLO]
**[EJEMPLO] Casos de Prueba (Evidencias sugeridas: Respuesta JSON obtenida, Código HTTP, `correlationId` y log interno; captura de pantalla opcional):**

| ID | Módulo Prod. | Módulo Cons. | Precondición | Datos ficticios | Resultado esperado | Severidad | Estado |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `TC-INT-01` | M-Expediente | M-RutaDoc | El expediente con ID "E-100" existe. | Petición GET válida | Contrato correcto (200 OK) con payload `{"id": "E-100"}` | CRÍTICA | PROPUESTA |
| `TC-INT-02` | M-Expediente | M-RutaDoc | No aplicable. | JSON con `{"id": ""}` | Validación (400 Bad Request) | MEDIA | PROPUESTA |
| `TC-INT-03` | M-Permisos | M-RutaDoc | El usuario carece de token activo. | Petición sin Header Auth | Autenticación/Autorización (401/403) | ALTA | PROPUESTA |
| `TC-INT-04` | M-Usuarios | M-RutaDoc | El usuario "U-999" fue eliminado. | Petición GET a "U-999" | Ref. externa inexistente (404 Not Found) | MEDIA | PROPUESTA |
| `TC-INT-05` | M-Documento | M-RutaDoc | M-Documento está configurado para simular latencia de 10s. | Petición de descarga | Timeout o reintento (504 Gateway Timeout) | CRÍTICA | PROPUESTA |

## Dependencias con otros módulos
- Las pruebas dependen de que los módulos dispongan de mecanismos para simular (mock) los contratos.

## Decisiones y Estado
| Decisión | Estado | Fuente o evidencia de la decisión |
| :--- | :--- | :--- |
| Criterios de entrada y salida | PROPUESTA | Ninguna |
| Herramienta oficial de integración | PENDIENTE | Ninguna |
| Obligatoriedad de probar Idempotencia | PENDIENTE | Ninguna |

## Fuentes técnicas consultadas
- (Ninguna externa aplicable en este documento por el momento).

## Fuentes o decisiones pendientes de comprobar
- Disponibilidad de bibliotecas para simular respuestas HTTP (ej. nock en Node.js).
