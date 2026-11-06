# Diseño: Administración SIGD

**Fecha:** 2026-11-03  
**Rama objetivo:** `F_BARTRA`  
**Fuente funcional:** `frontend/docs/02_administracion-seguridad-auditoria/00_plan_de_trabajo_y_evaluacion_docente.md`

## Intención

Completar la pestaña Administración y sus seis secciones para que una persona autorizada pueda gestionar cuentas, roles, auditoría, catálogos, calendario laboral y políticas de seguridad con persistencia real y controles de acceso coherentes.

## Objetivos

- El hub enlaza a Usuarios, Roles y Permisos, Auditoría, Tablas Maestras, Calendario Laboral y Seguridad, y permite regresar sin perder contexto.
- Usuarios: listar/buscar/filtrar, crear o editar campos permitidos y cambiar estados, persistiendo por API.
- Roles y permisos: mostrar los cinco roles canónicos (`SUPER_ADMIN`, `DIRECTOR`, `DOCENTE`, `MESA_PARTES`, `ESTUDIANTE`), editar permisos tipados y persistir cambios autorizados.
- Auditoría: consulta de solo lectura, filtros definidos por el contrato, detalle/diff cuando el servidor lo proporciona y exportación CSV UTF-8.
- Tablas maestras: consultar, crear/editar si el contrato del servidor lo permite, e inactivar en vez de borrar registros con historia; mostrar jerarquía institucional.
- Calendario: jornada con corte 16:30, días hábiles y feriados pertinentes, guardados y validados por el servidor.
- Seguridad: mostrar políticas y eventos/bloqueos reales; desbloqueo supervisado con justificación cuando exista endpoint autorizado.
- Proteger vistas y acciones con roles/permisos reales del sistema, con estados de carga, error, vacío y confirmación.

## Fuera de alcance

- Borrado físico de registros institucionales o edición de la bitácora de auditoría.
- Inventar persistencia local como si fuera dato compartido o seguridad de servidor.
- Reestructurar otros módulos de SIGD salvo una dependencia necesaria para auth/RBAC o navegación.

## Restricciones y criterios de aceptación

- Stack y patrones existentes: React 19, TypeScript y servicios/hooks actuales.
- Integrarse con los endpoints realmente registrados por `F_BARTRA` bajo `/api/v1/admin/...` y `/api/v1/admin/usuarios...`, verificando método, parámetros y payloads en routers/controladores. La guía M05 tiene rutas que difieren de la implementación vigente; usar la API que el backend sirve y documentar el mapeo.
- RBAC debe denegar por defecto; controles visuales no sustituyen autorización del servidor.
- Los cinco roles son canónicos; no introducir nombres alternativos.
- El horario de cierre/corte se presenta como 16:30. Los feriados regionales deben venir del catálogo/configuración aprobados del proyecto.
- Auditoría es de solo lectura; bajas de catálogos son lógicas.
- Mantener cambios existentes del usuario en `F_BARTRA` intactos.

## Enfoques considerados

1. Completar las seis pantallas e integrar con servicios/backend existentes, ampliando contratos faltantes de forma compatible. **Recomendado:** satisface los entregables y conserva el diseño del repositorio.
2. Hacer funcional solo el panel inicial: menor esfuerzo, pero deja intactas las secciones asignadas.
3. Simular operaciones con estado local: aparenta funcionar, pero pierde cambios y no cumple seguridad/persistencia.

## Decisión propuesta

Seguir el enfoque 1. Auditar contratos y guards actuales antes de cambiar cada sección; usar endpoints vigentes de `F_BARTRA` y documentar su diferencia frente a la guía M05. Ampliar el backend solo para operaciones asignadas que aún no tengan handler. Ninguna acción destructiva o privilegio se habilitará solo desde el frontend.

## Trabajo pendiente para implementación

Revisar cada pantalla, servicio, hook, ruta protegida, DTO, migración y handler de backend en `F_BARTRA`; verificar persistencia, autorización y respuestas de error. Crear un plan separado para Administración para permitir integración y revisión por módulo.

