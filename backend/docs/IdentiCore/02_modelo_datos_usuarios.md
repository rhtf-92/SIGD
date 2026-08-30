# Modelo de Datos Relacional - Módulo IdentiCore (Usuarios, Personas, Cuentas y Perfiles)

- **Grupo:** Grupo 4 — IdentiCore · Responsable del modelo: Segundo (B_SEGUNDO)
- **Estado:** BORRADOR — PROPUESTA PENDIENTE DE VALIDACIÓN INSTITUCIONAL
- **Fecha:** 30 de agosto de 2026
- **Dependencias:** Análisis funcional (`01_analisis_usuarios_internos_externos.md`, B_TAPULLIMA) e información oficial sobre áreas, cargos, roles y políticas de registro (pendiente de confirmación).
- **Convención de niveles:** CONFIRMADO / PROPUESTO / PENDIENTE / EJEMPLO (según el plan de trabajo del grupo).

> **Propósito:** Presentar el modelo lógico de datos preliminar del módulo IdentiCore, derivado del análisis funcional, que separa conceptualmente la **identidad civil** (persona), las **credenciales de acceso** (cuenta de usuario) y los **roles institucionales** (perfil interno/externo). El DNI u otro documento visible **no** se utiliza como clave primaria técnica de ninguna tabla.

---

## 1. Descripción del Modelo

El módulo IdentiCore gestiona la identificación y administración de las personas que interactúan con el SIGD. El modelo adopta tres conceptos separados para evitar la duplicación de datos personales y para permitir representar tanto a usuarios internos como externos (registrados o sin cuenta permanente):

1. **Persona** (`personas`): entidad de **identidad civil**. Una persona existe una única vez en el sistema, independientemente de cuántas cuentas o vínculos tenga.
2. **Cuenta de usuario** (`cuenta_usuario`): entidad de **credenciales de acceso**. Concentra los datos necesarios para autenticarse (usuario, correo, hash de contraseña, estado) y queda desacoplada de la identidad civil.
3. **Perfil institucional** (`perfil_usuario`): entidad de **rol y vínculo con la institución**. Representa cómo una persona participa dentro del SIGD: usuario interno (vinculado a un área/cargo del Grupo 3) o usuario externo (remitente/solicitante, registrado o no).

Esta separación permite que un usuario externo pueda intervenir como remitente **sin** poseer una cuenta permanente (perfil externo sin credenciales) y que un usuario interno quede identificado por su vínculo institucional y no por datos personales repetidos.

> **Postura frente al módulo OrganiCore (Grupo 3):** las áreas, cargos, roles y permisos pertenecen a OrganiCore y no se duplican aquí. IdentiCore referencia el vínculo a esas entidades mediante claves externas conceptuales, sin asumir su diseño definitivo.

---

## 2. Definición de Entidades

### `personas`
Identidad civil única de la persona que interactúa con el SIGD.
- `id` (PK, BIGSERIAL)
- `tipo_documento_id` (FK, BIGINT, NOT NULL) $\rightarrow$ `tipos_documento.id`
- `numero_documento` (VARCHAR 20, NOT NULL)
- `nombres` (VARCHAR 120, NOT NULL)
- `apellido_paterno` (VARCHAR 120, NOT NULL)
- `apellido_materno` (VARCHAR 120, NULL)
- `fecha_nacimiento` (DATE, NULL)
- `genero` (VARCHAR 1, NULL)
- `telefono` (VARCHAR 20, NULL)
- `email_contacto` (VARCHAR 150, NULL)
- `estado` (BOOLEAN, DEFAULT true)

> **Unicidad del documento (PROPUESTO):** se propone una restricción única compuesta sobre `(tipo_documento_id, numero_documento)` para prevenir duplicados de identidad solo cuando el análisis y las reglas institucionales lo justifiquen. **Nunca** se usa `numero_documento` como clave primaria ni como identificador interno de referencia.

---

### `tipos_documento`
Catálogo de tipos de documento de identidad admitidos (verificado contra la institución).
- `id` (PK, BIGSERIAL)
- `codigo` (VARCHAR 20, NOT NULL, UNIQUE)
- `nombre` (VARCHAR 60, NOT NULL)
- `estado` (BOOLEAN, DEFAULT true)

> **Valores PENDIENTES:** cuáles tipos de documento son admisibles (DNI, carné de extranjería, pasaporte, etc.) queda pendiente de confirmación institucional. La tabla es un catálogo abierto para no rigidizar la decisión.

---

### `cuenta_usuario`
Credenciales de acceso a la aplicación. Solo existe si la persona posee una cuenta permanente en el SIGD.
- `id` (PK, BIGSERIAL)
- `persona_id` (FK, BIGINT, NOT NULL) $\rightarrow$ `personas.id`
- `username` (VARCHAR 50, NOT NULL, UNIQUE)
- `email_login` (VARCHAR 150, NOT NULL, UNIQUE)
- `password_hash` (VARCHAR 255, NOT NULL)
- `estado` (BOOLEAN, DEFAULT true)
- `intentos_fallidos` (SMALLINT, DEFAULT 0)
- `bloqueado_hasta` (TIMESTAMPTZ, NULL)
- `ultimo_acceso` (TIMESTAMPTZ, NULL)
- `created_at` / `updated_at`

> **Seguridad (CONFIRMADO por buenas prácticas):** nunca se almacena la contraseña en texto plano; solo `password_hash` (ej. bcrypt). Los datos de autenticación no forman parte de la identidad civil.

---

### `perfil_usuario`
Vínculo institucional de una persona dentro del SIGD. Determina su **tipo** (interno / externo registrado / externo sin cuenta).
- `id` (PK, BIGSERIAL)
- `persona_id` (FK, BIGINT, NOT NULL) $\rightarrow$ `personas.id`
- `cuenta_usuario_id` (FK, BIGINT, NULL) $\rightarrow$ `cuenta_usuario.id`
- `tipo_usuario` (VARCHAR 20, NOT NULL) — valores: `INTERNO` | `EXTERNO`
- `condicion_registro` (VARCHAR 20, NOT NULL) — valores: `CON_CUENTA` | `SIN_CUENTA`
- `area_id` (FK, BIGINT, NULL) $\rightarrow$ referencia conceptual al módulo OrganiCore (`areas.id`, Grupo 3)
- `cargo_id` (FK, BIGINT, NULL) $\rightarrow$ referencia conceptual al módulo OrganiCore (`cargos.id`, Grupo 3)
- `rol_id` (FK, BIGINT, NULL) $\rightarrow$ referencia conceptual al módulo OrganiCore (`roles.id`, Grupo 3)
- `fecha_vigencia_inicio` (DATE, NULL)
- `fecha_vigencia_fin` (DATE, NULL)
- `estado` (BOOLEAN, DEFAULT true)

> **Justificación del tipo/condición:** `tipo_usuario` distingue interno de externo; `condicion_registro` indica si posee cuenta permanente. Un externo **sin cuenta** tiene `cuenta_usuario_id` NULL y un `tipo_usuario = EXTERNO`, permitiendo que intervenga como remitente sin credenciales.
>
> **Dependencia con OrganiCore (PROPUESTO):** `area_id`, `cargo_id` y `rol_id` son referencias conceptuales a tablas del Grupo 3. No se crean tablas propias de áreas/roles en IdentiCore y los nombres o tipos finales de FK se ajustarán al diseño definitivo de OrganiCore.

---

### `persona_documento_historial` (PROPUESTO)
Historial de documentos de identidad asociados a cada persona (para casos de cambio de documento o corrección de identidad).
- `id` (PK, BIGSERIAL)
- `persona_id` (FK, BIGINT, NOT NULL) $\rightarrow$ `personas.id`
- `tipo_documento_id` (FK, BIGINT, NOT NULL) $\rightarrow$ `tipos_documento.id`
- `numero_documento_anterior` (VARCHAR 20, NOT NULL)
- `fecha_registro` (TIMESTAMPTZ, NOT NULL)
- `motivo` (TEXT, NULL)

---

### `auditoria_usuarios` (PROPUESTO)
Trazabilidad de las operaciones sobre personas, cuentas y perfiles (registro, actualización, activación, desactivación, cambio de estado).
- `id` (PK, BIGSERIAL)
- `usuario_accion_id` (FK, BIGINT, NULL) $\rightarrow$ referencia al usuario que realizó la acción
- `entidad_afectada` (VARCHAR 40, NOT NULL) — `PERSONA` | `CUENTA` | `PERFIL`
- `entidad_id` (BIGINT, NOT NULL)
- `accion` (VARCHAR 30, NOT NULL)
- `detalle` (JSONB, NULL)
- `fecha` (TIMESTAMPTZ, NOT NULL DEFAULT now())

---

## 3. Relaciones del Modelo

| Relación | Tipo | Descripción |
| :--- | :--- | :--- |
| `tipos_documento` $\rightarrow$ `personas` | 1:N | Un tipo de documento puede identificar a muchas personas. |
| `personas` $\rightarrow$ `cuenta_usuario` | 1:N | Una persona puede poseer una o más cuentas (desacopladas de su identidad). |
| `personas` $\rightarrow$ `perfil_usuario` | 1:N | Una persona puede tener uno o más perfiles institucionales (p. ej. interno y externo, o histórico de vínculos). |
| `cuenta_usuario` $\rightarrow$ `perfil_usuario` | 1:N | Una cuenta puede asociarse a uno o más perfiles (la cuenta es un medio de acceso). |
| `personas` $\rightarrow$ `persona_documento_historial` | 1:N | Una persona puede tener múltiples registros históricos de documento. |
| `perfil_usuario` $\rightarrow$ (OrganiCore `areas`, `cargos`, `roles`) | N:1 (conceptual) | Vínculo de la persona con la estructura institucional definida por el Grupo 3. |

> **Cardinalidad persona–cuenta (PROPUESTO):** se modela como 1:N en lugar de 1:1 para dar flexibilidad a casos de recuperación de acceso o múltiples medios, quedando pendiente de confirmación si la institución exige una sola cuenta por persona.

---

## 4. Justificación de la Separación de Conceptos

| Concepto | Entidad | Pregunta que responde | Evita |
| :--- | :--- | :--- | :--- |
| Identidad civil | `personas` | ¿Quién es esta persona? | Duplicar datos personales en cada cuenta o perfil. |
| Credenciales | `cuenta_usuario` | ¿Cómo se autentica al sistema? | Mezclar datos de acceso con identidad y exponer riesgos de seguridad. |
| Rol institucional | `perfil_usuario` | ¿Cómo participa en el SIGD? | Mezclar la condición interna/externa con la identidad o las credenciales. |

---

## 5. Restricciones e Índices Propuestos

| Elemento | Entidad | Detalle | Nivel |
| :--- | :--- | :--- | :--- |
| UNIQUE `(tipo_documento_id, numero_documento)` | `personas` | Evita identidad duplicada (sujeto a validación) | PROPUESTO |
| UNIQUE `username` / `email_login` | `cuenta_usuario` | Identificadores de acceso únicos | CONFIRMADO |
| UNIQUE `codigo` | `tipos_documento` | Código de catálogo único | CONFIRMADO |
| CHECK `tipo_usuario IN ('INTERNO','EXTERNO')` | `perfil_usuario` | Valores controlados de tipo | PROPUESTO |
| CHECK `condicion_registro IN ('CON_CUENTA','SIN_CUENTA')` | `perfil_usuario` | Valores controlados de condición | PROPUESTO |
| Índice por `(estado, tipo_usuario)` | `perfil_usuario` | Búsquedas de usuarios por estado/tipo | PROPUESTO |
| Índice por `numero_documento` | `personas` | Búsqueda por documento sin convertirlo en PK | PROPUESTO |

---

## 6. Datos de Ejemplo (NO OFICIALES)

> Los siguientes datos son **EJEMPLO** y solo demuestran el funcionamiento del modelo; **no** contienen DNI, nombres, correos ni contraseñas reales.

| Persona | Tipo doc. (ej.) | Nro. doc. (ej.) | Cuenta (username) | Perfil | Área (ej.) | Rol (ej.) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Persona A | DNI | 00000001 | `usuario.interno01` | INTERNO / CON_CUENTA | Área de Mesa de Partes | `ROLE_OPERADOR` |
| Persona B | DNI | 00000002 | `externo.registrado01` | EXTERNO / CON_CUENTA | — | `ROLE_EXTERNO` |
| Persona C | DNI | 00000003 | *(NULL)* | EXTERNO / SIN_CUENTA | — | — |

> Nota: los códigos `ROLE_*` y los nombres de área/cargo son referencias ilustrativas al módulo OrganiCore y no se definen aquí.

---

## 7. Dependencias e Integración con Otros Módulos

| Módulo | Grupo | Uso de IdentiCore |
| :--- | :--- | :--- |
| OrganiCore | G3 | Provee `areas`, `cargos`, `roles` y `permisos` que IdentiCore referencia desde `perfil_usuario`. |
| RutaDoc | G1 | Consume identificadores internos de usuario (`personas.id` / `perfil_usuario.id`) para la trazabilidad de movimientos. |
| TramiCore | G2 | Asocia trámites y expedientes con remitentes/solicitantes representados por IdentiCore. |
| DocuCore | G5 | Vincula documentos con el usuario que los registró o los firmó. |
| CoreLink | G6 | Compone los contratos inter-módulo; valida referencias a usuarios sin duplicar sus datos. |

> **Postura de integración (PROPUESTO):** IdentiCore expone identificadores internos estables (nunca el documento visible) para que los demás módulos tracen operaciones. Esto evita duplicar datos personales y mantiene la trazabilidad.
