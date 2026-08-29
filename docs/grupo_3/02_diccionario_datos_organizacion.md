# Diccionario de Datos - Módulo de Organización y Permisos

## Tabla: `areas`
Guarda las unidades organizacionales del sistema de forma jerárquica mediante un modelo autorreferenciado[cite: 1, 2].

| Campo | Tipo | Llave | Nulo | Restricciones | Descripción |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | BIGSERIAL | PK | NO | | Identificador único del área |
| `nombre` | VARCHAR(150) | | NO | | Nombre oficial de la oficina o unidad[cite: 1] |
| `sigla` | VARCHAR(20) | | NO | UNIQUE | Sigla representativa (ej. OTD, LOG)[cite: 1] |
| `parent_id` | BIGINT | FK | SI | Ref: `areas(id)` | Área superior jerárquica[cite: 1] |
| `estado` | BOOLEAN | | NO | DEFAULT true | Estado activo/inactivo[cite: 1] |

---

## Tabla: `cargos`
Puestos nominales y funciones laborales según el CAP/PAP institucional[cite: 1, 2].

| Campo | Tipo | Llave | Nulo | Restricciones | Descripción |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | BIGSERIAL | PK | NO | | Identificador del cargo[cite: 1] |
| `nombre` | VARCHAR(100) | | NO | UNIQUE | Denominación del puesto laboral[cite: 1] |
| `estado` | BOOLEAN | | NO | DEFAULT true | Estado del cargo[cite: 1] |

---

## Tabla: `responsables`
Asignación e historial de encargados, jefes y responsables por área con vigencia de fechas[cite: 1, 2].

| Campo | Tipo | Llave | Nulo | Restricciones | Descripción |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | BIGSERIAL | PK | NO | | Identificador del registro[cite: 1] |
| `area_id` | BIGINT | FK | NO | Ref: `areas(id)` | Área asignada[cite: 1] |
| `usuario_id` | BIGINT | FK | NO | Ref: `users(id)` | Usuario designado[cite: 1] |
| `cargo_id` | BIGINT | FK | NO | Ref: `cargos(id)` | Cargo ejercido durante el periodo[cite: 1] |
| `fecha_inicio` | DATE | | NO | | Fecha de toma de cargo[cite: 1] |
| `fecha_fin` | DATE | | SI | | Fecha de término (NULL si sigue vigente)[cite: 1] |
| `es_titular` | BOOLEAN | | NO | DEFAULT true | Indica si es titular o encargado interino[cite: 1] |

---

## Tabla: `roles`
Perfiles de seguridad dentro del sistema (RBAC)[cite: 1, 2].

| Campo | Tipo | Llave | Nulo | Restricciones | Descripción |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | BIGSERIAL | PK | NO | | Identificador del rol[cite: 1] |
| `codigo` | VARCHAR(50) | | NO | UNIQUE | Código del rol (ej. `ROLE_ADMIN`, `ROLE_OPERADOR`)[cite: 1, 2, 3] |
| `nombre` | VARCHAR(100) | | NO | | Nombre descriptivo del rol[cite: 1] |

---

## Tabla: `permisos`
Acciones atómicas operativas asignables a los roles[cite: 1, 2].

| Campo | Tipo | Llave | Nulo | Restricciones | Descripción |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | BIGSERIAL | PK | NO | | Identificador del permiso[cite: 1] |
| `codigo` | VARCHAR(100) | | NO | UNIQUE | Identificador atómico (ej. `documento:firmar`, `expediente:aprobar`)[cite: 1, 2] |
| `descripcion` | TEXT | | SI | | Explicación funcional del permiso[cite: 1] |

---

## Tabla: `roles_permisos`
Tabla intermedia para la matriz de permisos por rol (Relación N:M)[cite: 1, 2, 3].

| Campo | Tipo | Llave | Nulo | Restricciones | Descripción |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `rol_id` | BIGINT | PK, FK | NO | Ref: `roles(id)` | Rol asociado[cite: 1] |
| `permiso_id` | BIGINT | PK, FK | NO | Ref: `permisos(id)` | Permiso asignado[cite: 1] |