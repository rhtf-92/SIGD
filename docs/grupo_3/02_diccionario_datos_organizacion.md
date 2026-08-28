# Diccionario de Datos - Módulo de Organización y Permisos

## Tabla: `areas`
Guarda las unidades organizacionales del sistema de forma jerárquica.

| Campo | Tipo | Llave | Nulo | Restricciones | Descripción |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | BIGSERIAL | PK | NO | | Identificador único del área |
| `nombre` | VARCHAR(150) | | NO | | Nombre oficial de la oficina o unidad |
| `sigla` | VARCHAR(20) | | NO | UNIQUE | Sigla representativa (ej. OTD, LOG) |
| `parent_id` | BIGINT | FK | SI | Ref: `areas(id)` | Área superior jerárquica |
| `estado` | BOOLEAN | | NO | DEFAULT true | Estado activo/inactivo |

---

## Tabla: `cargos`
Puestos nominales según el CAP/PAP institucional.

| Campo | Tipo | Llave | Nulo | Restricciones | Descripción |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | BIGSERIAL | PK | NO | | Identificador del cargo |
| `nombre` | VARCHAR(100) | | NO | UNIQUE | Denominación del puesto laboral |
| `estado` | BOOLEAN | | NO | DEFAULT true | Estado del cargo |

---

## Tabla: `responsables`
Asignación histórica de encargados o jefes por área.

| Campo | Tipo | Llave | Nulo | Restricciones | Descripción |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | BIGSERIAL | PK | NO | | Identificador del registro |
| `area_id` | BIGINT | FK | NO | Ref: `areas(id)` | Área asignada |
| `usuario_id` | BIGINT | FK | NO | Ref: `users(id)` | Usuario designado |
| `cargo_id` | BIGINT | FK | NO | Ref: `cargos(id)` | Cargo ejercido durante el periodo |
| `fecha_inicio` | DATE | | NO | | Fecha de toma de cargo |
| `fecha_fin` | DATE | | SI | | Fecha de término (NULL si sigue vigente) |
| `es_titular` | BOOLEAN | | NO | DEFAULT true | Indica si es titular o encargado interino |

---

## Tabla: `roles`
Perfiles de seguridad dentro de la aplicación.

| Campo | Tipo | Llave | Nulo | Restricciones | Descripción |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | BIGSERIAL | PK | NO | | Identificador del rol |
| `codigo` | VARCHAR(50) | | NO | UNIQUE | Código del rol (ej. `ROLE_ADMIN`) |
| `nombre` | VARCHAR(100) | | NO | | Nombre descriptivo del rol |

---

## Tabla: `permisos`
Acciones atómicas que se pueden realizar en el software.

| Campo | Tipo | Llave | Nulo | Restricciones | Descripción |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | BIGSERIAL | PK | NO | | Identificador del permiso |
| `codigo` | VARCHAR(100) | | NO | UNIQUE | Identificador atómico (ej. `documento:firmar`) |
| `descripcion` | TEXT | | SI | | Explicación funcional del permiso |

---

## Tabla: `roles_permisos`
Tabla intermedia para la asignación de permisos a roles (Relación N:M).

| Campo | Tipo | Llave | Nulo | Restricciones | Descripción |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `rol_id` | BIGINT | PK, FK | NO | Ref: `roles(id)` | Rol asociado |
| `permiso_id` | BIGINT | PK, FK | NO | Ref: `permisos(id)` | Permiso asignado |