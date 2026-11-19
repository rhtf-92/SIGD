# Arranque central y TUPA de Ventanilla (26/10/2026)

Desde la raiz o desde backend: npm run dev. Ambos delegan a scripts/iniciar-sigd-local.ps1, reutilizan 3008/5178 si ya estan activos y terminan sin mantener la terminal ocupada. Desde la raiz: npm run status, npm run stop y npm run restart. La parada solo cierra los procesos locales registrados; Docker permanece activo.

La configuracion privada vigente sigue en LOCALAPPDATA/SIGD/secrets/demo-runtime.env: PostgreSQL 5433/sigd_jacobo_demo, rol sigd_jacobo_user, Redis DB 1, MinIO 9000, MIGRATE_ON_BOOT=false. El preflight y el supervisor usan ese mismo archivo; no se ejecutan cargas SQL al iniciar.

Ventanilla (/ventanilla o /tramite/ventanilla-presencial) exige el rol institucional MESA_PARTES. El selector consulta GET /api/v1/tramites/tipos: 19 SUZ26 vigentes, con busqueda y descripcion de la fuente. La opcion NO_TUPA conserva el flujo de documentacion general original. El contrato presencial conserva tipoDocumentalId y el procedimiento seleccionado en el asunto; esta correccion no agrega una relacion SQL nueva ni demuestra otra radicacion.

El comando backend npm run dev:api conserva la ejecucion exclusiva de la API para desarrollo explicito; no es el iniciador del prototipo. Para la demostracion usar siempre npm run dev.

Validacion de esta correccion: npm run dev desde raiz y backend termina con codigo 0 tanto con la aplicacion detenida como activa; la reutilizacion mantiene los mismos PIDs. Infraestructura Docker se mantuvo activa. Typechecks de ambos paquetes aprobados; 7 pruebas backend y 47 frontend aprobadas. Chrome con ventanilla.demo comprobo 19 opciones, busqueda, seleccion y ausencia de placeholders; ciudadano, secretario, director y administrador sin MESA_PARTES fueron rechazados conforme al contrato. Las cinco sesiones se cerraron por logout; no hubo nuevas radicaciones ni cambios documentales. Prueba reproducible: node scratch/e2e_runner/validar_ventanilla_catalogo.cjs (usa las credenciales demo privadas existentes y solo escribe sus sesiones).

---

# Puesta en marcha vigente ? 26/10/2026 ? B_JACOBO

Este apartado sustituye las instrucciones de arranque hist?ricas de m?s abajo. No restaurar bases ni ejecutar migraciones.

## Inicio y parada

Requisitos: Docker Desktop activo; contenedores existentes sigd-postgres-1, sigd-redis-1 y sigd-minio-1 en ejecuci?n; Node 24.19; dependencias ya instaladas. Configuraci?n privada existente en LOCALAPPDATA/SIGD/secrets/demo-runtime.env y credenciales demo en demo-credentials.txt. No publicar esos archivos.

Desde la ra?z del repositorio:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\iniciar-demo.ps1
# Al terminar la demostraci?n:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\detener-demo.ps1
```

- Frontend: http://127.0.0.1:5178
- Backend: http://127.0.0.1:3008 (GET /health y /ready).
- PostgreSQL: 127.0.0.1:5433/sigd_jacobo_demo; rol sigd_jacobo_user sin SUPERUSER, CREATEDB ni CREATEROLE.
- Redis: 127.0.0.1:6379, ?ndice 1. MinIO: 127.0.0.1:9000, bucket sigd-sandbox-e2e.
- El lanzador no inicia, detiene ni crea contenedores. Rechaza puertos ocupados y configuraci?n distinta de la base demo. La parada identifica los PID y comandos registrados, sin matar procesos por su puerto.
- MIGRATE_ON_BOOT=false; VITE_AUTOSTART=false evita el Vite integrado en 5173. HOST=127.0.0.1 limita el backend a loopback. OUTBOX_WORKER_ENABLED=true habilita expl?citamente un solo despachador original. SIGD_SAFE_BOOT=false mantiene las operaciones de negocio de demostraci?n; no desactiva JWT/RBAC. Nunca ejecutar el backend sin esta configuraci?n privada contra sigd_prueba.

## Evidencia de esta recuperaci?n

Cinco cuentas *.demo: login/perfil/JWT HTTP 200; Usuarios solo admin.demo (las otras cuatro: 403); Reportes admin.demo y director.demo (las otras tres: 403). Veinte sesiones de aceptaci?n comprobadas y revocadas antes del ?ltimo reinicio.

| M?dulo | Resultado real |
|---|---|
| M1 IdentiCore | Alta sint?tica HTTP 201. DNI, fecha, cuenta y consentimientos persistidos. Direcci?n, ubigeo y declaraci?n conservados en el JSON de auditor?a original; no se a?adieron columnas al perfil. Login de las cinco cuentas demo comprobado. |
| M2 OrganiCore | Directorio React, UUID, cat?logos y denegaci?n administrativa comprobados. |
| M3 TramiCore | EXP-2026-000004 radicado por React, expediente 27332305-a84c-4a0f-a058-83986936e862 y PDF persistidos. |
| M4 RutaDoc | Movimiento EN_CALIFICACION ? DERIVADO, Outbox PROCESADO, Bandeja/Detalle y hash del PDF del visor comprobados. |
| M5 DocuCore/CVD | Cotejo del CVD existente y SHA-256; no acredita firma criptogr?fica ni vigencia del certificado. El registro ya exist?a; no se gener? otro CVD. |
| M6 Despacho | Resoluci?n b19fed19-e40b-4e97-994f-88bbeb23d344 en PostgreSQL/Storage; tres art?culos recuperados en sesi?n nueva. Estado SQL BORRADOR_PENDIENTE_FIRMA, estado API BORRADOR. |
| M7 FirmaCore | Consulta y cola reales. Firma positiva pendiente de proveedor/certificado leg?timos. No se envi? un callback simulado. |
| M8 CoreLink/Casilla | Estado vac?o real para ciudadano.demo. No se insert? una notificaci?n artificial. Falta evento institucional destinado al titular antes de probar el acuse. |
| M9 Anal?tica | Vistas actualizadas por su endpoint original con administrador; cuatro radicados; VTEP 0% y gr?fico comprobados. Director recibe 403 al intentar refrescar. |

La suite completa se ejecut?: 4 aprobadas, 3 fallidas y 2 omitidas. Dos fallos eran del arn?s (URL de derivaci?n y estado SQL de resoluci?n); se corrigieron sin repetir escrituras y se verificaron los registros existentes. Anal?tica necesitaba actualizar sus vistas; se comprob? despu?s con el porcentaje que realmente presenta la tarjeta. No existe un resultado 9/9: Firma positiva y notificaci?n/acuse siguen pendientes.

## Pruebas y repetici?n controlada

```powershell
# Suite completa: CREA datos sint?ticos nuevos; no repetir autom?ticamente.
Set-Location scratch\e2e_runner
$env:SIGD_E2E_RUN_ID='SIGD-E2E-NUEVA-EJECUCION-UNICA'
node node_modules/@playwright/test/cli.js test suite_nueve_modulos.spec.ts --config playwright.config.ts
# Verificar solo registros de esta recuperaci?n, sin repetir radicaci?n/derivaci?n/resoluci?n:
$env:SIGD_E2E_RUN_ID='SIGD-E2E-20261026-RECUPERACION-01'
node node_modules/@playwright/test/cli.js test verificar_persistencia.spec.ts --config playwright.config.ts
```

Los resultados JSON y logs est?n en LOCALAPPDATA/SIGD/runtime. La verificaci?n de Anal?tica usa el endpoint administrativo de refresco ?nicamente si el contador materializado difiere del operativo. Es una actualizaci?n de la instant?nea, no una migraci?n; solo debe usarse contra la base demo.

## Preservaci?n y pendientes

Respaldo y 255 archivos pendientes preservados en LOCALAPPDATA/SIGD/backups/recuperacion-20261026-130536-ccfb7ecd. SHA-256 del SQL: 68363c04452fc21d07446f78415f126daefe60c150a2e0b33164d75dc68a27f8. Se preservaron tambi?n los privilegios previos y su reversi?n; no conceder CREATEDB al backend para operar normalmente.

No se retir? ning?n contenedor. postgres_test conserva otras bases y sigue siendo origen de recuperaci?n. La retirada queda condicionada a aceptaci?n completa y confirmaci?n de que esas bases no son necesarias. No usar down -v, prune ni modificar Compose para ocultar servicios.

Pendientes: proveedor y certificado leg?timos para Firma; operaci?n institucional de recepci?n de DERIVADO a EN_REVISION antes de una observaci?n v?lida, Outbox expediente_observado y acuse del titular. No cambiar estados por SQL ni fabricar notificaciones. No se modifica sigd_prueba.

---

## Registro hist?rico de verificaciones anteriores (no usar sus comandos para el arranque vigente)

# Ejecución y demostración del prototipo SIGD — B_JACOBO

Verificación: 19/10/2026. HEAD `bf30d8a0c85e266a86381fb10bf3740a8451c032` más los cambios locales conservados. Esta guía ejecuta el código local, sin desplegarlo sobre los contenedores compartidos de `5173/3000`.

## 1. Requisitos y comprobaciones

Windows, PowerShell, Node compatible con `frontend/package.json` (24.19 o superior dentro de la serie 24), dependencias del repositorio ya instaladas y Docker Desktop activo. Deben estar disponibles el contenedor existente `sigd-postgres_test-1` en `5434` y MinIO local en `9000`, con bucket `sigd-seguridad-aislada`.

Desde la raíz:

```powershell
Set-Location 'C:\Users\Liz\Desktop\SIGD\SIGD'
git branch --show-current
git rev-parse HEAD
git status --short
git diff --cached --name-only
docker ps --format '{{.Names}} {{.Status}} {{.Ports}}'
Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -in 3002,5174 }
```

Detener la preparación si la rama no es `B_JACOBO`, falta un servicio o alguno de los puertos temporales está ocupado. No detener procesos ajenos. Esta guía no inicia contenedores ni instala paquetes. No ejecutar el `npm run dev` de la raíz: su script contempla otra base de pruebas y servicios compartidos.

## 2. Backend original, modo de lectura

En una terminal nueva, ejecutar el bloque completo. Solo cambia variables del proceso actual. Los archivos privados ya existentes permanecen fuera del repositorio; no se muestran sus valores. El archivo `secrets\backend.env` comprobado contiene únicamente `AUTH_JWT_SECRET`.

```powershell
Set-Location 'C:\Users\Liz\Desktop\SIGD\SIGD\backend'
if ((git branch --show-current) -ne 'B_JACOBO') { throw 'Rama incorrecta' }
$env:PGPASSFILE = Join-Path $env:LOCALAPPDATA 'SIGD\pgpass-private\postgresql-test5434.pgpass'
$env:DOTENV_CONFIG_PATH = Join-Path $env:LOCALAPPDATA 'SIGD\secrets\backend.env'
$privateStorage = Join-Path $env:LOCALAPPDATA 'SIGD\secrets\compose.env'
foreach ($requiredFile in @($env:PGPASSFILE,$env:DOTENV_CONFIG_PATH,$privateStorage)) {
  if (-not (Test-Path -LiteralPath $requiredFile -PathType Leaf)) { throw 'Falta configuración privada existente' }
}
foreach ($inherited in @('PGPASSWORD','PGHOST','PGHOSTADDR','PGUSER','PGPORT','PGDATABASE','PGSERVICE','PGSERVICEFILE','NODE_OPTIONS','AUTH_JWT_SECRET')) {
  Remove-Item -LiteralPath ('Env:' + $inherited) -ErrorAction SilentlyContinue
}
function Read-SigdPrivateValue([string]$file,[string]$key) {
  $line = [IO.File]::ReadAllLines($file) | Where-Object { $_.StartsWith($key + '=') } | Select-Object -First 1
  if (-not $line) { throw 'Falta una clave de configuración privada de Storage' }
  $value = $line.Substring($key.Length + 1).Trim()
  if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
    $value = $value.Substring(1,$value.Length - 2)
  }
  if (-not $value) { throw 'Configuración privada vacía' }
  return $value
}
$env:DATABASE_URL = 'postgresql://sigd_seguridad_20261018_ro@127.0.0.1:5434/sigd_suiza_repro_2026101801'
$env:PGOPTIONS = '-c default_transaction_read_only=on -c statement_timeout=15000'
$env:PORT = '3002'
$env:NODE_ENV = 'development'
$env:SIGD_SAFE_BOOT = 'true'
$env:MIGRATE_ON_BOOT = 'false'
$env:ALLOW_HEADER_IDENTITY = 'false'
$env:REDIS_URL = ''
$env:CORS_ORIGIN = 'http://127.0.0.1:5174'
$env:S3_ENDPOINT = 'http://127.0.0.1:9000'
$env:S3_REGION = 'us-east-1'
$env:S3_BUCKET = 'sigd-seguridad-aislada'
$env:S3_FORCE_PATH_STYLE = 'true'
$env:S3_ACCESS_KEY = Read-SigdPrivateValue $privateStorage 'SIGD_MINIO_ROOT_USER'
$env:S3_SECRET_KEY = Read-SigdPrivateValue $privateStorage 'SIGD_MINIO_ROOT_PASSWORD'
npm.cmd run dev
```

Se ejecuta `src/server.ts` mediante el script original. `SIGD_SAFE_BOOT` evita el worker Outbox y el arranque automático del frontend; `MIGRATE_ON_BOOT=false` evita migraciones. El rol y `PGOPTIONS` mantienen las consultas en lectura. El listener de notificaciones permanece disponible sin procesar eventos pendientes. No probar subidas, lectura/acuse, radicación, firmas ni edición de usuarios en este modo.

Sondas desde otra terminal: `Invoke-RestMethod http://127.0.0.1:3002/health` y `Invoke-RestMethod http://127.0.0.1:3002/ready`. Si falla la disponibilidad, detener la demostración dependiente de ese servicio; nunca sustituir la URL por `5433`.

## 3. Frontend original

En otra terminal nueva:

```powershell
Set-Location 'C:\Users\Liz\Desktop\SIGD\SIGD\frontend'
$env:VITE_API_BASE_URL = 'http://127.0.0.1:3002'
$env:VITE_ENABLE_MOCKS = 'false'
npm.cmd run dev -- --host 127.0.0.1 --port 5174 --strictPort
```

Abrir Chrome en `http://127.0.0.1:5174`. En Network, las peticiones API deben ir a `3002`. No usar el frontend Docker `5173` como evidencia del código local. No copiar JWT al navegador.

## 4. Recorrido de presentación y límites reales

| Módulo / ruta | Evidencia aprovechable | Comprobación de esta entrega y límite |
|---|---|---|
| Login `/login` | Login original previamente comprobado | React login HTTP 200; `/auth/me` 200 con roles y facultades vacíos; refresh 200; refresh anterior 401; logout 200; refresh tras logout 401; React limpió ambos almacenamientos |
| Mesa de Partes `/tramite/mesa-partes-virtual` | Radicación real existente `EXP-2026-000001` | Wizard visible en React; API institucional respondió HTTP 200 con 19 procedimientos en comprobación real previa. No se envió otro trámite |
| Bandeja `/expedientes` | Bandeja, Detalle, Trazabilidad y visor PDF previamente comprobados | Con `seguridad_b`, API HTTP 200 en `PENDIENTES`: CUT 990001 y 990002 visibles; 990004 ajeno ausente. CUT 990003 no aparece en esa pestaña y no se comprobó en las otras |
| Casilla `/casilla` | Listado y estadísticas autenticados con el rol técnico habitual, después del SELECT por columnas descrito en la sección 9 | React muestra una notificación propia NO_LEIDO y contadores 1/1/0/0; API de detalle y filtros comprobada. Sin escrituras de lectura/acuse. Evento documental positivo pendiente de operador/recepción/calificación legítimos |
| Firma `/flujo-validez-legal/firma` | DocuCore, estado persistido, HMAC y protección documental implementados | Pantalla rechaza consulta sin sesión; no muestra firma completada. Sin proveedor/certificado y operador autorizados no hay firma positiva |
| CVD `/validador-cvd` | API original y cotejo documental implementados | HTTP 400 por formato, 404 por código inexistente; Chrome muestra 404 real. No hay firmas/CVD persistidos para demostrar autenticidad |
| Administración `/administracion/usuarios`, `/administracion/roles-permisos` | Directorio UUID, catálogo RBAC y edición implementados | SQL del servicio devuelve 3 cuentas sintéticas y 6 roles. Sin sesión redirige a login; API 401. Falta identidad administrativa legítima |
| Registro `/registro` | DTO, validación y consultas reconciliados | Formulario visible; DNI inválido rechazado según contrato. Alta bloqueada de forma segura por persistencia obligatoria y catálogo documental faltantes |
| Reportes `/reportes` | SELECT operativos y filtros implementados | SQL real: 5 radicados, 1 en trámite, serie de 12 meses. React muestra error ante 401 sin dibujar cifras privadas. Gráficos positivos requieren usuario con permiso |

Expediente existente: `9ba0ece5-2c71-4508-aed8-939ca1a5785c`. Documento existente: `cb0af3db-614e-4379-975f-5547a8018e5a`. No repetir radicación ni reemplazar su PDF. Las credenciales sintéticas permanecen en `%LOCALAPPDATA%\SIGD\login-private\seguridad_b.json`; no proyectar ese archivo ni imprimir su contenido.

## 5. Condiciones pendientes y autorización siguiente

1. **Sesión de demostración:** ciclo real completado en `5434` con el backend original y el formulario React. El rol técnico existente `sigd_mpv_20261019_rw` conserva SELECT/INSERT y recibió exclusivamente `UPDATE(revocado_en)` en `sigd_auth.sesion_usuario`. No tiene UPDATE de tabla ni de `refresh_token`. Reversión manual, si se decide retirar el permiso después de la presentación: `REVOKE UPDATE (revocado_en) ON TABLE sigd_auth.sesion_usuario FROM sigd_mpv_20261019_rw;`. No aplicarla durante la demostración, pues impediría la renovación y el cierre normales.
2. **Administración/Reportes:** confirmar si el rol institucional `ADMINISTRADOR` representa al SUPERADMIN solicitado y designar una identidad institucional legítima. No promover `seguridad_b`. Propuesta pendiente, sin ejecutar: asignación vigente y global, sin área, en `sigd_org.usuario_rol` al rol `3d416eb0-cd10-4b8a-9ad4-55c9f1626aa6`; relaciones existentes/aprobadas de `sigd_org.rol_permiso` con `ADMIN_USUARIOS/GLOBAL` (`a4e59b33-1d95-4847-905d-4feda1bce094`) y `REPORTE_LEER/GLOBAL` (`0245259d-349d-43a5-820b-bbc1d51f11cb`). No ejecutable hasta recibir el UUID de cuenta y aprobación de cada asignación. El código no concede facultades por el nombre del rol ni extiende estas facultades a firma o actos documentales legales.
3. **RutaDoc/Casilla:** definir la correspondencia institucional identidad UUID–operador BIGINT y un operador autorizado; completar recepción y calificación por los servicios originales. FSM conservada: `REGISTRADO → RECEPCIONADO → EN_CALIFICACION → OBSERVADO`. Autorizar después la secuencia concreta y procesar solo su evento; no cambiar estados por SQL.
4. **Registro:** decisión institucional sobre la ampliación mínima aislada de persistencia detallada en [CP-CIERRE-002](CP-CIERRE-002-integracion-funcional.md#única-alternativa-mínima-de-persistencia-para-registro). Faltan domicilio/ubigeo/declaración jurada y otras persistencias señaladas allí, además del catálogo de tipos. No se aplicó DDL ni se retiró el bloqueo seguro.
5. **Firma/CVD positivo:** proveedor, certificado legítimo, operador facultado y autorización para enviar/firmar el documento. Integridad SHA-256 no acredita por sí sola una firma criptográfica ni vigencia del certificado.

## 6. Evidencia de esta ejecución y cierre

- Ambos `npm.cmd run typecheck`: aprobados.
- Regresión backend de los nueve módulos: **674 aprobadas, 8 omitidas, 0 fallidas**. Regresión frontend: **288 aprobadas, 1 omitida, 0 fallidas**, en 18 archivos. Dobles de transporte/repositorio en las operaciones de escritura; no equivalen a persistencia real.
- Backend original `src/server.ts`, PostgreSQL con `transaction_read_only=on`, MinIO real, **18 comprobaciones HTTP y nueve pantallas en Chrome**. Sin JWT fabricados ni autenticación simulada en navegador.
- Directorio/Reportes se comprobaron con el servicio original y SQL real; las respuestas HTTP administrativas positivas y gráficos autorizados no se comprobaron.
- Evidencia local sin credenciales: `%TEMP%\sigd-entrega-evidencia-20261019\evidence.json` y capturas PNG. Incluye códigos HTTP, red de Chrome, contexto de base y comparación de huellas antes/después en 13 tablas. Sin cambios en datos; 0 firmas y 0 eventos Outbox.
- Correcciones de esta entrega: destino aislado admitido por el arranque seguro; guardia React reactiva a cambios de facultades; botón de cierre conectado al endpoint original y limpieza de Bearer en ambos almacenamientos.

Para finalizar una ejecución manual: `Ctrl+C` en las dos terminales propias y cerrarlas para descartar variables privadas del proceso. Comprobar puertos libres con el comando de la sección 1. No detener Docker ni sus contenedores. La verificación automática de esta entrega ya cerró sus procesos temporales.

PostgreSQL original `5433` no recibió conexiones en esta ejecución. No hubo escrituras en `5434`, modificaciones de objetos MinIO, migraciones ni cambios Docker. Los cambios locales anteriores de SQL y Docker fueron preservados, no aplicados ni certificados como despliegue. Esta entrega no afirma que los nueve módulos estén completados E2E.

## 7. Ciclo de sesión autenticado en entorno aislado

Antes de conceder el permiso, se identificó el contenedor por nombre/IP y el mapeo de `127.0.0.1:5434`; PostgreSQL reportó la base `sigd_suiza_repro_2026101801` y al administrador aislado existente. Los endpoints originales de login, refresh y logout escriben únicamente en `sigd_auth.sesion_usuario`; perfil y RBAC realizan SELECT. En cuenta/sesión no se encontraron triggers de usuario ni reglas que añadan escrituras. Los valores por defecto de sesión son el UUID y la fecha de emisión. El permiso fue otorgado por columna dentro de una transacción y se verificó que no habilita UPDATE de otras columnas ni de toda la tabla.

La aplicación se conectó como `sigd_mpv_20261019_rw`, sin superusuario, creación de roles/bases ni bypass RLS. El navegador ejecutó exactamente un login válido. El perfil vino de `/api/v1/auth/me` y confirmó cero roles y cero facultades persistidas. La API devolvió 403 para Directorio y React redirigió a acceso denegado. La consulta de Bandeja con la pestaña `PENDIENTES` devolvió 200, con los CUT 990001 y 990002 propios y sin el CUT ajeno 990004. El Wizard de Mesa de Partes cargó; no se envió una radicación.

El refresh rotó la sesión y respondió 200. Reutilizar el refresh anterior devolvió 401. El cierre desde el botón React llamó al logout original, esperó el 200 y limpió `sigd_token`/`token` de `localStorage` y `sessionStorage`. Reutilizar el refresh sucesor después del logout devolvió 401. Un replay posterior también se probó contra el backend original en modo READ ONLY.

Resultado de sesiones: se crearon dos filas para el ciclo (`login` y sucesor de `refresh`) y ambas quedaron revocadas, una por la rotación y otra por el logout. Las cuatro sesiones preexistentes de `seguridad_b` permanecen activas e intactas; no había sesiones de otras cuentas en esta base. El logout actual solo actualiza la fila que coincide con el refresh token bearer presentado y que continúa sin revocar; no recibe un ID de cuenta que permita seleccionar otra sesión. No se cambiaron cuentas, expedientes, documentos, notificaciones ni asignaciones RBAC. Evidencia sin valores de tokens/contraseña: `%TEMP%\sigd-auth-validacion-20261019.json`.

El endpoint de logout actual actualiza exclusivamente la fila cuyo `refresh_token` coincide con el secreto bearer presentado y que aún no está revocada; no acepta un `id_usuario` del cliente ni puede seleccionar filas por usuario. Los tokens de refresh son aleatorios y no se registraron en evidencia. La comprobación del ciclo confirmó que no se modificaron sesiones de otras cuentas; esta instancia no tenía sesiones de otras cuentas al inicio.

Typechecks backend/frontend aprobados y regresiones focalizadas aprobadas: **150 backend y 37 frontend**. Los procesos temporales se cerraron; los puertos `3002`, `5174` y `9223` quedaron libres. Los conteos de cuentas, personas, roles, permisos, documentos, firmas, expedientes, trámites, movimientos, contadores, Outbox y notificaciones coinciden con los previos. PostgreSQL original `5433` no recibió conexión. El permiso de columna se mantiene para la demostración y puede revertirse con el `REVOKE` indicado al concluirla. No se aplicó la reversión automáticamente.

## 8. Comprobación autenticada de Expedientes y Casilla

Estado histórico de la comprobación anterior: el bloqueo SELECT de Casilla descrito aquí fue resuelto en la sección 9.

Comprobación posterior del 19/10/2026, sin nueva radicación ni cambios de documentos/notificaciones:

- Las seis pestañas respondieron HTTP 200 y React presentó sus datos: `PENDIENTES` contiene `EXP-2026-000001`, `990001` y `990002`; `EN_TRAMITE` contiene `990003`; las cuatro restantes están vacías. Los contadores coinciden y `990004` ajeno no aparece.
- Se seleccionó `EXP-2026-000001` desde esa respuesta de Bandeja. Detalle y Trazabilidad respondieron 200. El historial está vacío, coherente con los cero movimientos persistidos del expediente; no se inventaron actuaciones.
- El endpoint protegido de Storage y el objeto MinIO devolvieron 200. El PDF tiene 998 bytes y MIME `application/pdf`; su SHA-256 coincide con el registro documental y con el blob cargado por el iframe de Chrome. Las capturas se tomaron demasiado pronto y conservan la pantalla inicial de carga; no acreditan por sí solas la renderización visual final del PDF.
- El expediente ajeno, su trazabilidad y foliación respondieron 403. La descarga de un documento ajeno también fue rechazada; descargar el propio sin JWT devolvió 401. React no presentó detalle ni iframe del expediente ajeno.
- **Casilla positiva pendiente:** el rol técnico `sigd_mpv_20261019_rw` no tiene SELECT sobre `sigd_auth.notificacion_casilla`; listado y contadores devolvieron 500. No se concedieron permisos adicionales. Con el rol lector existente se ejecutó la consulta original: una notificación propia `NO_LEIDO`, sin lectura, CUT, documento ni acuse. Los endpoints de listado, estadísticas y detalle rechazaron JWT ausente/inválido con 401.
- El modal de Casilla marca automáticamente como leída una notificación `NO_LEIDO`. No se abrió, ni se ejecutaron PATCH de lectura, acuses o eventos. Su detalle HTTP autenticado y la protección frente a notificaciones ajenas siguen pendientes en esta comprobación.
- Se corrigió un defecto demostrado: ante error de estadísticas, las cuatro tarjetas muestran `No disponible` y un mensaje de error en lugar de ceros aparentes. Cambios limitados al hook `useCasilla`, la página original y su prueba de regresión.
- Incidencia de automatización: la respuesta CORS se confundió inicialmente con la respuesta de login y una reejecución creó una segunda sesión. Ambas sesiones de esta ejecución se cerraron mediante el logout original y sus refresh tokens fueron rechazados con 401. Las seis filas de sesión anteriores no se modificaron: siguen cuatro activas y dos revocadas. El total final es ocho sesiones, cuatro activas y cuatro revocadas. React eliminó los tokens del ciclo comprobado.
- Las huellas de las 54 tablas de aplicación distintas de sesiones coincidieron antes/después. No se conectó a `5433`, ni se cambiaron esquemas, permisos, objetos MinIO o Docker. Ambos typechecks aprobaron; regresiones focalizadas: **299 backend y 88 frontend**, con dobles controlados, sin confundirlas con persistencia real.

Evidencia local sin tokens: `%TEMP%\sigd-expedientes-casilla-20261019.json`, `%TEMP%\sigd-cierre-session-cleanup-20261019.json` y `%TEMP%\sigd-casilla-readonly-negative-20261019.json`. Los procesos temporales se cerraron.

Para cerrar la demostración de Casilla sin ampliar privilegios: autorizar un único ciclo adicional; autenticar con el rol técnico existente, detener ese backend y continuar las consultas con el rol lector existente y el mismo secreto JWT. Conservar los tokens legítimos únicamente en el navegador y en memoria de la prueba. Al finalizar, usar el rol técnico únicamente para el logout de esa nueva sesión. No abrir notificaciones no leídas ni ejecutar el worker Outbox. Esta secuencia no se ejecutó sin la autorización adicional.

Administración/Reportes: se confirmó el rol vigente `ADMINISTRADOR`, los permisos globales `ADMIN_USUARIOS` y `REPORTE_LEER`, y cero asignaciones administrativas vigentes. La siguiente decisión institucional sigue siendo designar una cuenta legítima y aprobar expresamente su asignación RBAC; no promover automáticamente la cuenta ciudadana ni crear un bypass por nombre de rol.

## 9. Casilla: permiso mínimo y consulta autenticada real

El administrador del servidor aislado confirmó el contenedor `sigd-postgres_test-1`, su publicación exclusiva en `127.0.0.1:5434` y la base `sigd_suiza_repro_2026101801`. Antes del ajuste, la conexión real como `sigd_mpv_20261019_rw` falló con SQLSTATE `42501`. Los GET requieren las 19 columnas actuales: el listado las proyecta expresamente y el detalle usa `SELECT *`. Se concedieron individualmente, sin SELECT de tabla ni acceso automático a futuras columnas:

```sql
GRANT SELECT (
  id, usuario_id, correo_destinatario, cut, asunto, tipo_acto,
  numero_documento, cuerpo, referencia, estado, fecha_deposito,
  fecha_lectura, hash_sha256, cvd, id_acuse, acuse_hash_sha256,
  acuse_sellado_tiempo, documento_url, creado_en
) ON TABLE sigd_auth.notificacion_casilla TO sigd_mpv_20261019_rw;
```

Se verificó SELECT efectivo en las 19 columnas, SELECT de tabla falso y ausencia de INSERT/UPDATE/DELETE, privilegios administrativos y opción de delegar estos permisos. Los demás ACL de tablas, columnas y esquemas institucionales permanecieron iguales. El backend original siguió usando el rol técnico, sin superusuario, migraciones ni worker Outbox. No cambió código fuente en esta ejecución.

Resultado real:

- Un único POST de login desde el formulario React devolvió 200; `/auth/me`, listado, estadísticas y detalle propio devolvieron 200. Chrome mostró la notificación existente y los contadores **total 1, no leídos 1, leídos 0, confirmados 0**, sin HTTP 500 de Casilla ni excepciones de ejecución de React.
- Los filtros HTTP por estado, búsqueda, tipo y fechas respondieron correctamente; LEIDO/NOTIFICADO y la búsqueda inexistente devolvieron vacío. La paginación también se comprobó. La interacción visual del filtro no terminó: el selector de automatización falló y, tras el cierre de seguridad, el perfil de Chrome no conservó la sesión local para continuar. No se repitió el login. Las pruebas de filtros React con dobles aprobaron; no se presentan como comprobación visual completa.
- El GET propio confirmó el destinatario real; otras tres notificaciones (incluidas dos sin destinatario) devolvieron 403 en detalle y descargas. Listado, estadísticas y detalle devolvieron 401 sin JWT y con JWT inválido. Un ID inexistente devolvió 404. No se inició sesión con otra identidad.
- La notificación propia sigue `NO_LEIDO` y sin fecha de lectura. Su asunto de prueba contiene la palabra «ajena», pero la propiedad se comprobó por `usuario_id`, no por ese texto. No tiene CUT, documento ni acuse asociados: descarga documental 503 `STORAGE_REFERENCE_UNAVAILABLE`, acuse 409. No se abrió el modal ni se ejecutaron PATCH, acuses o nuevos eventos.
- Se creó **una** sesión, `d8e69a0d-55ae-4338-af7e-320ac90951cf`, y se revocó mediante el logout original con HTTP 200 al interrumpirse la automatización. Su refresh token fue rechazado con 401. Las ocho sesiones anteriores quedaron intactas; total final nueve filas, cuatro activas y cinco revocadas. La continuación posterior no ejecutó login ni refresh.
- Las huellas de las **54 tablas ajenas a sesiones** y de esquema/privilegios se mantuvieron iguales durante la prueba E2E. Los archivos del repositorio también permanecieron iguales durante la prueba. Ambos typechecks aprobaron; **150 pruebas backend y 48 frontend**, todas aprobadas, con dobles controlados.

Evidencia local: `%TEMP%\sigd-casilla-select-grant-20261019.json` y `%TEMP%\sigd-casilla-e2e-34d1ca0e-ffea-4f7a-8982-79c992fab9e8\evidence.json`. La captura `casilla-notificacion-propia.png` de esa carpeta muestra el resultado real; no incluye contraseñas ni tokens. La evidencia conserva la interrupción del controlador en lugar de registrarla como éxito total. Los procesos temporales se cerraron; PostgreSQL `5433` no recibió conexiones.

Reversión preparada, **sin aplicar**; retirarla después de la demostración volvería a impedir las consultas de Casilla del rol técnico:

```sql
REVOKE SELECT (
  id, usuario_id, correo_destinatario, cut, asunto, tipo_acto,
  numero_documento, cuerpo, referencia, estado, fecha_deposito,
  fecha_lectura, hash_sha256, cvd, id_acuse, acuse_hash_sha256,
  acuse_sellado_tiempo, documento_url, creado_en
) ON TABLE sigd_auth.notificacion_casilla FROM sigd_mpv_20261019_rw;
```

El listado y las estadísticas ya no requieren alternar conexiones. La autorización de destinatario sigue en Express; este SELECT no concede acceso institucional por sí mismo. Continúan pendientes el evento documental legítimo de RutaDoc/Outbox, su documento asociado y la posterior prueba autorizada de lectura/recepción. Esta notificación existente no demuestra ese recorrido institucional.
