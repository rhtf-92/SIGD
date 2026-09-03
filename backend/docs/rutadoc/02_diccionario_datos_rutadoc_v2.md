# Diccionario de datos RutaDoc v2

- Responsable del borrador: Geric
- Grupo: Grupo 1 — RutaDoc
- Estado: **PROPUESTO** para revisión; implementación **PENDIENTE**
- Versión documental: Borrador v0.1
- Commit base de elaboración: `f17d90d` (los presentes archivos aún no están versionados en Git)
- Correspondencia: `02_modelo_datos_rutadoc_v2.md`
- Fecha de línea base: 2026-09-02

## 1. Alcance y convenciones

Este diccionario especifica una forma física propuesta para evaluar el modelo v2. No contiene DDL, no autoriza crear tablas y no sustituye la validación de Jhasy ni los contratos de otros grupos.

Etiquetas:

- **CONFIRMADO:** respaldado por los documentos base o por aclaración expresa de Geric.
- **PROPUESTO:** decisión técnica del borrador sujeta a revisión.
- **PENDIENTE:** no aprobado o dependiente de evidencia/contrato.
- **EJEMPLO:** valor ilustrativo, nunca catálogo oficial.

Clasificación de propiedad y referencia:

- `INTERNA`: dato y tabla propiedad de RutaDoc; admite FK local propuesta.
- `EXTERNA`: identificador conservado por RutaDoc, propiedad de otro grupo; sin FK física hasta contrato.
- `DERIVADA`: dato reconstruible del historial.
- `TÉCNICA`: dato para concurrencia, correlación, idempotencia o auditoría.

Todos los nombres de tablas siguientes pertenecen al esquema **PROPUESTO** `sigd_rut`.

## 2. Contratos externos obligatoriamente pendientes

| Grupo | Referencia esperada | Tipo local provisional | Estado y restricción |
| --- | --- | --- | --- |
| Grupo 2 — TramiCore | `sigd_tra.expediente.id_expediente` y CUT | UUID esperado para `id_expediente`; tratamiento del CUT sin fijar. | **PENDIENTE DE CONTRATO**; sin FK física. |
| Grupo 3 — OrganiCore | `sigd_org.area.id_area` | `UUID` | **PENDIENTE DE CONTRATO**; sin FK física. |
| Grupo 4 — IdentiCore | `sigd_auth.cuenta_usuario.id_usuario` | `UUID` | **PENDIENTE DE CONTRATO**; sin FK física. |
| Grupo 6 — CoreLink | `sigd_audit.evento_outbox` y payload | `UUID` para correlación propuesta | **PENDIENTE DE CONTRATO**; tabla no propiedad de RutaDoc. |

El vínculo documental del Grupo 5 aparece en v1, pero su contrato no está definido en el plan específico de Fase 2. Se conserva como **PENDIENTE**, sin inferir tabla, esquema ni tipo.

## 3. Tablas y columnas

### 3.1 `sigd_rut.movimiento_tramite`

Propiedad: RutaDoc. Clasificación: historial interno y datos técnicos. Particionamiento anual por `fecha_hora`: **PROPUESTO**.

| Columna | Tipo | Nulabilidad | Propiedad/clase | Propósito | Regla o estado |
| --- | --- | --- | --- | --- | --- |
| `movimiento_id` | `UUID` | NOT NULL | RutaDoc / INTERNA | Identidad lógica del movimiento. | **PROPUESTO**. |
| `fecha_hora` | `TIMESTAMPTZ` | NOT NULL | RutaDoc / INTERNA | Momento del hecho y clave de partición. | **PROPUESTO**; valor del servidor/transacción por decidir. |
| `id_expediente` | `UUID` | NOT NULL | Grupo 2 / EXTERNA | Agrupa el historial del expediente. | **PENDIENTE DE CONTRATO**; sin FK. |
| `secuencia` | `BIGINT` | NOT NULL | RutaDoc / INTERNA | Orden monotónico por expediente. | **PROPUESTO**; asignación concurrente **PENDIENTE**. |
| `accion_tramite_id` | `UUID` | NOT NULL | RutaDoc / INTERNA | Acción que clasifica el hecho. | FK local **PROPUESTA**. |
| `transicion_estado_tramite_id` | `UUID` | NULL | RutaDoc / INTERNA | Regla de transición aplicada. | H1 aporta candidatos no contractuales; nulabilidad y persistencia definitivas **PENDIENTES** de reconciliación funcional y diseño físico. |
| `estado_anterior_id` | `UUID` | NULL | RutaDoc / INTERNA | Estado previo. | Nulo solo para inicio si se confirma. |
| `estado_resultante_id` | `UUID` | NOT NULL | RutaDoc / INTERNA | Estado producido. | FK local **PROPUESTA**. |
| `id_usuario_actor` | `UUID` | NULL | Grupo 4 / EXTERNA | Actor que ejecuta el movimiento. | **PENDIENTE DE CONTRATO** y excepciones de eventos externos. |
| `id_area_contexto` | `UUID` | NULL | Grupo 3 / EXTERNA | Área en la que ocurre la acción. | **PENDIENTE DE CONTRATO** y obligatoriedad por acción. |
| `observacion` | `TEXT` | NULL | RutaDoc / INTERNA | Contexto mínimo del hecho. | **PROPUESTO**; límites y datos sensibles **PENDIENTES**. |
| `clave_idempotencia` | **PENDIENTE** | NULL | RutaDoc / TÉCNICA | Identifica reintentos del mismo comando. | Invariancia global; tipo, origen, nulabilidad y garantía física **PENDIENTES**. |
| `correlation_id` | `UUID` | NULL | Compartida / TÉCNICA | Correlaciona comando, movimiento y evento. | **PENDIENTE DE CONTRATO** con CoreLink. |

Restricciones e índices:

| Elemento | Definición | Estado |
| --- | --- | --- |
| PK física | `(fecha_hora, movimiento_id)` | **PROPUESTO** para compatibilidad con partición; validar con Jhasy. |
| Identidad lógica | `movimiento_id` globalmente único | **PROPUESTO**; garantía física global **PENDIENTE**. |
| CHECK | `secuencia > 0` | **PROPUESTO**. |
| Invariancia de secuencia | Una secuencia no se repite dentro de un expediente. | **PENDIENTE** de diseño físico; `(id_expediente, secuencia, fecha_hora)` no la garantiza. |
| Invariancia de idempotencia | Una clave aceptada no produce dos comandos equivalentes según el alcance que se defina. | **PENDIENTE**; no se propone una UNIQUE física incompatible con la partición. |
| B-Tree | `(id_expediente, secuencia DESC)` | **PROPUESTO**. |
| B-Tree | `(id_expediente, fecha_hora DESC)` | **PROPUESTO**. |
| B-Tree candidatos | `id_usuario_actor`, `id_area_contexto`, `correlation_id` | **PENDIENTE** de consulta consumidora, selectividad y `EXPLAIN`. |
| BRIN | `fecha_hora` por partición voluminosa | **PROPUESTO**, condicionado a benchmark. |

### 3.2 `sigd_rut.accion_tramite`

Propiedad: RutaDoc. Catálogo **PROPUESTO**; H1 aporta candidatos no contractuales y los valores institucionales permanecen **PENDIENTES** de reconciliación.

| Columna | Tipo | Nulabilidad | Propósito | Regla |
| --- | --- | --- | --- | --- |
| `accion_tramite_id` | `UUID` | NOT NULL | Identidad interna. | PK **PROPUESTA**. |
| `codigo` | `VARCHAR(50)` | NOT NULL | Código estable. | UNIQUE **PROPUESTA**. |
| `nombre` | `VARCHAR(100)` | NOT NULL | Denominación visible. | **PENDIENTE** de vocabulario. |
| `descripcion` | `TEXT` | NOT NULL | Semántica funcional. | **PENDIENTE**. |
| `activo` | `BOOLEAN` | NOT NULL | Admisión en nuevas operaciones. | DEFAULT `TRUE` **PROPUESTO**. |
| `vigente_desde` | `TIMESTAMPTZ` | NULL | Inicio de vigencia. | **PROPUESTO**. |
| `vigente_hasta` | `TIMESTAMPTZ` | NULL | Fin exclusivo de vigencia. | CHECK posterior a inicio **PROPUESTO**. |

### 3.3 `sigd_rut.estado_tramite`

Propiedad: RutaDoc. No se incorpora una lista definitiva de estados.

| Columna | Tipo | Nulabilidad | Propósito | Regla |
| --- | --- | --- | --- | --- |
| `estado_tramite_id` | `UUID` | NOT NULL | Identidad interna. | PK **PROPUESTA**. |
| `codigo` | `VARCHAR(50)` | NOT NULL | Código estable. | UNIQUE **PROPUESTA**. |
| `nombre` | `VARCHAR(100)` | NOT NULL | Denominación visible. | H1 aporta nombres candidatos no contractuales; nombre institucional, tipo y restricción definitivos **PENDIENTES**. |
| `descripcion` | `TEXT` | NOT NULL | Semántica funcional. | **PENDIENTE**. |
| `es_terminal` | `BOOLEAN` | NOT NULL | Indica terminalidad. | DEFAULT `FALSE` **PROPUESTO**; reglas **PENDIENTES**. |
| `activo` | `BOOLEAN` | NOT NULL | Admisión futura. | DEFAULT `TRUE` **PROPUESTO**. |
| `vigente_desde` | `TIMESTAMPTZ` | NULL | Inicio de vigencia. | **PROPUESTO**. |
| `vigente_hasta` | `TIMESTAMPTZ` | NULL | Fin exclusivo de vigencia. | CHECK posterior a inicio **PROPUESTO**. |

### 3.4 `sigd_rut.transicion_estado_tramite`

Propiedad propuesta: RutaDoc. Entidad **REVISABLE** ante el traslado de reglas al dominio TypeScript. La matriz H1 está disponible con dieciséis filas candidatas; su persistencia, correspondencia y contenido institucional permanecen **PENDIENTES** de reconciliación y diseño físico.

| Columna | Tipo | Nulabilidad | Propósito | Regla |
| --- | --- | --- | --- | --- |
| `transicion_estado_tramite_id` | `UUID` | NOT NULL | Identidad interna. | PK **PROPUESTA**. |
| `estado_anterior_id` | `UUID` | NULL | Origen; nulo en inicio si se aprueba. | FK local **PROPUESTA**. |
| `accion_tramite_id` | `UUID` | NOT NULL | Acción admitida. | FK local **PROPUESTA**. |
| `estado_resultante_id` | `UUID` | NOT NULL | Destino. | FK local **PROPUESTA**. |
| `condicion_descriptiva` | `TEXT` | NULL | Condición no ejecutable documentada. | **PROPUESTO**; no sustituye regla de dominio. |
| `activo` | `BOOLEAN` | NOT NULL | Admisión futura. | DEFAULT `TRUE` **PROPUESTO**. |
| `vigente_desde` | `TIMESTAMPTZ` | NULL | Inicio de vigencia. | **PROPUESTO**. |
| `vigente_hasta` | `TIMESTAMPTZ` | NULL | Fin exclusivo. | CHECK y no solapamiento **PROPUESTOS**. |

UNIQUE o exclusión de rangos sobre estado/acción/resultado/vigencia: **PROPUESTO**, sujeto a pruebas PostgreSQL de Jhasy.

### 3.5 `sigd_rut.derivacion_tramite`

Entidad de detalle **REVISABLE**; su permanencia depende de validar que los datos exclusivos de derivación justifican una tabla separada.

| Columna | Tipo | Nulabilidad | Propiedad/clase | Propósito | Regla |
| --- | --- | --- | --- | --- | --- |
| `movimiento_fecha_hora` | `TIMESTAMPTZ` | NOT NULL | RutaDoc / INTERNA | Parte de referencia física al movimiento. | Parte de PK/FK **PROPUESTA**. |
| `movimiento_id` | `UUID` | NOT NULL | RutaDoc / INTERNA | Movimiento propietario. | Parte de PK/FK **PROPUESTA**. |
| `id_area_origen` | `UUID` | NOT NULL | Grupo 3 / EXTERNA | Área que deriva. | **PENDIENTE DE CONTRATO**; sin FK. |
| `id_area_destino` | `UUID` | NOT NULL | Grupo 3 / EXTERNA | Área destinataria. | **PENDIENTE DE CONTRATO**; sin FK. |
| `motivo` | `TEXT` | NOT NULL | RutaDoc / INTERNA | Justificación. | Minimización y longitud **PENDIENTES**. |

CHECK de áreas distintas: **PROPUESTO** una vez confirmado que ambos identificadores comparten semántica contractual. B-Tree `(id_area_origen, id_area_destino)`: **PROPUESTO** sujeto a consultas.

### 3.6 `sigd_rut.recepcion_tramite`

Entidad de detalle **REVISABLE**; recepción manual y cardinalidad con derivación permanecen **PENDIENTES**.

| Columna | Tipo | Nulabilidad | Propiedad/clase | Propósito | Regla |
| --- | --- | --- | --- | --- | --- |
| `movimiento_fecha_hora` | `TIMESTAMPTZ` | NOT NULL | RutaDoc / INTERNA | Parte de PK/FK propietaria. | **PROPUESTO**. |
| `movimiento_id` | `UUID` | NOT NULL | RutaDoc / INTERNA | Movimiento de recepción. | **PROPUESTO**. |
| `derivacion_fecha_hora` | `TIMESTAMPTZ` | NULL | RutaDoc / INTERNA | Parte de referencia a derivación. | Cardinalidad **PENDIENTE**. |
| `derivacion_movimiento_id` | `UUID` | NULL | RutaDoc / INTERNA | Derivación confirmada. | FK local compuesta **PROPUESTA** si se confirma. |
| `id_area_receptora` | `UUID` | NULL | Grupo 3 / EXTERNA | Área que recibe. | **PENDIENTE DE CONTRATO** y de recepción inicial. |
| `observacion_recepcion` | `TEXT` | NULL | RutaDoc / INTERNA | Nota mínima. | **PROPUESTO**. |

UNIQUE parcial de la derivación confirmada: **PROPUESTO**, condicionado a que solo exista una confirmación válida.

### 3.7 `sigd_rut.observacion_tramite`

Entidad de detalle **REVISABLE**; forma y obligatoriedad dependen del análisis funcional pendiente.

| Columna | Tipo | Nulabilidad | Propósito | Regla |
| --- | --- | --- | --- | --- |
| `movimiento_fecha_hora` | `TIMESTAMPTZ` | NOT NULL | Parte de PK/FK al movimiento. | **PROPUESTO**. |
| `movimiento_id` | `UUID` | NOT NULL | Movimiento propietario. | **PROPUESTO**. |
| `motivo` | `VARCHAR(200)` | NOT NULL | Motivo resumido. | Longitud **PROPUESTA**. |
| `detalle` | `TEXT` | NULL | Detalle adicional. | Minimización **PENDIENTE**. |

### 3.8 `sigd_rut.atencion_tramite`

Entidad de detalle **REVISABLE**; contenido mínimo y vínculo documental permanecen **PENDIENTES**.

| Columna | Tipo | Nulabilidad | Propósito | Regla |
| --- | --- | --- | --- | --- |
| `movimiento_fecha_hora` | `TIMESTAMPTZ` | NOT NULL | Parte de PK/FK al movimiento. | **PROPUESTO**. |
| `movimiento_id` | `UUID` | NOT NULL | Movimiento propietario. | **PROPUESTO**. |
| `resultado_resumen` | `TEXT` | NOT NULL | Resultado funcional mínimo. | Contenido y límites **PENDIENTES**. |

### 3.9 `sigd_rut.tipo_relacion_movimiento`

| Columna | Tipo | Nulabilidad | Propósito | Regla |
| --- | --- | --- | --- | --- |
| `tipo_relacion_movimiento_id` | `UUID` | NOT NULL | Identidad interna. | PK **PROPUESTA**. |
| `codigo` | `VARCHAR(50)` | NOT NULL | Código estable. | UNIQUE **PROPUESTA**. |
| `nombre` | `VARCHAR(100)` | NOT NULL | Denominación. | Valores **PENDIENTES**. |
| `descripcion` | `TEXT` | NOT NULL | Semántica. | Valores **PENDIENTES**. |
| `activo` | `BOOLEAN` | NOT NULL | Admisión futura. | DEFAULT `TRUE` **PROPUESTO**. |

### 3.10 `sigd_rut.relacion_movimiento`

| Columna | Tipo | Nulabilidad | Propósito | Regla |
| --- | --- | --- | --- | --- |
| `relacion_movimiento_id` | `UUID` | NOT NULL | Identidad del vínculo. | PK **PROPUESTA**. |
| `origen_fecha_hora` | `TIMESTAMPTZ` | NOT NULL | Parte de FK física al origen. | **PROPUESTO**. |
| `movimiento_origen_id` | `UUID` | NOT NULL | Evento origen. | FK local compuesta **PROPUESTA**. |
| `destino_fecha_hora` | `TIMESTAMPTZ` | NOT NULL | Parte de FK física al destino. | **PROPUESTO**. |
| `movimiento_destino_id` | `UUID` | NOT NULL | Evento destino. | FK local compuesta **PROPUESTA**. |
| `tipo_relacion_movimiento_id` | `UUID` | NOT NULL | Tipo del vínculo. | FK local **PROPUESTA**. |
| `motivo` | `TEXT` | NULL | Justificación. | Obligatoriedad por tipo **PENDIENTE**. |
| `registrado_en` | `TIMESTAMPTZ` | NOT NULL | Auditoría temporal del vínculo. | **PROPUESTO**. |

CHECK de movimientos distintos y UNIQUE por origen/destino/tipo: **PROPUESTOS**. La dirección semántica de cada tipo permanece **PENDIENTE**.

### 3.11 `sigd_rut.movimiento_documento`

Entidad **REVISABLE** cuya permanencia depende del contrato documental del Grupo 5.

| Columna | Tipo | Nulabilidad | Propiedad/clase | Propósito | Regla |
| --- | --- | --- | --- | --- | --- |
| `movimiento_fecha_hora` | `TIMESTAMPTZ` | NOT NULL | RutaDoc / INTERNA | Parte de FK física al movimiento. | **PROPUESTO**. |
| `movimiento_id` | `UUID` | NOT NULL | RutaDoc / INTERNA | Movimiento relacionado. | **PROPUESTO**. |
| `documento_id` | **PENDIENTE** | NOT NULL | Grupo 5 / EXTERNA | Documento relacionado. | Sin FK ni tipo inventado. |
| `version_documento_id` | **PENDIENTE** | NULL | Grupo 5 / EXTERNA | Versión histórica. | Sin FK ni tipo inventado. |
| `finalidad` | `VARCHAR(50)` | NOT NULL | RutaDoc / INTERNA | Finalidad del vínculo. | Catálogo o CHECK **PENDIENTE**. |

La clave única compuesta depende del tratamiento contractual de una versión nula; queda **PENDIENTE**.

### 3.12 `sigd_rut.estado_actual_tramite`

Propiedad propuesta: RutaDoc. Clasificación: proyección DERIVADA, mutable y **REVISABLE**.

| Columna | Tipo | Nulabilidad | Propiedad/clase | Propósito | Regla |
| --- | --- | --- | --- | --- | --- |
| `id_expediente` | `UUID` | NOT NULL | Grupo 2 / EXTERNA | Una proyección por expediente. | PK lógica **PROPUESTA**; sin FK externa. |
| `movimiento_fecha_hora` | `TIMESTAMPTZ` | NOT NULL | RutaDoc / DERIVADA | Parte de FK al último movimiento. | **PROPUESTO**. |
| `movimiento_actual_id` | `UUID` | NOT NULL | RutaDoc / DERIVADA | Último movimiento. | Referencia lógica; FK física **PENDIENTE** de una clave candidata válida. |
| `estado_actual_id` | `UUID` | NOT NULL | RutaDoc / DERIVADA | Estado resultante actual. | FK local **PROPUESTA**. |
| `secuencia_actual` | `BIGINT` | NOT NULL | RutaDoc / DERIVADA | Secuencia proyectada. | CHECK positiva **PROPUESTO**. |
| `actualizado_en` | `TIMESTAMPTZ` | NOT NULL | RutaDoc / AUDITORÍA | Momento de actualización. | **PROPUESTO**. |
| `version_proyeccion` | `BIGINT` | NOT NULL | RutaDoc / TÉCNICA | Control optimista/reconstrucción. | CHECK positiva **PROPUESTO**. |

**CONFIRMADO por el plan específico:** la proyección oficial se actualiza determinísticamente dentro de la misma transacción del caso de uso. El mecanismo —servicio transaccional o trigger mínimo— está **PENDIENTE**; no se admite un consumidor asíncrono para esta proyección oficial.

Consistencia declarativa **PROPUESTA:** `CHECK` positivos y FKs locales simples cuando exista una clave candidata válida. No se promete una FK compuesta para expediente, movimiento, estado y secuencia hasta definirla y probarla.

Consistencia transaccional **PROPUESTA:** verificar conjuntamente expediente, movimiento, estado y secuencia; actualizar sin retroceso; y confirmar o revertir como unidad movimiento, detalle, proyección oficial y registro Outbox, sujeto este último al contrato definitivo. La asincronía solo podría aplicarse a proyecciones secundarias distintas.

## 4. Reglas transversales de inmutabilidad y auditoría

| Regla | Aplicación esperada | Estado |
| --- | --- | --- |
| No actualizar ni eliminar movimientos históricos. | Dominio, privilegios y trigger defensivo. | **CONFIRMADO** por el plan específico; implementación **PENDIENTE**. |
| Rectificar mediante un nuevo movimiento relacionado. | `movimiento_tramite` + `relacion_movimiento`. | **PROPUESTO**; semántica y autorización oficial **PENDIENTES**. |
| Conservar actor, instante y contexto mínimo. | Campos del movimiento. | **PROPUESTO**; excepciones externas **PENDIENTES**. |
| No duplicar innecesariamente datos administrados por otros dominios. | Conservar solo referencias y contexto mínimo acordado. | **CONFIRMADO** como límite; tipos UUID y tratamiento del CUT **PENDIENTES DE CONTRATO**. |
| Correlacionar operación y evento. | `correlation_id`. | **PENDIENTE DE CONTRATO**. |
| Evitar reintentos duplicados. | Invariancia `clave_idempotencia`. | **PENDIENTE** de tipo, alcance y garantía global. |

Son conceptualmente históricos e inmutables `movimiento_tramite`, sus detalles, `relacion_movimiento` y los vínculos históricos de `movimiento_documento`. Los catálogos son versionables y administrables sin reescribir su uso pasado. `actualizado_en` de la proyección sí puede cambiar porque la proyección es mutable y no constituye el historial.

## 5. Campos necesarios para particionamiento

`fecha_hora` es la clave de partición propuesta y, bajo la alternativa de clave compuesta, tendría que viajar con cualquier referencia física hacia `movimiento_tramite`. Esta duplicación técnica es **PROPUESTA** y deberá validarse junto con estas alternativas:

1. fila guardiana no particionada por expediente para asignar secuencia;
2. registro no particionado de identidades y comandos idempotentes;
3. tablas de detalle co-particionadas y restricciones por partición;
4. cambio de clave de partición;
5. garantía limitada por partición únicamente si se demuestra que un expediente nunca cruza años.

No se oculta la limitación: la unicidad global de `movimiento_id`, secuencia e idempotencia entre particiones no queda demostrada hasta que exista DDL ejecutable y pruebas de Jhasy. La suite futura debe incluir un mismo expediente con movimientos en 2026 y 2027.

## 6. Correspondencia con el modelo v2

| Concepto del modelo | Tabla/columnas | Estado |
| --- | --- | --- |
| Raíz append-only | `movimiento_tramite` | **PROPUESTO**. |
| Orden por expediente | `id_expediente`, `secuencia` | **PROPUESTO**, concurrencia **PENDIENTE**. |
| Máquina de estados | catálogos y `transicion_estado_tramite` | Matriz **PENDIENTE**. |
| Detalle exclusivo | cuatro tablas de detalle | **PROPUESTO**, validación física **PENDIENTE**. |
| Rectificación/reapertura | `relacion_movimiento` | **PROPUESTO**, catálogo **PENDIENTE**. |
| Proyección reconstruible | `estado_actual_tramite` | **PROPUESTO**, mecanismo **PENDIENTE**. |
| Integración externa | UUID sin FK externa | **PENDIENTE DE CONTRATO**. |
| Outbox | solo correlación conceptual | Ownership y payload **PENDIENTES** del Grupo 6. |

## 7. Diferencias frente al diccionario v1

| Tema | Diccionario v1 | Diccionario v2 | Estado |
| --- | --- | --- | --- |
| Tipos | Conceptuales; SQL v1 usa BIGINT/VARCHAR. | UUID, TIMESTAMPTZ y BIGINT de secuencia. | **PROPUESTO**. |
| Esquema | No especificado. | `sigd_rut`. | **PROPUESTO**. |
| Partición | No contemplada. | `fecha_hora` propuesta; claves físicas todavía sin aprobar. | **PENDIENTE**. |
| Movimiento | 12 atributos en SQL v1. | Añade `correlation_id`; renombra referencias externas al contrato esperado. | **PROPUESTO**. |
| Idempotencia | `VARCHAR(128)`. | Tipo y garantía global sin fijar. | **PENDIENTE** de contrato de comandos y diseño físico. |
| Referencias externas | Formato conceptual/VARCHAR. | UUID para Grupos 2, 3 y 4. | **PENDIENTE DE CONTRATO**. |
| Documento externo | Identificador conceptual/VARCHAR. | Tipo no fijado. | **PENDIENTE** del Grupo 5. |
| PK/FK de movimiento | Identificador simple. | Incluye fecha por particionamiento. | **PENDIENTE** de Jhasy. |
| Índices | B-Tree generales. | B-Tree por consultas y BRIN condicionado. | **PROPUESTO**. |
| Estado/proyección | Trigger v1. | Mecanismo abierto con invariantes explícitos. | **PENDIENTE**. |

## 8. Evidencia pendiente para aprobar este diccionario

- H1 recibido e integrado; catálogo, correspondencia institucional y persistencia de la matriz todavía **PENDIENTES**;
- decisión de Jhasy sobre PK, particiones, bloqueos, triggers e idempotencia;
- DDL separado y pruebas de instalación, rollback, integridad y concurrencia;
- prueba de secuencia e idempotencia con un expediente que cruce las particiones 2026 y 2027;
- planes `EXPLAIN` para B-Tree/BRIN con volumen representativo;
- contratos formales de Grupos 2, 3, 4 y 6;
- aclaración del contrato documental del Grupo 5 heredado de v1;
- revisión de privacidad, longitudes de texto, retención y permisos;
- comprobación de correspondencia bidireccional con el futuro dominio TypeScript.

La mera existencia de este archivo no marca la actividad como terminada.
