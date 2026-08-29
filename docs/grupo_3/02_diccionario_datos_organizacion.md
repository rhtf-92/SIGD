# Diccionario de Datos - Módulo de Organización y Permisos

## Tabla: `areas`
| Campo | Tipo de Dato | Nulidad | Llave | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `id` | BIGSERIAL | NOT NULL | PK | Identificador único del área |
| `nombre` | VARCHAR(150) | NOT NULL | - | Nombre completo del área u oficina |
| `sigla` | VARCHAR(20) | NOT NULL | UNIQUE | Abreviatura oficial del área |
| `parent_id` | BIGINT | NULL | FK (`areas.id`) | Identificador del área dependiente superior |
| `estado` | BOOLEAN | NOT NULL | DEFAULT true | Estado activo/inactivo |

---

## Tabla: `cargos`
| Campo | Tipo de Dato | Nulidad | Llave | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `id` | BIGSERIAL | NOT NULL | PK | Identificador único del cargo |
| `nombre` | VARCHAR(100) | NOT NULL | UNIQUE | Denominación del cargo |
| `estado` | BOOLEAN | NOT NULL | DEFAULT true | Estado activo/inactivo |

---

## Tabla: `roles`
| Campo | Tipo de Dato | Nulidad | Llave | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `id` | BIGSERIAL | NOT NULL | PK | Identificador único del rol |
| `codigo` | VARCHAR(50) | NOT NULL | UNIQUE | Código identificador (ej. `ROLE_ADMIN`) |
| `nombre` | VARCHAR(100) | NOT NULL | - | Nombre descriptivo del rol |

---

## Tabla: `permisos`
| Campo | Tipo de Dato | Nulidad | Llave | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `id` | BIGSERIAL | NOT NULL | PK | Identificador único del permiso |
| `codigo` | VARCHAR(100) | NOT NULL | UNIQUE | Clave de autorización (ej. `AREA_CREATE`) |
| `descripcion` | TEXT | NULL | - | Detalle de la función o recurso accesible |

---

## Tabla: `users`
| Campo | Tipo de Dato | Nulidad | Llave | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `id` | BIGSERIAL | NOT NULL | PK | Identificador único del usuario |
| `username` | VARCHAR(50) | NOT NULL | UNIQUE | Nombre de usuario para autenticación |
| `email` | VARCHAR(100) | NOT NULL | UNIQUE | Correo electrónico institucional |
| `password_hash` | VARCHAR(255) | NOT NULL | - | Hash seguro de la contraseña |
| `rol_id` | BIGINT | NOT NULL | FK (`roles.id`) | Rol asignado al usuario |
| `estado` | BOOLEAN | NOT NULL | DEFAULT true | Estado activo/inactivo de la cuenta |

---

## Tabla: `responsables`
| Campo | Tipo de Dato | Nulidad | Llave | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `id` | BIGSERIAL | NOT NULL | PK | Registro de asignación de jefatura |
| `area_id` | BIGINT | NOT NULL | FK (`areas.id`) | Área sobre la cual ejerce función |
| `usuario_id` | BIGINT | NOT NULL | FK (`users.id`) | Usuario designado como responsable |
| `cargo_id` | BIGINT | NOT NULL | FK (`cargos.id`) | Cargo ejercido durante el periodo |
| `fecha_inicio` | DATE | NOT NULL | - | Inicio del periodo de responsabilidad |
| `fecha_fin` | DATE | NULL | - | Fin del periodo (NULL si está vigente) |
| `es_titular` | BOOLEAN | NOT NULL | DEFAULT true | Indica si es responsable titular o encargado |

---

## Tabla: `roles_permisos`
| Campo | Tipo de Dato | Nulidad | Llave | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `rol_id` | BIGINT | NOT NULL | PK, FK (`roles.id`) | Identificador del rol asociado |
| `permiso_id` | BIGINT | NOT NULL | PK, FK (`permisos.id`) | Identificador del permiso otorgado | |