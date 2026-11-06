# Correcciones de revisión del PR #166

## Objetivo

Actualizar `fix/leonardo-organicore-admin` sobre `F_BARTRA` sin modificar directamente
la rama base, conservando JWT/RBAC y evitando cambios funcionales en RutaDoc y Reportes.

## Implementación

1. Restaurar `06_sigd_rut.sql`, su copia documental y `07_sigd_reportes.sql` desde
   `F_BARTRA`. Conservar en `02_sigd_auth.sql` únicamente la corrección referencial
   de la semilla de notificación y cubrirla con prueba.
2. Añadir una migración incremental para `intentos_fallidos` y `bloqueado_hasta`.
3. Hacer que login, refresh y perfil trabajen con todos los roles activos y rechacen
   cuentas inactivas o bloqueadas.
4. Implementar alta transaccional de usuarios y edición no destructiva de roles mediante
   `rolesAgregar` y `rolesQuitar`; mantener campos singulares de lectura por compatibilidad.
5. Incorporar bloqueo/desbloqueo, revocando sesiones al bloquear o desactivar.
6. Adaptar la interfaz existente a múltiples roles y al estado `Bloqueado`, sin rediseñarla.
7. Externalizar credenciales de PostgreSQL, MinIO/S3 y JWT en Docker y archivos de ejemplo.
8. Verificar unitarias, integración con PostgreSQL, TypeScript, builds y servicios Docker.

## Criterios de aceptación

- Editar datos generales no elimina roles.
- Agregar o retirar un rol solo afecta el rol indicado.
- JWT contiene todos los roles vigentes y RBAC utiliza ese arreglo.
- Una cuenta bloqueada no inicia ni renueva sesión; desbloquearla restaura el acceso.
- Alta, edición, estado, organigrama, calendario y tablas maestras persisten tras recarga.
- RutaDoc, Reportes y almacenamiento conservan sus contratos de `F_BARTRA`.
- No existen credenciales reales ni valores secretos fijos en archivos versionados.

## Evidencia de verificación

- Backend unitario: 512 aprobadas, 9 omitidas.
- Frontend unitario: 417 aprobadas.
- PostgreSQL 18 real (Testcontainers): 8 aprobadas, incluyendo alta multirrol,
  retiro selectivo, bloqueo/desbloqueo, organigrama, calendario y tablas maestras.
- Build TypeScript backend y build TypeScript/Vite frontend: correctos.
- `06_sigd_rut.sql`, su copia documental y `07_sigd_reportes.sql`: restaurados
  exactamente desde `origin/F_BARTRA`.

## Hallazgo ajeno conservado

La ejecución completa de las migraciones de `F_BARTRA` se detiene en
`06_sigd_rut.sql` con SQLSTATE `42703`: consulta `e.id_expediente`, mientras
`05_sigd_tra.sql` publica `expediente_id`. Conforme a la revisión, este PR no
modifica RutaDoc ni Reportes. La suite de integración de OrganiCore excluye
únicamente `06` y `07` y ejecuta las migraciones canónicas `01`–`05` y `08`.
