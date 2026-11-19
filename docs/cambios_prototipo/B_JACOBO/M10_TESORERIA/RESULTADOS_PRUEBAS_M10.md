## Actualización tras autorización de migración13 — verificado el31/10/2026

La migración13 está APLICADA en sigd_jacobo_demo con el runner institucional, y el backend fue activado mediante el único reinicio autorizado. El flujo público ya está VERIFICADO EN NAVEGADOR REAL5178/3008, sin cuenta ni JWT, con pago explícito de ensayo, recibo, PDF, CUT, cargo y seguimiento seguro.

| Modalidad | CUT | Expediente | Recibo |
|---|---|---|---|
| Pública sin cuenta |EXP-2026-000041|99c15974-38a7-4a50-8aaf-811f168a64d1|DEMO-RC-3|
| Registrada |EXP-2026-000042|5d2cbfbe-0406-4b45-9907-a6337f1eac54|DEMO-RC-4|

Se comprobaron la devolución nueva, el cierre de caja sin diferencias, cinco PDF MinIO, dieciocho comprobaciones HTTP y dieciocho conjuntos históricos intactos. No se modificaron las18 tarifas ni SUZ26-068; no se asignaron roles a trabajadores. Todo efectivo es DEMOSTRACIÓN SIN DINERO REAL.

Pruebas de esta activación:112 backend focalizadas y19 frontend focalizadas, builds aprobados. El caso gratuito no tiene un procedimiento oficial acreditado en el catálogo actual; no se inventó una tarifa0 para afirmar un E2E institucional gratuito.

Detalle, seguridad, evidencias y límites: [ACTIVACION_13_Y_E2E_PUBLICO.md](./ACTIVACION_13_Y_E2E_PUBLICO.md). Los bloqueos de migración/activación del texto anterior están superados; se conserva ese texto como historial previo a la autorización.

---

## Estado vigente de la última fase (31/10/2026)

La ampliación pública está preparada en código, pero no activada ni verificada integralmente. No se ejecutaron migraciones ni reinicios. SUZ26-068 sigue pendiente; las otras 18 tarifas y los hechos financieros permanecen intactos. TESORERO sigue siendo el único rol administrativo vigente. Consulte [ULTIMA_FASE_CIERRE_M10.md](./ULTIMA_FASE_CIERRE_M10.md) y [FORMATO_RECIBO_INTERNO_M10.md](./FORMATO_RECIBO_INTERNO_M10.md).

El contenido siguiente es evidencia de las fases anteriores.

---

## Actualización vigente: efectivo y rol único — 31/10/2026

Esta actualización sustituye las decisiones anteriores sobre medios bancarios, cuatro roles y tarifas indiscriminadamente pendientes. Se conserva el contenido anterior como historial, no como política vigente. Fuente de cierre: [CIERRE_EFECTIVO_M10.md](./CIERRE_EFECTIVO_M10.md).

1486 backend aprobadas/10 omitidas; 941 frontend aprobadas/1 omitida. TypeScript, builds y lint del alcance aprobados. Tres pruebas reales de concurrencia y E2E persistente sobre3008/5178 aprobados.18 notificaciones financieras y PDF MinIO cotejados. No hubo dinero real. Detalle, fallos transitorios de automatización y límites en el cierre.

---

# Resultados M10 — cierre técnico 31/10/2026

## Consolidación posterior sin reinicios — 31/10/2026

Esta sección es el resultado vigente. Las secciones inferiores conservan las evidencias de implementación y activación anteriores. Ver también [ESTADO_FUNCIONAL_M10.md](ESTADO_FUNCIONAL_M10.md).

### Resultados finales de esta fase

| Verificación | Resultado |
|---|---|
| Backend unitario global | **1472 aprobadas, 10 omitidas**, 89 archivos aprobados y uno omitido; salida 0 |
| Frontend global | **938 aprobadas, 1 omitida**, 80 archivos; salida 0 |
| TypeScript/backend y build | Aprobados, sin activar otro proceso |
| TypeScript/frontend y build | Aprobados; advertencias de bundle/dependencias, sin errores |
| ESLint de los tres archivos principales M10 frontend | Aprobado, cero advertencias |
| ESLint global frontend | No aprobado: 29 errores y 7 advertencias en archivos preexistentes; log de consolidación conservado |
| git diff --check | Alcance aprobado; global conserva los espacios preexistentes de VentanillaPresencialPage:878 y :898 |
| Integración real SQL/HTTP/MinIO/Redis/navegador | Aprobada en transacción revertida; no movimiento bancario real |
| Compatibilidad con 3008 existente | 27 respuestas HTTP esperadas y navegador sin errores; no se reinició |
| Catálogo/esquema en READ ONLY | 19 procedimientos vigentes pendientes de tarifa validada; ocho tablas; cero duplicidades |
| Concurrencia de mutex | Segunda conexión no adquiere locks de intención/cuota retenidos por la primera |
| Dos commits financieros concurrentes | Pendiente; el ensayo de una transacción revertida no lo demuestra |

Logs: `scratch/evidencias-m10/consolidacion-backend-global.log`, `consolidacion-frontend-global.log`, `consolidacion-integracion.log`, `consolidacion-runtime.log` y `consolidacion-build-frontend.log`. Los resultados dirigidos están contenidos en los globales, no se suman otra vez.

### Matriz de los 33 casos solicitados

“Ensayo” significa SQL real revertido y documentos DEMO reales, sin abono/reembolso bancario ni hechos financieros persistentes.

| Caso | Evidencia / resultado |
|---|---|
| 1 Gratuito | Tarifa cero sintética validada; radicación autenticada y pública sin orden/voucher, ensayo aprobado |
| 2 Tarifa | Tarifa positiva sintética con proponente/validador distintos, ensayo aprobado |
| 3 Orden | Importe desde backend, referencia OP y misma orden ante reintento, aprobado |
| 4 Comprobante | PDF real, MinIO PUT/GET y SHA-256; referencia SQL de ensayo |
| 5 Verificación | REGISTRADO no equivale a VERIFICADO; otro actor revisa, aprobado |
| 6 Comprobante inválido | PDF inválido rechazado; sin éxito simulado |
| 7 Pago duplicado | Misma referencia en otra orden devuelve 409 |
| 8 Importe incorrecto | DTO rechaza importe manipulado en orden/pago; exceso de devolución rechazado |
| 9 Otro procedimiento | Radicación con orden de procedimiento distinto devuelve 403 |
| 10 Sin verificar | Radicación sin pago verificado devuelve 422 antes del CUT |
| 11 Después de verificar | M3 → PDF → CUT/cargo/expediente/historial y aplicación única, ensayo aprobado |
| 12 Trámite equivocado | Solicitud motivada y propia, ensayo aprobado |
| 13 Pago duplicado | Motivo PAGO_DUPLICADO admitido con evaluación, ensayo aprobado |
| 14 Documentación | Sustento inicial y anexo de subsanación conservados, aprobado |
| 15 Observada | Revisión, observación y anexo sin sobrescribir original, aprobado |
| 16 Aprobada | Actor distinto con permiso dedicado, aprobado |
| 17 Rechazada | Rechazo motivado y reserva excluida de saldo, aprobado |
| 18 Ejecución | Exige referencia/fecha/PDF y confirmación externa; fixture revertida. **No prueba transferencia real** |
| 19 Superior al saldo | Rechazado 422, sin sobredevolución |
| 20 Duplicada | Misma intención devuelve misma solicitud; segunda solicitud activa con saldo disponible rechazada 409 |
| 21 Constancia | PDF de registro descargado realmente por navegador tras cierre; tercero y solicitud sin ejecución reciben 404 |
| 22 Operación ajena | Ciudadano ajeno recibe 404 en orden/documento/constancia |
| 23 Aprobación ciudadana | 403, sin modificar la devolución |
| 24 Verificar sin permiso | Aprobador sin permiso de pagos recibe 403 |
| 25 Concurrentes | Exclusión de locks entre dos conexiones aprobada; dos commits financieros concurrentes pendientes |
| 26 Importe manipulado | 400 por DTO estricto; no se admite como precio definitivo |
| 27 Identidad manipulada | 400 por personaId adicional y validación M3; no se acepta identidad enviada por React |
| 28 M1/M10 | Login/JWT reales de cuentas fixture, roles del servidor, titularidad, ensayo aprobado |
| 29 M3/M10 | Pagado y gratuito; público con reto/sesión/PDF/cargo; ensayo aprobado |
| 30 M4/M10 | FK/aplicación a expediente común, historial propio y control de retención existente. No nueva derivación/archivo integral |
| 31 M5/M10 | PDF, almacenamiento, integridad y descarga autorizada reales |
| 32 M8/M10 | Outbox/Casilla reales en transacción, destinatario y despacho idempotentes; sin SMTP |
| 33 M9/M10 | Reporte financiero autorizado con agregación SQL real; ciudadano 403. No prueba recaudación real |

### Persistencia e aislamiento

No se aprobaron tarifas ni se registraron pagos/devoluciones persistentes ficticios. El único documento financiero persistente sigue siendo el PDF DEMO de integridad ya descrito en la entrega anterior. Su lectura desde el backend activo se volvió a verificar con SHA-256.

Los nuevos expedientes, CUT, tarifas, cuentas, asignaciones, pagos, devoluciones, constancias y notificaciones del harness se revierten mediante la transacción exterior. Los objetos DEMO MinIO de los ensayos se conservan; no se borraron. La sesión pública de prueba usa Redis real con un prefijo QA aleatorio, separado del productivo y TTL máximo de una hora, cerrado al finalizar. No se ejecutaron transferencias ni reembolsos reales.

Evidencia SQL antes/después de la integración: `scratch/evidencias-m10/consolidacion/integracion-rollback.json`. No presentar los CUT de esas capturas como radicaciones persistentes. El harness usa un puerto temporal, se cierra en finally y no reemplaza ni duplica el listener 3008. El frontend 5178 permanece existente; el navegador de ensayo reenvía API al harness explícitamente, sin respuestas mock.

Para comprobar el runtime se utiliza por separado `consolidacion-runtime.log`: APIs del proceso 3008 real, sin escrituras, sin crear sesión de login. Se verifica Argon2id, JWT efímero de prueba para cuenta DEMO existente y perfil; no se afirma un login positivo persistente en ese runtime.

La comparación contra la antigua activación detectó una sesión legítima adicional (660 → 661) antes de empezar; no se revirtió. Se tomó una nueva línea base `consolidacion-antes.json`, conservando la anterior. Las huellas de cierre están en `consolidacion-despues.json`; no se modificaron expedientes ni asignaciones de usuarios.

El cierre de solo lectura confirmó `sinCambiosDeDatos=true` en las 17 tablas comprobadas: 31 expedientes sigd_doc, 39 expedientes sigd_tra, 38 asientos, 12 cuentas, 21 personas, 661 sesiones, 17 asignaciones usuario/rol y las dos migraciones previas, con iguales huellas. M10 conserva un documento previo y cero tarifas, órdenes, pagos, aplicaciones, devoluciones, ejecuciones e historial persistentes. No se abrió una conexión a sigd_prueba.

Servicios al cierre: una sola escucha backend 127.0.0.1:3008, PID 18376 (padre 13756), y frontend 127.0.0.1:5178, PID 21664, sin reinicios. El stderr del backend activo sigue vacío. Las huellas de configuración privada y lanzador coinciden con la línea base; SIGD_DEMO_OMITIR_PAGO=true y MIGRATE_ON_BOOT=false se conservan. No se reescribieron scripts de migración ni el registro de versiones.

Git final: misma rama/HEAD, 294 entradas de estado corto frente a 292 iniciales. Las dos entradas adicionales corresponden a los nuevos archivos de pruebas frontend; otros archivos nuevos están dentro de directorios sin seguimiento ya existentes. No equivale a un conteo individual de todos los archivos. Evidencia: `consolidacion-git-final.txt`. No hubo commits/pushes ni pérdida de cambios anteriores.

### Fallos encontrados durante esta fase

- Un primer ajuste documental fue demasiado amplio y cambió el comportamiento de clasificación. Se acotó a la gratuidad validada y a la única mención explícitamente opcional de voucher, conservando las aserciones de documentos obligatorios, clasificación contradictoria y duplicados. La suite anterior vuelve a pasar.
- Una respuesta de catálogo incompleta en los dobles de prueba causó error de render. Se añadió validación defensiva: sin tarifas estructuradas, condición pendiente; nunca precio/gratuidad inventados.
- El caso público de pago utilizaba un doble con tarifa cero y descripción positiva. Se corrigió su tarifa fixture a 124.00 cuando paid=true; las aserciones de rechazo/ROLLBACK se conservan. La fuente económica pasa a ser M10.
- Una aserción nueva confundía SELECT FOR UPDATE con una modificación; se corrigió a comprobar sentencias UPDATE/DELETE reales. No se debilitó el control de inmutabilidad.
- Un intento E2E agotó una espera de respuesta bajo la ejecución simultánea de regresiones. No se determinó una causa de aplicación reproducible. Se instrumentaron estados HTTP/captura sin tokens; las repeticiones aisladas posteriores aprobaron subsanación y descarga. Persiste el riesgo de fluctuación del harness bajo carga.
- pg advierte consultas concurrentes sobre el único cliente del adaptador de ensayo; no se presenta ese adaptador como prueba de carga de producción. La aplicación utiliza Pool normal.

No se ocultaron ejecuciones fallidas como aprobadas. El lint global y los dos espacios finales preexistentes de Ventanilla permanecen como deuda de la entrega anterior; no se corrigieron archivos ajenos para obtener una cifra verde. `git diff --check` del alcance de esta consolidación pasa.

### Archivos de esta consolidación

- Backend: `tesoreria.rules.ts`, `tesoreria.schemas.ts`, `tesoreria.repository.ts`, `tesoreria.service.ts`, `tesoreria.router.ts`, `tesoreria.radicacion.ts` y nuevo `tesoreria.constancia.ts`, en el dominio existente.
- M3 backend: `admisibilidadPublica.ts`, `radicacionPublica.router.ts` y `radicacionVirtual.service.ts`.
- Frontend: `tesoreriaService.ts`, `TesoreriaPage.tsx`, `OrdenPagoTramite.tsx` y `StepDocumentos.tsx`. No se modificó HomePage, encabezado, fotografía ni tarjetas en esta fase.
- Pruebas: nueva `backend/tests/unit/domains/tesoreria/consolidacion.spec.ts`; fixture de `radicacion-publica.spec.ts`; ampliación de `TesoreriaPage.test.tsx`; nuevas `tesoreriaCondicion.test.ts` y `OrdenPagoTramite.test.tsx`.
- Scripts: extensión del harness `validar-m10-integracion.ts`, lectura `m10-consolidacion-lectura.cjs`, línea base con opción --consolidacion y generación de los documentos solicitados. Sin nuevos paquetes, esquemas ni tablas.

### Contratos compatibles y activación pendiente

Se añaden POST `/api/v1/tesoreria/ordenes/:id/subsanaciones` y GET `/api/v1/tesoreria/devoluciones/:id/constancia`. Capacidades añade flags opcionales; catálogo añade condición y requisitos; detalle añade anexos. Los campos/estados anteriores se conservan. No hubo DDL ni cambios destructivos. Los anexos usan el historial append-only existente; documento validado por servicio y protegido de eliminación ordinaria.

El frontend actualizado se probó contra el backend antiguo activo: nuevas acciones ocultas sin capacidades anunciadas, 27 respuestas esperadas y sin errores JavaScript. Las funcionalidades backend nuevas están probadas en el harness y compiladas, **pero no activadas en 3008**; se respeta la prohibición de reinicio. Su activación requiere una fase posterior autorizada.

Pendientes de operación institucional: fuente tarifaria, responsables autorizados, despliegue de esta consolidación, verificación persistente no ficticia y prueba completa de concurrencia/recuperación. Ver [PENDIENTES_INSTITUCIONALES_M10.md](PENDIENTES_INSTITUCIONALES_M10.md).

## Evidencias anteriores conservadas

Actualización posterior: backend permanente activado mediante reinicio autorizado a las 01:43 de Perú. Ver [ACTIVACION_M10_20261031.md](ACTIVACION_M10_20261031.md) para las 27 comprobaciones HTTP, capturas y comparación de datos sin escrituras. Las pruebas transaccionales y cifras unitarias descritas debajo corresponden al cierre anterior de implementación.

## Veredicto

**M10 está implementado, activado y validado internamente, pero NO está terminado como módulo financiero operativo.** Hay frontend, backend, migraciones aplicadas a demo, reglas financieras, integración M3/M8 y pruebas reales SQL/MinIO/navegador. El reinicio posterior autorizado ya activó el código en 3008. Faltan validar tarifas documentales, asignar responsables y demostrar un pago y una devolución reales persistentes. No se fabricaron transacciones para presentar un cierre falso.

## Clasificación de funcionalidades

| Funcionalidad | Estado y evidencia |
|---|---|
| Ocho tablas financieras, UUID, NUMERIC, FK e índices | IMPLEMENTADA Y VERIFICADA: migraciones 10/11 persistidas en demo y checksums cotejados |
| Roles y mínimo privilegio | IMPLEMENTADA Y VERIFICADA: cuatro roles/nueve permisos, sin nuevas asignaciones a usuarios; integración con sus permisos reales |
| Versiones tarifarias con documento y validador independiente | IMPLEMENTADA Y VERIFICADA en fixture revertida; tarifas oficiales BLOQUEADAS por fuente documental pendiente |
| Orden previa al CUT y reintentos | IMPLEMENTADA Y VERIFICADA con SQL real e interacción de navegador, revertidos; no orden financiera persistente ficticia |
| PDF y referencia en PostgreSQL | IMPLEMENTADA Y VERIFICADA: un documento DEMO persistente por API, MinIO PUT/GET y SHA-256 |
| Registro/revisión manual de pago | IMPLEMENTADA Y VERIFICADA en fixture; confirmación de abono real BLOQUEADA por operación autorizada inexistente |
| M3 pago verificado → PDF → radicación → cargo → historial | IMPLEMENTADA Y VERIFICADA internamente con navegador/SQL real en ROLLBACK; prueba integral persistente PENDIENTE |
| Devolución, saldo y segregación | IMPLEMENTADA Y VERIFICADA internamente; ejecución bancaria real BLOQUEADA por medio/operación autorizada pendiente |
| Historial, búsquedas, filtros, movimientos y reportes | IMPLEMENTADA Y VERIFICADA en prueba integrada y UI |
| Outbox y Casilla | IMPLEMENTADA Y VERIFICADA con despacho SQL real revertido e idempotencia; worker permanente con código nuevo PENDIENTE |
| SSE sin difusión de información financiera | IMPLEMENTADA Y VERIFICADA por prueba negativa unitaria |
| Escritorio y móvil M10 | IMPLEMENTADA Y VERIFICADA con Edge/Playwright; móvil 390×844 sin desbordamiento horizontal del cuerpo |
| Activación en puerto 3008 | IMPLEMENTADA Y VERIFICADA en intervención posterior autorizada: PID 18376, capacidades ciudadano 200; sin sesión 401; informe de activación enlazado arriba |
| Factura/boleta electrónica, pasarela y firma institucional | PENDIENTES, no simuladas ni presentadas como implementadas |
| Cierre/arqueo contable, subsanación versionada de vouchers | PENDIENTES de reglas y desarrollo adicional |

“Verificada internamente” no significa que hubo dinero real ni que el backend permanente ya esté actualizado.

## Pruebas ejecutadas

| Ejecución final | Resultado |
|---|---|
| Backend `npm.cmd run test:unit` | **1455 aprobadas, 10 omitidas**, 88 archivos aprobados y uno omitido; salida 0 |
| Frontend `npm.cmd test` | **927 aprobadas, 1 omitida**, 78 archivos; salida 0 |
| TypeScript backend `npm.cmd run typecheck` | Salida 0 |
| TypeScript frontend `npm.cmd run typecheck` | Salida 0 |
| Build backend | Salida 0 |
| Build producción frontend | Salida 0; advertencias de tamaño de bundle/importación y anotaciones de dependencia, sin errores |
| ESLint de TesoreriaPage, tesoreriaService y OrdenPagoTramite | Salida 0, sin advertencias |
| ESLint global frontend | **No aprobado**: 29 errores y 7 advertencias en archivos preexistentes; `scratch/evidencias-m10/lint-global.log` |
| Integración real HTTP/SQL/MinIO/UI | Salida 0; fixtures revertidas, servidor temporal cerrado |
| Persistencia documental por API | Salida 0; un PDF y su referencia persistentes, ningún pago inventado |
| Migraciones SQL 10/11, validación primero en ROLLBACK | Salida 0; luego aplicación explícita a demo y verificación de checksums |
| `git diff --check` del alcance M10 | Salida 0 con configuración normal de Git |
| `git diff --check` global | No aprobado por espacios preexistentes en VentanillaPresencialPage.tsx:878 y :898; no se alteró ese archivo para ocultarlos |

Los resultados unitarios dirigidos anteriores están incluidos en las cifras globales y no se suman otra vez. Las suites DB históricas no se ejecutaron indiscriminadamente. No se declara prueba de carga ni de carreras con conexiones independientes: el adaptador de integración usa un cliente transaccional y pg emite una advertencia por consultas concurrentes en ese adaptador. La aplicación usa el Pool normal; esta advertencia no es evidencia de seguridad frente a carga multiconexión.

## Errores encontrados y corregidos durante la verificación

- El SQL de actualización reutilizaba un parámetro entre tipos text/varchar y falló 42P08 en PostgreSQL real: se añadieron casts explícitos, manteniendo los importes y controles.
- La primera adaptación móvil dejaba desbordamiento por el encabezado de ancho de escritorio: se limitó el ajuste a `/tesoreria`, manteniendo el encabezado existente en un contenedor con desplazamiento propio.
- El selector de orden interfería con componentes sin Router/procedimiento y un selector de pruebas previo: se muestra solo cuando corresponde y conserva navegación real sin exigir contexto a componentes aislados.
- El mock de TesoreriaPage necesitó preservar la función real de claves de intención añadida; se corrigió el doble, no las aserciones de negocio.
- Una prueba anterior de consulta pública esperaba acceso con CUT solamente, contrario al contrato protegido actual: se corrigió su fixture y se añadieron rechazos 404 sin capacidad o con capacidad incorrecta, manteniendo el positivo 200 con capacidad válida. Archivo `ventanilla-cargo-acceso.spec.ts`. No se abrió el endpoint públicamente para hacerla pasar.
- Un diagnóstico final comparó huellas agregadas con distinto ORDER BY: se corrigió a `id_usuario_rol`, idéntico al inicial. La comparación final aprobó sin escribir registros.
- PowerShell bloqueó npm.ps1: se utilizó npm.cmd. Esbuild no pudo leer configuración dentro del aislamiento: se repitió la misma suite fuera del aislamiento autorizado. No se contabilizaron esos arranques fallidos como pruebas aprobadas.

## Persistencia documental comprobada

Documento `09142428-031a-47da-9809-0168ecb3f6c1`, archivo `DEMO-M10-INTEGRIDAD-SIN-VALOR-FINANCIERO.pdf`, 1115 bytes, una página.

- Bucket: `sigd-sandbox-e2e`.
- Clave: `tesoreria/2026/5afae4fc-2b22-4806-b40e-4629b248a992.pdf`.
- SHA-256: `7363b6be27ed7d46c12e8d2b22070b690dc5eb2bb72279b8e7bdacf6b27fe660`.
- Fecha persistida: 2026-10-31T05:55:41.809Z (00:55:41 en Perú).
- Carga y lectura reales; anónimo 401. No es voucher bancario ni constancia de reembolso.

Evidencia: `scratch/evidencias-m10/persistencia-documental.json`. Autenticación contra 3008 real, router M10 actualizado en servidor de prueba efímero con pool real y commits. No se afirma que M10 se activó en 3008.

## Aislamiento e integridad final

`scratch/evidencias-m10/cierre-readonly.json` comprobó en conexión efectiva de solo lectura:

- Base `sigd_jacobo_demo`, usuario `sigd_jacobo_user`, servidor `172.20.0.2:5432`, puerto local 5433. Ningún acceso a sigd_prueba.
- `sigd_doc.expediente`: 31 registros, huella `c80de89eff0a0457b9e6cf4cbba03891`, igual al inicio de M10.
- `sigd_tra.expediente`: 39 registros, huella `eafda2b88b695c970ab607a3a4006aff`, igual al inicio.
- Asignaciones usuario/rol: 17, huella `85950ce39814d4ebd4074e20b18c610a`, sin cambios.
- M10: 1 documento, 0 tarifas, 0 órdenes, 0 pagos, 0 devoluciones y 0 ejecuciones persistentes.
- Checksums de ambas migraciones aplicadas coinciden con sus archivos.
- /health 200 y /ready 200. Endpoint M10 404 por backend anterior; no se ocultó como prueba aprobada.

Los CUT de las capturas (EXP-2026-000040/000041) corresponden a fixtures **revertidas**, no a radicaciones persistentes entregadas. Los objetos de ensayo MinIO se conservaron sin limpieza destructiva. Las pruebas de triggers DELETE/TRUNCATE rechazaron las operaciones con SQLSTATE 23001 dentro de savepoints; no se eliminaron registros históricos.

## Evidencia visual y reproducibilidad

Scripts inspeccionados: `scratch/validar-m10-integracion.ts`, `scratch/validar-m10-persistencia-documental.ts`, `scratch/m10-db.cjs`, `scratch/m10-roles-db.cjs`, `scratch/m10-verificar-cierre.cjs`. La integración depende de la configuración privada existente, no imprime secretos y cierra cliente, navegador y servidor en finally. Reejecutarla crea objetos DEMO MinIO; no es un diagnóstico sin efectos.

Capturas reales del navegador en `scratch/evidencias-m10/`:

- `ciudadano-pagos.png`, `ciudadano-devoluciones.png`.
- `m10-m3-cargo-fixture-revertida.png`.
- `devolucion-ui-fixture-revertida.png`.
- `tesoreria-reportes.png`, `tesoreria-movil.png`.

La UI utilizó Vite 5178 existente y APIs reales de un servidor temporal conectado a la transacción de prueba. No se sustituyeron respuestas por mocks. Se inspeccionaron las capturas de devolución y móvil; muestran importes de fixture, estados e historial y conservan la identidad institucional. No se presentan como movimientos financieros reales.

## Archivos creados y modificados por M10

Nuevos:

- `backend/src/domains/tesoreria/tesoreria.rules.ts`, `tesoreria.schemas.ts`, `tesoreria.repository.ts`, `tesoreria.service.ts`, `tesoreria.router.ts`, `tesoreria.radicacion.ts`.
- `backend/migraciones/10_sigd_tes.sql`, `11_sigd_tes_roles.sql` y reversiones homónimas `.down.sql` en `backend/migraciones_reversion/`.
- `backend/tests/unit/domains/tesoreria/tesoreria.spec.ts`, `notificacion-financiera.spec.ts`.
- `frontend/src/pages/tesoreria/TesoreriaPage.tsx`, `frontend/src/services/tesoreriaService.ts`, `frontend/src/components/tramite/OrdenPagoTramite.tsx`.
- `frontend/tests/unit/pages/TesoreriaPage.test.tsx`, `frontend/tests/unit/api/tesoreriaClaves.test.ts`.
- Scripts/evidencias M10 en scratch y los diez documentos de esta carpeta, más AUDITORIA_PREVIA_M10_TESORERIA.md.

Integración sobre archivos preexistentes, conservando sus cambios anteriores:

- `backend/src/app.ts`: montaje del dominio.
- `backend/src/audit/despachador-notificaciones.ts`: Casilla financiera validada y SSE sin PII.
- `backend/src/domains/tramicore/tramites.schemas.ts`, `radicacionVirtual.service.ts`: campo opcional compatible, control y aplicación atómica.
- `backend/src/domains/tramicore/radicacionPublica.router.ts`: exportación del validador PDF existente para reutilizarlo.
- `frontend/src/routes/AppRouter.tsx`: ruta protegida M10.
- `frontend/src/pages/HomePage.tsx`: tarjeta autenticada M10 y visibilidad según permisos, sin tocar hero público.
- `frontend/src/layouts/MainLayout.tsx`: adaptación limitada a la nueva ruta.
- `frontend/src/pages/tramite/ConsultaPublicaPage.tsx`: enlace ciudadano a Mis pagos.
- `frontend/src/types/tramiteWizardState.ts`, `components/tramite/WizardSteps/StepDocumentos.tsx`, `StepConfirmacion.tsx`: orden asociada al procedimiento, limpieza al cambiarlo y envío compatible.
- Fixtures y pruebas TramiCore: `radicacion-tupa-ddl.spec.ts`, `radicacion-publica.spec.ts` y `ventanilla-cargo-acceso.spec.ts`.

## Servicios, Git y siguiente paso

Una sola escucha en 127.0.0.1:3008, PID 12908; frontend 127.0.0.1:5178, PID 21664. No se reiniciaron ni duplicaron servicios. Se conservó MIGRATE_ON_BOOT=false y el estado actual de SIGD_SAFE_BOOT; no hubo cambios Docker ni SMTP.

Rama y HEAD no cambiaron. Git pasó de 282 a 292 entradas de estado corto (directorios sin seguimiento agregados; no es un conteo de archivos individuales). No hubo commits/pushes ni eliminación de trabajo previo. El estado no está limpio y no debe tratarse como una instalación recién creada.

Actualización del siguiente paso: la activación controlada de 3008 ya se realizó con autorización expresa, sin nuevas migraciones ni datos. Corresponde a la institución autorizar responsables por M2 y validar tarifas con la fuente documental. Solo después ejecutar el ciclo financiero persistente con una operación bancaria real autorizada. Sin esa evidencia, el criterio final solicitado permanece pendiente.
