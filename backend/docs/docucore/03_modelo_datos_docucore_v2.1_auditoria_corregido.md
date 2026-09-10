03. Modelo de Datos — DocuCore v2.1

Sistema: Sistema Integral de Gestión Documentaria (SIGD)

Módulo: DocuCore — Documentos, Requisitos y Formularios (Grupo 5)

Fase: 2 — JSON Schema, PostgreSQL JSONB y Storage S3/MinIO

Autor: Cristian · Sublíder y Modelador (B_CHRISTIAN)

Entregable: backend/docs/modelo-datos/03_modelo_datos_docucore_v2.md

Insumos: 01_analisis_json_schema_storage_s3.md (Valentín, v3.2 — LISTO) + 02_reglas_tupa_admisibilidad_v2.md (Valentín, v2.3 — LISTO)

Destinatario: Piero (SQL — B_PIERO)

Fecha: 30 de agosto de 2026

Versión: 3.0 — Reingeniería de Fase 2: reemplaza el modelo relacional de formularios (v2.1) por JSON Schema + JSONB, adopta esquema físico sigd_doc, claves primarias UUID, storage desacoplado en MinIO/S3, y separa la clasificación legal TUPA de la configuración técnica del formulario.

---

0. Mapa de cambios respecto al modelo anterior (v2.1)

| Elemento v2.1 | Elemento v3.0 | Motivo |

|---|---|---|

| CAMPO_FORMULARIO (tabla) | Eliminada — absorbida por schema_definicion (JSONB) en FORMULARIO_VERSION | Antipatrón EAV señalado en el plan de arquitectura; JSON Schema evita explosión de JOINs. |

| VALOR_CAMPO (tabla) | Eliminada — absorbida por payload_respuestas (JSONB) en EXPEDIENTE_FORMULARIO_RESPUESTA | Mismo motivo; una fila por campo/respuesta ya no es necesaria. |

| FORMULARIO | Renombrada a FORMULARIO_VERSION | Alinea el nombre con la terminología ya usada por Valentín (formulario_version.schema_definicion). |

| ARCHIVO_ADJUNTO | Renombrada a DOCUMENTO_ADJUNTO | Nombre oficial fijado en la Matriz de Estandarización del plan de arquitectura (esquema sigd_doc). |

| Todas las PK BigInt IDENTITY | UUID (gen_random_uuid()) | Estándar corporativo para los 6 esquemas del SIGD. |

| (no existía) | TIPO_TRAMITE_TUPA (nueva entidad) | Catálogo de clasificación legal TUPA definido por Valentín — se modela separado de la configuración técnica, unidos por FK (recomendación explícita de Valentín, Sección 10.1 de ambos documentos). |

| id_campo_condicionante (FK a CAMPO_FORMULARIO) | campo_condicionante_path (Text) | Ya no existe una fila de campo a la cual apuntar con FK — ahora se referencia la ruta de la propiedad dentro del JSON Schema (ej. /tipo_persona). |

---

1. Criterio de diseño

1. Configuración separada de instancia: se mantiene el patrón catálogo/instancia (TIPO_DOCUMENTO ↔ EXPEDIENTE, REQUISITO ↔ EXPEDIENTE_REQUISITO).

2. El estado del requisito se deriva, no se asigna directamente (RN-REQ-005): sigue vigente sin cambios de fondo.

3. La estructura del formulario ya no vive en tablas relacionales fragmentadas: se reemplaza por un documento JSON Schema (Draft 2020-12) versionado, guardado en una sola columna JSONB. Esto es lo que Valentín especifica en la Sección 5 de 01_analisis_json_schema_storage_s3.md.

4. La clasificación legal TUPA y la configuración técnica del trámite son entidades distintas: TIPO_TRAMITE_TUPA (calificación administrativa, plazos, costos, base legal — dominio de Valentín) y TIPO_DOCUMENTO (configuración técnica del formulario — antes llamada hipotéticamente TRAMITE_PLANTILLA) se modelan por separado y se vinculan por FK. Esto resuelve formalmente la pregunta que ambos documentos dejaban pendiente.

5. **USUARIO** sigue siendo una entidad externa (módulo sigd_auth), sin tabla ni FK local — ya confirmado en versiones anteriores.

6. **EXPEDIENTE** se mantiene como entidad local de DocuCore, con la misma justificación ya documentada (control del ciclo de vida documental).

7. Los adjuntos se almacenan fuera de la base de datos (MinIO/S3), con URLs prefirmadas — la base de datos solo guarda metadatos, hash y ubicación (s3_bucket + s3_key).

---

2. Entidades

(Esquema físico: *sigd_doc*. Todas las claves primarias son* *UUID* con *gen_random_uuid()*, salvo indicación distinta. Todos los campos de fecha/hora son *TIMESTAMPTZ*, zona horaria *America/Lima**.)**

2.1. USUARIO — referencia externa (sigd_auth.cuenta_usuario)

No se crea tabla local. Los siguientes campos de otras entidades son referencias externas (UUID, sin FOREIGN KEY local):

- id_usuario_creador

- id_usuario_solicitante

- id_evaluador

- id_usuario_subida (nuevo — ver *DOCUMENTO_ADJUNTO*)**

La existencia y validez del usuario se valida en la aplicación, contra el módulo sigd_auth.

2.2. TIPO_TRAMITE_TUPA (nueva — catálogo legal, insumo de Valentín)

La clasificación administrativa y legal de cada trámite, tal como la define 02_reglas_tupa_admisibilidad_v2.md, Sección 4.

| Atributo | Tipo | Restricción |

|---|---|---|

| id_tipo_tramite_tupa | UUID | PK |

| codigo_tupa | Varchar(30) | NULL (si es "No TUPA" / servicio interno) |

| denominacion | Varchar(200) | NOT NULL |

| es_tupa | Boolean | NOT NULL — distingue trámite TUPA formal de servicio interno |

| calificacion_administrativa | Enum(APROBACION_AUTOMATICA,EVALUACION_PREVIA_SAP,EVALUACION_PREVIA_SAN) | NOT NULL |

| plazo_max_dias_habiles | Integer | NULL (solo aplica a evaluación previa) |

| costo | Decimal(8,2) | NULL (0 o NULL si es gratuito) |

| unidad_organica_responsable | Varchar(150) | NULL — pendiente de integración con sigd_org |

| base_legal | Text | NULL |

| activo | Boolean | DEFAULT true |

| fecha_creacion | TimestampTZ | DEFAULT now() |

⚠️ Conforme a RN-TUPA-001 (Valentín): calificacion_administrativa no debe asignarse **EVALUACION_PREVIA_SAN** automáticamente por defecto al crear un registro — debe declararse explícitamente y validarse contra el TUPA real antes de publicarse como activo = true. Esto se implementa como regla de aplicación, no como DEFAULT de columna.

2.3. TIPO_DOCUMENTO (= *TRAMITE_PLANTILLA* — configuración técnica)

El catálogo de tipos de documento configurables, ahora vinculado a su clasificación legal.

| Atributo | Tipo | Restricción |

|---|---|---|

| id_tipo_documento | UUID | PK |

| id_tipo_tramite_tupa | UUID | FK → TIPO_TRAMITE_TUPA, UNIQUE (relación 1:1), NULL permitido — un TIPO_DOCUMENTO puede existir en borrador técnico antes de que su clasificación TUPA quede confirmada (RN-TUPA-001); no puede activarse (activo = true) mientras esta FK sea NULL |

| codigo_tipo | Varchar(30) | NOT NULL, UNIQUE (antes *codigo* — renombrado según la Matriz de Estandarización, ej. *CERT_03*)** |

| nombre | Varchar(150) | NOT NULL |

| descripcion | Text | NULL |

| activo | Boolean | DEFAULT true |

| id_usuario_creador | UUID | Referencia externa, sin FK local |

| fecha_creacion | TimestampTZ | DEFAULT now() |

2.4. FORMULARIO_VERSION (antes *FORMULARIO* + *CAMPO_FORMULARIO*)**

Cada fila es una versión inmutable de la estructura del formulario, expresada como JSON Schema.

| Atributo | Tipo | Restricción |

|---|---|---|

| id_formulario_version | UUID | PK |

| id_tipo_documento | UUID | FK → TIPO_DOCUMENTO |

| version | SmallInt | NOT NULL, > 0 |

| schema_definicion | JSONB | NOT NULL — documento JSON Schema Draft 2020-12 completo (tipos de campo, required, enum, bloques if/then/else para condicionalidad — ver Sección 5 de 01_analisis_json_schema_storage_s3.md) |

| activo | Boolean | DEFAULT true |

| fecha_creacion | TimestampTZ | DEFAULT now() |

Restricciones de versionado (sin cambio de fondo respecto a v2.1):

- UNIQUE(id_tipo_documento, version).

- Solo una versión por id_tipo_documento puede tener activo = true (índice único parcial, igual que antes).

- Una versión usada por al menos un expediente no debe modificarse — cualquier cambio genera una versión nueva.

- Índice GIN sobre schema_definicion para permitir consultas eficientes dentro del JSON (recomendación del plan de arquitectura).

2.5. EXPEDIENTE (antes *EXPEDIENTE* + *VALOR_CAMPO*)**

El trámite en curso. Conserva la referencia exacta a FORMULARIO_VERSION; las respuestas del formulario se almacenan en la entidad 1:1 EXPEDIENTE_FORMULARIO_RESPUESTA.

| Atributo | Tipo | Restricción |

|---|---|---|

| id_expediente | UUID | PK |

| codigo_oficial | Varchar(30) | UNIQUE, NULL — se asigna en la radicación |

| id_formulario_version | UUID | FK → FORMULARIO_VERSION — versión exacta usada al crear el expediente |

| id_usuario_solicitante | UUID | Referencia externa, sin FK local |

| payload_respuestas | JSONB | NOT NULL — respuestas del solicitante, validadas contra schema_definicion de la versión referenciada (reemplaza a *VALOR_CAMPO*)** |

| estado | Enum(BORRADOR,EN_REVISION,OBSERVADO,SUBSANACION,APROBADO,RECHAZADO_POR_CADUCIDAD,INACTIVO) | DEFAULT BORRADOR |

| fecha_creacion | TimestampTZ | DEFAULT now() |

| fecha_radicacion | TimestampTZ | NULL |

El tipo de documento y su clasificación TUPA se obtienen indirectamente: EXPEDIENTE → FORMULARIO_VERSION → TIPO_DOCUMENTO → TIPO_TRAMITE_TUPA.

2.6. EXPEDIENTE_FORMULARIO_RESPUESTA

Entidad 1:1 que almacena el payload_respuestas del expediente. Se separa de EXPEDIENTE para mantener el esquema físico alineado con el SQL consolidado v6.3 y permitir la trazabilidad de la respuesta respecto de la versión exacta del formulario.

Atributo

Tipo

Restricción

id_expediente_formulario_respuesta

UUID

PK

id_expediente

UUID

FK → EXPEDIENTE, UNIQUE, NOT NULL

id_formulario_version

UUID

FK → FORMULARIO_VERSION, NOT NULL

payload_respuestas

JSONB

NOT NULL — objeto JSON validado por la aplicación contra schema_definicion

Regla de integridad: id_formulario_version debe coincidir con EXPEDIENTE.id_formulario_version. No se permite guardar respuestas de una versión diferente a la asociada al expediente.

2.7. REQUISITO

Catálogo de requisitos documentales — sin cambios de fondo respecto a v2.1, salvo tipo de PK. (Nota: Valentín se refiere a este mismo catálogo como *REQUISITO_TUPA* en su pregunta pendiente #3 — es la misma entidad, se mantiene el nombre *REQUISITO* por continuidad con el modelo de Fase 1; si el equipo prefiere el nombre *REQUISITO_TUPA*, es solo un rename, no un cambio estructural.)**

| Atributo | Tipo | Restricción |

|---|---|---|

| id_requisito | UUID | PK |

| codigo_requisito | Varchar(20) | NOT NULL, UNIQUE |

| nombre | Varchar(150) | NOT NULL |

| descripcion_guia | Text | NULL |

| tipo_obligatoriedad | Enum(OBLIGATORIO,OPCIONAL,CONDICIONAL) | NOT NULL |

| orden_presentacion | SmallInt | NOT NULL |

| requiere_vigencia | Boolean | DEFAULT false |

| dias_vigencia_max | Integer | NULL |

| permite_multiples | Boolean | DEFAULT false |

| cantidad_max_archivos | SmallInt | DEFAULT 1 |

| peso_maximo_mb | Decimal(5,2) | NOT NULL, ≤ 25 (nuevo — techo institucional RN-PESO-001 de Valentín) |

| formatos_permitidos | Varchar(100) | NOT NULL |

2.8. TIPO_DOCUMENTO_REQUISITO

| Atributo | Tipo | Restricción |

|---|---|---|

| id_tipo_documento_requisito | UUID | PK |

| id_tipo_documento | UUID | FK → TIPO_DOCUMENTO |

| id_requisito | UUID | FK → REQUISITO |

| obligatoriedad_override | Enum(OBLIGATORIO,OPCIONAL,CONDICIONAL) | NULL |

| campo_condicionante_path | Text | NULL (antes *id_campo_condicionante* FK — ahora es una ruta JSON Pointer dentro del *schema_definicion* de la versión activa, ej. */tipo_persona*, ya que el campo no vive en una fila propia)** |

| valor_condicionante | Varchar(100) | NULL |

Restricción: UNIQUE(id_tipo_documento, id_requisito).

⚠️ campo_condicionante_path no puede validarse con FOREIGN KEY (ya no apunta a una fila) — la aplicación debe verificar que la ruta exista dentro del schema_definicion de la versión activa correspondiente.

2.9. EXPEDIENTE_REQUISITO

Sin cambios de fondo respecto a v2.1, salvo tipo de PK.

| Atributo | Tipo | Restricción |

|---|---|---|

| id_expediente_requisito | UUID | PK |

| id_expediente | UUID | FK → EXPEDIENTE |

| id_tipo_documento_requisito | UUID | FK → TIPO_DOCUMENTO_REQUISITO |

| estado | Enum(PENDIENTE,OBSERVADO,SUBSANADO,APROBADO) | DEFAULT PENDIENTE |

| id_evaluador | UUID | Referencia externa, sin FK local, NULL |

| fecha_evaluacion | TimestampTZ | NULL |

| fecha_activacion | TimestampTZ | NULL |

Restricción: UNIQUE(id_expediente, id_tipo_documento_requisito).

2.10. DOCUMENTO_ADJUNTO (antes *ARCHIVO_ADJUNTO*)**

Metadatos del archivo — el binario vive en MinIO/S3, nunca en la base de datos.

| Atributo | Tipo | Restricción |

|---|---|---|

| id_documento_adjunto | UUID | PK |

| id_expediente_requisito | UUID | FK → EXPEDIENTE_REQUISITO |

| id_usuario_subida | UUID | Referencia externa (sigd_auth.cuenta_usuario), sin FK local (nuevo — exigido por la Matriz de Estandarización) |

| nombre_original | Varchar(255) | NOT NULL |

| s3_bucket | Varchar(100) | NOT NULL (antes parte de *ruta_storage*)** |

| s3_key | Varchar(500) | NOT NULL, UNIQUE (antes *nombre_logico* + *ruta_storage*)** |

| formato_extension | Varchar(10) | NOT NULL |

| mime_type | Varchar(100) | NOT NULL |

| tamanio_bytes | BigInt | NOT NULL |

| sha256_hash | Char(64) | NOT NULL |

| magic_bytes_validado | Boolean | DEFAULT false (nuevo — confirma que la validación de firma binaria ya se ejecutó, RN-ADJ-001) |

| version_num | SmallInt | DEFAULT 1 |

| id_documento_anterior | UUID | FK → DOCUMENTO_ADJUNTO (self), NULL |

| estado_documento | Enum(CARGADO,OBSERVADO,APROBADO,REEMPLAZADO,ELIMINADO) | DEFAULT CARGADO |

| fecha_creacion | TimestampTZ | DEFAULT now() |

Restricción: UNIQUE(id_documento_anterior) — un documento previo solo puede tener un único reemplazo (evita que dos versiones distintas reclamen ser el sucesor del mismo documento).

Regla de negocio: id_expediente_requisito no debe pasar a estado_documento = APROBADO hasta que magic_bytes_validado = true — el flujo de 4 pasos (solicitud → presigned URL → carga directa → confirmación) descrito en 01_analisis_json_schema_storage_s3.md, Sección 6, culmina justo con esta validación antes de habilitar el registro para evaluación.

---

3. Relaciones y cardinalidades

| Relación | Cardinalidad |

|---|---|

| Referencia externa USUARIO — TIPO_DOCUMENTO (crea) | 1 : N |

| Referencia externa USUARIO — EXPEDIENTE (solicita) | 1 : N |

| Referencia externa USUARIO — EXPEDIENTE_REQUISITO (evalúa) | 1 : N (opcional) |

| Referencia externa USUARIO — DOCUMENTO_ADJUNTO (sube) | 1 : N |

| TIPO_TRAMITE_TUPA — TIPO_DOCUMENTO | 1 : 1 |

| TIPO_DOCUMENTO — FORMULARIO_VERSION | 1 : N (versiones) |

| FORMULARIO_VERSION — EXPEDIENTE | 1 : N |
| EXPEDIENTE — EXPEDIENTE_FORMULARIO_RESPUESTA | 1 : 1 |
| FORMULARIO_VERSION — EXPEDIENTE_FORMULARIO_RESPUESTA | 1 : N |

| TIPO_DOCUMENTO — TIPO_DOCUMENTO_REQUISITO | 1 : N |

| REQUISITO — TIPO_DOCUMENTO_REQUISITO | 1 : N |

| EXPEDIENTE — EXPEDIENTE_REQUISITO | 1 : N |

| TIPO_DOCUMENTO_REQUISITO — EXPEDIENTE_REQUISITO | 1 : N |

| EXPEDIENTE_REQUISITO — DOCUMENTO_ADJUNTO | 1 : N |

| DOCUMENTO_ADJUNTO — DOCUMENTO_ADJUNTO (versión anterior) | 1 : N (autorreferencia opcional) |

---

4. Restricciones que no se resuelven con CHECK simple (para Piero)

- Validación de **payload_respuestas** contra **schema_definicion**:**** debe ejecutarse en aplicación con un validador de JSON Schema (Ajv), no en PostgreSQL. Un CHECK de PostgreSQL no puede validar estructura JSON arbitraria contra un esquema dinámico.

- **campo_condicionante_path** debe existir en el **schema_definicion** de la versión activa: validación de aplicación, no declarativa (ver nota en 2.7).

- RN-ADJ-002 (peso máximo): DOCUMENTO_ADJUNTO.tamanio_bytes no debe superar REQUISITO.peso_maximo_mb × 1024 × 1024.

- RN-REQ-005 (propagación de estado): al cambiar estado_documento, recalcular EXPEDIENTE_REQUISITO.estado; y al quedar un requisito OBSERVADO, EXPEDIENTE.estado pasa a SUBSANACION (sin cambio de fondo respecto a v2.1).

- RN-ADJ-005 (deduplicación): verificar sha256_hash antes de insertar.

- RN-ADJ-004 (múltiples adjuntos): contar archivos activos por id_expediente_requisito contra cantidad_max_archivos.

- Magic Bytes (RN-ADJ-001): el backend debe leer los primeros 512 bytes desde MinIO y actualizar magic_bytes_validado antes de habilitar el documento para evaluación — no es una validación de PostgreSQL.

- Versión única activa de **FORMULARIO_VERSION**:**** índice único parcial WHERE activo, igual que antes.

- EX-010 (formulario/plantilla inactivo): no debe permitirse crear un nuevo EXPEDIENTE si FORMULARIO_VERSION.activo = false (o si TIPO_DOCUMENTO.activo = false) — validación de aplicación antes del INSERT, ya que un CHECK no puede consultar el estado de la fila referenciada por la FK en el momento de la inserción.

CHECK simples que sí aplican directamente:

- EXPEDIENTE.codigo_oficial solo NOT NULL si estado != BORRADOR.

- REQUISITO.peso_maximo_mb <= 25.

- FORMULARIO_VERSION.version > 0.

---

5. Alineación y decisiones para integración

El modelo debe mantenerse alineado con el esquema SQL consolidado y con el documento de validación.

EXPEDIENTE_FORMULARIO_RESPUESTA es la entidad oficial 1:1 para payload_respuestas; no se debe reintroducir payload_respuestas dentro de EXPEDIENTE ni el modelo EAV (CAMPO_FORMULARIO / VALOR_CAMPO).

TIPO_DOCUMENTO.activo inicia con DEFAULT true, pero un tipo documental sin TUPA solo puede permanecer como borrador/inactivo; su activación requiere la clasificación TUPA correspondiente.

TIPO_TRAMITE_TUPA.calificacion_administrativa es NOT NULL y no tiene valor automático de EVALUACION_PREVIA_SAN.

EXPEDIENTE_REQUISITO.estado es derivado y protegido. No debe ser editado directamente por el evaluador.

La carga inicial de un documento CARGADO no implica SUBSANADO; SUBSANADO requiere una nueva versión enlazada después de una observación.

La unicidad de sha256_hash se aplica por id_expediente_requisito, permitiendo el mismo contenido en requisitos distintos.

La radicación de EXPEDIENTE es explícita mediante fn_radicacion_expediente(). Cargar requisitos o documentos no radica automáticamente el expediente.

calificacion_administrativa permanece NOT NULL, en coherencia con el esquema físico.

Los nombres canónicos de adjuntos son nombre_original y sha256_hash; no deben sustituirse por nombre_archivo o sha256.

EXPEDIENTE es una entidad local de DocuCore para controlar el ciclo de vida documental. Cualquier dependencia o sincronización con otros módulos debe formalizarse con el equipo correspondiente; este documento no presume una FK a otra base.

La ejecución de H4 debe realizarse realmente en PostgreSQL 18+ antes de declarar la integración como aprobada. Este documento no declara pruebas ejecutadas que no tengan evidencia.

6. Consistencia con los entregables relacionados

La correspondencia esperada es:

Documento

Responsabilidad

03_modelo_datos_docucore_v2.md

Modelo conceptual/lógico y reglas estructurales

04_diccionario_datos_docucore_v2.md

Definición detallada de atributos y restricciones

05_esquema_sigd_doc_jsonb_v6.3_auditoria_corregido.sql

Implementación física PostgreSQL

06_validacion_y_casos_prueba.md

Validaciones y casos de prueba, incluida la ejecución H4

Estado del modelo: corregido y alineado documentalmente con la auditoría; queda pendiente la ejecución real de H4 y la resolución de los asuntos externos de integración que la auditoría exige documentar.

