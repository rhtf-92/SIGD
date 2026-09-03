# Modelo de datos RutaDoc v2

- Responsable del borrador: Geric
- Grupo: Grupo 1 — RutaDoc
- Fase: 2 — rediseño técnico
- Estado del documento: **PROPUESTO** para revisión y consolidación
- Versión documental: Borrador v0.1
- Commit base de elaboración: `f17d90d` (los presentes archivos aún no están versionados en Git)
- Fecha de línea base: 2026-09-02

## 1. Propósito y alcance de la Fase 2

Este documento prepara el modelo de datos v2 de RutaDoc sin implementar DDL ni código TypeScript. Su propósito es traducir la línea base documental a un diseño técnico trazable, compatible con PostgreSQL y apto para ser revisado junto con los entregables pendientes del Grupo 1 y los contratos de los demás grupos.

**CONFIRMADO por el plan específico:** un movimiento histórico registrado no se edita ni elimina y la proyección oficial no sustituye al historial.

**PROPUESTO:** usar `sigd_rut` como esquema propietario del dominio y mantener `movimiento_tramite` como raíz histórica append-only.

**PENDIENTE:** este borrador no cierra la matriz de estados/transiciones, la implementación física, los contratos externos ni el mecanismo definitivo de actualización de la proyección.

## 2. Fuentes documentales utilizadas

| Fuente | Uso | Tratamiento |
| --- | --- | --- |
| `backend/docs/INFORME_AUDITORIA_CONTRIBUCIONES_BACKEND.md` | Línea base de contribuciones y límites de evidencia. | **CONFIRMADO** como documento base; no convierte propuestas funcionales en reglas institucionales. |
| `backend/docs/Plan_de_mejora_nivel_backend_SIGD.md` | Arquitectura objetivo, UUID, esquemas, particionamiento, índices, Outbox y fases. | **CONFIRMADO** como plan rector; varios elementos siguen siendo metas, no implementación existente. |
| `backend/docs/README.md` | Portal, reglas documentales y rutas de planes. | **CONFIRMADO** como índice documental. |
| `backend/docs/levantamiento_de_observaciones/01_plan_levantamiento_observaciones_grupo_1_rutadoc.md` | Actividades, responsables y entregables de RutaDoc. | **CONFIRMADO** como plan específico. |
| Archivos v1 de `backend/docs/rutadoc/` | Línea base funcional, modelo, diccionario, SQL provisional, pruebas y decisiones. | **CONFIRMADO** como evidencia histórica; no se sobrescriben. |
| Análisis de Jacobo/Liz para Fase 2 | Propuesta funcional de estados, acciones, transiciones, reglas y flujo actualizado. | **PENDIENTE** de entrega y revisión; los nombres definitivos no se anticipan. |
| Implementación y pruebas de Jhasy | Verificación física del diseño. | **PENDIENTE**; no se implementan aquí. |

## 3. Límites del dominio RutaDoc

### 3.1 Propiedad interna

**PROPUESTO:** RutaDoc es propietario únicamente de:

- el historial de movimientos;
- los catálogos locales de acciones, estados y tipos de relación;
- las reglas locales de transición;
- los detalles de derivación, recepción, observación y atención;
- las relaciones entre movimientos;
- los vínculos referenciales con documentos;
- la proyección reconstruible del estado actual.

### 3.2 Límites externos

| Grupo | Contrato esperado | Estado |
| --- | --- | --- |
| Grupo 2 — TramiCore | `sigd_tra.expediente`, `id_expediente UUID` y CUT. | **PENDIENTE DE CONTRATO**; no se declara FK física. |
| Grupo 3 — OrganiCore | `sigd_org.area` e `id_area`. | **PENDIENTE DE CONTRATO**; no se declara FK física. |
| Grupo 4 — IdentiCore | `sigd_auth.cuenta_usuario` e `id_usuario`. | **PENDIENTE DE CONTRATO**; no se declara FK física. |
| Grupo 5 | Identificadores de documento y versión ya contemplados por v1. | **PENDIENTE**; el plan específico de Fase 2 no formaliza ese contrato. |
| Grupo 6 — CoreLink | Propiedad de `sigd_audit.evento_outbox` y contrato del payload. | **PENDIENTE DE CONTRATO**; RutaDoc no crea ni administra esa tabla. |

**CONFIRMADO como límite:** RutaDoc no duplica innecesariamente datos administrados por otros dominios. **PENDIENTE DE CONTRATO:** tipos UUID externos, disponibilidad histórica y tratamiento del CUT; este borrador no decide si el CUT se consulta, referencia o conserva bajo una necesidad justificada.

## 4. Agregados, entidades y relaciones internas

### 4.1 Agregado de trazabilidad

**PROPUESTO:** la identidad lógica del agregado es `id_expediente`, aunque el expediente sea externo. La secuencia única y monotónica por expediente es una invariancia requerida, pero su garantía física bajo particionamiento permanece **PENDIENTE**.

| Entidad | Permanencia propuesta y justificación | Relación o condición de revisión |
| --- | --- | --- |
| `movimiento_tramite` | Raíz necesaria para conservar cada hecho histórico. | Un expediente externo tiene `0..N` movimientos; append-only. |
| `accion_tramite` | Separa la clase de actuación del estado resultante y conserva interpretación histórica. | Una acción clasifica `0..N` movimientos; valores **PENDIENTES**. |
| `estado_tramite` | Permite interpretar el estado anterior y resultante sin fijarlos en código. | Catálogo versionable; valores **PENDIENTES**. |
| `transicion_estado_tramite` | Conserva trazabilidad de la regla aplicada, si aporta valor además del State Pattern. | **REVISABLE:** podría reducirse o eliminarse si el dominio TypeScript asume la regla y se preserva su versión de otra forma. |
| `derivacion_tramite` | Aísla origen, destino y motivo, datos que no corresponden a todo movimiento. | **REVISABLE:** validar que una tabla de detalle sea preferible a otra representación. |
| `recepcion_tramite` | Representa datos exclusivos de recepción y posible confirmación de derivación. | **REVISABLE:** cardinalidad y recepción manual **PENDIENTES**. |
| `observacion_tramite` | Separa motivo y detalle de una observación. | **REVISABLE:** obligatoriedad y forma dependen del análisis funcional. |
| `atencion_tramite` | Conserva el resultado específico de una atención. | **REVISABLE:** contenido mínimo y vínculo documental **PENDIENTES**. |
| `relacion_movimiento` | Permite relacionar hechos sin modificar el original. | Relación dirigida `N:M`; semántica oficial **PENDIENTE**. |
| `tipo_relacion_movimiento` | Evita codificar el significado de relaciones directamente. | Catálogo local revisable junto con `relacion_movimiento`. |
| `movimiento_documento` | Mantiene el vínculo histórico con evidencia externa sin duplicar archivos. | **REVISABLE:** permanencia, identificadores y cardinalidad dependen del contrato del Grupo 5. |
| `estado_actual_tramite` | Ofrece lectura rápida del estado sin sustituir el historial. | **REVISABLE:** proyección mutable y reconstruible; mecanismo físico **PENDIENTE**. |

**PROPUESTO:** conservar las doce entidades conceptuales de v1 para reducir ruptura y someterlas a validación. Su existencia física definitiva no queda aprobada por este documento.

## 5. Diseño provisional de `movimiento_tramite`

`movimiento_tramite` representa un hecho ocurrido, no una fila editable. Sus campos mínimos propuestos son:

| Campo | Función | Estado |
| --- | --- | --- |
| `movimiento_id UUID` | Identidad estable de dominio. | **PROPUESTO**. |
| `fecha_hora TIMESTAMPTZ` | Momento del hecho y clave de partición física. | **PROPUESTO**. |
| `id_expediente UUID` | Referencia a TramiCore. | **PENDIENTE DE CONTRATO**. |
| `secuencia BIGINT` | Orden inequívoco por expediente. | **PROPUESTO**; asignación concurrente **PENDIENTE** de Jhasy. |
| `accion_tramite_id UUID` | Acción local. | **PROPUESTO**. |
| `transicion_estado_tramite_id UUID` | Regla aplicada. | **PENDIENTE** de la matriz de Jacobo/Liz. |
| `estado_anterior_id UUID` | Estado previo; nulo solo en inicio admitido. | **PENDIENTE** de la matriz. |
| `estado_resultante_id UUID` | Estado producido. | **PROPUESTO**; valores **PENDIENTES**. |
| `id_usuario_actor UUID` | Actor externo de IdentiCore. | **PENDIENTE DE CONTRATO**. |
| `id_area_contexto UUID` | Área externa de OrganiCore. | **PENDIENTE DE CONTRATO**. |
| `observacion TEXT` | Contexto mínimo no estructurado. | **PROPUESTO** con minimización de datos. |
| `clave_idempotencia` — tipo **PENDIENTE** | Detección de reintentos lógicos. | Invariancia global **PENDIENTE**; no se fija UUID ni una UNIQUE física. |
| `correlation_id UUID` | Correlación técnica con operación/evento. | **PROPUESTO**; semántica **PENDIENTE** del contrato CoreLink. |

### 5.1 Identidad física y particionamiento

PostgreSQL exige que una restricción única o primaria de una tabla particionada incluya todas las columnas de partición. Por ello:

- **PROPUESTO:** identidad lógica `movimiento_id` y candidata a clave física compuesta `(fecha_hora, movimiento_id)`.
- **PENDIENTE:** la secuencia única por expediente no queda garantizada agregando `fecha_hora` a una UNIQUE, porque dos fechas distintas permitirían repetir la misma secuencia.
- **PENDIENTE:** la idempotencia global tampoco se expresa como UNIQUE sobre el padre particionado mientras no incluya la clave de partición o exista otra estructura capaz de garantizarla.
- **ALTERNATIVAS PROPUESTAS:** fila guardiana no particionada por expediente; registro no particionado de identidades/comandos; control transaccional sobre una proyección propia; cambio de clave de partición; o garantía limitada por partición solo si se demuestra que un expediente nunca cruza años.
- Jhasy debe validar la alternativa mediante DDL y pruebas, incluido un expediente con movimientos en 2026 y 2027. No se presenta una PK, secuencia o clave idempotente global como físicamente garantizada.

## 6. Proyección `estado_actual_tramite`

**PROPUESTO:** conservar una proyección de lectura, nunca la fuente de verdad. Contendría `id_expediente`, referencia compuesta al último movimiento, `estado_actual_id`, `secuencia_actual`, `actualizado_en` y `version_proyeccion`.

Invariantes propuestos:

1. un máximo de una proyección por expediente;
2. la secuencia proyectada no retrocede;
3. estado, secuencia y movimiento proceden del mismo evento;
4. el valor puede reconstruirse ordenando el historial;
5. un fallo al registrar la proyección oficial provoca rollback del movimiento y su detalle, y no permite publicar un estado contradictorio.

**CONFIRMADO por el plan específico:** la proyección oficial se actualiza de forma determinista dentro de la misma transacción del caso de uso. Permanece **PENDIENTE** elegir el mecanismo:

| Alternativa | Ventaja | Riesgo |
| --- | --- | --- |
| Servicio de aplicación en la misma transacción | Reglas visibles en el dominio y pruebas unitarias. | Debe impedir escrituras que eludan el servicio. |
| Trigger `AFTER INSERT` mínimo | Cobertura ante cualquier escritor SQL. | Lógica menos visible y acoplamiento al esquema. |

**PROPUESTO:** preferir el servicio de aplicación y reservar el trigger mínimo como alternativa a decidir con Jhasy. Una proyección secundaria distinta de `estado_actual_tramite` podría ser asíncrona, pero nunca reemplazaría la proyección oficial.

**PROPUESTO sujeto al contrato Outbox:** movimiento, detalle, proyección oficial y registro Outbox forman una unidad atómica; el fallo de cualquiera provoca rollback conjunto. Hasta confirmar el contrato del Grupo 6, esta frontera transaccional permanece **PENDIENTE DE CONTRATO** para Outbox.

## 7. Estrategia de inmutabilidad

**CONFIRMADO por el plan específico:** un movimiento histórico registrado no se edita ni elimina.

**PROPUESTO:** una rectificación se representa creando un nuevo movimiento relacionado, sin alterar el original.

**PENDIENTE:** la semántica, las causales y la autorización oficial de rectificación deben proceder del análisis de Jacobo/Liz y de validación institucional.

**PROPUESTO:** defensa en capas:

1. entidades TypeScript sin operaciones de mutación retrospectiva;
2. permisos de persistencia que concedan `INSERT` y lectura, no `UPDATE`/`DELETE` ordinarios sobre datos históricos;
3. protección coherente de `movimiento_tramite`, sus detalles, `relacion_movimiento` y los vínculos históricos de `movimiento_documento`;
4. rectificación mediante `relacion_movimiento`, conservando causa, actor y tiempo;
5. pruebas negativas de `UPDATE` y `DELETE`.

Son históricos e inmutables conceptualmente: el movimiento, sus detalles, las relaciones entre movimientos y los vínculos documentales históricos. Los catálogos son versionables y administrables sin reescribir su uso histórico; `estado_actual_tramite` es una proyección mutable y reconstruible. El mecanismo físico —privilegios, restricciones o triggers mínimos— corresponde a Jhasy y permanece **PENDIENTE**.

Las correcciones administrativas excepcionales, retención y anonimización permanecen **PENDIENTES** de política institucional; no deben resolverse ocultamente mediante permisos amplios.

## 8. Particionamiento anual 2026–2027

**PROPUESTO como diseño, no DDL:** particionar `sigd_rut.movimiento_tramite` por rango de `fecha_hora`:

| Partición conceptual | Rango UTC semiabierto | Estado |
| --- | --- | --- |
| `movimiento_tramite_2026` | `[2026-01-01 00:00:00+00, 2027-01-01 00:00:00+00)` | **PROPUESTO**. |
| `movimiento_tramite_2027` | `[2027-01-01 00:00:00+00, 2028-01-01 00:00:00+00)` | **PROPUESTO**. |
| Partición por defecto o política posterior | Fechas fuera de los rangos preparados. | **PENDIENTE** de operación. |

Se requiere probar routing de borde, consulta con pruning, creación anticipada de la siguiente partición, restauración y efecto sobre claves/FK. La zona horaria de negocio no debe alterar los límites físicos UTC sin decisión explícita.

## 9. Estrategia de índices

### 9.1 B-Tree

**PROPUESTO:**

- `(id_expediente, secuencia DESC)` para reconstrucción y último movimiento;
- `(id_expediente, fecha_hora DESC)` para cronología;
- índices locales sobre claves foráneas internas;
- un mecanismo de acceso para idempotencia solo después de definir cómo se garantizará esa invariancia global;
- índices sobre `id_usuario_actor`, `id_area_contexto` y `correlation_id` únicamente como **CANDIDATOS PENDIENTES** de una consulta consumidora, selectividad y evidencia `EXPLAIN`;
- índices en áreas de origen/destino y relación origen/destino solo si los planes de consulta los justifican.

### 9.2 BRIN

**PROPUESTO:** BRIN sobre `fecha_hora` en particiones voluminosas y naturalmente correlacionadas con inserción temporal. No sustituye los B-Tree de búsqueda por expediente. Su adopción exige comparación de tamaño y `EXPLAIN (ANALYZE, BUFFERS)` con datos representativos; el umbral queda **PENDIENTE** de Jhasy.

## 10. Dominio TypeScript y persistencia

No se implementa TypeScript en este avance. La correspondencia esperada es:

| Dominio | Persistencia | Regla |
| --- | --- | --- |
| `MovimientoTramite` | `sigd_rut.movimiento_tramite` | Evento inmutable; UUID como valor opaco. |
| `EstadoTramite`, `AccionTramite` | Catálogos locales | Códigos versionables, no `enum` definitivo mientras falte la matriz. |
| Detalles de movimiento | Tablas especializadas | Solo el detalle compatible con la acción. |
| `EstadoActualTramite` | Proyección | Derivado, reconstruible y no raíz del agregado. |
| Repositorio RutaDoc | Operaciones SQL futuras | Inserción atómica de movimiento/detalle/proyección oficial y Outbox según contrato. |

**PENDIENTE:** nombres de tipos, comandos, errores, puertos, repositorios, implementador y código TypeScript. Geric diseña, documenta, consolida y revisa; este documento no le atribuye la implementación TypeScript.

## 11. Relación conceptual con Outbox

**PROPUESTO por la arquitectura del plan rector:** ubicar `evento_outbox` en `sigd_audit` bajo el ámbito previsto de CoreLink (Grupo 6).

**PROPUESTO:** un caso de uso RutaDoc produce una intención de evento en la misma transacción cuando el contrato lo permita. No se fijan aquí campos ni estructura del payload.

**PENDIENTE DE CONTRATO:** ownership definitivo, nombres, obligatoriedad, esquema JSON, versionado, correlación, idempotencia, estados de publicación y procedimiento de escritura. Jacobo/Liz define la propuesta funcional de eventos y el Grupo 6 confirma el contrato. RutaDoc no define la tabla ni presupone una FK hacia ella.

## 12. Matriz de diferencias v1–v2

| Tema | v1 existente | v2 propuesto | Estado |
| --- | --- | --- | --- |
| Esquema | Tablas sin esquema explícito en el SQL v1. | `sigd_rut`. | **PROPUESTO** por plan rector. |
| Identificadores internos | `BIGINT`; externos `VARCHAR(64)`. | UUID internos y externos contractuales. | **PROPUESTO**; externos **PENDIENTES DE CONTRATO**. |
| Historial | Entidad central e inmutable. | Se conserva y refuerza por capas. | **CONFIRMADO**. |
| Partición | No existe. | Rango anual 2026–2027 por `fecha_hora`. | **PROPUESTO**. |
| PK del movimiento | `movimiento_id BIGINT`. | Identidad UUID y candidata a clave física compatible con partición. | **PENDIENTE** de validación física. |
| Estado actual | Trigger de actualización en v1. | Servicio o trigger mínimo, ambos dentro de la misma transacción. | Mecanismo **PENDIENTE**. |
| Estados/transiciones | 10 estados de ejemplo y 13 acciones; SQL prueba una matriz provisional. | No se fija catálogo hasta recibir análisis Jacobo/Liz. | **PENDIENTE**. |
| Concurrencia | Advisory lock por hash de expediente. | Evaluación real y alternativas en decisiones. | **PENDIENTE** de pruebas de Jhasy. |
| Índices | B-Tree básicos. | B-Tree por acceso y BRIN temporal condicionado a evidencia. | **PROPUESTO**. |
| Idempotencia/correlación | Clave textual de idempotencia; sin correlación. | Invariancias y tipos todavía por definir. | **PENDIENTE**. |
| Outbox | Ausente. | Integración conceptual sin ownership. | **PENDIENTE DE CONTRATO** con Grupo 6. |

## 13. Supuestos, pendientes y riesgos

| Elemento | Estado | Riesgo y tratamiento |
| --- | --- | --- |
| Liz y Jacobo son la misma integrante. | **CONFIRMADO** como aclaración organizativa proporcionada por Geric el 2026-09-02; no es un hecho demostrado por Git. | Se conserva la autoría histórica; la aclaración se registra en decisiones. |
| Matriz de estados y transiciones. | **PENDIENTE** de Jacobo/Liz. | No generar seeds, `CHECK` ni enums definitivos. |
| DDL, restricciones, índices y pruebas físicas. | **PENDIENTE** de Jhasy. | Este modelo no se considera implementado. |
| Contratos UUID de Grupos 2, 3 y 4. | **PENDIENTE DE CONTRATO**. | No declarar FK físicas externas. |
| Ownership de Outbox y payload de Grupo 6. | **PENDIENTE DE CONTRATO**. | `sigd_audit`/CoreLink es arquitectura propuesta; RutaDoc no crea la tabla. |
| Documento/versión del Grupo 5. | **PENDIENTE** heredado de v1. | Confirmar si continúa en el alcance de Fase 2. |
| Partición y PK/UK globales. | **PENDIENTE** de prueba PostgreSQL. | Una definición incompatible invalidaría migraciones y referencias locales. |
| Secuencia única e idempotencia global. | **PENDIENTE** de diseño físico y prueba, incluido cruce 2026–2027. | Duplicados, esperas u orden incorrecto bajo concurrencia y entre particiones. |
| Observaciones y resultados en texto libre. | **PROPUESTO** con control. | Minimizar datos personales y definir límites/retención. |

## 14. Criterio de consolidación

Este borrador no acredita actividad terminada. Podrá consolidarse cuando existan: análisis v2 de Jacobo/Liz; decisión y pruebas físicas de Jhasy; contratos de los grupos propietarios; trazabilidad de cambios frente a v1; y evidencia de pruebas de integridad, concurrencia, particionado, rendimiento y recuperación.
