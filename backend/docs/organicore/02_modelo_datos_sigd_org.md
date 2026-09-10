# Modelo de Datos Relacional Refactorizado - OrganiCore (`sigd_org`)

## 1. Descripción del Modelo
El módulo OrganiCore administra la estructura organizacional jerárquica del IESTP "Suiza", las asignaciones de usuarios, las encargaturas legales de despacho (TUO Ley N° 27444) y la matriz de permisos basada en roles y atributos (RBAC/ABAC).

## 2. Definición de Entidades Refactorizadas

### `sigd_org.area`
Unidades orgánicas con soporte para consultas jerárquicas en $O(1)$ mediante **Materialized Path**.
* `area_id` (PK, UUID, DEFAULT gen_random_uuid())
* `nombre` (VARCHAR 150, NOT NULL)
* `sigla` (VARCHAR 20, NOT NULL, UNIQUE)
* `parent_id` (FK, UUID, Nullable) $\rightarrow$ `sigd_org.area.area_id`
* `path` (TEXT, NOT NULL)
* `nivel_organizacional` (INT, NOT NULL)
* `activo` (BOOLEAN, DEFAULT true)
* `creado_en`, `actualizado_en` (TIMESTAMPTZ)

### `sigd_org.cargo`
Funciones administrativas permanentes de la institución.
* `cargo_id` (PK, UUID, DEFAULT gen_random_uuid())
* `nombre` (VARCHAR 100, NOT NULL, UNIQUE)
* `descripcion` (TEXT)
* `es_titular_despacho` (BOOLEAN, DEFAULT false)
* `activo` (BOOLEAN, DEFAULT true)

### `sigd_org.asignacion_area`
Relación entre cuentas de usuario (`sigd_auth`), áreas y cargos con control de vigencia.
* `asignacion_id` (PK, UUID)
* `cuenta_id` (FK, UUID) $\rightarrow$ `sigd_auth.cuenta_usuario`
* `area_id` (FK, UUID) $\rightarrow$ `sigd_org.area`
* `cargo_id` (FK, UUID) $\rightarrow$ `sigd_org.cargo`
* `fecha_inicio` (DATE, NOT NULL), `fecha_fin` (DATE, Nullable)
* `es_principal` (BOOLEAN, DEFAULT true)
* `activo` (BOOLEAN, DEFAULT true)

### `sigd_org.encargatura_despacho`
Sustento de suplencias y responsabilidades interinas mediante resoluciones oficiales (Ley N° 27444).
* `encargatura_id` (PK, UUID)
* `cuenta_id` (FK, UUID) $\rightarrow$ `sigd_auth.cuenta_usuario`
* `area_id` (FK, UUID) $\rightarrow$ `sigd_org.area`
* `cargo_id` (FK, UUID) $\rightarrow$ `sigd_org.cargo`
* `tipo_encargatura` (VARCHAR 30, NOT NULL) -- 'INTERINO', 'SUPLENTE', 'DELEGADO', 'ACCIDENTAL'
* `documento_sustento` (VARCHAR 120, NOT NULL)
* `fecha_inicio`, `fecha_fin` (TIMESTAMPTZ, NOT NULL)
* `activo` (BOOLEAN, DEFAULT true)

### `sigd_org.rol_sistema` & `sigd_org.permiso_sistema`
Control RBAC/ABAC desacoplado.
* `rol_id` (PK, UUID), `codigo` (VARCHAR 50, UNIQUE)
* `permiso_id` (PK, UUID), `codigo` (VARCHAR 80, UNIQUE), `alcance_predeterminado` ('AREA', 'SUBAREAS', 'GLOBAL')

## 3. Relaciones del Modelo
* **`area` $\rightarrow$ `area` (1:N):** Estructura jerárquica con `parent_id` y `path` Materialized Path.
* **`asignacion_area` (N:M):** Conecta `sigd_auth.cuenta_usuario` con `sigd_org.area` y `sigd_org.cargo`.
* **`encargatura_despacho` (N:M):** Asigna facultades de despacho legal con soporte documental.
* **`usuario_rol` & `rol_permiso` (N:M):** Permite flexibilidad total para otorgar múltiples roles por usuario.