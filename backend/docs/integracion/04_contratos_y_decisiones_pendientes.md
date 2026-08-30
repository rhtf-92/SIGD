# 04_contratos_y_decisiones_pendientes.md

- **Responsable previsto:** B_AREVALO
- **Rama prevista:** B_AREVALO
- **Grupo:** Grupo 6 — Coordinación de Integración
- **Estado:** BORRADOR — PENDIENTE DE REVISIÓN DEL RESPONSABLE
- **Alcance:** Matriz conceptual de dependencias inter-módulos, contratos de errores y trazabilidad, registro de riesgos y coordinación de respuestas con los grupos productores (Grupos 1 al 5).
- **Dependencias:** Coordinación y respuesta de los grupos propietarios (Grupos 1 al 5), del líder del Grupo 6, del profesor y de la institución.
- **Fecha de revisión:** 29 de agosto de 2026
- **Validación institucional:** PENDIENTE

## 1. Propósito y problema que resuelve

Consolidar un inventario conceptual de cómo el Grupo 1 (RutaDoc) interactúa con el resto de los módulos del SIGD. El Grupo 6 no posee decisiones confirmadas sobre los demás grupos; su labor aquí se limita a proponer, registrar y coordinar la resolución de las dependencias.

Este documento no reemplaza una validación institucional ni la decisión de cada grupo productor. Distingue expresamente los niveles **PROPUESTA**, **PENDIENTE** y **SUPUESTO**, y no presenta como confirmados los identificadores, endpoints, formatos o reglas que aún dependen de otros responsables.

## 2. Alcance y elementos fuera de alcance

**Alcance:**
- Registro conceptual de qué datos consume RutaDoc y de quién.
- Contratos conceptuales de errores y de trazabilidad entre módulos.
- Listado de riesgos de interconexión propuestos, con impacto y evidencia esperada de cierre.
- Checklist de revisión de los documentos 01, 02 y 03 del Grupo 6 y registro de observaciones.
- Registro de preguntas para Geric, el profesor y la institución.

**Fuera de alcance:**
- Definir unilateralmente endpoints, formatos exactos o SLAs (es potestad de cada grupo productor).
- Implementar código ejecutable de middlewares, controladores o SQL.
- Reemplazar la decisión formal de otro grupo sobre sus propios identificadores o validaciones.

## 3. Definiciones

- **Contrato Conceptual:** Relación de necesidad de datos antes de definir el endpoint tecnológico exacto.
- **Productor:** Grupo propietario del dato o capacidad que expone.
- **Consumidor:** Grupo que requiere consumir el dato o capacidad.
- **Estado PROPUESTA:** Nivel transitorio que requiere revisión o aprobación antes de considerarse confirmado.
- **Estado PENDIENTE:** Aspecto que no tiene aún respuesta definida y no debe presentarse como regla oficial.
- **Evidencia de cierre:** Prueba (respuesta, acuerdo, documento o resultado de validación) que demuestra la resolución de un riesgo o de una decisión.

## 4. Matriz conceptual de dependencias (PROPUESTA)

Esta matriz identifica las necesidades de datos del Grupo 1 (RutaDoc) hacia los grupos productores. Ninguna de las soluciones tecnológicas está confirmada: los identificadores, formatos y mecanismos de validación siguen siendo propuestos hasta ser validados por cada responsable.

| ID Contrato | Grupo Productor | Grupo Consumidor | Dato o capacidad | Propietario | Validación esperada | Tratamiento histórico | Estado | Pregunta pendiente |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `CT-G2-G1-001` | G2 (Expedientes) | G1 (RutaDoc) | IDs de expedientes | G2 | Existencia y formato del identificador de expediente | Pendiente G2 | PROPUESTA | ¿UUID o secuenciales? |
| `CT-G3-G1-001` | G3 (Permisos) | G1 (RutaDoc) | Áreas y permisos | G3 | Existencia y vigencia del área; permiso aplicable pendiente | Pendiente G3 | PROPUESTA | ¿Se consultará por cada petición o vendrá en el payload central? |
| `CT-G4-G1-001` | G4 (Usuarios) | G1 (RutaDoc) | IDs de usuarios | G4 | Existencia y estado activo del identificador de usuario | Pendiente G4 | PROPUESTA | ¿Cómo se validará la existencia y vigencia del usuario sin duplicar sus datos? |
| `CT-G5-G1-001` | G5 (Documentos) | G1 (RutaDoc) | IDs de documentos | G5 | Existencia del documento y coherencia de la versión | Pendiente G5 | PROPUESTA | ¿Se permitirá descargar el archivo binario desde G1 o solo metadatos? |

## 5. Contrato conceptual de errores (PROPUESTA)

Complementa la matriz anterior con un contrato sobre cómo se comunicarán los errores entre módulos. Es conceptual y no fija una implementación ejecutable; solo propone la información mínima que un consumidor debería poder interpretar y trazar.

| ID | Aspecto del error | Propuesta | Nivel | Responsable |
| :--- | :--- | :--- | :--- | :--- |
| CE-01 | Identificador de la respuesta de error | Se propone que cada respuesta incluya un `code` alfanumérico interno estable | PROPUESTA | Grupo 6, coordinado con B_REATEGUI |
| CE-02 | Mensaje legible | Se propone un `message` descriptivo sin fuga de datos internos | PROPUESTA | Grupo 6, coordinado con B_REATEGUI |
| CE-03 | Categoría del error | Se propone clasificar como Validation, Authorization, Conflict, NotFound o Internal | PROPUESTA | Grupo 6, coordinado con B_REATEGUI |
| CE-04 | Detalles técnicos | Se propone un arreglo opcional de detalles, sin stack traces ni SQL | PROPUESTA | Grupo 6, coordinado con B_REATEGUI |
| CE-05 | Reintentabilidad | Se propone un booleano `retryable` para señalar si la operación puede reintentarse | PROPUESTA | Grupo 6, coordinado con B_REATEGUI |
| CE-06 | Trazabilidad | Se propone propagar y devolver un `correlationId` para trazar el error internamente | PROPUESTA | Grupo 6, coordinado con B_REATEGUI |
| CE-07 | Estándar vs. formato propio | PENDIENTE decidir si se adopta RFC 9457 (Problem Details) o la estructura personalizada propuesta | PENDIENTE | B_REATEGUI y Grupo 6 |

## 6. Contrato conceptual de trazabilidad (PROPUESTA)

Define la información mínima de trazabilidad que el Grupo 1 debería poder asociar y que los demás módulos deberían aceptar al referenciar una operación.

| ID | Elemento de trazabilidad | Propuesta | Nivel | Responsable |
| :--- | :--- | :--- | :--- | :--- |
| CTZ-01 | Identificador de correlación | Se propone un `correlationId` que viaje de extremo a extremo y permita enlazar la operación con sus errores y logs | PROPUESTA | Grupo 6, coordinado con todos los grupos |
| CTZ-02 | Referencias externas estables | Se propone que RutaDoc conserve solo identificadores externos sin duplicar entidades | PROPUESTA | Grupo 6, coordinado con G2–G5 |
| CTZ-03 | Trazas internas ligadas al identificador | Se propone registrar trazas técnicas internamente asociadas al `correlationId`, sin exponerlas al cliente | PROPUESTA | Grupo 6, coordinado con B_REATEGUI |
| CTZ-04 | Tratamiento histórico | PENDIENTE definir cómo se mantienen referencias a entidades dadas de baja o inactivas en el historial | PENDIENTE | Grupos propietarios y Grupo 6 |

## 7. Matriz de riesgos con impacto y evidencia de cierre

| ID Riesgo | Contrato Afectado | Riesgo Detectado | Impacto | Evidencia esperada de cierre | Responsable de coordinar | Estado |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `RI-INT-001` | `CT-G4-G1-001` | Referencia a un usuario inexistente o inactivo | RutaDoc podría vincular movimientos a actores inválidos, degradando la trazabilidad y la atribución | Confirmación escrita de G4 sobre el mecanismo de validación de usuarios y ejemplo de respuesta para un usuario inactivo | B_AREVALO / Líder G4 | ABIERTO |
| `RI-INT-002` | `CT-G5-G1-001` | Límite máximo de tamaño de archivo (pregunta separada del ID) | Descargas o referencias a documentos que superen el límite podrían fallar o degradar el rendimiento de G1 | Definición documentada del límite por G5 y un caso de prueba ficticio que lo verifique | B_AREVALO / Líder G5 | ABIERTO |
| `RI-INT-003` | `CT-G2-G1-001` | Expediente inexistente o no vigente | Movimientos asociados a expedientes que ya no existen o están cerrados | Confirmación escrita de G2 sobre vigencia y respuesta ante referencias no vigentes | B_AREVALO / Líder G2 | ABIERTO |
| `RI-INT-004` | `CT-G3-G1-001` | Área o permiso no vigente al momento de la operación | Derivaciones hacia áreas inválidas o acciones sin permiso | Definición de G3 sobre vigencia de áreas/permisos y respuesta propuesta | B_AREVALO / Líder G3 | ABIERTO |

## 8. Checklist de revisión de los documentos 01, 02, 03 y 04

Estado de disponibilidad, procedencia y aporte individual de cada documento del Grupo 6 en `backend/docs/integracion/`:

| Documento | Disponibilidad | Procedencia | Aporte individual |
| --- | --- | --- | --- |
| `01_convenciones_api_backend.md` | Disponible | Material base de coordinación | Sin evidencia en `B_DUQUE` |
| `02_catalogo_errores_backend.md` | Disponible | Material base de coordinación | Sin evidencia en `B_REATEGUI` |
| `03_plan_pruebas_integracion.md` | Disponible | Material base de coordinación | Sin evidencia en `B_ZEVALLOS` |
| `04_contratos_y_decisiones_pendientes.md` | Disponible | Elaborado y revisado en `B_AREVALO` | Aporte verificable de Arevalo |

Ítems de revisión aplicados a los documentos 01, 02 y 03:

| Ítem de revisión | Aplica a | Estado | Observación |
| :--- | :--- | :--- | :--- |
| El documento indica responsable y rama | 01, 02, 03 | VERIFICADO | Los borradores indican B_DUQUE, B_REATEGUI y B_ZEVALLOS como responsables originalmente asignados |
| El contenido coincide con el nombre del archivo | 01, 02, 03 | VERIFICADO | Reubicados en `backend/docs/integracion/` con su nombre definitivo |
| No se definen endpoints ni formatos como confirmados | 01, 02, 03 | EN REVISIÓN | Las propuestas se marcan como PROPUESTA o PENDIENTE |
| No contiene credenciales, secretos ni datos personales reales | 01, 02, 03 | VERIFICADO | No se detectaron secretos ni datos personales reales |
| Las referencias a RFC y estándares son verificables | 01, 02 | VERIFICADO | RFC 9110 y RFC 9457 identificables |
| Incluye caso de prueba ficticio con severidad y criterio de cierre | 03 | EN REVISIÓN | La matriz TC-INT-01..05 está propuesta; requiere validación |

## 9. Registro de observaciones con estado real

| ID | Documento | Observación | Estado | Fecha |
| :--- | :--- | :--- | :--- | :--- |
| OB-01 | 01, 02, 03 | Los documentos 01–03 fueron recuperados como material base de coordinación y no representan aportes individuales de las ramas originalmente asignadas | RESUELTA en este documento | 2026-08-29 |
| OB-02 | 04 | El antiguo `backend/src/docs/verify.ps1` estaba mal nombrado; su contenido fue consolidado en el documento 04 actual y el archivo no debe restaurarse | RESUELTA en este documento | 2026-08-29 |
| OB-03 | 04 | Faltaba checklist, registro de observaciones, impacto/evidencia de riesgos y preguntas para Geric, profesor e institución | RESUELTA en este documento | 2026-08-29 |
| OB-04 | 04 | Faltaban contratos explícitos de errores y trazabilidad | RESUELTA en este documento | 2026-08-29 |

## 10. Decisiones y estado

| Decisión | Estado | Fuente o evidencia de la decisión |
| :--- | :--- | :--- |
| Endpoints físicos y validaciones exactas de G1 a G5 | PENDIENTE | Ninguna |
| Adopción de RFC 9457 vs. formato propio de errores | PENDIENTE | Coordinación con B_REATEGUI |
| Mecanismo de validación de usuarios sin duplicar datos | PENDIENTE | Coordinación con G4 |
| Forma de consumo de áreas y permisos | PENDIENTE | Coordinación con G3 |

## 11. Preguntas pendientes

### 11.1 Para Geric (líder del Grupo 1 — RutaDoc)

1. ¿Qué nivel de detalle de referencias externas espera RutaDoc recibir de los grupos productores?
2. ¿RutaDoc consultará solo metadatos o también archivos binarios desde los módulos productores?
3. ¿Cómo debe interpretarse en el historial una referencia a una entidad dada de baja o inactiva?
4. ¿Cuál es el responsable de actualizar este documento 04 cuando cambie algún contrato?

### 11.2 Para el profesor

1. ¿El Grupo 6 debe mantener un único documento de coordinación (04) o desglosar contratos por módulo?
2. ¿Qué evidencia se requiere para dar por cerrado un riesgo de interconexión?
3. ¿Se espera que los contratos adopten RFC 9457 o es aceptable una estructura propia basada en buenas prácticas?
4. ¿El checklist de revisión debe incluir aprobación formal de los responsables de cada documento (01, 02, 03)?

### 11.3 Para la institución

1. ¿Existen nombres oficiales y códigos de identificación ya definidos para expedientes, áreas, usuarios y documentos?
2. ¿Qué reglas de vigencia y retención aplican a los datos referenciados entre módulos?
3. ¿Se requieren permisos o validaciones institucionales específicas para el intercambio de datos entre módulos?
4. ¿Existe un estándar institucional sobre trazabilidad o identificación de correlación que deba adoptarse?

## 12. Dependencias con otros módulos

| Grupo | Información requerida | Entidad local afectada | Riesgo si no se define | Estado | Acción de coordinación |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Grupo 2 | Identificador y vigencia del expediente | Referencia externa de expediente | Movimientos sin asociación válida | PENDIENTE | Acordar identificador, formato y vigencia |
| Grupo 3 | Áreas, roles y permisos | Referencia de área y permiso | Derivaciones o autorizaciones inválidas | PENDIENTE | Definir validación y vigencia |
| Grupo 4 | Identificador y estado del usuario | Referencia de usuario | Atribución inválida | PENDIENTE | Acordar validación sin duplicar datos |
| Grupo 5 | Identificador y versión del documento | Referencia de documento | Vínculos documentales rotos | PENDIENTE | Acordar contrato de consulta y tamaño |

## 13. Fuentes técnicas consultadas

- Estructura de decisiones de RutaDoc (referencia de estilo): `backend/docs/rutadoc/05_decisiones_y_preguntas_pendientes.md` en `origin/B_GERIC`.
- RFC 9110 (HTTP Semantics): https://www.rfc-editor.org/rfc/rfc9110.html
- RFC 9457 (Problem Details for HTTP APIs): https://www.rfc-editor.org/info/rfc9457/
- Express 5 Error Handling: https://expressjs.com/en/5x/guide/error-handling/
- OWASP API Security: https://owasp.org/www-project-api-security/

## 14. Fuentes o decisiones pendientes de comprobar

- Mecanismo en el que el Grupo 6 recopilará las respuestas formales de los líderes G2, G3, G4 y G5.
- Disponibilidad de bibliotecas para simular respuestas HTTP en pruebas (ej. nock en Node.js).
- Límite máximo de paginación adecuado para la memoria de Node/Express.

## 15. Registro de revisiones

| Versión | Fecha | Responsable | Cambio | Estado |
| :--- | :--- | :--- | :--- | :--- |
| 0.1 | 2026-08-29 | Arevalo | Creación del documento en la ruta oficial `backend/docs/integracion`, consolidando la matriz de contratos y riesgos y añadiendo contrato de errores, trazabilidad, checklist, observaciones y preguntas pendientes | **BORRADOR — PENDIENTE DE VALIDACIÓN** |
| 0.2 | 2026-08-29 | Arevalo | Recuperación de los documentos 01–03 como material base de coordinación en `backend/docs/integracion/`, actualización del checklist y del registro de observaciones para reflejar su procedencia y la ausencia de aportes individuales verificables en las ramas originalmente asignadas | **BORRADOR — PENDIENTE DE VALIDACIÓN** |
