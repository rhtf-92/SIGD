# Auditoría SIGD — PR #167 y #198

**Fecha:** 2026-11-05
**Rama de trabajo:** `B_LEONARDO`
**Destino solicitado:** `F_BARTRA`
**Base auditada:** `e663492846f2004ab76dd7b07e74ca0b85d83c4f` (`origin/F_BARTRA`)

## Alcance y resultado

Se revisaron los flujos de autenticación, perfiles y permisos administrativos, rotación de sesión, Casilla electrónica, almacenamiento de documentos, SSE, redacción de URL sensibles y dependencias. Las correcciones y pruebas asociadas están en `B_LEONARDO`. No se hizo merge ni se modificaron directamente `F_BARTRA` o `main`.

| Componente | Resultado de la auditoría | Riesgo o límite |
|---|---|---|
| JWT, roles, sesiones y logout | Verificación de firma, perfil y sesión vigente; prueba de regresión de ruta administrativa tras logout | No se probó contra una instalación de producción |
| Refresh y PostgreSQL | Rotación concurrente transaccional probada en PostgreSQL temporal | La suite excluye migraciones de RutaDoc y Reportes |
| RBAC | Consulta de permisos vigentes en la base de datos | El despliegue debe aplicar la migración incremental 19 |
| Casilla y documentos | Propiedad comprobada antes de listar, leer y descargar; acuse concurrente idempotente | Faltan datos firmados para certificar CVD, firmantes y efectos legales |
| SSE | Destinatario explícito, replay filtrado y cierre por revocación | Falta una prueba integral RutaDoc → worker → SSE desplegado |
| Dependencias de producción | `npm audit --omit=dev --audit-level=high`: cero vulnerabilidades en ambos proyectos | Quedan avisos moderados en dependencias exclusivas de desarrollo |

## Hallazgos corregidos

1. **Sesiones y cuentas:** la API protegida, Casilla y SSE validan firma JWT, sesión vigente/no revocada, huella del token, cuenta habilitada y perfil vigente. El stream vuelve a validar la sesión cada 15 segundos y se cierra al revocarla.
2. **Autorización administrativa:** las rutas consultan permisos, rol y asignación vigentes en PostgreSQL en vez de confiar solo en roles del token. Se agregó la migración incremental `19_sigd_admin_rbac_permissions.sql`; no se reescribieron migraciones históricas.
3. **Refresh concurrente:** la rotación se hace bajo transacción y bloqueo de fila, con revocación e inserción de la nueva sesión en una misma transacción.
4. **Casilla y almacenamiento:** se retiró la identidad de respaldo por header/UUID fijo; lista, detalle, lectura, acuse y descarga se filtran por propietario. La descarga del acto sigue el endpoint de Casilla y el endpoint de almacenamiento hasta su URL firmada; el acuse se descarga como PDF generado por el servidor. El cliente ya no fabrica archivos de texto.
5. **SSE:** el bus y el replay filtran por destinatario y descartan eventos desconocidos o sin identidad de destinatario. RutaDoc resuelve al solicitante del expediente y adjunta su cuenta activa solo cuando existe exactamente una; no usa al actor como destinatario. Si la cuenta no es única, el evento se omite. Se habilitaron los eventos de radicación y subsanación en la lista permitida.
6. **Outbox Casilla:** una notificación requiere resolver una cuenta de destinatario; si no existe, el despacho falla para que el worker reintente en lugar de insertar una notificación huérfana.
7. **Errores:** las URL registradas no incluyen query strings, para evitar filtrar tokens de EventSource.
8. **Metadatos de Casilla:** se eliminaron DNI, dirección, firmantes, CVD, hash de documento, tamaño, expediente y plazo legal inventados cuando no existen datos persistidos. El identificador visible de notificación es el UUID real. La página activa obtiene el nombre y correo del perfil autenticado en vez de mostrar un titular fijo; ambas rutas de Casilla exigen sesión en el frontend. Se eliminaron afirmaciones de certificación y el plazo fijo de cinco días de la interfaz.
9. **Acuse concurrente:** `UPDATE ... RETURNING` devuelve el registro efectivamente persistido; una solicitud concurrente que pierde la carrera relee ese registro. El identificador usa el UUID completo y no un prefijo truncado. La prueba PostgreSQL compara ambas respuestas con la fila final.
10. **Filtros y contadores:** estado, tipo y fechas de la bandeja se aplican en SQL parametrizado. `NOTIFICADO` corresponde a acuse registrado; el contador ya no equipara toda notificación depositada con un acuse.
11. **Dependencias:** se actualizaron Zod y dependencias transitivas de producción para eliminar avisos altos. Se adaptaron cinco usos de Zod 3 a Zod 4 y se actualizó el toolchain frontend compatible.
12. **Lectura y contrato HTTP:** `PATCH /casilla/notificaciones/:id/lectura` devolvía un fragmento aunque el frontend lo trataba como una notificación completa y reemplazaba el estado del modal. Ahora retorna la fila completa mapeada, con los campos de compatibilidad anteriores, y no degrada una notificación con acuse a `LEIDO`.

## Verificaciones ejecutadas

| Verificación | Resultado |
|---|---|
| Backend `npm run test:unit` | 616 aprobadas, 9 omitidas; 54 archivos aprobados, 1 omitido |
| Backend `npm run typecheck` | Aprobado |
| Backend `npm run build` | Aprobado |
| Frontend `npm test` | 457 aprobadas |
| Frontend `npm run typecheck` y `npm run typecheck:m03` | Aprobados |
| Frontend `npm run build` | Aprobado; Rollup descartó comentarios `PURE` mal ubicados de Zod |
| Frontend `npm run lint` | Aprobado sin errores ni warnings; se corrigieron dependencias/hooks y el escape de nombre de hoja XLSX |
| `git diff --check` | Aprobado |
| Backend `npm run test:db` | Aprobado: 4 archivos, 10 pruebas; PostgreSQL efímero Testcontainers, migraciones incluidas, refresh concurrente y acuse concurrente real |
| Backend y frontend `npm audit --omit=dev --audit-level=high` | Cero vulnerabilidades de producción en ambos |
| Auditoría completa de dependencias | Backend: 7 moderadas en Testcontainers/archiver/glob/minimatch; frontend: 9 moderadas en ESLint/minimatch. Sin vulnerabilidades altas al último análisis |

La suite PostgreSQL excluye explícitamente `06_sigd_rut.sql`, `07_sigd_reportes.sql` y `11_sigd_mgd_contract.sql`: son contratos de RutaDoc/Reportes y la 11 depende de tablas de la 06. Por tanto, este resultado valida los módulos de OrganiCore/IdentiCore y la migración RBAC 19 en PostgreSQL real de prueba; no certifica todas las migraciones ni una instancia desplegada.

## Límites que requieren datos reales del entorno

La consulta de outbox prueba que el evento de expediente se dirige únicamente al solicitante cuando hay una sola cuenta activa vinculada. Las cuentas múltiples o inexistentes quedan sin destinatario y el bus las descarta, por diseño. La suite PostgreSQL existente valida esquema, RBAC y refresh; no contiene un flujo de integración RutaDoc→worker outbox→SSE con datos reales del entorno desplegado.

El endpoint de acuse genera un PDF desde los datos persistidos, pero la persistencia actual solo guarda identificador, fecha y hora del servidor y un hash calculado sobre identificador/fecha/constante. Ese hash no verifica el contenido del PDF ni es una firma digital. No se almacena CVD firmado, identidad completa del destinatario ni documento firmado de origen como evidencia verificable. La interfaz ya no inventa esos datos ni declara efectos legales. La validación jurídica y criptográfica de extremo a extremo requiere datos reales del emisor, firma y verificación independientes.

Los avisos moderados restantes están en herramientas de desarrollo, no en las dependencias de producción según `npm audit --omit=dev`. `npm audit fix` no pudo resolverlos de forma compatible: frontend falla con `Cannot read properties of null (reading 'edgesOut')` y backend propone una versión mayor anterior de Testcontainers. No se aplicó `--force`. El entorno local usa Node 22.17.0 y la CI configura Node 24.19.x; el frontend declara Node 24.19.x como requisito. Las suites locales sí terminaron correctamente en el entorno disponible.

## PR y ramas

- PR #167 sigue abierto, con head `fix/leonardo-organicore-admin`, distinto de la rama personal solicitada; GitHub reportó `mergeable=false` en la inspección del 2026-11-05. Su descripción histórica afirma que no hay conflictos, pero ese dato ya no coincide con el estado actual de GitHub.
- PR #198 sigue abierto en borrador, con head `fix/leonardo-casilla-seguridad`, también distinto de `B_LEONARDO`; GitHub reportó `mergeable=true` en esa inspección.
- PR #201 es la propuesta activa desde `B_LEONARDO` hacia `F_BARTRA`; permanece en borrador, sin conflictos según la inspección y con revisión solicitada a PieroBartraMontalvo-spec. Las verificaciones CI del commit previo pasaron; el commit de esta auditoría requiere su propia CI.
- GitHub no permite cambiar el head de un PR existente mediante actualización de metadatos. Para mantener la regla de trabajar solo en `B_LEONARDO`, no se deben reutilizar ni borrar los heads anteriores con trabajo.
- La sesión no creó ramas adicionales. El stash `codex-preserve-preexisting-local-changes-before-SIGD-audit` conserva cambios locales y archivos no rastreados que estaban antes de la auditoría. Se mantiene intacto.

## Recomendación para revisión

Revisar el diff de `B_LEONARDO` hacia `F_BARTRA`, verificar la CI del nuevo commit y coordinar la integración de destinatarios SSE con RutaDoc. La funcionalidad auditada pasa las suites indicadas, pero «100 %» de validez jurídica o de funcionamiento en producción no está demostrado sin firma/CVD reales y prueba del despliegue. No hacer merge hasta la revisión de Bartra.
