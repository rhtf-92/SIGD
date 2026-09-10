# Decisiones del Modelo de Datos y Arquitectura de Organización

## 1. Decisiones Arquitectónicas Definitivas

### Manejo de Roles por Usuario (`users.rol_id` vs `usuarios_roles`)
* **Decisión Definitiva:** Se opta por una relación directa **1:N** entre `roles` y `users` usando la FK `users.rol_id`.
* **Justificación:** Se descarta la tabla `usuarios_roles` para el alcance actual del proyecto debido a que los usuarios del sistema tienen un perfil operativo principal único. Mantener `rol_id` en la tabla `users` optimiza las consultas de autenticación y autorización sin complejidad innecesaria de Joins adicionales.

### Desacoplamiento de `cargos` y `roles` (Sin `cargos.rol_id`)
* **Decisión Definitiva:** La tabla `cargos` no incluye el atributo `rol_id`.
* **Justificación:** Los cargos representan funciones en la estructura física/administrativa de la entidad (ej. "Jefe de Unidad"), mientras que los roles determinan permisos dentro de la aplicación de software. Vincular roles directamente a cargos limitaría la flexibilidad requerida para otorgar perfiles específicos a los usuarios.

### Consistencia e Historial de Responsables
* La tabla `responsables` mantiene la trazabilidad mediante `fecha_inicio` y `fecha_fin`.
* Las autorizaciones dentro de la aplicación se gestionan mediante el esquema RBAC compuesto por `roles`, `permisos` y `roles_permisos`.

## 2. Puntos en Consulta / Validación

* **[EN VALIDACIÓN]** Confirmar si un usuario podrá estar asignado como responsable en más de una área simultáneamente durante el mismo rango de fechas.
* **[EN VALIDACIÓN]** Evaluar si la comprobación de permisos requerirá contexto estricto por área de adscripción.
* **[PROPUESTO]** Procedimiento automatizado (Trigger / SP) para actualizar `fecha_fin` del responsable saliente al momento de registrar un nuevo titular en el área.