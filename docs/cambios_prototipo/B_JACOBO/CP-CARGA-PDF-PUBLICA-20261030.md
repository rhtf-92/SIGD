# Corrección de carga PDF pública y radicación real

Fecha: 30/10/2026. Rama `B_JACOBO`.

## Resultado

Se reprodujo el mensaje «La operación de carga falló», se corrigió su causa y se completaron los cuatro pasos del formulario real desde **http://localhost:5178**, sin login ni cuenta institucional.

| Elemento | Resultado comprobado |
|---|---|
| Procedimiento | SUZ26-035 |
| CUT / código de expediente | **EXP-2026-000034** |
| Identificador de expediente | **dc37acd0-e686-450c-b149-224342b0f78e** |
| Estado | REGISTRADO |
| Pago | NO_VERIFICADO; modalidad demostrativa sin verificación de pago |
| Fecha de recepción | 2026-10-30T23:31:43.406Z |
| Fecha legal calculada por el servicio existente | 2026-11-02T13:00:00.000Z |
| Documento adjunto | solicitud-demo-carga-publica.pdf, FUT, una página |
| Documento UUID | 2336e294-90dc-4f65-9c34-bf10522d8d22 |
| Asiento | 005c8ea4-1a65-4c4b-a6b9-ec022718b41c, número 10033, MESA_VIRTUAL |
| Auditoría | f0c22fef-c92d-4fc8-a499-7c901e0a20b2; actor institucional nulo |

No se hicieron INSERT manuales para simular una radicación. La solicitud fue enviada pulsando «Radicar Trámite» en el formulario React real mediante el navegador. La constancia apareció y fue capturada antes de cerrar el navegador. Se confirmó después su respuesta transaccional persistida y su integridad documental.

## Causa raíz reproducida con Network

El frontend estaba disponible mediante `localhost:5178`, pero sus peticiones API tenían como destino `127.0.0.1:3008`. El navegador considera esos nombres sitios distintos y envía `Sec-Fetch-Site: cross-site`.

La política CORS admitía el origen `http://localhost:5178`: el preflight respondía 204 y el catálogo GET respondía 200. Sin embargo, el middleware del canal público rechazaba incondicionalmente cualquier escritura con `Sec-Fetch-Site: cross-site`, incluso si su Origin estaba autorizado. Por ello:

- `POST /api/v1/tramites/publico/reto` devolvía **403 FORBIDDEN**.
- Correlation ID reproducido: `85263286-deae-4648-a67b-67ce7163b7c4`.
- El rechazo ocurría antes de emitir la capacidad anónima y antes de ejecutar `/carga` o contactar con MinIO.
- El hook frontend convertía el `ApiHttpError` en «La operación de carga falló», ocultando el motivo HTTP.
- No había adjunto confirmado, por lo que «Siguiente» permanecía correctamente bloqueado.

Se inspeccionaron el router público, CORS, cliente público sin cookies/JWT, hook de carga, validación PDF, estado de los servicios y logs del backend. Los logs no mostraban un fallo S3 para ese intento: la petición era rechazada antes de llegar al almacenamiento. La evidencia decisiva es la captura real de Network, no una inferencia a partir del mensaje genérico.

Evidencias previas a la corrección:

- `scratch/evidencias-carga-publica/network-error.json`: método, origen, clasificación cross-site, estados y correlation IDs; no incluye capacidades ni tokens.
- `scratch/evidencias-carga-publica/01-error-carga-localhost.png`: mensaje reproducido en el formulario.

## Corrección mínima

### Backend

`backend/src/domains/tramicore/radicacionPublica.router.ts`: se utiliza la política explícita de orígenes autorizados para decidir si una escritura es válida. Un frontend autorizado puede ser cross-site. Se mantienen rechazados los orígenes ajenos y las escrituras cross-site que no proporcionan Origin.

No se abrió el router privado ni se eliminó autenticación. El canal público sigue sin cookies, exige JSON o PDF según endpoint y mantiene reto de consumo único, capacidad aleatoria por formulario, vinculación de archivos a sesión/procedimiento, cuotas e idempotencia. La omisión de pago sigue controlada por el servidor y la base efectiva de demostración.

### Frontend

`frontend/src/hooks/usePresignedUpload.ts`:

- Conserva el motivo de los errores HTTP y los motivos de validación documental, con referencia de correlación cuando es válida.
- Distingue fallos de transporte de errores del servidor; no presenta éxito ante ninguno de ellos.
- Aplica el máximo público de **20 MiB** también en el hook. La utilidad genérica de otros consumidores no se cambió.
- Mantiene SHA-256 y comparación de tamaño contra la respuesta del servidor, y comprueba que la clave devuelta tenga formato documental real.
- No publica metadatos de adjunto antes de la confirmación ni después de una cancelación.

No fue necesario cambiar las reglas de «Siguiente»: el paso existente solo avanza con documentos cargados y clasificación válida. Tras la corrección, el navegador comprobó la presencia del adjunto, seleccionó FUT, verificó que el botón estuviera habilitado y avanzó por los pasos restantes.

## Recorrido real e incidencia del recolector

El primer recorrido fue exclusivamente de reproducción: obtuvo el 403 antes de cargar un objeto y no envió radicación.

Después de la corrección y de recargar solo el backend identificado, el segundo recorrido cargó el PDF, avanzó por los cuatro pasos, pulsó Radicar y mostró la constancia EXP-2026-000034. Posteriormente el recolector de evidencia falló al inspeccionar una entrada auxiliar de Network que no tenía `path`. Ese fallo ocurrió **después** de guardar la captura de la constancia; no fue un fallo de radicación.

Se consultó PostgreSQL inmediatamente, se encontró el expediente válido y **no se volvió a radicar**. Se corrigió el recolector para ignorar entradas sin path y para reconocer solicitudes existentes. Una nueva ejecución de su comprobación inicial terminó con salida 0, informó el CUT ya existente y no cargó archivos ni envió otra solicitud.

No se declara que aquella ejecución inicial del script E2E terminara con salida 0: terminó con salida 1 por el recolector. La radicación de la aplicación sí quedó acreditada por la interfaz real, la constancia y las comprobaciones posteriores PostgreSQL/MinIO. El JSON `resultado-browser.json` identifica expresamente que su respuesta se recuperó del registro transaccional, no de una respuesta HTTP capturada por ese recolector.

## Persistencia comprobada con conexión efectiva

Antes de las operaciones se verificó la configuración y la conexión real:

- Destino local: `127.0.0.1:5433/sigd_jacobo_demo`.
- `current_database()`: `sigd_jacobo_demo`.
- `current_user`: `sigd_jacobo_user`.
- Servidor efectivo: `172.20.0.2:5432`.

La verificación final se ejecutó en transacción de solo lectura y cerró sus conexiones en `finally`.

| Comprobación | Evidencia |
|---|---|
| MinIO | Bucket `sigd-sandbox-e2e`, objeto `expedientes/2026/a6e99974-4ac5-45b1-b0c9-dbbf2cd096b2.pdf` |
| Tamaño | 1230 bytes |
| SHA-256 de bytes descargados, igual a PostgreSQL | `95af4b383457f7f92a8dbd30fcabee1b67c69a98d6197b12fa26008a3b6c4f3b` |
| PDF | Firma binaria PDF; validación estructural del router conservada; no se desactivaron restricciones de acciones activas o cifrado |
| Referencia | Documento asociado a dc37acd0-e686-450c-b149-224342b0f78e, FUT, subido_por nulo |
| Folios | 1–1 |
| Titular | Persona sintética DEMO af10831c-ae90-4aae-a6e1-1c9297ba3381; cero cuentas institucionales vinculadas |
| Duplicados del intento | Una sola coincidencia por asunto único |
| Expedientes previos | Los 25 conservan la huella previa al excluir el nuevo expediente; total resultante 26 |
| Pago | NO_VERIFICADO en declaración y auditoría; no se registró pago ficticio |
| Bloqueo económico | 422 DEMO_PAYMENT_PENDING al consultar la regla sobre el registro real; persiste con la bandera desactivada |
| Acceso privado anónimo | 401 |
| Consulta del CUT nuevo sin capacidad | 404 |

La radicación previa EXP-2026-000033 se conservó y no se reutilizó como si fuera el intento actual.

## Archivos intervenidos

- `backend/src/domains/tramicore/radicacionPublica.router.ts`: corrección de la política de origen.
- `backend/tests/unit/domains/tramicore/radicacion-publica.spec.ts`: regresión localhost autorizado frente a origen ajeno o ausente.
- `frontend/src/hooks/usePresignedUpload.ts`: errores útiles y confirmación estricta del adjunto público.
- `frontend/tests/unit/uploads/publicUpload.test.tsx`: ocho pruebas nuevas de carga pendiente/confirmada, hash, tamaño, clave, errores HTTP y límite de 20 MiB.
- `frontend/tests/unit/uploads/presignedWizard.test.tsx`: identifica explícitamente su fixture como autenticada para probar el consumidor presigned privado; conserva sus aserciones.
- `scratch/public-upload-browser.cjs`: reproducción, recorrido real y protección contra repetir el intento ya radicado.
- `scratch/verificar-persistencia-pago-demo.cjs`: opción `--carga-publica` para verificar este expediente existente sin generar otro.
- Este informe y evidencias en `scratch/evidencias-carga-publica/`.

## Pruebas finales

| Comando/alcance | Resultado |
|---|---|
| Backend: app-routes, radicacion-publica, demo-pago | **156 aprobadas**, salida 0 |
| Frontend: publicUpload, presignedWizard, magicBytesValidator, radicacionPublicaService, useTramiteWizardReducer | **28 aprobadas**, salida 0 |
| Typecheck backend | Aprobado |
| Typecheck frontend final | Aprobado |
| Build frontend | Aprobado; advertencias de tamaño de chunks e importaciones/comentarios preexistentes |
| Verificador PostgreSQL/MinIO real | Aprobado, salida 0 |
| Detección de intento existente | Aprobada, salida 0; sin nuevo envío |
| Diff-check de archivos de producción intervenidos | Aprobado |
| Diff-check global | Dos espacios finales preexistentes en VentanillaPresencialPage.tsx:878 y :898; no se modificaron |

La primera compilación de las nuevas fixtures señaló dos propiedades `retryable` ausentes; se corrigieron los tipos de las fixtures y se repitió con éxito. Una prueba antigua de presign privado asumía una sesión no declarada; se hizo explícita su autenticación, sin cambiar el comportamiento productivo ni reducir aserciones.

No se ejecutó la suite global completa de los nueve módulos. Las pruebas unitarias no se presentan como sustituto de la radicación real descrita arriba.

## Evidencias de recepción

- **`scratch/evidencias-carga-publica/04-constancia.png`**: captura real 1448×1086, inspeccionada visualmente, con CUT EXP-2026-000034 y aviso NO VERIFICADO.
- `scratch/evidencias-carga-publica/02-pdf-adjunto-siguiente-habilitado.png`: captura del paso 2. La presencia del adjunto y el estado habilitado del botón, situados más abajo que el viewport de esta captura, se comprobaron por DOM antes de continuar.
- `scratch/evidencias-carga-publica/03-confirmacion.png`: paso 4 antes del envío.
- `scratch/evidencias-carga-publica/persistencia.json`: comprobación real de expediente, documento, MinIO, asiento, folios, auditoría y protección de acceso.
- `scratch/evidencias-carga-publica/baseline.json`: huella de los 25 expedientes previos.
- `scratch/evidencias-carga-publica/resultado-browser.json`: respuesta persistida recuperada y procedencia explícita.

La constancia incluye un QR privado de esta solicitud de demostración; no es un permiso de consulta general.

## Integridad y entorno final

Rama y HEAD conservados: `B_JACOBO`, `bf30d8a0c85e266a86381fb10bf3740a8451c032`. Inventario inicial: 266 entradas de status; final: 268. Se conservaron modificaciones y archivos sin seguimiento anteriores; las carpetas sin seguimiento agrupan varios archivos.

Una recarga controlada del backend para activar el código: PID 20524, puerto 3008. Frontend PID 19136, puerto 5178, conservado. `SIGD_DEMO_OMITIR_PAGO=true` sigue activo solo en el proceso backend de demostración y condicionado a la base efectiva. Docker y archivos de secretos no se modificaron.

Sin DDL, migraciones, cambios de tarifas, cambios de RBAC ni implementación de M10. Sin escrituras ni consultas a `sigd_prueba`. Sin eliminación o modificación de expedientes anteriores, commits, pushes ni cambios de rama.

**Cierre:** error de carga reproducido y corregido; SUZ26-035 radicado desde el navegador sin sesión; CUT, expediente, PDF, referencia PostgreSQL y constancia comprobados. El estado económico continúa pendiente de verificación.
