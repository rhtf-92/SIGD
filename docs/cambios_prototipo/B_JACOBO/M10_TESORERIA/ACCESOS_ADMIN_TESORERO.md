# Accesos del ADMINISTRADOR GENERAL y TESORERO a M10

Fecha: 2026-10-31  
Rama: `B_JACOBO`  
Base consultada: `sigd_jacobo_demo` (consulta de solo lectura)

## Resultado

Se habilitó M10 para el rol vigente `ADMINISTRADOR` con lectura global y consulta de reportes. No se le otorgaron permisos para recibir efectivo, registrar o verificar pagos, modificar tarifas, administrar caja, ni evaluar, aprobar o ejecutar devoluciones. `TESORERO` conserva la operación financiera mediante sus permisos RBAC vigentes. Los ciudadanos mantienen acceso a sus operaciones personales; otros trabajadores sin autorización son rechazados.

La misma regla se aplica en el backend y la ruta del frontend. La tarjeta M10 aparece para ADMINISTRADOR, TESORERO y CIUDADANO; a este último se le presenta como «Mis pagos y devoluciones». La sección de caja del administrador muestra aperturas, cierres y movimientos sin controles para operar caja.

## Roles observados en PostgreSQL

Consulta ejecutada con transacción de solo lectura en `sigd_jacobo_demo`:

| Código | ID de rol | Estado / permisos relevantes |
|---|---|---|
| `ADMINISTRADOR` | `d8cfb14a-efbf-4808-b25f-041681e04710` | Vigente. Tiene permisos institucionales de administración, expedientes, firma y reportes; no tiene permisos financieros asignados en `rol_permiso`. |
| `TESORERO` | `9b5471ec-6901-4d92-893f-ed51a90fe9d4` | Vigente. Tiene los nueve permisos `TESORERIA_*`, incluidos caja, pagos, tarifas, devoluciones, lectura y reportes. |
| `CAJERO` | `aa1a372e-296c-487f-9f0a-86ef68d45741` | No vigente; cero asignaciones vigentes. Se conservan filas históricas de permisos. |
| `SUPERVISOR_TESORERIA` | `c86ad9e6-1391-4a5f-b2b6-d447826914a8` | No vigente; cero asignaciones vigentes. Se conservan filas históricas de permisos. |
| `APROBADOR_DEVOLUCIONES` | `444b6f5d-6c69-4edd-b641-c6b2c357d268` | No vigente; cero asignaciones vigentes. Se conservan filas históricas de permisos. |

`obtenerAutorizacionCuenta()` une las cuentas con roles donde `rol_sistema.vigente = TRUE` y con asignaciones vigentes. Por ello, los permisos históricos de los tres roles financieros desactivados no conceden acceso efectivo. No se modificaron asignaciones de usuarios, roles ni permisos en PostgreSQL, y no se creó ningún rol.

## Cambios

- `backend/src/domains/tesoreria/tesoreria.rules.ts`: añade una política central que deriva para `ADMINISTRADOR` solamente `TESORERIA_LEER` y `TESORERIA_REPORTES`; para `TESORERO` conserva únicamente los permisos M10 globales que llegan del RBAC vigente.
- `backend/src/domains/tesoreria/tesoreria.router.ts`: aplica esa política al actor autenticado. Las mutaciones siguen pasando por `exigir()` y, por tanto, el administrador recibe 403 en operaciones de escritura.
- `frontend/src/pages/HomePage.tsx`: muestra la tarjeta M10 a ADMINISTRADOR y TESORERO; también hace visible Ventanilla al administrador y muestra Firma Digital según su facultad institucional.
- `frontend/src/routes/AppRouter.tsx`: protege `/tesoreria` para `ADMINISTRADOR`, `TESORERO` o `CIUDADANO`; permite a ADMINISTRADOR llegar a Ventanilla. Los demás roles conservan sus reglas.
- `backend/src/domains/tramicore/tramites.controller.ts`: permite el acceso a Ventanilla con el rol vigente `ADMINISTRADOR` o `MESA_PARTES`, revalidado desde PostgreSQL y no desde los roles declarados en el JWT.
- `frontend/src/pages/tesoreria/TesoreriaPage.tsx` y `frontend/src/components/tesoreria/CajaTesoreria.tsx`: distinguen consulta de caja de las acciones de apertura/cierre. Al administrador se le ocultan las acciones de cierre y no se le habilita la apertura.
- Pruebas actualizadas o agregadas en HomePage, guardias de rutas, caja, política RBAC M10, router M10 y autorización de Ventanilla.

No se cambiaron tarifas, DTO, contratos API, tablas, datos financieros, pagos, comprobantes, movimientos de caja ni solicitudes de devolución. No se ejecutaron migraciones y no se reiniciaron servicios.

## Endpoints M10

Con el permiso supervisor derivado, el backend habilita las consultas que ya están protegidas por `TESORERIA_LEER` y `TESORERIA_REPORTES`, entre ellas:

- `GET /api/v1/tesoreria/capacidades`
- `GET /api/v1/tesoreria/tarifas`
- `GET /api/v1/tesoreria/ordenes` y `GET /api/v1/tesoreria/ordenes/:id`
- `GET /api/v1/tesoreria/caja`
- `GET /api/v1/tesoreria/movimientos`
- `GET /api/v1/tesoreria/reportes`
- Consulta autorizada de documentos asociados a operaciones.

Las rutas `POST` y revisiones de pagos/devoluciones requieren facultades operativas adicionales que no se derivan para ADMINISTRADOR. Ciudadanos y trabajadores no autorizados no pueden ampliar sus facultades manipulando el frontend o la URL.

## Verificación

- Backend: 52 pruebas unitarias específicas aprobadas (política M10, autorización HTTP de M10 y autorización de Ventanilla).
- Frontend: 44 pruebas específicas aprobadas (visibilidad por rol, acceso directo a rutas y presentación de caja de solo lectura).
- TypeScript backend y frontend: aprobados.
- Build backend: aprobado.
- Build frontend: aprobado. Vite informó avisos no bloqueantes existentes sobre comentarios `@__PURE__`, importación estática/dinámica de `api/client.ts` y tamaño de bundle.
- Consulta real PostgreSQL de roles/permisos: solo lectura; confirmó códigos, IDs y vigencia indicados arriba.
- No se ejecutó una sesión navegador ni una mutación financiera contra el backend activo: no se dispuso de credenciales autorizadas del administrador/tesorero y no se reinició el servicio. Las pruebas HTTP de autorización utilizan JWT y repositorios simulados, sin persistencia.

## Estado

- ADMINISTRADOR: acceso de lectura/supervisión a M10 implementado y verificado mediante pruebas de política y HTTP simuladas.
- TESORERO: conserva las facultades RBAC vigentes; verificado mediante prueba de capacidades.
- CIUDADANO: ruta M10 permitida para uso personal; pruebas de ruta aprobadas. La titularidad continúa aplicada en los servicios.
- Otro trabajador: acceso directo a M10 denegado en ruta frontend y middleware backend; verificado con pruebas.
- Ventanilla: acceso ADMINISTRADOR implementado y comprobado con prueba unitaria HTTP; operación no probada contra persistencia real.
- Operación en la instancia backend activa, usando cuentas institucionales reales: pendiente de validación autenticada. No se reinició ni se duplicó el backend.

## Activación controlada y comprobación en la instancia (2026-10-31)

Se verificó `B_JACOBO`, HEAD `bf30d8a0c85e266a86381fb10bf3740a8451c032` y se conservaron los cambios locales preexistentes (299 entradas en `git status --short` al inicio). No se ejecutaron migraciones, escrituras en PostgreSQL, operaciones financieras ni cambios de permisos.

El backend anterior (PID 25760) estaba servido por `node scratch/run_backend.cjs`, desde el directorio de este checkout. Su entorno efectivo fue verificado por el guard local: base `sigd_jacobo_demo`, `MIGRATE_ON_BOOT=false` y `SIGD_DEMO_OMITIR_PAGO=true`. Se reinició exclusivamente ese árbol de procesos; tras detectar que el runner no heredó inicialmente la variable de omisión desde el entorno anterior, se restauró su valor efectivo `true` en el entorno del proceso y se reinició solo el backend para dejar la configuración correcta activa. No se editaron archivos de entorno. El backend final PID 26060 tiene un listener en 3008; frontend PID 25016 no cambió y mantiene un listener en 5178. PostgreSQL, Redis, MinIO, Docker y frontend no se reiniciaron.

Comprobaciones reales posteriores al reinicio:

- `GET /health`: HTTP 200, `UP`.
- `GET /ready`: HTTP 200, `READY`.
- `GET http://127.0.0.1:5178/`: HTTP 200.
- Configuración efectiva observada en el backend: `sigd_jacobo_demo`, `MIGRATE_ON_BOOT=false`, `SIGD_DEMO_OMITIR_PAGO=true`.
- Una única instancia escuchando en cada puerto: backend PID 26060 en 3008; frontend PID 25016 en 5178.
- Sin token, las rutas `GET /api/v1/tesoreria/capacidades`, `/ordenes`, `/caja` y `/reportes` respondieron 401. El `POST /api/v1/tramites/ventanilla-presencial` sin token también respondió 401.

Pruebas ejecutadas tras la activación:

- Backend M10: 92 pruebas en 6 archivos aprobadas.
- Matriz backend de autorización: 20 pruebas aprobadas. El caso ADMINISTRADOR demuestra lectura de capacidades/reportes y rechazo 403 al registrar efectivo; TESORERO recibe los permisos RBAC vigentes; un trabajador no autorizado recibe 403.
- Frontend de Home, ruta M10, guardias de rutas, Ventanilla y panel Tesorería: 74 pruebas en 4 archivos aprobadas. Incluyen tarjeta y acceso directo a Ventanilla para ADMINISTRADOR, guardia M10 para los roles autorizados, denegación a trabajador sin autorización y vista personal del ciudadano sin controles administrativos.

La prueba sin credenciales confirma que el backend actualizado exige autenticación; no sustituye una sesión autenticada. No se proporcionaron credenciales autorizadas para ADMINISTRADOR, TESORERO o CIUDADANO, por lo que queda pendiente validar en navegador, contra la instancia real, el inicio de sesión de cada rol y las consultas/acciones propias de sus sesiones. No se crearon cuentas ficticias ni se realizaron pagos o devoluciones.

### Estado después de activar

- Backend actualizado y saludable: **IMPLEMENTADO Y VERIFICADO** para arranque, configuración y listener único.
- Guardias y permisos de M10, Ventanilla, operaciones del Tesorero, lectura del Administrador y vista ciudadana: **VERIFICADOS mediante pruebas automatizadas**.
- Login y navegación con cuentas institucionales reales por rol: **PENDIENTE**, requiere credenciales de prueba autorizadas.
- No se detectaron listeners duplicados ni se alteraron datos, permisos o movimientos financieros.
## Revisión adicional de visibilidad de M10 (2026-10-31)

### Hallazgo

El catálogo de roles de la base de demostración contiene los códigos `ADMINISTRADOR` (etiqueta institucional Administrador del Sistema) y `TESORERO`; no se encontró un código literal `ADMINISTRADOR GENERAL`. La portada reconocía `ADMINISTRADOR`, `SUPER_ADMIN` o el permiso global `ADMIN_USUARIOS` para el panel administrativo, pero la tarjeta M10 y su guardia usaban una lista distinta de roles. Por ello, una identidad administrativa global que no trajera el código literal esperado podía recibir una portada/ruta inconsistente. El backend, además, derivaba la supervisión de M10 únicamente desde el rol `ADMINISTRADOR`.

### Corrección

- La visibilidad de la tarjeta M10 usa el criterio administrativo global ya empleado por la portada (`ADMINISTRADOR`, `SUPER_ADMIN` o permiso global `ADMIN_USUARIOS`).
- La ruta directa de M10 reconoce esos mismos administradores, sin abrirla a trabajadores sin permiso.
- El backend deriva para `ADMINISTRADOR`, `SUPER_ADMIN` o `ADMIN_USUARIOS` únicamente lectura y reportes de M10. Los permisos de operación de efectivo, caja y devoluciones no se ampliaron. La política de `TESORERO` permanece sin cambios.
- No se crearon roles, no se alteró PostgreSQL y no se ejecutaron migraciones.

### Verificación de esta revisión

- Frontend enfocado (portada, guardias de rutas M10 y Ventanilla): 3 archivos, 67 pruebas aprobadas.
- Backend M10 (reglas y autorización HTTP): 36 pruebas aprobadas.
- TypeScript backend y frontend: aprobados (`tsc --noEmit`).
- Servicios disponibles en la comprobación: `/health` 200, `/ready` 200 y frontend 5178 200. `netstat` mostró un listener por puerto: backend PID 26060 en 3008 y frontend PID 25016 en 5178.
- No se reinició ningún servicio en esta revisión. El backend en ejecución todavía corresponde al código cargado anteriormente; la nueva autorización backend está verificada mediante sus pruebas, pero su activación en el proceso vivo requiere un reinicio controlado autorizado.
- No se dispuso de credenciales autorizadas de los roles para ejecutar login y navegación autenticada real desde el navegador. La visibilidad y el acceso directo se verificaron con pruebas de renderizado/guards; la autorización backend se verificó con pruebas HTTP aisladas. La prueba de sesión real queda pendiente.
- `git diff --check` reportó espacios finales preexistentes en `frontend/src/pages/tramite/VentanillaPresencialPage.tsx` (líneas 878 y 898); no se modificaron porque son ajenos a esta corrección.
## Activación solicitada y comprobaciones posteriores (2026-10-31)

- Rama `B_JACOBO`; HEAD `bf30d8a0c85e266a86381fb10bf3740a8451c032`; se preservaron los 299 cambios locales detectados antes de la activación.
- Se verificó que el PID anterior 26060 ejecutaba `backend/src/server.ts` desde este checkout y era hijo del lanzador `scratch/run_backend.cjs`. La configuración protegida fue comprobada sin imprimir secretos: base `sigd_jacobo_demo`, host `127.0.0.1:5433`, puerto API 3008 y `MIGRATE_ON_BOOT=false`. Se conservó la excepción de demostración `SIGD_DEMO_OMITIR_PAGO=true` como variable de entorno del proceso; no se editó el archivo de configuración.
- El reinicio se limitó al backend. El lanzador original `node scratch/run_backend.cjs` creó la instancia actual PID 3728. Se observa exactamente un listener en 3008 (PID 3728). El frontend permaneció sin reiniciar: PID 25016, único listener en 5178.
- `GET /health`: HTTP 200, estado `UP`. `GET /ready`: HTTP 200, estado `READY`. `GET /` en 5178: HTTP 200.
- Sin credenciales, `GET /api/v1/tesoreria/ordenes`, `/reportes` y `/caja` responden HTTP 401. Esto confirma que el panel y sus datos no son públicos.
- No se repitieron las 67 pruebas frontend ni las 36 backend ya aprobadas, conforme a la instrucción. La implementación backend quedó cargada tras el reinicio; esas pruebas automatizadas cubren el permiso administrativo de lectura/reportes, denegación de cobros, conservación del rol TESORERO y bloqueo de ciudadano.
- No se proporcionaron credenciales autorizadas de ADMINISTRADOR, TESORERO o CIUDADANO. Por ello, login y navegación autenticada real de cada rol desde el navegador quedan **PENDIENTES**. La visibilidad/ruta por rol está cubierta por las pruebas frontend; la instancia activa fue comprobada en salud y rechazo anónimo, no mediante una sesión iniciada.
- No se alteraron permisos operativos, roles, datos, operaciones financieras, migraciones ni servicios de infraestructura.

### Resultado de activación

Backend actualizado cargado y listo: **IMPLEMENTADO Y VERIFICADO** (`READY`, listener único PID 3728). Frontend conservado y disponible: **VERIFICADO** (PID 25016, HTTP 200). Autorización con identidad real de cada rol en navegador: **PENDIENTE** por ausencia de credenciales autorizadas.