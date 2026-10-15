# Impacto de revocación de sesiones y access JWT

**Alcance de esta revisión:** lectura del código en `fix/leonardo-organicore-admin` (HEAD `ea807738`) y prueba de integración OrganiCore. Este documento identifica el comportamiento actual y propone una evolución; no modifica la autenticación general ni los módulos de RutaDoc, Reportes, Firma, Casilla, Docker o CI.

## Comportamiento observado

`POST /api/v1/auth/logout` marca como revocada la fila de `sigd_auth.sesion_usuario` identificada por el refresh token. El access JWT es firmado por 15 minutos y `autenticarJwt` / `resolverIdentidad` verifican firma y expiración, pero no consultan la sesión. Por tanto, logout invalida el refresh token, no los access JWT que ya se emitieron.

| Rutas | Validación actual del access JWT | Después de logout | Después de bloquear la cuenta |
|---|---|---|---|
| `GET /api/v1/admin/**` y `/api/v1/usuarios/**` | JWT más estado habilitado/no bloqueado, rol vigente y permisos PostgreSQL en cada petición (`autorizarPermisos`) | Se acepta si cuenta, rol y permisos siguen vigentes | Se rechaza por la consulta de cuenta bloqueada |
| `GET /api/v1/auth/me`, `GET /api/v1/auth/perfil` | JWT más estado de cuenta y perfil activo consultados en PostgreSQL | Se acepta mientras cuenta y perfil sigan vigentes | Se rechaza |
| `POST /api/v1/auth/switch-role` | JWT más estado de cuenta y rol destino vigente; no verifica que la sesión del access JWT siga abierta | Puede emitir una sesión nueva usando un access JWT cuyo refresh ya fue revocado | Se rechaza por estado de cuenta |
| `GET /api/v1/realtime/stream` | `resolverIdentidad`: firma/expiración del JWT; no consulta sesión ni cuenta | Se acepta hasta expiración del JWT | Se acepta hasta expiración del JWT |
| `GET /api/v1/firma/pendientes` (también montado bajo `/api/v1/firmas/pendientes` y alias `/api/v1/firmas/cola-firmantes`) | JWT stateless y consulta de roles/facultades vigentes; esa consulta no verifica estado de cuenta ni sesión | Se acepta si el rol/facultad sigue vigente | Puede aceptarse si el rol/facultad sigue vigente |
| `GET /api/v1/reportes/dashboard/resumen`, `/dashboard/cuellos-botella`, `/dashboard/tendencias`, `/dashboard/kpis`, `/dashboard-ejecutivo`, `/tiempos-atencion` | `cuentaActual`: JWT más cuenta activa y perfil/rol vigente en PostgreSQL; no consulta sesión ni `bloqueado_hasta` | Se acepta mientras cuenta y rol estén vigentes | Se acepta si `activo` y el rol siguen vigentes; el bloqueo administrativo no cambia `activo` |
| `GET /api/v1/reportes/vistas-materializadas/refresh` | Mismo proveedor; además exige `SUPER_ADMIN` del perfil actual | Se acepta si el perfil vigente autoriza | Se acepta si el perfil vigente autoriza y la cuenta sigue `activo` |

Las rutas de Reportes se incluyen únicamente en este inventario de impacto; su código no se modifica en esta tarea.

### Hallazgo separado: Casilla

`backend/src/domains/identicore/casilla.router.ts` no instala autenticación común. `obtenerUsuarioId` usa el `sub` de un JWT válido, pero ante JWT ausente o inválido sustituye la identidad por un UUID predeterminado; además, `GET /api/v1/casilla/notificaciones/:id`, `PATCH /api/v1/casilla/notificaciones/:id/lectura`, `POST /api/v1/casilla/notificaciones/:id/acuse` y las dos rutas `.../descargar` no llaman a esa función. Por tanto, aceptan solicitudes sin JWT, con JWT revocado o bloqueado. Esto no es solo falta de revocación: varias rutas no exigen identidad ni vinculan la operación al dueño del recurso. No se modifica Casilla aquí por ser ajeno al módulo asignado; requiere revisión prioritaria de su responsable antes de exponer esos endpoints.

## Roles retirados y cuentas sin roles

El endpoint administrativo de actualización rechaza en transacción la operación que dejaría cero roles (`USUARIO_SIN_ROLES`, HTTP 422), de modo que no se confirma una cuenta administrada en ese estado. Si el último rol deja de estar vigente por un cambio externo o concurrente en PostgreSQL, login rechaza con `ACCOUNT_WITHOUT_ACTIVE_ROLES`, selección de perfil vuelve a consultar los perfiles y rechaza, refresh rechaza el rol que ya no está vigente y el guard administrativo deniega por falta de permiso actual. `cuentaActual` también revalida los perfiles de Reportes; Firma consulta roles/facultades actuales. Sin embargo, las rutas que solo validan la firma/expiración del JWT y Casilla (que no exige autenticación común) pueden seguir procesando el token hasta su expiración o incluso no exigirlo.

## Solución propuesta — requiere aprobación del responsable de autenticación

1. Vincular cada access JWT con `sigd_auth.sesion_usuario.id_sesion` mediante un claim `sid`. La tabla ya tiene identificador de sesión; el emisor debe crear/obtener la fila antes de firmar el access JWT.
2. Para operaciones protegidas, añadir una comprobación central que valide `sid`, `revocado_en IS NULL`, expiración y estado habilitado/no bloqueado de la cuenta. Logout, bloqueo/desactivación y cambio de perfil revocarían la sesión registrada; cambios de roles deberían revocar las sesiones afectadas dentro de la misma transacción.
3. Aplicar la comprobación de forma fail-closed a las rutas sensibles; incluir gradualmente las demás rutas autenticadas para no dejar módulos con semánticas distintas. Los endpoints SSE también deben validar `sid` al abrir conexión y definir cómo cortar una conexión ya establecida cuando se revoque.
4. Compatibilidad: los tokens actuales no contienen `sid`. Durante despliegue coordinado, decidir explícitamente si se rechazan de inmediato (cierre de sesiones y reautenticación) o se permite una ventana de transición no mayor al TTL actual de 15 minutos; después, exigir `sid` para toda ruta protegida. No aceptar indefinidamente tokens sin `sid`.

**Impactos y riesgos:** una consulta PostgreSQL adicional por petición autenticada aumenta latencia y carga; el middleware deberá usar el pool existente y fallar cerrado ante error de base de datos. SSE requiere tratamiento distinto por ser conexiones largas. Un despliegue parcial entre instancias antiguas y nuevas puede rechazar tokens o dejar una ventana de aceptación, por lo que requiere despliegue coordinado. La tabla de sesiones no requiere una migración para almacenar el vínculo si se reutiliza `id_sesion`; puede requerirse actualizar tipos/contratos del JWT, tests y emisión/rotación de sesiones.

Esta propuesta no se implementó en esta revisión: el responsable debe aprobar el alcance transversal y acordar la política de transición con los equipos dueños de rutas compartidas.
