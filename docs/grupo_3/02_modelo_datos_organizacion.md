# Modelo de Datos Relacional - Módulo de Organización y Permisos

## 1. Descripción del Modelo
El módulo de Organización y Permisos gestiona la estructura jerárquica de la entidad (áreas), los cargos administrativos, la autenticación de usuarios y la asignación de accesos granular mediante un modelo RBAC (Role-Based Access Control).

## 2. Definición de Entidades

### `areas`
Almacena las unidades orgánicas de la entidad. Permite jerarquía autorreferenciada (`parent_id`).
* `id` (PK, BIGSERIAL)
* `nombre` (VARCHAR 150, NOT NULL)
* `sigla` (VARCHAR 20, NOT NULL, UNIQUE)
* `parent_id` (FK, BIGINT, Nullable) $\rightarrow$ `areas.id`
* `estado` (BOOLEAN, DEFAULT true)

### `cargos`
Catálogo de funciones operativas o administrativas.
* `id` (PK, BIGSERIAL)
* `nombre` (VARCHAR 100, NOT NULL, UNIQUE)
* `estado` (BOOLEAN, DEFAULT true)

### `roles`
Perfiles de acceso dentro del sistema.
* `id` (PK, BIGSERIAL)
* `codigo` (VARCHAR 50, NOT NULL, UNIQUE)
* `nombre` (VARCHAR 100, NOT NULL)

### `permisos`
Acciones o recursos del sistema expuestos para autorización.
* `id` (PK, BIGSERIAL)
* `codigo` (VARCHAR 100, NOT NULL, UNIQUE)
* `descripcion` (TEXT)

### `users`
Cuentas de usuario registradas en la plataforma.
* `id` (PK, BIGSERIAL)
* `username` (VARCHAR 50, NOT NULL, UNIQUE)
* `email` (VARCHAR 100, NOT NULL, UNIQUE)
* `password_hash` (VARCHAR 255, NOT NULL)
* `rol_id` (FK, BIGINT, NOT NULL) $\rightarrow$ `roles.id`
* `estado` (BOOLEAN, DEFAULT true)

### `responsables`
Histórico de jefaturas y encargaturas de usuarios en las áreas.
* `id` (PK, BIGSERIAL)
* `area_id` (FK, BIGINT, NOT NULL) $\rightarrow$ `areas.id`
* `usuario_id` (FK, BIGINT, NOT NULL) $\rightarrow$ `users.id`
* `cargo_id` (FK, BIGINT, NOT NULL) $\rightarrow$ `cargos.id`
* `fecha_inicio` (DATE, NOT NULL)
* `fecha_fin` (DATE, Nullable)
* `es_titular` (BOOLEAN, DEFAULT true)

### `roles_permisos`
Tabla pivote para la relación N:M entre roles y permisos.
* `rol_id` (PK, FK, BIGINT, NOT NULL) $\rightarrow$ `roles.id`
* `permiso_id` (PK, FK, BIGINT, NOT NULL) $\rightarrow$ `permisos.id`

## 3. Relaciones del Modelo
* **`areas` $\rightarrow$ `areas` (1:N):** Una área padre puede contener múltiples subáreas (`parent_id`).
* **`roles` $\rightarrow$ `users` (1:N):** Cada usuario posee asignado un único rol operativo (`rol_id`).
* **`roles` $\leftrightarrow$ `permisos` (N:M):** Un rol agrupa múltiples permisos y un permiso puede estar asignado a varios roles (`roles_permisos`).
* **`responsables` (N:M):** Asocia `areas`, `users` y `cargos` preservando la trazabilidad histórica de vigencia (`fecha_inicio`, `fecha_fin`).