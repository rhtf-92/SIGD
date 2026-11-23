# Mesa de Partes Virtual pública — 30 de octubre de 2026

## Resultado y límite de aceptación

Se implementó el canal público sin JWT ni cuenta institucional, integrado al wizard y al servicio transaccional existente. Se comprobó en navegador real el ingreso desde la portada, sin redirección al login. No se modificó el diseño de HomePage ni el encabezado.

**La radicación pública oficial de extremo a extremo continúa pendiente.** El catálogo devuelve 19 procedimientos vigentes, pero ninguno acredita actualmente condiciones económicas que este canal pueda satisfacer: requieren pago o falta confirmar su condición. No existe un verificador institucional de pagos integrado. En particular, SUZ26-035 indica S/ 124.00; un comprobante técnicamente opcional no convierte el procedimiento en gratuito. El canal devuelve 422 `PUBLIC_PAYMENT_UNAVAILABLE`, antes de almacenar archivos o generar CUT. No se inventaron vouchers, pagos ni gratuidades.

Hace falta definir e integrar el mecanismo institucional válido de comprobación del pago. La consulta sobre ese mecanismo quedó planteada al propietario. Los procedimientos expresamente gratuitos y con fuente verificada pueden utilizar el flujo implementado; su comportamiento se probó con fixtures identificadas como pruebas, sin modificar el catálogo oficial.

## Git y conservación del trabajo

- Rama inicial y final: `B_JACOBO`.
- HEAD inicial y final: `bf30d8a0c85e266a86381fb10bf3740a8451c032`.
- Inventario inicial: 251 entradas de `git status --short`, con modificaciones y archivos sin seguimiento preexistentes.
- Inventario al cierre técnico, antes de agregar este informe: 264 entradas. `docs/`, `scratch/` y `backend/scripts/` ya eran directorios sin seguimiento, por lo que el conteo de entradas no equivale al número de archivos nuevos.
- Se inspeccionaron y conservaron los cambios anteriores de autenticación, permisos, clasificación documental, borradores y persistencia. La migración 08 de reutilización de hashes documentales era preexistente a esta intervención.
- Sin cambios de rama, reset, clean, restore, stash, commits ni pushes.

## Archivos de esta intervención

### Backend: nuevos

| Archivo | Función |
|---|---|
| `backend/src/domains/tramicore/admisibilidadPublica.ts` | Condición económica documentada; bloqueo ante pago no verificable o información insuficiente. |
| `backend/src/domains/tramicore/radicacionPublica.schemas.ts` | Contrato público aditivo; nombres separados, DNI con ceros iniciales, declaraciones y límites documentales. |
| `backend/src/domains/tramicore/publicSubmission.store.ts` | Capacidades efímeras, retos y cuotas compartidas mediante Redis; falla cerrada si no está disponible. |
| `backend/src/domains/tramicore/radicacionPublica.router.ts` | Reto, sesión anónima, catálogo, carga PDF, radicación y recuperación del cargo. |
| `backend/migraciones/09_radicacion_publica_idempotencia.sql` | Registro transaccional durable de idempotencia, sin crear usuarios genéricos. |
| `backend/tests/unit/domains/tramicore/radicacion-publica.spec.ts` | Pruebas de contrato, autorización, archivos, identidad, transacción e idempotencia. |
| `backend/scripts/verificar-radicacion-publica.cjs` | Verificación de conexión, migración explícita y prueba de bloqueo transaccional con rollback. Por defecto, solo lectura. |
| `backend/scripts/probar-http-mpv-publica.cjs` | Pruebas HTTP negativas contra el backend real, sin radicaciones ni cargas exitosas. |

### Backend: ediciones localizadas sobre archivos previamente modificados

- `backend/src/app.ts`: montaje aditivo de `/api/v1/tramites/publico`; no se hizo público el router privado.
- `backend/src/middleware/cors.middleware.ts`: reutilización de la política de orígenes y autorización de cabeceras públicas específicas.
- `backend/src/domains/tramicore/radicacionVirtual.service.ts`: reutilización de la misma transacción, requisitos, CUT, expediente, adjuntos, foliación y asiento. Nueva entrada pública con identidad declarada, reserva idempotente y auditoría transaccional. La entrada autenticada conserva su validación de titularidad.
- `backend/src/domains/tramicore/tramites.controller.ts`: las nuevas radicaciones públicas requieren la capacidad de su constancia para consultar por CUT; conocer un CUT no basta.

### Frontend

- Nuevo `frontend/src/services/radicacionPublicaService.ts`: cliente sin cookies ni JWT, reto antiautomatización, sesión efímera, carga binaria, envío y acceso a la constancia.
- Nuevo `frontend/tests/unit/api/radicacionPublicaService.test.ts`: tres pruebas del cliente público.
- `frontend/src/hooks/usePresignedUpload.ts`: carga pública controlada por el servidor; conserva el mecanismo autenticado existente.
- `frontend/src/hooks/useTramiteWizardReducer.ts`: borrador anónimo aislado por pestaña y procedimiento, limpieza al finalizar o iniciar otro formulario.
- `frontend/src/components/tramite/WizardSteps/StepIdentificacion.tsx`: formulario sin cuenta e información explícita sobre identidad declarada.
- `frontend/src/components/tramite/WizardSteps/StepDocumentos.tsx`: disponibilidad pública del catálogo y bloqueo comprensible de condiciones indispensables no satisfechas.
- `frontend/src/components/tramite/WizardSteps/StepDeclaracionJurada.tsx`: mantiene declaraciones obligatorias; no promete Casilla a quien no tiene cuenta.
- `frontend/src/components/tramite/WizardSteps/StepConfirmacion.tsx`: selección del canal público o autenticado, errores, cargo y enlace privado de seguimiento.
- `frontend/src/components/tramite/TramiteWizard.tsx` y `CargoDigitalModal.tsx`: cargo público sin enlace obligatorio a Casilla privada.
- `frontend/src/pages/tramite/ConsultaPublicaPage.tsx`: envía la capacidad de la constancia cuando corresponde.
- `frontend/tests/unit/components/TramiteWizard.test.tsx`: conserva las comprobaciones de integridad de la respuesta; cubre el recorrido público con dobles controlados.
- `scratch/verificar-mpv-publica-browser.cjs`: comprobación del navegador real con Edge headless y CDP; cierra su propio proceso en `finally`.

## Contratos y persistencia

El endpoint autenticado y sus DTO no se sustituyeron. Se añadió un contrato público estricto con los campos necesarios para identificar al administrado sin una cuenta; rechaza campos de usuario inyectados. Rutas añadidas bajo `/api/v1/tramites/publico`: `POST /reto`, `POST /sesion`, `GET /procedimientos`, `POST /carga`, `POST /radicar`, `GET /cargo`.

No se encontró un registro durable existente adecuado para idempotencia anónima. La migración 09 crea únicamente `sigd_tra.radicacion_publica`: hash de capacidad, hash del contenido, declaración de identidad, FK al expediente existente y respuesta. La reserva y la respuesta se guardan en la misma transacción que el CUT. Reintentar la misma solicitud devuelve su respuesta; cambiar el contenido de una solicitud ya consumida genera 409. Una nueva solicitud obtiene otra capacidad.

**Hubo DDL en demostración:** se aplicó explícitamente solo la migración 09 después de verificar configuración y conexión efectiva. No se activaron migraciones automáticas ni se modificaron tablas canónicas existentes. Este informe no declara ausencia de cambios de esquema.

Destino comprobado: configuración local `127.0.0.1:5433/sigd_jacobo_demo`; conexión efectiva `current_database()=sigd_jacobo_demo`, `current_user=sigd_jacobo_user`, servidor `172.20.0.2:5432`. Secretos leídos desde la configuración local externa, sin publicarlos.

La persona natural se resuelve mediante su clave documental existente; no se asigna una cuenta demo ni una cuenta genérica. No se actualizan los datos de personas existentes. Si su identidad nominal contradice el registro existente, se rechaza. La recepción queda identificada como `DECLARADA_PENDIENTE_VERIFICACION_INSTITUCIONAL`: no equivale a verificación biométrica ni a aprobación del trámite. La representación de personas jurídicas/RUC permanece bloqueada en el nuevo canal hasta definir su comprobación institucional; el flujo autenticado existente no se sustituyó.

## Seguridad aplicada y alcance

- Capacidad aleatoria de 256 bits por formulario, almacenada como SHA-256; no es un usuario institucional. No otorga acceso a bandejas ni acciones privadas.
- Sin identidad ambiental de cookies y sin JWT en las llamadas públicas. Cabecera personalizada y comprobación de origen/Sec-Fetch-Site para impedir envíos cruzados del navegador.
- Reto de prueba de trabajo de duración limitada y consumo único; cuotas compartidas por IP, identidad y sesión. Esto reduce abuso; no constituye protección absoluta frente a atacantes distribuidos.
- Cinco PDF como máximo, 20 MiB por archivo y 50 MiB por sesión. Lectura estructural con pdf-lib, rechazo de cifrado, acciones activas y adjuntos incrustados; verificación posterior de bytes/hash mediante los servicios existentes. No se declara antivirus ni certificación PDF/A.
- El servidor genera la clave S3 y calcula el hash. Cada archivo debe pertenecer a la capacidad y al procedimiento seleccionados; se rechazan referencias ajenas o metadatos cambiados.
- La identidad declarada nunca se convierte en actor institucional. Auditoría mediante el repositorio existente y transacción compartida.
- La constancia utiliza una capacidad privada en el fragmento del QR, no en parámetros enviados automáticamente al servidor; quien posea ese enlace puede consultar esa constancia. Debe conservarse como enlace privado.
- La consulta pública histórica por CUT conserva su política anterior. La protección adicional por capacidad afecta a las nuevas radicaciones de este canal; no debe interpretarse como una reforma de privacidad de todos los expedientes históricos.

## Pruebas ejecutadas

| Verificación | Resultado | Alcance |
|---|---|---|
| Backend, radicación pública | 17 aprobadas | Unitarias/HTTP en proceso con PostgreSQL y S3 simulados. |
| Backend, regresión radicación TUPA/DDL | 53 aprobadas | Unitarias, repetidas al cierre junto a las 17 anteriores: 70/70. |
| Backend, rutas/RBAC/RutaDoc/ventanilla | 178 aprobadas | Regresión aislada: app-routes 128, RBAC persistido 20, titularidad RutaDoc 14, acceso ventanilla 16. |
| Frontend: wizard, borradores, cliente público, portada y rutas | 99 aprobadas, 1 omitida | Cinco archivos de pruebas; dobles controlados. |
| Cliente público frontend, repetición final | 3 aprobadas | Incluidas en el grupo anterior, no sumarlas como cobertura adicional. |
| Typecheck backend | Aprobado, salida 0 | `npm.cmd run typecheck`. |
| Build frontend y typecheck | Aprobado, salida 0 | `npm.cmd run build` ejecuta `tsc --noEmit && vite build`. Advertencias de chunks grandes, importación mixta y comentarios de Zod; sin error de compilación. |
| Concurrencia PostgreSQL real | Aprobada | Dos conexiones: segundo INSERT espera; rollback del primero habilita reintento; rollback final deja cero fixtures. Sin CUT ni expediente. |
| HTTP real sin JWT | Aprobadas 12 comprobaciones | Catálogo 200, reto 200, sesión 201, replay/origen/referencias ajenas 403, cargo ajeno 404, pago 422, rutas internas 401. |
| Navegador real | Acceso público y bloqueo económico comprobados | Click desde la portada, formulario visible, paso 2 con SUZ26-035 bloqueado antes de cargar documentos. Capturas de escritorio y móvil. |
| E2E anónimo exitoso con PostgreSQL y MinIO | **Pendiente/bloqueado** | Ningún procedimiento oficial puede satisfacer actualmente la comprobación de pago del nuevo canal. No se fabricó una gratuidad. |
| `git diff --check` sobre archivos intervenidos | Aprobado, salida 0 | Se preservó la configuración de finales de línea; no se reformatearon archivos ajenos. |
| `git diff --check` global | Dos defectos preexistentes | Espacios finales en `frontend/src/pages/tramite/VentanillaPresencialPage.tsx`, líneas 878 y 898. No se modificaron para ocultar el resultado. |

Una ejecución inicial del test del wizard falló porque la fixture devolvía un total de folios distinto al formulario. Se corrigió únicamente la respuesta de prueba, conservando la validación estricta, y se repitió el grupo con éxito. Las primeras ejecuciones de Vite/Vitest dentro del sandbox no pudieron leer sus configuraciones; se repitieron fuera de esa restricción y terminaron con salida 0. La primera captura del formulario mostraba el indicador inicial de carga; se corrigió la espera del script y se inspeccionó la nueva captura real del formulario.

No se ejecutó la suite global completa. Los resultados anteriores no acreditan una radicación real ni el funcionamiento integral de los nueve módulos.

## Evidencias y comandos reproducibles

- `scratch/evidencias-mpv-publica/01-formulario-publico-1448x1086.png`: formulario real sin cuenta, inspeccionado visualmente.
- `scratch/evidencias-mpv-publica/02-condicion-pago-1448x1086.png`: bloqueo de SUZ26-035, inspeccionado visualmente.
- `scratch/evidencias-mpv-publica/03-formulario-publico-390x844.png`: captura móvil. Conserva el escalado general preexistente; no se rediseñó la responsividad global.
- `scratch/evidencias-mpv-publica/http-publico.json`: estados HTTP y correlation IDs sin tokens.

Desde backend:

```powershell
npm.cmd run typecheck
npm.cmd run test:unit -- tests/unit/domains/tramicore/radicacion-publica.spec.ts tests/unit/domains/tramicore/radicacion-tupa-ddl.spec.ts
node scripts/verificar-radicacion-publica.cjs
node scripts/probar-http-mpv-publica.cjs
```

Desde frontend:

```powershell
npm.cmd run build
npm.cmd test -- tests/unit/api/radicacionPublicaService.test.ts
```

No repetir el modo `--aplicar-esquema` para una mera comprobación. El modo `--probar-bloqueo` realiza escrituras transitorias con rollback, exclusivamente en la tabla nueva de demostración; no es una consulta de solo lectura.

## Integridad y entorno final

- Se mantienen 24 expedientes existentes. La comparación agregada de identificadores y datos del expediente no cambió durante la aplicación de la migración; verificación final: `EXPEDIENTES_PREVIOS_INTACTOS=true`.
- Nuevas radicaciones públicas persistidas: **0**. Nuevos CUT: **0**. Objetos cargados por la prueba HTTP: **0**. Personas o cuentas creadas por pruebas reales: **0**.
- Sí hubo estado efímero de retos, sesiones y cuotas en Redis; no confundirlo con ausencia absoluta de escrituras.
- `sigd_prueba` no se consultó ni se modificó en esta intervención.
- Frontend activo en 5178, PID 19136. Backend activo en 3008, PID 10032. Se recargó una sola instancia backend identificada para activar el nuevo router; no se duplicaron instancias ni se reinició Vite/Docker.
- El registro local histórico `demo-processes.json` tenía PID antiguos; se verificaron los procesos reales y no se utilizó ese registro para terminar servicios. Su sincronización queda pendiente fuera del alcance funcional.

## Dependencias pendientes

1. Comprobación institucional del pago y fuente tarifaria aplicable; mientras no exista, no habilitar procedimientos tarifados ni interpretar comprobante opcional como gratuidad.
2. E2E con una condición económica legítima, persona sin cuenta, PDF apropiados, CUT, expediente, objetos en MinIO y cargo visible. Debe repetirse también con una segunda solicitud independiente y reintento de la primera.
3. Validación institucional de representación jurídica antes de abrir RUC en el canal público.
4. Política segura para limpiar cargas abandonadas sin borrar documentos de expedientes ya confirmados. Las cuotas limitan su volumen, pero no sustituyen un ciclo de retención.
5. Revisión operativa de cuotas para redes compartidas, configuración explícita y mínimo privilegio de S3, retención de datos declarados y distribución del enlace privado de constancia antes de exposición productiva.

**Conclusión:** acceso público y base técnica implementados y probados en los alcances indicados; aceptación integral pendiente por pago y E2E real. No se declara que los 19 procedimientos puedan radicarse públicamente en el estado actual.
