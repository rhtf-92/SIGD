# Migración 13 y radicación pública con pago — cierre verificado

Fecha de comprobación: 2026-10-31T14:39:13.043Z. Rama B_JACOBO; HEAD bf30d8a0c85e266a86381fb10bf3740a8451c032. Se conservaron los cambios locales, sin commits ni pushes.

## Resultado ejecutivo

IMPLEMENTADO, ACTIVADO Y VERIFICADO EN NAVEGADOR REAL: portada → Mesa de Partes sin cuenta → identidad declarada → orden pública → cobro de efectivo por TESORERO → recibo → PDF → radicación → CUT → cargo → seguimiento autorizado. La API fue la instancia real 3008 y el frontend existente5178. No hubo respuestas simuladas, proxy hacia un servidor de fixtures ni inserciones manuales de expedientes.

Todas las recepciones/entregas de efectivo de los ensayos tienen demostracion=true y recibos DEMO, SIN MOVIMIENTO DE DINERO REAL. No se acreditan operaciones bancarias ni validez tributaria.

## Migración exclusiva y compatibilidad

Se revisó íntegramente backend/migraciones/pendientes/13_sigd_tes_orden_publica.sql. Aflojar NOT NULL en ciudadano_id permite una modalidad pública; no elimina valores ni personas. Las columnas nuevas y el CHECK exigen alternativamente cuenta autenticada o capacidad pública con declaración. El índice único protege los reintentos públicos.

Antes de aplicar se quitaron BEGIN/COMMIT propios de la propuesta: el runner institucional ejecutarMigraciones controla la transacción, de modo que DDL y registro de checksum se confirman juntos. Se mantuvieron las guardas de base/usuario demo y lock_timeout5s. No se editó el runner general.

Se usó la conexión privada existente, comprobada como sigd_jacobo_demo / sigd_jacobo_user en PostgreSQL172.20.0.2:5432, accedida por127.0.0.1:5433. Se ejecutó el runner con MIGRATIONS_DIR apuntando a un directorio temporal que contenía SOLO13; mutex institucional987654321 y espera máxima5s. No se recorrieron los demás scripts pendientes ni se alteraron sus registros.

Migración registrada: 13_sigd_tes_orden_publica.sql. Fecha: 2026-10-31T14:25:14.183Z. SHA-256: 79658edd81fa0a9c1351ae11a836a7cd11152943da9a455158a52b0f6712062b. Fue el único script aplicado. El archivo conserva su ubicación original pendientes; su estado aplicado en demo consta en public.sigd_migraciones. No ejecutar el conjunto general para repetir esta operación.

Las huellas de los hechos previos coincidieron inmediatamente antes/después de DDL. La comprobación final preservó dieciocho conjuntos históricos, excluyendo únicamente los nuevos registros de los dos ensayos autorizados. No se eliminaron operaciones ni se reiniciaron correlativos. Las versiones10/11/12 y las dieciocho tarifas no cambiaron.

## Activación

Único reinicio: backend2752 → 25760, lanzador29184 → 13384; mismo scratch/run_backend.cjs y archivo de entorno, con hash conservado. FrontendPID8120 sin reinicio. Un listener en3008. /health=UP y /ready=READY.

MIGRATE_ON_BOOT=false y SIGD_DEMO_OMITIR_PAGO=true conservados. Redis, PostgreSQL y MinIO continuaron healthy, sin reinicios. No se tocó Docker Compose ni sigd_prueba. El stderr del nuevo backend estaba vacío al cierre.

## Recorrido público persistente

| Dato | Resultado |
|---|---|
| Persona | DEMO Publico Sin Cuenta; DNI de ensayo con ceros iniciales |
| Cuenta de usuario creada | Ninguna; ciudadano_id=NULL |
| Procedimiento | SUZ26-035, Certificado de Estudios Superiores (6 semestres) |
| Tarifa backend | S/124.00 |
| Orden | OP-2B019A44-4409-448D-8EC4-DBEC7BF223D3 |
| Pago | 985c7e55-7445-4414-b102-4bd874014533 |
| Recibo interno | DEMO-RC-3 |
| Efectivo entregado en ensayo | S/150.00 |
| Importe aplicado | S/124.00 |
| Vuelto | S/26.00 |
| CUT | EXP-2026-000041 |
| Expediente | 99c15974-38a7-4a50-8aaf-811f168a64d1 |
| Estado inicial | REGISTRADO |
| Fecha de envío real | 2026-10-31T14:33:03.603Z |
| Fecha legal | 2026-11-02T13:00:00.000Z, lunes08:00 Perú según regla vigente de día no hábil |

La persona accedió desde el enlace real de la portada. No pasó por login ni registro. Hubo cero solicitudes públicas con JWT. El TESORERO inició sesión con la identidad QA existente, buscó la orden por su código y confirmó recepción. El público consultó su misma orden, obtuvo estado VERIFICADO y descargó su recibo. El PDF se cargó por el endpoint real, permitió continuar, y la solicitud se envió desde Radicar Trámite. Respuesta201, cargo visible y consulta posterior200.

La radicación usó ordenPagoId explícito: el backend comprobó titularidad por persona y hash de sesión y el pago verificado, y creó aplicacion_pago en la misma transacción del expediente. El mensaje legal y datos_declarados no quedaron etiquetados NO_VERIFICADO ni como omisión de pago. El flag demo general se mantuvo activo para los otros ensayos, pero no sustituyó la comprobación del pago vinculado.

El cargo se verificó en el formulario y se conservó una impresión PDF del navegador. No se afirma que ese PDF de impresión tenga firma digital ni que se almacenara como cargo firmado en MinIO. MinIO sí contiene el PDF de solicitud y los recibos financieros verificados.

## Recorrido registrado y devolución nueva

Se reutilizó la cuenta ciudadana QA existente. Login → identidad autocompletada → orden nueva → recepción exacta124.00 → PDF → radicación → cargo → Mis trámites.

- Recibo: DEMO-RC-4; vuelto0.00.
- CUT: EXP-2026-000042.
- Expediente: 5d2cbfbe-0406-4b45-9907-a6337f1eac54.
- Solicitud de devolución nueva: DEV-41D7C8D9-4AD7-4CE7-9619-B714CFD5C219, importe124.00.
- El mismo TESORERO evaluó, aprobó, confirmó la entrega de efectivo de ensayo, generó constancia y cerró la solicitud. No se reutilizó ni modificó una devolución histórica.
- Caja de esta fase: inicial0.00 + ingreso público124.00 + ingreso registrado124.00 - devolución124.00 = esperado124.00. Contado124.00, diferencia0.00; caja cerrada.

No se asignaron roles a usuarios ni trabajadores. Las cuentas financieras anteriores no se sustituyeron por otras; la identidad TESORERO continúa siendo exclusivamente QA.

## Seguridad e integridad

- Acceso por ID de orden sin capacidad:403.
- Otra sesión pública válida:404 para orden, recibo, cargo y seguimiento ajenos.
- Seguimiento sin capacidad:404; con capacidad del formulario:200, con identidad enmascarada.
- Administración sin JWT:401; ciudadano autenticado intentando abrir caja:403.
- Ciudadano intentando consultar la orden pública ajena por la API privada:404.
- React enviando importe definitivo:400, sin cobro ni alteración de tarifa.
- Dos reintentos concurrentes de la misma orden devolvieron el mismo ID y no crearon otra orden.
- Una aplicación por orden; CUT y expediente independientes por modalidad. No se crearon duplicados.
- Cinco archivos MinIO descargados y cotejados: dos solicitudes PDF, dos recibos de ingreso y constancia de ejecución de devolución. SHA-256 y tamaños coinciden con PostgreSQL.
- Dieciocho conjuntos históricos conservados, incluidas personas/cuentas, RBAC, TUPA, tarifas, órdenes, pagos y expedientes.
- La capacidad pública no se imprimió en logs. El estado de recuperación del ensayo está cifrado con AES-256-GCM; la clave no se guarda en evidencias. El cargo y su QR son privados porque permiten seguimiento; no publicarlos en repositorios o canales abiertos.

No se añadieron búsquedas públicas de personas por DNI, accesos a expedientes anteriores ni vinculación automática de identidad. M1 y su mecanismo de reclamación segura permanecen intactos.

## Pruebas ejecutadas en esta activación

| Prueba | Resultado |
|---|---|
| Build backend y frontend | Aprobados; frontend conserva advertencias de bundle/importaciones |
| Backend M3/M10 focalizado |112 aprobadas, seis archivos |
| Frontend pagos, caja y permisos focalizado |19 aprobadas, cuatro archivos |
| Integración SQL previa |Orden real sin cuenta, tarifa backend, reintento e intruso404; ROLLBACK, sin CUT/cobro |
| E2E público real5178/3008 |Aprobado y persistente |
| E2E registrado real5178/3008 |Aprobado y persistente, incluye devolución |
| Comprobaciones finales HTTP |18 aprobadas, incluidas negativas y reintentos concurrentes |
| JavaScript del navegador |Sin errores en ambos recorridos |
| PostgreSQL/MinIO |Persistencia y contenido comprobados |
| git diff --check del alcance |Aprobado; advertencias CRLF sin error de whitespace |

El primer ensayo SQL necesitó aportar correlation_id e IP válidos, como lo hace el middleware HTTP. Los intentos incompletos se revirtieron; no se cambió la aplicación para evitar auditoría. La primera verificación de tamaños comparó un número con el BIGINT textual de PostgreSQL; se corrigió únicamente el script de prueba y la repetición aprobó. No fueron errores del flujo ciudadano ni se ocultaron registros incompletos.

Las suites globales anteriores1.486/941 se conservan como evidencia histórica y no se presentan como ejecutadas otra vez. El error de lint preexistente en StepDocumentos sigue documentado; no se reestructuró el componente para corregirlo fuera del alcance.

## Tarifas y procedimiento gratuito

Las18 tarifas verificadas conservan sus importes. SUZ26-068 permanece sin tarifa validada por la ambigüedad entre10.50 y10.00 por hoja; no se inventó importe ni se habilitó para cobros. Los otros18 pueden obtener órdenes por su tarifa vigente.

No hay procedimiento gratuito institucional acreditado entre los19 configurados. La regla de tarifa0 sin orden/cobro tiene pruebas automatizadas aprobadas, pero no se ejecutó un E2E gratuito institucional inventando un catálogo o una tarifa. Ese caso queda NO APLICABLE AL CATÁLOGO ACTUAL, pendiente de un procedimiento gratuito documentado si el Instituto lo requiere.

## Evidencias

Raíz: scratch/evidencias-m10/publica13/.

- migracion13-aplicada.json; antes-migracion.json; preflight-sql-rollback.json.
- e2e-publico.json; red-publica.json; verificacion-final.json; estado-servicios-final.json.
- orden-publica-sin-cuenta.png; tesorero-recepcion-con-vuelto.png; cargo-publico-persistente.png; seguimiento-publico-autorizado.png.
- recibo-publico-demo.pdf; solicitud-demo-publica.pdf; cargo-publico-impresion.pdf.
- registrado/prueba-persistente.json y capturas/PDF de radicación, Mis trámites, devolución y cierre de caja.
- Activación: scratch/evidencias-m10/publica13-{antes,despues}.json, publica13-activacion-proceso.json y publica13-backend-20261031-093207.{stdout,stderr}.log.

## Archivos y límites pendientes

Se ajustó la propuesta13 para usar la transacción del runner y se aplicó exclusivamente esa versión. Se corrigieron los avisos frontend de omisión de pago para que no se muestren cuando hay una orden vinculada. Se incorporaron herramientas de validación y evidencias sin reconstruir M10, la portada ni otros módulos.

Pendientes institucionales: aclaración de SUZ26-068, designación formal del TESORERO, aprobación del formato/serie del recibo interno RC-v2. No hay comprobante tributario externo ni SMTP configurado.

Límites que no se presentan como resueltos: recuperación segura ante vencimiento24h, pérdida de sesión o cambio de IP después de pagar; devolución de una persona sin cuenta por un canal institucional autorizado; representación jurídica pública, que conserva la derivación a ventanilla existente. No se sustituye ninguno de esos controles por una consulta por DNI. El E2E de DNI está probado; CE conserva validaciones, sin un E2E adicional en esta fase.

Veredicto: el objetivo prioritario de radicación pública sin cuenta con pago explícito en efectivo está IMPLEMENTADO, ACTIVADO Y VERIFICADO EN DEMOSTRACIÓN. No equivale a una puesta en operación financiera institucional ni acredita dinero real.
