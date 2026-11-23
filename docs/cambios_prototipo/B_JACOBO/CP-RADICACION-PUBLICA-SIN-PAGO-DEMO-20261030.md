# Radicación pública demostrativa sin verificación de pago

Fecha: 30/10/2026. Rama: `B_JACOBO`.

## Resultado real

Se completó una radicación desde la portada y los cuatro pasos del formulario React real, utilizando Edge headless, sin login, sin cuenta y sin cabecera Authorization. No se insertó manualmente un expediente.

| Evidencia | Resultado |
|---|---|
| Procedimiento | SUZ26-035 — Certificado de Estudios Superiores (6 semestres) |
| CUT | **EXP-2026-000033** |
| Expediente | **1119e700-83fd-4964-9e51-fc93de089c90** |
| Respuesta HTTP | 201 |
| Estado documental | REGISTRADO |
| Estado económico | **NO_VERIFICADO** |
| Modalidad persistida | RADICACIÓN DEMOSTRATIVA SIN VERIFICACIÓN DE PAGO |
| Fecha real de recepción | 2026-10-30T23:14:52.326Z |
| Fecha legal calculada por el mecanismo existente | 2026-11-02T13:00:00.000Z; recepción después del corte |
| Solicitante | Persona sintética DEMO, sin cuenta institucional; no se utilizó ciudadano.demo |
| Documento | Solicitud demostrativa FUT, PDF de una página; no es voucher ni certificado académico |
| Asiento | 75304489-7cc0-4e5b-b27e-ddd2ca03fd70, número 10032, MESA_VIRTUAL, no anulado |
| Auditoría | 2fc51fc1-b904-461d-b758-b6171f53701a, actor institucional nulo, NO_VERIFICADO |
| Reintento idéntico | HTTP 201 con el mismo CUT y expediente; no se generó un duplicado |

La captura real de la constancia fue inspeccionada visualmente. Muestra el CUT, el aviso de demostración y el pago NO VERIFICADO. La recepción no se presenta como prueba de pago ni de verificación académica o de identidad externa.

## Configuración temporal y aislamiento

La configuración activa es `SIGD_DEMO_OMITIR_PAGO=true`, exclusivamente en el entorno del proceso backend de demostración. No se modificó el archivo externo de secretos, Docker Compose ni las variables del frontend. Un reinicio mediante el arranque habitual, sin esa variable, vuelve a cerrar la excepción; para reactivarla debe configurarse expresamente en el proceso de demostración.

El backend no confía en un campo enviado por el cliente: exige la variable exacta `true`, rechaza la excepción en `NODE_ENV=production` y consulta `current_database()` sobre la conexión efectiva. Solo `sigd_jacobo_demo` permite la omisión. Se comprueba tanto al consultar disponibilidad/cargar documentos como dentro de la transacción de radicación.

Antes de activar y antes de enviar se comprobó:

- Destino configurado: `127.0.0.1:5433/sigd_jacobo_demo`.
- Base efectiva: `sigd_jacobo_demo`.
- Usuario efectivo: `sigd_jacobo_user`.
- Dirección/puerto PostgreSQL efectivos: `172.20.0.2:5432`, dentro del contenedor.
- Rama efectiva: `B_JACOBO`.

`sigd_prueba` no se consultó ni se modificó. No hubo DDL ni nuevas migraciones en esta intervención. Se reutilizó la tabla de idempotencia de la fase pública anterior y su JSONB `datos_declarados` para guardar modalidad y estado económico.

## Implementación

### Control del pago

Nuevo `backend/src/domains/tramicore/demoPago.ts`:

- Verifica bandera y base efectiva; no acepta una excepción decidida por el frontend.
- Define una marca única de radicación demostrativa.
- Comprueba el bloqueo económico persistido, independientemente de que la bandera siga activa.

`admisibilidadPublica.ts` permite temporalmente la recepción cuando el backend comprobó el modo demo. Sin ese modo conserva el bloqueo anterior. No interpreta la excepción como gratuidad oficial.

`radicacionPublica.router.ts` comunica la modalidad mediante el catálogo público y verifica otra vez la condición antes de recibir un PDF. Las capacidades, reto, cuotas, límites y validación estructural de archivos no se desactivaron.

`radicacionVirtual.service.ts` comprueba la excepción en la misma conexión transaccional, conserva idempotencia, clasificación, persona, CUT, expediente, adjuntos, folios y asiento. Añade `estado_economico=NO_VERIFICADO` y la modalidad al JSON de declaración y a la auditoría. El mensaje de recepción contiene la misma advertencia. No registra pago, transacción bancaria, comprobante ni estado PAGADO.

### Documentación de SUZ26-035

La consulta real encontró una única clasificación configurada: COMPROBANTE_PAGO opcional. El catálogo conserva S/124.00 y la mención original de comprobante; no se actualizaron tarifas ni asociaciones documentales.

Para la recepción demostrativa se excluye el comprobante de la lista exigible en tiempo de ejecución, y se rechaza un adjunto clasificado expresamente como comprobante. Cuando el único tipo configurado era pago, la solicitud se clasifica como **FUT**, resuelto por su código canónico vigente y comprobando que exista exactamente uno. No se utiliza UUID arbitrario, LIMIT 1, ni se registra el PDF como un voucher ficticio. Si falta esa clasificación canónica o existen otros defectos documentales, el servicio falla de forma segura.

El frontend presenta esta excepción en Documentos, Confirmación y Constancia. El PDF utilizado contiene explícitamente datos sintéticos, solicitud DEMO sin valor oficial, ausencia de notas/certificaciones y pago no verificado. No se fabricaron antecedentes académicos.

### Restricción de etapas posteriores

Se añadió el control económico compartido a derivación, recepción interna, atención y archivado de RutaDoc, y a proyección/persistencia de resoluciones. Estos expedientes no pueden recorrer esas etapas mientras mantengan el marcador NO_VERIFICADO. La consulta y la constancia siguen disponibles con su capacidad privada.

No se implementó un botón ni un endpoint para convertirlos en pagados o levantar el bloqueo. La reconciliación posterior requerirá el mecanismo institucional de verificación y su auditoría. Los expedientes anteriores, sin esta marca, mantienen las reglas existentes.

El bloqueo fue probado con PostgreSQL real mediante lectura de la marca persistida, obteniendo 422 `DEMO_PAYMENT_PENDING` incluso con la bandera desactivada en el proceso del verificador. Los servicios de transición y resolución se probaron además con dobles controlados. No se ejecutó una actuación administrativa autenticada real ni se avanzó el expediente para demostrar el bloqueo.

## Archivos de código y pruebas intervenidos

| Archivo | Cambio |
|---|---|
| `backend/src/domains/tramicore/demoPago.ts` | Nuevo control de entorno efectivo y bloqueo económico. |
| `backend/src/domains/tramicore/admisibilidadPublica.ts` | Excepción temporal comprobada, sin cambiar la tarifa. |
| `backend/src/domains/tramicore/radicacionPublica.router.ts` | Aplicación del control y comunicación de modalidad. |
| `backend/src/domains/tramicore/radicacionVirtual.service.ts` | Marca transaccional, auditoría, mensaje de cargo y clasificación FUT demostrativa. |
| `backend/src/domains/rutadoc/derivaciones.service.ts` | Bloqueo económico en las cuatro actuaciones, conservando autenticación y validaciones previas. |
| `backend/src/domains/docucore/resoluciones.service.ts` | Evita proyección y persistencia resolutiva de estos expedientes. |
| `frontend/src/services/radicacionPublicaService.ts` | Tipado del indicador de excepción informado por el servidor. |
| `frontend/src/components/tramite/WizardSteps/StepDocumentos.tsx` | Aviso y clasificación sin voucher, solo bajo modo demo informado por backend. |
| `frontend/src/components/tramite/WizardSteps/StepConfirmacion.tsx` | Aviso antes del envío y conservación del mensaje del cargo. |
| `frontend/src/components/tramite/CargoDigitalModal.tsx` | Aviso económico visible e imprimible. |
| `frontend/src/types/tramiteWizardState.ts` | Campo opcional para conservar el mensaje recibido; no cambia el contrato backend de respuesta. |
| `backend/tests/unit/domains/tramicore/demo-pago.spec.ts` | Nuevo conjunto de ocho pruebas del control efectivo y bloqueo. |
| `backend/tests/unit/domains/tramicore/radicacion-publica.spec.ts` | Dos pruebas adicionales: recepción sin voucher y rechazo de comprobante ficticio. |
| `backend/tests/unit/domains/rutadoc/derivaciones.spec.ts` | Aislamiento explícito del nuevo colaborador para conservar las fixtures ordenadas de FSM. |
| `backend/tests/unit/domains/rutadoc/archivo-idempotencia.spec.ts` | Aislamiento explícito del mismo colaborador, conservando las aserciones de archivo/idempotencia. |
| `backend/tests/unit/domains/docucore/resoluciones.spec.ts` | Aislamiento explícito del nuevo colaborador; sus controles reales se prueban en demo-pago. |
| `frontend/tests/unit/components/TramiteWizard.test.tsx` | Prueba adicional de aviso económico, FUT y ausencia de opción voucher. |

Scripts añadidos en `scratch/`, con límites de espera y cierre de conexiones en `finally`:

- `inspeccionar-pago-demo.cjs`: diagnóstico de solo lectura de identidad y requisitos reales.
- `activar-pago-demo.cjs`: verificación, huella inicial y recarga explícita del único backend identificado, con variable solo del proceso. No envía solicitudes.
- `radicar-publico-demo-browser.cjs`: formulario real, PDF sintético, captura, POST real y reintento idéntico. Se detiene si ya existe la solicitud identificada, para no repetirla.
- `verificar-persistencia-pago-demo.cjs`: lectura PostgreSQL/S3, huella anterior, duplicados, cuenta inexistente, auditoría y bloqueo económico. No crea expedientes.

La portada, HomePage, el encabezado y los demás estilos institucionales no fueron editados durante esta intervención. No se cambió autenticación, JWT, RBAC, rutas existentes ni tablas del TUPA.

## Pruebas y resultados finales

| Prueba | Resultado |
|---|---|
| Nueve suites backend relacionadas | **291 aprobadas**, salida 0 |
| Desglose backend | Pública 19; demo-pago 8; radicación/TUPA 53; derivaciones 31; resoluciones 21; recepción HTTP 6; archivo 5; rutas 128; RBAC 20 |
| Wizard, borradores y servicio público frontend | **69 aprobadas, 1 omitida**, tres archivos, salida 0 |
| Typecheck backend | Aprobado, salida 0 |
| Typecheck frontend | Aprobado; también incluido en el build |
| Build producción frontend | Aprobado, salida 0; advertencias de tamaño de chunks, importación mixta y comentarios de Zod |
| E2E formulario real | Aprobado para SUZ26-035, una radicación sin cuenta y reintento idéntico |
| Integridad PostgreSQL/S3 real | Aprobada, verificador de lectura con salida 0 |
| Acceso privado anónimo | 401 |
| Consulta del CUT nuevo sin capacidad | 404 |
| Control económico sobre datos reales | 422 DEMO_PAYMENT_PENDING; persiste con bandera apagada |
| Diff-check de archivos intervenidos | Aprobado, salida 0 |
| Diff-check global | Salida 2 por dos espacios finales preexistentes en VentanillaPresencialPage.tsx:878 y :898; no se editaron |

Las primeras ejecuciones de regresión detectaron fixtures antiguas con consultas secuenciales que desconocían el nuevo colaborador. Se aislaron esas dependencias en sus suites existentes, sin eliminar ni reducir aserciones. El control real tiene pruebas propias y comprobación PostgreSQL. Se conservó además el orden de autenticación y validación local antes de consultar el bloqueo económico.

La primera ejecución de la nueva prueba visual unitaria utilizó por error la sesión autenticada predeterminada de la fixture; se corrigió a visitante sin sesión y pasó. El primer recorrido del navegador se detuvo antes de pulsar Radicar porque comprobaba el aviso antes de que terminara su carga asíncrona. Se corrigió la espera y se verificó que no hubiera expediente antes de repetir. Ese primer recorrido había cargado un PDF de demostración sin asociarlo: queda como carga abandonada, no como otro expediente. No se borraron objetos ni registros históricos para limpiar la prueba. La política general de retención de cargas abandonadas sigue siendo un pendiente del canal público.

No se ejecutaron las suites globales completas de los nueve módulos. No se validaron todos los procedimientos mediante radicaciones reales: la excepción económica se informa para los 19 vigentes, pero las restantes validaciones de requisitos, identidad y clasificación siguen pudiendo rechazarlos.

## Persistencia y almacenamiento comprobados

- Documento: `9d4a0953-2ff9-4ced-8416-e3debb908106`, FUT, subido_por nulo.
- Bucket: `sigd-sandbox-e2e`.
- Objeto: `expedientes/2026/bab3de1e-3dc6-4918-966c-77840510f971.pdf`.
- Tamaño: 1347 bytes.
- SHA-256 leído de MinIO y comparado con PostgreSQL: `aeb501a69004537de4d925d309f804d8d01d30f7ec47fbe878eca80ef656ee89`.
- Folios: 1–1.
- Coincidencias por asunto único de prueba: 1.
- Cuentas vinculadas al solicitante DEMO: 0.
- Expedientes previos: 24, conservan la misma huella agregada al excluir el nuevo expediente. Total resultante: 25.
- Asiento y auditoría de la radicación: uno de cada uno. El reintento no los duplica.
- No se creó ningún pago ni se cambió un estado a PAGADO. El estado económico se conserva en el JSONB existente, no en una tabla financiera ficticia.

## Evidencias

- `scratch/evidencias-pago-demo/01-acceso-publico.png`.
- `scratch/evidencias-pago-demo/02-documento-FUT-sin-pago.png`.
- `scratch/evidencias-pago-demo/03-confirmacion-sin-pago.png`.
- **`scratch/evidencias-pago-demo/04-constancia-publica.png`**: captura real 1448×1086, inspeccionada.
- `scratch/evidencias-pago-demo/resultado-browser.json`: respuesta real y reintento.
- `scratch/evidencias-pago-demo/persistencia.json`: verificación PostgreSQL, S3 e integridad.
- `scratch/evidencias-pago-demo/baseline.json`: conteo y huella previos.
- `scratch/evidencias-pago-demo/runtime.json`: PID y configuración temporal, sin secretos.

La captura de la constancia contiene un QR de acceso privado a esta solicitud demostrativa. No debe tratarse como un enlace público de consulta de terceros.

## Git, servicios y cierre

- Rama y HEAD inicial/final: `B_JACOBO`, `bf30d8a0c85e266a86381fb10bf3740a8451c032`.
- Estado inicial: 264 entradas; estado final: 266 entradas en `git status --short`. Las carpetas sin seguimiento agrupan varios archivos; el conteo no representa archivos individuales.
- Todos los cambios anteriores se conservaron. No hubo reset, clean, restore, stash, commits ni pushes.
- Backend activo en 3008, PID **22196**, con la variable temporal. Hubo dos recargas controladas del backend, sin instancias duplicadas; frontend 5178 PID **19136** conservado. Docker no se modificó ni reinició.
- No se ejecutaron migraciones ni DML manual para simular éxito. Las escrituras documentales se realizaron por el endpoint real y su transacción; Redis y MinIO recibieron las operaciones propias del formulario.
- `sigd_prueba` permaneció intacta y sin consultas en esta intervención.

**Aceptación demostrada:** SUZ26-035 se radicó públicamente, sin cuenta ni pago, con CUT, expediente, archivo, auditoría y constancia persistidos; conserva pago NO_VERIFICADO y bloqueo de avance. La excepción es de recepción técnica en demostración, no una exoneración institucional definitiva ni una implementación de Tesorería M10.
