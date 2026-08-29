# 02. Análisis Funcional B: Reglas de Negocio, Requisitos y Archivos Adjuntos

**Sistema:** Sistema Integral de Gestión Documentaria (SIGD)
**Módulo:** Módulo de Gestión Documental y Expedientes - DocuCore
**Autor:** Valentín
**Rama Git:** `B_VALENTIN`
**Entregable:** `docs/analisis-funcional/02_reglas_requisitos_adjuntos.md`
**Destinatario:** Cristian (Modelado de Datos - `B_CHRISTIAN`)
**Fecha:** 29 de agosto de 2026
**Versión:** 2.0 — Final. Integra todas las correcciones y mejoras acordadas (OBS-01 a OBS-07, ERR-01 a ERR-04, MEJ-01, MEJ-02).

---

## 1. Contexto General y Propósito del Módulo

Este documento define el comportamiento de las solicitudes cuando los usuarios radican trámites y cargan archivos adjuntos dentro de DocuCore, para que Cristian pueda diseñar la base de datos sin asumir reglas, y dejando todo preparado para auditoría completa y subsanaciones.

> **Nota de coordinación con Azareño:** el trámite que llega a este análisis nace en estado `BORRADOR`, generado por el flujo descrito en `01_analisis_objetivo_actores_flujo.md`. La radicación formal (código oficial `EXP-XXXX` y paso a `EN_REVISION`) ocurre recién cuando se cumplen las reglas descritas aquí.

---

## 2. Clasificación Formativa de la Información

### 2.1. Información Confirmada
* Cada tipo de trámite posee una matriz de requisitos preconfigurada.
* Un trámite no puede pasar a `EN_REVISION` ni obtener código oficial si falta un requisito obligatorio.
* Todo archivo subido pertenece a un único requisito dentro de un expediente específico.
* Un archivo aprobado por un evaluador queda congelado (inmutable): no puede eliminarse ni sobrescribirse.

### 2.2. Propuestas Técnicas 🔧 *(no confirmadas institucionalmente; usadas como diseño de trabajo)*
* **Storage lógico:** los archivos no se guardan como `BLOB` en la base de datos; se guardan en un servidor de archivos u Object Storage (S3/MinIO), registrando solo la ruta lógica.
* **Checksum SHA-256:** firma digital para detectar archivos idénticos y evitar duplicados físicos.
* **Versionado en subsanación:** un archivo rechazado no se borra; se crea un nuevo registro de archivo enlazado al histórico (`v1`, `v2`...).

### 2.3. Datos Pendientes de Validación Institucional
* Tope máximo global de MB por expediente.
* Lista blanca oficial de extensiones (TI debe confirmarla).
* Plazo (SLA) de subsanación antes de rechazo automático.

---

## 3. Reglas de Negocio

### 3.1. Requisitos

**RN-REQ-001 — Clasificación de obligatoriedad:** todo requisito se clasifica como `OBLIGATORIO`, `OPCIONAL` o `CONDICIONAL`.

**RN-REQ-002 — Condicionalidad dinámica:** un requisito condicional se activa según una regla del formulario. *Ejemplo: si `Tipo_Solicitante = "Persona Jurídica"`, se activa `Vigencia de Poder del Representante Legal`.*

**RN-REQ-003 — Vigencia:** si `Requiere_Vigencia = VERDADERO`, el sistema calcula `Fecha_Actual − Fecha_Emisión`; si supera `Dias_Vigencia_Maximos`, aplica el caso EX-006.

**RN-REQ-004 — Orden de presentación:** los requisitos se muestran ordenados por `Orden_Presentacion`.

**RN-REQ-005 — Propagación de estado (Adjunto → Requisito):** *(formalizada — antes citada sin definir)* el estado de `EXPEDIENTE_REQUISITO` se **deriva** del estado de sus archivos activos; el evaluador nunca cambia el estado del requisito directamente, solo el del archivo. Ver tabla completa en la Sección 5.

### 3.2. Archivos Adjuntos

**RN-ADJ-001 — Validación real de formato:** el sistema valida por MIME-Type real (lectura de cabecera / *magic bytes*), no por la extensión del nombre. *Pendiente (OBS-05): definir la tabla de mapeo extensión ↔ MIME-Type esperado que usa el sistema para esta comparación — hoy no está explicitada.*

**RN-ADJ-002 — Peso máximo:** cada requisito define `peso_maximo_mb`; se valida en frontend y se revalida en backend.

**RN-ADJ-003 — Nombre lógico único:**
`TRM_[ID_EXPEDIENTE]_EXPREQ_[ID_EXPEDIENTE_REQUISITO]_V[VERSION]_[TIMESTAMP].[EXT]`
*Ejemplo: `TRM_8819_EXPREQ_004_V2_1724782001123.pdf`*
La extensión real siempre se conserva como parte del nombre físico.

**RN-ADJ-004 — Múltiples adjuntos:** si `Permite_Multiples = VERDADERO`, se limita por `Cantidad_Max_Archivos`; cada archivo es un ítem independiente en `ARCHIVO_ADJUNTO`.

**RN-ADJ-005 — Deduplicación con confirmación:** *(corregido — antes ambiguo)* si el mismo hash SHA-256 aparece en **dos requisitos distintos** del mismo expediente, el sistema **pide confirmación al usuario** antes de reutilizar el archivo físico existente — nunca es automático ni silencioso. Si el duplicado ocurre **dentro del mismo requisito**, la subida se **bloquea directamente**, sin pedir confirmación.

**RN-ADJ-006 — Precedencia en conflictos de concurrencia:** *(nueva, decisión registrada)* cuando un evaluador interviene mientras el usuario sube un archivo: primero se revisa si el expediente sigue en estado editable (`BORRADOR`/`SUBSANACION`) — si no, se responde `403` de inmediato. Si seguía editable al iniciar la subida, se revisa si cambió de estado durante ese lapso — en ese caso se responde `409`, pidiendo refrescar e intentar de nuevo.

---

## 4. Diccionario de Datos

### 4.1. `REQUISITO` (Catálogo Base) — ✅ Confirmado
| Campo | Tipo | Descripción |
|---|---|---|
| `id_requisito` | PK, BigInt | Identificador único. |
| `codigo_requisito` | Varchar(20) | Código estandarizado (ej. `REQ-DNI-01`). |
| `nombre` | Varchar(150) | Título visible. |
| `descripcion_guia` | Text | Instrucciones para el usuario. |
| `tipo_obligatoriedad` | Enum | `OBLIGATORIO` / `OPCIONAL` / `CONDICIONAL`. |
| `orden_presentacion` | SmallInt | Posición en pantalla. |
| `requiere_vigencia` | Boolean | Evalúa vigencia por fecha. |
| `dias_vigencia_max` | Integer, Nullable | Antigüedad máxima en días. |
| `permite_multiples` | Boolean | Permite más de un archivo. |
| `cantidad_max_archivos` | SmallInt, Default 1 | Límite si es múltiple. |
| `peso_maximo_mb` | Decimal(5,2) | Límite de tamaño. |
| `formatos_permitidos` | Varchar(100) | Extensiones válidas, ej. `"PDF,JPG,PNG"`. |

### 4.2. `EXPEDIENTE_REQUISITO` (Instancia por Trámite) — ✅ Confirmado *(antes faltante — OBS-01)*
| Campo | Tipo | Descripción |
|---|---|---|
| `id_expediente_requisito` | PK, BigInt | Identificador único. |
| `id_expediente` | FK, BigInt | Expediente al que pertenece. |
| `id_requisito` | FK, BigInt | Requisito del catálogo aplicado. |
| `estado` | Enum | `PENDIENTE` / `OBSERVADO` / `SUBSANADO` / `APROBADO`. Se deriva del estado de sus archivos activos (RN-REQ-005). |
| `id_evaluador` | FK, BigInt, Nullable | Quién evaluó por última vez. |
| `fecha_evaluacion` | DateTime, Nullable | Cuándo se evaluó por última vez. |
| `fecha_activacion` | DateTime, Nullable | Cuándo se activó (relevante si es condicional). |

### 4.3. `ARCHIVO_ADJUNTO` (Instancia de Archivo) — ✅ Confirmado, 🔧 algunos campos son propuesta técnica
| Campo | Tipo | Descripción |
|---|---|---|
| `id_adjunto` | PK, BigInt | Identificador único. |
| `id_expediente_requisito` | FK, BigInt | Requisito instanciado al que pertenece. |
| `nombre_original` | Varchar(255) | Nombre real en el equipo del usuario. |
| `nombre_logico` | Varchar(255), Unique | Nombre generado (RN-ADJ-003). |
| `ruta_storage` 🔧 | Varchar(500) | Path/URL en el storage. Propuesta técnica (Sección 2.2). |
| `formato_extension` | Varchar(10) | Extensión detectada. |
| `mime_type` | Varchar(100) | Tipo MIME real. |
| `tamanio_bytes` | BigInt | Tamaño exacto. |
| `hash_sha256` 🔧 | Varchar(64) | Firma para integridad y deduplicación. Propuesta técnica. |
| `version_num` 🔧 | SmallInt, Default 1 | Versión (subsanación). Propuesta técnica. |
| `id_adjunto_anterior` 🔧 | FK, BigInt, Nullable | Enlace a la versión previa. Propuesta técnica. |
| `estado_adjunto` | Enum | `CARGADO` / `OBSERVADO` / `APROBADO` / `REEMPLAZADO`. |
| `fecha_creacion` | DateTime | Timestamp de subida. |

---

## 5. Sincronización de Estados: Adjunto → Requisito *(agregado — MEJ-02)*

`EXPEDIENTE_REQUISITO` y `ARCHIVO_ADJUNTO` comparten el valor `OBSERVADO`, pero en niveles distintos. El evaluador nunca cambia el estado del requisito directamente — lo hace indirectamente al evaluar cada adjunto:

| Evento en `ARCHIVO_ADJUNTO` | Efecto en `EXPEDIENTE_REQUISITO` |
|---|---|
| El evaluador aprueba un archivo activo en su primera revisión (sin observación previa) | El requisito pasa a `APROBADO` (si todos sus archivos activos ya están aprobados) |
| El evaluador marca un archivo activo como `OBSERVADO` | El requisito pasa a `OBSERVADO` (basta 1 archivo activo observado — RN-REQ-005) |
| El usuario sube el reemplazo y queda `CARGADO` (v2) | El requisito pasa a `SUBSANADO` — no salta directo a `APROBADO`; requiere revisión del evaluador |
| El evaluador revisa el v2 y lo marca `APROBADO` | El requisito pasa a `APROBADO` (si todos sus archivos activos ya están aprobados) |
| El evaluador vuelve a rechazar el v2 | El requisito regresa a `OBSERVADO`, reiniciando el ciclo |

---

## 6. Matriz de Requisitos y Adjuntos (Ejemplo Ilustrativo)

⚠️ **Los valores numéricos de esta tabla son ilustrativos**; los topes reales están pendientes de confirmación institucional (Sección 8, pregunta 1).

| ID | Nombre | Obligatoriedad | Formatos | Peso Máx. | Múltiples | Vigencia / Condición |
|---|---|---|---|---|---|---|
| REQ-001 | DNI | Obligatorio | PDF, JPG, PNG | 5 MB | No | Sin vigencia. |
| REQ-002 | Comprobante de Pago | Obligatorio | PDF, JPG | 2 MB | No | Vigencia máx. 30 días. |
| REQ-003 | Vigencia de Poder | Condicional | PDF | 10 MB | No | Si `Tipo_Persona = "JURIDICA"`. Vigencia máx. 30 días. |
| REQ-004 | Anexos Técnicos | Opcional | PDF, DWG, ZIP | 25 MB | Sí (máx. 5) | Sin vigencia. |
| REQ-005 | Autorización Sectorial | Condicional | PDF | 8 MB | No | Si `Afecta_Entorno = "VERDADERO"`. Vigencia máx. 365 días. |

---

## 7. Casos Excepcionales

| Código | Condición | Resultado | Mensaje al Usuario |
|---|---|---|---|
| EX-001 | Envío con requisitos obligatorios/condicionales sin adjuntar. | Bloquea envío, resalta secciones incompletas. | *"Aún faltan requisitos obligatorios por adjuntar."* |
| EX-002 | Archivo supera el peso configurado. | Cancela la subida, no consume almacenamiento. | *"El archivo excede el peso máximo permitido."* |
| EX-003 | Extensión/MIME-Type no permitido. | Rechaza la selección. | *"Formato no permitido. Aceptados: [lista]."* |
| EX-004 | Hash duplicado en **dos requisitos distintos** del mismo expediente. | Pide confirmación antes de reutilizar el archivo físico (RN-ADJ-005). | *"Este archivo ya fue adjuntado en otro requisito. ¿Desea continuar?"* |
| EX-004b | Hash duplicado **dentro del mismo requisito**. | Bloquea la subida directamente, sin preguntar. | *"Este archivo ya fue adjuntado a este requisito."* |
| EX-005 | Intento de modificar adjuntos con expediente en `EN_REVISION`/`APROBADO`/`INACTIVO`. | Deshabilita botones de subida/edición. | *"El expediente está en evaluación y no admite cambios."* |
| EX-006 | Fecha de emisión supera `Dias_Vigencia_Max`. | Se registra pero se etiqueta `OBSERVADO`. | *"El documento supera la antigüedad permitida. Quedará sujeto a evaluación."* |
| EX-007 | Se excede `cantidad_max_archivos` en un requisito múltiple. | Deshabilita "Agregar otro archivo". | *"Ha alcanzado el límite de archivos para este requisito."* |
| EX-008 *(pendiente de asignar dueño)* | Campo de formulario obligatorio queda vacío al enviar. | A confirmar si corresponde a este documento o a la verificación inicial de Azareño (`01_analisis...`, paso 4). | — |
| EX-009 *(pendiente de asignar dueño)* | El formulario/plantilla del tipo de documento está desactivado desde administración (distinto de expediente inactivo). | A confirmar el mismo criterio que EX-008. | — |

---

## 8. Preguntas Pendientes de Validación Institucional

1. Tope máximo global de MB por expediente (suma de todos los adjuntos).
2. ¿Se permiten archivos `.ZIP`/`.RAR` en requisitos múltiples, o deben descomprimirse antes?
3. ¿El módulo debe validar firma digital PKI (Firma Perú/Refirma) dentro del PDF, o se acepta y la firma se valida visualmente?
4. Plazo (SLA) en días hábiles para subsanar un requisito observado antes de rechazo automático por caducidad.
5. Proceso de limpieza automática de archivos huérfanos (expedientes en `BORRADOR` sin radicar) — confirmación final de si sigue vigente.
6. Caso de borde: ¿qué pasa con el archivo ya subido de un requisito condicional si el usuario cambia su respuesta y el requisito deja de aplicar?
7. ¿`TRAMITE_PLANTILLA` (mencionada por Cristian) es la misma entidad que "tipo de documento" del análisis de Azareño? — confirmar antes del modelado.
8. Dueño de EX-008 y EX-009 (¿Valentín o Azareño?).

---

## 9. Ejemplo de Flujo Completo

1. Usuario elige *"Licencia Ambiental"*, expediente nace en `BORRADOR` (ver `01_analisis...`).
2. `Tipo_Persona = "Jurídica"` activa `REQ-001`, `REQ-002` y el condicional `REQ-003` (RN-REQ-002).
3. Sube `dni_representante.pdf` (2.1 MB) para `REQ-001`: extensión validada, hash generado, nombre lógico `TRM_8819_EXPREQ_001_V1_...pdf`.
4. Intenta subir un plano de 30 MB para `REQ-003`: se activa EX-002, se cancela; comprime a 8 MB y se acepta.
5. Con todos los obligatorios cargados, el sistema asigna código `EXP-2026-008819` y pasa a `EN_REVISION`.
6. El evaluador observa `REQ-003` por estar borroso: el archivo pasa a `OBSERVADO`, y por RN-REQ-005 el requisito también pasa a `OBSERVADO`.
7. El usuario sube un nuevo archivo: el v1 pasa a `REEMPLAZADO`, el v2 nace `CARGADO`, y el requisito pasa a `SUBSANADO` hasta que el evaluador lo revise de nuevo.
