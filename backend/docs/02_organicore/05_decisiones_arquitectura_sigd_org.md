# Decisiones Definitivas y Arquitectura — OrganiCore (`sigd_org`)

## 1. Decisiones Arquitectónicas Definitivas (Fase 2)

### Unificación de Identificadores Criptográficos (UUID)
* **Decisión:** Se migran todas las PKs/FKs de `BIGSERIAL`/`BIGINT` a `UUID` (`gen_random_uuid()`).
* **Justificación:** Cumplimiento del estándar transversal del SIGD para evitar la exposición de secuencias numéricas e integrar adecuadamente la arquitectura con el esquema `sigd_auth`.

### Optimización Jerárquica con Materialized Path
* **Decisión:** Se añade la columna `path TEXT` con índice B-Tree/Pattern a la tabla `sigd_org.area`.
* **Justificación:** Elimina las consultas recursivas lentas en PostgreSQL (`WITH RECURSIVE`). La búsqueda de subáreas para validaciones de alcance (`SUBAREAS`) se efectúa en tiempo constante $O(1)$ (`WHERE path LIKE 'root.area1.%'`).

### Desacoplamiento de Cuentas de Usuario (`sigd_auth`)
* **Decisión:** Se retira la tabla `users` de este módulo.
* **Justificación:** La gestión de usuarios y credenciales pertenece exclusivamente al subdominio IdentiCore (`sigd_auth`). OrganiCore únicamente consume la FK `cuenta_id`.

### Soporte de Múltiples Roles y Encargaturas Legales
* **Decisión:** Se elimina la FK `rol_id` de la cuenta de usuario y se implementan las tablas pivote `usuario_rol` y `encargatura_despacho`.
* **Justificación:** Permite que un usuario tenga múltiples roles operativos o asuma temporalmente la dirección de otra área mediante resolución oficial sin romper la trazabilidad histórica.