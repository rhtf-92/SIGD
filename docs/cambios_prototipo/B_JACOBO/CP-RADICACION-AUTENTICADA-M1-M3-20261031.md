# Radicación autenticada M1 + M3 — 31/10/2026

## Estado inicial y protección

Rama comprobada `B_JACOBO`; HEAD `bf30d8a0c85e266a86381fb10bf3740a8451c032`; 280 entradas locales preexistentes. Se inspeccionaron los cambios y se conservaron. Backend existente PID 12908 en 3008; frontend PID 21664 en 5178. No se cambiaron ramas ni se hicieron commits, pushes, restauraciones o borrados. No se ejecutaron migraciones ni DDL.

Antes de las escrituras de ensayo se verificó la configuración y conexión efectiva: `127.0.0.1:5433/sigd_jacobo_demo`, `current_database=sigd_jacobo_demo`, `current_user=sigd_jacobo_user`, servidor interno `172.20.0.2:5432`. No se consultó ni modificó `sigd_prueba`. SMTP/OTP no se configuraron ni se simularon.

## Causa demostrada

El núcleo de radicación ya es común a ambas modalidades. Sin embargo, `demoSinPago` se activaba exclusivamente dentro de `if (publico)`. El frontend también filtraba el comprobante únicamente en modo público. Un ciudadano autenticado que adjuntaba FUT seguía sujeto a la clasificación económica original. Además, la modalidad autenticada carecía de recuperación persistente de respuesta ante un reintento.

La prueba con Edge real contra 5178/3008 confirmó: registro **201**, login **200**, `/auth/me` **200**, identidad autocompletada y protegida, presigned autenticado **200**, PUT MinIO **200**, pero radicación autenticada **400**, `VALIDATION_ERROR`, `TIPO_DOCUMENTAL_NO_AUTORIZADO`. Esta prueba se realizó contra la versión anterior que sigue cargada en el proceso, no contra el código corregido. Evidencia: `scratch/evidencias-radicacion-autenticada/diagnostico-backend-anterior.json` y `error.png`.

Una comprobación posterior mediante SELECT confirmó **cero expedientes** para este escenario y huellas idénticas de todos los expedientes DocuCore/TramiCore anteriores. La cuenta sintética DEMO se creó mediante el registro real y se conserva para repetir el ensayo sin duplicarla; no se modificó ningún ciudadano real. Cuenta `e0da8162-b0f3-4f68-b204-86a754831f53`, persona `addb137c-8471-4a5d-a981-42207db97357`, rol CIUDADANO. La credencial reproducible de esa fixture se deriva en memoria de la configuración privada, solo tras comprobar el destino demo; no se registra ni se guarda en las evidencias. No se restablecieron contraseñas existentes.

## Correcciones en código

| Archivo | Cambio de esta intervención |
|---|---|
| `backend/src/domains/tramicore/radicacionVirtual.service.ts` | Usa la excepción demo en ambas modalidades, manteniendo la comprobación efectiva de base. Idempotencia autenticada mediante huella de solicitud por cuenta, bloqueo transaccional PostgreSQL y respuesta confirmada en la bitácora existente. Valida la identidad antes de recuperar una respuesta. Registra actor, expediente, CUT y estado económico NO_VERIFICADO. Verifica la emisión del archivo a esa cuenta antes de leer MinIO. |
| `backend/src/domains/tramicore/demoPago.ts` | El bloqueo económico persistente contempla la auditoría autenticada además de la radicación pública, incluso después de apagar la bandera. Reutiliza los puntos de control ya presentes en RutaDoc y Despacho. |
| `backend/src/core/storage/storage.router.ts` | Registra de forma append-only la emisión de cargas `EXPEDIENTE_INGRESO`, vinculando usuario, clave S3, SHA-256, tamaño y nombre. Límite de 20 MiB para esta categoría. No crea un adjunto antes del expediente. Los contratos de respuesta y las otras categorías se conservan. |
| `backend/src/audit/bitacora-auditoria.repository.ts` | Tipo de conexión reducido a `Pick<PoolClient,'query'>`, para reutilizar el mismo escritor con el pool al emitir la carga y con el cliente transaccional al radicar. Sin cambio de SQL o esquema de bitácora. |
| `backend/src/domains/tramicore/tramites.controller.ts` | Propaga al contexto de auditoría el usuario obtenido del JWT validado. |
| `frontend/src/components/tramite/WizardSteps/StepDocumentos.tsx` | Consulta la condición demo existente también con sesión y aplica el mismo filtrado de comprobantes y aviso. No permite que React active la excepción del backend. |
| `frontend/src/components/tramite/WizardSteps/StepConfirmacion.tsx` | Aviso demo también autenticado; enlace del ciudadano al historial propio `/consulta`, conservando `/expedientes` para otras cuentas y el seguimiento público existente. |
| `frontend/src/hooks/usePresignedUpload.ts` | Límite local de 20 MiB también para adjuntos diferidos del wizard autenticado. |
| `backend/tests/unit/domains/tramicore/radicacion-tupa-ddl.spec.ts` | Mock de auditoría adaptado; pruebas nuevas de recuperación sin otro CUT, evidencia demo y rollback si falla el registro de auditoría. No se eliminaron aserciones anteriores. |
| `backend/tests/unit/domains/tramicore/radicacion-autenticada-seguridad.spec.ts` | Pruebas de límite de base/producción, bloqueo persistente, rechazo de objeto ajeno y emisión de carga vinculada al usuario. |
| `frontend/tests/unit/components/TramiteWizard.test.tsx` | Caso demo cubre ambas modalidades, sin exigir comprobante y conservando FUT. |

No se añadieron tablas, migraciones, endpoints, roles, JWT especiales ni cambios de tarifas. `categoria` es un campo opcional que el frontend ya enviaba en el contrato de carga; ahora se utiliza para identificar las cargas del wizard. La respuesta de radicación permanece intacta.

La huella de reintento incluye la solicitud validada y sus referencias de archivos, y está aislada por usuario. Un nuevo formulario con una carga nueva produce otra huella y otro CUT; no limita el número de procedimientos por ciudadano. El bloqueo transaccional y la bitácora se confirman junto con expediente, adjuntos, folios y asiento. No se utiliza una caché en memoria para declarar una radicación confirmada. Las cargas emitidas por la versión anterior deberán adjuntarse nuevamente para que exista su registro de emisión segura.

## Pruebas ejecutadas

| Ejecución | Resultado |
|---|---|
| Backend: radicacion-autenticada-seguridad, radicacion-tupa-ddl, radicacion-publica, mis-expedientes, s3-storage | **5 archivos, 95 pruebas aprobadas**, exit 0. Mocks de persistencia/S3, no radicación real. |
| Backend: derivaciones y resoluciones | **2 archivos, 52 pruebas aprobadas**, exit 0. Regresiones; los logs 5xx y advertencias S3 pertenecen a escenarios de prueba, no acreditan emisión de resoluciones. |
| Frontend: TramiteWizard, presignedWizard, publicUpload | **3 archivos, 75 pruebas aprobadas y 1 omitida**, exit 0. |
| Backend `npx tsc --noEmit` y `npm run build` | Exit 0. |
| Frontend `npx tsc --noEmit` y `npm run build` | Exit 0. El primer build falló por acceso de esbuild en el aislamiento; la repetición autorizada pasó. Persisten advertencias de tamaño de bundle e imports dinámicos. |
| ESLint de los tres archivos frontend tocados | Se detectan dos errores preexistentes `set-state-in-effect` en los efectos de recarga de catálogo de StepDocumentos/StepConfirmacion y advertencias de dependencias. No se presenta como aprobado; no se refactorizó ese código ajeno al defecto. |
| `git diff --check` del alcance | Exit 0. |
| Navegador contra backend anterior | **FALLO REPRODUCIDO**, HTTP 400 de clasificación; sin expediente. No es una prueba de la corrección activada. |
| `node scratch/validar-radicacion-autenticada.cjs --solo-lectura` | Exit 0; cero expedientes del escenario, cuenta de ensayo única, huellas previas conservadas. |

Los primeros fallos unitarios por falta de retorno de auditoría en el mock se corrigieron ampliando el mock para representar la nueva escritura. Un fallo nuevo comparaba `NO_VERIFICADO` con el mensaje humano `NO VERIFICADO`; se corrigió la aserción, manteniendo la validación del valor estructurado con guion bajo. Un enlace genérico se ajustó inicialmente para todas las cuentas y se acotó después al rol CIUDADANO para conservar el comportamiento institucional previo.

## E2E preparado y condición de activación

Script `scratch/validar-radicacion-autenticada.cjs`: utiliza el frontend y backend existentes, no intercepta API ni ejecuta INSERT manuales. Reutiliza su cuenta DEMO sin duplicarla, comprueba el destino, sube un PDF sintético sin valor académico, completa el formulario, espera 201 y guarda inmediatamente el resultado. Si ya existe un expediente de ese escenario, no lo vuelve a presentar.

Después comprueba cargo visible, navegación a Mis trámites, consulta propia, dos reintentos HTTP concurrentes con el mismo CUT/UUID, rechazo de identidad y documento ajenos, rechazo de consulta ajena, JWT obligatorio, PostgreSQL, MinIO byte por byte, SHA-256, asiento, auditoría, NO_VERIFICADO e históricos intactos. Cierra navegador y PostgreSQL en `finally`, con límites de conexión, consultas y peticiones. No configura SMTP ni reinicia servicios.

```powershell
node scratch/validar-radicacion-autenticada.cjs
```

**PENDIENTE DE AUTORIZACIÓN:** la solicitud actual prohíbe reiniciar servicios automáticamente. Se solicitó confirmación para activar exclusivamente el backend 3008 con su launcher actual, migraciones desactivadas y `SIGD_DEMO_OMITIR_PAGO=true`, conservando frontend, PostgreSQL, Redis y MinIO. No se ha asumido aprobación por el tiempo transcurrido ni se ha levantado otro backend.

## Clasificación a esta hora

- **IMPLEMENTADO Y VERIFICADO EN PRUEBAS AISLADAS:** excepción autenticada controlada, idempotencia transaccional, propiedad de la carga, auditoría y bloqueo económico, navegación ciudadana; compilación y regresiones indicadas.
- **VERIFICADO EN ENTORNO REAL, ANTES DE ACTIVAR:** registro, login, autocompletado, carga PDF en MinIO y causa HTTP 400 de la versión anterior; cero expedientes creados en ese intento.
- **PENDIENTE:** activar la versión corregida autorizadamente y completar el E2E persistente hasta CUT, cargo e historial. No se entrega un CUT autenticado ni se declara terminada esa modalidad.
- **FUERA DEL ALCANCE POR INSTRUCCIÓN:** SMTP y OTP institucional, Tesorería M10, pago real y certificado académico oficial. Su ausencia no será utilizada para bloquear el escenario demostrativo autenticado.

Comprobación final: rama/HEAD conservados, **282** entradas locales (se añadieron el test nuevo y un helper de diagnóstico; el resto del trabajo previo permanece). `/health` y `/ready` siguen en 200; backend PID 12908 y frontend PID 21664 sin reiniciar. La captura `error.png` del paso 4 se inspeccionó visualmente: muestra la clasificación rechazada por el backend anterior, no una constancia de éxito.
