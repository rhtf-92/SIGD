# Continuidad segura del Certificado de Estudios — 27/10/2026

## Resultado ejecutivo

Se corrigieron la recepcion inicial, los reintentos de archivo, la validacion de Type Sig, el cierre de conexiones de prueba y una brecha de integridad de RutaDoc. Se ejecuto una radicacion DEMO real de SUZ26-035, con HTTP 201, y se verificaron Bandeja, Detalle, MinIO y SHA-256. **El certificado completo NO esta aprobado.**

El bloqueo real encontrado en PostgreSQL es `tr_auto_calificacion`: fabrica una proyeccion EN_CALIFICACION con operador fijo 1 e identificador de movimiento aleatorio, pero sin insertar la actuacion. No se desactivo ni se altero ese trigger. El backend ahora rechaza continuar sobre una proyeccion sin respaldo y React advierte la inconsistencia.

## Preservacion y base efectiva

Rama inicial/final: B_JACOBO. HEAD inicial/final: bf30d8a0c85e266a86381fb10bf3740a8451c032. Se comprobaron branch, HEAD, status y diff --stat antes de editar. Se verifico la existencia y se leyo CP-CONTINUIDAD-CERTIFICADO-20261027.md. Se inspeccionaron los servicios y los cambios previos; no se duplicaron las correcciones del payload, HMAC, Storage ni dialogo de archivo.

Inventarios: `scratch/continuidad-segura-git-inicial.txt`, `continuidad-segura-stat-inicial.txt`, `continuidad-segura-git-final.txt`, `continuidad-segura-stat-final.txt` y `continuidad-segura-archivos-final.txt`. El status inicial usa agrupacion de archivos nuevos; el final expandido no debe compararse como si tuviera el mismo formato. Staging vacio; sin commits, push, cambio de rama ni descartes.

Conexion verificada antes de escrituras: cliente 127.0.0.1:5433, base sigd_jacobo_demo, usuario sigd_jacobo_user, servidor interno 172.20.0.4:5432, aislamiento read committed. Se comprobaron tambien las conexiones efectivas del backend con application_name=sigd-jacobo-demo. No se accedio a sigd_prueba en esta intervencion, ni se modificaron sus permisos o datos. El backend permanece con su usuario tecnico.

## Causa raiz demostrada

La base contiene el trigger activo `tr_auto_calificacion`, funcion `sigd_tra.tr_fn_auto_calificacion()`, propietario postgres, huella MD5 de pg_get_functiondef: `34a857b114c3989219a4244d12d94b46`.

El trigger AFTER INSERT de sigd_tra.expediente:

- Inicializa movimiento_secuencia en 1.
- Inserta EN_CALIFICACION/INICIAR_CALIFICACION en estado_actual_expediente.
- Usa usuario_operador_id=1 y un UUID generado.
- No inserta ese movimiento en movimiento_tramite.

La definicion aparece en scratch/generate_demo_credentials.ts y un respaldo local. `git grep` no la encontro en backend de main. No se determino el autor ni la fecha de instalacion; no se atribuye su ejecucion a una herramienta concreta sin evidencia. No se ejecuto ese script de generacion ni se modifico una migracion.

El expediente nuevo conserva cero movimientos, pero su proyeccion dice EN_CALIFICACION. Por tanto no es correcto interpretar ese valor como recepcion/calificacion legitimamente realizadas.

## Cambios de esta intervencion

| Archivo | Cambio |
|---|---|
| backend/src/domains/docucore/verificadorPades.service.ts | Exige que el campo de firma apunte a un diccionario Type Sig; un CMS correcto con otro tipo se rechaza. Conserva verificacion real de ByteRange/CMS y el fallo seguro de confianza. |
| backend/src/domains/rutadoc/derivaciones.service.ts | Reutiliza la FSM para REGISTRADO + RECEPCION -> RECEPCIONADO, manteniendo DERIVADO -> EN_REVISION. Sin rutas, DTO o estados nuevos. Archivo: valida y normaliza ubicacion, bloquea antes de leer la proyeccion y reconoce el reintento identico del mismo actor sin duplicar cierre/Outbox. |
| backend/src/domains/rutadoc/rutadoc.router.ts | Despues de autorizar al actor, compara la proyeccion con movimiento real, expediente, secuencia, estado, evento, operador y fecha. Si no coinciden, las operaciones POST protegidas devuelven 409 ESTADO_SIN_TRAZABILIDAD antes de abrir la transaccion de negocio. |
| backend/src/domains/rutadoc/rutadoc.repository.ts | UltimoMovimiento proviene del movimiento real coincidente, no del identificador sin respaldo guardado en la proyeccion. Conserva el DTO y permite null, como ya establecia el contrato. |
| frontend/src/pages/expedientes/ExpedienteDetallePage.tsx | Recepcion segun estado y permiso/area persistidos; mensaje para recepcion inicial; exclusion inmediata de envios de archivo simultaneos; advertencia del estado no documentado y bloqueo de derivacion/archivo/proyeccion cuando corresponde. |
| scratch/e2e_runner/demo-contract.cjs | Conexion dentro de try/finally, connectTimeout 5s, queryTimeout/statement_timeout 15s, identidad READ ONLY comprobada y client.end aunque falle conexion o rollback. Logout intenta cerrar todas las sesiones y verifica refresh revocado con HTTP 401; fetch con timeout. |

Pruebas nuevas: archivo-idempotencia.spec.ts (5), estado-sin-trazabilidad.spec.ts (8), demo-contract.test.cjs (3). Se ampliaron verificadorPades.spec.ts, derivaciones.spec.ts, ExpedienteArchivoPage.test.tsx y ExpedienteRecepcionAction.test.tsx. Se ajusto el doble SQL de lecturas-http.spec.ts para representar una proyeccion consistente; no se eliminaron ni redujeron aserciones.

callbackRefirma.service.ts, docucore.router.ts, validadorCvd.controller.ts, resoluciones.service.ts y el productor/despachador corregidos previamente no se reescribieron en esta intervencion.

## Prueba real de SUZ26-035

El catalogo real devuelve SUZ26-035 vigente: Certificado de Estudios Superiores (6 semestres). La relacion documental existente es COMPROBANTE_PAGO, opcional. No se altero el catalogo ni sus requisitos.

Se utilizo ciudadano.demo y un PDF rotulado COMPROBANTE DEMO - SIN VALOR FISCAL NI ACADEMICO. No contiene notas ni acredita un pago real. La prueba demuestra admision tecnica del formulario y persistencia, no validacion material de pagos o antecedentes academicos.

| Evidencia | Resultado |
|---|---|
| Radicacion desde React | HTTP 201; un solo POST, sin repetirlo |
| CUT consumido | EXP-2026-000012 |
| Expediente | 6e1ca447-238a-4c03-869d-2690e674a397 |
| Procedimiento formal | 3443d0c0-ebaf-48d2-a4d0-2c32ec1fc6dd, verificado en sigd_doc.expediente |
| Documento adjunto | c38f7bd3-892f-49e6-abb8-363d862d7f16 |
| SHA-256 almacenado y recuperado | 4e300c665d220c3fcfa6b68d64d9764cc61f67f7cfc44dca54f98d5d8f636aea |
| Libro General | Un asiento asociado al expediente |
| Bandeja y detalle | Consulta autenticada y seleccion del expediente desde su fila real |
| PDF protegido | HTTP 200, recuperado de MinIO y hash coincidente |
| Recepcion de ventanilla.demo | No se envio: el estado observado ya era EN_CALIFICACION por el trigger, sin actuacion real |
| Prueba posterior de proteccion | HTTP 409 ESTADO_SIN_TRAZABILIDAD al intentar derivar; movimientos antes/despues: 0/0 |
| React despues de correccion | Advertencia visible y derivacion deshabilitada; no se presenta el UUID de proyeccion como actuacion |

La primera ejecucion del script termino con salida 1 por esperar un boton de recepcion incompatible con el estado encontrado. No se presenta como E2E aprobado. Se consulto la base, se identifico la causa y se reanudo **el mismo expediente**, sin crear otro. La comprobacion posterior de integridad termino con salida 0.

Evidencias: `scratch/certificado-seguro-e2e-resultados.json`, `certificado-seguro-reanudacion.json`, `certificado-seguro-detalle-ciudadano.png`, `certificado-seguro-integridad-react.png`. Scripts: certificado-seguro-nuevo.cjs, certificado-seguro-reanudar.cjs, certificado-proveniencia-readonly.cjs y certificado-ambito-readonly.cjs.

Se crearon tres sesiones en esta intervencion: ciudadano.demo y ventanilla.demo en la creacion, y una nueva de ventanilla.demo para la prueba negativa. Todas cerraron mediante el endpoint original y sus refresh tokens devolvieron 401. No se modificaron sesiones antiguas.

## Firma, webhook, WORM y Casilla

- CMS matematico: seis pruebas criptograficas reales con claves efimeras solo en memoria, sin atribuir confianza institucional. Type Sig invalido, PDF sin firma, bytes/CMS alterados y contenido posterior se rechazan. No se fabrico un certificado confiable ni un sello TSA.
- Integracion real negativa: se envio al backend local un callback HMAC del cuerpo exacto con el PDF DEMO sin firma. Respondio 400 VALIDATION_ERROR, parametro firmaPades. El hash era real y coincidente: aun asi no se acepto como firma. Firmas, resoluciones, auditoria y Outbox permanecieron iguales. No se invoco un proveedor externo.
- Falta integrar politica de raices de confianza, revocacion y TSA e identidad certificada del firmante. El verificador sigue sin acreditar autenticidad oficial. El callback de recibo de sesion y el HMAC documental no tienen aun una vinculacion integral definida en su contrato; no se agregaron campos al DTO para inventarla.
- El secreto webhook esta configurado y su valor no se imprimio. Se conservan HMAC rawBody, comparacion temporalmente segura, timestamp obligatorio, bloqueo documental y comprobacion de duplicados existentes. Las regresiones positivas de persistencia usan mocks expresamente identificados.
- El esquema y las tablas de auditoria pertenecen a postgres. Los tres roles operacionales no pueden crear objetos en sigd_audit; la bitacora conserva SELECT/INSERT y el Outbox SELECT/INSERT/UPDATE, sin DELETE/TRUNCATE.
- Las nueve operaciones negativas WORM con sigd_jacobo_user, sigd_app y sigd_worker devolvieron SQLSTATE 42501. La transaccion termino en ROLLBACK. La conexion administrativa de prueba fue por socket dentro del contenedor, especificamente a demo; el backend no usa ese usuario.
- No se aplicaron GRANT, REVOKE ni cambios de propietario. Limite: el usuario tecnico sigue siendo propietario de la base demo; no se acredita inmutabilidad frente al propietario de la base o al administrador.
- El evento 088f24f1-4eb6-42cb-91b4-bb64a6810dc3 sigue FALLIDO, intentos 5. No se completo artificialmente su payload ni se reproceso una resolucion sin firma acreditada.
- No se emitieron notificaciones, acuses ni constancias nuevas. La descarga firmada y el productor de Casilla conservan sus regresiones, pero la entrega positiva institucional no fue demostrada.

## Resultados exactos

| Prueba | Resultado final |
|---|---|
| Backend, suite global unitaria | 1240 aprobadas, 10 omitidas; 74 archivos aprobados y uno omitido; salida 0 |
| Frontend, suite global | 716 aprobadas, una omitida; 64 archivos aprobados; salida 0 |
| Helper Node, cierre de conexiones | 3/3 aprobadas; salida 0 |
| Typechecks backend y frontend | Ambos salida 0 |
| HTTP real | /health 200, /ready 200, frontend 200, Casilla sin JWT 401, CVD mal formado 400, CVD inexistente 404, PDF sin firma con HMAC correcto 400 |
| E2E persistente nuevo | Radicacion, relacion TUPA, asiento y PDF comprobados; continuidad detenida por estado sin trazabilidad |
| Reanudacion negativa en Chrome/API | Advertencia y 409 comprobados, sin movimientos nuevos; salida 0 |
| git diff --check | Salida 0 usando la configuracion original de Git |

Las primeras regresiones detectaron tres fixtures frontend sin permisos y tres dobles SQL que no respondian la nueva consulta de integridad. Se corrigieron los datos controlados de prueba, conservando las aserciones. Un diff --check con core.autocrlf=false produjo avisos de CRLF preexistentes; no se normalizaron archivos ni se cambio la configuracion persistente. La comprobacion final normal devolvio 0.

Logs: `scratch/continuidad-segura-backend-final.log`, `continuidad-segura-frontend-final.log`, `certificado-seguro-http.json`, `continuidad-segura-estado-final.json`. No se ejecuto provisionamiento de contenedores ni la suite E2E de nueve modulos que generaria otros registros. No se declara una firma oficial o un certificado completo a partir de mocks.

## Matriz de cierre

| Requisito | Clasificacion | Limite real |
|---|---|---|
| Cierre de conexiones y sesiones de prueba | CORREGIDO Y VALIDADO | Fallos de conexion/consulta/rollback probados; sesiones reales revocadas |
| Validacion estructural y matematica PDF/CMS | CORREGIDO Y VALIDADO | No equivale a confianza institucional |
| PAdES institucional, identidad y TSA | CORREGIDO, PERO CON VALIDACION INTEGRAL PENDIENTE | Politica/integracion de confianza pendiente; DNIe/cliente/certificado institucional no probados |
| Vinculacion integral de sesion y webhook | CORREGIDO, PERO CON VALIDACION INTEGRAL PENDIENTE | Contrato del emisor pendiente de definir, sin modificar DTO unilateralmente |
| Archivo e idempotencia | CORREGIDO, PERO CON VALIDACION INTEGRAL PENDIENTE | Pruebas con mocks; no existe un RESUELTO legitimamente alcanzado para este tramite |
| Recepcion inicial | CORREGIDO, PERO CON VALIDACION INTEGRAL PENDIENTE | FSM/servicio/UI probados; el trigger impide una prueba legitima en el expediente nuevo |
| Proteccion frente a estados sin respaldo | CORREGIDO Y VALIDADO | 409 real y advertencia visual; no repara la proyeccion |
| Trigger de autocalificacion | DEFECTO REPRODUCIDO Y AUN NO CORREGIDO | Requiere DDL expresamente prohibido en el alcance actual |
| Fuente academica y emision del certificado | BLOQUEADO POR DEPENDENCIA EXTERNA | No se encontro fuente academica autorizada persistida ni integracion de emision utilizable; sin notas inventadas |
| Notificacion, constancia y E2E completo | CORREGIDO, PERO CON VALIDACION INTEGRAL PENDIENTE | Sin documento oficialmente firmado ni transiciones legitimas completas |
| WORM frente a roles operacionales | CORREGIDO Y VALIDADO | No protege frente a administradores/propietario de la base |

## Operacion concreta pendiente de autorizacion — NO EJECUTADA

La restriccion actual prohibe alterar el esquema y los triggers. Desactivar el atajo requiere ALTER TABLE. Esta propuesta solo afecta demo, conserva la funcion, datos, volumenes y el expediente de prueba. Primero se debe guardar externamente la definicion actual del trigger/funcion y comprobar su huella. Debe ejecutarla el administrador autorizado, nunca el backend.

```sql
SELECT current_database(), current_user, inet_server_addr(), inet_server_port();
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $$
BEGIN
  IF current_database() <> 'sigd_jacobo_demo' OR current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Destino o administrador no autorizado';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    WHERE t.tgrelid = 'sigd_tra.expediente'::regclass
      AND t.tgname = 'tr_auto_calificacion'
      AND md5(pg_get_functiondef(t.tgfoid)) = '34a857b114c3989219a4244d12d94b46'
  ) THEN
    RAISE EXCEPTION 'El trigger cambio: detener y revisar';
  END IF;
END $$;
ALTER TABLE sigd_tra.expediente DISABLE TRIGGER tr_auto_calificacion;
SELECT tgname, tgenabled FROM pg_trigger
 WHERE tgrelid = 'sigd_tra.expediente'::regclass AND tgname = 'tr_auto_calificacion';
COMMIT;
```

Reversion preparada, no automatica: despues de las mismas comprobaciones de destino y huella, `ALTER TABLE sigd_tra.expediente ENABLE TRIGGER tr_auto_calificacion;`. Restauraria tambien el comportamiento inseguro anterior, por lo que requiere una decision explicita.

Desactivar el trigger **no repara EXP-2026-000012**. Su proyeccion sin respaldo debe conservarse hasta aprobar una reconciliacion desde actuaciones reales, sin fabricar movimientos retroactivos. Tambien falta una operacion publicada para INICIAR_CALIFICACION: no se sobrecargo recepcionar ni se creo otra ruta para saltar esa decision contractual. Estas decisiones y la fuente academica/firma deben cerrarse antes del E2E completo.

## Integridad y servicios

Se autorizo y consumio un CUT y un asiento para la prueba DEMO. Persistieron un expediente con identidad compartida entre DocuCore/TramiCore, su tramite, adjunto/folio y objeto S3, ademas de las sesiones. El trigger preexistente produjo la proyeccion/secuencia defectuosas como efecto del INSERT; se investigaron y conservaron. No se actualizaron manualmente estados, no se eliminaron registros, no se generaron resoluciones, firmas, CVD, notas, notificaciones o constancias.

Conteos finales: 12 expedientes, 13 adjuntos, 5 resoluciones, 1 registro historico de firma, 7 eventos Outbox, 8 asientos de auditoria y 2 notificaciones. Solo los dos primeros aumentaron respecto a la continuidad anterior; las escrituras indirectas de proyeccion/contador del trigger se explican arriba.

PostgreSQL, Redis y MinIO existentes permanecen saludables; no se modificaron Docker, volumenes, Compose, secretos, puertos ni migraciones. Migraciones automaticas desactivadas. Backend y frontend actualizados quedan en 3008/5178, PID 22808 y 20968 al cierre. No quedaron navegadores de prueba ni diagnosticos abiertos. Los servicios originales de infraestructura y el worker Outbox existente permanecen activos.

No hubo escrituras, accesos, cambios de permisos ni modificaciones de sigd_prueba. No se aplico DDL. Los intentos SQL de UPDATE/DELETE/TRUNCATE de la bitacora fueron expresamente rechazados; no se confunden con modificaciones historicas efectivas.


Inventario Git expandido final: 430 entradas; staging vacio. HEAD y rama conservados. git diff --check final: salida 0.
