# Acceso a crear cuenta y vinculación de ciudadanos existentes

Fecha: 2026-10-30. Rama verificada al inicio y al cierre: `B_JACOBO`.
HEAD: `bf30d8a0c85e266a86381fb10bf3740a8451c032`.

## Estado y alcance

Había 270 entradas locales de Git al comenzar. Se inspeccionaron los archivos objetivo y sus diferencias antes de editar. Se conservaron los cambios anteriores, incluidos los de registro, contratos de identidad, roles de navegación y formularios. El diff contra HEAD incluye trabajo acumulado y no representa únicamente esta intervención.

No hubo cambios de rama, commits, pushes, migraciones ni modificaciones de esquema. Se reinició de forma controlada solamente el backend existente para activar este código; no se reiniciaron PostgreSQL, Redis, MinIO ni el frontend. No se consultó ni modificó `sigd_prueba`. No se generaron expedientes ni CUT.

## Implementación

| Archivo | Cambio de esta intervención |
|---|---|
| `frontend/src/pages/LoginPage.tsx` | Texto «¿No tienes una cuenta?» y enlace «Crear cuenta» a `/registro`, debajo del botón existente. |
| `frontend/src/pages/registro/RegistroCiudadanoPage.tsx` | Enlace de regreso a `/login`; enviar `dni` solamente para DNI, conservando `tipoDocumento` y `numeroDocumento` para CE. |
| `backend/src/domains/identicore/registroCiudadano.service.ts` | Distinguir persona sin cuenta de cuenta duplicada; reutilizar su UUID sin sobrescribir identidad; bloquear la fila y comprobar nuevamente cuentas/tipo documental; evitar duplicar historial documental; exigir el rol canónico vigente CIUDADANO; registrar la reutilización en auditoría. |
| `backend/src/domains/identicore/argon2.service.ts` | Método específico de Argon2id nativo para autorregistro. Ante ausencia/fallo del motor, el registro devuelve 503 antes de escribir. El mecanismo heredado de otros consumidores no se cambió. |
| `backend/tests/unit/domains/identicore/registroCiudadano.service.spec.ts` | Casos de reutilización, fechas, discrepancia, duplicidad, comprobación posterior al bloqueo, rol ausente y fallo criptográfico. |
| `frontend/tests/unit/pages/LoginPage.test.tsx` | Navegación pública mediante Crear cuenta. |
| `frontend/tests/integration/m1/registroFormularios.test.tsx` | Regreso a login y registro CE sin incluir indebidamente un DNI. |

Se reutilizaron las rutas públicas existentes de AppRouter y `crearRouterIdenticore`; no se crearon pantallas, endpoints ni contratos nuevos. La consulta original rechazaba cualquier persona existente, incluso sin cuenta. Ahora rechaza cuentas existentes y comprueba los datos de identidad antes de vincular la persona.

Las identidades existentes se comparan por nombres y apellidos normalizados en acentos, espacios y mayúsculas, y por fecha de nacimiento cuando ya está registrada. No se sustituyen nombres, fechas, correo o teléfono de la persona previa. El correo y teléfono de acceso declarados se guardan en los objetos existentes de cuenta/perfil; se conservan las escrituras de consentimiento y auditoría. Los documentos permanecen como cadenas, con sus ceros iniciales.

Una persona jurídica existente no se vincula automáticamente: no se añadió un mecanismo nuevo para acreditar representación legal. Se mantiene el flujo existente de alta jurídica.

La validación documental es la ya disponible en el proyecto. Estas pruebas no certifican identidad contra RENIEC/Migraciones ni añaden verificación externa de correo. La coincidencia de datos declarados no equivale a una comprobación externa de identidad.

## Pruebas y evidencias

| Comprobación | Resultado |
|---|---|
| `backend: npm.cmd run test:unit -- tests/unit/domains/identicore` | 10 archivos, 180 pruebas aprobadas; salida 0. Incluye registro, autenticación, aislamiento de Casilla y criptografía heredada. |
| `frontend: npm.cmd test -- tests/unit/pages/LoginPage.test.tsx tests/integration/m1/registroFormularios.test.tsx tests/unit/schemas/registroCiudadano.test.ts` | 3 archivos, 59 pruebas aprobadas; salida 0. |
| `npm.cmd run typecheck` en backend | Aprobado, salida 0. |
| `npm.cmd run typecheck` en frontend | Aprobado, salida 0. |
| `frontend: npm.cmd run build` | Aprobado, salida 0. Advertencias de anotaciones de Zod, importación estática/dinámica compartida y tamaño de chunk; sin cambios de dependencias. |
| HTTP con código actualizado + PostgreSQL real | Persona nueva 201; persona previa sin cuenta 201 y mismo UUID; cuenta duplicada 409; identidad incompatible 409; campo de rol administrativo rechazado 400. |
| Login HTTP contra las cuentas de prueba | 200 por documento y por correo; JWT emitido sin mostrarlo; único rol CIUDADANO. |
| Argon2id real | Hash generado por módulo nativo y comprobado con su verificador, fuera de los mocks unitarios. |
| Navegador real, 1448 × 1086 | Login → Crear cuenta → registro público → Iniciar sesión → login, sin credenciales ni recargas de página. Capturas inspeccionadas visualmente. |
| `git diff --check` limitado a los archivos modificados de esta tarea | Aprobado, salida 0. |
| `git diff --check` global | Detecta espacios preexistentes en `frontend/src/pages/tramite/VentanillaPresencialPage.tsx:878` y `:898`; no se modificaron por ser ajenos al alcance. |

La primera ejecución de frontend fue bloqueada por permisos de lectura de esbuild y la de tsx por acceso al perfil del sistema. Las repeticiones autorizadas fuera del aislamiento finalizaron correctamente. La integración real detectó además un error de inferencia SQL `42P08` en el INSERT SELECT del historial documental; se corrigió con conversión explícita a varchar y se repitió satisfactoriamente toda la integración.

### PostgreSQL

Identidad verificada antes de cualquier escritura de prueba:

- Destino configurado: `127.0.0.1:5433/sigd_jacobo_demo`.
- `current_database()`: `sigd_jacobo_demo`.
- `current_user`: `sigd_jacobo_user`.
- Servidor efectivo: `172.20.0.2`, puerto `5432`.

La integración utiliza las rutas Express y servicios reales en proceso, con una conexión PostgreSQL real y SAVEPOINT para cada transacción de registro. Una transacción exterior permite verificar los registros y efectuar login antes de ejecutar ROLLBACK. No es una simulación del motor PostgreSQL ni una prueba E2E del proceso que escucha en 3008.

Al finalizar quedaron las mismas 19 personas y 10 cuentas iniciales. Se revirtieron personas, cuentas, perfiles, asignaciones, consentimientos, auditoría de prueba y sesiones. No se alteraron registros previos ni se persistieron cuentas de prueba. Las secuencias técnicas que use PostgreSQL pueden avanzar incluso con ROLLBACK; no se ejecutaron secuencias de expedientes/CUT.

Scripts reproducibles, con límites de tiempo y cierre de conexiones:

```powershell
.\backend\node_modules\.bin\tsx.cmd scratch/verificar-registro-ciudadano.ts
node scratch/verificar-registro-browser.cjs
```

La integración requiere la configuración local existente de demostración; nunca imprime secretos ni tokens. El navegador abre y cierra únicamente su propia instancia de prueba.

Evidencias en `scratch/evidencias-registro-ciudadano/`:

- `postgres-http.json`: nueve comprobaciones y conteos anteriores/posteriores.
- `browser.json`: navegación comprobada.
- `login-crear-cuenta-1448x1086.png`: enlace visible en el login real.
- `registro-publico-1448x1086.png`: formulario público existente.
- `git-status-final.txt`: inventario final íntegro del trabajo acumulado.

## Backend activado y límite de persistencia de prueba

Se inspeccionó la cadena de procesos: `scratch/run_backend.cjs` carga la configuración externa `demo-runtime.env` y lanza `node --import tsx ... src/server.ts`. La configuración no secreta confirmó `127.0.0.1:5433/sigd_jacobo_demo`, `MIGRATE_ON_BOOT=false` y `VITE_AUTOSTART=false`. Backend compilado antes del reinicio. Se detuvo el proceso hijo anterior, se confirmó el puerto libre y se volvió a ejecutar el lanzador existente: proceso lanzador PID 29120 y único listener nuevo en 3008 PID 11140. `/health` devolvió `ok`; `/ready`, `READY`; registro con rol administrativo y login con cuerpo vacío respondieron 400. El puerto 3008 quedó con un listener.

El formulario y los enlaces se verificaron en Edge real; los endpoints actualizados se probaron en integración HTTP en proceso con PostgreSQL real. Para cumplir la instrucción de no dejar cuentas de prueba ficticias persistentes ni tocar ciudadanos reales, la cuenta y persona nuevas, así como el vínculo de una persona demo sin cuenta, se probaron dentro de una transacción exterior y se revirtieron. Antes y después hubo 19 personas y 10 cuentas. Por ello la ruta funcional de guardado y login quedó demostrada sobre PostgreSQL, pero **no se dejó una cuenta nueva persistida** ni se ejecutó una sesión de login desde la interfaz del navegador. Las pruebas unitarias del frontend validan el formulario y los contratos HTTP con doble; no equivalen a un E2E persistente.

La comprobación contra el proceso recién reiniciado se limitó a sondas y peticiones inválidas sin escritura. El POST válido contra el puerto 3008 no se ejecutó porque dejaría un registro persistente; no se habilitó limpieza DELETE para pruebas. El navegador sí recorrió login → registro → login sin sesión ni credenciales.

Las capturas muestran que se conserva la pantalla institucional. No se modificaron HomePage, header, tarjetas, módulos, autenticación existente, permisos institucionales, Docker ni rutas. La única asignación de alta sigue siendo CIUDADANO del catálogo existente.
