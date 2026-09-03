---
Autora: Liz / responsable de B_JACOBO
Entregable: H1
Estado: Borrador pendiente de revisión incremental final por Geric
Fase: 2
Versión documental: 4.0
Commit base de revisión: 9fe0735 (y revisión incremental sobre f78041e)
Rama: B_JACOBO
---
> Este documento constituye un entregable documental en revisión. No representa aprobación institucional, contrato intermodular definitivo ni implementación técnica.

# H1 — Documentación de reglas de dominio y eventos Outbox (RutaDoc)

## 1. Objetivo y alcance del análisis v2
El presente documento (Hito H1) establece el diseño conceptual para la reingeniería v2 del submódulo RutaDoc, limitándose al rol de Analista Funcional (`backend/docs/INFORME_AUDITORIA_CONTRIBUCIONES_BACKEND.md:90-91`). Se enfoca en trasladar la orquestación de la máquina de estados hacia la Capa de Dominio (State Pattern) y definir conceptualmente la integración mediante Transactional Outbox.

## 2. Matriz de nomenclatura

| Concepto | Plan específico | Blueprint | Nombre v1 | Diferencia | Propuesta de mapeo | Estado | Evidencia |
| -------- | --------------- | --------- | --------- | ---------- | ------------------ | ------ | --------- |
| **Expediente** | `id_expediente` | `expediente_id` | `id_expediente` | Discrepancia en sufijo/prefijo | Referencia externa al expediente | PENDIENTE DE CONTRATO CON GRUPO 2 | `backend/docs/levantamiento_de_observaciones/01_plan_levantamiento_observaciones_grupo_1_rutadoc.md:88`, `backend/docs/Plan_de_mejora_nivel_backend_SIGD.md:484` |
| **Área origen** | `id_area` | `area_id` | `area_origen` | Discrepancia en rol | Referencia externa al área origen | PENDIENTE DE CONTRATO CON GRUPO 3 | `backend/docs/levantamiento_de_observaciones/01_plan_levantamiento_observaciones_grupo_1_rutadoc.md:89` |
| **Área destino** | `id_area` | `area_id` | `area_destino` | Discrepancia en rol | Referencia externa al área destino | PENDIENTE DE CONTRATO CON GRUPO 3 | `backend/docs/levantamiento_de_observaciones/01_plan_levantamiento_observaciones_grupo_1_rutadoc.md:89` |
| **Usuario actor** | `id_usuario` | `usuario_id` | `usuario_actor_id` | Discrepancia en semántica | Referencia externa al actor | PENDIENTE DE CONTRATO CON GRUPO 4 | `backend/docs/levantamiento_de_observaciones/01_plan_levantamiento_observaciones_grupo_1_rutadoc.md:90` |

*(Nota: Los identificadores exactos y formatos físicos no se presentan como contrato confirmado. Cualquier referencia física a claves ajenas es PENDIENTE DE CONTRATO).*

## 3. Comparación de transiciones y estados

### Resumen de discrepancias

| Concepto | V1 | Plan específico | Blueprint | ¿Coincide? | Decisión necesaria | Evidencia |
| -------- | -- | --------------- | --------- | ---------- | ------------------ | --------- |
| **Cantidades** | Análisis v1 (`backend/docs/rutadoc/01_analisis_trazabilidad_recepcion_derivacion_atencion.md`): 10 acciones identificadas. Diccionario v1 (`backend/docs/rutadoc/02_diccionario_datos_trazabilidad.md`): 13 acciones de EJEMPLO. Transiciones formales: PENDIENTE DE VERIFICACIÓN (el artefacto v1 no contabiliza una matriz cerrada de transiciones. Acciones y transiciones NO equivalen automáticamente). | 10 estados / 13 transiciones (cifra textual explícita del plan específico para modelar) | 13 estados / 16 transiciones (INFERENCIA NO CONTRACTUAL DEL DIAGRAMA DEL BLUEPRINT) | NO | Autoridad sobre catálogo oficial | Plan: `backend/docs/levantamiento_de_observaciones/01_plan_levantamiento_observaciones_grupo_1_rutadoc.md:24`, `68`. Blueprint: `backend/docs/Plan_de_mejora_nivel_backend_SIGD.md:369-399`. |

*(Nota: El plan específico exige explícitamente modelar 10 estados y 13 transiciones pero no las enumera. La cifra "13 estados / 16 transiciones" es una INFERENCIA NO CONTRACTUAL DEL DIAGRAMA DEL BLUEPRINT obtenida al contar 13 nodos correspondientes a estados y 16 aristas estado → estado, separando la flecha inicial (1) y las flechas terminales (2) del conteo funcional. El resultado es una inferencia documental y NO constituye un catálogo contractual. La reconciliación Plan vs Blueprint permanece PENDIENTE DE ACLARACIÓN).*

### Matriz comparativa de transiciones y estados funcionales

| Origen | Acción o evento | Resultado | Fuente | Estado documental | Observación |
| :--- | :--- | :--- | :--- | :--- | :--- |
| REGISTRADO | Derivar inicialmente | PENDIENTE_RECEPCION | Blueprint | PENDIENTE | El Blueprint agrega flujos ausentes en v1. |
| REGISTRADO | Identificar error | OBSERVADO | Blueprint | PENDIENTE | - |
| OBSERVADO | Subsanar error | SUBSANADO | Blueprint | PENDIENTE | `SUBSANADO` no existía en v1. |
| OBSERVADO | Vencer plazo | RECHAZADO | Blueprint | PENDIENTE | `RECHAZADO` no existía en v1. |
| SUBSANADO | Enviar a revisión | PENDIENTE_RECEPCION | Blueprint | PENDIENTE | - |
| PENDIENTE_RECEPCION | Confirmar llegada | RECIBIDO | Blueprint | PENDIENTE | - |
| RECIBIDO | Iniciar revisión | EN_REVISION | Blueprint | PENDIENTE | - |
| EN_REVISION | Derivar (informe) | DERIVADO | Blueprint | PENDIENTE | `DERIVADO` era acción, no estado en v1. |
| EN_REVISION | Devolver | DEVUELTO | Blueprint | PENDIENTE | `DEVUELTO` era ambiguo en v1. |
| EN_REVISION | Atender | EN_ATENCION | Blueprint | PENDIENTE | - |
| DERIVADO | Enviar a bandeja | PENDIENTE_RECEPCION | Blueprint | PENDIENTE | - |
| DEVUELTO | Retornar origen | RECIBIDO | Blueprint | PENDIENTE | - |
| EN_ATENCION | Finalizar | ATENDIDO | Blueprint | PENDIENTE | - |
| ATENDIDO | Cerrar formalmente | CERRADO | Blueprint | PENDIENTE | - |
| CERRADO | Solicitar reapertura | REABIERTO | Blueprint | PENDIENTE | - |
| REABIERTO | Retomar evaluación | EN_REVISION | Blueprint | PENDIENTE | - |

*(Nota: Las cifras de 13 estados y 16 transiciones son una INFERENCIA NO CONTRACTUAL DEL DIAGRAMA DEL BLUEPRINT obtenida mediante el conteo de nodos y aristas funcionales).*

## 4. State Pattern (Diseño Conceptual)

La delegación de la máquina de estados hacia la Capa de Dominio exige la siguiente estructura conceptual. Una operación inválida se rechaza antes de confirmar la transacción del caso de uso. El State Pattern modelará las reglas de transición relacionadas con la trazabilidad y los movimientos. RutaDoc gestiona movimientos, trazabilidad, historial y su proyección funcional. TramiCore gestiona expediente, CUT, datos propios del expediente y el ciclo de vida de su subdominio. Todo detalle fronterizo todavía no acordado queda PENDIENTE.

### Especificación Formal de Transiciones

| Estado de origen | Acción | Precondiciones | Datos requeridos | Validaciones del dominio | Estado resultante | Evento de dominio | Resultado del rechazo | Clasificación | Evidencia |
| ---------------- | ------ | -------------- | ---------------- | ------------------------ | ----------------- | ----------------- | --------------------- | ------------- | --------- |
| REGISTRADO | Derivar inicialmente | Expediente existe | Referencia externa al área destino | El área destino existe y está activa (PROPUESTO) | PENDIENTE_RECEPCION | `ExpedienteDerivado` | Rechazo antes de commit | PENDIENTE | `backend/docs/Plan_de_mejora_nivel_backend_SIGD.md:369-399` |
| REGISTRADO | Identificar error | Expediente existe | Motivo de error | El error corresponde a una categoría tipificada (PROPUESTO) | OBSERVADO | `ExpedienteObservado` | Rechazo antes de commit | PENDIENTE | `backend/docs/Plan_de_mejora_nivel_backend_SIGD.md:369-399` |
| OBSERVADO | Subsanar error | Dentro de plazo (PROPUESTO) | Doc. subsanado | Se aportaron los documentos requeridos en la observación (PROPUESTO) | SUBSANADO | Evento específico PENDIENTE | Rechazo antes de commit | PENDIENTE | `backend/docs/Plan_de_mejora_nivel_backend_SIGD.md:369-399` |
| OBSERVADO | Vencer plazo | Plazo expirado (PROPUESTO) | Fecha límite | Fecha actual es mayor a la fecha límite establecida (PROPUESTO) | RECHAZADO | Evento específico PENDIENTE | Rechazo antes de commit | PENDIENTE | `backend/docs/Plan_de_mejora_nivel_backend_SIGD.md:369-399` |
| SUBSANADO | Enviar a revisión | Docs completos (PROPUESTO) | Referencia externa al área destino | El área destino existe y está activa (PROPUESTO) | PENDIENTE_RECEPCION | Evento específico PENDIENTE | Rechazo antes de commit | PENDIENTE | `backend/docs/Plan_de_mejora_nivel_backend_SIGD.md:369-399` |
| PENDIENTE_RECEPCION | Confirmar llegada | Trámite en bandeja | Referencia externa al actor | El actor forma parte del área de recepción (PROPUESTO) | RECIBIDO | Evento específico PENDIENTE | Rechazo antes de commit | PENDIENTE | `backend/docs/Plan_de_mejora_nivel_backend_SIGD.md:369-399` |
| RECIBIDO | Iniciar revisión | Pertenece a área | Detalle de inicio | Capacidad de revisión (PROPUESTO) | EN_REVISION | Evento específico PENDIENTE | Rechazo antes de commit | PENDIENTE | `backend/docs/Plan_de_mejora_nivel_backend_SIGD.md:369-399` |
| EN_REVISION | Derivar (informe) | Revisión completa (PROPUESTO) | Referencia externa al área destino | El destino existe y el motivo no está vacío (PROPUESTO) | DERIVADO | `ExpedienteDerivado` | Rechazo antes de commit | PENDIENTE | `backend/docs/Plan_de_mejora_nivel_backend_SIGD.md:369-399`, `backend/docs/levantamiento_de_observaciones/01_plan_levantamiento_observaciones_grupo_1_rutadoc.md:57` |
| EN_REVISION | Devolver | Causa justificada (PROPUESTO) | Referencia externa al área destino | El área destino coincide con el remitente anterior (PROPUESTO) | DEVUELTO | Evento específico PENDIENTE | Rechazo antes de commit | PENDIENTE | `backend/docs/Plan_de_mejora_nivel_backend_SIGD.md:369-399` |
| EN_REVISION | Atender | Competencia confirmada (PROPUESTO) | PENDIENTE | PENDIENTE (criterios de competencia pendientes) | EN_ATENCION | Evento específico PENDIENTE | Rechazo antes de commit | PENDIENTE | `backend/docs/Plan_de_mejora_nivel_backend_SIGD.md:369-399` |
| DERIVADO | Enviar a bandeja | PENDIENTE | PENDIENTE | PENDIENTE (Regla de envío a bandeja) | PENDIENTE_RECEPCION | Evento específico PENDIENTE | Rechazo antes de commit | PENDIENTE | `backend/docs/Plan_de_mejora_nivel_backend_SIGD.md:369-399` |
| DEVUELTO | Retornar origen | PENDIENTE | PENDIENTE | PENDIENTE (Regla de envío a bandeja) | RECIBIDO | Evento específico PENDIENTE | Rechazo antes de commit | PENDIENTE | `backend/docs/Plan_de_mejora_nivel_backend_SIGD.md:369-399` |
| EN_ATENCION | Finalizar | Preparación lista | Referencia documental externa (PENDIENTE DE CONTRATO/COORDINACIÓN CON GRUPO 5) | Resolución generada (PROPUESTO) | ATENDIDO | `ExpedienteAtendido` | Rechazo antes de commit | PENDIENTE | `backend/docs/Plan_de_mejora_nivel_backend_SIGD.md:369-399` |
| ATENDIDO | Cerrar formalmente | Respuesta enviada (PROPUESTO) | Motivo cierre | Reglas de cierre | CERRADO | Evento específico PENDIENTE | Rechazo antes de commit | PENDIENTE | `backend/docs/Plan_de_mejora_nivel_backend_SIGD.md:369-399` |
| CERRADO | Solicitar reapertura | Autorización superior (PROPUESTO) | Motivo reapertura (PROPUESTO) | Permisos de reapertura (PROPUESTO) | REABIERTO | Evento específico PENDIENTE | Rechazo antes de commit | PENDIENTE | `backend/docs/Plan_de_mejora_nivel_backend_SIGD.md:369-399` |
| REABIERTO | Retomar evaluación | PENDIENTE | PENDIENTE | PENDIENTE (Justificación de reapertura) | EN_REVISION | Evento específico PENDIENTE | Rechazo antes de commit | PENDIENTE | `backend/docs/Plan_de_mejora_nivel_backend_SIGD.md:369-399` |

*(Evidencia Base Adicional: `backend/docs/Plan_de_mejora_nivel_backend_SIGD.md:165`; Rol de Jacobo y State Pattern: `backend/docs/levantamiento_de_observaciones/01_plan_levantamiento_observaciones_grupo_1_rutadoc.md:49`; State Pattern desacoplado de triggers y estandarización Outbox: `backend/docs/levantamiento_de_observaciones/01_plan_levantamiento_observaciones_grupo_1_rutadoc.md:99-100`).*

## 5. Matriz de dependencias

| Productor | Recurso proporcionado | Consumidor | Uso funcional | Validación previa | Qué no controla RutaDoc | Estado contractual | Evidencia |
| --------- | --------------------- | ---------- | ------------- | ----------------- | ----------------------- | ------------------ | --------- |
| **Grupo 2 — TramiCore** | Referencia externa al expediente | RutaDoc (G1) | Identificar al expediente (CONFIRMADO: necesidad funcional) | PENDIENTE DE CONTRATO (comprobar existencia activa, vigencia, pertenencia, identificadores, mecanismo de consulta) | CUT, foliación ni ciclo de vida del Exp | PENDIENTE DE CONTRATO | `backend/docs/levantamiento_de_observaciones/01_plan_levantamiento_observaciones_grupo_1_rutadoc.md:88` |
| **Grupo 3 — OrganiCore** | Referencia externa al área | RutaDoc (G1) | Validar áreas (CONFIRMADO: necesidad funcional) | PENDIENTE DE CONTRATO (comprobar existencia activa, jerarquía, pertenencia) | Organigrama y estructura de áreas | PENDIENTE DE CONTRATO | `backend/docs/levantamiento_de_observaciones/01_plan_levantamiento_observaciones_grupo_1_rutadoc.md:89` |
| **Grupo 4 — IdentiCore** | Referencia externa al actor | RutaDoc (G1) | Identificar al actor (CONFIRMADO: necesidad funcional) | PENDIENTE DE CONTRATO (comprobar existencia activa, autorización, permisos, identificadores) | Autenticación y acceso (login) | PENDIENTE DE CONTRATO | `backend/docs/levantamiento_de_observaciones/01_plan_levantamiento_observaciones_grupo_1_rutadoc.md:90` |
| **Grupo 5 — DocuCore** | Referencia documental externa | RutaDoc (G1) | Trazabilidad documental | PENDIENTE DE CONTRATO (disponibilidad documental, adjuntos, relación con respuesta/resolución) | RutaDoc no es propietario de los documentos | PENDIENTE DE CONTRATO / COORDINACIÓN CON GRUPO 5 | Falta de contrato explícito |
| **Grupo 6 — CoreLink** | Contrato de evento_outbox | RutaDoc (G1) | Publicación asíncrona | Inserción en misma transacción (PENDIENTE DE CONTRATO CON GRUPO 6) | Infraestructura de worker, colas, reintentos | PENDIENTE DE CONTRATO | `backend/docs/levantamiento_de_observaciones/01_plan_levantamiento_observaciones_grupo_1_rutadoc.md:91` |

*(Aclaración: Se mantiene la dependencia funcional documental con Grupo 5. Para la Fase 2 permanecen pendientes identificadores, referencias físicas, contrato, disponibilidad documental, adjuntos, relación con respuesta/resolución y cualquier campo relacionado. RutaDoc no será propietario de documentos ni adjuntos administrados por DocuCore).*

## 6. Validaciones Previas a la Persistencia

| Validación | Naturaleza | Clasificación | Evidencia u Origen |
| :--- | :--- | :--- | :--- |
| Expediente existente | Integridad externa (TramiCore) | CUBIERTO DOCUMENTALMENTE / implementación PENDIENTE DE CONTRATO | `backend/docs/levantamiento_de_observaciones/01_plan_levantamiento_observaciones_grupo_1_rutadoc.md:88` |
| Estado actual esperado | Dominio (State Pattern) | CONFIRMADO (mecanismo), catálogo PENDIENTE | `backend/docs/Plan_de_mejora_nivel_backend_SIGD.md:369-399` |
| Acción permitida | Dominio (State Pattern) | CONFIRMADO (mecanismo), catálogo PENDIENTE | `backend/docs/Plan_de_mejora_nivel_backend_SIGD.md:369-399` |
| Actor identificado | Autorización externa | CUBIERTO DOCUMENTALMENTE / implementación PENDIENTE DE CONTRATO | `backend/docs/levantamiento_de_observaciones/01_plan_levantamiento_observaciones_grupo_1_rutadoc.md:90` |
| Existencia, vigencia, autenticación y autorización del actor | Autorización externa (Auth/IdentiCore) | PENDIENTE DE CONTRATO | `backend/docs/levantamiento_de_observaciones/01_plan_levantamiento_observaciones_grupo_1_rutadoc.md:90` |
| Áreas requeridas (Origen/Destino) | Integridad externa (OrganiCore) | CUBIERTO DOCUMENTALMENTE / implementación PENDIENTE DE CONTRATO | `backend/docs/levantamiento_de_observaciones/01_plan_levantamiento_observaciones_grupo_1_rutadoc.md:89` |
| Detalle compatible | Dominio | PROPUESTO | `backend/docs/levantamiento_de_observaciones/01_plan_levantamiento_observaciones_grupo_1_rutadoc.md:57-58` |
| Presencia o nomenclatura del campo de secuencia | Integridad de persistencia | CONFIRMADO | `backend/docs/Plan_de_mejora_nivel_backend_SIGD.md:484` |
| Unicidad y correlatividad por expediente | Integridad de persistencia | PENDIENTE | Falta de evidencia directa (es una propuesta de diseño) |
| Relaciones con movs. anteriores | Dominio | PENDIENTE | No existe evidencia directa explícita |
| Concurrencia | Integridad de persistencia | CUBIERTO DOCUMENTALMENTE / implementación PENDIENTE | `backend/docs/levantamiento_de_observaciones/01_plan_levantamiento_observaciones_grupo_1_rutadoc.md:58` |
| Idempotencia | Prevención duplicados en App | PROPUESTO | No existe evidencia directa explícita |

## 7. Proyección de Estado Actual
* **v1:** Actualización delegada a triggers masivos.
* **Blueprint:** Actualización transaccional mediante el caso de uso.
* **Plan específico:** Exige actualización "dentro de la misma transacción del caso de uso" (`backend/docs/levantamiento_de_observaciones/01_plan_levantamiento_observaciones_grupo_1_rutadoc.md:39`).

**Clasificación técnica de la proyección:**
* **CONFIRMADO:** La proyección debe ocurrir de forma determinista en la misma transacción del caso de uso.
* **PENDIENTE DE ACLARACIÓN:** La autoridad técnica y escritor físico definitivo (TypeScript en memoria vs Triggers SQL mantenidos en `01_plan_levantamiento_observaciones_grupo_1_rutadoc.md:103`) para evitar dobles actualizaciones.

## 8. Transactional Outbox y Payloads
Se delimitan los aspectos técnicos del Outbox para RutaDoc:
* **Existencia del evento:** CONFIRMADO (`backend/docs/levantamiento_de_observaciones/01_plan_levantamiento_observaciones_grupo_1_rutadoc.md:30`).
* **Nombres físicos exactos del evento:** PENDIENTE DE ACLARACIÓN (Plan y Blueprint difieren; no hay estándar canónico confirmado por CoreLink).
* **Campos conceptuales mínimos:** EJEMPLO NO CONTRACTUAL.
* **Consumidores:** PENDIENTE DE CONTRATO.
* **Infraestructura y publicación:** PENDIENTE DE CONTRATO CON GRUPO 6 (ownership, esquema físico, infraestructura, worker, colas, reintentos, publicación, formato final del payload, campos obligatorios, contrato).

> **ADVERTENCIA:** Todos los JSON presentados a continuación (incluyendo nombres de campos, estructura, UUID, `correlation_id`, `idempotency_key`, timestamps, nombres físicos, metadatos, tipos, y estructuras de contexto/datos específicos) son un **EJEMPLO NO CONTRACTUAL**. El contrato definitivo depende de coordinación intermodular.

### 8.1. ExpedienteDerivado (EJEMPLO NO CONTRACTUAL)
```json
{
  "tipo_evento": "ExpedienteDerivado",
  "correlation_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "idempotency_key": "123e4567-e89b-12d3-a456-426614174001",
  "fecha_ocurrencia": "2026-09-02T15:00:00Z",
  "identidad": {
    "id_expediente": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "movimiento_id": "c92f15a8-27b3-4f0e-97f2-1a4c8e7d23a1"
  },
  "contexto": {
    "usuario_actor_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "area_origen_id": "550e8400-e29b-41d4-a716-446655440000",
    "area_destino_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
  },
  "datos_especificos": {
    "motivo": "Revisión técnica solicitada"
  }
}
```

### 8.2. ExpedienteAtendido (EJEMPLO NO CONTRACTUAL)
```json
{
  "tipo_evento": "ExpedienteAtendido",
  "correlation_id": "71a64b97-1521-42db-8a8b-18a0ebc52119",
  "idempotency_key": "4c434220-4221-4927-8a62-446655440000",
  "fecha_ocurrencia": "2026-09-02T16:00:00Z",
  "identidad": {
    "id_expediente": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "movimiento_id": "e2a445b2-32a7-47be-bdf1-334c9e885c27"
  },
  "contexto": {
    "usuario_actor_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "area_origen_id": "550e8400-e29b-41d4-a716-446655440000"
  },
  "datos_especificos": {
    "hash_resolucion": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  }
}
```
*(Nota sobre `hash_resolucion`: Es un EJEMPLO NO CONTRACTUAL sujeto al contrato con Grupo 5).*

### 8.3. ExpedienteObservado (EJEMPLO NO CONTRACTUAL)
```json
{
  "tipo_evento": "ExpedienteObservado",
  "correlation_id": "1d84878f-6825-450c-a96c-25f0e9b97a22",
  "idempotency_key": "8b5f3a09-5f21-4b72-a9b0-18b52123f03b",
  "fecha_ocurrencia": "2026-09-02T17:00:00Z",
  "identidad": {
    "id_expediente": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "movimiento_id": "b1a134d1-12c5-4190-b184-245c3285c1a7"
  },
  "contexto": {
    "usuario_actor_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "area_origen_id": "550e8400-e29b-41d4-a716-446655440000"
  },
  "datos_especificos": {
    "requisitos_faltantes": ["Formulario 02"],
    "fecha_vencimiento_subsanacion": "2026-09-05T23:59:59Z"
  }
}
```

## 9. Concurrencia e Idempotencia (Casos de Prueba Documentales)
Diferenciación conceptual (`PENDIENTE` hasta validar contratos):
* **`correlation_id`**: Usado exclusivamente para la trazabilidad entre operaciones y eventos.
* **`idempotency_key`**: Usado para la prevención de procesamiento duplicado.

### Diseño Documental de Concurrencia

| ID | Escenario | Precondiciones | Operación A | Operación B | Riesgo | Resultado esperado con ruta única | Alternativa con rutas paralelas | Clasificación | Evidencia |
| -- | --------- | -------------- | ----------- | ----------- | ------ | --------------------------------- | ------------------------------- | ------------- | --------- |
| 1 | Dos derivaciones simultáneas del mismo expediente hacia áreas diferentes. | Expediente activo y con origen válido | Derivar a Área X | Derivar a Área Y | Estado inconsistente o doble enrutamiento no autorizado | Se aprueba solo una ruta; la otra se rechaza o reintenta por estado obsoleto | Ambas se aceptan bajo reglas funcionales concurrentes | CUBIERTO DOCUMENTALMENTE / implementación PENDIENTE | `backend/docs/levantamiento_de_observaciones/01_plan_levantamiento_observaciones_grupo_1_rutadoc.md:58` |

*(Nota: Este es exclusivamente el diseño documental conceptual. NO están confirmados todavía: política final, locking, comportamiento concurrente, reintentos, paralelismo permitido, implementación PostgreSQL, ni resultado de pruebas).*

**Otros Casos:**
* **Dos recepciones simultáneas:** `PROPUESTO`. La segunda sería rechazada al cambiar el estado a RECIBIDO, a falta de confirmación definitiva.
* **Fallo de inserción Outbox o Proyección:** El objetivo conceptual es preservar atomicidad entre la operación de RutaDoc y el registro Outbox correspondiente; el mecanismo físico definitivo y su validación permanecen PENDIENTES DE CONTRATO CON GRUPO 6 y de implementación/pruebas.
* **Intento de modificar el historial:** **Comportamiento esperado:** el futuro DDL documentalmente debería impedir la modificación del historial. El objetivo conceptual es preservar atomicidad entre la operación de RutaDoc y el registro Outbox correspondiente; el mecanismo físico definitivo (incluyendo rollbacks) y su validación permanecen PENDIENTES DE CONTRATO CON GRUPO 6 y de implementación/pruebas.

## 10. Decisiones y Preguntas Pendientes

### Decisiones confirmadas
* Separación conceptual de Dominio (validación) e Infraestructura (SQL).
* Limitación del historial a adición inmutable.

### Propuestas
* Estructuras conceptuales de JSON para eventos Outbox (EJEMPLO NO CONTRACTUAL).

### Preguntas para el profesor (Revisión de Arquitectura)
1. **Catálogo de estados:** ¿Debe primar la lista de 10 estados descritos textualmente en el plan o los 13 visibles explícitamente en el diagrama del Blueprint?
2. **Catálogo de transiciones:** ¿Cómo conciliamos las 13 transiciones para modelar del plan frente a las 16 (19 flechas) del Blueprint?
3. **Convención de identificadores:** ¿Cuál será el estándar canónico final físico para evitar ambigüedades en las FKs?
4. **Autoridad de la proyección:** ¿Quién realizará físicamente la actualización de proyecciones para evitar conflictos entre triggers e inserciones manuales en TS?
5. **Derivaciones paralelas:** ¿Se permitirá funcionalmente derivar un expediente a múltiples áreas simultáneamente?
6. **Contrato Outbox:** ¿Cuál será la nomenclatura física final del evento que espera CoreLink?
7. **Propietario de la idempotencia:** ¿Debe generarse la `idempotency_key` en el frontend, en el controlador REST o internamente en el Dominio?

## 11. Matriz de Cumplimiento Documental

| Documento obligatorio | Pauta aplicada | Sección de H1 | Evidencia ruta:línea | Cumplimiento |
| :--- | :--- | :--- | :--- | :--- |
| **Informe de auditoría** | Restricción estricta al rol Funcional | Sección 1 | `backend/docs/INFORME_AUDITORIA_CONTRIBUCIONES_BACKEND.md:90-91` | CUBIERTO DOCUMENTALMENTE |
| **Blueprint** | Incorporación del State Pattern | Sección 4 | `backend/docs/Plan_de_mejora_nivel_backend_SIGD.md:165` | CUBIERTO DOCUMENTALMENTE |
| **Blueprint** | Diagrama de transiciones y estados | Sección 3 y 4 | `backend/docs/Plan_de_mejora_nivel_backend_SIGD.md:369-399` | CUBIERTO DOCUMENTALMENTE |
| **Portal Maestro** | Ubicación del artefacto v1 | Sección 2 y 3 | `backend/docs/README.md:60` | CUBIERTO DOCUMENTALMENTE |
| **Plan específico de RutaDoc** | Integración asíncrona Outbox e historial | Sección 7 y 8 | `backend/docs/levantamiento_de_observaciones/01_plan_levantamiento_observaciones_grupo_1_rutadoc.md:30` | CUBIERTO DOCUMENTALMENTE |
