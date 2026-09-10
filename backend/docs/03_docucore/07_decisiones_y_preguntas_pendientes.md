# 07. Decisiones y Preguntas Pendientes — DocuCore v2

**Autor:** Cristian
**Rama Git:** `B_CHRISTIAN`
**Entregable:** `backend/docs/modelo-datos/07_decisiones_levantamiento_docucore.md`
**Fecha:** 8 de septiembre de 2026
**Versión:** 2.0 — reescrito para Fase 2 (JSON Schema + JSONB, storage S3/MinIO, catálogo TUPA, PK `UUID`, esquema `sigd_doc`). Consolida y resuelve varias preguntas que quedaron abiertas en la Fase 1.

---

## 1. Decisiones tomadas

**D-01 — `USUARIO` como referencia externa.** Sin cambios respecto a Fase 1: no hay tabla `usuario` en DocuCore. `id_usuario_creador`, `id_usuario_solicitante`, `id_evaluador` y, ahora también, `id_usuario_subida` (en `DOCUMENTO_ADJUNTO`) son identificadores `UUID` sin `FOREIGN KEY` local, provenientes del módulo `sigd_auth`.

**D-02 — `EXPEDIENTE` se mantiene local.** Sin cambios: DocuCore controla directamente el ciclo de vida documental del expediente.

**D-03 — El formulario se reemplaza por JSON Schema versionado *(reemplaza a la D-03 de Fase 1)*.** `FORMULARIO` + `CAMPO_FORMULARIO` (modelo relacional) se sustituyen por `FORMULARIO_VERSION`, con la estructura completa del formulario en una sola columna `schema_definicion` (JSONB, JSON Schema Draft 2020-12). Cada versión es inmutable una vez creada; los cambios generan una versión nueva. `VALOR_CAMPO` también se elimina: las respuestas del solicitante ahora se guardan en `EXPEDIENTE.payload_respuestas` (JSONB).

**D-04 — `TIPO_DOCUMENTO_REQUISITO` se mantiene, con `campo_condicionante_path` en vez de FK.** Como ya no existe `CAMPO_FORMULARIO`, la condición de un requisito condicional ya no apunta a una fila — apunta a una ruta JSON Pointer dentro del `schema_definicion` (ej. `/tipo_persona`).

**D-05 — Restricciones cruzadas implementadas como triggers.** A diferencia de Fase 1, donde esto quedó documentado como pendiente para Piero, en Fase 2 **ya existe una primera implementación** de estos triggers en `05_esquema_sigd_doc_jsonb.sql` v4.0 (validación de adjunto, derivación de estado del requisito, propagación al expediente, bloqueo de expedientes con formulario/tipo inactivo). **Estado: en revisión** — la versión actual tiene 3 bugs de lógica identificados (transición prematura a `EN_REVISION`, inversión de `OBSERVADO`/`SUBSANACION`, bloqueo indebido de reemplazos por subsanación) pendientes de que Piero corrija. Ver Sección 6.

**D-06 — Rutas documentales revisadas.** Sin cambios de fondo; se mantiene vigente para Fase 2, incluyendo las rutas nuevas bajo `backend/docs/`.

**D-07 *(nueva)* — La clasificación legal TUPA se separa de la configuración técnica del formulario.** Se crea `TIPO_TRAMITE_TUPA` (calificación administrativa, plazos, costos, base legal) como entidad independiente de `TIPO_DOCUMENTO` (configuración técnica), vinculadas por FK 1:1. Esto resuelve formalmente la antigua pregunta P-01 (ver Sección 4).

**D-08 *(nueva)* — Estándar de claves primarias: `UUID`.** Todas las tablas de `sigd_doc` usan `UUID` con `gen_random_uuid()` como PK, siguiendo la Matriz de Estandarización del plan de arquitectura global (no solo `BigInt IDENTITY` como en Fase 1).

**D-09 *(nueva)* — Esquema físico `sigd_doc` y renombres de tabla.** El esquema pasa a llamarse `sigd_doc` (antes `docucore`). `ARCHIVO_ADJUNTO` se renombra a `DOCUMENTO_ADJUNTO`. `ruta_storage` se descompone en `s3_bucket` + `s3_key`, reflejando almacenamiento en MinIO/S3 con URLs prefirmadas en vez de una ruta genérica.

**D-10 *(nueva)* — `TIPO_DOCUMENTO` puede existir en borrador sin clasificación TUPA confirmada.** `id_tipo_tramite_tupa` es `NULL`-able; un trigger (`fn_validar_activacion_tipo_documento`) impide que `activo = true` mientras esa FK sea nula. Refleja que la validación legal puede tardar más que la configuración técnica.

**D-11 *(nueva)* — `magic_bytes_validado` bloquea la aprobación de un documento.** Un `DOCUMENTO_ADJUNTO` no puede pasar a `estado_documento = APROBADO` mientras `magic_bytes_validado` sea `false`, implementado como trigger.

---

## 2. Supuestos utilizados

- *(Resuelto — ya no es supuesto, ver D-07)* ~~Se asumía que `TRAMITE_PLANTILLA` y `TIPO_DOCUMENTO` eran la misma entidad.~~ Se confirmó que son dos entidades relacionadas: `TIPO_TRAMITE_TUPA` (legal) y `TIPO_DOCUMENTO` (técnica).
- Se sigue asumiendo que un `EXPEDIENTE` solo puede tener un usuario solicitante (no un trámite iniciado en conjunto por varias personas).
- Se asume que la validación de `payload_respuestas` contra `schema_definicion` (JSON Schema) se ejecuta en la aplicación (Ajv), no en PostgreSQL — un `CHECK` no puede validar estructura JSON arbitraria contra un esquema dinámico.
- Se asume que un mismo `TIPO_DOCUMENTO` no reutiliza formularios de otro tipo — cada `FORMULARIO_VERSION` pertenece a un único `TIPO_DOCUMENTO` (ver P-02, sigue sin resolver formalmente).

---

## 3. Elementos que ya no son "propuesta técnica no confirmada" *(actualiza la Sección 3 de Fase 1)*

En Fase 1, `ruta_storage`, `hash_sha256`, `version_num` e `id_adjunto_anterior` estaban marcados 🔧 como propuestas técnicas pendientes de confirmación institucional. **En Fase 2 ya están confirmados** por el plan de arquitectura global y por los documentos aprobados de Valentín y Azareño:

- Almacenamiento en MinIO/S3 con URLs prefirmadas → `s3_bucket`, `s3_key`.
- Hash SHA-256 obligatorio e inmutable → `sha256_hash`.
- Versionado de documentos por reemplazo → `version_num`, `id_documento_anterior`.
- Validación de Magic Bytes antes de aprobar → `magic_bytes_validado` *(nuevo campo, no existía en Fase 1)*.

Ya no requieren el marcador de incertidumbre; se tratan como parte confirmada del modelo.

---

## 4. Preguntas resueltas durante la Fase 2

| # (Fase 1) | Pregunta | Resolución |
|---|---|---|
| P-01 | ¿`TRAMITE_PLANTILLA` = `TIPO_DOCUMENTO`? | **Resuelto (D-07):** son dos entidades separadas — `TIPO_TRAMITE_TUPA` y `TIPO_DOCUMENTO` — vinculadas por FK. |
| P-04 | ¿Quién formaliza EX-008 y EX-009? | **Resuelto:** EX-008 (interrupción de red) es responsabilidad de Azareño (`01_analisis_json_schema_storage_s3.md`, Sección 8); EX-009 (campo obligatorio vacío) queda cubierta por RN-ADM-003 ítem 5, coordinado con Azareño. Además se agregó **EX-010** (formulario/tipo inactivo), ya implementada como trigger (D-14 técnica). |
| P-08 | Plazo (SLA) de subsanación | **Resuelto:** hasta 2 días hábiles, conforme al Art. 125.1 del TUO de la Ley 27444 (verificado; RN-ADM-002 de Valentín). |
| P-09 | Limpieza de archivos huérfanos | **Resuelto:** Lifecycle Policy de MinIO a las 24 horas (Azareño, Sección 8.3). |

---

## 5. Preguntas pendientes

*(Renumeradas y consolidadas — algunas heredadas de Fase 1 siguen abiertas, otras son nuevas del catálogo TUPA de Valentín)*

| # | Pregunta | Prioridad | Origen |
|---|---|---|---|
| P-02 | ¿Un `FORMULARIO_VERSION` puede reutilizarse entre distintos `TIPO_DOCUMENTO`, o cada tipo tiene siempre el suyo? | Media | Heredada de Fase 1 |
| P-03 / P-11 | ¿Cuáles son los códigos, plazos y montos reales del TUPA vigente del IESTP "Suiza"? | **Crítica** | Valentín, pregunta #1 |
| P-06 / P-12 | ¿Se requiere descomprimir y validar el contenido interno de los `.ZIP` autorizados como excepción en "Anexos Técnicos"? | Alta — urgente, bloquea a Piero | Valentín, pregunta #2 |
| P-07 | ¿El módulo debe validar firma digital PKI/X.509 antes de subir a MinIO, o durante la evaluación? | Media | Azareño, pregunta 2 |
| P-10 | Caso de borde: ¿qué pasa con el archivo ya subido de un requisito condicional si el usuario cambia su respuesta y el requisito deja de aplicar? | Media | Heredada de Fase 1, sin resolver |
| P-13 | ¿Quién notifica al ciudadano cuando opera el Silencio Administrativo Positivo? | Alta | Valentín, pregunta #4 — requiere acuerdo con Grupo 2 (TramiCore) |
| P-14 | ¿El catálogo `TIPO_TRAMITE_TUPA` se sincroniza automáticamente contra el TUPA institucional publicado, o es 100% manual? | Media | Valentín, pregunta #5 |
| P-15 | ¿El IESTP "Suiza" tiene alguna norma interna que exija PDF/A específicamente? | Alta | Valentín, pregunta #6 |
| P-16 | ¿Cada `TIPO_TRAMITE_TUPA` tiene su SAP/SAN confirmado individualmente antes de publicarse como trámite activo? | **Crítica** — bloquea publicación del catálogo real | Valentín, pregunta #7 |
| P-17 *(nueva)* | ¿`TIPO_TRAMITE_TUPA.unidad_organica_responsable` se resuelve con FK real hacia `sigd_org` cuando ese esquema esté disponible, o se mantiene como texto libre? | Media | Cristian — dependencia de Grupo 3 (OrganiCore) |
| P-18 *(nueva)* | Tope máximo global de MB por expediente (`RN-PESO-003`, aún `PENDIENTE`) | Media | Valentín |

---

## 6. Seguimiento técnico abierto — SQL v4.0 de Piero

No son preguntas institucionales, sino bugs de implementación bajo revisión activa, registrados aquí para no perderlos entre iteraciones del SQL:

1. **`fn_recalcular_estado_expediente` transiciona a `EN_REVISION` prematuramente** (con solo `v_total > 0`, sin validar que todos los requisitos obligatorios estén aprobados ni asignar `codigo_oficial`) — rompe la creación de expedientes desde el primer uso.
2. **Inversión de `OBSERVADO`/`SUBSANACION`** en la misma función — contradice la regla ya documentada en la Sección 4 de `03_modelo_datos_docucore_v2.md`.
3. **`fn_validar_adjunto` bloquea reemplazos legítimos por subsanación** — el conteo de archivos activos no excluye correctamente el documento en proceso de reemplazo.

Mientras estos 3 puntos no se corrijan, el SQL de Fase 2 no puede aprobarse como `LISTO`.