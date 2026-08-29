# Decisiones y Preguntas Pendientes - Módulo de Organización y Permisos

## 1. Aspectos Consolidados en el Modelo
* **Estructura Orgánica:** Se utiliza una jerarquía dinámica autorreferenciada mediante `parent_id`[cite: 1, 2].
* **Trazabilidad de Jefaturas:** La asignación de responsables preserva el historial mediante campos de vigencia (`fecha_inicio` y `fecha_fin`)[cite: 1, 2].
* **Modelo RBAC:** El control de acceso está granularizado mediante la relación entre `roles`, `permisos` y `roles_permisos`[cite: 1, 2].

## 2. Puntos en Consulta / Validación
* **[EN VALIDACIÓN]** Confirmar si un usuario podrá estar asignado como responsable en más de una área de manera simultánea durante un mismo periodo[cite: 3].
* **[EN VALIDACIÓN]** Determinar si la asignación de roles es estrictamente global o si requerirá contexto por área de adscripción[cite: 3].
* **[PROPUESTO]** La finalización de vigencia en `responsables.fecha_fin` será gestionada automáticamente mediante procedimientos almacenados / triggers al registrar un nuevo titular[cite: 1, 3].