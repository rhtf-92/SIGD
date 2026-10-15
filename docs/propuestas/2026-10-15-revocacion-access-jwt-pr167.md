# Propuesta técnica para revocación de access JWT — PR #167

**Estado:** diseño revisado para aprobación de Bartra y responsables de módulos. No autoriza implementación ni merge.
**Base examinada:** código del commit `a6e9b55b` y documento publicado en `7d1a8cdc` del [PR #167](https://github.com/rhtf-92/SIGD/pull/167), abierto contra `F_BARTRA`.

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

### Logout definitivo, incluso sin refresh local

`POST /api/v1/auth/logout` acepta `Authorization: Bearer <access JWT>` con `sid` y un `refreshToken` opcional. Si el access está firmado, no ha expirado y contiene un `sid` válido, revoca **solo** `s.id_sesion = sid AND s.id_usuario = sub`, aunque el cliente haya perdido el refresh. La operación es idempotente: una fila ya revocada devuelve `200` sin crear otra sesión. Si también llega un refresh, debe ser el registrado en esa misma fila; una discrepancia responde `401` y no revoca una sesión diferente. El endpoint no depende de que el perfil siga vigente, pues debe permitir cerrar una sesión cuyo rol fue retirado. Una cuenta bloqueada también puede cerrar su propia sesión.

Para clientes antiguos que solo envían refresh, se conserva temporalmente el cuerpo actual de `/auth/logout`: se verifica firma del refresh y se revoca únicamente su fila. El frontend actualizado siempre envía el bearer si lo tiene y adjunta el refresh cuando existe. Limpia el estado local tras recibir confirmación; ante error de red también lo limpia, pero muestra que no pudo confirmar el cierre remoto. Si no dispone de refresh **ni de un access vigente con `sid`**, no puede identificar de forma segura la sesión remota: solo limpia el dispositivo y solicita reingreso; nunca usa `sub` para revocar todas las sesiones por inferencia.

Bloqueo y desactivación administrativos ya revocan las sesiones en la misma transacción; los cambios que retiren un perfil deben revocar las sesiones afectadas. La comprobación del perfil en cada petición también deniega el rol retirado si fue modificado fuera del servicio administrativo.

## 3. Endpoints obligatorios

| Rutas | Integración requerida |
| --- | --- |
| `/api/v1/admin/**`, `/api/v1/usuarios/**` | Reemplazar `autenticarJwt` por el guard de sesión; conservar `autorizarPermisos` y el rol activo. |
| `/api/v1/auth/me`, `/api/v1/auth/perfil`, `/api/v1/auth/switch-role` | Usar la misma validación; en `switch-role`, bloquear y rotar la sesión anterior. `/auth/logout` usa el procedimiento específico descrito arriba. |
| `/api/v1/realtime/stream` | Validar `sid` al conectar tanto con Bearer como con `?token=`; revalidar antes de replay y de entregar datos, filtrar eventos por destinatario y cerrar la conexión al revocar la sesión. |
| `/api/v1/firma/pendientes`, `/api/v1/firmas/pendientes`, `/api/v1/firmas/cola-firmantes` | Validar sesión/cuenta antes de `verificarFacultadFirma`; conservar el chequeo de facultad. |
| `/api/v1/reportes/dashboard/resumen`, `/dashboard/cuellos-botella`, `/dashboard/tendencias`, `/dashboard/kpis`, `/dashboard-ejecutivo`, `/tiempos-atencion`, `/vistas-materializadas/refresh` | Incorporar sesión y bloqueo de cuenta a `cuentaActual`; conservar autorización propia. Revisar además los endpoints de exportación que pasan por `resolverIdentidad`. |
| `/api/v1/casilla/**` | Aplicar guard de sesión en el PR transversal; la autorización por propietario pertenece al trabajo separado de Casilla descrito abajo. |

Inventariar antes de implementar todos los demás consumidores de `verificarTokenAcceso`, `resolverIdentidad` y `cuentaActual`, incluidos alias y rutas con parámetros de consulta. No instalar un guard global sobre login, refresh, registro, salud, callbacks, descargas públicas legítimas o validadores: cada ruta debe clasificarse por contrato. Las rutas que acepten `?token=` deben evitar registrar el JWT en logs y URL de diagnóstico.

## 4. Usuarios multirrol y cambio de perfil

El access JWT autoriza únicamente `rolActivo`. `rolesAutorizados` sirve para interfaz y selección, pero no amplía permisos. Login multirrol sigue devolviendo `selectionToken`; `select-role` crea la primera sesión. Cada `switch-role` rota `sid` y refresh, por lo que el access anterior queda inválido. Dos cambios concurrentes desde el mismo `sid` producen como máximo una sesión sucesora, usando bloqueo de fila y condición de revocación. Un rol retirado no puede seguirse ejerciendo aunque aún figure en un JWT emitido. La retirada del último rol continúa impedida por el servicio administrativo y, si ocurre por otra vía, el guard deniega todas las rutas protegidas.

## 5. Coste de PostgreSQL

La firma, tipo, formato y expiración se comprueban sin E/S; solo los JWT criptográficamente válidos llegan a la base. La búsqueda usa la PK existente de `id_sesion` y un `EXISTS` indexable para el rol activo. La validación se ejecuta una vez por petición y se guarda en `req`, de modo que guards encadenados no repiten la consulta. En Admin, Reportes y otras rutas que ya consultan cuenta/permisos, se unifica la verificación en su consulta de autorización cuando sea posible. No se consulta la tabla completa ni se hace un lookup por refresh token en cada request.

No se propone caché positiva con TTL entre peticiones. Si la carga medida obliga a incorporarla, primero se debe diseñar invalidación transaccional compartida entre instancias y demostrar con pruebas que revocación y bloqueo no tienen ventana de aceptación. Se medirán consultas por request y latencia p95 antes/después.

### Revocación SSE en varias instancias

Cada suscripción registra `sid`, `sub` y canales en memoria de su instancia. La conexión se valida antes de responder `200`; cada replay y cada evento con datos vuelve a consultar la sesión y la autorización del destinatario **antes de escribir bytes**. Esa lectura es la barrera de seguridad: una revocación confirmada en PostgreSQL impide la siguiente entrega, aunque se pierda una notificación. Si la consulta falla, se cierra el stream sin enviar datos.

Para cerrar también los streams inactivos, el PR transversal incluirá una migración nueva con `pg_notify` transaccional al pasar `sesion_usuario.revocado_en` de `NULL` a valor y al deshabilitar/bloquear una cuenta. PostgreSQL entrega el aviso después del `COMMIT`; cada instancia mantiene un `LISTEN` dedicado y cierra sus suscripciones del `sid` o usuario afectado. El aviso contiene solo identificadores, nunca JWT ni datos de notificación. Si el listener se desconecta, la instancia cierra sus streams y no acepta otros hasta restablecerlo. Como respaldo frente a un aviso perdido, una consulta **agrupada por instancia** comprueba todos los `sid` conectados en cada intervalo de heartbeat actual (15 segundos) y cierra los inválidos. Esto añade una consulta por lote e intervalo, no una por suscriptor o heartbeat. La señal acelera el cierre; la revalidación antes de cada entrega garantiza el rechazo. Una petición o escritura iniciada antes del `COMMIT` no se puede deshacer: ese es el límite temporal explícito de “inmediata”.

El bus SSE actual suscribe por canal y distribuye el mismo evento a todos los suscriptores de ese canal; `replayDesde` tampoco filtra por usuario. Esto es una corrección de **autorización de destinatario**, distinta de la revocación de sesión. El responsable de CoreLink y el de Casilla deben definir y probar la identidad de destinatario en la carga y en el buffer de replay. Hasta que ese trabajo separado esté aprobado, el canal personal `casilla` no debe entregar datos sensibles; instalar el guard `sid` por sí solo no habilita ese canal. Si el puente entre réplicas o PostgreSQL no permite comprobar destinatario, se suspende la entrega sensible.

## 6. Compatibilidad y despliegue

Las respuestas JSON de `login`, `select-role`, `switch-role` y `refresh` conservan sus campos; `sid` solo aparece dentro del JWT. El frontend mantiene su almacenamiento actual, pero `logout` invoca `/auth/logout`, `switch-role` envía obligatoriamente el refresh y el interceptor distingue sesión revocada de access expirado. El hook SSE debe reconstruir `EventSource` al rotar access en refresh/cambio de perfil, porque actualmente lee el token solo al montar el hook.

### Política definitiva para JWT sin `sid`

El corte es **estricto, sin ventana de aceptación**: desde la activación, toda ruta protegida responde `401 SESSION_UPGRADE_REQUIRED` a un access JWT sin `sid`, aunque su firma y `exp` sean válidos. El frontend intenta una sola rotación de refresh; si no hay refresh, la fila fue revocada, la cuenta está bloqueada o el perfil perdió vigencia, pide reingreso. Un refresh JWT antiguo puede rotar a una sesión nueva con `sid` únicamente si su token exacto corresponde a una fila vigente y pasa las validaciones actuales; la rotación revoca la fila antigua de forma atómica. El refresh antiguo no se acepta como access y no revive filas revocadas. El JWT `role_selection` conserva su flujo separado de 5 minutos y, tras `select-role`, emite un access con `sid`.

Despliegue coordinado en dos pasos: (1) actualizar todas las instancias para **emitir** `sid` y entender el nuevo código de respuesta, manteniendo las comprobaciones actuales; actualizar también el frontend. (2) comprobar que no queda ninguna instancia emisora antigua y activar en todas la exigencia de `sid` mediante una configuración compartida de corte. Si una instancia no confirma la versión o el listener SSE está caído, no se activa el corte. La configuración no puede volver a permitir access sin `sid` después de activarse; un rollback de binarios requiere preservar el rechazo de tokens antiguos o solicitar reingreso. Registrar conteos de `SESSION_UPGRADE_REQUIRED` sin registrar tokens ni datos personales.

## 7. Pruebas automatizadas y criterios de aceptación

1. Unitarias de JWT: `sid` válido/ausente/malformado, firma, tipo y expiración; `role_selection` no obtiene acceso. Desde el corte, un access antiguo da `SESSION_UPGRADE_REQUIRED`, sin ventana de autorización.
2. Integración PostgreSQL real: login de rol único, selección multirrol, refresh atómico y dos refresh concurrentes; asociación `sid`-`sub`-refresh; fallo de INSERT/COMMIT sin token entregado; refresh antiguo vigente rota a `sid` nuevo y uno revocado no rota.
3. Logout y administración: con solo access vigente se revoca **esa** sesión; con refresh coincidente se revoca la misma; refresh de otra sesión falla sin afectarla; reintento idempotente. La siguiente petición con el access anterior falla tras logout, bloqueo, desactivación y revocación administrativa; al desbloquear no revive una sesión revocada; error de base falla cerrado.
4. Perfil: cambio rota sesión; access anterior no permite `switch-role` ni otra operación; dos cambios concurrentes dejan una sola sucesora; retiro de rol deniega acceso y refresh; `rolesAutorizados` no concede permisos del perfil inactivo.
5. Tabla de rutas: pruebas HTTP para Admin/Usuarios, Me, Reportes, Firma, SSE y alias con token vigente, expirado, revocado, cuenta bloqueada y sin `sid`; verificar `401`/`403`/`423` y ausencia de efecto lateral. Cubrir explícitamente módulos fuera de IdentiCore para detectar regresiones.
6. SSE: conexión, replay y evento nuevo revalidan; en dos instancias, revocar en A cierra en B; pérdida de `LISTEN` cierra streams; aviso perdido se detecta en el siguiente lote de 15 segundos; ninguna entrega posterior al commit usa sesión revocada. Frontend: logout con y sin refresh, fallo de red, refresh único y cola de reintentos, cambio de perfil y reconstrucción de EventSource.
7. Casilla y destinatarios SSE, en el PR separado de autorización: aislamiento entre dos propietarios para bandeja, detalle, lectura, acuse, descargas, evento nuevo y replay; ninguna ruta ni stream devuelve o modifica recursos ajenos o anónimos sin autorización delegada explícita.

La aceptación del PR transversal exige `git diff --check`, typecheck/build, suites Backend/Frontend y PostgreSQL real, prueba de dos instancias, y medición de consultas por petición y latencia p95 en rutas representativas frente a la base anterior. No se aceptará una caché positiva que deje ventana de revocación ni una excepción permanente para access sin `sid`. La autorización de Casilla tiene su propia aceptación y no se da por resuelta al aprobar la revocación. El PR #167 permanece como documento en revisión, sin merge.

## 8. Etapas, responsables y PRs

| Etapa | Responsable de ejecución y revisión | Entregable y puerta de aceptación |
| --- | --- | --- |
| 0. Diseño | Leonardo redacta; Bartra coordina aprobación; IdentiCore, CoreLink y responsable de Casilla revisan sus contratos. | Aprobar este diseño, la política de corte y las dependencias. **Sin código** en #167. |
| 1. Núcleo de sesión, en un PR nuevo distinto de #167 | IdentiCore/Auth (`B_SEGUNDO`, `B_TAPULLIMA`, `B_JAIR` según cabecera de `auth.router.ts`); Bartra revisa. | Emisión `sid`, guard compartido, logout por access, rotación de refresh y perfil, migración incremental de avisos. Pasan pruebas 1–4 en PostgreSQL real. |
| 2. Integración transversal, en el mismo PR nuevo | Responsables de OrganiCore, Reportes, Firma y CoreLink integran sus rutas; IdentiCore revisa uso del guard. | Inventario de rutas completo, sin efecto lateral con sesión revocada; pruebas HTTP de matriz 5. |
| 3. SSE y frontend, en el mismo PR nuevo | CoreLink implementa cierre entre instancias; responsable frontend integra logout, refresh y `EventSource`; Bartra revisa. | Pruebas 6, corte de JWT antiguos, reconexión y medición de rendimiento. El canal personal de Casilla queda sin entrega sensible hasta completar autorización de destinatario. |
| 4. Autorización por propietario, en PR de Casilla **separado** | `B_JAIR` (responsable indicado en `casilla.router.ts`) define propiedad, delegación y acuse; CoreLink codiseña filtrado SSE; Bartra revisa. | Pruebas 7 y revisión de permisos de descarga. No se declara segura Casilla por el solo merge del PR transversal. |

El PR transversal se abrirá **después** de que Bartra apruebe este diseño. Cada etapa se revisa antes de avanzar a la siguiente; el PR de Casilla puede prepararse en paralelo, pero la activación del canal personal depende de su aceptación. No se modifica `F_BARTRA` ni `main` directamente.

## Coordinación específica: Casilla: autorización distinta de revocación

`backend/src/domains/identicore/casilla.router.ts` está montado en `/api/v1` sin el guard común. La bandeja y estadísticas sustituyen un bearer ausente/inválido por `x-usuario-id` o un UUID predeterminado; sus SQL incluyen `usuario_id IS NULL` y una excepción para ese UUID. Detalle, lectura, acuse y ambas descargas ni siquiera llaman a `obtenerUsuarioId` y operan por `:id`. Instalar solo el guard de sesión no resuelve la autorización por propietario.

El PR transversal solamente aporta una identidad con sesión vigente a estas rutas; no define quién es dueño de cada notificación. El PR separado de Casilla debe acordar con `B_JAIR`: quién puede ver `usuario_id IS NULL`; si existe acceso institucional delegado y cómo se autoriza; qué enlace de descarga se entrega y cómo comprueba propiedad el endpoint de almacenamiento; y cómo preservar la inmutabilidad e idempotencia del acuse legal. Debe exigir `usuario_id = identidad.idUsuario` o delegación explícita en **cada** SELECT/UPDATE/descarga, eliminar el UUID de prueba y la cabecera de identidad en producción, y decidir cómo tratar registros históricos sin propietario. CoreLink y Casilla deben aplicar la misma regla al evento nuevo y al replay SSE. Revocación de sesión y propiedad son dos criterios de aceptación independientes.
