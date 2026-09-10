# Diccionario preliminar de datos de RutaDoc

- Responsable: Geric
- Rama: B_GERIC
- Grupo: Grupo 1 — RutaDoc
- Estado: PROPUESTA PRELIMINAR
- Validación institucional: PENDIENTE

## 1. Propósito

Este diccionario traduce el modelo lógico de RutaDoc a definiciones conceptuales consistentes para sus entidades y atributos preliminares. Distingue claves propias, relaciones entre entidades locales, referencias a recursos administrados por otros grupos y valores derivados del historial.

Su contenido servirá posteriormente como base para que B_JHASY prepare el diseño físico y el SQL. En esta etapa no se definen tipos de PostgreSQL, longitudes, índices ni restricciones físicas. Los nombres, formatos y reglas se mantienen como **PROPUESTOS**, y toda decisión institucional no confirmada permanece **PENDIENTE**.

## 2. Convenciones

1. Los nombres conceptuales se escriben en singular y en `snake_case`.
2. El sufijo `_id` identifica claves propias, claves locales o referencias externas según la clasificación declarada en cada atributo.
3. El sufijo `_en` se reserva para momentos de tiempo cuando corresponda. Los nombres funcionales indicados expresamente por el modelo, como `fecha_hora`, `vigente_desde` y `vigente_hasta`, se mantienen como propuestas preliminares.
4. Los catálogos utilizan códigos lógicos estables y únicos, aunque su valor deje de estar activo para nuevas operaciones.
5. Las marcas de clave o referencia significan:
   - `PK`: identificador principal propio.
   - `FK local`: referencia a otra entidad administrada por RutaDoc.
   - `REF externa`: referencia a un recurso administrado por otro grupo.
   - `UK`: unicidad lógica propuesta.
   - `DERIVADO`: valor calculado o proyectado desde el historial.
6. La obligatoriedad se expresa como `Obligatorio`, `Opcional` o `Condicional`. Un valor condicional solo se exige cuando la acción, relación o regla aplicable lo necesita.
7. Los formatos conceptuales admitidos son `identificador`, `código`, `texto breve`, `texto descriptivo`, `entero secuencial`, `fecha-hora` e `indicador lógico`.
8. Ningún formato conceptual equivale todavía a un tipo físico de PostgreSQL.
9. Todos los nombres de entidades y atributos permanecen **PROPUESTOS** y pueden ajustarse tras la coordinación institucional y técnica.

## 3. Entidades propias

Las doce entidades coinciden exactamente con el modelo lógico aprobado para esta etapa. No se agregan ni eliminan entidades.

| Entidad | Clasificación | Propósito | Entidad propietaria | Carácter histórico | Estado de validación |
| --- | --- | --- | --- | --- | --- |
| `movimiento_tramite` | Principal | Registrar cada evento del recorrido. | RutaDoc | Histórico e inmutable. | **PROPUESTO** |
| `accion_tramite` | Catálogo | Clasificar la actuación del movimiento. | RutaDoc | Conserva valores usados históricamente. | Valores oficiales **PENDIENTES** |
| `estado_tramite` | Catálogo | Clasificar la situación resultante. | RutaDoc | Conserva valores usados históricamente. | Valores oficiales **PENDIENTES** |
| `transicion_estado_tramite` | Regla configurable | Relacionar estado anterior, acción y estado resultante. | RutaDoc | Su vigencia permite interpretar movimientos. | Matriz oficial **PENDIENTE** |
| `derivacion_tramite` | Detalle opcional | Ampliar un movimiento de derivación o devolución. | RutaDoc | Parte del evento histórico. | **PROPUESTO** |
| `recepcion_tramite` | Detalle opcional | Ampliar una confirmación de recepción. | RutaDoc | Parte del evento histórico. | Recepción manual **PENDIENTE** |
| `observacion_tramite` | Detalle opcional | Conservar el motivo de una observación. | RutaDoc | Parte del evento histórico. | **PROPUESTO** |
| `atencion_tramite` | Detalle opcional | Conservar el resultado conceptual de la atención. | RutaDoc | Parte del evento histórico. | Criterio de atención **PENDIENTE** |
| `relacion_movimiento` | Asociación | Vincular movimientos sin modificar los originales. | RutaDoc | Histórica. | Tipos permitidos **PENDIENTES** |
| `tipo_relacion_movimiento` | Catálogo | Clasificar relaciones entre movimientos. | RutaDoc | Conserva valores usados históricamente. | Valores oficiales **PENDIENTES** |
| `movimiento_documento` | Asociación externa | Vincular movimientos con documentos del Grupo 5. | RutaDoc para el vínculo; Grupo 5 para el documento. | Histórica. | Contrato externo **PENDIENTE** |
| `estado_actual_tramite` | Proyección opcional | Facilitar la consulta del último estado válido. | RutaDoc | Derivada, no fuente histórica. | **PROPUESTA PENDIENTE DE DECISIÓN** |

## 4. Atributos por entidad

Los atributos siguientes son preliminares. Sus formatos son conceptuales y no representan tipos físicos.

### 4.1 `movimiento_tramite`

| Atributo propuesto | Descripción conceptual | Formato conceptual | Obligatoriedad | Clave o referencia | Validación o pendiente |
| --- | --- | --- | --- | --- | --- |
| `movimiento_id` | Identificador propio del evento histórico. | identificador | Obligatorio | PK | Estrategia física **PENDIENTE**. |
| `expediente_id` | Expediente al que pertenece el movimiento. | identificador | Obligatorio | REF externa, Grupo 2 | Contrato **PENDIENTE**. |
| `secuencia` | Orden lógico dentro del expediente. | entero secuencial | Obligatorio | UK con `expediente_id` | Asignación concurrente **PENDIENTE**. |
| `accion_tramite_id` | Acción aplicada. | identificador | Obligatorio | FK local | Valores oficiales **PENDIENTES**. |
| `transicion_estado_tramite_id` | Transición conceptual aplicada. | identificador | Condicional | FK local | Condicional mientras se valida el catálogo. |
| `estado_anterior_id` | Estado previo del recorrido. | identificador | Condicional | FK local | Puede faltar solo en el movimiento inicial, como **PROPUESTA**. |
| `estado_resultante_id` | Estado producido por la actuación. | identificador | Obligatorio | FK local | Valores oficiales **PENDIENTES**. |
| `usuario_actor_id` | Usuario identificable que ejecuta la actuación. | identificador | Condicional | REF externa, Grupo 4 | Obligatorio para actuaciones internas. Para REGISTRO_EXTERNO u otros eventos externos depende del contrato con los Grupos 2 y 4. **PENDIENTE**. |
| `area_contexto_id` | Área donde ocurre la actuación. | identificador | Condicional | REF externa, Grupo 3 | Depende de la acción. |
| `fecha_hora` | Momento efectivo de la actuación. | fecha-hora | Obligatorio | — | Generación física **PENDIENTE**. |
| `observacion` | Explicación general complementaria. | texto descriptivo | Opcional | — | Obligatoriedad por acción **PENDIENTE**. |
| `clave_idempotencia` | Referencia propuesta para evitar solicitudes duplicadas. | código | Condicional | UK propuesta | Origen y alcance **PENDIENTES**. |

El solicitante no se almacena obligatoriamente en cada movimiento porque pertenece conceptualmente al expediente y puede ser distinto del actor. La referencia de un solicitante externo no registrado permanece **PENDIENTE** de coordinación con los Grupos 2 y 4.

### 4.2 `accion_tramite`

| Atributo propuesto | Descripción conceptual | Formato conceptual | Obligatoriedad | Clave o referencia | Validación o pendiente |
| --- | --- | --- | --- | --- | --- |
| `accion_tramite_id` | Identificador propio de la acción. | identificador | Obligatorio | PK | Estrategia física **PENDIENTE**. |
| `codigo` | Código lógico estable de la acción. | código | Obligatorio | UK | Valores oficiales **PENDIENTES**. |
| `nombre` | Denominación descriptiva. | texto breve | Obligatorio | — | Nombre oficial **PENDIENTE**. |
| `descripcion` | Significado conceptual. | texto descriptivo | Obligatorio | — | Validación institucional **PENDIENTE**. |
| `activo` | Disponibilidad para nuevas operaciones. | indicador lógico | Obligatorio | — | No elimina usos históricos. |
| `vigente_desde` | Inicio conceptual de vigencia. | fecha-hora | Opcional | — | Regla de vigencia **PENDIENTE**. |
| `vigente_hasta` | Fin conceptual de vigencia. | fecha-hora | Opcional | — | Regla de vigencia **PENDIENTE**. |

### 4.3 `estado_tramite`

| Atributo propuesto | Descripción conceptual | Formato conceptual | Obligatoriedad | Clave o referencia | Validación o pendiente |
| --- | --- | --- | --- | --- | --- |
| `estado_tramite_id` | Identificador propio del estado. | identificador | Obligatorio | PK | Estrategia física **PENDIENTE**. |
| `codigo` | Código lógico estable. | código | Obligatorio | UK | Valores oficiales **PENDIENTES**. |
| `nombre` | Denominación descriptiva. | texto breve | Obligatorio | — | Nombre oficial **PENDIENTE**. |
| `descripcion` | Significado conceptual. | texto descriptivo | Obligatorio | — | Validación institucional **PENDIENTE**. |
| `es_terminal` | Indica si no admite continuación ordinaria. | indicador lógico | Condicional | — | Estados terminales **PENDIENTES**. |
| `activo` | Disponibilidad para nuevas operaciones. | indicador lógico | Obligatorio | — | No elimina usos históricos. |
| `vigente_desde` | Inicio conceptual de vigencia. | fecha-hora | Opcional | — | Regla **PENDIENTE**. |
| `vigente_hasta` | Fin conceptual de vigencia. | fecha-hora | Opcional | — | Regla **PENDIENTE**. |

### 4.4 `transicion_estado_tramite`

| Atributo propuesto | Descripción conceptual | Formato conceptual | Obligatoriedad | Clave o referencia | Validación o pendiente |
| --- | --- | --- | --- | --- | --- |
| `transicion_estado_tramite_id` | Identificador propio de la transición. | identificador | Obligatorio | PK | Estrategia física **PENDIENTE**. |
| `estado_anterior_id` | Estado desde el cual se aplica. | identificador | Condicional | FK local | Puede faltar en la transición inicial propuesta. |
| `accion_tramite_id` | Acción que provoca el cambio. | identificador | Obligatorio | FK local | Valores oficiales **PENDIENTES**. |
| `estado_resultante_id` | Estado producido. | identificador | Obligatorio | FK local | Valores oficiales **PENDIENTES**. |
| `condicion_descriptiva` | Condición conceptual para permitirla. | texto descriptivo | Opcional | — | Reglas institucionales **PENDIENTES**. |
| `activo` | Disponibilidad para nuevas operaciones. | indicador lógico | Obligatorio | — | Conserva interpretación histórica. |
| `vigente_desde` | Inicio conceptual de vigencia. | fecha-hora | Opcional | — | Regla **PENDIENTE**. |
| `vigente_hasta` | Fin conceptual de vigencia. | fecha-hora | Opcional | — | Regla **PENDIENTE**. |

La combinación lógica de estado anterior, acción y estado resultante deberá ser única durante una misma vigencia, como **PROPUESTA**.

### 4.5 `derivacion_tramite`

| Atributo propuesto | Descripción conceptual | Formato conceptual | Obligatoriedad | Clave o referencia | Validación o pendiente |
| --- | --- | --- | --- | --- | --- |
| `movimiento_id` | Movimiento principal del detalle. | identificador | Obligatorio | PK y FK local | Solo con acción compatible. |
| `area_origen_id` | Área desde la que se traslada. | identificador | Obligatorio | REF externa, Grupo 3 | Contrato **PENDIENTE**. |
| `area_destino_id` | Área hacia la que se traslada. | identificador | Obligatorio | REF externa, Grupo 3 | Contrato **PENDIENTE**. |
| `motivo` | Justificación funcional del traslado. | texto descriptivo | Obligatorio | — | Reglas institucionales **PENDIENTES**. |

La acción del movimiento determina si este detalle representa derivación o devolución; ambas denominaciones permanecen **PROPUESTAS**.

### 4.6 `recepcion_tramite`

| Atributo propuesto | Descripción conceptual | Formato conceptual | Obligatoriedad | Clave o referencia | Validación o pendiente |
| --- | --- | --- | --- | --- | --- |
| `movimiento_id` | Movimiento principal de recepción. | identificador | Obligatorio | PK y FK local | Solo con acción compatible. |
| `derivacion_movimiento_id` | Movimiento de derivación confirmado. | identificador | Condicional | FK local | **PENDIENTE** confirmar si toda recepción requiere derivación. |
| `area_receptora_id` | Área que confirma la recepción. | identificador | Condicional | REF externa, Grupo 3 | Depende de recepción inicial o derivada. |
| `observacion_recepcion` | Explicación complementaria. | texto descriptivo | Opcional | — | Regla **PENDIENTE**. |

### 4.7 `observacion_tramite`

| Atributo propuesto | Descripción conceptual | Formato conceptual | Obligatoriedad | Clave o referencia | Validación o pendiente |
| --- | --- | --- | --- | --- | --- |
| `movimiento_id` | Movimiento principal observado. | identificador | Obligatorio | PK y FK local | Solo con acción compatible. |
| `motivo` | Razón principal de la observación. | texto breve | Obligatorio | — | Criterios **PENDIENTES**. |
| `detalle` | Explicación ampliada. | texto descriptivo | Opcional | — | Contenido **PENDIENTE**. |

No se incorporan plazos ni responsables de subsanación porque no han sido confirmados.

### 4.8 `atencion_tramite`

| Atributo propuesto | Descripción conceptual | Formato conceptual | Obligatoriedad | Clave o referencia | Validación o pendiente |
| --- | --- | --- | --- | --- | --- |
| `movimiento_id` | Movimiento principal de atención. | identificador | Obligatorio | PK y FK local | Solo con acción compatible. |
| `resultado_resumen` | Síntesis conceptual del resultado. | texto descriptivo | Obligatorio | — | Contenido mínimo **PENDIENTE**. |

La respuesta documental externa se vincula mediante `movimiento_documento`; no se duplica dentro de este detalle.

### 4.9 `relacion_movimiento`

| Atributo propuesto | Descripción conceptual | Formato conceptual | Obligatoriedad | Clave o referencia | Validación o pendiente |
| --- | --- | --- | --- | --- | --- |
| `relacion_movimiento_id` | Identificador propio de la relación. | identificador | Obligatorio | PK | Estrategia física **PENDIENTE**. |
| `movimiento_origen_id` | Movimiento que origina la relación lógica. | identificador | Obligatorio | FK local | Dirección permitida **PENDIENTE**. |
| `movimiento_destino_id` | Movimiento relacionado como destino lógico. | identificador | Obligatorio | FK local | Dirección permitida **PENDIENTE**. |
| `tipo_relacion_movimiento_id` | Significado de la relación. | identificador | Obligatorio | FK local | Catálogo oficial **PENDIENTE**. |
| `motivo` | Justificación de la relación. | texto descriptivo | Condicional | — | Depende del tipo. |
| `registrado_en` | Momento de registro del vínculo. | fecha-hora | Obligatorio | — | Generación física **PENDIENTE**. |

Origen y destino describen funciones dentro de la relación entre movimientos; no representan áreas institucionales.

### 4.10 `tipo_relacion_movimiento`

| Atributo propuesto | Descripción conceptual | Formato conceptual | Obligatoriedad | Clave o referencia | Validación o pendiente |
| --- | --- | --- | --- | --- | --- |
| `tipo_relacion_movimiento_id` | Identificador propio del tipo. | identificador | Obligatorio | PK | Estrategia física **PENDIENTE**. |
| `codigo` | Código lógico estable. | código | Obligatorio | UK | Valores oficiales **PENDIENTES**. |
| `nombre` | Denominación descriptiva. | texto breve | Obligatorio | — | Nombre oficial **PENDIENTE**. |
| `descripcion` | Significado conceptual. | texto descriptivo | Obligatorio | — | Validación **PENDIENTE**. |
| `activo` | Disponibilidad para nuevas relaciones. | indicador lógico | Obligatorio | — | No elimina relaciones históricas. |

### 4.11 `movimiento_documento`

| Atributo propuesto | Descripción conceptual | Formato conceptual | Obligatoriedad | Clave o referencia | Validación o pendiente |
| --- | --- | --- | --- | --- | --- |
| `movimiento_id` | Movimiento relacionado. | identificador | Obligatorio | FK local; parte de UK propuesta | — |
| `documento_id` | Documento administrado externamente. | identificador | Obligatorio | REF externa, Grupo 5; parte de UK | Contrato **PENDIENTE**. |
| `finalidad` | Propósito conceptual del vínculo. | código | Obligatorio | Parte de UK propuesta | Valores **PENDIENTES**. |
| `version_documento_id` | Versión documental externa. | identificador | Opcional | REF externa, Grupo 5; parte de UK | Existencia y contrato **PENDIENTES**. |

Se propone como clave lógica la combinación de movimiento, documento, versión y finalidad. Será ajustable cuando el Grupo 5 defina su contrato.

### 4.12 `estado_actual_tramite`

| Atributo propuesto | Descripción conceptual | Formato conceptual | Obligatoriedad | Clave o referencia | Validación o pendiente |
| --- | --- | --- | --- | --- | --- |
| `expediente_id` | Expediente resumido por la proyección. | identificador | Obligatorio | REF externa, Grupo 2; clave lógica | Proyección **PENDIENTE**. |
| `movimiento_actual_id` | Último movimiento válido interpretado. | identificador | Obligatorio | FK local; DERIVADO | Debe coincidir con el historial. |
| `estado_actual_id` | Estado resultante vigente. | identificador | Obligatorio | FK local; DERIVADO | Debe coincidir con el movimiento. |
| `secuencia_actual` | Secuencia del último movimiento válido. | entero secuencial | Obligatorio | DERIVADO | Reconstruible. |
| `actualizado_en` | Momento de actualización de la proyección. | fecha-hora | Obligatorio | DERIVADO | Estrategia física **PENDIENTE**. |
| `version_proyeccion` | Control conceptual de actualización. | entero secuencial | Obligatorio | DERIVADO | Uso técnico **PENDIENTE**. |

Todos sus valores derivan del historial. Esta entidad podrá eliminarse del diseño si la proyección opcional no se aprueba; nunca reemplazará `movimiento_tramite` como fuente de verdad.

## 5. Claves primarias y foráneas

Las claves siguientes son conceptuales y **PROPUESTAS**. No expresan sintaxis ni tipos físicos.

### 5.1 Claves primarias propias

| Entidad | Clave propuesta | Observación |
| --- | --- | --- |
| `movimiento_tramite` | `movimiento_id` | Identifica el evento histórico central. |
| `accion_tramite` | `accion_tramite_id` | Identifica el catálogo de acciones. |
| `estado_tramite` | `estado_tramite_id` | Identifica el catálogo de estados. |
| `transicion_estado_tramite` | `transicion_estado_tramite_id` | Identifica la regla conceptual. |
| `derivacion_tramite` | `movimiento_id` | PK y FK local al único movimiento propietario. |
| `recepcion_tramite` | `movimiento_id` | PK y FK local al único movimiento propietario. |
| `observacion_tramite` | `movimiento_id` | PK y FK local al único movimiento propietario. |
| `atencion_tramite` | `movimiento_id` | PK y FK local al único movimiento propietario. |
| `relacion_movimiento` | `relacion_movimiento_id` | Identifica el vínculo histórico. |
| `tipo_relacion_movimiento` | `tipo_relacion_movimiento_id` | Identifica el catálogo de relaciones. |
| `estado_actual_tramite` | `expediente_id` | Clave lógica de la proyección opcional, no entidad histórica principal. |

`movimiento_documento` se identifica mediante su clave única conceptual compuesta; la necesidad de un identificador propio permanece **PENDIENTE** y no modifica los 69 atributos actuales.

### 5.2 Claves foráneas locales

| Entidad | Atributo | Referencia local | Condición |
| --- | --- | --- | --- |
| `movimiento_tramite` | `accion_tramite_id` | `accion_tramite` | Obligatoria. |
| `movimiento_tramite` | `transicion_estado_tramite_id` | `transicion_estado_tramite` | Condicional mientras se valida la matriz. |
| `movimiento_tramite` | `estado_anterior_id` | `estado_tramite` | Condicional; puede faltar en el inicio. |
| `movimiento_tramite` | `estado_resultante_id` | `estado_tramite` | Obligatoria. |
| Cada detalle especializado | `movimiento_id` | `movimiento_tramite` | Obligatoria y exclusiva. |
| `recepcion_tramite` | `derivacion_movimiento_id` | `movimiento_tramite` | Condicional; regla de recepción **PENDIENTE**. |
| `relacion_movimiento` | `movimiento_origen_id` | `movimiento_tramite` | Obligatoria. |
| `relacion_movimiento` | `movimiento_destino_id` | `movimiento_tramite` | Obligatoria. |
| `relacion_movimiento` | `tipo_relacion_movimiento_id` | `tipo_relacion_movimiento` | Obligatoria. |
| `movimiento_documento` | `movimiento_id` | `movimiento_tramite` | Obligatoria. |
| `estado_actual_tramite` | `movimiento_actual_id` | `movimiento_tramite` | Obligatoria si se aprueba la proyección. |
| `estado_actual_tramite` | `estado_actual_id` | `estado_tramite` | Obligatoria si se aprueba la proyección. |

### 5.3 Referencias externas

| Atributo | Grupo propietario | Uso local |
| --- | --- | --- |
| `expediente_id` | Grupo 2 | Asociar movimientos y proyección con el expediente. |
| `usuario_actor_id` | Grupo 4 | Identificar al actor que ejecuta el movimiento. |
| `area_contexto_id`, `area_origen_id`, `area_destino_id`, `area_receptora_id` | Grupo 3 | Conservar el contexto y recorrido entre áreas. |
| `documento_id`, `version_documento_id` | Grupo 5 | Vincular evidencia y respuesta documental. |

### 5.4 Claves únicas conceptuales

| Entidad | Combinación única propuesta | Pendiente |
| --- | --- | --- |
| `movimiento_tramite` | `expediente_id` + `secuencia` | Asignación concurrente. |
| Catálogos | `codigo` | Valores institucionales. |
| `transicion_estado_tramite` | `estado_anterior_id` + `accion_tramite_id` + `estado_resultante_id` + vigencia aplicable | Representación de vigencia. |
| `relacion_movimiento` | `movimiento_origen_id` + `movimiento_destino_id` + `tipo_relacion_movimiento_id` | Excepciones justificadas. |
| `movimiento_documento` | `movimiento_id` + `documento_id` + `version_documento_id` + `finalidad` | Contrato del Grupo 5. |
| `estado_actual_tramite` | Un registro por `expediente_id` | Solo si se aprueba la proyección. |

## 6. Relaciones y cardinalidades

| Entidad A | Entidad B | A respecto de B | B respecto de A | Validación |
| --- | --- | --- | --- | --- |
| Expediente externo | `movimiento_tramite` | Un expediente tiene `0..N` movimientos. | Cada movimiento pertenece a `1` expediente. | **PROPUESTO** |
| `accion_tramite` | `movimiento_tramite` | Una acción clasifica `0..N` movimientos. | Cada movimiento tiene `1` acción. | **PROPUESTO** |
| Estado anterior | `movimiento_tramite` | Un estado antecede a `0..N` movimientos. | Cada movimiento tiene `0..1` estado anterior. | Inicio sin estado **PROPUESTO**. |
| Estado resultante | `movimiento_tramite` | Un estado resulta de `0..N` movimientos. | Cada movimiento tiene `1` estado resultante. | **PROPUESTO** |
| `transicion_estado_tramite` | `movimiento_tramite` | Una transición se aplica a `0..N` movimientos. | Cada movimiento aplica `0..1` transición mientras sea condicional. | Obligatoriedad **PENDIENTE**. |
| `movimiento_tramite` | Cada detalle especializado | Un movimiento tiene `0..1` detalle de cada clase compatible. | Cada detalle pertenece exactamente a `1` movimiento. | Compatibilidad obligatoria. |
| `derivacion_tramite` | `recepcion_tramite` | Una derivación origina `0..1` recepción confirmatoria. | Una recepción confirma `0..1` derivación por admitir recepción inicial. | Cardinalidad `1` a `0..1` **PENDIENTE**. |
| `movimiento_tramite` | `movimiento_tramite` | Un movimiento relaciona `0..N` movimientos. | Un movimiento es relacionado por `0..N` movimientos. | `N:M` mediante `relacion_movimiento`. |
| `tipo_relacion_movimiento` | `relacion_movimiento` | Un tipo clasifica `0..N` relaciones. | Cada relación tiene `1` tipo. | **PROPUESTO** |
| `movimiento_tramite` | Documento externo | Un movimiento vincula `0..N` documentos. | Un documento se vincula con `0..N` movimientos. | `N:M` mediante `movimiento_documento`. |
| Expediente externo | `estado_actual_tramite` | Un expediente tiene `0..1` proyección. | Cada proyección corresponde a `1` expediente. | Proyección opcional **PENDIENTE**. |

Cada detalle pertenece a un único movimiento y un movimiento solo admite el detalle compatible con su acción. Usuarios, áreas, expedientes y documentos continúan siendo externos a RutaDoc.

## 7. Catálogos propuestos

Todos los valores siguientes son **EJEMPLOS PROPUESTOS**, nunca términos oficiales. Podrán cambiar cuando la institución confirme su vocabulario.

### 7.1 Acciones de ejemplo

| Código de ejemplo | Descripción conceptual | Validación |
| --- | --- | --- |
| `REGISTRO_EXTERNO` | Refleja el registro realizado por el Grupo 2. | **PROPUESTO** |
| `RECEPCION` | Confirma recepción inicial o en destino. | **PROPUESTO**, mecanismo **PENDIENTE** |
| `INICIAR_REVISION` | Inicia la evaluación del trámite. | **PROPUESTO** |
| `OBSERVACION` | Registra una necesidad de corrección. | **PROPUESTO** |
| `CORRECCION` | Registra una actuación correctiva. | **PROPUESTO** |
| `INCORPORACION_ADJUNTO` | Vincula un adjunto al recorrido. | **PROPUESTO** |
| `DERIVACION` | Envía el trámite hacia otra área. | **PROPUESTO** |
| `DEVOLUCION` | Retorna el trámite con justificación. | **PROPUESTO** |
| `INICIAR_ATENCION` | Inicia la preparación de la respuesta. | **PROPUESTO** |
| `ATENCION` | Registra resultado o respuesta. | **PROPUESTO** |
| `CIERRE` | Finaliza el flujo activo bajo condiciones futuras. | **PROPUESTO**, reglas **PENDIENTES** |
| `REAPERTURA` | Retoma un trámite cerrado. | **PROPUESTO**, reglas **PENDIENTES** |
| `RECTIFICACION` | Corrige mediante un nuevo movimiento. | **PROPUESTO** |

### 7.2 Estados de ejemplo

| Código de ejemplo | Descripción conceptual | Validación |
| --- | --- | --- |
| `REGISTRADO` | Existe referencia externa del expediente. | **PROPUESTO** |
| `PENDIENTE_RECEPCION` | Envío aún no confirmado por el destino. | **PROPUESTO**, recepción manual **PENDIENTE** |
| `RECIBIDO` | Recepción confirmada. | **PROPUESTO** |
| `EN_REVISION` | Evaluación en curso. | **PROPUESTO** |
| `OBSERVADO` | Requiere corrección o información adicional. | **PROPUESTO** |
| `EN_ATENCION` | Preparación de respuesta en curso. | **PROPUESTO** |
| `ATENDIDO` | Resultado o respuesta registrados. | **PROPUESTO** |
| `CERRADO` | Flujo activo finalizado. | **PROPUESTO**, condiciones **PENDIENTES** |
| `REABIERTO` | Trámite cerrado retomado. | **PROPUESTO** |
| `DEVUELTO` | Situación posterior a una devolución. | **PENDIENTE**; podría ser acción y no estado. |

### 7.3 Tipos de relación de ejemplo

| Código de ejemplo | Descripción conceptual | Validación |
| --- | --- | --- |
| `RECTIFICA` | Un movimiento corrige a otro. | **PROPUESTO** |
| `SUBSANA` | Un movimiento responde a una observación. | **PROPUESTO** |
| `CONFIRMA_DERIVACION` | Una recepción confirma una derivación. | **PROPUESTO**, regla **PENDIENTE** |
| `REABRE` | Una reapertura se relaciona con un cierre. | **PROPUESTO** |
| `RESPONDE_A` | Un movimiento responde a otro evento previo. | **PROPUESTO** |

### 7.4 Finalidades documentales de ejemplo

| Código de ejemplo | Descripción conceptual | Validación |
| --- | --- | --- |
| `SUSTENTO` | Documento que respalda una actuación. | **PROPUESTO** |
| `CORRECCION` | Documento relacionado con una corrección. | **PROPUESTO** |
| `RESPUESTA` | Documento que contiene la respuesta. | **PROPUESTO** |
| `ADJUNTO` | Documento añadido al recorrido. | **PROPUESTO** |

## 8. Referencias a entidades externas

| Referencia | Grupo propietario | Entidad local que la utiliza | Propósito | Validación esperada | Tratamiento histórico | Pendiente contractual |
| --- | --- | --- | --- | --- | --- | --- |
| `expediente_id` | Grupo 2 | `movimiento_tramite`, `estado_actual_tramite` | Asociar historial y proyección con el expediente. | Existencia y disponibilidad. | Conservar la referencia aunque se inactive. | Identificador, consulta histórica y solicitante externo. |
| `usuario_actor_id` | Grupo 4 | `movimiento_tramite` | Identificar al actor que ejecuta la actuación. | Existencia, vigencia y autorización aplicable. | Conservar la referencia sin duplicar datos personales. | Usuarios inactivos y acceso histórico. |
| `area_contexto_id` | Grupo 3 | `movimiento_tramite` | Indicar dónde ocurre la actuación. | Área válida cuando la acción la requiera. | Conservar contexto histórico. | Vigencia e interpretación de cambios. |
| `area_origen_id` | Grupo 3 | `derivacion_tramite` | Identificar origen del traslado. | Área válida y aplicable. | Conservar origen histórico. | Áreas modificadas o inactivas. |
| `area_destino_id` | Grupo 3 | `derivacion_tramite` | Identificar destino del traslado. | Área válida y aplicable. | Conservar destino histórico. | Áreas modificadas o inactivas. |
| `area_receptora_id` | Grupo 3 | `recepcion_tramite` | Identificar área que recibe. | Área válida cuando corresponda. | Conservar recepción histórica. | Recepción inicial y manual. |
| `documento_id` | Grupo 5 | `movimiento_documento` | Vincular un documento con el movimiento. | Existencia y finalidad permitida. | Conservar referencia y finalidad. | Acceso a documentos inactivos. |
| `version_documento_id` | Grupo 5 | `movimiento_documento` | Identificar versión documental cuando exista. | Existencia y correspondencia con documento. | Conservar versión histórica. | Contrato de versiones **PENDIENTE**. |

El solicitante y el actor son conceptos distintos. Un solicitante externo no registrado podría no poseer `usuario_actor_id`, porque ese atributo identifica a quien ejecuta el movimiento. Su referencia permanece **PENDIENTE** de coordinación con los Grupos 2 y 4.

## 9. Restricciones conceptuales

Todas las reglas siguientes son **PROPUESTAS** y no constituyen SQL:

1. La secuencia será única dentro de cada expediente.
2. Cada movimiento estará asociado con un único expediente externo.
3. La acción y el estado resultante serán obligatorios.
4. El estado anterior será opcional únicamente en el inicio sin estado local.
5. El actor y la fecha-hora serán obligatorios para las actuaciones internas; el tratamiento de eventos externos permanece **PENDIENTE**.
6. El área será obligatoria cuando la acción la requiera.
7. Cada movimiento solo tendrá el detalle compatible con su acción.
8. Una derivación conservará origen, destino y motivo.
9. Una recepción se relacionará con su derivación si se confirma esa regla institucional.
10. Existirá una sola confirmación válida por derivación mientras se mantenga la cardinalidad propuesta.
11. Una observación conservará su motivo.
12. Una atención conservará un resultado.
13. Una relación vinculará movimientos distintos, salvo excepción futura justificada y validada.
14. Un cierre ocurrirá después de una atención válida.
15. Una reapertura se relacionará con un cierre anterior.
16. Una rectificación se relacionará con el movimiento original.
17. Los valores de catálogo usados históricamente no se eliminarán.
18. Las referencias externas serán válidas al registrar la actuación.
19. La proyección opcional será coherente y reconstruible desde el historial.
20. Ninguna corrección sobrescribirá ni eliminará movimientos históricos.
21. La idempotencia y la concurrencia permanecen **PENDIENTES** de implementación técnica.

## 10. Datos sensibles y auditoría

RutaDoc conservará identificadores externos y el contexto mínimo del movimiento; no copiará DNI, nombres, credenciales, archivos ni otros datos personales administrados por módulos externos. Las observaciones, motivos y resultados deberán evitar información personal innecesaria.

El acceso al historial dependerá de roles y permisos verificados externamente. El historial funcional explica el recorrido del trámite, mientras que la auditoría técnica registra aspectos operativos o de seguridad; no son conceptos equivalentes. Los intentos rechazados solo se auditarán si la institución lo aprueba y no se convertirán automáticamente en movimientos funcionales.

Las políticas de retención, anonimización, visibilidad, acceso y atención de derechos sobre datos permanecen **PENDIENTES** de validación institucional. Toda prueba utilizará datos ficticios y no documentos reales.

## 11. Elementos pendientes de validación

### 11.1 Institucionales

- Nombres oficiales de acciones, estados y relaciones.
- Recepción manual y tratamiento definitivo de `DEVUELTO`.
- Rutas paralelas, roles, permisos, responsables y plazos.
- Condiciones de atención, cierre, reapertura y archivo.
- Auditoría de intentos rechazados, retención, anonimización y visibilidad.

### 11.2 Contratos con otros grupos

- Identificadores y disponibilidad de expedientes, usuarios, áreas, documentos y versiones.
- Referencia del solicitante externo no registrado con los Grupos 2 y 4.
- Vigencia e interpretación histórica de recursos externos modificados o desactivados.
- Validación de permisos, acceso histórico y comportamiento ante indisponibilidad.

### 11.3 Modelo lógico

- Matriz oficial de transiciones y obligatoriedad de `transicion_estado_tramite_id`.
- Cardinalidad entre derivación y recepción confirmatoria.
- Valores de catálogos y reglas de vigencia.
- Necesidad definitiva de `estado_actual_tramite`.
- Excepciones a relaciones entre movimientos y claves únicas conceptuales.

### 11.4 Implementación técnica para B_JHASY

- Tipos físicos, longitudes y representación de identificadores.
- Índices y restricciones físicas.
- Transacciones, bloqueos, aislamiento y asignación concurrente de secuencias.
- Implementación de idempotencia y consistencia de la proyección.
- Estrategia de conservación, rendimiento, recuperación y pruebas físicas.
