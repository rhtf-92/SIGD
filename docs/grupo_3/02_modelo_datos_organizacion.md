# Justificación del Modelo de Datos - Módulo de Organización y Permisos

## 1. Arquitectura General
El modelo de datos para el módulo de Organización, Roles y Permisos se diseñó para PostgreSQL 18.6 con el objetivo de representar la estructura institucional de forma flexible y mantener un control de acceso basado en roles (RBAC).

## 2. Decisiones de Diseño

### 2.1 Jerarquía Orgánica (Tabla `areas`)
Para representar el organigrama sin importar cuántos niveles jerárquicos existan (Gerencias, Subgerencias, Oficinas, Áreas), se implementó un modelo **autorreferenciado**:
* La columna `parent_id` apunta a la clave primaria `id` de la misma tabla `areas`.
* Un valor `NULL` en `parent_id` representa una unidad de máxima jerarquía.
* Esta estructura evita la creación de tablas adicionales por cada nivel organizacional y facilita consultas recursivas mediante CTEs (`WITH RECURSIVE`).

### 2.2 Desacoplamiento entre Cargo y Rol
Se mantuvieron separadas las entidades **Cargo** (puesto laboral administrativo) y **Rol** (perfil de acceso en el sistema):
* **`cargos`**: Representa la función nominal dentro de la institución (ej. *Especialista en Archivo*, *Director General*).
* **`roles`**: Agrupa permisos operativos del software (ej. *Operador de Trámite*, *Administrador de Sistema*).
* *Motivo*: Una persona puede tener un cargo administrativo alto pero requerir permisos operativos específicos en el sistema, o un rol temporal por suplencia sin cambiar su contrato/cargo oficial.

### 2.3 Historial de Responsabilidades (Tabla `responsables`)
Para no perder la trazabilidad de los documentos firmados o aprobados en el tiempo:
* No se asigna el jefe de área directamente como un atributo estático en la tabla `areas`.
* Se creó la tabla de unión `responsables` con campos de vigencia (`fecha_inicio` y `fecha_fin`).
* Cuando una persona deja de ser jefe de área, se actualiza su `fecha_fin` y se inserta un nuevo registro para el reemplazo. Esto preserva el historial de autorías para auditorías.

### 2.4 Control de Acceso Granular (Tablas `roles`, `permisos`, `roles_permisos`)
* Se define una matriz de permisos atómicos (ej. `tramite:crear`, `expediente:aprobar`).
* La relación N:M entre roles y permisos permite ajustar perfiles sin alterar la estructura del código base.