# Propuesta técnica para revocación de access JWT — PR #167

**Estado:** propuesta para revisión de Bartra y responsables de módulos. No autoriza implementación ni merge.
**Base examinada:** HEAD `a6e9b55b` del [PR #167](https://github.com/rhtf-92/SIGD/pull/167), abierto contra `F_BARTRA` el 15 de octubre de 2026.

## Decisión propuesta

Usar `sigd_auth.sesion_usuario.id_sesion` como identificador `sid` de cada access JWT. Validar en PostgreSQL, en cada operación protegida, la sesión, la cuenta y el perfil activo mediante una función común. Reutilizar el resultado durante la misma petición y fusionar la consulta con las autorizaciones que ya leen PostgreSQL. No conservar resultados positivos entre peticiones: una caché con TTL permitiría usar un token revocado durante ese TTL.

Se consideraron dos alternativas: (a) lista de JWT revocados por `jti`, que duplica el estado de las sesiones y exige almacenar cada token hasta su expiración; (b) caché distribuida de sesiones, que reduce lecturas pero exige invalidación síncrona y una política de fallo compleja. `sid` más consulta canónica por petición reutiliza la tabla existente y ofrece un criterio verificable: una revocación confirmada en la base impide **la siguiente petición**. No puede cancelar retroactivamente una petición ya autorizada.

## 1. Vínculo entre token y sesión

- `login` con un solo rol y `select-role` crean primero la fila de sesión (`INSERT ... RETURNING id_sesion`) y solo después firman el access JWT con `sid`, `sub`, `rolActivo`, `roles: [rolActivo]`, `iat`, `exp`, `typ: access`. Si falla el INSERT no se entrega ningún token. Los JWT de selección de perfil no son access JWT y siguen sin `sid` hasta seleccionar un rol.
- `refresh` conserva su transacción y bloqueo de la fila anterior. Revoca la sesión anterior, inserta una nueva y firma el nuevo access JWT con el `id_sesion` nuevo antes del `COMMIT`; solo responde después de confirmar. Una transacción fallida no entrega tokens.
- `switch-role` exige access JWT con sesión vigente y el refresh token firmado de **esa misma** sesión. Bloquea esa fila, verifica `id_usuario` y que el refresh coincida, revoca la sesión anterior y crea una nueva con el rol destino en una transacción. El refresh deja de ser opcional tras la transición. Un JWT anterior no puede crear otra sesión después del cambio.
- El refresh JWT se sigue identificando mediante su valor registrado en `sesion_usuario`; el `sid` del access no se acepta como refresh ni como prueba suficiente para cambiar perfil. Conviene almacenar un hash del refresh en una evolución separada, porque hoy la tabla guarda el token completo; esa mejora no es requisito para esta revocación.

## 2. Validación y semántica de errores

Una función común verifica primero formato, firma, tipo, `exp` y `sid` UUID del JWT; después consulta por PK `s.id_sesion = $1` y exige `s.id_usuario = sub`, `s.revocado_en IS NULL`, `s.expira_en > now()`, `c.activo = TRUE` y `c.bloqueado_hasta IS NULL OR <= now()`. También exige que `rolActivo` sea un perfil vigente **actualmente** en `usuario_rol`/`rol_sistema`, usando la misma normalización de `roles-activos.ts`. Los permisos o facultades específicos se siguen comprobando en sus módulos y nunca se amplían desde `rolesAutorizados` del token.

Token inválido, sesión revocada/expirada o perfil retirado: `401` con código estable (`SESSION_INVALID` o `SESSION_REVOKED`), sin datos de recurso. Cuenta deshabilitada o bloqueada: conservar `ACCOUNT_DISABLED` (`403`) y `ACCOUNT_LOCKED` (`423`) para flujos de login, y acordar con frontend una respuesta de sesión no renovable para las rutas protegidas. Un fallo de PostgreSQL causa `503` sin ejecutar la operación, nunca una aceptación por omisión. El interceptor no debe intentar `refresh` para `SESSION_REVOKED`, `ACCOUNT_DISABLED` ni `ACCOUNT_LOCKED`; una expiración ordinaria del access sí puede intentar el refresh una vez.

`logout` debe recibir el refresh, verificar que corresponde al `sid` del bearer cuando exista, y revocar esa fila antes de responder. El frontend debe llamar al servidor con el refresh vigente y limpiar el estado local incluso si falla la red, mostrando que el cierre remoto no se pudo confirmar. Si no hay refresh local, solo puede limpiarse el dispositivo: no se puede prometer revocación remota. Bloqueo y desactivación administrativos ya revocan las sesiones en la misma transacción; los cambios que retiren un perfil deben revocar las sesiones afectadas. La comprobación del perfil en cada petición también deniega el rol retirado si fue modificado fuera del servicio administrativo.

## 3. Endpoints obligatorios

| Rutas | Integración requerida |
| --- | --- |
| `/api/v1/admin/**`, `/api/v1/usuarios/**` | Reemplazar `autenticarJwt` por el guard de sesión; conservar `autorizarPermisos` y el rol activo. |
| `/api/v1/auth/me`, `/api/v1/auth/perfil`, `/api/v1/auth/switch-role` | Usar la misma validación; en `switch-role`, bloquear y rotar la sesión anterior. |
| `/api/v1/realtime/stream` | Validar `sid` al conectar tanto con Bearer como con `?token=`; revalidar antes de replay y de entregar datos, filtrar eventos por destinatario y cerrar la conexión al revocar la sesión. |
| `/api/v1/firma/pendientes`, `/api/v1/firmas/pendientes`, `/api/v1/firmas/cola-firmantes` | Validar sesión/cuenta antes de `verificarFacultadFirma`; conservar el chequeo de facultad. |
| `/api/v1/reportes/dashboard/resumen`, `/dashboard/cuellos-botella`, `/dashboard/tendencias`, `/dashboard/kpis`, `/dashboard-ejecutivo`, `/tiempos-atencion`, `/vistas-materializadas/refresh` | Incorporar sesión y bloqueo de cuenta a `cuentaActual`; conservar autorización propia. Revisar además los endpoints de exportación que pasan por `resolverIdentidad`. |
| `/api/v1/casilla/**` | Integración coordinada y corrección de propiedad de recurso descrita abajo. |

Inventariar antes de implementar todos los demás consumidores de `verificarTokenAcceso`, `resolverIdentidad` y `cuentaActual`, incluidos alias y rutas con parámetros de consulta. No instalar un guard global sobre login, refresh, registro, salud, callbacks, descargas públicas legítimas o validadores: cada ruta debe clasificarse por contrato. Las rutas que acepten `?token=` deben evitar registrar el JWT en logs y URL de diagnóstico.

## 4. Usuarios multirrol y cambio de perfil

El access JWT autoriza únicamente `rolActivo`. `rolesAutorizados` sirve para interfaz y selección, pero no amplía permisos. Login multirrol sigue devolviendo `selectionToken`; `select-role` crea la primera sesión. Cada `switch-role` rota `sid` y refresh, por lo que el access anterior queda inválido. Dos cambios concurrentes desde el mismo `sid` producen como máximo una sesión sucesora, usando bloqueo de fila y condición de revocación. Un rol retirado no puede seguirse ejerciendo aunque aún figure en un JWT emitido. La retirada del último rol continúa impedida por el servicio administrativo y, si ocurre por otra vía, el guard deniega todas las rutas protegidas.

## 5. Coste de PostgreSQL

La firma, tipo, formato y expiración se comprueban sin E/S; solo los JWT criptográficamente válidos llegan a la base. La búsqueda usa la PK existente de `id_sesion` y un `EXISTS` indexable para el rol activo. La validación se ejecuta una vez por petición y se guarda en `req`, de modo que guards encadenados no repiten la consulta. En Admin, Reportes y otras rutas que ya consultan cuenta/permisos, se unifica la verificación en su consulta de autorización cuando sea posible. No se consulta la tabla completa ni se hace un lookup por refresh token en cada request.

No se propone caché positiva con TTL entre peticiones. Si la carga medida obliga a incorporarla, primero se debe diseñar invalidación transaccional compartida entre instancias y demostrar con pruebas que revocación y bloqueo no tienen ventana de aceptación. Se medirán consultas por request y latencia p95 antes/después. SSE no debe consultar periódicamente por cada heartbeat si no entrega datos; sí debe revalidar antes de cada replay o entrega sensible. Para cerrar streams inactivos se necesita una señal de revocación entre instancias o una comprobación periódica con límite de demora documentado. La afirmación de “revocación inmediata” se limita a **nuevas peticiones y nuevas entregas**, tras el commit; el cierre visual de un stream inactivo puede tener demora y debe medirse.

El bus SSE actual suscribe por canal y distribuye el mismo evento a todos los suscriptores de ese canal; `replayDesde` tampoco filtra por usuario. Por ello, validar `sid` no basta para proteger eventos de Casilla: antes de emitir o reproducir un evento se debe comprobar que su destinatario corresponde a la identidad autenticada, o que existe una facultad delegada explícita. La carga del evento y el buffer de replay deben incluir una identidad de destinatario verificable; eventos sin destinatario no se distribuyen a conexiones personales. Si el puente entre réplicas o PostgreSQL no permite comprobar sesión y destinatario, se suspende la entrega sensible hasta recuperar la validación.

## 6. Compatibilidad y despliegue

Las respuestas JSON de `login`, `select-role`, `switch-role` y `refresh` conservan sus campos; `sid` solo aparece dentro del JWT. El frontend mantiene su almacenamiento actual, pero `logout` invoca `/auth/logout`, `switch-role` envía obligatoriamente el refresh y el interceptor distingue sesión revocada de access expirado. El hook SSE debe reconstruir `EventSource` al rotar access en refresh/cambio de perfil, porque actualmente lee el token solo al montar el hook.

Despliegue coordinado: primero publicar el backend que emite y valida `sid` en todas las instancias y el frontend compatible. Los access JWT anteriores carecen de `sid`; permitirlos solo durante una ventana máxima de **15 minutos** desde el corte, con registro de uso y fecha de fin fija, o exigir reingreso inmediato si Bartra prefiere cierre estricto. Nunca permitir tokens sin `sid` indefinidamente. Los refresh existentes pueden seguir rotando a una sesión nueva con `sid` si su fila está vigente, la cuenta habilitada y el perfil activo; no deben servir para reactivar una sesión revocada. No activar validación estricta si quedan instancias que emiten JWT sin `sid`. Preparar rollback que detenga emisión nueva y documente la necesidad de reingreso, sin volver a aceptar sesiones revocadas.

## 7. Pruebas automatizadas y criterios de aceptación

1. Unitarias de JWT: `sid` válido/ausente/malformado, firma, tipo y expiración; `role_selection` no obtiene acceso.
2. Integración PostgreSQL real: login de rol único, selección multirrol, refresh atómico y dos refresh concurrentes; asociación `sid`-`sub`-refresh; fallo de INSERT/COMMIT sin token entregado.
3. Logout y administración: la siguiente petición con el access anterior falla tras logout, bloqueo, desactivación y revocación administrativa; al desbloquear no revive una sesión revocada; error de base falla cerrado.
4. Perfil: cambio rota sesión; access anterior no permite `switch-role` ni otra operación; dos cambios concurrentes dejan una sola sucesora; retiro de rol deniega acceso y refresh; `rolesAutorizados` no concede permisos del perfil inactivo.
5. Tabla de rutas: pruebas HTTP para Admin/Usuarios, Me, Reportes, Firma, SSE y alias con token vigente, expirado, revocado, cuenta bloqueada y sin `sid`; verificar tanto `401`/`403`/`423` como ausencia de efecto lateral.
6. SSE: conexión, replay y evento nuevo revalidan; logout corta nuevas entregas y reconexión; dos usuarios suscritos al mismo canal no reciben eventos ajenos; prueba multiinstancia del mecanismo de cierre si se incorpora. Frontend: logout remoto, fallo de red, refresh único y cola de reintentos, cambio de perfil y reconstrucción de EventSource.
7. Casilla: además de sesión, tests de aislamiento entre dos propietarios para bandeja, detalle, lectura, acuse y descargas; ninguna ruta devuelve ni modifica notificaciones ajenas o anónimas.

La aceptación requiere `git diff --check`, typecheck/build, suites Backend/Frontend y PostgreSQL real, más una medición de consultas y latencia en las rutas representativas. El alcance final del PR se decide después de revisar esta propuesta; no se fusiona #167 como parte de este documento.

## Coordinación específica: Casilla

`backend/src/domains/identicore/casilla.router.ts` está montado en `/api/v1` sin el guard común. La bandeja y estadísticas sustituyen un bearer ausente/inválido por `x-usuario-id` o un UUID predeterminado; sus SQL incluyen `usuario_id IS NULL` y una excepción para ese UUID. Detalle, lectura, acuse y ambas descargas ni siquiera llaman a `obtenerUsuarioId` y operan por `:id`. Instalar solo el guard de sesión no resuelve la autorización por propietario.

Antes de tocar estas rutas, acordar con el responsable de Casilla: quién puede ver notificaciones con `usuario_id IS NULL`; si hay acceso institucional delegado y cómo se autoriza; qué enlace de descarga se entrega y cómo comprueba propiedad el endpoint de almacenamiento; y cómo preservar la inmutabilidad e idempotencia del acuse legal. El cambio coordinado debe exigir identidad autenticada, aplicar `usuario_id = identidad.idUsuario` o una autorización delegada explícita en **cada** SELECT/UPDATE/descarga, eliminar el UUID de prueba y la cabecera de identidad en producción, y decidir si los registros sin propietario son datos históricos a migrar. Mientras eso no se acuerde, no debe afirmarse que Casilla satisface revocación inmediata ni aislamiento entre usuarios.
