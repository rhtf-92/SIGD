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
4. **Casilla y almacenamiento:** se retiró la identidad de respaldo por header/UUID fijo; lista, detalle, lectura, acuse y descarga se filtran por propietario. La descarga del acto sigue el endpoint de Casilla y el endpoint de almacenamiento hasta su URL firmada; el acuse se descarga como PDF generado por el servidor. El cliente ya no fabrica archivos de texto.
5. **SSE:** el bus y el replay filtran por destinatario y descartan eventos desconocidos o sin identidad de destinatario. RutaDoc resuelve al solicitante del expediente y adjunta su cuenta activa solo cuando existe exactamente una; no usa al actor como destinatario. Si la cuenta no es única, el evento se omite. Se habilitaron los eventos de radicación y subsanación en la lista permitida.
6. **Outbox Casilla:** una notificación requiere resolver una cuenta de destinatario; si no existe, el despacho falla para que el worker reintente en lugar de insertar una notificación huérfana.
7. **Errores:** las URL registradas no incluyen query strings, para evitar filtrar tokens de EventSource.

## Verificaciones ejecutadas

| Verificación | Resultado |
|---|---|
| Backend `npm run test:unit` | 610 aprobadas, 9 omitidas; 54 archivos aprobados, 1 omitido |
| Backend `npm run typecheck` | Aprobado |
| Backend `npm run build` | Aprobado |
| Frontend `npm test` | 457 aprobadas |
| Frontend `npm run typecheck` y `npm run typecheck:m03` | Aprobados |
| Frontend `npm run build` | Aprobado; Rollup descartó comentarios `PURE` mal ubicados de Zod |
| Frontend `npm run lint` | Aprobado sin errores ni warnings; se corrigieron dependencias/hooks y el escape de nombre de hoja XLSX |
| `git diff --check` | Aprobado |
| Backend `npm run test:db` | Aprobado: 3 archivos, 9 pruebas; PostgreSQL efímero Testcontainers, migraciones incluidas y rotación concurrente real de refresh token |

La suite PostgreSQL excluye explícitamente `06_sigd_rut.sql`, `07_sigd_reportes.sql` y `11_sigd_mgd_contract.sql`: son contratos de RutaDoc/Reportes y la 11 depende de tablas de la 06. Por tanto, este resultado valida los módulos de OrganiCore/IdentiCore y la migración RBAC 19 en PostgreSQL real de prueba; no certifica todas las migraciones ni una instancia desplegada.

## Límites que requieren datos reales del entorno

La consulta de outbox prueba que el evento de expediente se dirige únicamente al solicitante cuando hay una sola cuenta activa vinculada. Las cuentas múltiples o inexistentes quedan sin destinatario y el bus las descarta, por diseño. La suite PostgreSQL existente valida esquema, RBAC y refresh; no contiene un flujo de integración RutaDoc→worker outbox→SSE con datos reales del entorno desplegado.

El endpoint de acuse genera un PDF real, pero la persistencia actual solo guarda identificador, sello de tiempo y hash del acuse. No almacena CVD firmado, identidad completa del destinatario ni documento firmado de origen como evidencia verificable. La interfaz debe tratar esos campos como metadatos del contrato; una validación jurídica/criptográfica de extremo a extremo necesita que el sistema emisor persista y firme esos datos.

## PR y ramas

- PR #167 sigue abierto, con head `fix/leonardo-organicore-admin`, distinto de la rama personal solicitada; GitHub reportó `mergeable=false` en la inspección del 2026-11-05.
- PR #198 sigue abierto en borrador, con head `fix/leonardo-casilla-seguridad`, también distinto de `B_LEONARDO`; GitHub reportó `mergeable=true` en esa inspección.
- GitHub no permite cambiar el head de un PR existente mediante actualización de metadatos. Para mantener la regla de trabajar solo en `B_LEONARDO`, cualquier propuesta revisable debe salir de esa rama hacia `F_BARTRA`; no se deben reutilizar ni borrar los heads anteriores con trabajo.
- La sesión no creó ramas adicionales. El stash `codex-preserve-preexisting-local-changes-before-SIGD-audit` conserva cambios locales y archivos no rastreados que estaban antes de la auditoría. Se mantiene intacto.

## Recomendación para revisión

Revisar el diff de `B_LEONARDO` hacia `F_BARTRA`, ejecutar las pruebas PostgreSQL en CI/ambiente aislado y coordinar la integración de destinatarios SSE con RutaDoc antes de declarar cerrados todos los flujos. No hacer merge hasta la revisión de Bartra.
