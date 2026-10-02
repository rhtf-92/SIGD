# Contratos individuales de Geric (RD-01 a RD-05)

## Historial y nombre lógico

La asignación individual del plan llama `sigd_tra.movimiento` a la bitácora que
RD-02 debe particionar. Otras secciones del mismo plan (arquitectura de la
migración 06, partición DEFAULT y endpoint de trazabilidad), el DDL documental
de RutaDoc y el código publicado identifican esa bitácora como
`sigd_rut.movimiento_tramite`. El DDL actual de TramiCore define expediente y
trámite, pero no una tabla física `sigd_tra.movimiento`.

Por ownership, **`sigd_rut.movimiento_tramite` es la única tabla histórica
particionada RANGE por `fecha_hora`**. Tiene particiones 2026, 2027 y DEFAULT.
`sigd_tra.movimiento` se interpreta como nombre lógico contradictorio del plan;
no se crea una segunda tabla ni una vista que aparente estar particionada.
`sigd_rut.movimiento_compensatorio` conserva exclusivamente las reversiones
especiales y comparte secuencia e identidad con el historial normal. La tabla
`sigd_rut.estado_actual_expediente` es una proyección reconstruible de la última
secuencia, no un segundo historial. La migración propia hace backfill idempotente
y los triggers de INSERT la actualizan en la misma transacción.

La reversión conserva en el asiento compensatorio `datos.areaId` del movimiento
efectivo anterior al objetivo. La proyección restaura el área junto con el
estado; la prueba PostgreSQL verifica los filtros de área antes y después.

## Consulta operativa

La proyección evita buscar el último movimiento en tres particiones y en la
tabla compensatoria por cada expediente consultado. El índice B-Tree
`ix_rutadoc_expediente_fecha_id` sobre el contrato externo de TramiCore se crea
desde `06_sigd_rut.sql` sólo cuando `sigd_tra.expediente` existe. El runner
institucional debe instalar TramiCore antes de RutaDoc o repetir la migración
idempotente. No se modifica ninguna migración ajena. La migración propia instala
un adaptador de trigger sobre `sigd_tra.expediente` si la tabla existe. Ese
trigger y el de la proyección mantienen en la misma transacción seis filas de
`sigd_rut.contador_pestana_local`, incluidos los expedientes sin movimiento.
La reconstrucción idempotente toma locks de tabla y calcula las seis filas desde
el expediente externo y la proyección; sus valores tienen `CHECK (cantidad >= 0)`.
Si el DDL externo se instala después, es obligatorio repetir la migración propia
para activar el adaptador rápido. Si falta o está deshabilitado, la sentencia de
bandeja usa el conteo completo exacto en el mismo snapshot; no sirve un valor
local potencialmente obsoleto. El contrato externo queda limitado a INSERT, DELETE
y cambios de ID; no se alteran columnas ni migraciones TramiCore. Las consultas
con término, área o fechas conservan los filtros exactos sobre tablas base.

La prueba reproducible `tests/performance/rutadoc-benchmark.test.ts` usa PostgreSQL
18 aislado, 50 000 expedientes, 45 000 movimientos, diez estados, cinco
calentamientos y veinte mediciones por escenario. En la medición del 25-09-2026,
la bandeja base tuvo medianas de 1,4786000000003696 ms para elementos,
0,5103999999992084 ms para contadores y 4,264600000000428 ms para el endpoint
HTTP completo con servidor persistente. Con cursor, el endpoint registró
4,371700000000601 ms de mediana. `EXPLAIN (ANALYZE, BUFFERS)` mostró
`Index Scan` sobre `ix_rutadoc_expediente_fecha_id` para la página; la lectura
de seis contadores tomó 0,02 ms y recorrió solamente una página de
`contador_pestana_local`. La meta de mediana inferior a 15 ms se alcanzó para
base y cursor; los p95 respectivos fueron 5,202499999999418 ms y
5,6120000000009895 ms. Las seis pestañas tuvieron mediana y p95 inferiores
a 15 ms en esta corrida. Forzar `Index Only Scan` en la agrupación directa
tomó 6,488 ms por EXPLAIN, frente a 5,724 ms del `Seq Scan` elegido por el
planificador; no se fuerza ese índice en producción.
Los filtros de término y fecha continúan costosos: en una prueba aislada
`pg_trgm` con GIN aceleró una búsqueda sólo en `tramite.asunto`, pero el predicado
canónico concatena CUT y asunto de dos tablas y EXPLAIN no utilizó esos GIN.
No se atribuye un beneficio al índice experimental ni se instala en producción.

## Actor y autorización

`ActorProviderRutaDoc` recibe un `Request` y entrega un actor procedente de
autenticación ya verificada. `actorProviderNoConfigurado`, utilizado por defecto
en producción mientras IdentiCore no publique su middleware, devuelve `null` y
produce 401. La política de reversión se inyecta por separado y deniega por
defecto (403). La aplicación puede conectar el proveedor en
`construirApp(pool, { actorProviderRutaDoc, politicaReversionRutaDoc })`.
`tests/support/rutadoc-actor-provider.ts` es el adaptador exclusivo de pruebas.
No se acepta identidad desde body, query ni headers libres.

## Folios y outbox

`FolioCompensationPort.solicitar` recibe el mismo `PoolClient` transaccional,
expediente, movimiento original, asiento compensatorio, rango, motivo, actor,
correlation_id y clave de idempotencia. El adaptador Postgres crea exactamente
una `sigd_rut.solicitud_compensacion_folios`, inicialmente `PENDIENTE`, con
referencia UUID única. Si existe `sigd_audit.evento_outbox`, usa el repositorio
canónico de CoreLink para encolar `CompensacionFoliosSolicitada` dentro de la
misma transacción. El endpoint exige correlation_id UUID para ese contrato.
Un fallo revierte asiento, identidad, secuencia, solicitud y evento outbox.

La solicitud local registra los estados `PENDIENTE`, `PROCESANDO`, `COMPLETADO`
y `FALLIDO`; `registrarEstado` sólo permite PENDIENTE→PROCESANDO,
PROCESANDO→COMPLETADO/FALLIDO y FALLIDO→PROCESANDO. La API de reversión no
marca éxito de DocuCore. El worker actual de CoreLink es un despachador de
demostración; falta conectar un consumidor real de DocuCore. Si el outbox no
está instalado, la solicitud local queda durable y pendiente de entrega.

## Advisory Lock

`bloquearExpedienteRutaDoc(cliente, expedienteId)` ejecuta exactamente
`SELECT pg_advisory_xact_lock(hashtext('exp_' || $1::text))`. La reversión la
invoca después de BEGIN y antes de releer, reservar e insertar en el mismo
cliente. Es la única escritura de movimientos implementada en esta rama de
RutaDoc. **Todo futuro escritor de estados o movimientos de RutaDoc o TramiCore
debe adquirir el mismo lock antes de releer y modificar el expediente.** Esta
adopción por otros equipos todavía no está implementada aquí.
