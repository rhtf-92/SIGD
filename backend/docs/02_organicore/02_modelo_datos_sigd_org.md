# Modelo de Datos Relacional Refactorizado - OrganiCore (`sigd_org`)

## 1. Descripción del Modelo
El módulo OrganiCore administra la estructura organizacional jerárquica del IESTP "Suiza", las asignaciones de usuarios, las encargaturas legales de despacho y la matriz de permisos basada en roles y atributos (RBAC/ABAC).

## 2. Definición de Entidades Refactorizadas

### `sigd_org.area`
Unidades orgánicas con soporte para consultas jerárquicas en tiempo constante mediante materialized path `ltree`.
* `id_area` (PK, UUID, DEFAULT gen_random_uuid())
* `nombre` (VARCHAR 150, NOT NULL)
* `sigla` (VARCHAR 20, NOT NULL, UNIQUE)
* `parent_id` (FK, UUID, Nullable) $\rightarrow$ `sigd_org.area.id_area`
* `path` (LTREE, NOT NULL)
* `nivel_organizacional` (INT, NOT NULL)
* `activo` (BOOLEAN, DEFAULT true)
* `creado_en`, `actualizado_en` (TIMESTAMPTZ)

### `sigd_org.cargo`
Funciones administrativas permanentes de la institución.
* `cargo_id` (PK, UUID, DEFAULT gen_random_uuid())
* `nombre` (VARCHAR 100, NOT NULL, UNIQUE)
* `descripcion` (TEXT)
* `activo` (BOOLEAN, DEFAULT true)

### `sigd_org.asignacion_personal`
Relación entre cuentas de usuario (`sigd_auth`), áreas y cargos con control de vigencia temporada.
* `asignacion_id` (PK, UUID)
* `cuenta_id` (FK, UUID) $\rightarrow$ `sigd_auth.cuenta_usuario`
* `id_area` (FK, UUID) $\rightarrow$ `sigd_org.area.id_area`
* `cargo_id` (FK, UUID) $\rightarrow$ `sigd_org.cargo.cargo_id`
* `es_titular` (BOOLEAN, DEFAULT true)
* `vigencia` (TSTZRANGE, NOT NULL)
* `activo` (BOOLEAN, DEFAULT true)

### `sigd_org.encargatura_despacho`
Sustento de suplencias y responsabilidades interinas mediante resoluciones oficiales.
* `encargatura_id` (PK, UUID)
* `id_area` (FK, UUID) $\rightarrow$ `sigd_org.area.id_area`
* `cargo_id` (FK, UUID) $\rightarrow$ `sigd_org.cargo.cargo_id`
* `facultad_despacho_id` (FK, UUID) $\rightarrow$ `sigd_org.facultad_despacho.facultad_id`
* `usuario_titular_id` (UUID, NOT NULL)
* `usuario_suplente_id` (UUID, NOT NULL)
* `tipo_delegacion` (VARCHAR 40, NOT NULL)
* `resolucion_ref` (VARCHAR 120, NOT NULL)
* `periodo_vigencia` (TSTZRANGE, NOT NULL)
* `activo` (BOOLEAN, DEFAULT true)

### `sigd_org.rol_sistema` & `sigd_org.permiso_sistema`
Control RBAC/ABAC desacoplado.
* `rol_id` (PK, UUID), `codigo` (VARCHAR 50, UNIQUE)
* `permiso_id` (PK, UUID), `codigo` (VARCHAR 80, UNIQUE), `alcance_predeterminado` ('AREA', 'SUBAREAS', 'GLOBAL')

## 3. Relaciones del Modelo
* **`area` $\rightarrow$ `area` (1:N):** Estructura jerárquica con `parent_id` y `path` materialized `ltree`.
* **`asignacion_personal` (N:M):** Conecta `sigd_auth.cuenta_usuario` con `sigd_org.area` y `sigd_org.cargo`.
* **`encargatura_despacho` (N:M):** Asigna facultades de despacho legal con soporte documental.
* **`usuario_rol` & `rol_permiso` (N:M):** Permite flexibilidad total para otorgar múltiples roles por usuario.