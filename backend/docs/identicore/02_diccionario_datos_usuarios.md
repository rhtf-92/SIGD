# Diccionario de Datos - Módulo IdentiCore (Usuarios, Personas, Cuentas y Perfiles)

- **Grupo:** Grupo 4 — IdentiCore · Responsable del modelo: Segundo (B_SEGUNDO)
- **Estado:** BORRADOR — PROPUESTA PENDIENTE DE VALIDACIÓN INSTITUCIONAL
- **Fecha:** 30 de agosto de 2026
- **Convención:** niveles CONFIRMADO / PROPUESTO / PENDIENTE / EJEMPLO; el DNI **no** es clave primaria técnica.

---

## Tabla: `tipos_documento`

Catálogo de tipos de documento de identidad admitidos en el SIGD.

| Campo | Tipo de Dato | Nulidad | Llave | Descripción | Nivel |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | BIGSERIAL | NOT NULL | PK | Identificador único del tipo de documento | CONFIRMADO |
| `codigo` | VARCHAR(20) | NOT NULL | UNIQUE | Código identificador (ej. `DNI`, `CE`) | CONFIRMADO |
| `nombre` | VARCHAR(60) | NOT NULL | - | Nombre descriptivo del tipo de documento | CONFIRMADO |
| `estado` | BOOLEAN | NOT NULL | DEFAULT true | Estado activo/inactivo del catálogo | CONFIRMADO |

---

## Tabla: `personas`

Identidad civil única de la persona que interactúa con el SIGD.

| Campo | Tipo de Dato | Nulidad | Llave | Descripción | Nivel |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | BIGSERIAL | NOT NULL | PK | Identificador interno de la persona (nunca el documento) | CONFIRMADO |
| `tipo_documento_id` | BIGINT | NOT NULL | FK (`tipos_documento.id`) | Tipo de documento de identidad | CONFIRMADO |
| `numero_documento` | VARCHAR(20) | NOT NULL | UNIQUE (compuesta) | Número de documento visible de identidad | CONFIRMADO |
| `nombres` | VARCHAR(120) | NOT NULL | - | Nombres de la persona | CONFIRMADO |
| `apellido_paterno` | VARCHAR(120) | NOT NULL | - | Apellido paterno | CONFIRMADO |
| `apellido_materno` | VARCHAR(120) | NULL | - | Apellido materno (opcional según normativa) | PENDIENTE |
| `fecha_nacimiento` | DATE | NULL | - | Fecha de nacimiento (opcional) | PENDIENTE |
| `genero` | VARCHAR(1) | NULL | - | Género (opcional; valores por confirmar) | PENDIENTE |
| `telefono` | VARCHAR(20) | NULL | - | Teléfono de contacto | PROPUESTO |
| `email_contacto` | VARCHAR(150) | NULL | - | Correo de contacto personal (distinto del login) | PROPUESTO |
| `estado` | BOOLEAN | NOT NULL | DEFAULT true | Estado activo/inactivo de la persona | CONFIRMADO |

> **Unicidad compuesta (PROPUESTO):** `UNIQUE(tipo_documento_id, numero_documento)` para prevenir duplicados de identidad. El documento visible se usa para identificación, **no** como clave primaria técnica interna.

---

## Tabla: `cuenta_usuario`

Credenciales de acceso a la aplicación. Solo existe si la persona posee una cuenta permanente.

| Campo | Tipo de Dato | Nulidad | Llave | Descripción | Nivel |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | BIGSERIAL | NOT NULL | PK | Identificador único de la cuenta | CONFIRMADO |
| `persona_id` | BIGINT | NOT NULL | FK (`personas.id`) | Persona propietaria de la cuenta | CONFIRMADO |
| `username` | VARCHAR(50) | NOT NULL | UNIQUE | Nombre de usuario para autenticación | CONFIRMADO |
| `email_login` | VARCHAR(150) | NOT NULL | UNIQUE | Correo usado como identificador de acceso | CONFIRMADO |
| `password_hash` | VARCHAR(255) | NOT NULL | - | Hash seguro de la contraseña (ej. bcrypt) | CONFIRMADO |
| `estado` | BOOLEAN | NOT NULL | DEFAULT true | Estado activo/inactivo de la cuenta | CONFIRMADO |
| `intentos_fallidos` | SMALLINT | NOT NULL | DEFAULT 0 | Contador de intentos de acceso fallidos | PROPUESTO |
| `bloqueado_hasta` | TIMESTAMPTZ | NULL | - | Fecha hasta la cual la cuenta queda bloqueada | PROPUESTO |
| `ultimo_acceso` | TIMESTAMPTZ | NULL | - | Fecha y hora del último acceso exitoso | PROPUESTO |
| `created_at` | TIMESTAMPTZ | NOT NULL | DEFAULT now() | Fecha de creación de la cuenta | CONFIRMADO |
| `updated_at` | TIMESTAMPTZ | NOT NULL | DEFAULT now() | Fecha de última actualización | CONFIRMADO |

> **Seguridad (CONFIRMADO):** nunca se almacena la contraseña en texto plano; solo `password_hash`.

---

## Tabla: `perfil_usuario`

Vínculo institucional de una persona dentro del SIGD. Determina su tipo (interno / externo) y su condición de registro.

| Campo | Tipo de Dato | Nulidad | Llave | Descripción | Nivel |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | BIGSERIAL | NOT NULL | PK | Identificador único del perfil | CONFIRMADO |
| `persona_id` | BIGINT | NOT NULL | FK (`personas.id`) | Persona vinculada | CONFIRMADO |
| `cuenta_usuario_id` | BIGINT | NULL | FK (`cuenta_usuario.id`) | Cuenta asociada; NULL si el externo no tiene cuenta | CONFIRMADO |
| `tipo_usuario` | VARCHAR(20) | NOT NULL | CHECK | `INTERNO` \| `EXTERNO` | PROPUESTO |
| `condicion_registro` | VARCHAR(20) | NOT NULL | CHECK | `CON_CUENTA` \| `SIN_CUENTA` | PROPUESTO |
| `area_id` | BIGINT | NULL | FK conceptual (OrganiCore `areas.id`) | Área de adscripción (solo interno) | PROPUESTO |
| `cargo_id` | BIGINT | NULL | FK conceptual (OrganiCore `cargos.id`) | Cargo ejercido (solo interno) | PROPUESTO |
| `rol_id` | BIGINT | NULL | FK conceptual (OrganiCore `roles.id`) | Rol operativo asignado | PROPUESTO |
| `fecha_vigencia_inicio` | DATE | NULL | - | Inicio de la vigencia del vínculo | PROPUESTO |
| `fecha_vigencia_fin` | DATE | NULL | - | Fin de la vigencia (NULL si es vigente) | PROPUESTO |
| `estado` | BOOLEAN | NOT NULL | DEFAULT true | Estado activo/inactivo del perfil | CONFIRMADO |

> Las FK de `area_id`, `cargo_id` y `rol_id` son **referencias conceptuales** al módulo OrganiCore (Grupo 3); sus nombres o tipos finales dependen del diseño definitivo de ese grupo y **no** se duplican tablas aquí.

---

## Tabla: `persona_documento_historial`

Historial de documentos asociados a cada persona (cambio o corrección de identidad).

| Campo | Tipo de Dato | Nulidad | Llave | Descripción | Nivel |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | BIGSERIAL | NOT NULL | PK | Identificador único del registro histórico | CONFIRMADO |
| `persona_id` | BIGINT | NOT NULL | FK (`personas.id`) | Persona al que pertenece el registro | CONFIRMADO |
| `tipo_documento_id` | BIGINT | NOT NULL | FK (`tipos_documento.id`) | Tipo de documento anterior | CONFIRMADO |
| `numero_documento_anterior` | VARCHAR(20) | NOT NULL | - | Documento anterior registrado | CONFIRMADO |
| `fecha_registro` | TIMESTAMPTZ | NOT NULL | - | Fecha en que se registró el cambio | CONFIRMADO |
| `motivo` | TEXT | NULL | - | Motivo del cambio o corrección | PROPUESTO |

---

## Tabla: `auditoria_usuarios`

Trazabilidad de las operaciones sobre personas, cuentas y perfiles.

| Campo | Tipo de Dato | Nulidad | Llave | Descripción | Nivel |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | BIGSERIAL | NOT NULL | PK | Identificador único del registro de auditoría | CONFIRMADO |
| `usuario_accion_id` | BIGINT | NULL | FK referencia usuario | Usuario (cuenta) que realizó la acción | PROPUESTO |
| `entidad_afectada` | VARCHAR(40) | NOT NULL | - | `PERSONA` \| `CUENTA` \| `PERFIL` | CONFIRMADO |
| `entidad_id` | BIGINT | NOT NULL | - | Identificador interno de la entidad afectada | CONFIRMADO |
| `accion` | VARCHAR(30) | NOT NULL | - | Acción realizada (`CREAR`, `ACTUALIZAR`, `ACTIVAR`, `DESACTIVAR`) | PROPUESTO |
| `detalle` | JSONB | NULL | - | Detalle estructurado del cambio | PROPUESTO |
| `fecha` | TIMESTAMPTZ | NOT NULL | DEFAULT now() | Fecha y hora del registro | CONFIRMADO |

---

## Leyenda de Niveles

| Nivel | Significado |
| :--- | :--- |
| CONFIRMADO | Información verificada o propia de la estructura técnica mínima. |
| PROPUESTO | Mejora técnica planteada por el grupo con justificación; requiere validación. |
| PENDIENTE | Dato o política que debe confirmarse con la institución o el profesor. |
| EJEMPLO | Solo demostrativo, sin valor oficial. |

> Este diccionario es **preliminar** y se ajustará cuando se confirme la información oficial sobre tipos de documento, obligatoriedad de campos, políticas de registro externo y diseño definitivo de las tablas de OrganiCore.
