# Continuidad del Certificado de Estudios: correcciones y validacion controlada

Fecha: 27/10/2026. Rama `B_JACOBO`. HEAD `bf30d8a0c85e266a86381fb10bf3740a8451c032`.

## Resultado ejecutivo

Se corrigieron defectos reales de callback, Outbox, descarga de Casilla, verificacion CMS y archivado React. El recorrido completo del certificado **NO esta aprobado**. No se genero un certificado academico, firma oficial, CVD, notificacion, constancia ni archivo para aparentar su cierre.

## Preservacion y estado recuperado

Antes de editar se ejecutaron branch, HEAD, status, diff --stat y diff --check. El inventario inicial tiene 384 entradas con `--untracked-files=all`, incluidos 156 archivos rastreados modificados. Esta cifra no es directamente comparable con status sin expandir carpetas. Snapshot: `scratch/continuidad-certificado-git-inicial.txt`; huellas: `scratch/continuidad-certificado-huellas.json`. Staging vacio. No hubo cambios de rama, commits, push ni operaciones de descarte.

Los hashes de `resoluciones.service.ts` y `docucore.router.ts` permanecieron iguales a los iniciales: se conservaron las modificaciones anteriores de Antigravity. No se reimplementaron RBAC, Mesa de Partes ni TUPA.

Conexion comprobada: Windows `127.0.0.1:5433/sigd_jacobo_demo`, usuario `sigd_jacobo_user`; servidor interno `172.20.0.4:5432`. La aplicacion no usa superusuario. Sobre `sigd_prueba` solo se consulto identidad de conexion dentro de una transaccion READ ONLY; no se ejecutaron escrituras, cambios de permisos ni migraciones. No existe aqui evidencia para certificar cambios hechos por otras herramientas antes de esta intervencion.

Estado real de demo recuperado: 11 expedientes, 5 resoluciones, 12 adjuntos, 1 registro historico de firma, 8 asientos de auditoria, 7 eventos Outbox y 2 notificaciones. Las cinco resoluciones estaban en BORRADOR_PENDIENTE_FIRMA. El PDF historico `RD-2026-000009_firmada.pdf` existe en MinIO, pero el verificador nuevo devuelve SIN_FIRMA, criptografia=false y valido=false.

## Correcciones de produccion

| Archivo | Correccion y limite |
|---|---|
| `backend/src/domains/docucore/callbackRefirma.service.ts` | Alias `cu.id_usuario AS usuario_id`; rechazo de destinatarios ambiguos; payload con CUT, asunto y documento. La resolucion se identifica por su adjunto y clave canonica de origen, sin actualizar todas las resoluciones del expediente. Timestamp de webhook obligatorio, HMAC del rawBody conservado. El PDF debe superar la verificacion: `REFIRMA_EXIGIR_PADES=false` ya no omite controles. |
| `backend/src/domains/docucore/verificadorPades.service.ts` | Sustituye parser CMS artesanal por PDF-lib, ASN1js y PKIjs. Campo real de firma, ByteRange, correspondencia Contents, CMS detached y firma matematica. Rechaza revisiones posteriores y documentos multifirma no comprobados. No inventa una fecha TSA. |
| `backend/src/domains/docucore/validadorCvd.controller.ts` | SHA-256 y estado SQL no bastan para esValido=true. Espera el verificador, no ofrece copia certificada sin acreditacion, no publica una fecha declarada como TSA verificada. |
| `backend/src/domains/docucore/firma.service.ts` | Valida hash y referencia de sesion antes de consumir GETDEL; un callback mal formado no destruye una sesion legitima. |
| `backend/src/audit/despachador-notificaciones.ts` | Una Casilla ausente genera fallo reintentable; no se confirma una entrega inexistente. La indisponibilidad no queda almacenada para siempre. |
| `backend/src/domains/identicore/casilla.router.ts` | Reconoce la referencia opaca creada por Outbox, comprueba el expediente y obtiene una URL vigente. Para resoluciones utiliza el artefacto registrado en firma_digital_documento y lo coteja antes de descargar; no entrega el borrador. Misma ruta y respuesta existentes. |
| `frontend/src/pages/expedientes/ExpedienteDetallePage.tsx` | Completa el dialogo de archivo con estante, balda, caja y observaciones, envio al endpoint original, carga, errores y conservacion de campos. Boton restringido a RESUELTO y facultad EXPEDIENTE_RESOLVER global o del area actual. Backend conserva la FSM y la autorizacion. |
| `backend/package.json`, `backend/package-lock.json` | Dependencias ASN1js y PKIjs para criptografia mantenida. Sin nueva arquitectura. |
| `scratch/serve_demo.ts` | Lanza Node directamente y registra su PID; el registro anterior apuntaba al wrapper cmd/npx y el reiniciador no podia identificarlo. |
| `scripts/iniciar-sigd-local.ps1` | Elimina una limpieza obsoleta de `$serverEnv`, variable inexistente que provocaba salida 1 despues de un inicio correcto. Sin cambios de destinos ni secretos. |

### Limites criptograficos y del protocolo

La validacion matematica CMS esta implementada y probada con criptografia real. **La cadena institucional, revocacion OCSP/CRL y TSA confiable no estan integradas.** El verificador devuelve valido=false incluso cuando la matematica es correcta pero la confianza no esta acreditada. No basta con suministrar un certificado: falta conectar una politica de confianza aprobada. En este estado, el callback no puede confirmar una firma oficial.

No se inventaron variables de confianza, certificados institucionales ni claves privadas persistentes. Los certificados efimeros de pruebas solo existen en memoria y se identifican como NO INSTITUCIONALES.

El HMAC sigue calculandose sobre el cuerpo exacto del protocolo existente. El timestamp de cabecera no esta ligado al HMAC por ese contrato. La idempotencia persistida usa el bloqueo del documento y conserva el CVD de un reintento identico. No se ha demostrado concurrencia real de callbacks contra PostgreSQL. El callback HMAC documental y el callback de recibo de sesion siguen siendo mecanismos distintos; su vinculacion integral requiere definir el protocolo del proveedor, sin agregar unilateralmente campos al DTO.

## Outbox y Casilla

El evento `088f24f1-4eb6-42cb-91b4-bb64a6810dc3` permanece FALLIDO, intentos=5. Su payload historico carece de destinatario/CUT/asunto completos. No se modifico ni se reencolo: su resolucion no tiene evidencia oficial de firma y no corresponde notificarla como firmada. No se encontro un mecanismo de recuperacion administrativa que permita completar y reprocesar ese caso sin una decision adicional.

Si un solicitante presencial no tiene cuenta, no se asigna la cuenta de otro ciudadano: el consumidor rechaza el destinatario nulo y no confirma entrega. No hubo correos externos ni nuevos eventos de negocio. Casilla real de director.demo: HTTP 200, contadores cero y estado vacio visible en Chrome. No demuestra la entrega positiva de una resolucion.

## WORM: evidencia real del motor

El esquema sigd_audit y las tablas bitacora_auditoria/evento_outbox pertenecen a postgres. Los roles sigd_jacobo_user, sigd_app y sigd_worker no son miembros del propietario; no son superusuarios, no pueden crear roles ni eludir RLS. No pueden crear objetos en el esquema de auditoria. No tienen UPDATE de ninguna columna de la bitacora; no hay funciones SECURITY DEFINER en ese esquema ni secuencias en el resultado consultado.

No fue necesario aplicar GRANT, REVOKE ni cambios de propietario. Los tres roles tienen SELECT/INSERT sobre bitacora. Outbox conserva SELECT/INSERT/UPDATE para el despachador, sin DELETE/TRUNCATE.

Se probaron UPDATE WHERE FALSE, DELETE WHERE FALSE y TRUNCATE sobre la bitacora con los tres roles, previa comprobacion de ausencia de privilegios. **Los nueve intentos fueron rechazados con SQLSTATE 42501**, no con una simple violacion de READ ONLY. La transaccion termino en ROLLBACK. No se eliminaron ni alteraron registros historicos. Script: `scratch/continuidad-worm-privilegios.sql`.

Limite: sigd_jacobo_user todavia es propietario de la base demo. La proteccion demostrada es frente a operaciones sobre la bitacora, no frente a un administrador o al borrado integral de la base. Separar tambien la propiedad de la base es un endurecimiento adicional no ejecutado aqui.

## Pruebas y evidencia

| Comprobacion | Resultado y alcance |
|---|---|
| Suite global unitaria backend | 1225 aprobadas, 10 omitidas; 72 archivos aprobados y 1 omitido; salida 0. `scratch/continuidad-backend-unit-final.log`. |
| Suite global frontend | 713 aprobadas y 1 omitida, 64 archivos aprobados; salida 0. `scratch/continuidad-frontend-final.log`. Incluye pruebas de interfaz/integracion con contratos simulados. |
| Typecheck backend / frontend | Ambos salida 0. |
| Criptografia real en pruebas | 5 casos: PDF sin firma, CMS matematicamente valido pero sin confianza, bytes alterados, firma CMS alterada conservando certificado/digest, bytes posteriores. No hay persistencia ni firma oficial. |
| Archivado React | 4 pruebas con mocks: permiso/area, estado, envio correcto y fallo con campos conservados. No prueba persistencia real. |
| Descarga Casilla / Outbox | 4 nuevas pruebas con mocks: referencia opaca, artefacto firmado cotejado, ausencia de evidencia y rechazo ajeno. Regresiones existentes de idempotencia, HMAC y transaccion incluidas. |
| HTTP real | health=200, ready=200; login=200, perfil=200; Casilla=200; estado de firma sin JWT=401; CVD inexistente=404; callback sin autenticacion=403; logout=200 y refresh revocado=401. |
| Chrome real | Firma y Casilla visibles tras esperar desaparicion del splash; cero excepciones JS en el recorrido final. `scratch/continuidad-firma-react.png` y `scratch/continuidad-casilla-react.png`. |
| MinIO real | Bucket disponible; adjunto `00000000-0000-0000-0000-000000000301`, 322 bytes, SHA-256 coincidente. PDF historico con sello visual rechazado como SIN_FIRMA. Solo HEAD/GET/LIST. |
| Recorrido parcial real | `node --import ./backend/node_modules/tsx/dist/loader.mjs scratch/e2e_runner/continuidad-certificado-real.cjs`: ejecucion final salida 0. Resultados en `scratch/continuidad-e2e-resultados.json`. NO equivale al E2E del certificado. |
| Integridad de datos | Conteos iniciales/finales identicos: expedientes 11, resoluciones 5, adjuntos 12, firmas 1, auditoria 8, Outbox 7, notificaciones 2. No es una comparacion criptografica de toda la base. |
| Sesiones | Seis ciclos con director.demo durante depuracion y validacion visual. Cada uno cerro en finally con logout 200 y reutilizacion de refresh 401. No se modificaron sesiones antiguas. |

Los intentos previos del script real fallaron por selectores ambiguos, espera prematura del splash, busqueda de un expediente no archivable y formato incorrecto del CVD de prueba. Se corrigio el script; esas ejecuciones NO se cuentan como E2E aprobadas. Los servicios y las sesiones quedaron controlados en cada intento.

Pruebas modificadas: callbackRefirma.spec.ts, firma.resolucion.spec.ts, validadorCvd.spec.ts, firma.service.spec.ts, firma.estado.spec.ts, firma.app.spec.ts, docucore.router.adversarial.spec.ts, app-routes.spec.ts y despachador-notificaciones.spec.ts. Nuevas: verificadorPades.spec.ts, casilla-documento-outbox.spec.ts y ExpedienteArchivoPage.test.tsx. Los mocks criptograficos de contratos HTTP/SQL estan rotulados; no sustituyen los cinco casos criptograficos reales.

No se ejecuto la suite DB con provisionamiento de contenedores ni la suite persistente completa de nueve modulos. La prueba positiva academica/firma sigue sin sus fuentes legitimas; ejecutar otros registros no demostraria ese recorrido. No se informa un E2E completo como aprobado.

## Matriz de aceptacion y continuidad

| Criterio | Evidencia | Estado |
|---|---|---|
| Compilacion y regresiones | Typechecks y suites anteriores | Probado |
| Webhook autenticado, rawBody, timestamp e idempotencia | Unitarias, HTTP negativo, bloqueo documental existente | Corregido; concurrencia real y vinculacion completa de sesion pendientes |
| Firma PAdES oficial | CMS matematico probado; sin raices/revocacion/TSA integradas ni cliente oficial probado | Parcial, no autenticidad acreditada |
| Minimo privilegio/WORM | 42501 real en nueve operaciones; propietarios y privilegios consultados | Probado para bitacora; propiedad de la base sigue pendiente de endurecer |
| Productor resolucion_emitida | Alias, payload, destinatario y documento probados con mocks | Implementado; sin entrega positiva real |
| Notificacion y constancia | Lectura real Casilla; evento historico no reprocesado | Pendiente |
| Certificado y resolucion asociados | SUZ26-035 vigente; cero expedientes con esa relacion formal en sigd_doc | Bloqueado por fuente academica e integracion institucional faltantes |
| Archivado | Dialogo/contrato probados; no hay RESUELTO canonico disponible | Implementado; persistencia pendiente |
| Expediente y trazabilidad completos | No se genero otro expediente ni CUT | E2E completo no ejecutado |
| Preservacion | Sin escrituras en sigd_prueba, sin migraciones/DDL exitoso/cambios de esquema, Docker y fuentes previas conservados | Comprobado para las operaciones de esta intervencion |

El expediente `00000000-0000-0000-0000-000000000142` figura RESUELTO en TramiCore, pero EN_CALIFICACION en la vista canonica de RutaDoc. La interfaz oculta el archivo conforme a la FSM; no se modificaron estados para sortearla.

Decisiones indispensables, en orden:
1. Fuente autorizada de asignaturas, periodos y notas y contrato institucional de emision de certificado. No se encontro una fuente academica persistida ni un servicio de emision de SUZ26-035 que pueda reutilizarse sin inventar datos. No se crearon tablas ni registros para suplirla.
2. Proveedor/cliente ReFirma y certificado legitimos, politica de raices aprobadas, revocacion y TSA, y vinculacion entre solicitud/sesion y callback documental. Integrar esa politica al verificador antes de permitir confirmaciones positivas.
3. Ejecutar las actuaciones legitimas de RutaDoc hasta RESUELTO y probar el archivo. No sincronizar estados mediante SQL directo.
4. Producir un nuevo evento legitimo firmado para Casilla y comprobar su descarga/constancia. No reparar el evento historico para aparentar una firma inexistente.

## Estado operativo final

Se conservaron PostgreSQL, Redis y MinIO canonicos, sin reconstruir, detener ni recrear contenedores o volumenes. Migraciones automaticas desactivadas. Se recargaron exclusivamente los procesos locales identificados para activar el codigo corregido. El iniciador reutiliza 3008/5178 sin duplicar workers y `npm run dev` termino con salida 0. Las sondas del arranque final fueron 200.

No se aplicaron cambios de permisos, DDL exitoso, migraciones ni cargas. Las unicas escrituras persistidas por esta intervencion fueron las sesiones de prueba y su revocacion, en demo. No se consumieron CUT ni asientos, no se generaron certificados o resoluciones nuevas y no se alteraron objetos MinIO.

Git final: B_JACOBO y HEAD sin cambios, staging vacio. Inventario final y estadistica: `scratch/continuidad-certificado-git-final.txt`, `scratch/continuidad-diff-final-stat.txt`, `scratch/continuidad-diff-final-nombres.txt`. `git diff --check` salida 0. Las diferencias preexistentes de migraciones, Compose y otros dominios permanecen; no son cambios efectuados en esta intervencion.

Referencia de la biblioteca usada: https://pkijs.org/docs/api/classes/SignedData/ . Su verificacion CMS no reemplaza por si sola la politica institucional de confianza, revocacion y TSA.

Inventario expandido final: 407 entradas frente a 384 iniciales; staging vacio. El ultimo reinicio controlado termino con salida 0 y dejo backend/frontend disponibles. La ultima regresion focalizada de descarga de Casilla aprobo 4/4 despues del endurecimiento del filtro de resoluciones.
