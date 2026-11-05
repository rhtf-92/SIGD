# Auditoría SIGD — PR #167 y #198

**Fecha:** 2026-11-05
**Rama de trabajo:** `B_LEONARDO`
**Destino solicitado:** `F_BARTRA`
**Base auditada:** `e663492846f2004ab76dd7b07e74ca0b85d83c4f` (`origin/F_BARTRA`)

## Alcance y resultado

Se revisaron los flujos de autenticación, perfiles y permisos administrativos, rotación de sesión, Casilla electrónica, almacenamiento de documentos, SSE y redacción de URL sensibles. Las correcciones y pruebas asociadas están preparadas en `B_LEONARDO`. No se hizo merge ni se modificaron directamente `F_BARTRA` o `main`.

## Hallazgos corregidos

1. **Sesiones y cuentas:** la API protegida, Casilla y SSE validan firma JWT, sesión vigente/no revocada, huella del token, cuenta habilitada y perfil vigente. El stream vuelve a validar la sesión cada 15 segundos y se cierra al revocarla.
2. **Autorización administrativa:** las rutas consultan permisos, rol y asignación vigentes en PostgreSQL en vez de confiar solo en roles del token. Se agregó la migración incremental `19_sigd_admin_rbac_permissions.sql`; no se reescribieron migraciones históricas.
3. **Refresh concurrente:** la rotación se hace bajo transacción y bloqueo de fila, con revocación e inserción de la nueva sesión en una misma transacción.
4. **Casilla y almacenamiento:** se retiró la identidad de respaldo por header/UUID fijo; lista, detalle, lectura, acuse y descarga se filtran por propietario. La descarga solo firma objetos almacenados en la fila del usuario autenticado.
5. **SSE:** el bus y el replay filtran por destinatario y descartan eventos desconocidos o sin identidad de destinatario. Se añadieron nombres de eventos RutaDoc reconocidos.
6. **Outbox Casilla:** una notificación requiere resolver una cuenta de destinatario; si no existe, el despacho falla para que el worker reintente en lugar de insertar una notificación huérfana.
7. **Errores:** las URL registradas no incluyen query strings, para evitar filtrar tokens de EventSource.

## Verificaciones ejecutadas

| Verificación | Resultado |
|---|---|
| Backend `npm run test:unit` | 607 aprobadas, 9 omitidas; 54 archivos aprobados, 1 omitido |
| Backend `npm run typecheck` | Aprobado |
| Backend `npm run build` | Aprobado |
| Frontend `npm test` | 454 aprobadas |
| Frontend `npm run typecheck` | Aprobado |
| Frontend `npm run build` | Aprobado; Rollup descartó comentarios `PURE` mal ubicados de Zod |
| Frontend `npm run lint` | No aprobado: 3 errores y 2 warnings preexistentes en `useAuditLogs.ts`, `useRbacConfig.ts`, `useSeguridadPolicies.ts` y `excelReportExporter.ts`; ninguno de esos archivos forma parte de esta corrección |
| `git diff --check` | Aprobado |
| Backend `npm run test:db` | No ejecutable: Testcontainers no encontró runtime Docker; `docker info` confirmó que Docker Desktop no está disponible y `127.0.0.1:5432` no tiene PostgreSQL escuchando |

Las pruebas de base de datos, migración aplicada y concurrencia real de refresh deben repetirse cuando haya un PostgreSQL de pruebas aislado disponible. Por ello, no se certifica aún compatibilidad operacional completa ni “100% funcional” en una instancia desplegada.

## Integración SSE pendiente

El bus ya reconoce `TramiteRegistrado`, `ExpedienteDerivado`, `ExpedienteAtendido`, `ExpedienteObservado` y `ExpedienteArchivado`, pero los productores RutaDoc revisados solo envían actor/área; no incluyen `destinatario_usuario_id`. Por diseño, esos eventos no se entregan a usuarios hasta que el módulo propietario defina y emita un destinatario autorizado. No se usa el actor como destinatario ni se infiere acceso a expedientes.

## PR y ramas

- PR #167 sigue abierto, con head `fix/leonardo-organicore-admin`, distinto de la rama personal solicitada; GitHub reportó `mergeable=false` en la inspección del 2026-11-05.
- PR #198 sigue abierto en borrador, con head `fix/leonardo-casilla-seguridad`, también distinto de `B_LEONARDO`; GitHub reportó `mergeable=true` en esa inspección.
- GitHub no permite cambiar el head de un PR existente mediante actualización de metadatos. Para mantener la regla de trabajar solo en `B_LEONARDO`, cualquier propuesta revisable debe salir de esa rama hacia `F_BARTRA`; no se deben reutilizar ni borrar los heads anteriores con trabajo.
- La sesión no creó ramas adicionales. El stash `codex-preserve-preexisting-local-changes-before-SIGD-audit` conserva cambios locales y archivos no rastreados que estaban antes de la auditoría. Se mantiene intacto.

## Recomendación para revisión

Revisar el diff de `B_LEONARDO` hacia `F_BARTRA`, ejecutar las pruebas PostgreSQL en CI/ambiente aislado y coordinar la integración de destinatarios SSE con RutaDoc antes de declarar cerrados todos los flujos. No hacer merge hasta la revisión de Bartra.
