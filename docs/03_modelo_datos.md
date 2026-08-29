# 03. Modelo de Datos

**Sistema:** Sistema Integral de Gestión Documentaria (SIGD)
**Módulo:** DocuCore
**Autor:** Cristian
**Rama Git:** `B_CHRISTIAN`
**Entregable:** `docs/modelo-datos/03_modelo_datos.md`
**Insumos:** `01_analisis_objetivo_actores_flujo.md` (Azareño, v1.1) + `02_reglas_requisitos_adjuntos.md` (Valentín, v2.0)
**Destinatario:** Piero (SQL - `B_PIERO`)
**Fecha:** 29 de agosto de 2026

---

## 1. Criterio de diseño

El modelo se construye sobre dos ideas que ya vienen definidas y aprobadas en los análisis funcionales:

1. **Configuración separada de instancia** (patrón repetido en todo el dominio): existe un catálogo reutilizable (`TIPO_DOCUMENTO`, `REQUISITO`) y una instancia aplicada a un caso concreto (`EXPEDIENTE`, `EXPEDIENTE_REQUISITO`). Esto es lo que Azareño pedía al explicar por qué DocuCore no debe programarse trámite por trámite, y es exactamente el mismo patrón que Valentín ya aplicó a los requisitos.
2. **El estado del requisito se deriva, no se asigna directamente** (RN-REQ-005, Valentín): el evaluador actúa sobre el archivo, y el requisito cambia de estado como consecuencia. El modelo debe soportar esto con una relación clara entre `ARCHIVO_ADJUNTO` y `EXPEDIENTE_REQUISITO`.

**Decisión de diseño (ver también `07_decisiones_y_preguntas_pendientes.md`):** se adopta la hipótesis de que `TRAMITE_PLANTILLA` (mencionada como pendiente en la especificación de Valentín) y `TIPO_DOCUMENTO` (descrita por Azareño) son la **misma entidad**. Se modela una sola vez, bajo el nombre `TIPO_DOCUMENTO`, pendiente de confirmación formal.

---

## 2. Entidades

### 2.1. `USUARIO`
Representa a cualquier persona que interactúa con el sistema (los 4 actores de Azareño: Administrador, Solicitante, Evaluador, Consultante).

| Atributo | Tipo | Restricción |
|---|---|---|
| `id_usuario` | BigInt | **PK** |
| `nombre_completo` | Varchar(200) | NOT NULL |
| `correo` | Varchar(150) | NOT NULL, UNIQUE |
| `rol` | Enum(`ADMINISTRADOR`,`SOLICITANTE`,`EVALUADOR`,`CONSULTANTE`) | NOT NULL |
| `activo` | Boolean | DEFAULT true |
| `fecha_creacion` | DateTime | DEFAULT now() |

*Nota: se modela `rol` como un único atributo enum, no como catálogo aparte de roles. Es una simplificación deliberada — ver decisión D-01.*

### 2.2. `TIPO_DOCUMENTO` *(= hipótesis `TRAMITE_PLANTILLA`)*
El catálogo de trámites configurables (ej. Solicitud, Certificado de Estudios — o los ejemplos de Valentín, según se resuelva con el profesor).

| Atributo | Tipo | Restricción |
|---|---|---|
| `id_tipo_documento` | BigInt | **PK** |
| `codigo` | Varchar(30) | NOT NULL, UNIQUE |
| `nombre` | Varchar(150) | NOT NULL |
| `descripcion` | Text | NULL |
| `activo` | Boolean | DEFAULT true |
| `id_usuario_creador` | BigInt | **FK → USUARIO** |
| `fecha_creacion` | DateTime | DEFAULT now() |

### 2.3. `FORMULARIO`
La definición de campos asociada a un tipo de documento.

| Atributo | Tipo | Restricción |
|---|---|---|
| `id_formulario` | BigInt | **PK** |
| `id_tipo_documento` | BigInt | **FK → TIPO_DOCUMENTO**, UNIQUE |
| `version` | SmallInt | DEFAULT 1 |
| `activo` | Boolean | DEFAULT true |
| `fecha_creacion` | DateTime | DEFAULT now() |

*Nota: se asume relación 1:1 con `TIPO_DOCUMENTO` (un formulario por tipo). Azareño dejó esto como pregunta pendiente (¿puede reutilizarse un formulario entre tipos?) — ver decisión D-02.*

### 2.4. `CAMPO_FORMULARIO`
Los campos individuales que componen un formulario.

| Atributo | Tipo | Restricción |
|---|---|---|
| `id_campo` | BigInt | **PK** |
| `id_formulario` | BigInt | **FK → FORMULARIO** |
| `nombre_campo` | Varchar(150) | NOT NULL |
| `tipo_dato` | Enum(`TEXTO`,`NUMERO`,`FECHA`,`SELECCION`) | NOT NULL |
| `obligatorio` | Boolean | DEFAULT true |
| `orden` | SmallInt | NOT NULL |
| `opciones` | Text | NULL (lista para `tipo_dato = SELECCION`) |

### 2.5. `EXPEDIENTE`
El trámite en curso — nace en `BORRADOR` (flujo de Azareño) y se radica formalmente al completar los requisitos obligatorios (flujo de Valentín).

| Atributo | Tipo | Restricción |
|---|---|---|
| `id_expediente` | BigInt | **PK** |
| `codigo_oficial` | Varchar(30) | UNIQUE, NULL (se asigna recién en la radicación) |
| `id_tipo_documento` | BigInt | **FK → TIPO_DOCUMENTO** |
| `id_usuario_solicitante` | BigInt | **FK → USUARIO** |
| `estado` | Enum(`BORRADOR`,`EN_REVISION`,`OBSERVADO`,`APROBADO`,`RECHAZADO_POR_CADUCIDAD`) | DEFAULT `BORRADOR` |
| `fecha_creacion` | DateTime | DEFAULT now() |
| `fecha_radicacion` | DateTime | NULL |

### 2.6. `VALOR_CAMPO`
Los datos que el solicitante ingresó en cada campo del formulario (verificación inicial de Azareño, paso 4).

| Atributo | Tipo | Restricción |
|---|---|---|
| `id_valor_campo` | BigInt | **PK** |
| `id_expediente` | BigInt | **FK → EXPEDIENTE** |
| `id_campo` | BigInt | **FK → CAMPO_FORMULARIO** |
| `valor` | Text | NOT NULL |

Restricción: `UNIQUE(id_expediente, id_campo)` — un campo no puede tener dos valores en el mismo expediente.

### 2.7. `REQUISITO` *(catálogo, tal como lo definió Valentín)*

| Atributo | Tipo | Restricción |
|---|---|---|
| `id_requisito` | BigInt | **PK** |
| `codigo_requisito` | Varchar(20) | NOT NULL, UNIQUE |
| `nombre` | Varchar(150) | NOT NULL |
| `descripcion_guia` | Text | NULL |
| `tipo_obligatoriedad` | Enum(`OBLIGATORIO`,`OPCIONAL`,`CONDICIONAL`) | NOT NULL |
| `orden_presentacion` | SmallInt | NOT NULL |
| `requiere_vigencia` | Boolean | DEFAULT false |
| `dias_vigencia_max` | Integer | NULL |
| `permite_multiples` | Boolean | DEFAULT false |
| `cantidad_max_archivos` | SmallInt | DEFAULT 1 |
| `peso_maximo_mb` | Decimal(5,2) | NOT NULL |
| `formatos_permitidos` | Varchar(100) | NOT NULL |

### 2.8. `TIPO_DOCUMENTO_REQUISITO`
La matriz de configuración: qué requisitos aplican a qué tipo de documento, y bajo qué condición (RN-REQ-002).

| Atributo | Tipo | Restricción |
|---|---|---|
| `id_tipo_documento_requisito` | BigInt | **PK** |
| `id_tipo_documento` | BigInt | **FK → TIPO_DOCUMENTO** |
| `id_requisito` | BigInt | **FK → REQUISITO** |
| `obligatoriedad_override` | Enum(`OBLIGATORIO`,`OPCIONAL`,`CONDICIONAL`) | NULL (si es NULL, hereda de `REQUISITO.tipo_obligatoriedad`) |
| `id_campo_condicionante` | BigInt | **FK → CAMPO_FORMULARIO**, NULL |
| `valor_condicionante` | Varchar(100) | NULL |

Restricción: `UNIQUE(id_tipo_documento, id_requisito)` — un requisito no se repite dos veces para el mismo tipo de documento.

### 2.9. `EXPEDIENTE_REQUISITO`
La instancia de un requisito aplicado a un expediente concreto.

| Atributo | Tipo | Restricción |
|---|---|---|
| `id_expediente_requisito` | BigInt | **PK** |
| `id_expediente` | BigInt | **FK → EXPEDIENTE** |
| `id_tipo_documento_requisito` | BigInt | **FK → TIPO_DOCUMENTO_REQUISITO** |
| `estado` | Enum(`PENDIENTE`,`OBSERVADO`,`SUBSANADO`,`APROBADO`) | DEFAULT `PENDIENTE` |
| `id_evaluador` | BigInt | **FK → USUARIO**, NULL |
| `fecha_evaluacion` | DateTime | NULL |
| `fecha_activacion` | DateTime | NULL |

Restricción: `UNIQUE(id_expediente, id_tipo_documento_requisito)`.

### 2.10. `ARCHIVO_ADJUNTO` *(tal como lo definió Valentín, con `id_adjunto_anterior` para versionado)*

| Atributo | Tipo | Restricción |
|---|---|---|
| `id_adjunto` | BigInt | **PK** |
| `id_expediente_requisito` | BigInt | **FK → EXPEDIENTE_REQUISITO** |
| `nombre_original` | Varchar(255) | NOT NULL |
| `nombre_logico` | Varchar(255) | NOT NULL, UNIQUE |
| `ruta_storage` 🔧 | Varchar(500) | NOT NULL |
| `formato_extension` | Varchar(10) | NOT NULL |
| `mime_type` | Varchar(100) | NOT NULL |
| `tamanio_bytes` | BigInt | NOT NULL |
| `hash_sha256` 🔧 | Varchar(64) | NOT NULL |
| `version_num` 🔧 | SmallInt | DEFAULT 1 |
| `id_adjunto_anterior` 🔧 | BigInt | **FK → ARCHIVO_ADJUNTO** (self), NULL |
| `estado_adjunto` | Enum(`CARGADO`,`OBSERVADO`,`APROBADO`,`REEMPLAZADO`) | DEFAULT `CARGADO` |
| `fecha_creacion` | DateTime | DEFAULT now() |

🔧 = campo de propuesta técnica, no confirmado institucionalmente (heredado de la clasificación de Valentín).

---

## 3. Relaciones y cardinalidades

| Relación | Cardinalidad |
|---|---|
| USUARIO — TIPO_DOCUMENTO (crea) | 1 : N |
| USUARIO — EXPEDIENTE (solicita) | 1 : N |
| USUARIO — EXPEDIENTE_REQUISITO (evalúa) | 1 : N (opcional) |
| TIPO_DOCUMENTO — FORMULARIO | 1 : 1 *(asumido, ver D-02)* |
| FORMULARIO — CAMPO_FORMULARIO | 1 : N |
| TIPO_DOCUMENTO — EXPEDIENTE | 1 : N |
| EXPEDIENTE — VALOR_CAMPO | 1 : N |
| CAMPO_FORMULARIO — VALOR_CAMPO | 1 : N |
| TIPO_DOCUMENTO — TIPO_DOCUMENTO_REQUISITO | 1 : N |
| REQUISITO — TIPO_DOCUMENTO_REQUISITO | 1 : N |
| CAMPO_FORMULARIO — TIPO_DOCUMENTO_REQUISITO (condicionante) | 1 : N (opcional) |
| EXPEDIENTE — EXPEDIENTE_REQUISITO | 1 : N |
| TIPO_DOCUMENTO_REQUISITO — EXPEDIENTE_REQUISITO | 1 : N |
| EXPEDIENTE_REQUISITO — ARCHIVO_ADJUNTO | 1 : N |
| ARCHIVO_ADJUNTO — ARCHIVO_ADJUNTO (versión anterior) | 1 : N (autorreferencia opcional) |

---

## 4. Restricciones que no se resuelven con CHECK simple (para Piero)

Estas reglas de negocio cruzan tablas, así que no se implementan como `CHECK` de columna — probablemente necesiten trigger o validación en aplicación:

- **RN-ADJ-002 (peso máximo):** `ARCHIVO_ADJUNTO.tamanio_bytes` no debe superar `REQUISITO.peso_maximo_mb` del requisito asociado (vía `EXPEDIENTE_REQUISITO → TIPO_DOCUMENTO_REQUISITO → REQUISITO`).
- **RN-REQ-005 (propagación de estado):** al cambiar `ARCHIVO_ADJUNTO.estado_adjunto`, debe recalcularse `EXPEDIENTE_REQUISITO.estado` según la tabla de sincronización del documento de Valentín (Sección 5).
- **RN-ADJ-005 (deduplicación):** requiere lógica de aplicación (verificar `hash_sha256` existente antes de insertar), no una restricción declarativa.
- **RN-ADJ-004 (múltiples adjuntos):** el conteo de archivos activos por `id_expediente_requisito` no debe superar `cantidad_max_archivos` — se recomienda validar en aplicación antes del INSERT, ya que un `CHECK` no puede contar filas relacionadas.

CHECK simples que sí aplican directamente en columna:
- `EXPEDIENTE.codigo_oficial` solo debe tener valor si `estado != 'BORRADOR'`.
- `CAMPO_FORMULARIO.opciones` solo debería tener valor si `tipo_dato = 'SELECCION'` (validar en aplicación o CHECK condicional).

---

## 5. Pendiente antes de que Piero traduzca esto a SQL

Ver `07_decisiones_y_preguntas_pendientes.md` — en particular D-01, D-02 y la confirmación de `TIPO_DOCUMENTO` = `TRAMITE_PLANTILLA`, y el dueño de EX-008/EX-009.
