# Decisiones del levantamiento RutaDoc

- Responsable del registro: Geric
- Grupo: Grupo 1 — RutaDoc
- Estado: borrador **PROPUESTO** para revisión
- Versión documental: Borrador v0.1
- Commit base de elaboración: `f17d90d` (los presentes archivos aún no están versionados en Git)
- Fecha de línea base: 2026-09-02

## 1. Propósito y reglas del registro

Este documento separa decisiones oficiales, propuestas técnicas y preguntas pendientes para la Fase 2. No modifica la autoría histórica, no implementa DDL o TypeScript y no acredita actividades terminadas sin evidencia.

Estados admitidos:

- **CONFIRMADO:** respaldado por documentos base o por aclaración organizativa expresa.
- **PROPUESTO:** alternativa técnica recomendada, todavía revisable.
- **PENDIENTE:** requiere decisión, contrato, entrega o prueba.
- **EJEMPLO:** valor ilustrativo sin carácter oficial.

Cada registro incluye identificador, estado, contexto, alternativas, decisión o pregunta, responsable, impacto y evidencia.

## 2. Registro de decisiones

### RUT-DEC-001 — Identidad Liz/Jacobo

| Campo | Registro |
| --- | --- |
| Estado | **CONFIRMADO** |
| Contexto | Los archivos v1 atribuyen el análisis a “Liz” y la rama a `B_JACOBO`. |
| Alternativas | Tratar los nombres como dos personas; corregir retrospectivamente los documentos; registrar una equivalencia prospectiva. |
| Decisión o pregunta | Liz y Jacobo son la misma integrante del Grupo 1 — RutaDoc. En adelante ambas referencias se interpretan como la misma persona. Los documentos históricos conservan su autoría literal y no se reescriben. |
| Responsable | Geric, como fuente de la aclaración y líder backend. |
| Impacto | Unifica seguimiento y responsabilidad sin alterar evidencia histórica. |
| Evidencia | Aclaración organizativa expresa de Geric del 2026-09-02; no es un hecho demostrado por Git. El encabezado de `backend/docs/rutadoc/01_analisis_trazabilidad_recepcion_derivacion_atencion.md` registra “Liz” y `B_JACOBO`, pero no demuestra por sí solo la identidad. |

### RUT-DEC-002 — Conservación de v1 y separación de v2

| Campo | Registro |
| --- | --- |
| Estado | **CONFIRMADO** |
| Contexto | Los artefactos v1 son evidencia de Fase 1 y contienen decisiones provisionales. |
| Alternativas | Sobrescribir v1; editarlo para parecer v2; crear archivos separados. |
| Decisión o pregunta | Conservar todos los archivos v1 sin modificación y desarrollar `02_modelo_datos_rutadoc_v2.md`, `02_diccionario_datos_rutadoc_v2.md` y este registro por separado. |
| Responsable | Geric. |
| Impacto | Mantiene trazabilidad de cambios y evita atribución retrospectiva. |
| Evidencia | Instrucción expresa de Geric; `backend/docs/levantamiento_de_observaciones/01_plan_levantamiento_observaciones_grupo_1_rutadoc.md`, sección 5 “Distribución Detallada de Actividades”; historial existente en `backend/docs/rutadoc/`. |

### RUT-DEC-003 — Historial como fuente de verdad

| Campo | Registro |
| --- | --- |
| Estado | **CONFIRMADO** |
| Contexto | El análisis y modelo v1 exigen conservar el recorrido sin sobrescribir movimientos. |
| Alternativas | Solo estado actual; historial mutable; eventos append-only con proyección. |
| Decisión o pregunta | `movimiento_tramite` conserva los hechos históricos y no se edita ni elimina; `estado_actual_tramite` es derivado y no sustituye el historial. |
| Responsable | Grupo 1; Geric consolida el diseño. |
| Impacto | Condiciona API, persistencia, permisos, pruebas y recuperación. |
| Evidencia | `backend/docs/levantamiento_de_observaciones/01_plan_levantamiento_observaciones_grupo_1_rutadoc.md`, sección 3 “Límites y Criterios de Validación”; análisis v1, secciones 1, 5 y 9. |

### RUT-DEC-003B — Rectificación mediante nuevo movimiento

| Campo | Registro |
| --- | --- |
| Estado | **PROPUESTO** |
| Contexto | El v1 propone rectificar sin reescribir el movimiento original. |
| Alternativas | Modificar el hecho original; nuevo movimiento sin vínculo; nuevo movimiento relacionado. |
| Decisión o pregunta | Representar preliminarmente una rectificación mediante un nuevo movimiento relacionado. H1 no cierra esta regla; su semántica, causales y autorización oficial siguen **PENDIENTES** de validación institucional. |
| Responsable | Geric documenta la propuesta; Jacobo/Liz aporta el análisis funcional. |
| Impacto | Preserva evidencia, pero condiciona relaciones, dominio y permisos. |
| Evidencia | `backend/docs/rutadoc/02_modelo_datos_trazabilidad.md`, secciones 5.9 y 10; `backend/docs/rutadoc/05_decisiones_y_preguntas_pendientes.md`, secciones 3 y 6. |

### RUT-DEC-004 — Matriz textual de 10 estados y 13 transiciones

| Campo | Registro |
| --- | --- |
| Estado | **PENDIENTE** |
| Contexto | El v1 enumera 10 estados de **EJEMPLO** y 13 acciones de **EJEMPLO**; acción y transición no son equivalentes. El plan específico contiene la única cifra textual explícita: 10 estados y 13 transiciones. H1 obtiene 13 estados y 16 aristas estado→estado como **INFERENCIA NO CONTRACTUAL** reproducible mediante conteo del diagrama del Blueprint; al añadir una flecha inicial y dos terminales resultan 19 flechas totales. |
| Alternativas | Usar provisionalmente la cifra textual 10/13; considerar el conteo inferido 13/16 únicamente como evidencia para aclaración; o solicitar validación institucional de una matriz reconciliada. La inferencia no constituye catálogo oficial, contractual ni aprobado. |
| Decisión o pregunta | H1 fue recibido, revisado e integrado; la reconciliación entre las fuentes permanece **PENDIENTE DE ACLARACIÓN**. No trasladar automáticamente 13/16 a seeds, enums, `CHECK`, tablas, DDL o TypeScript. Los nombres y correspondencias institucionales continúan pendientes. |
| Responsable | Jacobo/Liz entregó H1; Geric lo revisó e integró; reconciliación institucional pendiente. |
| Impacto | Afecta estados, acciones, transiciones, pruebas, API y migraciones. |
| Evidencia | `backend/docs/levantamiento_de_observaciones/01_plan_levantamiento_observaciones_grupo_1_rutadoc.md`, sección 2, punto 1 “Desacoplamiento de la Máquina de Estados”; `backend/docs/rutadoc/02_diccionario_datos_trazabilidad.md`, secciones 7.1 y 7.2; H1 integrado `backend/docs/rutadoc/01_analisis_dominio_transiciones_rutadoc.md`, commit `8934c54`, merge `ade5e03`, PR `#71`. |

### RUT-DEC-005 — Límites y esquema de RutaDoc

| Campo | Registro |
| --- | --- |
| Estado | **PROPUESTO** |
| Contexto | El plan rector separa esquemas y asigna a RutaDoc la trazabilidad. |
| Alternativas | Tablas sin esquema; esquema compartido; `sigd_rut` con referencias externas. |
| Decisión o pregunta | Diseñar las tablas propias bajo `sigd_rut` y no crear tablas de expedientes, áreas, cuentas, documentos u Outbox. |
| Responsable | Geric; validación física de Jhasy. |
| Impacto | Reduce colisiones y aclara ownership. |
| Evidencia | `backend/docs/Plan_de_mejora_nivel_backend_SIGD.md`, sección 5.2 “Modelo Entidad-Relación Global”; plan específico, sección 7 “Dependencias con Otros Grupos”. |

### RUT-DEC-006 — UUID internos de RutaDoc

| Campo | Registro |
| --- | --- |
| Estado | **PROPUESTO** |
| Contexto | El plan rector ordena UUID; el SQL v1 usa BIGINT interno y VARCHAR externo. |
| Alternativas | Mantener tipos v1; migrar a UUID; tipos adaptadores por contrato. |
| Decisión o pregunta | Proponer UUID para las identidades internas de RutaDoc. No se aplica esta decisión a `clave_idempotencia`, cuyo tipo sigue pendiente. |
| Responsable | Geric diseña y documenta; Jhasy valida la forma física posteriormente. |
| Impacto | Afecta PK/FK locales, serialización, pruebas y migración. |
| Evidencia | `backend/docs/Plan_de_mejora_nivel_backend_SIGD.md`, sección 5.8 “Matriz de Estandarización de Tipos de Datos y Claves Intermodulares”; `backend/docs/rutadoc/03_trazabilidad_movimientos.sql`, sección 2. |

### RUT-DEC-006B — Tipos y FKs de referencias externas

| Campo | Registro |
| --- | --- |
| Estado | **PENDIENTE** |
| Contexto | El plan rector propone UUID, pero los contratos propietarios aún no están confirmados. |
| Alternativas | Declarar tipos/FKs anticipadamente; duplicar datos; conservar referencias contractuales pendientes. |
| Decisión o pregunta | Confirmar con Grupos 2, 3 y 4 los UUID de expediente, área y usuario, así como el tratamiento del CUT. No se declara ninguna FK física externa antes del contrato. |
| Responsable | Grupos 2, 3 y 4 confirman; Geric consolida; Jhasy implementa después. |
| Impacto | Integridad, migraciones, disponibilidad y consulta histórica. |
| Evidencia | Plan específico, sección 7 “Dependencias con Otros Grupos”; arquitectura propuesta en el plan rector, sección 5.8. |

### RUT-DEC-007 — Particionamiento 2026–2027

| Campo | Registro |
| --- | --- |
| Estado | **PROPUESTO** |
| Contexto | El plan específico exige partición anual y el plan rector menciona 2026–2027. PostgreSQL restringe claves únicas de tablas particionadas. |
| Alternativas | Sin partición; rango anual por `fecha_hora`; registro de identidades separado; particiones con claves compuestas. |
| Decisión o pregunta | Diseñar rangos UTC 2026 y 2027 por `fecha_hora`. La secuencia única por expediente y la idempotencia global permanecen pendientes: agregar la fecha a una UNIQUE no las garantiza. Evaluar fila guardiana por expediente, registro no particionado de identidades/comandos, cambio de clave de partición o garantía por partición solo si un expediente no cruza años. |
| Responsable | Geric diseña; Jhasy valida e implementa. |
| Impacto | Modifica PK/FK, índices, consultas y operación anual. |
| Evidencia | Plan específico, sección 2.4 “Particionamiento Anual de Movimientos” y sección 5 “Jhasy”; plan rector, sección 4, matriz de mejoras. La compatibilidad física requiere prueba PostgreSQL. |

### RUT-DEC-008 — Alternativas para `estado_actual_tramite`

| Campo | Registro |
| --- | --- |
| Estado | **CONFIRMADO** |
| Contexto | v1 usa trigger `AFTER INSERT`; el plan específico también pide reducir triggers y trasladar reglas a aplicación. |
| Alternativas | Servicio o trigger mínimo, siempre dentro de la misma transacción. La asincronía solo podría emplearse para otra proyección secundaria. |
| Decisión o pregunta | La proyección oficial `estado_actual_tramite` se actualiza determinísticamente dentro de la misma transacción. El mecanismo concreto permanece pendiente en una decisión separada. |
| Responsable | Geric consolida el requisito; Jhasy valida la implementación física. |
| Impacto | Consistencia, latencia, complejidad de dominio y recuperación. |
| Evidencia | Plan específico, sección 3 “Límites y Criterios de Validación”; SQL v1, sección 4.2. |

### RUT-DEC-008B — Mecanismo de actualización de la proyección

| Campo | Registro |
| --- | --- |
| Estado | **PENDIENTE** |
| Contexto | La frontera transaccional está definida, pero el plan contiene tensión entre trasladar reglas al dominio y permitir triggers de proyección en su checklist. |
| Alternativas | Servicio de aplicación en la misma transacción; trigger mínimo `AFTER INSERT` en la misma transacción. |
| Decisión o pregunta | Se propone preferir el servicio. Jhasy debe demostrar atomicidad, reconstrucción y comportamiento ante fallo. Movimiento, detalle y proyección oficial deben confirmar o revertir juntos; Outbox se incorpora a esa unidad cuando su contrato lo confirme. |
| Responsable | Geric diseña y revisa; Jhasy prueba e implementa la alternativa aprobada. |
| Impacto | Atomicidad, visibilidad de reglas, pruebas y recuperación. |
| Evidencia | Plan específico, sección 2, punto 1; sección 3; sección 8; SQL v1, sección 4.2. |

### RUT-DEC-009 — Evaluación real del advisory lock v1

| Campo | Registro |
| --- | --- |
| Estado | **PENDIENTE** |
| Contexto | El SQL v1 ejecuta `pg_advisory_xact_lock(hashtextextended(NEW.expediente_id, 0))` antes de validar la secuencia. |
| Alternativas | Mantener lock por expediente; `SELECT ... FOR UPDATE` sobre expediente externo; fila guardiana/proyección propia; control optimista por versión; solo unicidad y reintento. |
| Decisión o pregunta | El lock existente es transaccional y está particionado lógicamente por el hash del expediente; no es un lock global único. Serializa expedientes con la misma clave/hash y existe riesgo teórico de colisión. No hay evidencia en el repositorio de contención, deadlocks o throughput real. Jhasy debe medir concurrencia y elegir una alternativa sin depender de bloquear una tabla externa cuyo contrato aún no existe. |
| Responsable | Jhasy evalúa; Geric revisa. |
| Impacto | Orden de secuencia, latencia, acoplamiento y capacidad concurrente. |
| Evidencia | `backend/docs/rutadoc/03_trazabilidad_movimientos.sql`, sección 4.4; `backend/docs/rutadoc/04_validacion_trazabilidad.md`, sección 4, no documenta una prueba concurrente reproducible. |

### RUT-DEC-010 — Triggers que podrían permanecer

| Campo | Registro |
| --- | --- |
| Estado | **PENDIENTE** |
| Contexto | v1 contiene triggers de inmutabilidad, proyección, compatibilidad de detalles, validación principal, relaciones y relaciones obligatorias. El plan pide reducirlos. |
| Alternativas | Mantener todos; eliminar todos; conservar solo invariantes estructurales difíciles de evadir y trasladar reglas de negocio al dominio. |
| Decisión o pregunta | Podría permanecer el trigger de inmutabilidad como defensa final. Podrían mantenerse validaciones diferidas estrictamente estructurales si una restricción declarativa no basta. Proyección, matriz de estados, secuencia y compatibilidad por acción deben evaluarse para servicio/restricción declarativa. Ningún trigger queda aprobado sin prueba y ownership explícito. |
| Responsable | Geric define criterio; Jhasy aporta DDL y pruebas. |
| Impacto | Transparencia de reglas, acceso SQL directo, testabilidad y mantenimiento. |
| Evidencia | SQL v1, sección 4; plan específico, sección 2, punto 1 y sección 8 “Lista de verificación para la entrega del levantamiento de observaciones”, cuyos alcances sobre proyecciones deben reconciliarse. |

### RUT-DEC-011 — Índices B-Tree y BRIN

| Campo | Registro |
| --- | --- |
| Estado | **PROPUESTO** |
| Contexto | RutaDoc requiere recorrido por expediente y búsquedas temporales; v1 solo contiene índices B-Tree. |
| Alternativas | B-Tree generalizado; B-Tree selectivo; BRIN temporal; combinación medida. |
| Decisión o pregunta | Proponer B-Tree para expediente/secuencia y expediente/fecha. Actor, área y correlación son candidatos pendientes hasta identificar consultas y selectividad. BRIN temporal solo se adopta para particiones grandes correlacionadas. Todo índice requiere `EXPLAIN (ANALYZE, BUFFERS)` y comparación de tamaño. |
| Responsable | Geric propone; Jhasy mide. |
| Impacto | Latencia de lectura, costo de escritura y almacenamiento. |
| Evidencia | SQL v1, sección 3; plan específico, sección 5 “Jhasy”; plan rector, sección 4, matriz de mejoras. |

### RUT-DEC-012 — Ownership de `sigd_audit.evento_outbox`

| Campo | Registro |
| --- | --- |
| Estado | **PENDIENTE** |
| Contexto | El plan rector propone `sigd_audit`/CoreLink como ubicación arquitectónica de Outbox, pero no existe todavía contrato intergrupal confirmado. |
| Alternativas | RutaDoc crea su Outbox; tabla compartida sin dueño; CoreLink propietario con contrato de escritura/publicación. |
| Decisión o pregunta | Confirmar ownership, payload, versionado, correlación, idempotencia, estados, permisos y escritura transaccional. RutaDoc solo modela su relación conceptual como productor y no fija campos concretos. |
| Responsable | Grupo 6 confirma el contrato; Jacobo/Liz entregó en H1 la propuesta funcional no contractual de eventos; Geric consolida la dependencia y revisa su integración. |
| Impacto | Atomicidad, integración, reintentos, auditoría y despliegue. |
| Evidencia | `backend/docs/Plan_de_mejora_nivel_backend_SIGD.md`, sección 5.2, relaciona `MOVIMIENTO_TRAMITE` con `EVENTO_OUTBOX`, y sección 5.8 presenta `sigd_audit` (CoreLink) con `evento_outbox` como arquitectura propuesta; plan específico, sección 7, mantiene pendiente el contrato de payload. |

### RUT-DEC-013 — Contratos de Grupos 2, 3 y 4

| Campo | Registro |
| --- | --- |
| Estado | **PENDIENTE** |
| Contexto | RutaDoc necesita expediente, áreas y actor, pero no es propietario de esas tablas. |
| Alternativas | Duplicar datos; declarar FK anticipadas; conservar UUID sin FK hasta contrato. |
| Decisión o pregunta | Grupo 2 debe confirmar `sigd_tra.expediente`, `id_expediente UUID` y el tratamiento del CUT; Grupo 3, `sigd_org.area` e `id_area`; Grupo 4, `sigd_auth.cuenta_usuario` e `id_usuario`. Hasta entonces no se declaran FK físicas externas ni se decide si el CUT se consulta, referencia o conserva. |
| Responsable | Grupos 2, 3 y 4 confirman; Geric consolida; Jhasy implementa después. |
| Impacto | Integridad referencial, disponibilidad, históricos y autorización. |
| Evidencia | Plan específico, sección 7 “Dependencias con Otros Grupos”; precisión contractual proporcionada por Geric el 2026-09-02. |

### RUT-DEC-014 — Dependencia documental del Grupo 5

| Campo | Registro |
| --- | --- |
| Estado | **PENDIENTE** |
| Contexto | v1 contiene `movimiento_documento` y referencias a documento/versión del Grupo 5; la lista contractual explícita de esta Fase 2 menciona Grupos 2, 3, 4 y 6. |
| Alternativas | Eliminar el vínculo; inventar contrato; conservarlo sin tipo/FK y solicitar aclaración. |
| Decisión o pregunta | Se conserva conceptualmente para no perder alcance histórico, pero no se fija tabla, esquema, identificador ni FK. ¿Debe formar parte del contrato formal de esta Fase 2? |
| Responsable | Geric solicita aclaración; Grupo 5 confirma si corresponde. |
| Impacto | Atención, evidencia documental, diccionario y API. |
| Evidencia | Modelo v1, secciones 5.11 y 12; diccionario v1, secciones 4.11 y 8; plan específico, sección 7. |

### RUT-DEC-015 — Idempotencia, correlación y auditoría

| Campo | Registro |
| --- | --- |
| Estado | **PENDIENTE** |
| Contexto | v1 incluye clave de idempotencia textual; v2 requiere integración por Outbox y auditoría. |
| Alternativas | Sin clave; clave por expediente; clave global; correlación solo en Outbox; correlación también en movimiento. |
| Decisión o pregunta | Definir tipo, origen, alcance, propagación, nulabilidad y garantía global de `clave_idempotencia`; no se fija UUID ni UNIQUE física. `correlation_id UUID` permanece como candidato sujeto al contrato CoreLink. La idempotencia es una invariancia, no un índice de rendimiento. |
| Responsable | Geric propone; Jhasy valida persistencia; Grupo 6 confirma contrato. |
| Impacto | Reintentos, diagnóstico, duplicados e integración. |
| Evidencia | SQL v1, sección 2, tabla `movimiento_tramite`; plan rector, secciones 5.2 y 5.8; contrato del Grupo 6 todavía ausente. |

### RUT-DEC-016 — Relación dominio TypeScript–persistencia

| Campo | Registro |
| --- | --- |
| Estado | **PROPUESTO** |
| Contexto | El plan exige trasladar la máquina de estados al dominio TypeScript. Asigna a Geric modelo, diccionario, decisiones, diseño y consolidación; a Jacobo, la especificación formal del State Pattern. No identifica de manera inequívoca al implementador TypeScript. |
| Alternativas | Tipos acoplados a filas; dominio independiente con repositorios; reglas solo en triggers. |
| Decisión o pregunta | Modelar el movimiento como evento inmutable y la proyección como lectura derivada; ocultar SQL tras puertos/repositorios. Nombres y código concretos quedan pendientes del entregable TypeScript y no se implementan aquí. |
| Responsable | Geric diseña, documenta, consolida y revisa; implementador TypeScript **PENDIENTE**. |
| Impacto | Testabilidad, límites transaccionales y mantenimiento. |
| Evidencia | Plan específico, secciones 4 y 5; plan rector, sección 5.1 “Arquitectura en Capas: Monolito Modular con Clean Architecture”. |

### RUT-DEC-017 — Estado de estos entregables

| Campo | Registro |
| --- | --- |
| Estado | **CONFIRMADO** |
| Contexto | Los tres documentos son borradores previos a entregas y contratos. |
| Alternativas | Declarar actividad terminada por existencia de archivos; mantener estado de borrador trazable. |
| Decisión o pregunta | H1 fue recibido, revisado, aprobado documentalmente para integración e integrado mediante PR `#71`. Esto no aprueba un catálogo institucional ni acredita implementación. H3 de Jhasy, los contratos externos, la reconciliación funcional y las pruebas permanecen **PENDIENTES**. |
| Responsable | Geric. |
| Impacto | Evita presentar diseño documental como implementación verificada. |
| Evidencia | Instrucción expresa de Geric; plan específico, sección 8 “Lista de verificación para la entrega del levantamiento de observaciones”, cuyos criterios permanecen sin marcar. |

## 3. Pendientes por responsable

### 3.1 Jacobo/Liz

- **CONFIRMADO:** H1 documental entregado e integrado mediante commit `8934c54`, merge `ade5e03` y PR `#71`; sus dieciséis filas son candidatos documentales, no catálogo institucional definitivo.
- **PENDIENTE:** definir nombres y correspondencia de los 10 estados y 13 transiciones indicados por el plan específico, distinguiéndolos de las 13 acciones de ejemplo del v1.
- **PENDIENTE:** definir si recepción manual, devolución, cierre, reapertura y rutas paralelas son reglas o ejemplos.

### 3.2 Jhasy

- **PENDIENTE:** proponer DDL v2 en su entregable, sin modificar estos borradores como sustituto.
- **PENDIENTE:** validar clave primaria, secuencia única, idempotencia global y FKs bajo particionamiento 2026–2027, incluido un expediente que cruce ambos años.
- **PENDIENTE:** medir advisory lock y alternativas con concurrencia real.
- **PENDIENTE:** justificar cada trigger restante y cada índice con pruebas.
- **PENDIENTE:** verificar inmutabilidad, idempotencia, proyección, rollback y recuperación.

### 3.3 Grupos externos

| Grupo | Contrato pendiente | Preguntas mínimas |
| --- | --- | --- |
| Grupo 2 | `sigd_tra.expediente`, `id_expediente UUID`, CUT. | Existencia, vigencia, consulta histórica y tratamiento del CUT sin decidir anticipadamente si se consulta, referencia o conserva. |
| Grupo 3 | `sigd_org.area`, `id_area`. | Vigencia, áreas inactivas, autorización y jerarquía. |
| Grupo 4 | `sigd_auth.cuenta_usuario`, `id_usuario`. | Actor inactivo, eventos de sistema y acceso histórico. |
| Grupo 5 | Documento y versión contemplados en v1, sin nombres ni tipos contractuales fijados. | Confirmar si el vínculo continúa en Fase 2, sus identificadores, versiones y acceso histórico. |
| Grupo 6 | Ownership de `sigd_audit.evento_outbox` y payload. | Escritura atómica, versión, correlación, idempotencia, publicación y reintentos. |

## 4. Traspaso controlado a H3 — Jhasy

“Listo para prototipo” significa que existe base documental suficiente para experimentar y producir evidencia en un entorno desechable; no significa aprobación para producción, contrato definitivo ni actividad terminada.

### 4.1 LISTO PARA PROTOTIPO

- Esquema local `sigd_rut` y tablas exclusivamente propiedad de RutaDoc.
- PK y FK locales, sujetas a validación física y sin extender contratos a otros dominios.
- Particiones experimentales 2026–2027 y prueba de un expediente que cruce ambos años.
- Defensa de inmutabilidad del historial.
- Instalación y rollback reproducibles en un entorno desechable.
- Evaluación de B-Tree y BRIN mediante mediciones y planes de ejecución.

### 4.2 REQUIERE EVALUACIÓN EN H3

- Secuencia por expediente e idempotencia global.
- Advisory lock existente y sus alternativas.
- Mecanismo único de actualización de la proyección oficial.
- Permanencia de las entidades marcadas como revisables.
- Triggers mínimos justificables mediante invariantes y pruebas.

### 4.3 NO FIJAR TODAVÍA

- Seeds definitivos de estados y transiciones.
- FK externas o tipos externos contractuales.
- Contrato físico Outbox o payload definitivo.
- Política de rutas paralelas.
- Reglas institucionales no confirmadas, incluidas recepción, devolución, cierre, reapertura y rectificación.

## 5. Evidencias que faltan para cerrar decisiones

1. PR o commit identificable de cada entregable de Fase 2.
2. Matriz reconciliada y revisada, no solo conteos.
3. DDL instalable/reversible en entorno desechable y sus pruebas.
4. Pruebas concurrentes con resultados y condiciones reproducibles.
5. Pruebas de particionado en límites 2026/2027 y plan para años siguientes.
6. Planes de ejecución y métricas para B-Tree/BRIN.
7. Contratos versionados de Grupos 2, 3, 4 y 6.
8. Decisión explícita sobre la dependencia del Grupo 5.
9. Prueba de reconstrucción de `estado_actual_tramite` desde el historial.
10. Revisión de seguridad, privacidad y permisos de escritura.

Hasta reunir estas evidencias, las entradas `PROPUESTO` y `PENDIENTE` no deben comunicarse como decisiones institucionales ni como implementación concluida.
