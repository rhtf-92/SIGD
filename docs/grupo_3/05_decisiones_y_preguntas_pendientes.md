# Decisiones y Preguntas Pendientes - Módulo de Organización

## 1. Preguntas Pendientes de Validación con el Docente / Cliente
* **[PENDIENTE]** ¿Se requerirá que un usuario pueda pertenecer a múltiples áreas simultáneamente de forma activa o únicamente a una sola área principal?
* **[PENDIENTE]** ¿Se contempla la existencia de sub-roles específicos por área o los roles (`ROLE_ADMIN`, `ROLE_OPERADOR`) se aplican de manera global a nivel de todo el sistema?
* **[PENDIENTE]** ¿Existe un límite máximo de niveles jerárquicos permitidos en la tabla `areas` o el árbol mediante `parent_id` será ilimitado?

## 2. Supuestos Adoptados en el Diseño (Propuestos)
* **[PROPUESTO]** Se asume que cuando un usuario deja un cargo de jefe, la fecha de fin (`fecha_fin`) se registra manualmente o mediante un trigger al asignar a su sucesor.
* **[PROPUESTO]** Los permisos atómicos se gestionan a nivel de Backend mediante middleware de autorización verificando la relación `roles_permisos`.