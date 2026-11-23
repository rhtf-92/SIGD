# M1 + M3 — implementación, integración y límites de validación

Fecha: 30/10/2026. Rama: `B_JACOBO`.
HEAD inicial y final: `bf30d8a0c85e266a86381fb10bf3740a8451c032`.

## Resultado ejecutivo

El registro natural vuelve a funcionar en el esquema actual sin exigir domicilio/ubigeo que no pueden persistirse. El formulario consulta capacidades del backend y solo solicita esos datos cuando el perfil dispone de columnas para guardarlos. No se cambian las tarifas ni la radicación pública.

Se implementó la reclamación de una identidad anterior mediante OTP enviado exclusivamente al correo original almacenado, con Redis compartido, límites de abuso, caducidad y prueba de un solo uso. La cuenta reutiliza el UUID de persona: los expedientes conservan sus identificadores, CUT, fechas, documentos y movimientos. No se ejecuta una reasignación masiva de expedientes. La operación queda trazada en la auditoría del registro.

Se implementó el transporte SMTP con TLS obligatorio. No se configuraron credenciales, no se enviaron correos externos y no se presenta el control del correo como una validación oficial de identidad. La entrega institucional sigue pendiente de configuración autorizada.

Se probó registro, login, perfil estructurado, reclamación OTP de ensayo y autocompletado en Edge real con PostgreSQL y Redis reales. El API del navegador fue reenviado a una instancia efímera con los routers actualizados; no se reemplazaron respuestas por mocks. La base estuvo dentro de una transacción exterior que se revirtió. **Esto no es una prueba persistente del backend que escucha en 3008 ni demuestra una radicación nueva con PDF/CUT.**

## Diagnóstico confirmado

1. `REGISTRO_MODELO_NO_COMPATIBLE` se producía porque una comprobación previa exigía domicilio y distrito en todas las altas. El esquema real no contiene esos campos en `persona_natural`; `perfil_usuario` solo almacena teléfono y metadatos institucionales. La única dirección disponible está en `persona_juridica`.
2. La identidad pública previa se guarda en `persona`/`persona_natural`, y `sigd_tra.expediente.solicitante_id` referencia esa persona. Una nueva cuenta vinculada legítimamente al mismo UUID puede recuperar el historial sin modificar los expedientes.
3. Los datos personales introducidos libremente no constituyen prueba independiente. Antes de esta intervención no existía un protocolo de OTP ni un transporte de correo para el reclamo.
4. El historial anterior tenía un límite de 100 filas sin paginación. Además, una respuesta HTTP pendiente de una sesión anterior podía actualizar la consulta después de cambiar de cuenta.
5. El antiguo SQL documental `backend/docs/01_identicore/06_migracion_autoregistro_ubigeo.sql` también contiene referencias a columnas incompatibles con este esquema. Se inspeccionó y no se ejecutó.

## Implementación y compatibilidad

### Registro y domicilio

- Se mantienen las rutas de registro y respuesta `201 { idPersona, mensaje }`.
- `direccion` y `ubigeoDistrito` pasan a ser opcionales para crear una cuenta. Si se aportan, se validan conjuntamente y solo se aceptan cuando pueden persistirse. No se descartan silenciosamente datos de clientes anteriores.
- `referencia` y `verificacionTitularidad` son adiciones opcionales al contrato. La segunda no concede roles: únicamente demuestra que se consumió la prueba de contacto necesaria para reutilizar una persona previa o comprobar al representante jurídico.
- Un alta nueva sigue generando Argon2id nativo, consentimiento de datos, declaración jurada, cuenta, perfil y asignación exclusiva del rol canónico CIUDADANO dentro de una misma transacción.
- El registro no sobrescribe nombres, nacimiento ni contacto histórico de la persona previa. Cuenta y perfil conservan sus datos de acceso/contacto; no se confunden con la identidad original.
- En personas jurídicas nuevas se mantiene la declaración de representación y se exige también prueba OTP del contacto preexistente del representante. No se afirma haber comprobado representación contra SUNARP. La reclamación automática de una persona jurídica ya existente sin cuenta requiere revisión institucional; no se introdujo un bypass.
- El pie «¿Ya tienes una cuenta? Iniciar sesión» sigue ausente. Se conserva «Volver al inicio».

### Verificación de contacto

Endpoints públicos nuevos, dentro de IdentiCore:

| Endpoint | Función |
|---|---|
| `GET /api/v1/auth/registro-capacidades` | Capacidades de persistencia de domicilio y disponibilidad del OTP; sin datos de personas. |
| `POST /api/v1/auth/verificacion-contacto/iniciar` | Recibe tipo/documento/nombres/apellidos. Consulta la identidad, coteja los datos y envía al correo ya almacenado. Respuesta genérica, sin mostrar destino ni confirmar existencia. |
| `POST /api/v1/auth/verificacion-contacto/confirmar` | Recibe desafío y código. Devuelve una prueba aleatoria temporal de un solo uso. |

El OTP tiene seis dígitos, vigencia de 600 segundos y cinco intentos. El digest es HMAC-SHA256 con el secreto del servidor existente y separación de propósito. Redis realiza la comparación, incremento de intentos y consumo en una operación Lua atómica. La prueba posterior dura 300 segundos, se almacena bajo el hash de un token aleatorio de 256 bits y se consume con GETDEL.

Límites iniciales: tres solicitudes por documento cada 15 minutos, diez por IP cada 15 minutos y treinta confirmaciones por IP cada 15 minutos. Son controles técnicos configurados en código, no una regla institucional de cantidad de trámites. No existe fallback a memoria en producción.

La prueba queda ligada a persona, documento y hash del correo original. El registro vuelve a bloquear las filas de persona y persona natural, coteja identidad/nacimiento disponible y valida el contacto actual antes de crear la cuenta. Una prueba repetida, vencida, aplicada a otra persona/documento o a un contacto modificado falla. Si la transacción posterior falla tras consumir una prueba, debe solicitarse otro OTP; no se reabre una prueba consumida.

Si falta el correo original o el transporte, no se vinculan expedientes y se indica validación institucional presencial. El proyecto no dispone de un procedimiento administrativo digital de aprobación manual; no se inventó un rol ni un endpoint que permita saltar la comprobación.

### SMTP

Dependencias agregadas, preservando las anteriores: `nodemailer@10.3.1` y `@types/nodemailer@8.0.2`.

Para habilitar el transporte, el responsable debe configurar mediante el mecanismo privado existente:

- `IDENTICORE_OTP_ENABLED=true`.
- `IDENTICORE_OTP_SMTP_HOST`.
- `IDENTICORE_OTP_SMTP_PORT`: 465 o 587.
- `IDENTICORE_OTP_SMTP_USER` y `IDENTICORE_OTP_SMTP_PASSWORD`.
- `IDENTICORE_OTP_SMTP_FROM`: remitente institucional autorizado.

También se requieren el Redis existente y un secreto JWT del servidor de al menos 32 caracteres. No se modificaron archivos de secretos. Configuración incompleta o insegura mantiene el OTP deshabilitado. No hay un proveedor ni cuenta predeterminados.

El adaptador exige TLS y certificados válidos, limita tiempos de DNS/conexión/socket, deshabilita logs SMTP, acceso a archivos y descarga de URLs. Solo considera exitosa la entrega cuando el servidor acepta al destinatario. Esta aceptación SMTP no demuestra lectura del correo. Referencia técnica consultada: [documentación oficial del transporte SMTP de Nodemailer](https://nodemailer.com/smtp).

### Perfil, Mesa de Partes e historial

- `/auth/me` conserva su contrato anterior y añade campos estructurados disponibles. El tipo documental corresponde al documento actual de la persona. La lectura de domicilio opcional mediante `to_jsonb(perfil_usuario)` evita referenciar columnas inexistentes.
- M3 sigue recuperando la identidad autenticada del backend; DNI/nombres/apellidos no se infieren del nombre visible ni se hardcodean. El estado de carga se vincula al ID de cuenta, de modo que no se puede avanzar con el perfil de otra sesión.
- El contacto declarado para una solicitud conserva el comportamiento existente de M3 y no actualiza el perfil ni la persona. Una actualización persistente de esos datos requeriría un flujo de perfil autorizado; no se añadió una edición pública de personas por DNI.
- `/tramites/mis-expedientes` obtiene la persona desde la cuenta identificada por JWT, rechaza IDs de persona en la query y añade paginación compatible (`pagina`, 100 filas, `hayMas`). Cada acceso se audita sin copiar datos personales al log.
- La interfaz permite cargar páginas adicionales. El cambio de cuenta o CUT crea un estado independiente y cancela la aplicación de respuestas de consultas anteriores. Hay una prueba de regresión explícita para este caso.
- Casilla reutiliza `DestinoCasilla` y las rutas existentes. No se reenvían artificialmente notificaciones históricas omitidas cuando no había cuenta, ni se crean acuses oficiales ficticios.

## Cambios de modelo propuestos, no ejecutados

Se prepararon dos archivos fuera de las carpetas que aplica el migrador automáticamente:

- `sql/M1-20261030-perfil-domicilio.up.sql`: añade únicamente `direccion`, `ubigeo_distrito` y `referencia` opcionales a `perfil_usuario`, con restricción de coherencia.
- `sql/M1-20261030-perfil-domicilio.down.sql`: permite revertir solo cuando las columnas no tienen datos; de lo contrario rechaza la operación para evitar pérdida de información.

No se aplicaron ni se validaron en PostgreSQL real estas migraciones; requieren revisión y autorización antes de ejecutarlas en una base compartida. No son necesarias para crear una cuenta mínima. No se renombraron/eliminaron columnas ni se tocaron los esquemas de expedientes.

## Archivos de esta intervención

| Archivos | Cambio |
|---|---|
| `backend/src/domains/identicore/registroCiudadano.service.ts` | Registro compatible, domicilio opcional persistible, reclamación por OTP, comprobación del representante y auditoría. |
| `backend/src/domains/identicore/registro.schemas.ts` | Campos opcionales compatibles; validación estricta de datos y sin roles públicos. |
| `backend/src/domains/identicore/identidadOtp.service.ts` (nuevo) | OTP, Redis atómico, límites, caducidad y pruebas de titularidad. |
| `backend/src/domains/identicore/otpSmtp.ts` (nuevo) | Adaptador SMTP seguro y deshabilitado sin configuración explícita. |
| `backend/src/domains/identicore/identicore.router.ts`, `backend/src/app.ts` | Endpoints y composición de puertos de entrega/almacenamiento para pruebas e integración. |
| `backend/src/domains/identicore/auth.router.ts` | Perfil con dirección opcional y tipo del documento actual. |
| `backend/src/domains/tramicore/tramites.controller.ts` | Historial propio paginado y auditado. |
| `frontend/src/pages/registro/RegistroCiudadanoPage.tsx` | Capacidades, formulario compatible y panel de OTP real. |
| `frontend/src/components/registro/PersonaNaturalForm.tsx`, `PersonaJuridicaForm.tsx`, `frontend/src/schemas/registroCiudadano.schema.ts` | Domicilio condicionado al soporte de persistencia. |
| `frontend/src/components/tramite/WizardSteps/StepIdentificacion.tsx` | Estado del perfil por titular; texto de protección corregido. |
| `frontend/src/pages/tramite/ConsultaPublicaPage.tsx` | Estado independiente por sesión/CUT, carga de más expedientes y descarte de respuestas antiguas. |
| `backend/package.json`, `backend/package-lock.json` | Solo incorporación de SMTP y sus tipos sobre las dependencias acumuladas. |
| Pruebas IdentiCore, historial y registro frontend | Adaptación a capacidades y nuevas regresiones de OTP, SMTP, persona jurídica y privacidad. |
| `scratch/validar-m1-m3-cierre.ts`, `scratch/evidencias-m1-m3-cierre/` | Integración reproducible real con ROLLBACK y evidencias del navegador. |

Se preservaron LoginPage, HomePage, encabezado, recursos institucionales, RBAC, JWT, Docker Compose, configuración privada y código de radicación/validación documental ya existente. Los diffs contra HEAD contienen también mucho trabajo anterior y no representan exclusivamente estos cambios.

## Pruebas y evidencia

| Validación | Resultado real |
|---|---|
| Backend IdentiCore + historial + radicación pública + TUPA | 15 archivos, **284 pruebas aprobadas**, salida 0. |
| Frontend registro/perfil/historial/Casilla/carga pública | 8 archivos, **160 aprobadas, 1 omitida**, salida 0. |
| Repetición final de Wizard e historial tras corregir el ciclo de estado | 2 archivos, **68 aprobadas, 1 omitida**, salida 0; no se suman a la cifra anterior. |
| TypeScript backend | Aprobado, salida 0. |
| TypeScript frontend | Aprobado; también incluido en el build final. |
| Build backend | Aprobado, salida 0. |
| Build frontend | Aprobado, salida 0; advertencias de anotaciones de Zod, imports mixtos y tamaño de chunk. |
| ESLint de los seis archivos frontend de implementación | Aprobado sin advertencias ni errores, salida 0. |
| Integración HTTP con PostgreSQL y Redis reales | Aprobada; detalle en `scratch/evidencias-m1-m3-cierre/resultado.json`. |
| Navegador Edge real 1448×1086 | Registro nuevo, login, autocompletado protegido y reclamo OTP de ensayo aprobados. Capturas inspeccionadas. |
| `git diff --check` del alcance | Aprobado. |
| `git diff --check` global | Siguen dos espacios finales preexistentes en `VentanillaPresencialPage.tsx:878` y `:898`; no se editaron. |

El build inicial se bloqueó por acceso de esbuild a la configuración bajo el aislamiento; la repetición autorizada pasó. La primera prueba de navegador falló porque el proxy del harness interceptaba también imports de Vite: se restringió a rutas cuyo pathname comienza por `/api/` y la repetición pasó. No se presentó ninguna de esas ejecuciones fallidas como aprobada.

El harness conecta con `127.0.0.1:5433/sigd_jacobo_demo` y comprueba, antes de escribir, `current_database=sigd_jacobo_demo`, `current_user=sigd_jacobo_user`, servidor `172.20.0.2:5432`. Utiliza los routers y servicios reales, Argon2id real, Redis real y una entrega de correo de ensayo capturada en memoria. Esa entrega no es SMTP institucional. El transporte SMTP se prueba unitariamente con doble, sin conexiones externas.

La cuenta y persona previas, expediente y notificación son **fixtures de integración dentro de la transacción**, no radicaciones realizadas por el ciudadano. El expediente fixture lleva un identificador explícito de ensayo: no se invoca la función de CUT ni se lo presenta como un trámite creado por el formulario.

Antes y después: **19 personas, 10 cuentas, 38 expedientes, 8 notificaciones**. Las huellas agregadas de personas, cuentas, perfiles, expedientes DocuCore/TramiCore y notificaciones coinciden tras el ROLLBACK. No se borraron filas para limpiar pruebas. Los desafíos/cuotas Redis de ensayo tienen TTL; los OTP y pruebas utilizadas se consumieron. Las secuencias técnicas de auditoría que PostgreSQL use pueden avanzar incluso al revertir una transacción; no se generaron CUT de radicación.

Ejecución reproducible:

```powershell
.\backend\node_modules\.bin\tsx.cmd scratch/validar-m1-m3-cierre.ts
```

El script verifica el destino, limita las consultas, cierra PostgreSQL, Redis, su navegador y su servidor efímero en `finally`. No reinicia servicios. Las capturas `registro-real.png`, `autocompletado-real.png` y `reclamo-otp-real.png` solo contienen datos sintéticos de ensayo. El JSON no contiene contraseñas, JWT ni códigos OTP.

## Matriz de aceptación y pendientes

| Caso | Clasificación y alcance |
|---|---|
| A. Persona natural nueva → registro → login → M3 autocompletado | **IMPLEMENTADO Y VERIFICADO** en navegador + HTTP + PostgreSQL real, con reversión final. No se dejó una cuenta persistente. |
| B. Identidad anterior → OTP → misma persona → historial anterior | **IMPLEMENTADO Y VERIFICADO EN INTEGRACIÓN CONTROLADA** con PostgreSQL/Redis reales y correo de ensayo. **PENDIENTE** entrega SMTP institucional y validación del procedimiento manual. |
| C. Radicación autenticada con PDF → CUT → expediente → historial | Se preservó el código y pasaron las regresiones. **PENDIENTE** un E2E completo de radicación en esta intervención. |
| D. Radicación pública sin cuenta con PDF → CUT → cargo | Se preservó la modalidad y pasaron las regresiones de carga/radicación. **PENDIENTE** un E2E persistente nuevo en esta intervención. |
| E. Seguridad | **VERIFICADO** duplicidad, rol privilegiado rechazado, aislamiento por persona, OTP vencido/repetido/concurrente y límites. No equivale a certificación de identidad oficial. |
| F. Casilla | **VERIFICADO EN INTEGRACIÓN CONTROLADA**: destinatario correcto, notificación fixture persistida dentro de la transacción, titular autorizado y tercero rechazado. No se emitió un acto o acuse oficial. |
| Persona jurídica nueva | Implementación y pruebas unitarias de representante/OTP aprobadas. **PENDIENTE** validación integral del alta jurídica y de representación institucional. |
| Domicilio completo de cuenta | **OPCIONAL, PROPUESTO**: requiere aplicar la migración aprobada. No bloquea las cuentas mínimas. |

No se afirma haber completado el recorrido persistente de radicación y notificación oficial. Para el reclamo remoto falta un correo SMTP institucional autorizado y una prueba de entrega real con un destinatario controlado. Si no existe contacto original accesible, se requiere validación institucional manual; una dirección nueva aportada libremente nunca sustituye esa prueba.

La instalación de dependencias informó 26 vulnerabilidades en el conjunto instalado (15 moderadas, 8 altas y 3 críticas). No se atribuyen a una dependencia concreta sin un análisis adicional ni se ejecutó `npm audit fix`; queda pendiente revisar ese inventario antes de calificar el sistema como apto para producción.

## Estado del entorno y activación

Se preservaron los listeners existentes: backend 3008 PID 11140; frontend 5178 PID 21664. No se detuvo ni reinició ninguno. No se modificó `sigd_prueba`, Docker, volúmenes ni secretos. Las pruebas de API usaron un puerto efímero cerrado al terminar.

La sección 12 de la solicitud prohíbe reiniciar servicios automáticamente. Se solicitó autorización específica para activar el backend actualizado mediante un reinicio controlado de 3008. Hasta recibirla, la validación descrita corresponde al código actualizado en el harness, no a la versión cargada en ese proceso existente.

Git: rama y HEAD conservados. Había 272 entradas locales al inicio y 280 en la última comprobación; se preservaron todos los cambios anteriores. No se ejecutaron `reset`, `clean`, `restore`, `stash`, commits ni pushes. No se aplicó DDL ni una migración en ninguna base. Las únicas escrituras PostgreSQL de prueba se revirtieron en su transacción exterior.

## Activación autorizada y radicación persistente — 30/10/2026, 23:45 Perú

Esta sección actualiza los pendientes de activación y radicación pública anteriores. El usuario autorizó expresamente reiniciar **solo** el backend 3008 y continuar la validación integral con persistencia. No se modificó código de aplicación en esta intervención; se añadieron dos scripts de validación y sus evidencias, y se actualizó este informe.

### Entorno activado

- Rama `B_JACOBO`, HEAD `bf30d8a0c85e266a86381fb10bf3740a8451c032`; 280 entradas locales al inicio de esta continuación. No se restauraron archivos ni se hicieron commits/pushes.
- Se inspeccionaron el listener 11140, su padre 29120 y `scratch/run_backend.cjs`. Se compiló backend antes de detenerlo. Se reutilizó el mismo launcher, archivo privado de configuración, dirección y puerto.
- El primer relanzamiento no conservó la bandera de pago que solo existía en el entorno del proceso previo. Se corrigió con un segundo relanzamiento secuencial del mismo backend, heredando `SIGD_DEMO_OMITIR_PAGO=true`. Nunca hubo dos listeners de backend simultáneos. No se editó el archivo de secretos ni las tarifas.
- Estado final: backend **PID 12908**, launcher **3444**, listener único `127.0.0.1:3008`; frontend **PID 21664**, sin reinicio, en `127.0.0.1:5178`. PostgreSQL, Redis y MinIO no se reiniciaron.
- `MIGRATE_ON_BOOT=false`, `VITE_AUTOSTART=false`. No se ejecutaron migraciones, DDL ni modificaciones en `sigd_prueba`.
- Antes de las escrituras se verificó la conexión efectiva: destino `127.0.0.1:5433/sigd_jacobo_demo`, `current_database=sigd_jacobo_demo`, `current_user=sigd_jacobo_user`, servidor interno `172.20.0.2:5432`.
- `/health` y `/ready`: **200**. `/api/v1/auth/registro-capacidades`: **200**, `{domicilio:false, verificacionContacto:false}`. El registro mínimo funciona sin aplicar la ampliación domiciliaria propuesta. OTP real permanece desactivado por ausencia de transporte SMTP institucional configurado.

### M1 verificado contra el backend activo

Se utilizó Edge/Playwright, viewport 1448×1086, frontend 5178 y backend 3008 **sin interceptar API ni sustituir respuestas**. Se recorrió Login → Crear cuenta → formulario real → registro 201 → login 200 → `/auth/me` 200 → Mesa de Partes con identidad autocompletada y documento bloqueado.

Se conservó una cuenta de ensayo identificada con datos sintéticos DEMO, correo reservado `sandbox.invalid`, para que la radicación corresponda a una persona registrada mediante el servicio real. No se crearon cuentas de ciudadanos reales ni se utilizó una cuenta genérica para todas las solicitudes. Cuenta `44b18225-e19c-465b-b7f1-89ceabb70f86`, persona `1a378caa-8c94-4237-a6dc-65edbed59374`. Se verificaron hash **Argon2id**, contraseña contra el hash sin imprimirla y rol exclusivo **CIUDADANO**. La contraseña de ensayo solo existió en memoria; no se guardó en los artefactos. Esta prueba demuestra alta y acceso, no entrega de correo ni recuperación de contraseña.

Capturas inspeccionadas: `scratch/evidencias-activacion-m1-m3/01-registro-3008.png` y `02-autocompletado-3008.png`.

### M3: solicitud pública real completada

Se abrió un contexto independiente sin autenticación. Desde la portada se accedió a Mesa de Partes, se declararon los datos de esa persona DEMO, se seleccionó SUZ26-035 vigente, se adjuntó un PDF válido de una página clasificado FUT, se completaron las declaraciones y los cuatro pasos y se pulsó **Radicar Trámite** en el formulario real. El PDF no contiene notas, certificados académicos ni comprobantes de pago inventados.

La radicación histórica `EXP-2026-000034` se conservó y no se repitió. Esta solicitud nueva corresponde al escenario distinto `DEMO-M1-M3-ACTIVACION-20261030 — SUZ26-035 sin verificacion de pago`. El script verifica su asunto antes de presentar, y si ya existe no vuelve a registrarlo.

| Evidencia | Resultado real |
|---|---|
| Carga pública de PDF | HTTP **201**, sin cabecera Authorization; Siguiente habilitado después de cargar y clasificar FUT. |
| Radicación | HTTP **201** desde el botón real del paso 4. |
| CUT / número de expediente | **EXP-2026-000039** |
| UUID expediente | **1cea3141-4258-45d2-8e8f-9c58ce83de65** |
| Estado DocuCore | **REGISTRADO** |
| Fecha de envío real | `2026-10-31T04:39:47.280Z` = **30/10/2026 23:39:47.280 Perú**. |
| Fecha de radicación legal en TramiCore | `2026-11-02T13:00:00.000Z` = **02/11/2026 08:00 Perú**, diferida por corte horario según el servicio existente. |
| Persona solicitante | Coincide con la persona creada mediante registro ciudadano real. |
| Identidad entre dominios | DocuCore y TramiCore conservan el mismo UUID y CUT. |
| Cargo | Modal de recepción inspeccionado y consulta privada de la sesión pública `/tramites/publico/cargo` **200**. |
| MinIO | Bucket `sigd-sandbox-e2e`, objeto `expedientes/2026/11e62e8d-f817-4411-a3ee-f5250ac5df01.pdf`. |
| PDF | **1281 bytes**; recuperado desde MinIO y comparado byte por byte con el PDF enviado. |
| SHA-256 | `49f7840d07385877527ee368d67ed7b9ececa1358996e29acd7d17e708b7a01a`, igual a PostgreSQL y bytes MinIO. |
| Asiento | `de81053e-3f20-4875-b88b-05b09a618ddd`, número **10038**, canal `MESA_VIRTUAL`, no anulado. |
| Folios | **1–1**. |
| Auditoría pública | `30174e6c-ecb5-4371-9bea-3ba9522284e8`, actor público nulo, estado económico NO_VERIFICADO. |
| Pago | **NO_VERIFICADO**, modalidad **RADICACIÓN DEMOSTRATIVA SIN VERIFICACIÓN DE PAGO**. No se generó pago ni comprobante ficticio. |
| Duplicados del escenario | **1** expediente con el asunto de prueba. No se repitió el envío después del 201. |
| Expedientes anteriores | Huella de los **30** expedientes DocuCore previos idéntica; después existen **31**. TramiCore pasó de 38 a **39**. |
| Seguridad HTTP | Expedientes internos sin sesión **401**; consulta pública del CUT sin prueba de acceso **404**. |

Evidencias: `scratch/evidencias-activacion-m1-m3/resultado.json`, `trazabilidad.json`, `03-pdf-siguiente.png`, `04-confirmacion.png`, **`05-cargo-real.png`** y PDF `solicitud-demo-m1-m3.pdf`. La captura del cargo y la del autocompletado se inspeccionaron visualmente. El cargo es de recepción de solicitud DEMO; no acredita emisión de certificado académico, firma digital ni pago.

Conteos finales comprobados por consulta de solo lectura: **20 personas, 11 cuentas, 31 expedientes DocuCore, 39 expedientes TramiCore**. Se conservaron la cuenta y solicitud DEMO como evidencia; no se borraron registros para limpiar la prueba.

### Ejecuciones y errores de diagnóstico

| Comando / validación de esta continuación | Resultado |
|---|---|
| `node --import ./backend/node_modules/tsx/dist/loader.mjs ./scratch/serve_demo.ts --check` | Exit **0**, comprobaciones de lectura PostgreSQL/Redis/MinIO; no inició servicios. |
| Backend `npm run build` | Exit **0**. |
| Backend Vitest: identidadOtp + radicacion-publica | **2 archivos, 33 pruebas aprobadas**, exit **0**. Un tercer filtro escrito sin `.service` no correspondía a un archivo y no aportó pruebas; se ejecutó después la ruta correcta. |
| Backend Vitest: registroCiudadano.service + registroCiudadano.http + auth.router | **3 archivos, 150 pruebas aprobadas**, exit **0**. Los errores 5xx impresos pertenecen a escenarios negativos con dobles, no al backend activo. |
| Frontend Vitest: registroFormularios + publicUpload + radicacionPublicaService | **3 archivos, 30 pruebas aprobadas**, exit **0**. |
| Frontend `npx tsc --noEmit` | Exit **0**. |
| `node scratch/validar-activacion-m1-m3.cjs --continuar-publico` | Ejecución final exit **0**, recorrido público real 201 y persistencia verificada. Registro/login/autocompletado ya se habían completado en la primera ejecución del mismo harness. |
| `node scratch/verificar-activacion-persistencia.cjs` | Exit **0**, SELECT dentro de READ ONLY, asiento, folios, auditoría y correspondencia entre dominios. |
| `git diff --check` del alcance de aplicación | Exit **0**. |
| `git diff --check` global | Exit **1**, únicamente los dos espacios finales preexistentes en VentanillaPresencialPage.tsx 878 y 898; se conservaron por estar fuera de alcance. |

El primer ensayo del navegador llegó a registrar, iniciar sesión y autocompletar, pero falló al buscar un enlace con nombre accesible exacto; se corrigió solo el selector del script. En otra ejecución, la carga ya respondió 201 pero el colector intentó releer innecesariamente su cuerpo mediante CDP y falló. Se corrigió ese diagnóstico; esas cargas de preparación no generaron CUT ni expedientes y no se borraron sus objetos de MinIO. La repetición se limitó a la fase pública, conservando la única cuenta de ensayo. El lector SQL inicial usó alias inexistentes `cut/id_persona`; cerró su conexión en `finally` y se corrigió a `codigo_expediente/solicitante_id` antes de repetir. Ningún fallo se presentó como prueba aprobada.

### Clasificación final de esta activación

- **IMPLEMENTADO Y VERIFICADO:** backend actualizado activo, health/ready, registro nuevo, login, identidad estructurada autocompletada, carga pública PDF, cuatro pasos, radicación pública persistente, CUT, cargo, MinIO, asiento y auditoría; pago NO_VERIFICADO sin tarifas alteradas.
- **PENDIENTE:** E2E nuevo de radicación por el endpoint autenticado e historial de esta cuenta después de radicar. La continuación pública abrió otro contexto tras el primer fallo de selector y no se reutilizó una sesión autenticada ni se fabricó un JWT para dar por probado el historial. Las pruebas controladas anteriores de titularidad/historial siguen diferenciadas de este E2E persistente.
- **BLOQUEADO POR CONFIGURACIÓN EXTERNA:** entrega real de OTP al contacto original y reclamación remota de expedientes previos; falta configurar SMTP institucional autorizado. No se sustituyó por un código fijo ni se vinculó una identidad preexistente sin prueba.
- **NO VERIFICADO EN ESTE RECORRIDO:** recepción de una notificación institucional nueva en Casilla y firma/certificado académico oficial. No se emitieron comunicaciones oficiales ni se simularon esas etapas.

Por tanto, la activación y la radicación pública exigidas están comprobadas; **no se declara M1/M3 completamente cerrado en todos sus escenarios**. No se modificaron frontend, backend, contratos, esquema, roles, tarifas, Docker ni los expedientes anteriores durante esta activación.
